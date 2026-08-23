import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fetchMovieById, fetchPopularMovies, type TmdbMovie } from '../lib/tmdb.js';
import { prisma } from '../lib/prisma.js';
import { exigirAutenticacao } from '../lib/auth.js';
import { idiomaDaRequisicao, textosDe, type Idioma } from '../lib/idioma.js';

/**
 * Última página que a TMDB entrega. Medido: a 500 responde normalmente e a 501 devolve
 * HTTP 400 ("Pages start at 1 and max at 500"), que aqui viraria erro 500 na rota. Toda
 * conta de página passa por `paginaValida()` por causa disso.
 *
 * São 500 × 20 = 10 mil filmes alcançáveis nesta ordenação. O catálogo filtrado tem
 * ~22,8 mil, mas o resto está além do teto de paginação — e 10 mil é mais do que
 * qualquer pessoa vota numa vida de uso.
 */
const MAX_PAGINA_TMDB = 500;

/** Filmes por página na TMDB. Usado para estimar onde o catálogo já foi consumido. */
const TAMANHO_PAGINA = 20;

const MIN_FILMES = 10;
const MAX_PAGINAS_POR_REQUISICAO = 5;

/** Mantém a página dentro do que a TMDB serve, dando a volta em vez de estourar. */
function paginaValida(pagina: number): number {
  if (pagina < 1) return 1;
  if (pagina > MAX_PAGINA_TMDB) return ((pagina - 1) % MAX_PAGINA_TMDB) + 1;
  return pagina;
}

/** Quantos filmes o ranking mostra. Cada um custa uma consulta à TMDB na primeira vez. */
const TAMANHO_RANKING = 10;

/** "Da semana" = últimos 7 dias corridos, não a semana do calendário. */
const JANELA_DIAS = 7;

/**
 * Por quanto tempo o ranking pronto é reaproveitado.
 *
 * Um agregado de sete dias praticamente não se mexe de um minuto para o outro, e sem
 * este cache toda abertura da aba custaria um GROUP BY mais até dez chamadas à TMDB.
 * Cinco minutos deixam o ranking "vivo" o suficiente e derrubam o custo do caso comum
 * a zero consulta e zero chamada externa.
 */
const CACHE_MS = 5 * 60 * 1000;

type FilmeDoRanking = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  likeCount: number;
};

/**
 * Ranking pronto, por idioma — título e sinopse mudam com ele.
 *
 * São dois registros de dez itens: alguns kilobytes, nada que justifique tabela nova.
 * Na Vercel cada instância tem o seu, então o aproveitamento é menor que num servidor
 * de longa duração; ainda assim, é o que evita repetir o trabalho a cada abertura de aba.
 */
const cacheDoRanking = new Map<Idioma, { emCache: FilmeDoRanking[]; expiraEm: number }>();

async function calcularRanking(idioma: Idioma): Promise<FilmeDoRanking[]> {
  const emCache = cacheDoRanking.get(idioma);
  if (emCache && emCache.expiraEm > Date.now()) return emCache.emCache;

  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000);

  // O banco só devolve `movieId` e a contagem — dez linhas, não a lista de swipes.
  // O `@@index([liked, createdAt, movieId])` existe exatamente para esta consulta.
  const contagens = await prisma.swipe.groupBy({
    by: ['movieId'],
    where: { liked: true, createdAt: { gte: desde } },
    _count: { movieId: true },
    // `movieId` como segundo critério é desempate: sem ele, filmes com o mesmo número
    // de likes trocariam de posição entre requisições, e o ranking pareceria instável.
    orderBy: [{ _count: { movieId: 'desc' } }, { movieId: 'asc' }],
    take: TAMANHO_RANKING,
  });

  // As buscas na TMDB vão em paralelo e passam pelo cache de filmes do `tmdb.ts`, que
  // já foi aquecido pelo feed na maioria dos casos.
  const filmes = await Promise.all(
    contagens.map(async (linha) => {
      const filme = await fetchMovieById(linha.movieId, idioma);
      return {
        movieId: linha.movieId,
        title: filme?.title ?? textosDe(idioma).filmeSemTitulo(linha.movieId),
        posterUrl: filme?.posterUrl ?? null,
        likeCount: linha._count.movieId,
      };
    })
  );

  cacheDoRanking.set(idioma, { emCache: filmes, expiraEm: Date.now() + CACHE_MS });
  return filmes;
}

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export async function movieRoutes(app: FastifyInstance) {
  // Feed paginado de filmes populares (fonte: TMDB), sem o que o usuário já votou
  app.get('/movies/feed', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const querySchema = z.object({ page: z.coerce.number().min(1).optional() });
    const { page } = querySchema.parse(request.query);

    // Filme votado sai do feed para sempre — curtido OU passado. Repare que não há
    // `liked` no filtro: é essa ausência a regra inteira. Passar é "não quero", não
    // "hoje não".
    //
    // Isto só é sustentável porque a entrada no catálogo acompanha o uso (ver abaixo):
    // com a entrada sorteada entre as 15 primeiras páginas, excluir os passados esvaziava
    // o feed em poucas centenas de votos.
    const jaVotados = new Set(
      (
        await prisma.swipe.findMany({
          where: { userId: request.userId },
          select: { movieId: true },
        })
      ).map((s) => s.movieId)
    );

    // Onde entrar no catálogo quando não veio `page` (começo de sessão).
    //
    // Antes era sorteado entre as 15 primeiras páginas, e era essa a causa do feed
    // "acabar": quem já tinha votado bastante consumia as 15 inteiras, então toda
    // sessão nova caía em território gasto, varria o orçamento de páginas sem achar
    // nada e recebia lista vazia.
    //
    // Agora a entrada acompanha o uso: cada 20 filmes votados equivalem a uma página já
    // consumida, então quem votou muito começa mais adiante, onde ainda há filme novo.
    // O varrimento abaixo cuida do resto — a estimativa não precisa ser exata, só
    // precisa não começar atrás.
    let pagina = paginaValida(page ?? Math.floor(jaVotados.size / TAMANHO_PAGINA) + 1);

    // Uma página pode vir inteira de filmes já votados — busca as seguintes até juntar
    // filmes novos o bastante ou gastar o orçamento desta requisição. Gastar o
    // orçamento não é o fim do feed: `nextPage` avança, e a próxima requisição continua
    // a varredura de onde esta parou.
    const novos: TmdbMovie[] = [];

    for (let i = 0; i < MAX_PAGINAS_POR_REQUISICAO && novos.length < MIN_FILMES; i++) {
      const filmes = await fetchPopularMovies(idiomaDaRequisicao(request), pagina);
      pagina = paginaValida(pagina + 1);
      if (filmes.length === 0) break;

      novos.push(...filmes.filter((m) => !jaVotados.has(m.id)));
    }

    return reply.send({ movies: embaralhar(novos), nextPage: pagina });
  });

  // Ranking global dos filmes mais curtidos nos últimos 7 dias.
  //
  // Nada é gravado para isto existir: a contagem sai dos swipes que já estavam lá. Um
  // contador por filme seria mais rápido de ler, mas custaria uma escrita a cada like e
  // uma tabela para manter em dia — caro demais para um número que muda devagar e que
  // ninguém consulta com frequência.
  app.get('/movies/leaderboard', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const movies = await calcularRanking(idiomaDaRequisicao(request));
    return reply.send({ movies, days: JANELA_DIAS });
  });
}
