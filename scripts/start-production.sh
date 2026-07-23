#!/bin/sh
set -eu

: "${DATABASE_URL:=postgresql://postgres:postgres@postgres:5432/mes_engates?schema=public}"
export DATABASE_URL

npx prisma migrate deploy

if [ "${SEED_DATABASE:-true}" = "true" ]; then
  npm run db:seed
fi

exec npm run start
