#!/usr/bin/env bash
#
# Provision one environment: Azure scaffolding, CI identity, the environment, the database schema,
# and the GitHub environment configuration.
#
#   pnpm infra:apply staging
#   pnpm infra:apply staging --bootstrap-only   state backend, CI identity and GitHub config only
#
# NEVER RUN IN CI. It creates role assignments and Entra applications — the credentials CI itself
# authenticates with. Every stage is idempotent; safe to re-run after a failure partway through.
#
# --bootstrap-only stops after exactly the things CI cannot do for itself, leaving the resources
# root for CD to apply. Useful after a full destroy, which takes the identity and the state with it.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

# ─── arguments ────────────────────────────────────────────────────────────────────────────────
ENVIRONMENT=""; CHECK_ONLY=0; BOOTSTRAP_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --check)          CHECK_ONLY=1 ;;
    --bootstrap-only) BOOTSTRAP_ONLY=1 ;;
    -*)               die "unknown option: $arg" ;;
    *)                ENVIRONMENT="$arg" ;;
  esac
done

case "$ENVIRONMENT" in
  staging)
    RESOURCE_GROUP="rg-10xgains-staging"; STATE_ACCOUNT="st10xgtfstatestaging"
    APP_NAME="github-10xgains-staging"
    FUNCTIONAPP="func-10xgains-staging"; STATICWEBAPP="swa-10xgains-staging" ;;
  production)
    RESOURCE_GROUP="rg-10xgains-prod";    STATE_ACCOUNT="st10xgtfstateprod"
    APP_NAME="github-10xgains-production"
    FUNCTIONAPP="func-10xgains-prod";     STATICWEBAPP="swa-10xgains-prod" ;;
  *)
    die "usage: $(basename "$0") <staging|production> [--bootstrap-only] [--check]" ;;
esac
LOCATION="westeurope"
env_dir "$ENVIRONMENT"
# Bootstrap-only still configures the GitHub environment: those entries are derived from stage 2's
# identity and from static names, not from the resources root, so they are correct before it exists.
STAGES=$(( BOOTSTRAP_ONLY ? 3 : 5 ))

# ─── preflight: check EVERYTHING before doing ANY work ────────────────────────────────────────
# Collect every failure rather than dying on the first, so one run tells you everything that is
# missing. Provisioning half an environment and then stopping for a missing token is the outcome
# this section exists to prevent.
preflight() {
  step "Preflight — verify prerequisites for '$ENVIRONMENT'"

  preflight_base "Refusing to run in CI (\$CI is set). This script provisions credentials; see the header." \
    az terraform gh jq pnpm curl

  OPERATOR_OID="$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)"
  check "operator identity resolved" \
    "Could not resolve your Entra object id (az ad signed-in-user show). Graph permissions may be missing." \
    test -n "$OPERATOR_OID"

  check "GitHub CLI authenticated" "GitHub CLI is not authenticated. Run: gh auth login" gh auth status

  # Stage 5 writes the rest, but these are never written by this script — on a fresh environment
  # their absence surfaces as a failed `azure/login` several minutes into the first deploy.
  local missing_secrets
  missing_secrets="$(
    comm -23 <(printf '%s\n' AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID SUPABASE_ACCESS_TOKEN | sort) \
             <(gh secret list --env "$ENVIRONMENT" --json name -q '.[].name' 2>/dev/null | sort) | tr '\n' ' '
  )"
  check "GitHub environment secrets present" \
    "not set on the '$ENVIRONMENT' GitHub environment: $missing_secrets" \
    test -z "$missing_secrets"

  check "SUPABASE_ORGANIZATION_ID is set" \
    "SUPABASE_ORGANIZATION_ID is unset or still a placeholder (see: supabase orgs list)." \
    is_set "${SUPABASE_ORGANIZATION_ID:-}"
  check "SUPABASE_DB_PASSWORD is set" \
    "SUPABASE_DB_PASSWORD is unset or still a placeholder." \
    is_set "${SUPABASE_DB_PASSWORD:-}"

  preflight_cloudflare 0

  preflight_failed && exit 1

  if ! is_set "${CLOUDFLARE_API_TOKEN:-}"; then
    warn "No Cloudflare credentials — '$ENVIRONMENT' will keep its generated hostname."
  fi
  if [[ "$ENVIRONMENT" == "production" ]]; then
    warn "Google OAuth redirect URIs are manual (spec §7) — add the new callback URL before cutover."
  fi
}

