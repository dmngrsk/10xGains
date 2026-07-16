---
name: windows-dev-container
description: Recover a broken Windows dev-container setup for this repo - Supabase or Studio failing to mount paths inside the workspace, Docker's daemon unreachable from WSL, post-start.sh hanging at "Waiting for the container's Docker daemon...", or git reporting the whole repo as modified after moving a checkout. The README's dev-container section covers first-time setup; reach for this when that path breaks, or when an existing C:\ checkout has to move onto the WSL2 filesystem.
---

# Recovering the Windows dev container

The README covers first-time setup. This skill is for when it breaks on Windows, or when an
existing `C:\` checkout has to move to WSL2. Everything here rests on one fact: **the working
copy must live on the WSL2 (ext4) filesystem, never under `C:\`.** The dev container runs its
own Docker daemon, and Supabase's containers bind-mount paths *back into* the workspace
(`supabase/snippets` for Studio, among others), so the workspace's filesystem is load-bearing
in a way an ordinary Node project's is not.

## Why C:\ does not work

A workspace under `C:\` reaches the container through the Windows/WSL 9p file-sharing layer
(`/mnt/c`), regardless of the Docker backend. A nested Docker daemon writing there gets
incoherent results: creating
`supabase/snippets` fails with `EEXIST` while `ls` and Windows both report the path does not
exist. `mkdir -p` fails too, which it cannot normally do. The path is a zombie — `create`
says it exists, `lookup` says it does not — and it survives recreating the container, because
the corruption is in the sharing layer, not the container.

Studio never starts, and no amount of config fixes it. Do not spend time on it. Move the repo
onto ext4 (below), where the daemon's `mkdir` is an ordinary `mkdir`. The move is also a large
speed win: `/mnt/c` is 9p, and pnpm installs and Angular rebuilds across it are several times
slower than on native ext4.

## Docker's daemon is unreachable from WSL

`docker ps` inside the distro failing with `dial unix /var/run/docker.sock: connect: no such
file or directory` means Docker Desktop's WSL integration is off for that distro. This whole
section is Docker Desktop-specific; a Docker Engine installed inside the distro is reachable
on its own and never hits this.

Normally you fix it in the UI: **Docker Desktop → Settings → Resources → WSL Integration →**
enable the distro → **Apply & Restart**. If that pane is missing, patch the settings file
instead — but **stop Docker Desktop first**, because it holds settings in memory and rewrites
the file on exit, silently discarding a patch applied underneath it.

```bash
docker desktop stop
# In %APPDATA%\Docker\settings-store.json (back it up first) set:
#   "EnableIntegrationWithDefaultWslDistro": true
#   "IntegratedWslDistros": ["<Distro>"]
docker desktop start
```

**Do not touch WSL while Docker Desktop is starting.** It provisions the distro during
startup — installing the socket and adding your user to the `docker` group. Running
`wsl --terminate` or `wsl --shutdown` in that window races the provisioning and fails it with
`Wsl/Service/0x8007274c` (a timeout), leaving integration half-installed. If that has already
happened, recover with a clean cycle and then leave WSL alone:

```bash
docker desktop stop
wsl --shutdown                              # stops ALL distros
wsl -d Ubuntu -e whoami                     # confirm the distro answers
docker desktop start                        # then wait, hands off
```

Verify all three, not just the socket — the socket without group membership still leaves
`docker` unusable:

```bash
wsl -d Ubuntu -- bash -c 'ls -l /var/run/docker.sock; groups; docker ps'
# want: srw-rw---- root docker  |  groups includes docker  |  docker ps succeeds
```

## post-start.sh hangs at "Waiting for the container's Docker daemon..."

This is a different failure from the previous section: the *host* side is fine (`docker ps`
works from WSL, the devcontainer itself is up and `docker ps` on the host shows it running).
The hang is inside the container, in `docker-in-docker`'s own nested `dockerd`, which
`post-start.sh` polls with `docker info` before doing anything else.

Confirm this is what's happening by checking the nested daemon's process tree from the host:

```bash
CID=$(docker ps -q -f name=<container-name-or-id>)
docker exec "$CID" sh -c 'ps aux | grep -i docker'
```

If `dockerd` and `containerd` are both running but there's also an `iptables` process sitting
in `D` state (uninterruptible sleep) touching `DOCKER-ISOLATION` — and a `docker info` process
that never exits — the nested daemon is stuck setting up its forwarding rules. `docker info`
will then hang forever (or until `post-start.sh`'s 90s timeout), even though nothing about
Docker's reachability from WSL is actually broken.

The cause is `networkingMode=mirrored` in the Windows-side `.wslconfig`
(`C:\Users\<you>\.wslconfig`) — Docker Desktop's WSL2 backend and mirrored networking don't
get along, and this nested-iptables hang is the concrete symptom. Fix it by removing the line
(NAT, the default when it's absent, doesn't have this problem) and cycling WSL:

```ini
[wsl2]
# networkingMode=mirrored
```

```
docker desktop stop      # from Windows; quitting the tray icon also works
wsl --shutdown           # kills ALL distros, including the running dev container - expected
docker desktop start     # let it fully come up and reprovision WSL integration
```

Do the shutdown/restart from a Windows shell, not from inside the distro whose container you're
diagnosing — `wsl --shutdown` kills that session too.

## Moving an existing checkout onto WSL2

A fresh clone should go straight into the distro's home (`git clone ... ~/10xGains`), as the
README says. To relocate an *existing* `C:\` checkout, copy rather than move so the original
survives as a fallback, and exclude the platform-specific build output:

```bash
wsl -d Ubuntu -- rsync -a \
  --exclude node_modules --exclude .angular --exclude dist --exclude coverage \
  /mnt/c/path/to/repo/ ~/10xGains/
```

`.git` and untracked files come along, so uncommitted work and local config survive. From
here the WSL copy is authoritative; editing the `C:\` copy out of habit and wondering why
nothing changes is the easiest hour to waste.

### If git then reports the entire repo as modified

A Windows checkout with `core.autocrlf=true` has a CRLF working tree, and the copy carries
those CRLFs into WSL, where git compares them against LF blobs and calls every file modified.
The repo's `.gitattributes` (`* text=auto eol=lf`) prevents this for a fresh clone; a copied
tree needs one migration:

```bash
git add --renormalize .
git status                                  # only genuine changes should remain
```

Do this once, by hand. It rewrites the index, so it must never be automated in a container
lifecycle hook, where it would stage whatever a developer had in flight.

## Gotchas

- **Never mount the host's Docker socket into the container** as a shortcut for the inner
  daemon. It is equivalent to root on the host and removes the isolation the container exists
  to provide.
- **`networkingMode=mirrored` in `.wslconfig`** is a known irritant for Docker Desktop's WSL
  integration. Suspect it first if the daemon is reachable but container networking misbehaves
  — see the nested-`dockerd`/iptables hang above for the concrete case we've hit.
- **WSL inherits the Windows PATH**, so when driving the distro from a Windows shell, `node`,
  `corepack`, and `npm` may resolve to Windows binaries (`/mnt/c/Program Files/nodejs/...`),
  which fail with `cannot execute: required file not found`. Strip PATH first:
  `export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"`.
