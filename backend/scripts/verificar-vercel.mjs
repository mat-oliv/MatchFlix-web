// Roda, sem deploy e sem login, as checagens que a Vercel faz na API — as mesmas que já
// derrubaram deploy duas vezes. Use `npm run verify:vercel` antes de subir qualquer
// mudança que mexa em entrypoint, build ou estrutura de arquivos.
//
// Cobre três portões, na ordem em que a Vercel os aplica:
//   1. detecção do entrypoint dentro do outputDirectory (erro de BUILD);
//   2. formato do `export default` do entrypoint (erro de RUNTIME, com o deploy verde);
//   3. a app respondendo de verdade pelo handler, sem escutar porta.
//
// As regras do portão 1 são cópia fiel de `@vercel/fastify` (que chama
// `generateNodeBuilderFunctions` de `@vercel/build-utils`); estão embutidas aqui para o
// script não depender da CLI. Se a Vercel mudar as regras, quem manda é
// `npx vercel build` — veja o README.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raizBackend = dirname(dirname(fileURLToPath(import.meta.url)));
const diretorioSaida = 'dist';

// Cópia de @vercel/fastify: nome do framework, regex do import, nomes e extensões
// aceitos como entrypoint. A ORDEM da lista é o critério de desempate — repare que
// "app" vem antes de "index".
const NOMES = ['app', 'index', 'server', 'src/app', 'src/index', 'src/server'];
const EXTENSOES = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];
const IMPORTA_FASTIFY = /(?:from|require|import)\s*(?:\(\s*)?["']fastify["']\s*(?:\))?/g;

let falhou = false;

function ok(mensagem) {
  console.log(`  ✓ ${mensagem}`);
}

function erro(mensagem, detalhe) {
  console.log(`  ✗ ${mensagem}`);
  if (detalhe) console.log(`\n${detalhe}\n`);
  falhou = true;
}

function etapa(titulo) {
  console.log(`\n${titulo}`);
}

// ---------------------------------------------------------------- 1. build

etapa('1. Compilando (npm run build)');

const build = spawnSync('npm', ['run', 'build'], { cwd: raizBackend, encoding: 'utf-8' });

if (build.status !== 0) {
  erro('o build falhou', build.stderr || build.stdout);
  process.exit(1);
}
ok('compilou');

// ------------------------------------------------- 2. detecção do entrypoint

etapa(`2. Detecção do entrypoint em "${diretorioSaida}/" (regras da Vercel)`);

const candidatos = [];
for (const nome of NOMES) {
  for (const extensao of EXTENSOES) {
    const relativo = `${nome}.${extensao}`;
    const absoluto = join(raizBackend, diretorioSaida, relativo);
    if (existsSync(absoluto)) {
      candidatos.push({ relativo, absoluto, importaFastify: Boolean(readFileSync(absoluto, 'utf-8').match(IMPORTA_FASTIFY)) });
    }
  }
}

if (candidatos.length === 0) {
  erro(
    `nenhum candidato a entrypoint`,
    `A Vercel falharia com:\n  No entrypoint found in output directory: "${diretorioSaida}".`,
  );
  process.exit(1);
}

for (const candidato of candidatos) {
  const marca = candidato.importaFastify ? 'importa fastify' : 'NÃO importa fastify';
  console.log(`    · ${diretorioSaida}/${candidato.relativo} — ${marca}`);
}

const escolhido = candidatos.find((candidato) => candidato.importaFastify);

if (!escolhido) {
  const nomes = candidatos.map((candidato) => candidato.relativo).join(', ');
  erro(
    'nenhum candidato importa fastify diretamente',
    `A Vercel falharia o build com:\n  No entrypoint found which imports fastify. Found possible entrypoint: ${nomes}\n\n` +
      'A detecção olha os imports do próprio arquivo, não o que eles importam por transitividade.',
  );
  process.exit(1);
}

ok(`a Vercel escolheria ${diretorioSaida}/${escolhido.relativo}`);

const ignorados = candidatos.filter((candidato) => candidato !== escolhido && candidato.importaFastify);
if (ignorados.length > 0) {
  console.log(
    `  ! também importam fastify e perderam o desempate: ${ignorados.map((c) => c.relativo).join(', ')}`,
  );
}

// ------------------------------------------------ 3. formato do export default

etapa('3. Formato do export default');

// A app precisa de AUTH_SECRET para montar; num ambiente sem `.env` (o da Vercel) ela
// viria do painel. Aqui, se não houver nenhuma, usa-se uma de teste.
process.env.AUTH_SECRET ||= 'verificacao-local';
process.env.CORS_ORIGIN ||= 'https://site-de-teste.exemplo';
process.env.LOG_LEVEL ||= 'silent';

const modulo = await import(pathToFileURL(escolhido.absoluto).href);
const exportado = modulo.default;

if (typeof exportado !== 'function' && !(exportado instanceof http.Server)) {
  erro(
    `o export default é ${typeof exportado}`,
    'A Vercel faria o deploy passar e depois quebraria toda requisição com:\n' +
      `  Invalid export found in module ".../${diretorioSaida}/${escolhido.relativo}".\n` +
      '  The default export must be a function or server.',
  );
  process.exit(1);
}
ok(`export default é ${exportado instanceof http.Server ? 'um servidor' : 'uma função'}`);

// -------------------------------------------------- 4. requisições de verdade

etapa('4. Respondendo requisições pelo handler');

const servidor = http.createServer((req, res) => {
  Promise.resolve(exportado(req, res)).catch((causa) => {
    console.log(`  ✗ o handler rejeitou: ${causa.message}`);
    falhou = true;
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('erro');
    }
  });
});

await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
const base = `http://127.0.0.1:${servidor.address().port}`;

async function conferir(descricao, caminho, esperado, opcoes) {
  try {
    const resposta = await fetch(`${base}${caminho}`, opcoes);
    if (resposta.status === esperado) {
      ok(`${descricao} → ${resposta.status}`);
      return resposta;
    }
    erro(`${descricao} → ${resposta.status}, esperado ${esperado}`);
  } catch (causa) {
    erro(`${descricao} → ${causa.message}`);
  }
  return undefined;
}

await conferir('GET /health', '/health', 200);
await conferir('GET /rota-inexistente', '/rota-inexistente', 404);

const preflight = await conferir('OPTIONS /auth/login (preflight CORS)', '/auth/login', 204, {
  method: 'OPTIONS',
  headers: {
    Origin: process.env.CORS_ORIGIN,
    'Access-Control-Request-Method': 'POST',
  },
});

if (preflight) {
  const permitida = preflight.headers.get('access-control-allow-origin');
  if (permitida === process.env.CORS_ORIGIN) {
    ok(`CORS devolve a origem configurada (${permitida})`);
  } else {
    erro(`CORS devolveu "${permitida}", esperado "${process.env.CORS_ORIGIN}"`);
  }
}

servidor.close();

// ------------------------------------------------------------------ resultado

if (falhou) {
  console.log('\n✗ a Vercel recusaria este build. Não faça deploy.\n');
  process.exit(1);
}

console.log(
  '\n✓ os portões locais da Vercel passaram.\n' +
    '  Isto NÃO cobre o que depende da infra dela (empacotamento dos engines do Prisma,\n' +
    '  variáveis do painel, banco do Supabase). Para o build real, veja `npx vercel build`\n' +
    '  no README.\n',
);
