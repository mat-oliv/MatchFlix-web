import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword, precisaRefazerHash, verifyPassword } from '../lib/password.js';
import { criarToken } from '../lib/token.js';
import { exigirAutenticacao } from '../lib/auth.js';
import { textos } from '../lib/idioma.js';

const USUARIO_MIN = 3;
const SENHA_MIN = 6;

export async function authRoutes(app: FastifyInstance) {
  // Cadastro — erros são específicos de propósito: a pessoa precisa saber o que corrigir.
  app.post('/auth/register', async (request, reply) => {
    const bodySchema = z.object({
      username: z.string(),
      password: z.string(),
      confirmPassword: z.string(),
    });

    const t = textos(request);

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: t.preenchaCadastro });
    }

    const username = parsed.data.username.trim();
    const { password, confirmPassword } = parsed.data;

    if (!username) {
      return reply.status(400).send({ error: t.informeUsuario });
    }
    if (username.length < USUARIO_MIN) {
      return reply
        .status(400)
        .send({ error: t.usuarioCurto(USUARIO_MIN) });
    }
    if (/\s/.test(username)) {
      return reply.status(400).send({ error: t.usuarioComEspacos });
    }
    if (!password) {
      return reply.status(400).send({ error: t.informeSenha });
    }
    if (password.length < SENHA_MIN) {
      return reply
        .status(400)
        .send({ error: t.senhaCurta(SENHA_MIN) });
    }
    if (password !== confirmPassword) {
      return reply.status(400).send({ error: t.senhasNaoConferem });
    }

    try {
      const user = await prisma.user.create({
        data: { username, name: username, passwordHash: await hashPassword(password) },
      });

      return reply
        .status(201)
        .send({ token: criarToken(user.id), user: { id: user.id, username } });
    } catch (err) {
      // P2002 = violação de unique. Cobre a corrida entre dois cadastros simultâneos,
      // que uma checagem prévia com findUnique deixaria passar.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.status(409).send({ error: t.usuarioEmUso(username) });
      }
      throw err;
    }
  });

  // Login — mensagem genérica de propósito: distinguir "não existe" de "senha errada"
  // revelaria quais usuários têm conta no site.
  app.post('/auth/login', async (request, reply) => {
    const t = textos(request);
    const bodySchema = z.object({ username: z.string(), password: z.string() });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: t.preenchaLogin });
    }

    const username = parsed.data.username.trim();
    const { password } = parsed.data;

    if (!username || !password) {
      return reply.status(400).send({ error: t.preenchaLogin });
    }

    const invalido = { error: t.credenciaisInvalidas };

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user?.passwordHash) return reply.status(401).send(invalido);

    const senhaConfere = await verifyPassword(password, user.passwordHash);
    if (!senhaConfere) return reply.status(401).send(invalido);

    // Conta com hash de antes do reforço (custo menor, formato antigo): a senha acabou de
    // conferir, então o hash é refeito com o custo atual. Falha aqui não barra a entrada —
    // o hash antigo continua válido e o próximo login tenta de novo.
    if (precisaRefazerHash(user.passwordHash)) {
      await prisma.user
        .update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } })
        .catch((err) => request.log.warn({ err }, 'não foi possível refazer o hash da senha'));
    }

    return reply.send({ token: criarToken(user.id), user: { id: user.id, username } });
  });

  // Usado no boot do frontend pra saber se o token guardado ainda vale.
  app.get('/auth/me', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const t = textos(request);
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, username: true },
    });

    if (!user) return reply.status(401).send({ error: t.usuarioNaoEncontrado });
    return reply.send({ user });
  });
}
