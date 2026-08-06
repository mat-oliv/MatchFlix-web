import { useState, type FormEvent } from 'react';
import { entrar, cadastrar, ApiError } from '../lib/api';
import { salvarSessao, type Sessao } from '../lib/session';
import { Aviso } from '../components/Aviso';

type Modo = 'login' | 'cadastro';

export function Auth({ onEntrar }: { onEntrar: (sessao: Sessao) => void }) {
  const [modo, setModo] = useState<Modo>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function trocarModo(novo: Modo) {
    setModo(novo);
    setPassword('');
    setConfirmPassword('');
  }

  // A validação mora no backend: uma fonte só de verdade para as mensagens,
  // e o cliente nunca é a última palavra sobre o que é válido.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;

    setEnviando(true);
    try {
      const sessao =
        modo === 'login'
          ? await entrar(username, password)
          : await cadastrar(username, password, confirmPassword);

      salvarSessao(sessao);
      onEntrar(sessao);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-full bg-white/5 border border-white/10 outline-none focus:border-accent2 transition';

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl text-center mb-1">MovieMatch</h1>
        <p className="text-center text-white/50 text-sm mb-8">
          Descubra o filme que todo mundo do grupo quer ver.
        </p>

        <div className="flex gap-1 p-1 rounded-full bg-white/5 border border-white/10 mb-6">
          {(['login', 'cadastro'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => trocarModo(m)}
              className={`flex-1 py-2 rounded-full text-sm transition ${
                modo === m ? 'bg-accent text-ink font-semibold' : 'text-white/60 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuário"
            autoComplete="username"
            autoCapitalize="none"
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            className={inputClass}
          />
          {modo === 'cadastro' && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar senha"
              autoComplete="new-password"
              className={inputClass}
            />
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 w-full py-2.5 rounded-full bg-accent2 text-ink font-semibold hover:brightness-110 transition disabled:opacity-50"
          >
            {enviando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-white/40 text-xs mt-6">
          {modo === 'login' ? (
            <>
              Não tem conta?{' '}
              <button onClick={() => trocarModo('cadastro')} className="text-accent2 hover:underline">
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button onClick={() => trocarModo('login')} className="text-accent2 hover:underline">
                Entrar
              </button>
            </>
          )}
        </p>
      </div>

      {erro && <Aviso mensagem={erro} onFechar={() => setErro(null)} />}
    </div>
  );
}
