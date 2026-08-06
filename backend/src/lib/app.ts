import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from '../routes/auth.js';
import { groupRoutes } from '../routes/groups.js';
import { movieRoutes } from '../routes/movies.js';
import { profileRoutes } from '../routes/profile.js';
import { swipeRoutes } from '../routes/swipes.js';

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
 * Monta a aplicação sem escutar porta. Quem abre porta é `src/bin/servidor.ts`
 * (desenvolvimento e Docker); na Vercel quem responde é o handler de `src/index.ts`.
 * A separação existe justamente para que os dois reaproveitem a mesma montagem.
 *
 * O arquivo mora em `lib/` de propósito: a Vercel varre a raiz do `dist` procurando o
 * entrypoint da função e escolhe o primeiro `index.js`/`app.js`/`server.js` que achar.
 * Um `dist/app.js` no topo era capturado no lugar do `index.js` e derrubava o deploy
 * com "Invalid export found in module".
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
