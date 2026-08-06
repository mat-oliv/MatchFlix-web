import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fetchPopularMovies, type TmdbMovie } from '../lib/tmdb.js';
import { prisma } from '../lib/prisma.js';
import { exigirAutenticacao } from '../lib/auth.js';

// A TMDB tem centenas de páginas de populares. Começar sempre na 1 fazia todo mundo
// ver os mesmos 20 filmes toda vez — sortear a página inicial dá variedade entre sessões.
const PAGINA_INICIAL_MAX = 15;
const MIN_FILMES = 10;
const MAX_PAGINAS_POR_REQUISICAO = 5;

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

    // Sem page = começo de sessão: sorteia onde entrar no catálogo.
    let pagina = page ?? Math.floor(Math.random() * PAGINA_INICIAL_MAX) + 1;

    const jaVotados = new Set(
      (
        await prisma.swipe.findMany({
          where: { userId: request.userId },
          select: { movieId: true },
        })
      ).map((s) => s.movieId)
    );

    // Uma página pode vir inteira de filmes já votados — busca as seguintes até
    // juntar filmes novos o bastante ou estourar o limite de tentativas.
    const novos: TmdbMovie[] = [];

    for (let i = 0; i < MAX_PAGINAS_POR_REQUISICAO && novos.length < MIN_FILMES; i++) {
      const filmes = await fetchPopularMovies(pagina);
      if (filmes.length === 0) break;

      novos.push(...filmes.filter((m) => !jaVotados.has(m.id)));
      pagina++;
    }

    return reply.send({ movies: embaralhar(novos), nextPage: pagina });
  });
}
