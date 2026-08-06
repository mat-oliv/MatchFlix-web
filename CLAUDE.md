# MovieMatch

"Tinder para filmes em grupo". Backend Fastify + Prisma + Postgres, frontend React + Vite + Tailwind.
Código, comentários e documentação em **português** — só as mensagens de commit são em
**inglês** (ver [Git](#git)).

## Como rodar — são DOIS servidores

Precisam estar de pé ao mesmo tempo, em terminais separados:

```bash
cd backend  && npm run dev    # API em :3333 — só JSON, não tem interface
cd frontend && npm run dev    # site em :5173 — é ESTA a URL pra abrir no navegador
```

Alternativa em container: `docker compose up` (site em :8080, prod) ou
`docker compose -f docker-compose.dev.yml up` (:5173, hot reload).

## Ambiente desta máquina (macOS)

- **Docker CLI não está no PATH padrão.** Já corrigido no `~/.zshrc` com
  `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"`.
- **Postgres local é Homebrew** (`postgresql@16`), não Docker. O usuário do banco é o
  próprio usuário do macOS, sem senha — é o que está no `DATABASE_URL` do `backend/.env`.
- Postgres local e o container do Docker disputam a **porta 5432**. Não rode os dois juntos.
- **O shell é zsh, não bash.** Duas pegadinhas que já custaram chamadas desperdiçadas:
  `$VAR` sem aspas *não* faz word splitting (`for x in $LISTA` trata tudo como um item —
  use `while read -r`), e `GID` é variável reservada (atribuir dá
  `failed to change group ID`). Para Python inline, escreva um `.py` com heredoc em vez
  de `python3 -c` com aspas aninhadas, que quebram no escaping.

## Armadilhas que já custaram tempo

- **`npm run dev` "não faz nada"** — quase sempre é processo velho preso na porta.
  Checar `lsof -i :3333 -P -n` (ou `:5173`) e matar antes de subir de novo.
- **Nunca deixe servidor rodando em background depois de testar.** Se subir o backend
  para validar algo, mate com `pkill -f "tsx watch src/index.ts"` ANTES de encerrar a
  resposta — senão a próxima tentativa do usuário morre com `EADDRINUSE`. Já quebrou o
  fluxo dele duas vezes. Prefira testar e derrubar no mesmo comando.
- **`AUTH_SECRET` é obrigatória** no `backend/.env` — o servidor recusa subir sem ela.
  Gerar com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
  Trocar o segredo invalida todas as sessões existentes.
- **Contas de demonstração** criadas por `npm run seed`: `demo`/`demo1234` e
  `amigo`/`amigo1234` (no Docker o entrypoint roda sozinho).
- **`VITE_API_URL` é lida em build time**, não em runtime. Mudar a porta do backend
  exige rebuildar o frontend.
- **Chamada de API sem `try/catch` no handler congela a UI em silêncio.** O React
  engole a rejeição e nenhuma linha depois do `await` nunca executa — sem erro no
  console. Já quebrou o botão Curtir uma vez. Todo handler que faz `await` numa chamada
  de API precisa de `try/catch` que mostre a mensagem.
- **Adicionar coluna obrigatória em tabela com dados exige `db push` em duas etapas:**
  campo opcional → push → backfill (via `prisma/seed.ts`) → campo obrigatório → push.
  Um push direto com campo obrigatório falha, e `--accept-data-loss` apagaria linhas.

## Autenticação

- Token HMAC assinado com `node:crypto` (sem JWT de biblioteca), validade de 7 dias.
  Senhas com `scrypt` do Node — nada de bcrypt, pra não ter dependência nativa no Docker.
- **Rotas protegidas nunca leem `userId` do corpo da requisição.** O `preHandler`
  `exigirAutenticacao` popula `request.userId` a partir do token. Se for adicionar rota
  nova que age em nome do usuário, use `request.userId`, não confie no cliente.
- **Erro de login é genérico de propósito** (`"Usuário ou senha inválidos"`) para não
  revelar quem tem conta. Cadastro é específico porque a pessoa precisa saber o que corrigir.
- A sessão vive no `localStorage` do navegador. Um 401 em qualquer chamada derruba a
  sessão e recarrega a página.

## Decisões de arquitetura

- **O frontend não tem router.** A navegação é estado local em `App.tsx`
  (`tab === 'swipe' | 'groups'`), e `App` decide entre `<Auth />` e o app logado. Não há
  URLs por tela — adicionar "uma página nova" significa mais uma aba nesse estado, a
  menos que se instale um router de propósito.
- **Pop-up é sobreposição, não tela.** Sem router, todo diálogo (`Aviso`, `MenuUsuario`,
  `DetalhesFilme`, o "Deu match!" dentro de `SwipeScreen`) é um `fixed inset-0 z-50`
  renderizado por cima, com o estado de aberto/fechado em quem chama. Convenção:
  fecha no clique no fundo, no ✕ e no `Escape`, e o conteúdo interno faz
  `stopPropagation`. É assim que se acrescenta informação sem criar aba nova.
- Swipe é **global por usuário**, não por grupo. O match é calculado comparando os
  likes dos membros dentro de cada grupo (ver `backend/src/routes/swipes.ts`).
- **O feed já traz o filme inteiro** (`overview`, `releaseDate`, `voteAverage`), então a
  aba Filmes não precisa de requisição extra pra detalhar um card. Já matches e curtidos
  são `FilmeResumo` — só `movieId`, título e pôster, resolvidos por `enriquecerFilmes`
  no backend. Mostrar sinopse nessas listas exige ampliar essa função, não é só frontend.
- **Curtidos vêm de 20 em 20** por `GET /me/liked?cursor=`; `/me/profile` devolve só
  `likedCount`, sem a lista. `enriquecerFilmes` faz uma busca na TMDB por filme, então
  mandar tudo de uma vez travava a abertura do menu de quem curtiu muito. O cursor é o
  `id` do último swipe da página, com `orderBy: [createdAt desc, id desc]` — **o `id` é
  desempate obrigatório**: likes gravados no mesmo instante não têm ordem total e o
  cursor passa a pular ou repetir filmes. A grade busca a página seguinte sozinha via
  `IntersectionObserver` (ver `MenuUsuario.tsx`).
- **Match exige 2+ membros.** Grupo de uma pessoa não gera match (`every` seria
  trivialmente verdadeiro).
- **Match é registro histórico e fica congelado** — uma vez criado nunca é revogado.
  Entrar num grupo não invalida matches anteriores, e sair também não. Não implemente
  revalidação de matches quando a composição do grupo muda; é intencional.

## Git

- **Mensagem de commit em inglês**, sempre — título e corpo. É a única parte do projeto
  que não é em português. Padrão conventional: `feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`.
- **Uma branch por mudança**, criada a partir do `master` atualizado (`origin/master`),
  com o mesmo prefixo do commit: `feat/`, `fix/`, `docs/`, `chore/`. Nada direto no
  `master`.
- Trocar de branch troca o código no disco e o app em execução passa a ser outro. Se o
  usuário estiver testando algo, volte pra branch dele ao terminar — ou use
  `git worktree` pra mexer noutra branch sem mover a cópia de trabalho.
