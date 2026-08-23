// Testa a produção DEPOIS do deploy, do jeito que um usuário usaria — porque build verde
// não prova nada. Já houve deploy que passou e a URL morreu no ar, e feed que passou no
// typecheck e devolvia filme adulto. Use `npm run verify:prod`.
//
// Cobre, em ordem:
//   1. API e site respondendo (e o /health devolvendo JSON, não o 302 do SSO);
//   2. o site publicado apontando para a API certa, lendo o bundle que está no ar;
//   3. o filtro de classificação indicativa no feed real;
//   4. o match chegando a quem NÃO deu o último like.
//
// Precisa de duas contas de verificação em produção; passe-as em VERIFY_USER_A /
// VERIFY_USER_B, ou deixe o script criar um par novo com `--criar-contas`. Prefira
// reaproveitar: o app não tem "apagar conta", então cada par novo fica lá para sempre.
// A senha padrão é a das contas que ele mesmo cria; para usar as do seed, informe
// VERIFY_PASS_A / VERIFY_PASS_B.
//
// Precisa também da TMDB_API_KEY (vem do backend/.env) para conferir a classificação de
// cada filme do feed contra a fonte, em vez de confiar no que o nosso código diz.

// Carrega o backend/.env para pegar a TMDB_API_KEY. Sem isto, `npm run verify:prod`
// rodava sem a chave e a checagem de classificação virava uma reprovação falsa.
import 'dotenv/config';

const API = process.env.VERIFY_API ?? 'https://match-flix-web-bixao.vercel.app';
const SITE = process.env.VERIFY_SITE ?? 'https://match-flix-web-cyhd-sigma.vercel.app';
// Senha padrão das contas criadas por este script. As do seed usam outras
// (demo/demo1234, amigo/amigo1234), então dá para apontar para elas com
// VERIFY_PASS_A/VERIFY_PASS_B — útil logo depois de trocar de banco, quando as contas de
// verificação antigas ficaram no banco velho.
const SENHA_PADRAO = 'senha1234';
const criarContas = process.argv.includes('--criar-contas');

let falhou = false;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const nok = (m) => { falhou = true; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

async function api(caminho, { token, ...init } = {}) {
  const r = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'accept-language': 'pt-BR',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${caminho} -> ${r.status} ${JSON.stringify(corpo)?.slice(0, 200)}`);
  return corpo;
}

// A TMDB corta em ~50 req/s e o 429 vira `null` no nosso lado — que se parece com "filme
// sem classificação" e faz o teste concluir o oposto do que está acontecendo. Já
// aconteceu: 100 consultas em paralelo devolveram "100% sem classificação" e a conclusão
// foi inteiramente falsa. Por isso vai em lotes pequenos, com pausa e erro explícito.
async function emLotes(itens, fn, tam = 8) {
  const saida = [];
  for (let i = 0; i < itens.length; i += tam) {
    saida.push(...(await Promise.all(itens.slice(i, i + tam).map(fn))));
    await new Promise((r) => setTimeout(r, 150));
  }
  return saida;
}

async function ehDezoito(movieId, chaveTmdb) {
  const r = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/release_dates?api_key=${chaveTmdb}`);
  if (!r.ok) return { erro: r.status };
  const d = await r.json();
  const br = d.results?.find((x) => x.iso_3166_1 === 'BR');
  if (!br) return { semClassificacao: true };
  // Um filme tem uma classificação POR LANÇAMENTO. Basta uma 18 para ele não poder estar
  // no feed — é a mesma regra do `ehAdulto()` em src/lib/tmdb.ts.
  return { dezoito: (br.release_dates ?? []).some((x) => x.certification === '18') };
}

console.log(`API:  ${API}\nSite: ${SITE}\n`);

// --- 1. Está no ar? ---
console.log('1. No ar');
const saude = await api('/health');
saude?.status === 'ok' ? ok('/health devolve JSON') : nok(`/health devolveu ${JSON.stringify(saude)}`);

const respostaSite = await fetch(SITE, { redirect: 'manual' });
respostaSite.status === 200
  ? ok('site responde 200')
  : nok(`site respondeu ${respostaSite.status}${respostaSite.status === 302 ? ' — Deployment Protection ligado?' : ''}`);

// --- 2. O site publicado fala com a API certa? ---
console.log('\n2. Bundle publicado');
const html = await (await fetch(SITE)).text();
const caminhoBundle = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
if (!caminhoBundle) {
  nok('não achei o bundle no index.html');
} else {
  const bundle = await (await fetch(`${SITE}${caminhoBundle}`)).text();
  const urls = [...new Set(bundle.match(/https:\/\/[a-z0-9.-]*vercel\.app/g) ?? [])];
  urls.includes(API)
    ? ok(`o site chama ${API}`)
    : nok(`VITE_API_URL publicada é ${urls.join(', ') || '(nenhuma)'} — esperava ${API}`);
  bundle.includes('/me/matches')
    ? ok('o bundle no ar tem o código de match em tempo real')
    : nok('bundle no ar parece antigo: não encontrei /me/matches');
}

