import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { enriquecerFilmes } from '../lib/tmdb.js';
import { exigirAutenticacao } from '../lib/auth.js';
import { idiomaDaRequisicao, textos } from '../lib/idioma.js';

export async function groupRoutes(app: FastifyInstance) {
  // Criar grupo — quem cria já entra como primeiro membro
  app.post('/groups', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const bodySchema = z.object({ name: z.string().min(1) });
    const { name } = bodySchema.parse(request.body);
    const userId = request.userId;

    const group = await prisma.group.create({
      data: {
        name,
        inviteCode: nanoid(8),
        members: { create: { userId } },
      },
    });

    return reply.status(201).send(group);
  });

  // Entrar em um grupo via código de convite
  app.post('/groups/join', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const bodySchema = z.object({ inviteCode: z.string() });
    const { inviteCode } = bodySchema.parse(request.body);
    const userId = request.userId;

    const group = await prisma.group.findUnique({ where: { inviteCode } });
    if (!group) return reply.status(404).send({ error: textos(request).conviteNaoEncontrado });

    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      update: {},
      create: { groupId: group.id, userId },
    });

    return reply.send(group);
  });

  // Grupos de que o usuário participa, com contagens e os matches prontos pra exibir
  app.get('/me/groups', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const userId = request.userId;

    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      select: {
        group: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
            _count: { select: { members: true, matches: true } },
            matches: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    const groups = await Promise.all(
      memberships.map(async ({ group }) => ({
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
        memberCount: group._count.members,
        matchCount: group._count.matches,
        matches: await enriquecerFilmes(group.matches, idiomaDaRequisicao(request)),
      }))
    );

    return reply.send(groups);
  });

  // Listar matches de um grupo — só para quem é membro dele
  app.get('/groups/:id/matches', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const paramsSchema = z.object({ id: z.string() });
    const { id } = paramsSchema.parse(request.params);

    const membro = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: request.userId } },
    });
    if (!membro) return reply.status(403).send({ error: textos(request).foraDoGrupo });

    const matches = await prisma.match.findMany({
      where: { groupId: id },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(await enriquecerFilmes(matches, idiomaDaRequisicao(request)));
  });
}
