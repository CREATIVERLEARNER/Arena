# ── Bookroom ────────────────────────────────────────────────────────────────
# Static build served by nginx. All app data lives in the visitor's browser
# (IndexedDB), so the container is stateless — no volumes needed.

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
