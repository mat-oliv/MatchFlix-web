const TMDB_BASE = 'https://api.themoviedb.org/3';

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
const movieCache = new Map<number, TmdbMovie>();

export async function fetchMovieById(id: number): Promise<TmdbMovie | null> {
  const cached = movieCache.get(id);
  if (cached) return cached;

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB_API_KEY não configurada no .env');

  const res = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${apiKey}&language=pt-BR`);
  if (!res.ok) return null;

  const movie = toMovie(await res.json());
  movieCache.set(id, movie);
  return movie;
}

// Swipe e Match guardam só o movieId. Tanto a lista de matches de um grupo quanto os
// filmes curtidos do perfil precisam virar título + pôster antes de ir pra tela.
export async function enriquecerFilmes(itens: { movieId: number; createdAt: Date }[]) {
  return Promise.all(
    itens.map(async (item) => {
      const movie = await fetchMovieById(item.movieId);
      return {
        movieId: item.movieId,
        title: movie?.title ?? `Filme #${item.movieId}`,
        posterUrl: movie?.posterUrl ?? null,
        createdAt: item.createdAt,
      };
    })
  );
}

export async function fetchPopularMovies(page = 1): Promise<TmdbMovie[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB_API_KEY não configurada no .env');

  const res = await fetch(
    `${TMDB_BASE}/movie/popular?api_key=${apiKey}&language=pt-BR&page=${page}`
  );

  if (!res.ok) throw new Error('Falha ao buscar filmes na TMDB');

  const data = (await res.json()) as { results: any[] };

  return data.results.map(toMovie);
}
