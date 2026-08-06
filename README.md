# MovieMatch

App tipo "Tinder para filmes em grupo": crie um grupo, convide seus amigos, cada um dá
like/dislike nos filmes, e quando todo mundo do grupo curte o mesmo filme, é match.

## Estrutura

```
movie-match/
├── backend/                  Node.js + TypeScript + Fastify + Prisma
├── frontend/                 React + TypeScript + Vite + Tailwind
├── docker-compose.yml        stack de produção (nginx servindo o build)
└── docker-compose.dev.yml    stack de desenvolvimento (hot reload)
```

## Decisões de arquitetura

- **Swipe é global por usuário**, não por grupo. Você curte um filme uma vez só;
  o match é calculado comparando os likes de cada membro dentro de cada grupo que
  ele participa. Isso evita ter que re-swipar os mesmos filmes em grupos diferentes.
- **Match exige pelo menos 2 membros** no grupo. Num grupo de uma pessoa só, todo like
  viraria match sozinho, o que não significa nada.
- **Match é registro histórico e fica congelado**: uma vez criado, nunca é revogado.
  Se alguém entra no grupo depois, os matches anteriores continuam valendo mesmo sem
  essa pessoa ter curtido o filme. É intencional — o match registra um acordo que
  aconteceu naquele momento, não um estado que precisa continuar verdadeiro.
- **Fonte dos filmes**: TMDB API (https://www.themoviedb.org/documentation/api).
  Crie uma conta gratuita e gere uma API key em Settings → API.
- **Autenticação por token**: cadastro/login com usuário e senha. As senhas usam `scrypt`
  do próprio Node e os tokens são assinados com HMAC — sem dependência externa, o que
  mantém a imagem Docker simples. Todas as rotas da API exigem `Authorization: Bearer`,
  e o `userId` vem sempre do token, nunca do corpo da requisição.
- Contas de demonstração criadas pelo seed: `demo`/`demo1234` e `amigo`/`amigo1234`.

## Como rodar com Docker (recomendado)

Sobe Postgres + backend + frontend de uma vez. Só precisa do Docker Desktop.

```bash
cp .env.example .env        # preencha TMDB_API_KEY (é o único obrigatório)
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend:  http://localhost:3333 (health em `/health`)
- Postgres: `localhost:5432`

O schema do banco é aplicado sozinho na subida do backend (via `prisma db push`,
já que ainda não existe `prisma/migrations` versionado).

### Modo desenvolvimento (hot reload)

`tsx watch` no backend e Vite dev server no frontend, ambos com o código montado
do host — editar um arquivo recarrega na hora.

```bash
docker compose -f docker-compose.dev.yml up --build
```

Frontend passa a responder em http://localhost:5173. Rode **um ou outro**, nunca
os dois ao mesmo tempo (disputam os mesmos nomes de container e portas).

Se mexer no `package.json`, recrie os volumes anônimos de `node_modules`:

```bash
docker compose -f docker-compose.dev.yml up --build -V
```

### Comandos úteis

```bash
docker compose logs -f backend           # acompanhar logs
docker compose exec backend npx prisma studio   # inspecionar o banco
docker compose down                      # parar tudo
docker compose down -v                   # parar e APAGAR o volume do Postgres
```

> A `VITE_API_URL` é injetada em tempo de **build** do frontend, não de execução —
> por isso ela aponta para `http://localhost:3333` (o que o navegador enxerga) e
> não para `http://backend:3333`. Se mudar `BACKEND_PORT`, rebuilde o frontend.

## Como rodar sem Docker

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # preencha DATABASE_URL e TMDB_API_KEY
npx prisma migrate dev --name init
npm run dev                 # sobe em http://localhost:3333
```

Precisa de um Postgres rodando. Mais rápido pra testar local: `docker run --name moviematch-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`
e ajuste a `DATABASE_URL` de acordo.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # aponta pro backend local por padrão
npm run dev                 # sobe em http://localhost:5173
```

## Próximos passos sugeridos (fora do MVP)

- Autenticação (Lucia, Better Auth ou Clerk)
- Notificação em tempo real de match (WebSocket) em vez de só no momento do swipe
- Filtros no feed (gênero, ano, streaming disponível)
- Tela de "onde assistir" usando o endpoint `/movie/{id}/watch/providers` da TMDB
- Deploy: frontend na Vercel, backend + Postgres no Railway/Render
