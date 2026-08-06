import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { construirApp } from '../src/app.js';

/**
 * Ponte entre a Vercel e o Fastify.
 *
 * Na Vercel não existe processo escutando porta: cada requisição chega a esta função.
 * O Fastify é montado uma única vez por instância — invocações seguintes que caem na
 * mesma instância quente reaproveitam o app e a conexão do Prisma, em vez de reabrir
 * tudo a cada chamada.
 */
const appPronto = construirApp().then(async (app) => {
  // Sem `ready()` o Fastify ainda não terminou de registrar rotas e plugins, e o
  // `emit('request')` abaixo cairia no vazio.
  await app.ready();
  return app;
});

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPronto;

  // O rewrite do vercel.json manda tudo para cá preservando o caminho original
  // (`/auth/login` continua `/auth/login`). Este ajuste é defensivo: se a API algum dia
  // for servida sob `/api`, o prefixo é removido aqui em vez de virar 404 no Fastify.
  if (req.url === '/api') req.url = '/';
  else if (req.url?.startsWith('/api/')) req.url = req.url.slice(4);

  app.server.emit('request', req, res);
}
