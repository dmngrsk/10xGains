#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# The named volumes mount root-owned; chown them to the dev user. Recursive, because a volume
# persisted across rebuilds may hold root-owned files from a prior run. node_modules and the
# pnpm store are not volumes, so pnpm creates them as `node` and they need no chown.
sudo chown -R node:node /home/node/.claude /home/node/.cache

# The claude-code feature installs a root-owned npm copy under /usr/local, which the in-app
# updater cannot write: it freezes at image-build time and shadows any newer build on PATH.
# Use it to bootstrap the user-owned native build, then drop it, leaving ~/.local/bin/claude
# (already on PATH) as the only copy - current at rebuild, self-updating in between.
# Verify the native build landed before removing the fallback.
claude install latest
if [ -x "$HOME/.local/bin/claude" ]; then
  sudo npm -g uninstall @anthropic-ai/claude-code >/dev/null 2>&1 || true
fi

corepack enable
pnpm install --frozen-lockfile
