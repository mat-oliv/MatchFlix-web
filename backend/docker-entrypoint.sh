#!/bin/sh
set -e

# O projeto ainda não versiona prisma/migrations. Enquanto não versionar, o schema
# é sincronizado direto; assim que existirem migrations, elas passam a ser aplicadas.
sync_schema() {
  if [ -d prisma/migrations ]; then
    npx prisma migrate deploy
  else
    npx prisma db push --skip-generate
  fi
}

# O healthcheck do compose já segura a subida, mas a retentativa deixa o container
# resiliente a um restart do Postgres.
attempt=1
max=30
until sync_schema; do
  if [ "$attempt" -ge "$max" ]; then
    echo "✗ não consegui sincronizar o schema depois de $max tentativas" >&2
    exit 1
  fi
  echo "→ banco indisponível, tentando de novo ($attempt/$max)..."
  attempt=$((attempt + 1))
  sleep 2
done

# Cria o 'demo-user' que o frontend usa enquanto não há autenticação. Sem ele,
# POST /swipes quebra com violação de FK num banco recém-criado.
npx prisma db seed

exec "$@"
