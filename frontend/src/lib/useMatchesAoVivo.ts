import { useCallback, useEffect, useRef, useState } from 'react';
import { getMatchesRecentes } from './api';

/**
 * De quanto em quanto tempo o app pergunta se saiu match — e por que são dois ritmos.
 *
 * O intervalo era fixo em 5s, e o atraso reclamado vinha quase todo daí: medido em
 * produção, o servidor responde em ~388ms, então dos ~2,9s de espera média 2,5s eram
 * simplesmente o relógio parado. Pior, matches criados dentro da mesma janela de 5s
 * chegavam juntos — foi assim que nove apareceram de uma vez.
 *
 * Perguntar de 1,5 em 1,5s o tempo todo resolveria, mas triplicaria as requisições de
 * quem deixou a aba aberta sem usar. Então o ritmo segue a atividade: enquanto alguém
 * está votando ou recebendo match, pergunta rápido; passados alguns minutos parado,
 * desacelera. É exatamente o caso que o usuário descreveu — o grupo todo no app ao
 * mesmo tempo — que fica rápido.
 */
const INTERVALO_ATIVO_MS = 1500;
const INTERVALO_OCIOSO_MS = 8000;

/** Por quanto tempo, depois da última atividade, o ritmo rápido continua valendo. */
const JANELA_ATIVA_MS = 2 * 60 * 1000;

/**
 * Um match para anunciar na tela, venha de onde vier.
 *
 * As duas origens entregam o mesmo formato de propósito: o `POST /swipes` avisa quem deu
 * o último like, na resposta do próprio voto, e o `GET /me/matches` avisa todo mundo que
 * tinha curtido antes. A tela não precisa saber qual dos dois trouxe o aviso.
 */
export type AvisoDeMatch = {
  groupId: string;
  groupName: string;
  movieId: number;
  title: string;
  posterUrl: string | null;
};

/**
 * Mantém a tela em dia com os matches que acontecem enquanto o app está aberto.
 *
 * Existe porque o match nasce na requisição de quem vota por último: quem tinha curtido
 * antes já encerrou a sua e não fica sabendo de nada. Sem isto, a segunda pessoa do
 * grupo só via o match ao trocar de aba.
 *
 * É pergunta de tempos em tempos, não WebSocket nem SSE. Na Vercel a API é função, não
 * processo: conexão longa não sobrevive ao limite de duração da função e não se propaga
 * entre instâncias, então um push que funcionasse no `npm run dev` morreria justamente
 * em produção.
 */
export function useMatchesAoVivo(userId: string | null) {
  const [fila, setFila] = useState<AvisoDeMatch[]>([]);
  // Sobe a cada rodada com novidade. Quem mostra dados de grupo observa este número
  // para se refazer — é o que atualiza a contagem de matches sem trocar de aba.
  const [versao, setVersao] = useState(0);

  // Nenhum dos dois entra em estado: mudar qualquer um deles não deve, sozinho,
  // redesenhar a tela nem reiniciar o intervalo.
  const jaAnunciados = useRef(new Set<string>());
  const marco = useRef<string | undefined>(undefined);
  const ultimaAtividade = useRef(0);

  const anunciar = useCallback((novos: AvisoDeMatch[]) => {
    // Marca atividade ANTES de peneirar. A `SwipeScreen` chama isto a cada voto, mesmo
    // sem match nenhum, e é esse sinal que mantém o ritmo rápido enquanto o grupo está
    // votando — sair daqui cedo demais deixaria o polling lento justo na hora que importa.
    ultimaAtividade.current = Date.now();

    // O mesmo match chega duas vezes para quem votou por último: uma na resposta do
    // voto e outra na rodada seguinte de perguntas. Sem esta peneira o pop-up abriria de
    // novo alguns segundos depois de a pessoa fechá-lo.
    const ineditos = novos.filter((m) => !jaAnunciados.current.has(`${m.groupId}:${m.movieId}`));
    if (ineditos.length === 0) return;

    ineditos.forEach((m) => jaAnunciados.current.add(`${m.groupId}:${m.movieId}`));
    setFila((atual) => [...atual, ...ineditos]);
    setVersao((n) => n + 1);
  }, []);

  const dispensar = useCallback(() => setFila((atual) => atual.slice(1)), []);

  useEffect(() => {
    // Trocar de conta (ou sair) zera tudo: o marco e a lista de já anunciados eram da
    // sessão anterior e não valem para a nova.
    marco.current = undefined;
    jaAnunciados.current.clear();
    setFila([]);

    if (!userId) return;

    // Abrir o app (ou trocar de conta) conta como atividade. Sem isto, quem acabou de
    // entrar e ainda não votou cairia no ritmo ocioso de 8s — pior que o intervalo fixo
    // que existia antes, e justamente no momento em que a pessoa está olhando a tela.
    ultimaAtividade.current = Date.now();

    let parado = false;
    let agendado: number | undefined;
    // Existe pergunta esperando resposta agora? É o que impede duas cadeias de polling
    // de nascerem: `aoVoltarParaAba` chama `perguntar()` direto, e se isso acontecer
    // durante os ~400ms de uma requisição, o `clearTimeout` não cancela nada (aquele
    // timer já disparou) — sem esta trava passariam a existir duas correntes se
    // reagendando para sempre, e mais uma a cada ida e volta da aba.
    let emVoo = false;

    async function perguntar() {
      // Aba escondida não pergunta: ninguém veria o aviso e a requisição sairia igual.
      // Ao voltar, o `visibilitychange` abaixo dispara uma rodada na hora, e como o
      // marco não avançou nesse meio-tempo, nada do período se perde.
      if (parado || emVoo) return;

      if (document.visibilityState === 'visible') {
        emVoo = true;
        try {
          const { matches, now } = await getMatchesRecentes(marco.current);
          if (parado) return;

          marco.current = now;
          if (matches.length > 0) anunciar(matches);
        } catch {
          // Consulta de fundo não vira erro na tela. O marco fica onde está, então a
          // próxima rodada recupera o que tiver acontecido durante a falha.
        } finally {
          // No `finally` porque o `return` do `parado` acima também passa por aqui: sem
          // isso, desmontar no meio de uma requisição deixaria a trava presa.
          emVoo = false;
        }
      }

      if (parado) return;
      // Agendar só DEPOIS da resposta, em vez de `setInterval`, é o que impede duas
      // perguntas se atropelarem quando a rede está lenta — com 1,5s de intervalo e
      // respostas de ~400ms a margem é confortável, mas não é garantida.
      const ativo = Date.now() - ultimaAtividade.current < JANELA_ATIVA_MS;
      agendado = window.setTimeout(perguntar, ativo ? INTERVALO_ATIVO_MS : INTERVALO_OCIOSO_MS);
    }

    function aoVoltarParaAba() {
      if (document.visibilityState !== 'visible') return;
      // Voltar para a aba é atividade: quem acabou de olhar a tela quer ver o que
      // perdeu, e provavelmente vai continuar votando.
      ultimaAtividade.current = Date.now();
      window.clearTimeout(agendado);
      // Com pergunta em voo, `perguntar()` sai na trava e não faz nada — de propósito:
      // a resposta que já está a caminho traz o que houver e reagenda sozinha.
      perguntar();
    }

    perguntar();
    document.addEventListener('visibilitychange', aoVoltarParaAba);

    return () => {
      parado = true;
      window.clearTimeout(agendado);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    };
  }, [userId, anunciar]);

  return { aviso: fila[0] ?? null, dispensar, anunciar, versao };
}
