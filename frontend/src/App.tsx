import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SwipeScreen } from './pages/SwipeScreen';
import { Groups } from './pages/Groups';
import { Ranking } from './pages/Ranking';
import { Auth } from './pages/Auth';
import { MenuUsuario } from './components/MenuUsuario';
import { ChatDuvidas } from './components/ChatDuvidas';
import { AvisoDeMatch } from './components/AvisoDeMatch';
import { useMatchesAoVivo } from './lib/useMatchesAoVivo';
import { txt } from './lib/idioma';
import { getMeuPerfil } from './lib/api';
import { lerSessao, limparSessao, type Sessao } from './lib/session';

type Aba = 'swipe' | 'groups' | 'ranking';

/**
 * As três abas, numa lista só.
 *
 * A mesma lista desenha a navegação em dois lugares: a barra de baixo no celular e a
 * fileira do cabeçalho a partir de `sm`. Duplicar os botões seria o caminho curto para
 * uma aba existir num tamanho de tela e não no outro.
 */
const ABAS: { id: Aba; rotulo: string; icone: ReactNode }[] = [
  { id: 'swipe', rotulo: txt.abaFilmes, icone: <IconeFilmes /> },
  { id: 'groups', rotulo: txt.abaGrupos, icone: <IconeGrupos /> },
  { id: 'ranking', rotulo: txt.abaRanking, icone: <IconeRanking /> },
];

