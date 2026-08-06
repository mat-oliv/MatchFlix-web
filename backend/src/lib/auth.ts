import type { FastifyReply, FastifyRequest } from 'fastify';
import { lerToken } from './token.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

// preHandler das rotas protegidas: quem chega aqui já tem request.userId confiável,
// vindo do token assinado — nunca do corpo da requisição.
export async function exigirAutenticacao(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? lerToken(token) : null;

  if (!payload) {
    return reply.status(401).send({ error: 'Sessão expirada ou inválida. Entre novamente.' });
  }

  request.userId = payload.userId;
}
