# ── Frontend build stage ──────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/nginx/upstream.conf /etc/nginx/conf.d/upstream.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
