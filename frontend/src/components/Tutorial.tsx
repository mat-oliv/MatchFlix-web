import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { txt } from '../lib/idioma';

/**
 * O que o tour espera a pessoa fazer, nos passos em que ela mesma age.
 *
 * Nesses passos não há botão "Próximo": o tour avança sozinho quando a ação acontece de
 * verdade no app. É o que faz dele um tutorial interativo, e não uma apresentação — o
 * grupo criado aqui é um grupo de verdade, e o voto também.
 */
type Espera = 'aba-grupos' | 'grupo-criado' | 'aba-filmes' | 'voto';

type Passo = {
  /** Valor do `data-tour` do elemento destacado. Sem alvo, o balão fica no centro. */
  alvo?: string;
  titulo: string;
  texto: string;
  espera?: Espera;
};

const PASSOS: Passo[] = [
  { titulo: txt.tutBoasVindasTitulo, texto: txt.tutBoasVindas },
  { alvo: 'aba-groups', titulo: txt.tutAbaGruposTitulo, texto: txt.tutAbaGrupos, espera: 'aba-grupos' },
  { alvo: 'criar-grupo', titulo: txt.tutCriarTitulo, texto: txt.tutCriar, espera: 'grupo-criado' },
  { alvo: 'grupo-matches', titulo: txt.tutMatchesTitulo, texto: txt.tutMatches },
  { alvo: 'grupo-convite', titulo: txt.tutConviteTitulo, texto: txt.tutConvite },
  { alvo: 'grupo-membros', titulo: txt.tutMembrosTitulo, texto: txt.tutMembros },
  { alvo: 'entrar-em-grupo', titulo: txt.tutEntrarTitulo, texto: txt.tutEntrar },
  { alvo: 'aba-swipe', titulo: txt.tutAbaFilmesTitulo, texto: txt.tutAbaFilmes, espera: 'aba-filmes' },
  { alvo: 'card-filme', titulo: txt.tutCardTitulo, texto: txt.tutCard, espera: 'voto' },
  // Sem alvo, no centro: é a regra do app inteiro, não um elemento da tela.
  { titulo: txt.tutComoMatchTitulo, texto: txt.tutComoMatch },
  { alvo: 'botao-chat', titulo: txt.tutFimTitulo, texto: txt.tutFim },
];

/** Folga em volta do elemento destacado, para o contorno não encostar nele. */
const FOLGA = 8;
/** Margem mínima entre o balão e a borda da tela — a mesma do resto do app no celular. */
const MARGEM = 16;
/** Altura que o balão precisa para caber acima ou abaixo do alvo. */
const ALTURA_BALAO = 210;

type Props = {
  /** Aba aberta no momento — é por ela que o tour sabe que a pessoa trocou de aba. */
  tab: string;
  /** Id do grupo criado durante o tour; `null` enquanto não houver. */
  grupoCriado: string | null;
  /** Quantos votos a pessoa deu desde que o app abriu. Só a diferença importa. */
  votos: number;
  /** Avisa qual elemento está em destaque, para o App decidir o que mostrar por baixo. */
  onMudarAlvo: (alvo: string | null) => void;
  onFim: () => void;
};

type Caixa = { top: number; left: number; width: number; height: number };

/**
 * Acha o alvo visível. As abas existem duas vezes (cabeçalho a partir de `sm`, barra de
 * baixo no celular) e a escondida continua no DOM com tamanho zero — destacar a primeira
 * que aparecer na busca apontaria para o nada em metade das telas.
 */