export default function App() {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessao());
  const [tab, setTab] = useState<Aba>('swipe');
  const [menuAberto, setMenuAberto] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  /*
   * Devolve o foco ao botão do chat quando a conversa fecha.
   *
   * Os outros pop-ups resolvem isso sozinhos pelo `useDialogo`, que guarda o elemento
   * focado e o refoca ao desmontar. Com o chat não dá: o botão redondo é desmontado
   * enquanto o painel está aberto (ele nasceria por baixo da sobreposição), então o
   * elemento guardado já não existe na hora de devolver o foco — e o foco caía no nada,
   * jogando o Tab seguinte para o começo da página.
   */
  const botaoChat = useRef<HTMLButtonElement>(null);
  const chatEstavaAberto = useRef(false);

  useEffect(() => {
    if (chatEstavaAberto.current && !chatAberto) botaoChat.current?.focus();
    chatEstavaAberto.current = chatAberto;
  }, [chatAberto]);

  // Precisa ficar aqui em cima, e não na aba Filmes: quem curtiu primeiro só descobre o
  // match quando o outro membro vota, e nesse momento pode estar em qualquer aba.
  const { aviso, dispensar, anunciar, versao } = useMatchesAoVivo(sessao?.user.id ?? null);

  // A miniatura do cabeçalho é a mesma foto do menu, mas o cabeçalho aparece antes de
  // o menu ser aberto alguma vez — por isso o App busca o perfil por conta própria.
  // Falhar aqui não interrompe nada: fica o círculo branco, como antes da foto existir.
  useEffect(() => {
    if (!sessao) return;

    let cancelado = false;
    getMeuPerfil()
      .then((perfil) => !cancelado && setAvatarUrl(perfil.user.avatarUrl))
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [sessao]);

  if (!sessao) return <Auth onEntrar={setSessao} />;

  function sair() {
    limparSessao();
    setSessao(null);
    setMenuAberto(false);
    // Sem isso a foto de quem saiu apareceria pro próximo login, até o perfil carregar.
    setAvatarUrl(null);
  }

  /**
   * Um botão de aba. `aria-current` é o que diz ao leitor de tela em qual seção a
   * pessoa está — a cor de fundo sozinha não conta essa história para quem não a vê.
   */
  function BotaoDeAba({ aba, comIcone }: { aba: (typeof ABAS)[number]; comIcone: boolean }) {
    const ativa = tab === aba.id;

    return (
      <button
        onClick={() => setTab(aba.id)}
        aria-current={ativa ? 'page' : undefined}
        className={
          comIcone
            ? // Barra de baixo: alvo alto e largo, ícone sobre o rótulo.
              `flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition active:scale-95 ${
                ativa ? 'text-accent' : 'text-muted hover:text-cream'
              }`
            : // Cabeçalho, a partir de sm: pílula com 44px de altura.
              `px-4 min-h-[44px] rounded-full text-sm transition active:scale-95 ${
                ativa ? 'bg-accent text-ink font-semibold' : 'text-muted hover:text-cream'
              }`
        }
      >
        {comIcone && aba.icone}
        {aba.rotulo}
      </button>
    );
  }

  return (
    // Altura travada na viewport: a aba Filmes precisa caber inteira, sem rolagem.
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Primeiro alvo do Tab: pula o cabeçalho inteiro e cai no conteúdo. Fica
          invisível até receber foco. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-full focus:bg-accent2 focus:px-4 focus:py-2 focus:font-semibold focus:text-ink"
      >
        {txt.irParaConteudo}
      </a>

      <header className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10">
        <h1 className="font-display text-2xl">MovieMatch</h1>

        <div className="flex items-center gap-2">
          {/* No celular esta fileira some: as abas moram na barra de baixo, ao alcance
              do polegar. Ver a <nav> no rodapé. */}
          <nav aria-label={txt.navegacaoPrincipal} className="hidden sm:flex items-center gap-2">
            {ABAS.map((aba) => (
              <BotaoDeAba key={aba.id} aba={aba} comIcone={false} />
            ))}
          </nav>

          <span aria-hidden="true" className="hidden sm:block text-white/20 mx-1">
            |
          </span>

          <button
            onClick={() => setMenuAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={menuAberto}
            aria-label={`${txt.suaConta}: ${sessao.user.username}`}
            className="flex items-center gap-2 min-h-[44px] pl-1 pr-3 rounded-full text-sm text-muted hover:text-cream hover:bg-white/5 transition"
          >
            {/* Mesmo lugar da foto de perfil, em miniatura — ver MenuUsuario.tsx */}
            <span
              className="w-8 h-8 rounded-full bg-white shrink-0 overflow-hidden"
              aria-hidden="true"
            >
              {avatarUrl && <img src={avatarUrl} alt="" className="w-full h-full object-cover" />}
            </span>
            <span aria-hidden="true" className="max-w-[8rem] truncate">
              {sessao.user.username}
            </span>
          </button>
        </div>
      </header>

      {/* Filmes cabe na tela; Grupos é lista e rola por conta própria. */}
      <main
        id="conteudo"
        tabIndex={-1}
        className={`flex-1 min-h-0 px-4 focus:outline-none ${tab === 'swipe' ? '' : 'overflow-y-auto'}`}
      >
        {tab === 'swipe' && <SwipeScreen onMatches={anunciar} />}
        {tab === 'groups' && <Groups sinalDeAtualizacao={versao} />}
        {/* Monta só quando aberta: a busca do ranking mora no efeito do componente,
            então quem nunca entra aqui nunca dispara a requisição. */}
        {tab === 'ranking' && <Ranking />}
      </main>

      {/*
        Navegação de baixo, só no celular.
        `layout.md › Best practices` manda ordenar por importância e, na tradução para
        toque (`cross-platform.md › Conventions to check`), a navegação principal do
        celular é uma barra de baixo: é a faixa que o polegar alcança sem trocar a mão
        de posição. No cabeçalho, as abas ficavam justamente no canto mais distante —
        e num app cujo gesto central é votar com o polegar isso custa a cada toque.
        `pb-[env(...)]` mantém os botões acima da barra de gestos do iPhone.
      */}
      <nav
        aria-label={txt.navegacaoPrincipal}
        className="sm:hidden shrink-0 flex items-stretch gap-1 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-ink"
      >
        {ABAS.map((aba) => (
          <BotaoDeAba key={aba.id} aba={aba} comIcone />
        ))}
      </nav>

      {aviso && <AvisoDeMatch match={aviso} onFechar={dispensar} />}

      {menuAberto && (
        <MenuUsuario
          onFechar={() => setMenuAberto(false)}
          onSair={sair}
          onFotoAtualizada={setAvatarUrl}
        />
      )}

      {/* Some enquanto a conversa está aberta: o painel nasce por cima dele, e deixá-lo
          embaixo da sobreposição só daria um botão visível que não responde ao clique.
          No celular sobe acima da barra de abas, que ocupa a faixa de baixo. */}
      {!chatAberto && (
        <button
          ref={botaoChat}
          onClick={() => setChatAberto(true)}
          aria-haspopup="dialog"
          aria-label={txt.abrirChat}
          title={txt.chatTitulo}
          className="fixed bottom-24 sm:bottom-6 left-4 sm:left-6 z-40 w-14 h-14 rounded-full bg-accent2 text-ink grid place-items-center shadow-lg shadow-black/40 hover:brightness-110 active:scale-95 transition"
        >
          {/* Balão de conversa em traço: a versão preenchida vira um borrão nesse tamanho. */}
          <svg
            viewBox="0 0 24 24"
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.5 11.7c0 4.2-3.8 7.6-8.5 7.6-1.1 0-2.2-.2-3.2-.5L3.5 20.5l1.8-4.4c-1.1-1.2-1.8-2.7-1.8-4.4 0-4.2 3.8-7.6 8.5-7.6s8.5 3.4 8.5 7.6z" />
          </svg>
        </button>
      )}

      {chatAberto && <ChatDuvidas onFechar={() => setChatAberto(false)} />}
    </div>
  );
}

/*
 * Ícones das abas — mesmo traço (2px, pontas arredondadas) do balão do chat, para
 * formarem um conjunto só. `typography.md` pede que o ícone acompanhe o peso do texto
 * ao lado; em traço fino eles sumiriam ao lado do rótulo em negrito da aba ativa.
 */
function IconeFilmes() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M8 4v16M16 4v16M3 12h18" />
    </svg>
  );
}

function IconeGrupos() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      <path d="M16.5 5.2a3.2 3.2 0 010 5.9M18 14.6c2 .7 3.3 2.2 3.3 4.4" />
    </svg>
  );
}

function IconeRanking() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21V11M12 21V4M19 21v-6" />
    </svg>
  );
}
