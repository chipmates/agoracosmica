# Multi-stage build for Agora Cosmica self-host.
# Build stage installs deps + builds the React app with VITE_SELF_HOST=true,
# fetching content assets from the public CDN as part of `pnpm build`.
# Runtime stage is unprivileged nginx serving the static output on 8080.

# --- Build stage -----------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack (version is pinned by package.json packageManager)
RUN corepack enable

# Layer cache: install deps before copying the rest of the source.
# check-pkgmgr.js is the preinstall hook (refuses npm in favor of pnpm),
# so it has to land before `pnpm install` runs.
COPY package.json pnpm-lock.yaml check-pkgmgr.js ./
RUN pnpm install --frozen-lockfile

# Source last so edits do not bust the install layer
COPY . .

# Build in self-host mode. `build:self-host` runs setup-assets (fetches
# JSON metadata from media.agoracosmica.org) and extract-public-data, then
# vite build. extract-public-data sees VITE_SELF_HOST=true and emits the
# figuresCatalog, theme cross-refs, and per-figure seed summaries with the
# authored text stripped (no bios, no learn lines, no quotes, no essences).
# The SEO prerender + sitemap steps are deliberately skipped: a personal
# self-host instance does not need 90 prerendered HTML pages, and those
# pages would have baked figure bios into the image.
ENV VITE_SELF_HOST=true
RUN pnpm run build:self-host

# --- Runtime stage ---------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine

LABEL org.opencontainers.image.title="Agora Cosmica" \
      org.opencontainers.image.description="Self-hosted Agora Cosmica web app (AGPL-3.0)" \
      org.opencontainers.image.source="https://github.com/chipmates/agoracosmica" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.vendor="ChipMates gemeinnützige GmbH"

# Copy nginx config (replaces the default site)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static site
COPY --from=builder /app/build /usr/share/nginx/html

# Entrypoint generates /usr/share/nginx/html/config.js from container env at
# startup so one image works for every operator without a rebuild. Scripts
# placed in /docker-entrypoint.d/ run before nginx execs (per the base image).
COPY docker-entrypoint.sh /docker-entrypoint.d/00-agora-config.sh

# nginx-unprivileged ships with USER 101 (nginx). The /docker-entrypoint.d/
# scripts run as the container's runtime user (not root), so the entrypoint
# needs write access to the static-root directory to rewrite config.js.
USER root
# Pull latest Alpine security patches on top of the upstream base
# (openssl libcrypto3/libssl3, libpng, libexpat, musl, nghttp2, zlib).
RUN apk upgrade --no-cache && \
    chmod +x /docker-entrypoint.d/00-agora-config.sh && \
    chown 101:101 /usr/share/nginx/html /usr/share/nginx/html/config.js
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz || exit 1
