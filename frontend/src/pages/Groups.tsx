import { useCallback, useEffect, useState } from 'react';
import { createGroup, joinGroup, getMeusGrupos, ApiError, type UserGroup } from '../lib/api';

function mensagemDoErro(err: unknown, padrao: string) {
  return err instanceof ApiError ? err.message : padrao;
}

export function Groups() {
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [grupos, setGrupos] = useState<UserGroup[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregarGrupos = useCallback(async () => {
    try {
      setGrupos(await getMeusGrupos());
      setError('');
    } catch (err) {
      setError(mensagemDoErro(err, 'Não foi possível carregar seus grupos.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarGrupos();
  }, [carregarGrupos]);

  async function handleCreate() {
    if (!groupName.trim()) return;
    setError('');
    try {
      const group = await createGroup(groupName.trim());
      setMessage(`Grupo "${group.name}" criado!`);
      setGroupName('');
      await carregarGrupos();
    } catch (err) {
      setError(mensagemDoErro(err, 'Não foi possível criar o grupo.'));
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setError('');
    try {
      const group = await joinGroup(inviteCode.trim());
      setMessage(`Você entrou em "${group.name}"!`);
      setInviteCode('');
      await carregarGrupos();
    } catch (err) {
      setError(mensagemDoErro(err, 'Código de convite não encontrado.'));
    }
  }

  async function copiarConvite(inviteCode: string) {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiado(inviteCode);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError('Não foi possível copiar o código.');
    }
  }

  return (
    <div className="max-w-lg mx-auto py-10 flex flex-col gap-10">
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="flex-1">
          <h2 className="font-display text-lg mb-2">Criar grupo</h2>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nome do grupo"
            className="w-full px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-2 outline-none focus:border-accent2"
          />
          <button
            onClick={handleCreate}
            className="w-full py-2 rounded-full bg-accent2 text-ink font-semibold hover:brightness-110 transition"
          >
            Criar
          </button>
        </div>

        <div className="flex-1">
          <h2 className="font-display text-lg mb-2">Entrar em um grupo</h2>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Código de convite"
            className="w-full px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-2 outline-none focus:border-accent2"
          />
          <button
            onClick={handleJoin}
            className="w-full py-2 rounded-full bg-white/10 border border-white/20 font-semibold hover:bg-white/15 transition"
          >
            Entrar
          </button>
        </div>
      </div>

      {message && <p className="text-center text-accent2 text-sm">{message}</p>}
      {error && <p className="text-center text-rose-300 text-sm">{error}</p>}

      <section>
        <h2 className="font-display text-lg mb-4">Meus grupos</h2>

        {carregando ? (
          <p className="text-white/50 text-sm">Carregando...</p>
        ) : grupos.length === 0 ? (
          <p className="text-white/50 text-sm">
            Você ainda não está em nenhum grupo. Crie um acima e mande o link pros seus amigos.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {grupos.map((grupo) => (
              <article key={grupo.id} className="rounded-2xl bg-panel border border-white/10 p-5">
                <header className="flex items-baseline justify-between gap-3 mb-3">
                  <h3 className="font-display text-xl">{grupo.name}</h3>
                  <p className="text-sm text-white/50 shrink-0">
                    {grupo.memberCount} {grupo.memberCount === 1 ? 'membro' : 'membros'} ·{' '}
                    {grupo.matchCount} {grupo.matchCount === 1 ? 'match' : 'matches'}
                  </p>
                </header>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-white/40 shrink-0">Convite:</span>
                  <code className="font-mono tracking-widest text-sm text-accent2 bg-black/30 rounded-full px-3 py-2">
                    {grupo.inviteCode}
                  </code>
                  <button
                    onClick={() => copiarConvite(grupo.inviteCode)}
                    className="shrink-0 text-xs px-3 py-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 transition"
                  >
                    {copiado === grupo.inviteCode ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>

                {grupo.matches.length === 0 ? (
                  <p className="text-sm text-white/40">
                    Nenhum match ainda. Curtam filmes na aba Filmes!
                  </p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1">
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
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40 text-center px-1">
                              Sem pôster
                            </div>
                          )}
                        </div>
                        <figcaption className="text-[11px] text-white/70 leading-tight line-clamp-2">
                          {match.title}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
