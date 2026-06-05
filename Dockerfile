FROM node:22-alpine AS frontend-builder
RUN npm install -g pnpm
WORKDIR /build/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

FROM node:22-alpine AS backend-builder
RUN npm install -g pnpm
WORKDIR /build/backend
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/ ./
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy pnpm exec prisma generate
RUN pnpm run build

FROM node:22-alpine
RUN apk add --no-cache tini
WORKDIR /app

COPY --from=backend-builder /build/backend/dist ./dist
COPY --from=backend-builder /build/backend/node_modules ./node_modules
COPY --from=backend-builder /build/backend/package.json ./
COPY --from=backend-builder /build/backend/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=frontend-builder /build/frontend/out ./public

RUN mkdir -p /app/logs /backups

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
