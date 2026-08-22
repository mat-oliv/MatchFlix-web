import { textosDe, type Idioma } from './idioma.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

/** Código de idioma que a TMDB entende, a partir do idioma do app. */
const IDIOMA_TMDB: Record<Idioma, string> = { pt: 'pt-BR', en: 'en-US' };

/**
 * País cuja classificação indicativa vale como trava do feed.
 *
 * É sempre o Brasil, mesmo para quem está com o site em inglês. A regra é sobre o
 * conteúdo do filme, não sobre o idioma de quem assiste — e um padrão único mantém o
 * catálogo idêntico para todo mundo, o que aqui não é detalhe: dois membros do mesmo
 * grupo podem estar com navegadores em idiomas diferentes e precisam continuar podendo
 * dar match no mesmo filme.
 */
const CLASSIFICACAO_PAIS = 'BR';

/**
 * Maior classificação que entra no feed. A escala da DJCTQ é L, 10, 12, 14, 16, 18 —
 * então "16" deixa passar tudo, menos a faixa adulta.
 */
const CLASSIFICACAO_MAXIMA = '16';

/** A faixa que não pode aparecer, do jeito que a TMDB escreve. */
const CLASSIFICACAO_ADULTA = '18';

/**
 * Filmes já conferidos na segunda passagem: `id` → é adulto?
 *
 * A classificação não muda com o idioma, então uma chave só por `id` serve para os dois
 * dicionários — ao contrário do `movieCache` aqui de baixo, que precisa do idioma junto.
 * Sem este cache cada abertura do feed repetiria as vinte consultas.
 */
const cacheAdulto = new Map<number, boolean>();

/**
 * Confere a classificação real do filme, lançamento por lançamento.
 *
 * Existe porque o filtro do `/discover` sozinho vaza. Um filme pode ter MAIS DE UMA
 * classificação brasileira, uma por tipo de lançamento, e ele aceita o filme se
 * QUALQUER uma couber no teto. "Frankenstein" (2025) saiu 18 no cinema e 16 na Netflix:
 * passou pelo `certification.lte=16` e chegou ao feed num teste de 120 filmes.
 *
 * Aqui a regra é a inversa, que é a segura: basta uma classificação 18 para barrar.
 */
async function ehAdulto(id: number, apiKey: string): Promise<boolean> {
  const emCache = cacheAdulto.get(id);
  if (emCache !== undefined) return emCache;

  let resposta: Response;
  try {
    resposta = await fetch(`${TMDB_BASE}/movie/${id}/release_dates?api_key=${apiKey}`);
  } catch {
    // Sem resposta não dá para provar nada, e o resultado não vai para o cache: a
    // próxima chamada tenta de novo. O filme fica, porque o `/discover` já aplicou o
    // filtro dele — esvaziar o feed inteiro numa instabilidade da TMDB seria pior que o
    // pouco que aquele filtro deixa passar sozinho.
    return false;
  }
  if (!resposta.ok) return false;

  const dados = (await resposta.json()) as {
    results?: { iso_3166_1: string; release_dates?: { certification?: string }[] }[];
  };
  const doBrasil = dados.results?.find((r) => r.iso_3166_1 === CLASSIFICACAO_PAIS);
  const adulto = (doBrasil?.release_dates ?? []).some(
    (r) => r.certification === CLASSIFICACAO_ADULTA
  );

  cacheAdulto.set(id, adulto);
  return adulto;
}

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  releaseDate: string;
  voteAverage: number;
};

function toMovie(m: any): TmdbMovie {
  return {
    id: m.id,
    title: m.title,
    overview: m.overview,
    posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    releaseDate: m.release_date,
    voteAverage: m.vote_average,
  };
}

// Match guarda só o movieId, então a tela de grupos precisa resolver título e pôster.
// Cache em memória porque os mesmos filmes reaparecem a cada carregamento da tela.
//
// A chave inclui o idioma: título e sinopse mudam com ele, e uma chave só por `id` faria
// o primeiro a pedir decidir o idioma de todo mundo até o processo reiniciar.
const movieCache = new Map<string, TmdbMovie>();

