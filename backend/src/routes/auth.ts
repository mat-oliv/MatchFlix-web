import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { criarToken } from '../lib/token.js';
import { exigirAutenticacao } from '../lib/auth.js';

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

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Preencha usuário, senha e confirmação.' });
    }

    const username = parsed.data.username.trim();
    const { password, confirmPassword } = parsed.data;

    if (!username) {
      return reply.status(400).send({ error: 'Informe um nome de usuário.' });
    }
    if (username.length < USUARIO_MIN) {
      return reply
        .status(400)
        .send({ error: `O usuário precisa ter pelo menos ${USUARIO_MIN} caracteres.` });
    }
    if (/\s/.test(username)) {
      return reply.status(400).send({ error: 'O usuário não pode conter espaços.' });
    }
    if (!password) {
      return reply.status(400).send({ error: 'Informe uma senha.' });
    }
    if (password.length < SENHA_MIN) {
      return reply
        .status(400)
        .send({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` });
    }
    if (password !== confirmPassword) {
      return reply.status(400).send({ error: 'As senhas não conferem.' });
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
        return reply.status(409).send({ error: `O usuário "${username}" já está em uso.` });
      }
      throw err;
    }
  });

  // Login — mensagem genérica de propósito: distinguir "não existe" de "senha errada"
  // revelaria quais usuários têm conta no site.
  app.post('/auth/login', async (request, reply) => {
    const bodySchema = z.object({ username: z.string(), password: z.string() });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Preencha usuário e senha.' });
    }

    const username = parsed.data.username.trim();
    const { password } = parsed.data;

    if (!username || !password) {
      return reply.status(400).send({ error: 'Preencha usuário e senha.' });
    }

    const invalido = { error: 'Usuário ou senha inválidos.' };

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user?.passwordHash) return reply.status(401).send(invalido);

    const senhaConfere = await verifyPassword(password, user.passwordHash);
    if (!senhaConfere) return reply.status(401).send(invalido);

    return reply.send({ token: criarToken(user.id), user: { id: user.id, username } });
  });

  // Usado no boot do frontend pra saber se o token guardado ainda vale.
  app.get('/auth/me', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, username: true },
    });

    if (!user) return reply.status(401).send({ error: 'Usuário não encontrado.' });
    return reply.send({ user });
  });
}
