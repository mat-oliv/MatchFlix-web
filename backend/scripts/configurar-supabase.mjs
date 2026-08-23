// Aponta o projeto para um banco do Supabase a partir de UMA string de conexão.
//
//   npm run supabase:configurar -- "<string de conexão do painel>"
//   npm run supabase:configurar -- "<...>" --vercel --seed
//   npm run supabase:configurar -- "<...sem a senha...>" --senha "minha senha"
//
// RODE DE DENTRO DE backend/ — é lá que está o package.json com este script.
//
// O Supabase é Postgres, então nada no código muda: o que muda é para onde a
// DATABASE_URL e a DIRECT_URL apontam. Este script existe porque essas duas não são
// intercambiáveis e errar qual vai onde é a forma mais comum de quebrar o deploy:
//
//   DATABASE_URL  -> pooler em modo TRANSACTION, porta 6543, com `pgbouncer=true`.
//                    É por onde a API fala. Sem `pgbouncer=true` o Prisma tenta usar
//                    prepared statements, que o pooler de transação não suporta, e as
//                    consultas começam a falhar de forma intermitente.
//   DIRECT_URL    -> pooler em modo SESSION, porta 5432. É por onde as MIGRATIONS
//                    passam. Migration por pooler de transação falha.
//
// Cole qualquer uma das strings do painel (Project Settings → Database → Connection
// string): o script deduz a outra trocando a porta.
//
// Onde encontrar: Supabase → seu projeto → Settings → Database → Connection string →
// aba "Transaction pooler" (ou "Session pooler"). É a string que contém a SENHA do banco,
// NÃO a "API key" (anon / service_role) da aba API — o Prisma fala Postgres, não a API
// REST do Supabase. Se você colar a chave errada, o script avisa.

import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizBackend = dirname(dirname(fileURLToPath(import.meta.url)));
const caminhoEnv = join(raizBackend, '.env');

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const aviso = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
function morrer(titulo, ...detalhes) {
  console.error(`\n\x1b[31m✗ ${titulo}\x1b[0m`);
  detalhes.forEach((d) => console.error(`  ${d}`));
  process.exit(1);
}

const args = process.argv.slice(2);
const posicionais = args.filter((a) => !a.startsWith('--'));
const querVercel = args.includes('--vercel');
const querSeed = args.includes('--seed');

// `--senha` existe para a senha NÃO precisar viajar dentro da URL. Assim ela pode ter
// @ : / ? # sem virar codificação manual, e um `--senha` separado torna impossível
// colar outra coisa grudada nela sem perceber — que foi como uma tentativa real acabou
// com "npm run dev" no meio da senha.
const iSenha = args.indexOf('--senha');
const senhaAvulsa = iSenha >= 0 ? args[iSenha + 1] : undefined;
if (iSenha >= 0 && !senhaAvulsa) morrer('`--senha` veio sem valor.');
const bruta = posicionais.find((a) => a !== senhaAvulsa);

if (!bruta) {
  morrer(
    'Falta a string de conexão.',
    '',
    'Uso: npm run supabase:configurar -- "<string de conexão>" [--vercel] [--seed]',
    '',
    'Pegue em: Supabase → Settings → Database → Connection string → Transaction pooler.',
    'Troque [YOUR-PASSWORD] pela senha do banco antes de colar.'
  );
}

// --- 1. É mesmo uma string de conexão? ---
// O erro mais provável aqui é colar a "API key" do Supabase (anon ou service_role), que
// é um JWT e não serve para o Prisma. Vale gastar uma mensagem boa nisso.
if (/^eyJ[\w-]+\./.test(bruta.trim())) {
  morrer(
    'Isso é uma API key do Supabase (JWT), não uma string de conexão.',
    '',
    'As chaves `anon` e `service_role` servem à API REST/JS do Supabase. Este projeto',
    'fala Postgres direto, pelo Prisma, e precisa da string de conexão do banco:',
    '',
    '  Supabase → Settings → Database → Connection string → Transaction pooler',
    '  postgresql://postgres.<ref>:<SENHA>@<região>.pooler.supabase.com:6543/postgres'
  );
}
if (bruta.includes('[YOUR-PASSWORD]') || bruta.includes('[SUA-SENHA]')) {
  morrer(
    'A string ainda tem o marcador de senha.',
    'Troque [YOUR-PASSWORD] pela senha real do banco (Settings → Database → Database password).'
  );
}

