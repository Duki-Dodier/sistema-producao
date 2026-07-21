FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

COPY . .
RUN DATABASE_URL=file:/tmp/mes-engates-build.db npx prisma migrate deploy \
  && npx prisma generate \
  && DATABASE_URL=file:/tmp/mes-engates-build.db npm run build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/data/mes-engates.db
ENV SEED_DATABASE=true

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY scripts/start-production.sh ./scripts/start-production.sh

RUN mkdir -p /data /app/public/uploads \
  && chown -R node:node /app /data \
  && chmod +x /app/scripts/start-production.sh

USER node

EXPOSE 3000

CMD ["/app/scripts/start-production.sh"]
