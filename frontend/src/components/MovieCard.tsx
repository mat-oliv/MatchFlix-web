import type { Movie } from '../lib/api';

type Props = {
  movie: Movie;
  onLike: () => void;
  onDislike: () => void;
  onAbrirDetalhes: () => void;
};

export function MovieCard({ movie, onLike, onDislike, onAbrirDetalhes }: Props) {
  return (
    <div className="relative w-full max-w-sm h-full flex flex-col rounded-3xl overflow-hidden bg-panel shadow-2xl shadow-black/40">
      {/*
        Pôster e texto ficam dentro de um <button> para abrir o pop-up de descrição
        também pelo teclado. Passar/Curtir ficam de fora, senão um toque nos botões
        abriria o pop-up junto.
      */}
      <button
        type="button"
        onClick={onAbrirDetalhes}
        aria-haspopup="dialog"
        aria-label={`Ver descrição completa de ${movie.title}`}
        className="group flex-1 min-h-0 flex flex-col text-left"
      >
        {/* Sem aspect-ratio fixo: o pôster ocupa a altura que sobra, pra tela nunca rolar. */}
        <div className="flex-1 min-h-0 w-full bg-black/30">
          {movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="w-full h-full object-cover transition group-hover:brightness-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              Sem pôster
            </div>
          )}
        </div>

        <div className="shrink-0 w-full px-4 pt-3">
          <h2 className="font-display text-lg leading-tight mb-1">{movie.title}</h2>
          <p className="text-sm text-white/60 line-clamp-2">{movie.overview}</p>
          <p className="text-xs text-accent2/70 mt-1 group-hover:text-accent2 transition">
            Toque para ver a descrição completa
          </p>
        </div>
      </button>

      <div className="shrink-0 flex gap-3 p-4">
        <button
          onClick={onDislike}
          className="flex-1 py-2.5 rounded-full bg-white/5 border border-rose-400/40 text-rose-300 font-medium hover:bg-rose-400/10 transition"
        >
          Passar
        </button>
        <button
          onClick={onLike}
          className="flex-1 py-2.5 rounded-full bg-accent2 text-ink font-semibold hover:brightness-110 transition"
        >
          Curtir
        </button>
      </div>
    </div>
  );
}
