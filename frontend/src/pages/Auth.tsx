import { useState, type FormEvent } from 'react';
import { entrar, cadastrar, ApiError } from '../lib/api';
import { salvarSessao, type Sessao } from '../lib/session';
import { Aviso } from '../components/Aviso';
import { CreditoTmdb } from '../components/CreditoTmdb';
import { txt } from '../lib/idioma';

type Modo = 'login' | 'cadastro';

/**
 * Espelham `USUARIO_MIN` e `SENHA_MIN` do backend, que continua sendo quem valida.
 * Aqui servem só para a dica escrita embaixo do campo: `writing.md › Writing for
 * interfaces` lembra que o melhor é ajudar a pessoa a não errar — dizer "pelo menos 6
 * caracteres" antes vale mais do que explicar o erro depois.
 */
const USUARIO_MIN = 3;
const SENHA_MIN = 6;

type Props = {
  /** `novaConta` diz se a pessoa acabou de se cadastrar — é quem ganha o tour. */
  onEntrar: (sessao: Sessao, novaConta: boolean) => void;
};

export function Auth({ onEntrar }: Props) {
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
      onEntrar(sessao, modo === 'cadastro');
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : txt.algoDeuErrado);
    } finally {
      setEnviando(false);
    }
  }

  // `border-edge` em vez de `border-white/10`: a borda é o que desenha o limite do
  // campo, e branco a 10% dá 1,35:1 contra o fundo — abaixo do mínimo de 3:1 que a
  // tabela de `accessibility.md › Vision` pede para elemento não textual. Na prática o
  // campo "sumia" e a pessoa não via onde clicar.
  const inputClass =
    'w-full px-4 min-h-[44px] rounded-full bg-white/5 border border-edge transition focus:border-accent2';

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl text-center mb-1">MovieMatch</h1>
        <p className="text-center text-muted text-sm mb-8">{txt.subtitulo}</p>

        <div className="flex gap-1 p-1 rounded-full bg-white/5 border border-white/10 mb-6">
          {(['login', 'cadastro'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => trocarModo(m)}
              // Diz ao leitor de tela qual dos dois está escolhido. Sem isso, a
              // diferença entre "Entrar" e "Cadastrar" é só a cor de fundo.
              aria-pressed={modo === m}
              className={`flex-1 min-h-[44px] rounded-full text-sm transition active:scale-95 ${
                modo === m ? 'bg-accent text-ink font-semibold' : 'text-muted hover:text-cream'
              }`}
            >
              {m === 'login' ? txt.entrar : txt.cadastrar}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/*
            Rótulo visível, e não só `placeholder`. O placeholder desaparece assim que a
            pessoa começa a digitar: quem se distrai no meio do preenchimento perde a
            referência de qual campo é qual, e quem usa leitor de tela dependia de um
            atributo que nem todos anunciam. `accessibility.md › Vision` pede que a
            informação não dependa de um único canal.
          */}
          <div>
            <label htmlFor="usuario" className="block text-sm mb-1.5">
              {txt.usuario}
            </label>
            <input
              id="usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              aria-describedby={modo === 'cadastro' ? 'dica-usuario' : undefined}
              className={inputClass}
            />
            {modo === 'cadastro' && (
              <p id="dica-usuario" className="text-xs text-faint mt-1.5 px-4">
                {txt.dicaUsuario(USUARIO_MIN)}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm mb-1.5">
              {txt.senha}
            </label>
            <input
              id="senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              aria-describedby={modo === 'cadastro' ? 'dica-senha' : undefined}
              className={inputClass}
            />
            {modo === 'cadastro' && (
              <p id="dica-senha" className="text-xs text-faint mt-1.5 px-4">
                {txt.dicaSenha(SENHA_MIN)}
              </p>
            )}
          </div>

          {modo === 'cadastro' && (
            <div>
              <label htmlFor="confirmar-senha" className="block text-sm mb-1.5">
                {txt.confirmarSenha}
              </label>
              <input
                id="confirmar-senha"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            aria-busy={enviando}
            className="mt-2 w-full min-h-[44px] rounded-full bg-accent2 text-ink font-semibold transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            {enviando ? txt.aguarde : modo === 'login' ? txt.entrar : txt.criarConta}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          {modo === 'login' ? (
            <>
              {txt.naoTemConta}{' '}
              <button
                onClick={() => trocarModo('cadastro')}
                className="min-h-[44px] px-2 text-accent2 underline underline-offset-4 hover:brightness-110"
              >
                {txt.cadastreSe}
              </button>
            </>
          ) : (
            <>
              {txt.jaTemConta}{' '}
              <button
                onClick={() => trocarModo('login')}
                className="min-h-[44px] px-2 text-accent2 underline underline-offset-4 hover:brightness-110"
              >
                {txt.entrar}
              </button>
            </>
          )}
        </p>

        <CreditoTmdb className="mt-10" />
      </div>

      {erro && <Aviso mensagem={erro} onFechar={() => setErro(null)} />}
    </div>
  );
}
