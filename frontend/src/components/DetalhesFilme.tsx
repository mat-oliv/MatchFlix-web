import { useEffect } from 'react';
import type { Movie } from '../lib/api';
import { txt } from '../lib/idioma';

type Props = {
  movie: Movie;
  onFechar: () => void;
};

/** Pop-up com a descrição completa do filme — abre ao tocar no card. */
export function DetalhesFilme({ movie, onFechar }: Props) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const ano = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;
  const nota = movie.voteAverage > 0 ? movie.voteAverage.toFixed(1) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={txt.detalhesDe(movie.title)}
      onClick={onFechar}
    >
      <div
        className="bg-panel border border-white/10 rounded-2xl w-full max-w-md max-h-full flex flex-col shadow-2xl shadow-black/50"
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
              <p className="text-sm text-white/50 mt-1">
                {[ano, nota && `★ ${nota}`].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          <button
            autoFocus
            onClick={onFechar}
            aria-label={txt.fechar}
            className="shrink-0 w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            ✕
          </button>
        </header>

        {/* A sinopse é o único trecho que pode crescer: rola aqui dentro, não na tela. */}
        <div className="p-5 overflow-y-auto">
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
            {movie.overview?.trim() || txt.semDescricao}
          </p>
        </div>
      </div>
    </div>
  );
}
