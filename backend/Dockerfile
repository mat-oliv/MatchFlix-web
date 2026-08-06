# syntax=docker/dockerfile:1

# Debian slim (e não Alpine) porque os engines do Prisma 5 usam glibc + OpenSSL 3.
FROM node:20-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- dependências (todas, inclusive dev) ----------
FROM base AS deps
COPY package.json package-lock.json ./
# --ignore-scripts porque o postinstall (`prisma generate`, que a Vercel precisa) roda
# antes de `prisma/` ser copiado e falharia aqui. Os estágios abaixo geram o client.
RUN npm ci --ignore-scripts

# ---------- dev: tsx watch, código vem por bind mount ----------
FROM deps AS dev
ENV NODE_ENV=development
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
EXPOSE 3333
CMD ["npm", "run", "dev"]

# ---------- build: prisma client + tsc -> dist/ ----------
FROM deps AS build
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
# Evita o "version check" do Prisma na subida (falha ruidosa se não houver rede).
ENV CHECKPOINT_DISABLE=1
# node_modules vem inteiro do build: o CLI do Prisma (devDependency) é necessário
# no entrypoint para sincronizar o schema com o banco.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3333
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
