#!/bin/sh
set -eu

: "${DATABASE_URL:=file:/data/mes-engates.db}"
export DATABASE_URL

# A imagem de produção usa SQLite em um volume persistente. O caminho abaixo
# também permite identificar se o volume acabou de ser criado para carregar os
# dados de demonstração uma única vez.
database_path="${DATABASE_URL#file:}"
is_new_database=false

if [ ! -f "$database_path" ]; then
  is_new_database=true
  mkdir -p "$(dirname "$database_path")"
fi

npx prisma migrate deploy

if [ "$is_new_database" = "true" ] && [ "${SEED_DATABASE:-true}" = "true" ]; then
  npm run db:seed
fi

exec npm run start
