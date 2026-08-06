import 'dotenv/config';
import { construirApp } from './app.js';

// Entrada do servidor de verdade: desenvolvimento local e container. Na Vercel quem
// recebe as requisições é `api/index.ts` — lá não há porta para escutar.
const app = await construirApp();

const port = Number(process.env.PORT) || 3333;

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
