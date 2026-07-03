# =============================================================================
# Comitê de Dados — Dockerfile
# Build multi-stage: instala dependências, compila o frontend e gera imagem
# de produção enxuta baseada em Node.js 22 Alpine.
# =============================================================================

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Instala pnpm globalmente
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copia arquivos de dependências primeiro (cache de camadas)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copia o restante do código
COPY . .

# Compila o frontend (Vite) e o backend (TypeScript)
RUN pnpm run build


# ─── Stage 2: production ─────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Cria usuário não-root para segurança
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copia apenas o necessário para produção
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Cria diretório de uploads para armazenamento local
RUN mkdir -p /var/comite-dados/uploads && chown -R appuser:appgroup /var/comite-dados

USER appuser

# Porta padrão (sobrescrita por PORT no .env ou docker-compose)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

CMD ["node", "dist/server/_core/index.js"]
