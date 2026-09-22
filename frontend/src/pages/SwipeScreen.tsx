import { useCallback, useEffect, useRef, useState } from 'react';
import { getMovieFeed, sendSwipe, type Movie } from '../lib/api';
import { MovieCard } from '../components/MovieCard';
import { DetalhesFilme } from '../components/DetalhesFilme';
import { txt } from '../lib/idioma';
import type { AvisoDeMatch } from '../lib/useMatchesAoVivo';

/**
 * Quantas requisições seguidas sem filme novo antes de esperar um pouco.
 *
 * Cada uma varre até cinco páginas no servidor, então são até 200 filmes examinados por
 * rodada. Chegar ao fim disso significa que a pessoa já votou em tudo por uma faixa
 * enorme do catálogo — raro o bastante para valer uma pausa em vez de insistir sem parar.
 */
const MAX_VARREDURAS = 4;

/** Pausa antes de varrer de novo, quando nem isso achou filme. */
const ESPERA_NOVA_VARREDURA_MS = 3000;

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

  // Cursor devolvido pelo backend. Fica em ref porque não afeta a renderização e
  // não pode disparar novo efeito.
  const proximaPagina = useRef<number | undefined>(undefined);
  const buscando = useRef(false);
  // Retentativa agendada quando uma varredura inteira volta vazia; limpa ao desmontar.
  const reagendar = useRef<number | undefined>(undefined);

  const carregarMais = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;

    try {
      // Resposta vazia NÃO é fim de feed: quer dizer que as páginas varridas nesta
      // requisição eram só de filmes já votados. O servidor avançou o `nextPage`, então
      // insistir continua a varredura de onde ela parou, em vez de parar a tela.
      for (let tentativa = 0; tentativa < MAX_VARREDURAS; tentativa++) {
        const data = await getMovieFeed(proximaPagina.current);
        proximaPagina.current = data.nextPage;

        if (data.movies.length > 0) {
          // O backend já exclui o que foi votado, mas páginas podem se sobrepor entre
          // requisições — filtra o que já está na lista pra não repetir card.
          setMovies((prev) => {
            const conhecidos = new Set(prev.map((m) => m.id));
            return [...prev, ...data.movies.filter((m) => !conhecidos.has(m.id))];
          });
          return;
        }
      }

      // Varreu o teto e não achou nada. Em vez de anunciar fim de catálogo — que seria
      // quase sempre mentira, já que são 10 mil filmes alcançáveis —, tenta de novo
      // daqui a pouco. A tela segue no estado de carregamento.
      reagendar.current = window.setTimeout(carregarMais, ESPERA_NOVA_VARREDURA_MS);
    } catch {
      setError(txt.erroCarregarFilmes);
    } finally {
      buscando.current = false;
    }
  }, []);

  useEffect(() => () => window.clearTimeout(reagendar.current), []);

  useEffect(() => {
    carregarMais();
  }, [carregarMais]);

  const current = movies[index];

  /**
   * Fase da troca de card.
   *
   * `saindo` é o intervalo em que o filme votado ainda está na tela, encolhendo. É por
   * isso que o índice não avança mais no clique: se avançasse, o card já seria o
   * próximo filme e a animação de saída mostraria o filme errado encolhendo.
   */
  const [fase, setFase] = useState<'parado' | 'saindo'>('parado');

  /**
   * Grava o voto e anuncia o match que ele fechou.
   *
   * Separado do gesto de propósito: a requisição parte no instante do clique e corre
   * em paralelo com a animação. Animação nenhuma pode atrasar a gravação de um voto.
   */
  async function registrarVoto(votado: Movie, liked: boolean) {
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

  function handleSwipe(liked: boolean) {
    // Um segundo toque enquanto o card encolhe votaria no MESMO filme de novo: ele
    // ainda está na tela, mas já foi decidido.
    if (!current || fase === 'saindo') return;

    void registrarVoto(current, liked);
    if (index + 3 >= movies.length) carregarMais();
    setFase('saindo');
  }

  /**
   * Fim do encolhimento: aqui, e só aqui, o filme troca.
   *
   * Usar o `animationend` em vez de um `setTimeout` evita manter a duração escrita em
   * dois lugares — e faz a coisa certa sozinho quando o sistema pede menos movimento:
   * a regra do `index.css` zera a duração, o evento dispara de imediato e a troca sai
   * instantânea, sem pausa morta.
   */
  function aoTerminarAnimacao(evento: React.AnimationEvent<HTMLDivElement>) {
    if (evento.target !== evento.currentTarget) return; // animação de algum filho
    if (fase !== 'saindo') return; // foi a de entrada, que não troca nada

    setIndex((i) => i + 1);
    setFase('parado');
  }

  if (!current) {
    return (
      // `role="status"` avisa quem usa leitor de tela de que a tela está trabalhando.
      // Sem ele, o feed vazio é silêncio: nada indica se está carregando ou se quebrou.
      <div className="h-full flex flex-col items-center justify-center gap-3" role="status">
        <span
          aria-hidden="true"
          className="w-8 h-8 rounded-full border-2 border-white/15 border-t-accent2 animate-spin"
        />
        <p className="text-center text-muted px-6">{txt.carregandoFilmes}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center gap-2 py-3">
      <div className="flex-1 min-h-0 w-full flex justify-center">
        {/*
          O `key` é o que faz a entrada acontecer: ao trocar de filme o React remonta
          este nó, e animação de CSS roda sozinha no mount. Sem o `key`, só o conteúdo
          mudaria dentro do mesmo elemento e nada animaria.

          O tamanho do card não muda — quem escala é este invólucro, e só enquanto a
          animação roda. Em repouso ele fica em `scale(1)`.
        */}
        <div
          key={current.id}
          onAnimationEnd={aoTerminarAnimacao}
          className={`w-full max-w-sm h-full ${
            fase === 'saindo'
              ? // `pointer-events-none`: enquanto encolhe, o card não aceita mais toque.
                // Sem isso dava para abrir a descrição de um filme já votado.
                'animate-encolher-ao-centro pointer-events-none'
              : 'animate-surgir-do-centro'
          }`}
        >
          <MovieCard
            movie={current}
            onLike={() => handleSwipe(true)}
            onDislike={() => handleSwipe(false)}
            onAbrirDetalhes={() => setDetalhes(current)}
          />
        </div>
      </div>

      {/*
        `role="alert"` faz o leitor de tela anunciar o problema na hora. Antes era um
        parágrafo comum: a mensagem aparecia na tela e quem não a via seguia votando sem
        saber que um voto tinha falhado.
      */}
      {error && (
        <p
          role="alert"
          className="shrink-0 text-sm text-rose-300 bg-rose-500/10 border border-rose-400/40 rounded-full px-4 py-2"
        >
          {error}
        </p>
      )}

      {detalhes && <DetalhesFilme movie={detalhes} onFechar={() => setDetalhes(null)} />}
    </div>
  );
}
