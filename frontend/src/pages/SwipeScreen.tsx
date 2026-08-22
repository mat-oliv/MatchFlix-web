import { useCallback, useEffect, useRef, useState } from 'react';
import { getMovieFeed, sendSwipe, type Movie } from '../lib/api';
import { MovieCard } from '../components/MovieCard';
import { DetalhesFilme } from '../components/DetalhesFilme';
import { txt } from '../lib/idioma';
import type { AvisoDeMatch } from '../lib/useMatchesAoVivo';

type Props = {
  /**
   * Entrega o match que o próprio voto acabou de fechar. Quem exibe é o `App`, porque o
   * mesmo aviso também chega pelo `useMatchesAoVivo` quando quem fecha o match é outra
   * pessoa do grupo — e o pop-up tem de ser um só, com uma peneira de repetidos só.
   */
  onMatches: (matches: AvisoDeMatch[]) => void;
};

export function SwipeScreen({ onMatches }: Props) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [index, setIndex] = useState(0);
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
      setError(txt.erroCarregarFilmes);
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
      // O backend devolve o grupo; o título e o pôster vêm do card que acabou de sair
      // da tela, que já os tem — não precisa consultar a TMDB de novo por isso.
      onMatches(
        newMatches.map((m) => ({
          groupId: m.groupId,
          groupName: m.groupName,
          movieId: votado.id,
          title: votado.title,
          posterUrl: votado.posterUrl,
        }))
      );
    } catch {
      setError(txt.erroVoto(votado.title));
    }
  }

  if (!current) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-center text-white/60 px-6">
          {fimDoFeed
            ? txt.fimDoFeed
            : txt.carregandoFilmes}
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
    </div>
  );
}