export async function fetchMovieById(id: number, idioma: Idioma): Promise<TmdbMovie | null> {
  const chave = `${idioma}:${id}`;
  const cached = movieCache.get(chave);
  if (cached) return cached;

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB_API_KEY não configurada no .env');

  const res = await fetch(
    `${TMDB_BASE}/movie/${id}?api_key=${apiKey}&language=${IDIOMA_TMDB[idioma]}`
  );
  if (!res.ok) return null;

  const movie = toMovie(await res.json());
  movieCache.set(chave, movie);
  return movie;
}

// Swipe e Match guardam só o movieId. Tanto a lista de matches de um grupo quanto os
// filmes curtidos do perfil precisam virar título + pôster antes de ir pra tela.
export async function enriquecerFilmes(
  itens: { movieId: number; createdAt: Date }[],
  idioma: Idioma
) {
  return Promise.all(
    itens.map(async (item) => {
      const movie = await fetchMovieById(item.movieId, idioma);
      return {
        movieId: item.movieId,
        title: movie?.title ?? textosDe(idioma).filmeSemTitulo(item.movieId),
        posterUrl: movie?.posterUrl ?? null,
        createdAt: item.createdAt,
      };
    })
  );
}

/**
 * Uma página de filmes populares, já sem o que é adulto.
 *
 * São três travas em sequência, e nenhuma das duas primeiras basta sozinha:
 *
 * 1. `include_adult=false` corta o que a TMDB marca como pornografia (`adult: true`).
 *    Não resolve nada por si: numa amostra de 160 populares, NENHUM vinha com essa
 *    marca — ela já mantém esse material fora dessas listas.
 * 2. `certification.lte` corta pela classificação indicativa, e é esta que tira a maior
 *    parte do "+18". Dos mesmos 160, 8% eram DJCTQ 18 e entravam sem nada os barrar.
 * 3. `ehAdulto()` pega o que a anterior deixa passar — veja lá em cima por quê.
 *
 * A troca de `/movie/popular` para `/discover/movie` foi por causa da segunda: só o
 * `discover` aceita filtro de classificação. Ordenado por popularidade, ele devolve o
 * mesmo tipo de lista que o endpoint anterior.
 *
 * Filme sem classificação brasileira na TMDB também fica de fora — cerca de 28% dos
 * populares, quase sempre lançamento ainda não classificado. É de propósito: na dúvida
 * sobre a faixa etária, não mostrar. O preço é um blockbuster recém-anunciado demorar a
 * aparecer no feed.
 */
export async function fetchPopularMovies(idioma: Idioma, page = 1): Promise<TmdbMovie[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB_API_KEY não configurada no .env');

  const params = new URLSearchParams({
    api_key: apiKey,
    language: IDIOMA_TMDB[idioma],
    page: String(page),
    sort_by: 'popularity.desc',
    include_adult: 'false',
    certification_country: CLASSIFICACAO_PAIS,
    'certification.lte': CLASSIFICACAO_MAXIMA,
  });

  const res = await fetch(`${TMDB_BASE}/discover/movie?${params}`);

  if (!res.ok) throw new Error('Falha ao buscar filmes na TMDB');

  const data = (await res.json()) as { results: any[] };

  // O `!m.adult` é conferência nossa: se um dia o parâmetro mudar de nome ou deixar de
  // valer, o feed continua sem pornografia em vez de passar a mostrá-la silenciosamente.
  const candidatos = data.results.filter((m) => !m.adult).map(toMovie);

  // Filtrar aqui dentro, e não em quem chama, é o que faz o feed se recompor sozinho: a
  // rota já busca a página seguinte enquanto não juntar filmes suficientes, então o que
  // cai nesta peneira é reposto sem código novo.
  const adultos = await Promise.all(candidatos.map((m) => ehAdulto(m.id, apiKey)));
  return candidatos.filter((_, i) => !adultos[i]);
}
