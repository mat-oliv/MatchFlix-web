import { txt } from '../lib/idioma';
import { useDialogo } from '../lib/useDialogo';
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
 * **não** faz `stopPropagation`. Aqui é comemoração, não diálogo — tocar no meio do
 * pôster também fecha.
 *
 * O que mudou: tocar em qualquer lugar continua fechando, mas a frase que explicava
 * isso virou um botão de verdade. Ela era a única instrução de saída e não era
 * alcançável pelo teclado — quem não usa toque ficava com o Escape, que ninguém
 * anuncia. Um botão diz a mesma coisa, é focável e some da tela do mesmo jeito.
 */
export function AvisoDeMatch({ match, onFechar }: Props) {
  const painel = useDialogo(onFechar);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-6"
      onClick={onFechar}
    >
      <div
        ref={painel}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="match-titulo"
        className="text-center flex flex-col items-center focus:outline-none"
      >
        <p id="match-titulo" className="font-display text-4xl text-amber-300 mb-4">
          {txt.deuMatch}
        </p>

        {match.posterUrl && (
          <img
            src={match.posterUrl}
            alt=""
            className="w-32 rounded-xl shadow-2xl shadow-black/60 mb-4"
          />
        )}

        <p className="text-cream">{txt.todosCurtiram(match.title)}</p>
        {/* O nome do grupo importa mais aqui do que importava antes: agora o aviso chega
            sem a pessoa ter acabado de votar, e quem está em vários grupos precisa saber
            de qual deles é o match. */}
        <p className="text-muted text-sm mt-1">{txt.noGrupo(match.groupName)}</p>

        <button
          onClick={onFechar}
          className="mt-6 min-h-[44px] px-8 rounded-full bg-white/10 border border-edge font-semibold transition hover:bg-white/15 active:scale-95"
        >
          {txt.continuar}
        </button>
      </div>
    </div>
  );
}
