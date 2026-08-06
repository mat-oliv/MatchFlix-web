import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirAutenticacao } from '../lib/auth.js';
import { AssistenteIndisponivel, responderDuvida } from '../lib/chatbot.js';

/** Tamanho máximo de uma fala. Dúvida sobre o app não precisa de mais que isto. */
const MAX_CARACTERES = 1000;

/** Falas mantidas no contexto. Conversa longa custa mais e não melhora a resposta. */
const MAX_FALAS = 20;

/** Perguntas por pessoa dentro da janela abaixo. */
const LIMITE_POR_JANELA = 20;
const JANELA_MS = 60 * 60 * 1000;

/**
 * Contador de uso por pessoa, na memória do processo.
 *
 * É proposital que seja aproximado: na Vercel a API roda em várias instâncias, e cada uma
 * tem o seu contador, então o teto real é maior que `LIMITE_POR_JANELA`. Serve para
 * conter engano e script bobo, que é o risco de verdade num app deste tamanho. Se o app
 * abrir para muita gente, o certo é mover isto para uma tabela no Postgres — aí o limite
 * passa a valer de verdade, ao custo de uma migration e uma escrita por pergunta.
 */
const usoPorUsuario = new Map<string, { inicioDaJanela: number; usadas: number }>();

function excedeuOLimite(userId: string): boolean {
  const agora = Date.now();
  const uso = usoPorUsuario.get(userId);

  if (!uso || agora - uso.inicioDaJanela > JANELA_MS) {
    usoPorUsuario.set(userId, { inicioDaJanela: agora, usadas: 1 });
    return false;
  }

  uso.usadas += 1;
  return uso.usadas > LIMITE_POR_JANELA;
}

export async function chatRoutes(app: FastifyInstance) {
  const bodySchema = z.object({
    conversa: z
      .array(
        z.object({
          autor: z.enum(['pessoa', 'assistente']),
          texto: z.string().trim().min(1).max(MAX_CARACTERES),
        }),
      )
      .min(1)
      .max(MAX_FALAS),
  });

  // Protegida de propósito: a chave da Anthropic é paga, e conversa aberta na internet
  // vira conta alta. O userId sai do token, nunca do corpo.
  app.post('/chat', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Pergunta inválida ou longa demais.' });
    }

    const { conversa } = parsed.data;

    // Sem isto dá para fazer o modelo continuar a própria fala, que é caro e sem sentido.
    if (conversa[conversa.length - 1].autor !== 'pessoa') {
      return reply.status(400).send({ error: 'A última mensagem precisa ser sua.' });
    }

    if (excedeuOLimite(request.userId)) {
      return reply
        .status(429)
        .send({ error: 'Você fez muitas perguntas seguidas. Tente de novo mais tarde.' });
    }

    try {
      const resposta = await responderDuvida(conversa);
      return reply.send({ resposta });
    } catch (erro) {
      if (erro instanceof AssistenteIndisponivel) {
        request.log.error({ erro }, 'chat sem ANTHROPIC_API_KEY configurada');
        return reply
          .status(503)
          .send({ error: 'O assistente ainda não está configurado neste servidor.' });
      }

      // Falha da API externa (fora do ar, sem crédito, chave inválida). O motivo fica no
      // log; para a pessoa vai uma mensagem que não expõe detalhe de infraestrutura.
      request.log.error({ erro }, 'falha ao falar com a API do assistente');
      return reply
        .status(502)
        .send({ error: 'O assistente não respondeu agora. Tente de novo em instantes.' });
    }
  });
}
