#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Waiting for the container's Docker daemon..."
if ! timeout 90 bash -c 'until docker info >/dev/null 2>&1; do sleep 1; done'; then
  echo "The container's Docker daemon did not come up within 90s." >&2
  exit 1
fi

docker compose up -d

SUPABASE_BIN="./node_modules/.bin/supabase"

# Studio bind-mounts this. On a Windows-path workspace the daemon's mkdir fails with a
# spurious EEXIST; create it here so the failure names its cause instead of Studio dying.
if ! mkdir -p supabase/snippets 2>/dev/null; then
  echo "Cannot create supabase/snippets." >&2
  echo "If this workspace is bind-mounted from a Windows path (C:\\...), that filesystem" >&2
  echo "cannot host the Supabase containers. Move the working copy into the WSL2 filesystem;" >&2
  echo "see .claude/skills/windows-dev-container/SKILL.md." >&2
  exit 1
fi

# `supabase status` exits 0 even when only some services are up, so probe the DB and the
# REST gateway directly.
stack_healthy() {
  pg_isready -q -h 127.0.0.1 -p 54322 \
    && curl -fsS -o /dev/null http://127.0.0.1:54321/rest/v1/
}

if ! stack_healthy; then
  # Tear a half-up stack down first, so `start` does not skip the missing containers.
  "$SUPABASE_BIN" stop >/dev/null 2>&1 || true
  "$SUPABASE_BIN" start
fi

# Services listen on fixed ports inside the container; the host publishes per-worktree ports.
# Mirror each published port inward so one URL works for both the host browser and Cypress.
alias_port() {
  local published="$1" internal="$2"

  if [ "$published" = "$internal" ]; then
    return 0
  fi

  if ss -ltn "sport = :${published}" | grep -q LISTEN; then
    return 0
  fi

  nohup socat "TCP-LISTEN:${published},fork,reuseaddr" "TCP:127.0.0.1:${internal}" >/dev/null 2>&1 &
  echo "Aliased port ${published} -> ${internal}."
}

alias_port "${TXG_WEB_PORT:-4200}" 4200
alias_port "${TXG_API_PORT:-7071}" 7071
alias_port "${TXG_SUPABASE_PORT:-54321}" 54321
alias_port "${TXG_STUDIO_PORT:-54323}" 54323
alias_port "${TXG_MAIL_PORT:-54324}" 54324

# Cypress runs Electron, which needs an X server. The container inherits the host's DISPLAY
# (WSLg passthrough) with no socket behind it, and a set-but-dead DISPLAY keeps Cypress from
# falling back to its own Xvfb - Electron aborts with "Missing X server or $DISPLAY". Back
# the advertised display with a headless X server on every start. Guard on the process, not
# the socket file: a container stop SIGKILLs Xvfb, which then leaves a stale socket behind
# that would otherwise suppress the relaunch forever.
XVFB_DISPLAY="${DISPLAY:-:0}"
XVFB_DISPLAY="${XVFB_DISPLAY%%.*}"
XVFB_COMMAND="Xvfb ${XVFB_DISPLAY} -screen 0 1280x800x24"
case "$XVFB_DISPLAY" in
  :[0-9]*)
    if ! pgrep -fx "$XVFB_COMMAND" >/dev/null; then
      rm -f "/tmp/.X11-unix/X${XVFB_DISPLAY#:}" "/tmp/.X${XVFB_DISPLAY#:}-lock"
      # shellcheck disable=SC2086 # word splitting builds the argument list
      nohup $XVFB_COMMAND >/dev/null 2>&1 &
      if timeout 10 bash -c "until [ -S '/tmp/.X11-unix/X${XVFB_DISPLAY#:}' ]; do sleep 0.2; done"; then
        echo "Started Xvfb on ${XVFB_DISPLAY} for Cypress."
      else
        echo "Warning: Xvfb did not come up on ${XVFB_DISPLAY}; Cypress will not run." >&2
      fi
    fi
    ;;
  *)
    # A hostname-bearing DISPLAY (e.g. SSH X forwarding) is not something Xvfb can serve.
    echo "DISPLAY='${DISPLAY:-}' is not a local ':N' display; skipping Xvfb for Cypress." >&2
    ;;
esac

# Point the three gitignored config files at the running stack (fresh keys on every recreate,
# hence every start). Only the derived values are rewritten; other lines a developer added
# are left intact.
#
#   .env                                                   (Cypress)
#   apps/api/local.settings.json                           (Azure Functions host)
#   apps/web/src/environments/environment.development.ts   (Angular dev build)

WEB_PORT="${TXG_WEB_PORT:-4200}"
API_PORT="${TXG_API_PORT:-7071}"
SUPABASE_PORT="${TXG_SUPABASE_PORT:-54321}"