let url;
try {
  url = new URL(bruta.trim());
} catch {
  morrer('Não consegui interpretar a string como URL.', `Recebi: ${bruta.slice(0, 60)}…`);
}
if (!/^postgres(ql)?:$/.test(url.protocol)) {
  morrer(`Esperava uma URL postgres://, recebi "${url.protocol}//".`);
}
if (senhaAvulsa) {
  // `url.password =` já faz a codificação percentual necessária.
  url.password = senhaAvulsa;
}
if (!url.password) {
  morrer(
    'A string não tem senha.',
    'O formato é postgresql://USUARIO:SENHA@HOST:PORTA/postgres.',
    'Mais simples: deixe a senha fora da URL e passe `--senha "sua-senha"`,',
    'que aí caractere especial não precisa de codificação manual.'
  );
}

// Senha com espaço quase nunca é senha: é colagem acidental. Já aconteceu de um
// `npm run dev` entrar no meio da senha e o erro só aparecer como "authentication
// failed", que manda a pessoa investigar o lado errado.
if (/\s|%20/.test(url.password)) {
  morrer(
    'A senha tem espaço em branco — provavelmente algo foi colado junto.',
    `Recebi como senha: "${decodeURIComponent(url.password).replace(/./g, (c, i) => (i < 3 ? c : '•'))}"`,
    '',
    'Confira a string, ou passe a senha separada: --senha "sua-senha"'
  );
}

// --- 2. Derivar as duas URLs a partir da que veio ---
const ehPooler = url.hostname.includes('pooler.supabase.com');
const ehDireta = /^db\..+\.supabase\.co$/.test(url.hostname);