function acharAlvo(nome: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${nome}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function mesmaCaixa(a: Caixa | null, b: Caixa | null) {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/**
 * Tour de boas-vindas, mostrado uma vez só, logo depois do cadastro.
 *
 * Não é uma tela à parte: é uma camada por cima do app de verdade, que escurece tudo
 * menos o elemento da vez. O buraco no escuro deixa o toque passar — é por ele que a
 * pessoa cria o grupo e vota —, e o resto da tela fica bloqueado para ela não se perder
 * no meio do caminho.
 *
 * Fica em `z-[45]`: acima do botão do chat (`z-40`) e ABAIXO dos pop-ups (`z-50`). Assim
 * a descrição do filme, a lista de membros e o aviso de match abrem por cima do tour e
 * funcionam normalmente, em vez de nascerem escondidos debaixo do escuro.
 */
export function Tutorial({ tab, grupoCriado, votos, onMudarAlvo, onFim }: Props) {
  const [indice, setIndice] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [tela, setTela] = useState({ largura: window.innerWidth, altura: window.innerHeight });

  const passo = PASSOS[indice];
  const ultimo = indice === PASSOS.length - 1;

  // Votos que já existiam quando o passo do card começou: só um voto NOVO avança.
  const votosNoInicio = useRef(votos);
  const botaoPrincipal = useRef<HTMLButtonElement>(null);

  function avancar() {
    if (ultimo) {
      onFim();
      return;
    }
    votosNoInicio.current = votos;
    setIndice((i) => i + 1);
  }

  // Passos interativos: avança quando o app conta que a ação aconteceu.
  useEffect(() => {
    const feito =
      (passo.espera === 'aba-grupos' && tab === 'groups') ||
      (passo.espera === 'aba-filmes' && tab === 'swipe') ||
      (passo.espera === 'grupo-criado' && grupoCriado !== null) ||
      (passo.espera === 'voto' && votos > votosNoInicio.current);

    // `avancar` fica fora das dependências: é recriada a cada render e não é o gatilho —
    // os sinais do app é que são.
    if (feito) avancar();
  }, [passo, tab, grupoCriado, votos]);

  /*
   * Acompanha o alvo quadro a quadro.
   *
   * Um cálculo só, na troca de passo, não basta: a lista de grupos chega do servidor
   * depois, o card do filme anima ao entrar e a aba Grupos rola até o alvo. Medir a cada
   * quadro cobre tudo isso sem precisar ouvir cada evento, e o estado só muda quando a
   * caixa muda de fato — parado, não re-renderiza nada.
   */
  useEffect(() => {
    const nome = passo.alvo;
    if (!nome) {
      setCaixa(null);
      return;
    }

    let quadro = 0;
    let achou = false;

    const medir = () => {
      const el = acharAlvo(nome);

      if (el && !achou) {
        achou = true;
        const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ block: 'center', behavior: reduzir ? 'auto' : 'smooth' });

        // Quem navega pelo teclado cai direto no que tem de usar: o campo do nome do
        // grupo, a aba a tocar. Nos passos só de leitura o foco fica no balão.
        if (passo.espera) {
          const focavel = el.matches('button, input')
            ? el
            : el.querySelector<HTMLElement>('input, button');
          focavel?.focus({ preventScroll: true });
        }
      }

      const r = el?.getBoundingClientRect();
      const nova = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setCaixa((antiga) => (mesmaCaixa(antiga, nova) ? antiga : nova));
      setTela((t) =>
        t.largura === window.innerWidth && t.altura === window.innerHeight
          ? t
          : { largura: window.innerWidth, altura: window.innerHeight }
      );

      quadro = requestAnimationFrame(medir);
    };

    medir();
    return () => cancelAnimationFrame(quadro);
  }, [passo]);

  useEffect(() => {
    if (!passo.espera) botaoPrincipal.current?.focus({ preventScroll: true });
    onMudarAlvo(passo.alvo ?? null);
  }, [passo, onMudarAlvo]);

  // Escape encerra o tour, como fecha qualquer pop-up do app. Mas se houver um pop-up de
  // verdade aberto por cima (descrição do filme, membros), o Escape é dele.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return;
      if (document.querySelector('[aria-modal="true"]')) return;
      onFim();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFim]);

  const buraco = caixa && {
    top: caixa.top - FOLGA,
    left: caixa.left - FOLGA,
    width: caixa.width + FOLGA * 2,
    height: caixa.height + FOLGA * 2,
  };

  const largura = Math.min(320, tela.largura - MARGEM * 2);
  const estiloBalao = posicionarBalao(buraco, largura, tela.largura, tela.altura);

  return (
    // A camada de fora não recebe toque — senão ela mesma cobriria o buraco. Quem bloqueia
    // são as faixas e o fundo escuro, e quem responde é o balão.
    <div className="fixed inset-0 z-[45] pointer-events-none">
      {buraco ? (
        <>
          {/*
            Quatro faixas transparentes em volta do buraco engolem o toque fora dele. O
            escuro vem da sombra do contorno, que não recebe toque: é o que deixa o
            elemento destacado clicável sem deixar o resto da tela clicável também.
          */}
          <div className="fixed left-0 right-0 top-0 pointer-events-auto" style={{ height: Math.max(0, buraco.top) }} />
          <div className="fixed left-0 right-0 bottom-0 pointer-events-auto" style={{ top: buraco.top + buraco.height }} />
          <div
            className="fixed left-0 pointer-events-auto"
            style={{ top: buraco.top, height: buraco.height, width: Math.max(0, buraco.left) }}
          />
          <div
            className="fixed right-0 pointer-events-auto"
            style={{ top: buraco.top, height: buraco.height, left: buraco.left + buraco.width }}
          />

          <div
            aria-hidden="true"
            className="fixed rounded-2xl ring-2 ring-accent2 pointer-events-none transition-all duration-200 motion-reduce:transition-none"
            style={{ ...buraco, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)' }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/70 pointer-events-auto" />
      )}

      <div
        role="dialog"
        aria-labelledby="tutorial-titulo"
        aria-describedby="tutorial-texto"
        className="fixed bg-panel border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/50 pointer-events-auto"
        style={{ ...estiloBalao, width: largura }}
      >
        <p className="text-xs text-faint mb-1">{txt.tutPasso(indice + 1, PASSOS.length)}</p>
        <h2 id="tutorial-titulo" className="font-display text-xl leading-tight mb-2">
          {passo.titulo}
        </h2>
        {/* `aria-live` para quem usa leitor de tela: nos passos interativos o balão
            troca sozinho, sem o foco passar por ele. */}
        <p id="tutorial-texto" aria-live="polite" className="text-sm text-cream/90 mb-4">
          {passo.texto}
        </p>

        <div className="flex items-center justify-between gap-3">
          {!ultimo ? (
            <button
              onClick={onFim}
              className="min-h-[44px] px-2 text-sm text-muted hover:text-cream transition"
            >
              {txt.tutPular}
            </button>
          ) : (
            <span />
          )}

          {/* Nos passos interativos não há "Próximo": quem avança é a própria ação. */}
          {!passo.espera && (
            <button
              ref={botaoPrincipal}
              onClick={avancar}
              className="min-h-[44px] px-5 rounded-full bg-accent2 text-ink font-semibold transition hover:brightness-110 active:scale-[0.98]"
            >
              {indice === 0 ? txt.tutComecar : ultimo ? txt.tutConcluir : txt.tutProximo}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Onde o balão fica: abaixo do alvo se couber, senão acima, senão ao lado (o card do
 * filme ocupa a altura toda da tela) e, em último caso, por cima do alto do próprio alvo
 * — no celular o card não deixa sobra nenhuma, e ali o balão cobre só o topo do pôster,
 * longe dos botões de votar.
 */
function posicionarBalao(
  buraco: Caixa | null,
  largura: number,
  larguraTela: number,
  alturaTela: number
): CSSProperties {
  if (!buraco) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const centralizado = buraco.left + buraco.width / 2 - largura / 2;
  const left = Math.min(Math.max(centralizado, MARGEM), larguraTela - largura - MARGEM);
  const baixo = buraco.top + buraco.height;

  if (alturaTela - baixo >= ALTURA_BALAO) return { top: baixo + 12, left };
  if (buraco.top >= ALTURA_BALAO) return { bottom: alturaTela - buraco.top + 12, left };

  const topoAoLado = Math.max(buraco.top, MARGEM);
  if (larguraTela - (buraco.left + buraco.width) >= largura + MARGEM + 12) {
    return { top: topoAoLado, left: buraco.left + buraco.width + 12 };
  }
  if (buraco.left >= largura + MARGEM + 12) {
    return { top: topoAoLado, left: buraco.left - largura - 12 };
  }

  return { top: Math.max(buraco.top + 12, MARGEM), left };
}