# ─── terraform helpers ────────────────────────────────────────────────────────────────────────
tf() { terraform -chdir="$1" "${@:2}"; }

# Adopt a pre-existing resource only when it is not already tracked, so re-runs are no-ops.
# Azure RBAC is eventually consistent across storage frontend nodes. For the first minutes after
# stage 1 creates the role assignments, individual requests 403 while others succeed — so it is not
# enough to wait once and proceed: every call that touches state has to tolerate it. Observed on a
# fresh account: init succeeded, three imports succeeded, then a lock release 403'd.
#
# A failed release strands the lease, which then blocks the next call with "already locked", so the
# lease is broken before each retry. Safe here because the only process using this state is this
# script, and the preflight refuses to run in CI.
tf_unlock() {
  local dir="$1" account container key
  [[ -f "$dir/backend.hcl" ]] || return 0
  account=$(awk -F'"' '/storage_account_name/ {print $2}' "$dir/backend.hcl")
  container=$(awk -F'"' '/container_name/ {print $2}' "$dir/backend.hcl")
  key=$(awk -F'"' '/^key/ {print $2}' "$dir/backend.hcl")
  az storage blob lease break --account-name "$account" -c "$container" -b "$key" \
    --auth-mode login -o none 2>/dev/null || true
}

# Only the two failures above resolve on their own, so only they are retried; everything else is
# reported immediately with its error. Retrying a deterministic failure buries the cause and
# misattributes it — a fresh Supabase project rejecting its settings was read here as an RBAC
# timeout, twenty times over.
#
# Match the message, not the error code: the azurerm backend surfaces the data-plane 403 as
#   Error writing state file: ... unexpected status 403 (403 This request is not authorized to
#   perform this operation using this permission.) with EOF
# with no AuthorizationPermissionMismatch anywhere in it. Verify any addition against real output.
TF_TRANSIENT='unexpected status 403|AuthorizationPermissionMismatch|AuthorizationFailure|not authorized to perform this operation|does not have authorization to perform action|Error acquiring the state lock|blob is already locked'

# Stdout is passed through so callers can capture it; notices and errors go to stderr.
tf_retry() {
  local dir="$1"; shift
  local i err; err="$(mktemp)"
  for i in $(seq 1 20); do
    tf "$dir" "$@" 2>"$err" && { rm -f "$err"; return 0; }
    if ! grep -qE "$TF_TRANSIENT" "$err"; then
      cat "$err" >&2; rm -f "$err"; return 1
    fi
    info "role assignment has not propagated yet — retry $i/20 in 15s…" >&2
    tf_unlock "$dir"
    sleep 15
  done
  cat "$err" >&2; rm -f "$err"
  # Returns rather than dying: several callers run this in a pipeline or command substitution,
  # where `exit` would only leave the subshell and the failure would go unnoticed.
  printf 'terraform could not reach %s after 5 minutes of RBAC 403s — re-run the script.\n' "$dir" >&2
  return 1
}

IMPORTED=0; TRACKED=0
tf_import_if_absent() {
  local dir="$1" address="$2" id="$3"
  local existing
  TRACKED=$((TRACKED + 1))
  existing="$(tf_retry "$dir" state list)" || die "could not read the Terraform state for $dir."
  if grep -qxF "$address" <<<"$existing"; then
    info "already in state: $address"
  else
    info "importing $address"
    tf_retry "$dir" import -input=false -no-color "$address" "$id" >/dev/null || die "terraform import failed for $dir."
    IMPORTED=$((IMPORTED + 1))
  fi
}

write_backend_config() {
  local dir="$1" container="$2" key="$3"
  cat > "$dir/backend.hcl" <<EOF
resource_group_name  = "$RESOURCE_GROUP"
storage_account_name = "$STATE_ACCOUNT"
container_name       = "$container"
key                  = "$key"
use_azuread_auth     = true
EOF
}

