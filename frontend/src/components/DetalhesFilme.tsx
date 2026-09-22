import type { Movie } from '../lib/api';
import { txt } from '../lib/idioma';
import { useDialogo } from '../lib/useDialogo';

type Props = {
  movie: Movie;
  onFechar: () => void;
};

/** Pop-up com a descrição completa do filme — abre ao tocar no card. */
export function DetalhesFilme({ movie, onFechar }: Props) {
  // Escape, foco preso dentro do diálogo e foco devolvido ao card ao fechar.
  const painel = useDialogo(onFechar);

  const ano = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;
  const nota = movie.voteAverage > 0 ? movie.voteAverage.toFixed(1) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4 py-8"
      onClick={onFechar}
    >
      <div
        ref={painel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={txt.detalhesDe(movie.title)}
        className="bg-panel border border-white/10 rounded-2xl w-full max-w-md max-h-full flex flex-col shadow-2xl shadow-black/50 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-4 p-5 border-b border-white/10">
          {movie.posterUrl && (
            <img
              src={movie.posterUrl}
              alt=""
              className="w-16 shrink-0 aspect-[2/3] object-cover rounded-lg bg-black/30"
            />
          )}

          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-tight">{movie.title}</h2>
            {(ano || nota) && (
              <p className="text-sm text-muted mt-1">
                {[ano, nota && `★ ${nota}`].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* 44px: o ✕ tinha 32px, abaixo do alvo recomendado em
              `accessibility.md › Mobility`, e é o controle que todo mundo procura
              primeiro para sair. */}
          <button
            onClick={onFechar}
            aria-label={txt.fechar}
            className="shrink-0 w-11 h-11 grid place-items-center rounded-full text-muted transition hover:text-cream hover:bg-white/10 active:scale-95"
          >
            ✕
          </button>
        </header>

        {/* A sinopse é o único trecho que pode crescer: rola aqui dentro, não na tela. */}
        <div className="p-5 overflow-y-auto">
          <p className="text-sm text-cream/90 leading-relaxed whitespace-pre-line">
            {movie.overview?.trim() || txt.semDescricao}
          </p>
        </div>
      </div>
    </div>
  );
}
