import { useEffect } from 'react';
import { txt } from '../lib/idioma';
import type { AvisoDeMatch as Match } from '../lib/useMatchesAoVivo';

type Props = {
  match: Match;
  onFechar: () => void;
};

/**
 * Pop-up de "Deu match!".
 *
 * Mora no `App`, e não dentro da aba Filmes, porque o aviso pode chegar com a pessoa em
 * qualquer lugar: quem curtiu primeiro só fica sabendo quando o OUTRO membro vota, e
 * nesse instante pode estar na aba Grupos, no ranking ou parada no feed.
 *
 * Foge de propósito da convenção dos outros pop-ups em um ponto: o conteúdo interno
 * **não** faz `stopPropagation`. Aqui é comemoração, não diálogo — o texto diz para
 * tocar em qualquer lugar, então tocar no meio também tem de fechar.
 */
export function AvisoDeMatch({ match, onFechar }: Props) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-6"
      role="alertdialog"
      aria-modal="true"
      onClick={onFechar}
    >
      <div className="text-center flex flex-col items-center">
        <p className="font-display text-4xl text-amber-300 mb-4">{txt.deuMatch}</p>

        {match.posterUrl && (
          <img
            src={match.posterUrl}
            alt=""
            className="w-32 rounded-xl shadow-2xl shadow-black/60 mb-4"
          />
        )}

        <p className="text-white/80">{txt.todosCurtiram(match.title)}</p>
        {/* O nome do grupo importa mais aqui do que importava antes: agora o aviso chega
            sem a pessoa ter acabado de votar, e quem está em vários grupos precisa saber
            de qual deles é o match. */}
        <p className="text-white/50 text-sm mt-1">{txt.noGrupo(match.groupName)}</p>

        <p className="text-white/40 text-sm mt-4">{txt.toqueParaContinuar}</p>
      </div>
    </div>
  );
}