# ─── stage 1: state backend ───────────────────────────────────────────────────────────────────
# Created with the Azure CLI rather than Terraform, because Terraform needs this storage to exist
# before `init` can configure its backend. Creating it here and importing it afterwards avoids the
# alternative — applying to local state, then migrating — which cannot be scripted without editing
# the Terraform source in place.
stage_bootstrap_create() {
  stage "create the resource group, state account and containers"

  az group create -n "$RESOURCE_GROUP" -l "$LOCATION" -o none
  ok "resource group $RESOURCE_GROUP"

  if ! az storage account show -n "$STATE_ACCOUNT" -g "$RESOURCE_GROUP" -o none 2>/dev/null; then
    az storage account create \
      -n "$STATE_ACCOUNT" -g "$RESOURCE_GROUP" -l "$LOCATION" \
      --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
      --allow-blob-public-access false --allow-shared-key-access false \
      --default-action Allow -o none
    az storage account blob-service-properties update \
      -n "$STATE_ACCOUNT" -g "$RESOURCE_GROUP" \
      --enable-versioning true --enable-delete-retention true --delete-retention-days 30 \
      --enable-container-delete-retention true --container-delete-retention-days 30 -o none
  fi
  ok "storage account $STATE_ACCOUNT (shared-key access off, versioning on)"

  # Two containers: `tfstate` is granted to the CI principal, `admin` never is — it holds
  # bootstrap and identity state, which records the storage account's own keys.
  for c in tfstate admin; do
    az storage container create --account-name "$STATE_ACCOUNT" -n "$c" --auth-mode login -o none >/dev/null 2>&1 || true
  done
  ok "containers tfstate + admin"

  local sa_id="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STATE_ACCOUNT"
  for c in tfstate admin; do
    az role assignment create --assignee-object-id "$OPERATOR_OID" --assignee-principal-type User \
      --role "Storage Blob Data Contributor" --scope "$sa_id/blobServices/default/containers/$c" -o none 2>/dev/null || true
  done
  # Not verified here: Azure RBAC is eventually consistent across storage frontends, so a probe
  # can succeed while the next request to a different node still 403s. Stage 2 retries instead.
  ok "operator data-plane access (Owner alone does not confer it)"
}

# ─── stage 2: bootstrap ───────────────────────────────────────────────────────────────────────
stage_bootstrap_adopt() {
  stage "adopt them into Terraform and create the CI identity"
  local dir="$ENV_DIR/bootstrap"
  local rg_id="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"
  local sa_id="$rg_id/providers/Microsoft.Storage/storageAccounts/$STATE_ACCOUNT"

  write_backend_config "$dir" admin bootstrap.tfstate
  cat > "$dir/terraform.tfvars" <<EOF
subscription_id       = "$SUBSCRIPTION_ID"
operator_principal_id = "$OPERATOR_OID"
EOF

  info "initialising the bootstrap root against the admin container…"
  tf_retry "$dir" init -reconfigure -backend-config=backend.hcl -input=false -no-color >/dev/null || die "terraform init failed for $dir."
  ok "backend initialised — state at admin/bootstrap.tfstate"

  tf_import_if_absent "$dir" "module.bootstrap.azurerm_resource_group.env"       "$rg_id"
  tf_import_if_absent "$dir" "module.bootstrap.azurerm_storage_account.state"    "$sa_id"
  tf_import_if_absent "$dir" "module.bootstrap.azurerm_storage_container.tfstate" "$sa_id/blobServices/default/containers/tfstate"
  tf_import_if_absent "$dir" "module.bootstrap.azurerm_storage_container.admin"   "$sa_id/blobServices/default/containers/admin"

  # Created with `az` in stage 1, because Terraform needs data-plane access before it can write
  # state. Adopt them, or the first apply fails with RoleAssignmentExists.
  local c scope ra
  for c in tfstate admin; do
    scope="$sa_id/blobServices/default/containers/$c"
    ra=$(az role assignment list --scope "$scope" \
      --query "[?principalId=='$OPERATOR_OID' && roleDefinitionName=='Storage Blob Data Contributor'].id | [0]" -o tsv 2>/dev/null)
    [[ -n "$ra" ]] && tf_import_if_absent "$dir" "module.bootstrap.azurerm_role_assignment.operator_$c" "$ra"
  done

  ok "$IMPORTED imported, $((TRACKED - IMPORTED)) already tracked ($TRACKED resources adopted)"

  # This root only ever adopts and creates, so a planned destroy means the state was written by a
  # different configuration than the one running now — different module names, or resources split
  # across state files. Left to -auto-approve, Terraform removes whatever the config no longer
  # declares, and in this root that includes the resource group and the state account inside it.
  # Reconcile the addresses (terraform state mv, or `moved` blocks) rather than bypassing this.
  info "planning the bootstrap root…"
  tf_retry "$dir" plan -input=false -no-color -out=tfbootstrap >/dev/null || die "terraform plan failed for $dir."

  local destroys
  destroys="$(tf "$dir" show -json tfbootstrap \
    | jq -r '.resource_changes[]? | select(.change.actions | index("delete")) | .address')"
  if [[ -n "$destroys" ]]; then
    rm -f "$dir/tfbootstrap"
    printf '%s\n' "$destroys" | indent >&2
    die "the bootstrap plan would destroy the resources above — refusing. State and configuration disagree; see the note above this check in $(basename "${BASH_SOURCE[0]}")."
  fi

  info "applying the bootstrap root — creates the CI identity and its federated credential…"
  tf_retry "$dir" apply -input=false -no-color tfbootstrap | indent || die "terraform apply failed for $dir."
  rm -f "$dir/tfbootstrap"
  AZURE_CLIENT_ID="$(tf_retry "$dir" output -raw client_id)" || die "could not read the client_id output."
  ok "CI identity $APP_NAME ($AZURE_CLIENT_ID)"
  info "scoped to $RESOURCE_GROUP and its tfstate container only; no access to the other environment"
}

