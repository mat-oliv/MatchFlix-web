import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { enriquecerFilmes, fetchMovieById } from '../lib/tmdb.js';
import { exigirAutenticacao } from '../lib/auth.js';
import { idiomaDaRequisicao, textos, textosDe } from '../lib/idioma.js';

/**
 * Teto de matches numa única resposta de `/me/matches`.
 *
 * Quem acompanha o app aberto recebe um ou dois por vez. O teto existe para o caso de
 * `since` vir de muito tempo atrás: sem ele, uma pergunta só poderia arrastar o
 * histórico inteiro do grupo e uma busca na TMDB para cada linha.
 */
const MAX_MATCHES_POR_CONSULTA = 20;

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

  /**
   * Matches criados depois de um instante, nos grupos de quem pergunta.
   *
   * É esta rota que faz o match aparecer para QUEM NÃO DEU o último like. O match nasce
   * dentro do `POST /swipes`, na requisição de quem votou por último — e só ela devolve
   * `newMatches`. Quem tinha curtido antes já encerrou a sua requisição e não fica
   * sabendo de nada: sem alguém perguntando, a tela da outra pessoa só mudaria quando
   * ela trocasse de aba, que foi exatamente o sintoma relatado.
   *
   * O frontend pergunta de tempos em tempos (ver `useMatchesAoVivo`). Não é WebSocket
   * nem SSE de propósito: na Vercel a API é função, não processo, e conexão longa não
   * sobrevive ao limite de duração da função nem se propaga entre instâncias.
   */
  app.get('/me/matches', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const querySchema = z.object({ since: z.string().datetime().optional() });
    const { since } = querySchema.parse(request.query);

    // Quem marca o tempo é o servidor, e o cliente devolve este `now` na pergunta
    // seguinte em vez de usar o relógio dele. Com o relógio do navegador, um adiantado
    // pularia matches e um atrasado mostraria os mesmos de novo.
    const now = new Date().toISOString();

    // Primeira pergunta da sessão: só devolve o marco zero. O aviso é sobre o que
    // acontecer daqui pra frente — despejar o histórico do grupo a cada login seria
    // barulho, não novidade.
    if (!since) return reply.send({ matches: [], now });

    const memberships = await prisma.groupMember.findMany({
      where: { userId: request.userId },
      select: { groupId: true },
    });
    if (memberships.length === 0) return reply.send({ matches: [], now });

    const novos = await prisma.match.findMany({
      where: {
        groupId: { in: memberships.map((m) => m.groupId) },
        createdAt: { gt: new Date(since) },
      },
      // Crescente: se dois matches saírem na mesma rodada, a tela mostra na ordem em
      // que aconteceram.
      orderBy: { createdAt: 'asc' },
      take: MAX_MATCHES_POR_CONSULTA,
      select: {
        groupId: true,
        movieId: true,
        createdAt: true,
        group: { select: { name: true } },
      },
    });

    // O nome do grupo vai junto porque este aviso pode chegar com a pessoa em qualquer
    // aba: sem ele, quem está em vários grupos não sabe de qual match se trata.
    const idioma = idiomaDaRequisicao(request);
    const matches = await Promise.all(
      novos.map(async (match) => {
        const filme = await fetchMovieById(match.movieId, idioma);
        return {
          groupId: match.groupId,
          groupName: match.group.name,
          movieId: match.movieId,
          title: filme?.title ?? textosDe(idioma).filmeSemTitulo(match.movieId),
          posterUrl: filme?.posterUrl ?? null,
          createdAt: match.createdAt,
        };
      })
    );

    return reply.send({ matches, now });
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
