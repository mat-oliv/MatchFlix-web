import { useCallback, useEffect, useRef, useState } from 'react';
import { getMovieFeed, sendSwipe, type Movie } from '../lib/api';
import { MovieCard } from '../components/MovieCard';
import { DetalhesFilme } from '../components/DetalhesFilme';

export function SwipeScreen() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [index, setIndex] = useState(0);
  const [matchMovie, setMatchMovie] = useState<Movie | null>(null);
  // Guarda o filme inteiro, não um booleano: assim o pop-up mostra o que foi aberto
  // mesmo que o card debaixo mude.
  const [detalhes, setDetalhes] = useState<Movie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fimDoFeed, setFimDoFeed] = useState(false);

  // Cursor devolvido pelo backend. Fica em ref porque não afeta a renderização e
  // não pode disparar novo efeito.
  const proximaPagina = useRef<number | undefined>(undefined);
  const buscando = useRef(false);

  const carregarMais = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;

    try {
      const data = await getMovieFeed(proximaPagina.current);
      proximaPagina.current = data.nextPage;

      if (data.movies.length === 0) {
        setFimDoFeed(true);
        return;
      }

      // O backend já exclui o que foi votado, mas páginas podem se sobrepor entre
      // requisições — filtra o que já está na lista pra não repetir card.
      setMovies((prev) => {
        const conhecidos = new Set(prev.map((m) => m.id));
        return [...prev, ...data.movies.filter((m) => !conhecidos.has(m.id))];
      });
    } catch {
      setError('Não foi possível carregar os filmes.');
    } finally {
      buscando.current = false;
    }
  }, []);

  useEffect(() => {
    carregarMais();
  }, [carregarMais]);

  const current = movies[index];

  async function handleSwipe(liked: boolean) {
    if (!current) return;
    const votado = current;

    // Avança o card na hora: registrar o swipe é assíncrono e não pode travar a
    // navegação se a requisição falhar.
    setIndex((i) => i + 1);
    if (index + 3 >= movies.length) carregarMais();
    setError(null);

    try {
      const { newMatches } = await sendSwipe(votado.id, liked);
      if (newMatches.length > 0) setMatchMovie(votado);
    } catch {
      setError(`Não foi possível registrar seu voto em "${votado.title}".`);
    }
  }

  if (!current) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-center text-white/60 px-6">
          {fimDoFeed
            ? 'Você já votou em tudo por aqui! Volte mais tarde para novidades.'
            : 'Carregando filmes...'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center gap-2 py-3">
      <div className="flex-1 min-h-0 w-full flex justify-center">
        <MovieCard
          movie={current}
          onLike={() => handleSwipe(true)}
          onDislike={() => handleSwipe(false)}
          onAbrirDetalhes={() => setDetalhes(current)}
        />
      </div>

      {error && (
        <p className="shrink-0 text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-full px-4 py-1.5">
          {error}
        </p>
      )}

      {detalhes && <DetalhesFilme movie={detalhes} onFechar={() => setDetalhes(null)} />}

      {matchMovie && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setMatchMovie(null)}
        >
          <div className="text-center px-6">
            <p className="font-display text-4xl text-amber-300 mb-2">Deu match! 🎬</p>
            <p className="text-white/80">Todo mundo do grupo curtiu "{matchMovie.title}"</p>
            <p className="text-white/40 text-sm mt-4">Toque em qualquer lugar para continuar</p>
          </div>
        </div>
      )}
    </div>
  );
}
