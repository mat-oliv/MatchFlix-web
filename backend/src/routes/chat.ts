import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirAutenticacao } from '../lib/auth.js';
import { idiomaDaRequisicao, textos } from '../lib/idioma.js';
import { AssistenteIndisponivel, CotaEsgotada, responderDuvida } from '../lib/chatbot.js';

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

  // Protegida de propósito: a cota do Gemini é finita (e vira cobrança depois do nível
  // gratuito), e conversa aberta na internet esgota isso rápido. O userId sai do token,
  // nunca do corpo.
  app.post('/chat', { preHandler: exigirAutenticacao }, async (request, reply) => {
    const t = textos(request);
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: t.perguntaInvalida });
    }

    const { conversa } = parsed.data;

    // Sem isto dá para fazer o modelo continuar a própria fala, que é caro e sem sentido.
    if (conversa[conversa.length - 1].autor !== 'pessoa') {
      return reply.status(400).send({ error: t.ultimaFalaPrecisaSerSua });
    }

    if (excedeuOLimite(request.userId)) {
      return reply
        .status(429)
        .send({ error: t.muitasPerguntas });
    }

    try {
      const resposta = await responderDuvida(conversa, idiomaDaRequisicao(request));
      return reply.send({ resposta });
    } catch (erro) {
      // O log usa a chave `err`, e não um nome qualquer: o pino só serializa Error com
      // mensagem e stack sob essa chave. Sob `{ erro }` sairia `erro: {}` — as
      // propriedades de Error não são enumeráveis — e o motivo real ficaria invisível
      // justamente quando mais se precisa dele. Já custou uma sessão inteira de
      // depuração às cegas.
      if (erro instanceof AssistenteIndisponivel) {
        request.log.error({ err: erro }, 'chat sem GEMINI_API_KEY configurada');
        return reply
          .status(503)
          .send({ error: t.assistenteNaoConfigurado });
      }

      // Cota do nível gratuito estourada (são 5 requisições por minuto). Não é defeito,
      // e a pessoa resolve esperando — por isso mensagem própria, não a genérica.
      if (erro instanceof CotaEsgotada) {
        request.log.warn({ err: erro }, 'cota do Gemini esgotada');
        return reply
          .status(429)
          .send({ error: t.cotaEsgotada });
      }

      // Falha da API externa (fora do ar, chave inválida, modelo aposentado). O motivo
      // fica no log; para a pessoa vai uma mensagem que não expõe detalhe de infra.
      request.log.error({ err: erro }, 'falha ao falar com a API do assistente');
      return reply
        .status(502)
        .send({ error: t.assistenteSemResposta });
    }
  });
}
