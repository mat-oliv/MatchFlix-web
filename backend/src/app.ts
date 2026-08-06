import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { groupRoutes } from './routes/groups.js';
import { movieRoutes } from './routes/movies.js';
import { profileRoutes } from './routes/profile.js';
import { swipeRoutes } from './routes/swipes.js';

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
 * Monta a aplicação sem escutar porta — quem sobe o servidor é `src/index.ts`.
 * A separação existe para que a montagem possa ser reaproveitada (teste, script,
 * outro adaptador) sem que ninguém precise abrir uma porta para isso.
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