function comPorta(porta, params = {}) {
  const u = new URL(url.toString());
  u.port = String(porta);
  u.search = '';
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

let DATABASE_URL, DIRECT_URL;
if (ehPooler) {
  // O host do pooler já traz a região; só a porta muda entre os dois modos.
  // `connection_limit=1` porque na Vercel cada invocação é um processo: sem o teto,
  // uma rajada de requisições estoura o limite de conexões do projeto.
  DATABASE_URL = comPorta(6543, { pgbouncer: 'true', connection_limit: '1' });
  DIRECT_URL = comPorta(5432);
  ok(`pooler reconhecido: ${url.hostname}`);
} else if (ehDireta) {
  // A conexão direta (db.<ref>.supabase.co) é IPv6 em boa parte dos projetos, e o build
  // da Vercel sai por IPv4 — migration por ali falha com "can't reach database server".
  // Dá para seguir, mas o pooler é o caminho que funciona nos dois lugares.
  DATABASE_URL = comPorta(5432);
  DIRECT_URL = comPorta(5432);
  aviso('esta é a conexão DIRETA, não a do pooler.');
  aviso('em muitos projetos ela só responde por IPv6, e o build da Vercel sai por IPv4.');
  aviso('prefira a string da aba "Transaction pooler" — o script deduz a de migration sozinho.');
} else {
  aviso(`host "${url.hostname}" não parece do Supabase; seguindo assim mesmo.`);
  DATABASE_URL = url.toString();
  DIRECT_URL = url.toString();
}

const esconder = (u) => u.replace(/:\/\/([^:]+):[^@]+@/, '://$1:••••••@');
console.log('\nURLs derivadas:');
console.log(`  DATABASE_URL  ${esconder(DATABASE_URL)}`);
console.log(`  DIRECT_URL    ${esconder(DIRECT_URL)}`);

// --- 3. As duas conectam mesmo? ---
console.log('\nTestando conexão…');
const { PrismaClient } = await import('@prisma/client');
async function testar(rotulo, endereco) {
  const cliente = new PrismaClient({ datasourceUrl: endereco });
  try {
    await cliente.$queryRaw`SELECT 1`;
    ok(`${rotulo} conectou`);
    return true;
  } catch (erro) {
    // A primeira linha do erro do Prisma é sempre "Invalid `prisma.$queryRaw()`
    // invocation:", que não diz nada. O motivo de verdade ("Can't reach database
    // server", "authentication failed") vem depois — e é o único que ajuda aqui.
    const motivo =
      String(erro.message ?? erro)
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^Invalid `prisma\./.test(l) && !/^Please make sure/.test(l))[0] ?? String(erro.code ?? 'motivo desconhecido');
    console.log(`  \x1b[31m✗\x1b[0m ${rotulo} NÃO conectou: ${motivo.slice(0, 160)}`);
    return false;
  } finally {
    await cliente.$disconnect().catch(() => {});
  }
}
const okPool = await testar('DATABASE_URL (pooler/transação)', DATABASE_URL);
const okDireta = await testar('DIRECT_URL (sessão, migrations)', DIRECT_URL);
if (!okPool || !okDireta) {
  morrer(
    'Alguma das conexões falhou — nada foi gravado.',
    '',
    'Causas comuns:',
    '  · senha errada — se a mensagem acima diz "Authentication failed", o host e o',
    '    projeto estão certos e SÓ a senha está errada. Redefina em',
    '    Supabase → Settings → Database → Database password → Reset database password;',
    '  · projeto do Supabase pausado (o plano gratuito pausa após ~1 semana parado);',
    '  · string da conexão direta num ambiente só-IPv4 — use a do Transaction pooler.'
  );
}

// --- 4. Gravar no backend/.env, preservando o resto ---
const linhas = existsSync(caminhoEnv) ? readFileSync(caminhoEnv, 'utf8').split('\n') : [];
const novos = { DATABASE_URL, DIRECT_URL };
const vistos = new Set();
const saida = linhas.map((linha) => {
  const m = linha.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=/);
  if (!m) return linha;
  vistos.add(m[1]);
  return `${m[1]}="${novos[m[1]]}"`;
});
for (const [chave, valor] of Object.entries(novos)) {
  if (!vistos.has(chave)) saida.push(`${chave}="${valor}"`);
}
writeFileSync(caminhoEnv, saida.join('\n'), 'utf8');
ok(`backend/.env atualizado (as outras variáveis ficaram como estavam)`);

for (const obrigatoria of ['AUTH_SECRET', 'TMDB_API_KEY']) {
  if (!process.env[obrigatoria]) {
    aviso(`${obrigatoria} não está no .env — o app não sobe sem ela.`);
  }
}

// --- 5. Aplicar o schema no banco novo ---
console.log('\nAplicando as migrations…');
const migrar = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: raizBackend,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL, DIRECT_URL },
});
if (migrar.status !== 0) morrer('`prisma migrate deploy` falhou. O .env já está gravado; corrija e rode de novo.');
ok('schema aplicado');

if (querSeed) {
  console.log('\nCriando as contas de demonstração…');
  const semear = spawnSync('npm', ['run', 'seed'], {
    cwd: raizBackend,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL, DIRECT_URL },
  });
  semear.status === 0 ? ok('seed aplicado (demo/demo1234 e amigo/amigo1234)') : aviso('o seed falhou; rode `npm run seed` à mão.');
}

// --- 6. Levar para a Vercel ---
if (querVercel) {
  console.log('\nGravando as variáveis na Vercel (produção)…');
  // Production E preview. `vercel env rm <nome> production` apaga a ENTRADA inteira
  // quando ela cobre os dois ambientes — na primeira execução isto deixou os deploys de
  // preview sem banco, sem nenhum aviso. Por isso os dois são regravados sempre.
  const ambientes = ['production', 'preview'];
  for (const [chave, valor] of Object.entries(novos)) {
    for (const ambiente of ambientes) {
      // `env rm` antes porque `env add` não substitui valor existente.
      spawnSync('npx', ['vercel', 'env', 'rm', chave, ambiente, '--yes'], { cwd: dirname(raizBackend), stdio: 'ignore' });
      const add = spawnSync('npx', ['vercel', 'env', 'add', chave, ambiente], {
        cwd: dirname(raizBackend),
        input: valor,
        encoding: 'utf8',
      });
      add.status === 0
        ? ok(`${chave} gravada na Vercel (${ambiente})`)
        : aviso(`não consegui gravar ${chave} em ${ambiente}: ${(add.stderr ?? '').trim().slice(0, 140)}`);
    }
  }
  console.log('\n  A Vercel só passa a usar valor novo no PRÓXIMO deploy.');
  console.log('  Publique com: git commit --allow-empty -m "chore: point at Supabase" && git push origin master');
} else {
  console.log('\nPara levar à produção, rode de novo com --vercel, ou grave à mão:');
  console.log('  npx vercel env rm DATABASE_URL production --yes');
  console.log('  printf %s "<a DATABASE_URL acima>" | npx vercel env add DATABASE_URL production');
  console.log('  (idem para DIRECT_URL) e publique um novo deploy.');
}

console.log('\n\x1b[32m✓ pronto — o projeto está apontando para o Supabase\x1b[0m');
console.log('  Confira local com: npm run dev  (e o site com `cd ../frontend && npm run dev`)');
