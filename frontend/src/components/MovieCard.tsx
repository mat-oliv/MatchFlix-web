import type { Movie } from '../lib/api';
import { txt } from '../lib/idioma';

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
        aria-label={txt.verDescricaoDe(movie.title)}
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
            <div className="w-full h-full flex items-center justify-center text-muted">
              {txt.semPoster}
            </div>
          )}
        </div>

        <div className="shrink-0 w-full px-4 pt-3">
          <h2 className="font-display text-lg leading-tight mb-1">{movie.title}</h2>
          <p className="text-sm text-muted line-clamp-2">{movie.overview}</p>
          <p className="text-xs text-accent2 mt-1 group-hover:brightness-110 transition">
            {txt.toqueParaDescricao}
          </p>
        </div>
      </button>

      <div className="shrink-0 flex gap-3 p-4">
        {/*
          Os dois botões têm o mesmo tamanho e estilos diferentes, que é o que
          `buttons.md › Best practices` recomenda para um par de opções: "Use style —
          not size — to visually distinguish the preferred choice". Curtir é o
          proeminente; Passar fica contornado.

          O rótulo de acessibilidade diz de QUAL filme se trata. Numa pilha de cards,
          "Curtir" sozinho não informa nada a quem não vê a tela — e o card já trocou
          quando o leitor de tela terminaria de ler a tela inteira.

          O ícone acompanha o texto em vez de substituí-lo: `accessibility.md › Vision`
          pede que nada seja transmitido só por cor, e vermelho-contra-verde é
          justamente o par que mais gente confunde.
        */}
        <button
          onClick={onDislike}
          aria-label={txt.passarFilme(movie.title)}
          className="flex-1 min-h-[52px] flex items-center justify-center gap-2 rounded-full bg-white/5 border border-rose-400/60 text-rose-300 font-medium transition hover:bg-rose-400/10 active:scale-95"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          {txt.passar}
        </button>

        <button
          onClick={onLike}
          aria-label={txt.curtirFilme(movie.title)}
          className="flex-1 min-h-[52px] flex items-center justify-center gap-2 rounded-full bg-accent2 text-ink font-semibold transition hover:brightness-110 active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
            <path d="M12 20.3l-1.3-1.2C6 14.9 3.2 12.3 3.2 9.1 3.2 6.6 5.2 4.6 7.7 4.6c1.4 0 2.8.7 3.7 1.8l.6.7.6-.7c.9-1.1 2.3-1.8 3.7-1.8 2.5 0 4.5 2 4.5 4.5 0 3.2-2.8 5.8-7.5 10l-1.3 1.2z" />
          </svg>
          {txt.curtir}
        </button>
      </div>
    </div>
  );
}
