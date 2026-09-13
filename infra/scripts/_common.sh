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

export_tf_secrets() {
  local var name
  for var in supabase_database_password:SUPABASE_DB_PASSWORD \
             supabase_access_token:SUPABASE_ACCESS_TOKEN \
             supabase_google_client_id:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID \
             supabase_google_client_secret:SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET \
             cloudflare_api_token:CLOUDFLARE_API_TOKEN \
             cloudflare_zone_id:CLOUDFLARE_ZONE_ID; do
    name="${var#*:}"
    if [[ -n "${!name:-}" ]]; then export "TF_VAR_${var%%:*}=${!name}"
    else unset "TF_VAR_${var%%:*}"; fi
  done
}

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

preflight_cloudflare() {
  local environment="$1" have=0
  is_set "${CLOUDFLARE_API_TOKEN:-}" && have=$((have + 1))
  is_set "${CLOUDFLARE_ZONE_ID:-}" && have=$((have + 1))

  if ((have == 1)); then
    check "Cloudflare credentials are complete" \
      "only one of CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID is set — DNS needs both or neither." \
      false
    return
  fi
  ((have == 2)) && { ok "Cloudflare credentials are set"; return; }

  local managed=""
  if command -v gh >/dev/null 2>&1; then
    managed="$(gh variable list --env "$environment" --json name -q '.[].name' 2>/dev/null \
      | grep -x CLOUDFLARE_ZONE_ID || true)"
  fi

  if [[ -z "$managed" ]] && ! gh auth status >/dev/null 2>&1; then
    warn "Could not check whether '$environment' manages DNS — gh is not authenticated."
  fi

  if [[ -n "$managed" ]]; then
    check "Cloudflare credentials are set" \
      "'$environment' has a Terraform-managed custom domain, but CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are unset here — this run would destroy its DNS records and unbind the domain." \
      false
  fi
}

preflight_failed() {
  ((${#errors[@]})) || return 1
  printf '\n%spreflight failed — nothing has been changed:%s\n' "$RED" "$OFF" >&2
  printf '  - %s\n' "${errors[@]}" >&2
  printf '\n' >&2
  return 0
}

load_env_file() {
  local file="$1" line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"; key="${key#"${key%%[![:space:]]*}"}"; key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    value="${line#*=}"; value="${value%$'\r'}"
    if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; fi
    printf -v "$key" '%s' "$value"
    export "${key?}"
  done < "$file"
}

load_env_files() {
  local environment="$1" f loaded=()
  for f in "$REPO_ROOT/.env" "$REPO_ROOT/.env.$environment"; do
    [[ -f "$f" ]] && { load_env_file "$f"; loaded+=("$(basename "$f")"); }
  done
  ((${#loaded[@]})) && ok "variables loaded from ${loaded[*]}" \
                    || ok "no .env files — using exported variables"
}
