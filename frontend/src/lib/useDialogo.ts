import { useEffect, useRef } from 'react';

/**
 * Comportamento de teclado e foco compartilhado pelos pop-ups.
 *
 * Sem router, todo diálogo aqui é uma sobreposição (ver "Decisões de arquitetura" no
 * CLAUDE.md). Cada um já fechava no Escape por conta própria, com o mesmo `useEffect`
 * copiado em cinco arquivos — mas nenhum resolvia as outras duas metades do problema,
 * que só aparecem para quem navega pelo teclado ou por leitor de tela:
 *
 * 1. **O foco escapava.** O pop-up abria, o foco continuava no botão lá atrás e o Tab
 *    passeava pela tela de baixo — que continua clicável e anunciável, embora esteja
 *    visualmente coberta. A pessoa "sai" do diálogo sem nunca tê-lo fechado.
 * 2. **O foco não voltava.** Ao fechar, o foco ia parar no começo do documento, então o
 *    Tab seguinte recomeçava do topo em vez de continuar de onde a pessoa estava.
 *
 * Devolve a `ref` que deve ser posta no painel do diálogo — o elemento que carrega
 * `role="dialog"`, e não o fundo escuro.
 */
export function useDialogo(onFechar: () => void) {
  const painel = useRef<HTMLDivElement>(null);

  // Em ref, e não em dependência do efeito: a função de fechar costuma ser recriada a
  // cada render de quem chama, e isso remontaria o efeito — devolvendo o foco para o
  // lugar errado no meio da conversa.
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const alvo = painel.current;
    if (!alvo) return;

    // Quem já tem foco dentro fica com ele: o campo de escrita do chat abre em foco de
    // propósito, e roubá-lo aqui atrapalharia quem abriu justamente para digitar.
    if (!alvo.contains(document.activeElement)) {
      // O painel recebe o foco, não o primeiro botão: assim o leitor de tela anuncia o
      // nome do diálogo antes de anunciar um controle solto dentro dele.
      alvo.focus();
    }

    const focaveis = () =>
      Array.from(
        alvo.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((e) => e.offsetParent !== null);

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        fechar.current();
        return;
      }

      if (evento.key !== 'Tab') return;

      // Prende o Tab: do último volta ao primeiro, e do primeiro com Shift vai ao
      // último. É o que impede o foco de vazar para a tela coberta.
      const lista = focaveis();
      if (lista.length === 0) {
        // Diálogo sem nenhum controle (o aviso de match, que fecha em qualquer toque):
        // não há para onde tabular, então o foco simplesmente não sai daqui.
        evento.preventDefault();
        return;
      }

      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const atual = document.activeElement;

      if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      } else if (evento.shiftKey && (atual === primeiro || atual === alvo)) {
        evento.preventDefault();
        ultimo.focus();
      }
    }

    window.addEventListener('keydown', aoTeclar);

    return () => {
      window.removeEventListener('keydown', aoTeclar);
      // Devolve o foco a quem abriu o diálogo. O `isConnected` cobre o caso de o botão
      // ter saído da tela enquanto o pop-up estava aberto — é o que acontece com o
      // botão do chat, que some enquanto a conversa está aberta.
      if (anterior?.isConnected) anterior.focus();
    };
  }, []);

  return painel;
}
