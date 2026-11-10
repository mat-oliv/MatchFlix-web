import { useEffect } from 'react';
import { enviarSinalDeUso } from './api';

/**
 * Mede quanto tempo o site é usado, sem que o servidor saiba de quem é o tempo.
 *
 * Enquanto a aba está visível e alguém mexeu nela nos últimos minutos, manda um sinal a
 * cada `INTERVALO_MS`. O servidor soma o tempo entre sinais próximos; aba escondida ou
 * esquecida aberta para de mandar, e o buraco não conta.
 *
 * Cada sinal carrega dois valores aleatórios e nada mais:
 * - a **sessão**, sorteada a cada período contínuo de uso;
 * - o **pseudônimo**, sorteado uma vez por conta NESTE navegador e guardado só aqui.
 *   É o que permite ao servidor calcular desvio padrão por pessoa sem saber quem é a
 *   pessoa: a tabela do pseudônimo para a conta existe só no `localStorage` de quem usa.
 */
const INTERVALO_MS = 30_000;

/** Sem interação por este tempo, a aba aberta deixa de contar como uso. */
const OCIOSO_APOS_MS = 5 * 60_000;

/**
 * Sinal atrasado mais que isto começa sessão nova. Fica abaixo da tolerância do servidor
 * (90s), para o período de ociosidade nunca ser somado à sessão anterior.
 */
const NOVA_SESSAO_APOS_MS = 75_000;

const EVENTOS_DE_ATIVIDADE = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

function pseudonimoDaConta(userId: string): string {
  const chave = `moviematch:pseudonimo:${userId}`;
  try {
    const guardado = localStorage.getItem(chave);
    if (guardado) return guardado;

    const novo = crypto.randomUUID();
    localStorage.setItem(chave, novo);
    return novo;
  } catch {
    // Sem `localStorage` (modo privado de alguns navegadores) o pseudônimo vale só para
    // esta aba. A pessoa conta como alguém novo — erra para o lado de não identificar.
    return crypto.randomUUID();
  }
}

export function useTempoDeUso(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const pseudonimo = pseudonimoDaConta(userId);
    let sessao = crypto.randomUUID();
    let ultimaAtividade = Date.now();
    let ultimoSinal = 0;
    // A aba foi escondida depois do último sinal: o próximo abre sessão nova.
    let sessaoEncerrada = false;

    const marcarAtividade = () => {
      ultimaAtividade = Date.now();
    };

    const enviar = (final: boolean) => {
      ultimoSinal = Date.now();
      // Medição não pode atrapalhar o uso: falha de rede aqui é silenciosa.
      enviarSinalDeUso(sessao, pseudonimo, { final }).catch(() => {});
    };

    const sinalizar = () => {
      const agora = Date.now();
      if (document.visibilityState !== 'visible') return;
      if (agora - ultimaAtividade > OCIOSO_APOS_MS) return;

      if (sessaoEncerrada || (ultimoSinal && agora - ultimoSinal > NOVA_SESSAO_APOS_MS)) {
        sessao = crypto.randomUUID();
        sessaoEncerrada = false;
      }
      enviar(false);
    };

    // Esconder a aba FECHA a sessão: manda um último sinal naquele instante, para contar
    // até ali, e o próximo sinal já nasce em sessão nova. Sem isso, uma ausência menor
    // que a tolerância do servidor (90s) entrava na soma como se fosse uso — o teste no
    // navegador pegou 35s de aba escondida virando tempo de uso.
    //
    // Voltar conta como atividade e reabre a medição na hora, sem esperar o intervalo.
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') {
        const emUso = ultimoSinal && !sessaoEncerrada && Date.now() - ultimaAtividade <= OCIOSO_APOS_MS;
        if (emUso) enviar(true);
        sessaoEncerrada = true;
        return;
      }
      marcarAtividade();
      sinalizar();
    };

    for (const evento of EVENTOS_DE_ATIVIDADE) {
      window.addEventListener(evento, marcarAtividade, { passive: true });
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    sinalizar();
    const intervalo = window.setInterval(sinalizar, INTERVALO_MS);

    return () => {
      window.clearInterval(intervalo);
      for (const evento of EVENTOS_DE_ATIVIDADE) {
        window.removeEventListener(evento, marcarAtividade);
      }
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [userId]);
}
