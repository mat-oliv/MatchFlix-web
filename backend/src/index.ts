import 'dotenv/config';
import { construirApp } from './app.js';

// Único ponto de entrada: desenvolvimento local, container e Vercel. A Vercel executa
// o `dist/index.js` compilado e encaminha as requisições para a porta que ele abrir —
// por isso `PORT` vem do ambiente e o host é 0.0.0.0.
const app = await construirApp();

const port = Number(process.env.PORT) || 3333;

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
