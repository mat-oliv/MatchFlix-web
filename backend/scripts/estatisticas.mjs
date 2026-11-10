// Estatísticas básicas de uso, sem identificar ninguém. Use `npm run stats`.
//
//   npm run stats                       # banco do `.env` (em desenvolvimento, o local)
//   npm run stats -- --producao         # produção, pela PRODUCAO_DATABASE_URL do `.env`
//   npm run stats -- --dias 30          # só o uso dos últimos 30 dias
//
// Só LÊ. O tempo vem da tabela `SessaoDeUso`, que não tem relação com `User`: a unidade
// "pessoa" aqui é um pseudônimo aleatório que só o navegador de quem usa sabe ligar à
// conta (ver `frontend/src/lib/useTempoDeUso.ts`).
//
// Por que não uma média simples: o tempo de uso é muito assimétrico — pouca gente usa
// muito e muita gente usa pouco. A média sozinha esconde isso; o desvio padrão, o
// coeficiente de variação e a distância entre média e mediana mostram o tamanho da
// cauda.

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const args = process.argv.slice(2);
const producao = args.includes('--producao');
const iDias = args.indexOf('--dias');
const dias = iDias >= 0 ? Number(args[iDias + 1]) : null;

if (dias !== null && !(Number.isInteger(dias) && dias > 0)) {
  console.error('`--dias` precisa de um número inteiro positivo, ex.: --dias 30');
  process.exit(1);
}

const url = producao ? process.env.PRODUCAO_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(
    producao
      ? 'Falta PRODUCAO_DATABASE_URL no backend/.env (a URL de sessão do Supabase de produção, porta 5432).'
      : 'Falta DATABASE_URL no backend/.env.'
  );
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

// Sem `--dias`, o corte é o começo dos tempos.
const corte = dias
  ? Prisma.sql`timezone('UTC', now()) - make_interval(days => ${dias}::int)`
  : Prisma.sql`'-infinity'::timestamp`;

// Estatística descritiva de uma coluna `s` (segundos), numa consulta só. `var_samp` e
// `stddev_samp` são as versões AMOSTRAIS (divisor n − 1): os dados são uma amostra de
// quem usa o app, não a população inteira de quem poderia usar.
const descrever = (origem) => Prisma.sql`
  SELECT
    count(*)::int                                          AS n,
    avg(s)::float8                                         AS media,
    var_samp(s)::float8                                    AS variancia,
    stddev_samp(s)::float8                                 AS desvio,
    min(s)::float8                                         AS minimo,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY s)::float8 AS p25,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY s)::float8 AS mediana,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY s)::float8 AS p75,
    percentile_cont(0.90) WITHIN GROUP (ORDER BY s)::float8 AS p90,
    max(s)::float8                                         AS maximo
  FROM (${origem}) AS dados`;

// Sessão com 0s é aba que abriu e fechou antes do segundo sinal: não é uso medível e
// só puxaria a distribuição para baixo. Ela é contada à parte.
const sessoes = Prisma.sql`
  SELECT "segundos"::float8 AS s, "pseudonimo"
  FROM "SessaoDeUso"
  WHERE "inicio" >= ${corte} AND "segundos" > 0`;

const porPessoa = Prisma.sql`
  SELECT sum(s) AS s FROM (${sessoes}) AS x GROUP BY "pseudonimo"`;

try {
  const [[contas], [pessoa], [sessao], [extra]] = await Promise.all([
    prisma.$queryRaw`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE "createdAt" >= ${corte})::int AS novas
      FROM "User"`,
    prisma.$queryRaw(descrever(porPessoa)),
    prisma.$queryRaw(descrever(sessoes)),
    prisma.$queryRaw`
      SELECT count(*) FILTER (WHERE "segundos" = 0)::int AS vazias,
             (count(*) FILTER (WHERE "segundos" > 0)::float8
               / NULLIF(count(DISTINCT "pseudonimo") FILTER (WHERE "segundos" > 0), 0)) AS sessoes_por_pessoa
      FROM "SessaoDeUso"
      WHERE "inicio" >= ${corte}`,
  ]);

  const host = new URL(url).host.replace(/:\d+$/, '');
  console.log(`\nMovieMatch — uso ${dias ? `nos últimos ${dias} dias` : 'desde o início'}`);
  console.log(`banco: ${host}${producao ? '  (PRODUÇÃO)' : ''}\n`);

  console.log('Contas');
  linha('total', contas.total);
  if (dias) linha(`criadas nos últimos ${dias} dias`, contas.novas);

  console.log('\nTempo de uso por pessoa (soma das sessões de cada pseudônimo)');
  if (!pessoa.n) {
    console.log('  ainda não há uso registrado.\n');
  } else {
    // Não é porcentagem das contas: a mesma pessoa em dois aparelhos vira dois pseudônimos,
    // então este número pode até passar do total de contas.
    linha('pessoas com uso registrado', `${pessoa.n}  (pseudônimos; cada aparelho conta um)`);
    blocoDescritivo(pessoa);
    linha('sessões por pessoa (média)', extra.sessoes_por_pessoa?.toFixed(1) ?? '—');
  }

  console.log('\nDuração de cada sessão (período contínuo de uso)');
  if (sessao.n) {
    linha('sessões', `${sessao.n}  (+${extra.vazias} com menos de 30s, fora da conta)`);
    blocoDescritivo(sessao);
  } else {
    console.log('  ainda não há sessões.');
  }
  console.log();
} finally {
  await prisma.$disconnect();
}

function blocoDescritivo(d) {
  linha('média', duracao(d.media));
  linha('desvio padrão', d.desvio == null ? '— (precisa de 2+ valores)' : duracao(d.desvio));
  // A variância vai em min² porque em s² o número fica ilegível. É o desvio ao quadrado;
  // quem interpreta é o desvio, a variância está aqui para cálculos posteriores.
  linha('variância', d.variancia == null ? '—' : `${(d.variancia / 3600).toFixed(1)} min²`);
  // Coeficiente de variação: desvio relativo à média. Acima de 1 = muito disperso.
  linha('coef. de variação', d.desvio == null || !d.media ? '—' : (d.desvio / d.media).toFixed(2));
  linha('mediana', duracao(d.mediana));
  linha('quartis (P25 · P75)', `${duracao(d.p25)} · ${duracao(d.p75)}`);
  linha('P90', duracao(d.p90));
  linha('mín · máx', `${duracao(d.minimo)} · ${duracao(d.maximo)}`);
}

function linha(rotulo, valor) {
  console.log(`  ${rotulo.padEnd(30, ' ')}${valor}`);
}

function duracao(segundos) {
  if (segundos == null) return '—';
  const s = Math.round(segundos);
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  if (h) return `${h} h ${String(min).padStart(2, '0')} min`;
  if (min) return `${min} min ${String(seg).padStart(2, '0')} s`;
  return `${seg} s`;
}
