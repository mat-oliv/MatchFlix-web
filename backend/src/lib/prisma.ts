import { PrismaClient } from '@prisma/client';

// Um cliente por processo. Em serverless a mesma instância atende várias requisições e
// cada `new PrismaClient()` abriria um novo pool — guardar no globalThis garante que
// recarregamentos de módulo (tsx watch em dev, reaproveitamento de instância na Vercel)
// reusem a conexão existente em vez de estourar o limite do banco.
const globalParaPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? new PrismaClient();

globalParaPrisma.prisma = prisma;

/**
 * O erro que o Postgres devolve quando a linha que se ia inserir já existe (violação de
 * índice único). No Prisma é o código `P2002`.
 *
 * Existe porque há dois lugares onde essa colisão é resultado ESPERADO, e não falha:
 * duas pessoas fechando o mesmo match no mesmo instante, e a mesma pessoa clicando duas
 * vezes em "entrar no grupo". Nos dois casos o estado final desejado é exatamente o que
 * o banco já tem.
 *
 * Cuidado ao usar: só trate como "tudo bem" a colisão do índice que você esperava. Um
 * `P2002` em outro índice continua sendo bug, e engolir todos esconderia isso.
 */
export function ehLinhaJaExistente(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code?: unknown }).code === 'P2002'
  );
}
