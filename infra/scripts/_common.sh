# Shared by apply-environment.sh and destroy-environment.sh; sourced, not executed.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA="$REPO_ROOT/infra"

# Set once the environment is known; every root for an environment lives under it.
env_dir() { ENV_DIR="$INFRA/environments/$1"; }

if [[ -t 1 ]]; then BOLD=$'\033[1m'; RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; OFF=$'\033[0m'
else BOLD=""; RED=""; GRN=""; YEL=""; OFF=""; fi

step() { printf '\n%s==> %s%s\n' "$BOLD" "$*" "$OFF"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '    %s✓%s %s\n' "$GRN" "$OFF" "$*"; }
warn() { printf '    %s!%s %s\n' "$YEL" "$OFF" "$*"; }
die()  { printf '\n%serror:%s %s\n\n' "$RED" "$OFF" "$*" >&2; exit 1; }

# Numbered stages. Set STAGES to the total, then call stage "<imperative description>".
STAGE=0
stage() { STAGE=$((STAGE + 1)); step "Stage $STAGE/$STAGES — $1"; }

# Output from terraform, az and supabase is streamed one level deeper than the script's own
# messages, so a long run reads as detail beneath its stage rather than competing with it.
# `run` reports the command's status, not sed's; `indent` is the same for an existing pipeline.
indent() { sed 's/^/      /'; }
run()    { "$@" 2>&1 | indent; return "${PIPESTATUS[0]}"; }

# Preflight reports each check as it runs and collects every failure, so one run shows everything
# that is missing rather than stopping at the first.
errors=()
fail()  { printf '    %s✗%s %s\n' "$RED" "$OFF" "$1"; errors+=("$2"); }
check() { local label="$1" hint="$2"; shift 2; if "$@" >/dev/null 2>&1; then ok "$label"; else fail "$label" "$hint"; fi; }
missing_tools() { local t out=(); for t in "$@"; do command -v "$t" >/dev/null 2>&1 || out+=("$t"); done; printf '%s' "${out[*]}"; }

# The checks both scripts need: $1 explains why CI is refused, the rest are the required tools.
# Sets SUBSCRIPTION_ID as a side effect, which both scripts report so it is obvious which
# subscription is about to be changed.
# Secrets reach Terraform through TF_VAR_* rather than a generated tfvars file: interpolating them
# into double-quoted HCL breaks on a value containing " or \, and silently applies the wrong value
# for one containing ${, which HCL evaluates. It also keeps them off disk in a public repo.
#
# Shared because both scripts run terraform against roots that declare these variables — destroy
# needs them just to build a plan.
# Call AFTER load_env_files: an empty TF_VAR_ is not the same as an absent one. It overrides the
# variable's null default, and the Supabase provider then sees an empty token rather than falling
# back to SUPABASE_ACCESS_TOKEN — so an unset secret is unexported, not exported blank.
export_tf_secrets() {
  local var name
  for var in supabase_database_password:SUPABASE_DB_PASSWORD \
             supabase_access_token:SUPABASE_ACCESS_TOKEN \
             supabase_google_client_id:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID \
             supabase_google_client_secret:SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET; do
    name="${var#*:}"
    if [[ -n "${!name:-}" ]]; then export "TF_VAR_${var%%:*}=${!name}"
    else unset "TF_VAR_${var%%:*}"; fi
  done
}

# `.env.example` ships non-empty placeholders like <personal access token from ...>, so a bare
# `test -n` passes for a value the user never filled in — and the run then fails several stages
# deep, which is what preflight exists to prevent.
is_set() { [[ -n "${1:-}" && "$1" != *"<"*">"* ]]; }

preflight_base() {
  local ci_reason="$1"; shift
  local tools list
  check "not running in CI" "$ci_reason" test -z "${CI:-}"

  tools="$(missing_tools "$@")"
  list="$(printf '%s, ' "$@")"; list="${list%, }"
  check "required tools: $list" "not on PATH: $tools" test -z "$tools"

  if SUBSCRIPTION_ID="$(az account show --query id -o tsv 2>/dev/null)"; then
    ok "Azure CLI authenticated (subscription $SUBSCRIPTION_ID)"
  else
    fail "Azure CLI authenticated" "Azure CLI is not logged in. Run: az login --use-device-code"
  fi

  load_env_files "$ENVIRONMENT"

  check "SUPABASE_ACCESS_TOKEN is set" \
    "SUPABASE_ACCESS_TOKEN is unset or still a placeholder. See https://supabase.com/dashboard/account/tokens." \
    is_set "${SUPABASE_ACCESS_TOKEN:-}"
}

preflight_failed() {
  ((${#errors[@]})) || return 1
  printf '\n%spreflight failed — nothing has been changed:%s\n' "$RED" "$OFF" >&2
  printf '  - %s\n' "${errors[@]}" >&2
  printf '\n' >&2
  return 0
}

# Reads KEY=VALUE without evaluating it. `source` would be shorter, but these files hold secrets
# and are hand-edited: a value containing <, >, backticks or $(...) is either a syntax error or
# arbitrary command execution. The stock .env.staging already trips it.
load_env_file() {
  local file="$1" line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"; key="${key#"${key%%[![:space:]]*}"}"; key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    value="${line#*=}"
    if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; fi
    printf -v "$key" '%s' "$value"
    export "${key?}"
  done < "$file"
}

# `.env` holds what both environments share; `.env.<environment>` overrides it.
load_env_files() {
  local environment="$1" f loaded=()
  for f in "$REPO_ROOT/.env" "$REPO_ROOT/.env.$environment"; do
    [[ -f "$f" ]] && { load_env_file "$f"; loaded+=("$(basename "$f")"); }
  done
  ((${#loaded[@]})) && ok "variables loaded from ${loaded[*]}" \
                    || ok "no .env files — using exported variables"
}
