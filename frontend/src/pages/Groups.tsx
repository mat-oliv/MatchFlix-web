import { useCallback, useEffect, useState } from 'react';
import { createGroup, joinGroup, getMeusGrupos, ApiError, type UserGroup } from '../lib/api';
import { MembrosDoGrupo } from '../components/MembrosDoGrupo';
import { txt } from '../lib/idioma';

function mensagemDoErro(err: unknown, padrao: string) {
  return err instanceof ApiError ? err.message : padrao;
}

type Props = {
  /**
   * Sobe a cada match novo detectado pelo `useMatchesAoVivo`. Serve só de gatilho: a
   * contagem e a fileira de pôsteres se refazem sem a pessoa precisar sair da aba e
   * voltar, que era a única forma de ver um match fechado por outro membro.
   */
  sinalDeAtualizacao: number;
  /** Avisa o tour de boas-vindas que um grupo foi criado — já com a lista recarregada. */
  onGrupoCriado?: (grupoId: string) => void;
  /**
   * Grupo que o tour está apresentando. Só ele ganha os `data-tour` de matches, convite
   * e membros: com vários grupos na lista, o tour apontaria para o primeiro que achasse.
   */
  grupoDoTour?: string | null;
};

// Mesma razão do formulário de entrada: `border-white/10` dava 1,35:1 contra o fundo e
// o campo não tinha limite visível. Ver `Auth.tsx`.
const CAMPO =
  'w-full px-4 min-h-[44px] rounded-full bg-white/5 border border-edge mb-2 transition focus:border-accent2';

