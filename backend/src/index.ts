import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { construirApp } from './lib/app.js';

// Entrada da Vercel — e só dela. Lá a API não é um processo escutando porta: o runtime
// Node carrega este arquivo, exige um `export default` que seja função ou servidor, e
// chama esse handler a cada requisição. Quem sobe servidor de verdade é
// `src/bin/servidor.ts`, usado no desenvolvimento local e no container.
//
// Este é o único arquivo na raiz do `dist` compilado, porque é lá que a Vercel procura o
// entrypoint. Nada mais deve ser compilado para o topo do `dist` com nome `index`,
// `app` ou `server`, sob risco de ser escolhido no lugar deste.

let montagem: Promise<FastifyInstance> | undefined;

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
function obterApp(): Promise<FastifyInstance> {
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