// --- Contas ---
const marca = Date.now();
async function conta(rotulo, envVar) {
  const nome = process.env[envVar];
  const senha = process.env[`VERIFY_PASS_${rotulo.toUpperCase()}`] ?? SENHA_PADRAO;
  if (nome) return { ...(await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: nome, password: senha }) })), novo: false };
  if (!criarContas) {
    console.log(`\n\x1b[31mFalta ${envVar}.\x1b[0m Passe as contas de verificação existentes ou rode com --criar-contas.`);
    process.exit(1);
  }
  const nomeNovo = `verificacao_deploy_${rotulo}_${marca}`;
  return { ...(await api('/auth/register', { method: 'POST', body: JSON.stringify({ username: nomeNovo, password: SENHA_PADRAO, confirmPassword: SENHA_PADRAO }) })), novo: true };
}
const a = await conta('a', 'VERIFY_USER_A');
const b = await conta('b', 'VERIFY_USER_B');

// --- 3. Filtro de classificação no feed real ---
console.log('\n3. Filtro de +18 no feed de produção');
const chaveTmdb = process.env.TMDB_API_KEY;
if (!chaveTmdb) {
  nok('sem TMDB_API_KEY: não dá para conferir a classificação contra a fonte');
} else {
  const filmes = new Map();
  for (const page of [1, 5, 9]) {
    for (const m of (await api(`/movies/feed?page=${page}`, { token: a.token })).movies) filmes.set(m.id, m.title);
  }
  const ids = [...filmes.keys()];
  const veredictos = await emLotes(ids, (id) => ehDezoito(id, chaveTmdb));
  const erros = veredictos.filter((v) => v.erro).length;
  const vazaram = ids.filter((_, i) => veredictos[i].dezoito);
  const sem = ids.filter((_, i) => veredictos[i].semClassificacao);
  console.log(`      ${ids.length} filmes distintos${erros ? `, ${erros} consultas falharam na TMDB` : ''}`);
  vazaram.length === 0 ? ok('nenhum classificado 18') : nok(`vazaram: ${vazaram.map((i) => filmes.get(i)).join(', ')}`);
  sem.length === 0 ? ok('nenhum sem classificação brasileira') : nok(`${sem.length} sem classificação`);
}

// --- 4. Match chegando a quem não votou por último ---
console.log('\n4. Match em tempo real');
let grupo = (await api('/me/groups', { token: a.token }))[0];
if (!grupo) {
  grupo = await api('/groups', { token: a.token, method: 'POST', body: JSON.stringify({ name: `Verificação ${marca}` }) });
  await api('/groups/join', { token: b.token, method: 'POST', body: JSON.stringify({ inviteCode: grupo.inviteCode }) });
  ok(`grupo de verificação criado: "${grupo.name}"`);
}

// Um filme que as duas contas ainda não votaram — senão o match já existe e o teste
// passa sem provar nada.
const curtidosA = new Set((await api('/me/liked', { token: a.token })).movies.map((m) => m.movieId));
const candidatos = [27205, 155, 680, 13, 550, 278, 238, 424, 129, 497];
const filme = candidatos.find((id) => !curtidosA.has(id));
if (!filme) {
  nok('as contas de verificação já curtiram todos os filmes candidatos — acrescente outros à lista');
} else {
  const base = await api('/me/matches', { token: a.token });
  base.matches.length === 0 && base.now ? ok('/me/matches responde e fixa o marco') : nok('/me/matches fora do esperado');

  await api('/swipes', { token: a.token, method: 'POST', body: JSON.stringify({ movieId: filme, liked: true }) });
  const meio = await api(`/me/matches?since=${encodeURIComponent(base.now)}`, { token: a.token });
  meio.matches.length === 0 ? ok('só um curtiu: nada ainda') : nok('match cedo demais');

  const voto = await api('/swipes', { token: b.token, method: 'POST', body: JSON.stringify({ movieId: filme, liked: true }) });
  voto.newMatches.length >= 1 ? ok('quem votou por último recebe na resposta do voto') : nok('resposta do voto veio sem match');

  const aviso = await api(`/me/matches?since=${encodeURIComponent(meio.now)}`, { token: a.token });
  aviso.matches.length >= 1
    ? ok(`quem votou ANTES é avisado: "${aviso.matches[0].title}"`)
    : nok('quem votou antes NÃO foi avisado — é a regressão que esta rota existe para pegar');

  const repeticao = await api(`/me/matches?since=${encodeURIComponent(aviso.now)}`, { token: a.token });
  repeticao.matches.length === 0 ? ok('não repete na rodada seguinte') : nok('o mesmo match voltou');
}

if (a.novo || b.novo) {
  console.log(`\n  \x1b[33m!\x1b[0m contas novas criadas em produção (não há como apagar):`);
  console.log(`    VERIFY_USER_A=${a.user.username} VERIFY_USER_B=${b.user.username}`);
  console.log(`    Reaproveite-as nas próximas verificações.`);
}

console.log(falhou ? '\n\x1b[31m✗ produção REPROVADA\x1b[0m' : '\n\x1b[32m✓ produção aprovada\x1b[0m');
process.exit(falhou ? 1 : 0);