export function Groups({ sinalDeAtualizacao, onGrupoCriado, grupoDoTour }: Props) {
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [grupos, setGrupos] = useState<UserGroup[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);
  // Grupo cuja janela de membros está aberta. Guarda o grupo inteiro, e não só o id,
  // porque o pop-up mostra nome e contagem antes de a lista chegar do servidor.
  const [grupoDosMembros, setGrupoDosMembros] = useState<UserGroup | null>(null);

  const carregarGrupos = useCallback(async () => {
    try {
      setGrupos(await getMeusGrupos());
      setError('');
    } catch (err) {
      setError(mensagemDoErro(err, txt.erroCarregarGrupos));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarGrupos();
  }, [carregarGrupos, sinalDeAtualizacao]);

  async function handleCreate() {
    if (!groupName.trim()) return;
    setError('');
    try {
      const group = await createGroup(groupName.trim());
      setMessage(txt.grupoCriado(group.name));
      setGroupName('');
      await carregarGrupos();
      // Depois da lista, não antes: o tour aponta em seguida para o card deste grupo,
      // que precisa já estar na tela.
      onGrupoCriado?.(group.id);
    } catch (err) {
      setError(mensagemDoErro(err, txt.erroCriarGrupo));
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setError('');
    try {
      const group = await joinGroup(inviteCode.trim());
      setMessage(txt.entrouNoGrupo(group.name));
      setInviteCode('');
      await carregarGrupos();
    } catch (err) {
      setError(mensagemDoErro(err, txt.erroConvite));
    }
  }

  async function copiarConvite(inviteCode: string) {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiado(inviteCode);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError(txt.erroCopiar);
    }
  }

  return (
    <div className="max-w-lg mx-auto py-10 flex flex-col gap-10">
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="flex-1" data-tour="criar-grupo">
          {/* O <h2> vira o rótulo do campo: é a mesma frase, e repeti-la logo abaixo
              seria ruído para quem usa leitor de tela. */}
          <label htmlFor="nome-do-grupo" className="block font-display text-lg mb-2">
            {txt.criarGrupo}
          </label>
          <input
            id="nome-do-grupo"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={txt.nomeDoGrupo}
            className={CAMPO}
          />
          <button
            onClick={handleCreate}
            className="w-full min-h-[44px] rounded-full bg-accent2 text-ink font-semibold transition hover:brightness-110 active:scale-[0.98]"
          >
            {txt.criar}
          </button>
        </div>

        <div className="flex-1" data-tour="entrar-em-grupo">
          <label htmlFor="codigo-de-convite" className="block font-display text-lg mb-2">
            {txt.entrarEmGrupo}
          </label>
          <input
            id="codigo-de-convite"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder={txt.codigoConvite}
            autoCapitalize="none"
            autoCorrect="off"
            className={CAMPO}
          />
          <button
            onClick={handleJoin}
            className="w-full min-h-[44px] rounded-full bg-white/10 border border-edge font-semibold transition hover:bg-white/15 active:scale-[0.98]"
          >
            {txt.entrarNoGrupo}
          </button>
        </div>
      </div>

      {/*
        As duas confirmações aparecem longe do botão que as causou e sumiam em silêncio
        para quem não vê a tela. `role="status"` anuncia o sucesso sem interromper;
        `role="alert"` interrompe, que é o certo para erro.
      */}
      {message && (
        <p role="status" className="text-center text-accent2 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-center text-rose-300 text-sm">
          {error}
        </p>
      )}

      <section>
        <h2 className="font-display text-lg mb-4">{txt.meusGrupos}</h2>

        {carregando ? (
          <p role="status" className="text-muted text-sm">
            {txt.carregando}
          </p>
        ) : grupos.length === 0 ? (
          <p className="text-muted text-sm">{txt.semGrupos}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grupos.map((grupo) => {
              const tour = (nome: string) => (grupo.id === grupoDoTour ? nome : undefined);

              return (
                <article key={grupo.id} className="rounded-2xl bg-panel border border-white/10 p-5">
                  <header className="flex items-baseline justify-between gap-3 mb-3">
                    <h3 className="font-display text-xl">{grupo.name}</h3>
                    <p className="text-sm text-muted shrink-0">
                      {/* A contagem de membros abre a janela com a foto e o nome de cada um.
                          Sublinhado pontilhado porque, sem ele, ninguém adivinha que dá
                          pra clicar num texto no meio do cabeçalho. */}
                      <button
                        data-tour={tour('grupo-membros')}
                        onClick={() => setGrupoDosMembros(grupo)}
                        aria-haspopup="dialog"
                        aria-label={txt.verMembros(grupo.name)}
                        className="min-h-[44px] px-1 underline decoration-dotted underline-offset-4 hover:text-cream transition"
                      >
                        {grupo.memberCount} {txt.membros(grupo.memberCount)}
                      </button>{' '}
                      · {grupo.matchCount} {txt.partidas(grupo.matchCount)}
                    </p>
                  </header>

                  <div className="flex items-center gap-2 mb-4" data-tour={tour('grupo-convite')}>
                    <span className="text-xs text-faint shrink-0">{txt.convite}</span>
                    <code className="font-mono tracking-widest text-sm text-accent2 bg-black/30 rounded-full px-3 py-2">
                      {grupo.inviteCode}
                    </code>
                    {/* O rótulo diz de que grupo é o código: numa lista de vários grupos,
                        três botões "Copiar" seguidos são indistinguíveis no leitor de tela. */}
                    <button
                      onClick={() => copiarConvite(grupo.inviteCode)}
                      aria-label={txt.copiarCodigoDe(grupo.name)}
                      className="shrink-0 text-xs px-3 min-h-[44px] rounded-full bg-white/10 border border-edge transition hover:bg-white/15 active:scale-95"
                    >
                      {copiado === grupo.inviteCode ? txt.copiado : txt.copiar}
                    </button>
                  </div>

                  {grupo.matches.length === 0 ? (
                    <p className="text-sm text-muted" data-tour={tour('grupo-matches')}>
                      {txt.nenhumMatch}
                    </p>
                  ) : (
                    /* `tabIndex` porque a fileira rola na horizontal: sem ele, quem não
                       usa mouse nem toque não alcança os pôsteres que ficaram fora da
                       área visível. */
                    <div
                      role="group"
                      aria-label={txt.partidas(grupo.matchCount)}
                      tabIndex={0}
                      data-tour={tour('grupo-matches')}
                      className="flex gap-3 overflow-x-auto pb-1 rounded-lg"
                    >
                      {grupo.matches.map((match) => (
                        <figure key={match.movieId} className="w-24 shrink-0">
                          <div className="aspect-[2/3] rounded-lg overflow-hidden bg-black/30 mb-1">
                            {match.posterUrl ? (
                              <img
                                src={match.posterUrl}
                                alt={match.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted text-center px-1">
                                {txt.semPoster}
                              </div>
                            )}
                          </div>
                          <figcaption className="text-xs text-cream/90 leading-tight line-clamp-2">
                            {match.title}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {grupoDosMembros && (
        <MembrosDoGrupo grupo={grupoDosMembros} onFechar={() => setGrupoDosMembros(null)} />
      )}
    </div>
  );
}
