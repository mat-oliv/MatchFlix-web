import { useState } from 'react';
import { SwipeScreen } from './pages/SwipeScreen';
import { Groups } from './pages/Groups';
import { Auth } from './pages/Auth';
import { MenuUsuario } from './components/MenuUsuario';
import { lerSessao, limparSessao, type Sessao } from './lib/session';

export default function App() {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessao());
  const [tab, setTab] = useState<'swipe' | 'groups'>('swipe');
  const [menuAberto, setMenuAberto] = useState(false);

  if (!sessao) return <Auth onEntrar={setSessao} />;

  function sair() {
    limparSessao();
    setSessao(null);
    setMenuAberto(false);
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
            Filmes
          </button>
          <button
            onClick={() => setTab('groups')}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              tab === 'groups' ? 'bg-accent text-ink font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            Grupos
          </button>

          <span className="text-white/20 mx-1">|</span>
          <button
            onClick={() => setMenuAberto(true)}
            aria-haspopup="dialog"
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
          >
            {/* Mesmo lugar da foto de perfil, em miniatura — ver MenuUsuario.tsx */}
            <span className="w-6 h-6 rounded-full bg-white shrink-0" aria-hidden="true" />
            <span className="max-w-[8rem] truncate">{sessao.user.username}</span>
          </button>
        </nav>
      </header>

      {/* Filmes cabe na tela; Grupos é lista e rola por conta própria. */}
      <main className={`flex-1 min-h-0 px-4 ${tab === 'groups' ? 'overflow-y-auto' : ''}`}>
        {tab === 'swipe' ? <SwipeScreen /> : <Groups />}
      </main>

      {menuAberto && <MenuUsuario onFechar={() => setMenuAberto(false)} onSair={sair} />}
    </div>
  );
}
