import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { groupRoutes } from './routes/groups.js';
import { movieRoutes } from './routes/movies.js';
import { profileRoutes } from './routes/profile.js';
import { swipeRoutes } from './routes/swipes.js';

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET não configurada no .env — necessária para assinar os tokens.');
}

const app = Fastify({ logger: true });

// Preenchido pelo preHandler exigirAutenticacao nas rotas protegidas.
app.decorateRequest('userId', '');

await app.register(cors, { origin: true });

await app.register(authRoutes);
await app.register(groupRoutes);
await app.register(profileRoutes);
await app.register(movieRoutes);
await app.register(swipeRoutes);

app.get('/health', async () => ({ status: 'ok' }));

const port = Number(process.env.PORT) || 3333;

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
