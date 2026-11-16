# Image unique : API + bot + dashboard buildé.
# Build depuis la racine du dépôt : docker build -f docker/Dockerfile -t discord-ai-bot .

FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# 1) Dépendances (couche mise en cache tant que les manifestes ne changent pas)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# 2) Build du dashboard puis du serveur
COPY . .
RUN pnpm build

# 3) Dépendances de production du serveur uniquement
RUN pnpm --filter @bot/server deploy --prod --legacy /out


FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    WEB_DIST_DIR=/app/web
WORKDIR /app

COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist ./dist
COPY --from=build /repo/apps/web/dist ./web

# Exécution sans privilèges ; /data contient la base SQLite (à monter en volume).
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
