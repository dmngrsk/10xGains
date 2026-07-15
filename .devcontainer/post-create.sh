#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# The named volumes mount root-owned; chown them to the dev user. Recursive, because a volume
# persisted across rebuilds may hold root-owned files from a prior run. node_modules and the
# pnpm store are not volumes, so pnpm creates them as `node` and they need no chown.
sudo chown -R node:node /home/node/.claude /home/node/.cache

corepack enable
pnpm install --frozen-lockfile
