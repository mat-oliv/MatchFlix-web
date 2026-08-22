import { useCallback, useEffect, useRef, useState } from 'react';
import { getMatchesRecentes } from './api';

/**
 * De quanto em quanto tempo o app pergunta se saiu match.
 *
 * Cinco segundos é o que faz a outra pessoa ver o match praticamente na hora sem
 * transformar o app num gerador de requisições. Cada pergunta é uma consulta indexada
 * que quase sempre volta vazia, e só sai com a aba à vista.
 */
const INTERVALO_MS = 5000;

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

  const anunciar = useCallback((novos: AvisoDeMatch[]) => {
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

    let parado = false;

    async function perguntar() {
      // Aba escondida não pergunta: ninguém veria o aviso e a requisição sairia igual.
      // Ao voltar, o `visibilitychange` abaixo dispara uma rodada na hora, e como o
      // marco não avançou nesse meio-tempo, nada do período se perde.
      if (parado || document.visibilityState !== 'visible') return;

      try {
        const { matches, now } = await getMatchesRecentes(marco.current);
        if (parado) return;

        marco.current = now;
        if (matches.length > 0) anunciar(matches);
      } catch {
        // Consulta de fundo não vira erro na tela. O marco fica onde está, então a
        // próxima rodada recupera o que tiver acontecido durante a falha.
      }
    }

    perguntar();
    const id = setInterval(perguntar, INTERVALO_MS);
    document.addEventListener('visibilitychange', perguntar);

    return () => {
      parado = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', perguntar);
    };
  }, [userId, anunciar]);

  return { aviso: fila[0] ?? null, dispensar, anunciar, versao };
}
