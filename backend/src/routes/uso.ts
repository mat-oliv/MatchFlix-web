import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { exigirAutenticacao } from '../lib/auth.js';

/**
 * Maior distância entre dois sinais que ainda conta como uso contínuo.
 *
 * A aba manda sinal a cada 30s enquanto está visível e alguém mexeu nela nos últimos
 * minutos. Um intervalo maior que isto quer dizer que a aba ficou escondida ou a pessoa
 * saiu — esse buraco não é tempo de uso e soma zero. A folga sobre os 30s cobre rede
 * lenta e o `setInterval` atrasado de aba em segundo plano.
 */
const TOLERANCIA_SEGUNDOS = 90;

export async function usoRoutes(app: FastifyInstance) {
  // Exige login só para ninguém de fora inflar os números com sinal falso. O `userId`
  // que o preHandler descobre é IGNORADO de propósito: nada aqui grava de quem é o
  // tempo. Ver o comentário do `SessaoDeUso` no schema.
  app.post('/uso/sinal', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const { sessao, pseudonimo } = z
      .object({ sessao: z.string().uuid(), pseudonimo: z.string().uuid() })
      .parse(request.body);

    // Uma instrução só, para dois sinais simultâneos da mesma aba não somarem o mesmo
    // intervalo duas vezes. O relógio é o do banco, nunca o do navegador.
    //
    // O `WHERE` final impede que uma sessão mude de pseudônimo depois de criada.
    await prisma.$executeRaw`
      INSERT INTO "SessaoDeUso" ("id", "pseudonimo", "inicio", "ultimoSinal", "segundos")
      VALUES (${sessao}, ${pseudonimo}, timezone('UTC', now()), timezone('UTC', now()), 0)
      ON CONFLICT ("id") DO UPDATE SET
        "segundos" = "SessaoDeUso"."segundos" + CASE
          WHEN extract(epoch FROM EXCLUDED."ultimoSinal" - "SessaoDeUso"."ultimoSinal")
               <= ${TOLERANCIA_SEGUNDOS}
          THEN round(extract(epoch FROM EXCLUDED."ultimoSinal" - "SessaoDeUso"."ultimoSinal"))::int
          ELSE 0
        END,
        "ultimoSinal" = EXCLUDED."ultimoSinal"
      WHERE "SessaoDeUso"."pseudonimo" = EXCLUDED."pseudonimo"
    `;

    return reply.status(204).send();
  });
}