# ─── stage 3: the environment ─────────────────────────────────────────────────────────────────
# A newly created project stays COMING_UP for several minutes, and the Management API rejects both
# `supabase_settings` and the `supabase_apikeys` read until it reports ACTIVE_HEALTHY. Neither is a
# retryable Terraform error, so the apply is split around this wait rather than left to fail.
wait_for_supabase_project() {
  local ref="$1" i status
  for i in $(seq 1 40); do
    status="$(curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      "https://api.supabase.com/v1/projects/$ref" 2>/dev/null | jq -r '.status // empty' || true)"
    [[ "$status" == "ACTIVE_HEALTHY" ]] && return 0
    ((i == 1)) && info "project is ${status:-provisioning}; settings and API keys are rejected until it is healthy…"
    sleep 15
  done
  die "Supabase project $ref did not become healthy within 10 minutes."
}

stage_resources() {
  stage "apply the Azure resources and the Supabase project"
  local dir="$ENV_DIR/resources"

  write_backend_config "$dir" tfstate "$ENVIRONMENT.tfstate"
  # The secrets these roots need arrive via TF_VAR_* — see export_tf_secrets in _common.sh.
  cat > "$dir/terraform.tfvars" <<EOF
subscription_id          = "$SUBSCRIPTION_ID"
supabase_organization_id = "$SUPABASE_ORGANIZATION_ID"
EOF

  info "initialising the resources root against the tfstate container…"
  tf_retry "$dir" init -reconfigure -backend-config=backend.hcl -input=false -no-color >/dev/null || die "terraform init failed for $dir."
  ok "backend initialised — state at tfstate/$ENVIRONMENT.tfstate"

  info "creating the Supabase project ahead of everything that depends on it…"
  tf_retry "$dir" apply -auto-approve -input=false -no-color -target=supabase_project.main | indent \
    || die "terraform could not create the Supabase project for $dir."
  # Read from state rather than `output`, which -target leaves uncomputed on a fresh environment.
  SUPABASE_PROJECT_REF="$(tf_retry "$dir" show -json \
    | jq -r '.values.root_module.resources[]? | select(.address == "supabase_project.main") | .values.id')" \
    || die "could not read the Supabase project from state."
  [[ -n "$SUPABASE_PROJECT_REF" ]] || die "the Supabase project is missing from the state for $dir."
  ok "Supabase project $SUPABASE_PROJECT_REF"

  wait_for_supabase_project "$SUPABASE_PROJECT_REF"
  ok "project is healthy"

  info "applying the Azure resources and the Supabase settings…"
  tf_retry "$dir" apply -auto-approve -input=false -no-color | indent || die "terraform apply failed for $dir."
  ok "$FUNCTIONAPP, $STATICWEBAPP and their supporting resources in $RESOURCE_GROUP"

  API_URL="$(tf_retry "$dir" output -raw api_url)" || die "could not read the api_url output."
  APP_URL="$(tf_retry "$dir" output -raw app_url)" || die "could not read the app_url output."
  SUPABASE_URL="$(tf_retry "$dir" output -raw supabase_url)" || die "could not read the supabase_url output."
  GOOGLE_CALLBACK_URL="$(tf_retry "$dir" output -raw supabase_google_callback_url)" \
    || die "could not read the supabase_google_callback_url output."
}

