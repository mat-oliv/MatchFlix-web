import { useEffect, useState } from 'react';
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

export default function App() {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessao());
  const [tab, setTab] = useState<'swipe' | 'groups' | 'ranking'>('swipe');
  const [menuAberto, setMenuAberto] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

  return (
    // Altura travada na viewport: a aba Filmes precisa caber inteira, sem rolagem.
    <div className="h-dvh flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/10">
        <h1 className="font-display text-2xl">MovieMatch</h1>

        <nav className="flex items-center gap-2">
          <button
            onClick={() => setTab('swipe')}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              tab === 'swipe' ? 'bg-accent text-ink font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            {txt.abaFilmes}
          </button>
          <button
            onClick={() => setTab('groups')}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              tab === 'groups' ? 'bg-accent text-ink font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            {txt.abaGrupos}
          </button>
          <button
            onClick={() => setTab('ranking')}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              tab === 'ranking' ? 'bg-accent text-ink font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            {txt.abaRanking}
          </button>

          <span className="text-white/20 mx-1">|</span>
          <button
            onClick={() => setMenuAberto(true)}
            aria-haspopup="dialog"
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
          >
            {/* Mesmo lugar da foto de perfil, em miniatura — ver MenuUsuario.tsx */}
            <span
              className="w-6 h-6 rounded-full bg-white shrink-0 overflow-hidden"
              aria-hidden="true"
            >
              {avatarUrl && <img src={avatarUrl} alt="" className="w-full h-full object-cover" />}
            </span>
            <span className="max-w-[8rem] truncate">{sessao.user.username}</span>
          </button>
        </nav>
      </header>

      {/* Filmes cabe na tela; Grupos é lista e rola por conta própria. */}
      <main className={`flex-1 min-h-0 px-4 ${tab === 'swipe' ? '' : 'overflow-y-auto'}`}>
        {tab === 'swipe' && <SwipeScreen onMatches={anunciar} />}
        {tab === 'groups' && <Groups sinalDeAtualizacao={versao} />}
        {/* Monta só quando aberta: a busca do ranking mora no efeito do componente,
            então quem nunca entra aqui nunca dispara a requisição. */}
        {tab === 'ranking' && <Ranking />}
      </main>

      {aviso && <AvisoDeMatch match={aviso} onFechar={dispensar} />}

      {menuAberto && (
        <MenuUsuario
          onFechar={() => setMenuAberto(false)}
          onSair={sair}
          onFotoAtualizada={setAvatarUrl}
        />
      )}

      {/* Some enquanto a conversa está aberta: o painel nasce por cima dele, e deixá-lo
          embaixo da sobreposição só daria um botão visível que não responde ao clique. */}
      {!chatAberto && (
        <button
          onClick={() => setChatAberto(true)}
          aria-haspopup="dialog"
          aria-label={txt.abrirChat}
          title={txt.chatTitulo}
          className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full bg-accent2 text-ink grid place-items-center shadow-lg shadow-black/40 hover:brightness-110 active:scale-95 transition"
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
