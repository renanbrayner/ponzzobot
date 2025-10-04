# =============================================================================
# Discord VAD Bot - Dockerfile (Debian slim) - Produção
# =============================================================================
# Multi-stage build: builder (com toolchain) + runtime minimal
# =============================================================================

# --------------------
# STAGE 1: BUILDER
# --------------------
FROM node:20-bookworm-slim AS builder

ENV NODE_ENV=development
WORKDIR /app

# Deps de build para nativos (se necessário)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates python3 make g++ git \
  && rm -rf /var/lib/apt/lists/*

# Cache de deps
COPY package*.json ./
RUN npm ci

# Copia código
COPY . .

# Build TS -> JS
RUN npm run build

# Remove devDependencies para preparar runtime
RUN npm prune --omit=dev

# --------------------
# STAGE 2: RUNTIME
# --------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Libs necessárias em runtime
# - ffmpeg e libopus para @discordjs/voice/prism-media
# - dumb-init como init leve
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates ffmpeg libopus0 dumb-init \
  && rm -rf /var/lib/apt/lists/*

# Usuário não-root
RUN useradd -u 10001 -m -r -s /usr/sbin/nologin app

# Copia artefatos do builder
COPY --from=builder --chown=app:app /app/package*.json ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/assets ./assets

USER app

# Healthcheck básico (opcional)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Entrypoint com dumb-init para sinais corretos
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["npm", "run", "start"]