# ─── stage 4: database ────────────────────────────────────────────────────────────────────────
stage_database() {
  stage "push the migrations and run the database tests"
  info "linking the Supabase CLI to $SUPABASE_PROJECT_REF…"
  run bash -c 'cd "$1" && pnpm supabase link --project-ref "$2"' _ "$REPO_ROOT" "$SUPABASE_PROJECT_REF" \
    || die "could not link the Supabase CLI to $SUPABASE_PROJECT_REF."
  ok "linked"

  info "pushing $(ls "$REPO_ROOT/supabase/migrations"/*.sql | wc -l) migrations…"
  run bash -c 'cd "$1" && pnpm supabase db push --yes' _ "$REPO_ROOT" || die "supabase db push failed."
  ok "migrations applied"

  info "running the database tests…"
  run bash -c 'cd "$1" && pnpm supabase db test --linked' _ "$REPO_ROOT" || die "database tests failed."
  ok "database tests passing"
}

# ─── stage 5: GitHub environment ──────────────────────────────────────────────────────────────
# The values below are all derived from Terraform outputs. Setting them by hand is where the
# config-sync gap of spec §1.1 actually bites; writing them here closes it for the values this
# script owns.
stage_github() {
  stage "configure the GitHub environment"
  local repo; repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

  set_var()    { gh variable set "$1" --env "$ENVIRONMENT" --repo "$repo" --body "$2" >/dev/null && info "var    $1"; }
  # Piped rather than passed as an argument, so secret values never appear in the process list.
  set_secret() { printf '%s' "$2" | gh secret set "$1" --env "$ENVIRONMENT" --repo "$repo" >/dev/null && info "secret $1"; }

  set_var AZURE_RESOURCE_GROUP      "$RESOURCE_GROUP"
  set_var AZURE_FUNCTIONAPP_NAME    "$FUNCTIONAPP"
  set_var AZURE_STATIC_WEB_APP_NAME "$STATICWEBAPP"
  set_var TF_STATE_STORAGE_ACCOUNT  "$STATE_ACCOUNT"
  set_var SUPABASE_ORGANIZATION_ID  "$SUPABASE_ORGANIZATION_ID"

  set_secret AZURE_CLIENT_ID      "$AZURE_CLIENT_ID"
  set_secret SUPABASE_DB_PASSWORD "$SUPABASE_DB_PASSWORD"

  # Only when supplied: CD's Terraform then leaves the provider untouched rather than disabling it.
  if [[ -n "${SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID:-}" && -n "${SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET:-}" ]]; then
    set_var    SUPABASE_GOOGLE_CLIENT_ID     "$SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID"
    set_secret SUPABASE_GOOGLE_CLIENT_SECRET "$SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET"
  else
    info "no Google credentials in the environment — skipping SUPABASE_GOOGLE_*"
  fi

  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ZONE_ID:-}" ]]; then
    set_var    CLOUDFLARE_ZONE_ID   "$CLOUDFLARE_ZONE_ID"
    set_secret CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
  else
    info "no Cloudflare credentials — CD will leave DNS unmanaged"
  fi

  ok "GitHub environment '$ENVIRONMENT' on $repo"
  info "URLs and API keys are not stored — CD reads them from Terraform outputs at deploy time"
  info "unchanged: AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, SUPABASE_ACCESS_TOKEN, APP_*_USER_*"
}

# ─── run ──────────────────────────────────────────────────────────────────────────────────────
preflight
export_tf_secrets
((CHECK_ONLY)) && { step "Preflight only — nothing was changed"; exit 0; }
stage_bootstrap_create
stage_bootstrap_adopt

if ((BOOTSTRAP_ONLY)); then
  stage_github
  step "Done — '$ENVIRONMENT' is bootstrapped"
  info "state backend, CI identity and GitHub environment are in place"
  info "the resources root is untouched — push to let CD apply it, or re-run without"
  info "--bootstrap-only to build it here"
  printf '\n'
  exit 0
fi

stage_resources
stage_database
stage_github

step "Done — '$ENVIRONMENT' is provisioned"
info "api      $API_URL"
info "web      $APP_URL"
info "supabase $SUPABASE_URL"
printf '\n'
info "still manual: the Google OAuth redirect URI below, and deleting the retired"
info "github-dmngrsk-10xGains application after cutover (spec §9)."
printf '\n'
info "Register this redirect URI on the Google client. It only changes when the Supabase"
info "project is rebuilt, which infra:destroy --keep-bootstrap avoids:"
info "  $GOOGLE_CALLBACK_URL"
printf '\n'
