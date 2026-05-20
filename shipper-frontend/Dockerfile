# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────
# Stage 1: build Vite bundle
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY shipper-frontend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY shipper-frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 2: serve static with nginx
# ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Reverse-proxy + SPA fallback config
COPY shipper-frontend/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
