import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { groupRoutes } from './routes/groups.js';
import { movieRoutes } from './routes/movies.js';
import { profileRoutes } from './routes/profile.js';
import { swipeRoutes } from './routes/swipes.js';

// Entrada da Vercel. Lá a API não é um processo escutando porta: o runtime carrega este
// arquivo e chama o `export default` a cada requisição. Quem sobe servidor de verdade é
// `src/bin/servidor.ts`, usado no desenvolvimento local e no container.
//
// Duas exigências da Vercel moldam este arquivo, e as duas já quebraram deploy:
//
// 1. Ela varre a RAIZ do `dist` atrás de `index.js`/`app.js`/`server.js` e exige do
//    escolhido um `export default` que seja função ou servidor. Nada mais pode compilar
//    para a raiz do `dist` com esses nomes, sob risco de ser escolhido no lugar deste.
// 2. Ela só aceita como entrypoint o arquivo que importa `fastify` DIRETAMENTE. Delegar
//    a montagem para outro módulo e só reexportar aqui falha o build com
//    "No entrypoint found which imports fastify". É por isso que `construirApp` mora
//    neste arquivo, e não num módulo separado em `lib/`.

/**
 * Origens liberadas no CORS, separadas por vírgula em `CORS_ORIGIN`.
 * Em produção o site e a API ficam em domínios diferentes (dois projetos na Vercel),
 * então a origem do site precisa estar listada. Sem a variável, reflete qualquer
 * origem — que é o que o desenvolvimento local precisa.
 */
function origensPermitidas(): string[] | true {
  const lista = process.env.CORS_ORIGIN?.split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);

  return lista && lista.length > 0 ? lista : true;
}

/**
 * Monta a aplicação sem escutar porta. Rota nova entra aqui, nunca direto no handler
 * nem no `bin/servidor.ts` — os dois reaproveitam esta mesma montagem.
 */
export async function construirApp() {
  if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET não configurada — necessária para assinar os tokens.');
  }

  const app = Fastify({ logger: true });

  // Preenchido pelo preHandler exigirAutenticacao nas rotas protegidas.
  app.decorateRequest('userId', '');

  await app.register(cors, { origin: origensPermitidas() });

  await app.register(authRoutes);
  await app.register(groupRoutes);
  await app.register(profileRoutes);
  await app.register(movieRoutes);
  await app.register(swipeRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}

let montagem: ReturnType<typeof construirApp> | undefined;

/**
 * Monta a app uma vez por instância e reaproveita entre requisições — remontar a cada
 * chamada abriria um pool do Prisma por requisição.
 *
 * A promessa nasce aqui dentro, e não no escopo do módulo, para que uma falha de
 * montagem (uma variável de ambiente faltando, por exemplo) seja sempre aguardada por
 * alguém: uma promessa rejeitada parada no módulo viraria `unhandledRejection` e
 * mataria o processo antes de qualquer requisição chegar, escondendo o motivo real.
 * Em caso de falha o cache é limpo, para que a requisição seguinte tente de novo.
 */
function obterApp() {
  montagem ??= construirApp().then(async (app) => {
    // Sem `ready()` o Fastify ainda não registrou o listener de 'request' no servidor
    // HTTP interno, e o emit abaixo cairia no vazio.
    await app.ready();
    return app;
  });

  return montagem.catch((erro) => {
    montagem = undefined;
    throw erro;
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await obterApp();

  // Entrega o par req/res ao servidor HTTP interno do Fastify. É o que `listen` faria,
  // sem precisar de porta: o roteamento e os hooks correm normalmente a partir daqui.
  app.server.emit('request', req, res);
}
