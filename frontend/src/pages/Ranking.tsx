import { useEffect, useState } from 'react';
import { getRanking, ApiError, type FilmeDoRanking } from '../lib/api';
import { txt } from '../lib/idioma';

/**
 * Ranking global dos filmes mais curtidos da semana.
 *
 * Busca só quando a aba é aberta, nunca na subida do app: quem nunca entra aqui não paga
 * nada por ela. O resultado já vem pronto e guardado no servidor por alguns minutos, então
 * reabrir a aba custa uma requisição sem consulta ao banco nem chamada à TMDB.
 */
export function Ranking() {
  const [filmes, setFilmes] = useState<FilmeDoRanking[] | null>(null);
  const [dias, setDias] = useState(7);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    // Sem try/catch a rejeição some e a tela fica em "carregando" para sempre.
    (async () => {
      try {
        const dados = await getRanking();
        if (cancelado) return;
        setFilmes(dados.movies);
        setDias(dados.days);
      } catch (err) {
        if (!cancelado) setErro(err instanceof ApiError ? err.message : txt.rankingErro);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="max-w-lg mx-auto py-10">
      <h2 className="font-display text-lg">{txt.rankingTitulo}</h2>
      <p className="text-sm text-white/40 mb-6">{txt.rankingSubtitulo(dias)}</p>

      {erro ? (
        <p className="text-sm text-rose-300">{erro}</p>
      ) : filmes === null ? (
        <p className="text-sm text-white/40">{txt.carregando}</p>
      ) : filmes.length === 0 ? (
        <p className="text-sm text-white/40">{txt.rankingVazio}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {filmes.map((filme, posicao) => (
            <li
              key={filme.movieId}
              className="flex items-center gap-4 rounded-2xl bg-panel border border-white/10 p-3"
            >
              {/* Tabular-nums para os números não dançarem de linha em linha. */}
              <span className="w-7 shrink-0 text-center font-display text-lg tabular-nums text-white/40">
                {posicao + 1}
              </span>

              <div className="w-10 shrink-0 aspect-[2/3] rounded overflow-hidden bg-black/30">
                {filme.posterUrl && (
                  <img
                    src={filme.posterUrl}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <p className="min-w-0 flex-1 text-sm leading-tight line-clamp-2">{filme.title}</p>

              <p className="shrink-0 text-sm text-accent2 tabular-nums">
                {filme.likeCount}{' '}
                <span className="text-white/40">{txt.curtidas(filme.likeCount)}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