# Exports API_URL, PUBLISHABLE_KEY, SECRET_KEY and friends.
eval "$("$SUPABASE_BIN" status -o env)"

if [ -z "${PUBLISHABLE_KEY:-}" ] || [ -z "${SECRET_KEY:-}" ]; then
  echo "Supabase reported no PUBLISHABLE_KEY/SECRET_KEY. The stack is up but not healthy;" >&2
  echo "try '$SUPABASE_BIN stop' followed by '$SUPABASE_BIN start'." >&2
  exit 1
fi

# Rewrites one key in place, appending it when absent. The value passes through the
# environment, not the awk source, so regex/backslash metacharacters in it cannot corrupt
# the file.
upsert_env() {
  local key="$1" value="$2"

  # mv -f: the container user may not own .env (VS Code can remap the node uid), and a bare
  # mv would stop to prompt about overriding its mode, hanging this non-interactive script.
  KEY="$key" VALUE="$value" awk '
    BEGIN { key = ENVIRON["KEY"]; value = ENVIRON["VALUE"]; written = 0 }
    $0 ~ "^" key "=" { print key "=" value; written = 1; next }
    { print }
    END { if (!written) print key "=" value }
  ' .env > .env.tmp && mv -f .env.tmp .env
}

# Seed from the template on first run; thereafter the file is the developer's.
if [ ! -f .env ]; then
  sed 's/\r$//' .env.example > .env
fi

# Preserve an existing canary password; generate a random one only when unset or still the
# placeholder. The e2e run provisions the account from this value, so keeping a stable one
# avoids a mismatch on later starts against a persistent database.
CANARY_PASSWORD="$(sed -n 's/^APP_CANARY_USER_PASSWORD=//p' .env | tr -d '\r')"
if [ -z "$CANARY_PASSWORD" ] || [ "$CANARY_PASSWORD" = '<canary user password>' ]; then
  CANARY_PASSWORD="Canary$(node -e 'process.stdout.write(require("crypto").randomBytes(9).toString("base64url"))')!1"
fi
upsert_env APP_CANARY_USER_PASSWORD "$CANARY_PASSWORD"
upsert_env CYPRESS_BASE_URL "http://localhost:${WEB_PORT}"
upsert_env SUPABASE_URL "http://127.0.0.1:${SUPABASE_PORT}"
upsert_env SUPABASE_PUBLISHABLE_KEY "$PUBLISHABLE_KEY"
upsert_env SUPABASE_SECRET_KEY "$SECRET_KEY"

if [ ! -f apps/api/local.settings.json ]; then
  cp apps/api/local.settings.json.example apps/api/local.settings.json
fi

APP_URL="http://localhost:${WEB_PORT}" \
SUPABASE_API_URL="http://127.0.0.1:${SUPABASE_PORT}" \
SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY}" \
node -e '
  const fs = require("fs");
  const path = "apps/api/local.settings.json";
  const settings = JSON.parse(fs.readFileSync(path, "utf8"));
  settings.Values.APP_URL = process.env.APP_URL;
  settings.Values.SUPABASE_URL = process.env.SUPABASE_API_URL;
  settings.Values.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  fs.writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
'

# No local settings here - this file is a build input, regenerated whole. Use start:staging
# or start:production to run against another environment.
sed \
  -e "s|__BUILD_NAME__||g" \
  -e "s|__BUILD_SHA__||g" \
  -e "s|__BUILD_TAG__||g" \
  -e "s|__API_URL__|http://localhost:${API_PORT}|g" \
  -e "s|__SUPABASE_URL__|http://localhost:${SUPABASE_PORT}|g" \
  -e "s|__SUPABASE_PUBLISHABLE_KEY__|${PUBLISHABLE_KEY}|g" \
  apps/web/src/environments/environment.ts > apps/web/src/environments/environment.development.ts

echo ""
echo "Wrote .env, apps/api/local.settings.json and apps/web/src/environments/environment.development.ts."

# Seed a known local dev account (dev@10xgains.com) with sample data. Idempotent and local
# only - it uses the local service-role key that only exists here. Runs after the config
# block above, since it reads the .env just generated.
pnpm seed

# Setup complete. Surface the seeded dev login so it is not buried in .env.
DEV_EMAIL="$(sed -n 's/^APP_DEV_USER_EMAIL=//p' .env | tr -d '\r')"
DEV_PASSWORD="$(sed -n 's/^APP_DEV_USER_PASSWORD=//p' .env | tr -d '\r')"
echo ""
echo "Dev container ready. Run 'pnpm dev', then open http://localhost:${WEB_PORT}"
echo "Sign in with the seeded dev account: ${DEV_EMAIL} / ${DEV_PASSWORD}"
