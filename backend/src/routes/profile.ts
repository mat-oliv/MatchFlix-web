import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { enriquecerFilmes } from '../lib/tmdb.js';
import { exigirAutenticacao } from '../lib/auth.js';

// Cada página custa uma busca na TMDB por filme (a primeira vez; depois é cache).
// 20 enche a grade do menu sem fazer ninguém esperar a lista inteira.
const TAMANHO_PAGINA = 20;

export async function profileRoutes(app: FastifyInstance) {
  // Identificação e contadores do menu do usuário. Não devolve os filmes curtidos:
  // quem curtiu muito esperava todas as buscas na TMDB antes de ver o menu. A lista
  // vem paginada por /me/liked.
  app.get('/me/profile', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const userId = request.userId;

    const [user, groupCount, likedCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true },
      }),
      prisma.groupMember.count({ where: { userId } }),
      prisma.swipe.count({ where: { userId, liked: true } }),
    ]);

    if (!user) return reply.status(401).send({ error: 'Usuário não encontrado.' });

    return reply.send({ user, groupCount, likedCount });
  });

  // Uma página de filmes curtidos, do mais recente pro mais antigo.
  app.get('/me/liked', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const querySchema = z.object({ cursor: z.string().optional() });
    const { cursor } = querySchema.parse(request.query);

    const swipes = await prisma.swipe.findMany({
      where: { userId: request.userId, liked: true },
      // `id` desempata: vários likes podem cair no mesmo instante e, sem ordem total,
      // o cursor pularia ou repetiria filmes entre páginas.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // Um a mais que a página: se vier, é porque ainda existe próxima — evita uma
      // requisição final que voltaria vazia.
      take: TAMANHO_PAGINA + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, movieId: true, createdAt: true },
    });

    const temMais = swipes.length > TAMANHO_PAGINA;
    const pagina = temMais ? swipes.slice(0, TAMANHO_PAGINA) : swipes;

    return reply.send({
      movies: await enriquecerFilmes(pagina),
      nextCursor: temMais ? pagina[pagina.length - 1].id : null,
    });
  });
}
