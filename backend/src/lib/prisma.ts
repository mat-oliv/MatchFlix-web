import { PrismaClient } from '@prisma/client';

// Um cliente por processo. Em serverless a mesma instância atende várias requisições e
// cada `new PrismaClient()` abriria um novo pool — guardar no globalThis garante que
// recarregamentos de módulo (tsx watch em dev, reaproveitamento de instância na Vercel)
// reusem a conexão existente em vez de estourar o limite do banco.
const globalParaPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? new PrismaClient();

globalParaPrisma.prisma = prisma;
