# syntax=docker/dockerfile:1

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- dev: vite dev server, código vem por bind mount ----------
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- build ----------
FROM deps AS build
# Vite injeta as VITE_* em tempo de build, não de execução: como o bundle roda no
# navegador do host, a URL precisa ser a que o host enxerga (localhost), não "backend".
ARG VITE_API_URL=http://localhost:3333
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN npm run build

# ---------- runtime: nginx servindo os estáticos ----------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
