#!/usr/bin/env bash
#
# Destroy one environment — the inverse of apply-environment.sh.
#
#   pnpm infra:destroy staging                        everything (default)
#   pnpm infra:destroy staging --keep-bootstrap     the environment only, keeping state + identity
#
# NEVER RUN IN CI. Destroying an environment is a human decision, and this deletes the Supabase
# project and its data — free-tier projects have no point-in-time recovery. Production carries
# prevent_destroy and Terraform will refuse; that refusal is the design working.
#
# Step 4 deletes the resource group via the CLI rather than `terraform destroy` on bootstrap/,
# because bootstrap keeps its state inside the storage account it manages: Terraform would delete
# the container, then have nowhere to write the state recording it.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

ENVIRONMENT=""; DESTROY_ALL=1; CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --keep-bootstrap) DESTROY_ALL=0 ;;
    --check)            CHECK_ONLY=1 ;;
    -*)                 die "unknown option: $arg" ;;
    *)                  ENVIRONMENT="$arg" ;;
  esac
done

case "$ENVIRONMENT" in
  staging)    SUFFIX="staging" ;;
  production) SUFFIX="prod" ;;   # resources use the short form: rg-10xgains-prod, log-10xgains-prod
  *) die "usage: $(basename "$0") <staging|production> [--keep-bootstrap] [--check]" ;;
esac
env_dir "$ENVIRONMENT"

# ─── preflight ────────────────────────────────────────────────────────────────────────────────

step "Preflight — verify prerequisites for '$ENVIRONMENT'"

preflight_base "Refusing to run in CI (\$CI is set). Destroying an environment is a human decision." \
  az terraform jq

check "SUPABASE_DB_PASSWORD is set" \
  "SUPABASE_DB_PASSWORD is unset or still a placeholder; Terraform needs it to build a plan." \
  is_set "${SUPABASE_DB_PASSWORD:-}"

DIR="$ENV_DIR/resources"
check "$ENVIRONMENT/resources is configured" \
  "$DIR/backend.hcl or terraform.tfvars is missing — run 'pnpm infra:apply $ENVIRONMENT' to regenerate them." \
  bash -c '[[ -f "$0/backend.hcl" && -f "$0/terraform.tfvars" ]]' "$DIR"

preflight_failed && exit 1
export_tf_secrets

# Terraform's destroy leaves the Log Analytics workspace SOFT-deleted, which reserves its name for
# 14 days — the next apply then fails on a name collision with a misleading error (spec §10).
# Purging is therefore part of destroying the environment, not an optional follow-up.
#
# Handles all three states: still present (force-delete), already soft-deleted (recover, then
# force-delete), or genuinely absent.
purge_log_analytics() {
  local rg="rg-10xgains-$SUFFIX" ws="log-10xgains-$SUFFIX"
  if az monitor log-analytics workspace delete -g "$rg" -n "$ws" --force --yes -o none 2>/dev/null; then
    ok "$ws purged — its name is free for a rebuild"
  elif az monitor log-analytics workspace recover -g "$rg" -n "$ws" -o none 2>/dev/null \
    && az monitor log-analytics workspace delete -g "$rg" -n "$ws" --force --yes -o none 2>/dev/null; then
    ok "$ws recovered and purged — its name is free for a rebuild"
  else
    info "no Log Analytics workspace to purge"
  fi
}

# ─── show exactly what will go ────────────────────────────────────────────────────────────────
((CHECK_ONLY)) && { step "Preflight only — nothing was changed"; exit 0; }

step "Plan — what will be destroyed in '$ENVIRONMENT'"
info "initialising the resources root…"
terraform -chdir="$DIR" init -reconfigure -backend-config=backend.hcl -input=false -no-color >/dev/null
terraform -chdir="$DIR" plan -destroy -input=false -no-color -out=tfdestroy >/dev/null
printf '\n'
# Terraform indents its own resource lines; strip that so both halves land at one level.
PLAN="$(terraform -chdir="$DIR" show -no-color tfdestroy | grep -E '^  # |^Plan:' | sed 's/^ *//' || true)"
if [[ -n "$PLAN" ]]; then
  printf '%s\n' "$PLAN" | indent
else
  info "nothing to destroy — the resources root is already empty"
fi

# ─── confirm ──────────────────────────────────────────────────────────────────────────────────
printf '\n%s%sThis deletes the Supabase project and all of its data.%s\n' "$BOLD" "$YEL" "$OFF"
if ((DESTROY_ALL)); then
  printf '%sAlso removing the CI identity and the state backend — nothing for this environment\n' "$YEL"
  printf 'will remain, including its Terraform state. Rebuilding needs an Owner to run infra:apply.%s\n' "$OFF"
else
  printf '%s--keep-bootstrap: the bootstrap root is left in place.%s\n' "$YEL" "$OFF"
fi
[[ "$ENVIRONMENT" == "production" ]] && \
  printf '%sPRODUCTION. Free-tier projects have no point-in-time recovery. There is no undo.%s\n' "$RED" "$OFF"
printf '\nType the environment name to confirm: '
read -r reply
[[ "$reply" == "$ENVIRONMENT" ]] || { rm -f "$DIR/tfdestroy"; die "confirmation did not match — nothing has been changed."; }

# ─── destroy ──────────────────────────────────────────────────────────────────────────────────
STAGES=$(( DESTROY_ALL ? 4 : 2 ))
stage "destroy the Azure resources and the Supabase project"
run terraform -chdir="$DIR" apply -input=false -no-color tfdestroy || die "terraform destroy failed for $DIR."
rm -f "$DIR/tfdestroy"
if [[ -n "$PLAN" ]]; then
  ok "$(grep -c '^# ' <<<"$PLAN") resources destroyed"
else
  ok "nothing to destroy"
fi

stage "purge the Log Analytics workspace"
purge_log_analytics

if ((DESTROY_ALL)); then
  # The bootstrap root holds both the state backend and the CI identity; destroying it removes
  # the app registration and role assignments. The storage account goes with the resource group
  # below, which also takes this root's own state.
  stage "destroy the CI identity"
  BOOT="$ENV_DIR/bootstrap"
  if [[ -f "$BOOT/backend.hcl" ]]; then
    info "initialising the bootstrap root…"
    terraform -chdir="$BOOT" init -reconfigure -backend-config=backend.hcl -input=false -no-color >/dev/null
    run terraform -chdir="$BOOT" destroy -auto-approve -input=false -no-color -target=module.identity \
      || die "could not destroy the CI identity."
    ok "application registration, federated credential and role assignments deleted"
  else
    info "no backend.hcl — nothing to destroy"
  fi

  stage "delete the resource group"
  info "deleting rg-10xgains-$SUFFIX — this takes a few minutes…"
  az group delete -n "rg-10xgains-$SUFFIX" --yes -o none
  ok "rg-10xgains-$SUFFIX and its Terraform state deleted"

  step "Done — '$ENVIRONMENT' fully removed"
  info "nothing remains — rebuild with: pnpm infra:apply $ENVIRONMENT"
  printf '\n'
  info "the GitHub environment still holds variables and secrets pointing at resources that no"
  info "longer exist; infra:apply overwrites them on the next run"
  printf '\n'
else
  step "Done — '$ENVIRONMENT' destroyed"
  info "kept: the resource group, state account, both containers and the CI identity"
  info "the workspace was purged, so a rebuild will not collide on its name"
  info "rebuild with: pnpm infra:apply $ENVIRONMENT"
  printf '\n'
fi
