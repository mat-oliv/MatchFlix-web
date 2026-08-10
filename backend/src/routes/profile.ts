import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { enriquecerFilmes } from '../lib/tmdb.js';
import { exigirAutenticacao } from '../lib/auth.js';
import { idiomaDaRequisicao, textos } from '../lib/idioma.js';

// Cada página custa uma busca na TMDB por filme (a primeira vez; depois é cache).
// 20 enche a grade do menu sem fazer ninguém esperar a lista inteira.
const TAMANHO_PAGINA = 20;

// A foto chega como data URL já reduzida pelo navegador (256px, JPEG) — algo em torno
// de 30 KB. O teto aqui é folgado de propósito, só pra barrar quem mandar o arquivo
// original de vários MB direto na API. O limite de corpo do Fastify (1 MB) é a trava
// seguinte.
const AVATAR_MAX_CARACTERES = 500_000;
const AVATAR_FORMATO = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export async function profileRoutes(app: FastifyInstance) {
  // Identificação e contadores do menu do usuário. Não devolve os filmes curtidos:
  // quem curtiu muito esperava todas as buscas na TMDB antes de ver o menu. A lista
  // vem paginada por /me/liked.
  app.get('/me/profile', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const userId = request.userId;

    const [user, groupCount, likedCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, avatarUrl: true },
      }),
      prisma.groupMember.count({ where: { userId } }),
      prisma.swipe.count({ where: { userId, liked: true } }),
    ]);

    if (!user) return reply.status(401).send({ error: textos(request).usuarioNaoEncontrado });

    return reply.send({ user, groupCount, likedCount });
  });

  // Troca a foto de perfil. Sempre do próprio usuário: o id vem do token.
  app.put('/me/avatar', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const bodySchema = z.object({
      avatar: z.string().max(AVATAR_MAX_CARACTERES).regex(AVATAR_FORMATO),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: textos(request).imagemInvalida });
    }

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: { avatarUrl: parsed.data.avatar },
      select: { avatarUrl: true },
    });

    return reply.send(user);
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
      movies: await enriquecerFilmes(pagina, idiomaDaRequisicao(request)),
      nextCursor: temMais ? pagina[pagina.length - 1].id : null,
    });
  });
}
