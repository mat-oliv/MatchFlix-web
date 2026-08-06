import 'dotenv/config';
import { construirApp } from '../lib/app.js';

// Sobe a API como servidor de longa duração, escutando porta: é assim que ela roda no
// desenvolvimento local (`npm run dev`) e dentro do container. Na Vercel não existe
// processo escutando — lá quem atende cada requisição é o handler de `src/index.ts`.
const app = await construirApp();

const port = Number(process.env.PORT) || 3333;

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
