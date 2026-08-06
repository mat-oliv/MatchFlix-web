import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { exigirAutenticacao } from '../lib/auth.js';

export async function swipeRoutes(app: FastifyInstance) {
  // Registra o swipe e verifica se ele gerou match em algum grupo do usuário
  app.post('/swipes', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const bodySchema = z.object({
      movieId: z.number(),
      liked: z.boolean(),
    });
    const { movieId, liked } = bodySchema.parse(request.body);
    const userId = request.userId;

    const swipe = await prisma.swipe.upsert({
      where: { userId_movieId: { userId, movieId } },
      update: { liked },
      create: { userId, movieId, liked },
    });

    const newMatches: { groupId: string; movieId: number }[] = [];

    if (liked) {
      // Swipe é global por usuário — o match é calculado por grupo
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      });

      for (const { groupId } of memberships) {
        const members = await prisma.groupMember.findMany({
          where: { groupId },
          select: { userId: true },
        });

        // Match é acordo entre pessoas. Num grupo de um membro só, `every` é
        // trivialmente verdadeiro e todo like viraria match sozinho.
        if (members.length < 2) continue;

        const likesForMovie = await prisma.swipe.findMany({
          where: {
            movieId,
            liked: true,
            userId: { in: members.map((m) => m.userId) },
          },
        });

        const allMembersLiked = members.every((m) =>
          likesForMovie.some((s) => s.userId === m.userId)
        );

        if (allMembersLiked) {
          // Match é registro histórico e fica congelado: uma vez criado, nunca é
          // revogado. Se alguém entrar no grupo depois, os matches anteriores
          // continuam valendo mesmo sem essa pessoa ter curtido o filme.
          const match = await prisma.match.upsert({
            where: { groupId_movieId: { groupId, movieId } },
            update: {},
            create: { groupId, movieId },
          });
          newMatches.push({ groupId: match.groupId, movieId: match.movieId });
        }
      }
    }

    return reply.send({ swipe, newMatches });
  });
}
