import { textosDe, type Idioma } from './idioma.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

/** Código de idioma que a TMDB entende, a partir do idioma do app. */
const IDIOMA_TMDB: Record<Idioma, string> = { pt: 'pt-BR', en: 'en-US' };

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

export async function fetchPopularMovies(idioma: Idioma, page = 1): Promise<TmdbMovie[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB_API_KEY não configurada no .env');

  const res = await fetch(
    `${TMDB_BASE}/movie/popular?api_key=${apiKey}&language=${IDIOMA_TMDB[idioma]}&page=${page}`
  );

  if (!res.ok) throw new Error('Falha ao buscar filmes na TMDB');

  const data = (await res.json()) as { results: any[] };

  return data.results.map(toMovie);
}
