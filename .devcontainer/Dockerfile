# Pinned to the exact version in .nvmrc; keep the two in sync.
FROM node:24.18.0-bookworm

# socat backs the port aliases in post-start.sh, iproute2 provides `ss` for their
# liveness check, and the libraries below are Cypress's runtime dependencies on Debian.
#
# Xvfb is a framebuffer with no screen attached, which is all `cypress run` needs. To also
# watch `cypress open`, fluxbox gives its window a manager to be placed and resized by, and
# x11vnc plus noVNC export that framebuffer over the browser - see post-start.sh.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        iproute2 \
        postgresql-client \
        procps \
        socat \
        libasound2 \
        libgbm1 \
        libgtk-3-0 \
        libnotify4 \
        libnss3 \
        libxss1 \
        libxtst6 \
        xauth \
        xvfb \
        fluxbox \
        novnc \
        websockify \
        x11vnc \
    && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
