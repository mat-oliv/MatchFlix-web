import { useEffect, useState } from 'react';
import { getMembrosDoGrupo, ApiError, type MembroDoGrupo, type UserGroup } from '../lib/api';
import { lerSessao } from '../lib/session';
import { txt } from '../lib/idioma';

type Props = {
  grupo: UserGroup;
  onFechar: () => void;
};

/**
 * Pop-up com quem está no grupo — foto e nome de cada membro. Abre ao tocar na
 * contagem de membros, na aba Grupos.
 *
 * Segue a convenção dos outros diálogos (ver "Decisões de arquitetura" no CLAUDE.md):
 * sobreposição por cima da tela, fecha no fundo, no ✕ e no Escape.
 */
export function MembrosDoGrupo({ grupo, onFechar }: Props) {
  const [membros, setMembros] = useState<MembroDoGrupo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Para marcar qual da lista é a própria pessoa. A sessão é a fonte do id aqui porque
  // a aba Grupos não recebe o usuário logado — ela só lida com grupos.
  const meuId = lerSessao()?.user.id;

  useEffect(() => {
    let cancelado = false;

    getMembrosDoGrupo(grupo.id)
      .then((lista) => !cancelado && setMembros(lista))
      .catch((err) => {
        if (cancelado) return;
        setErro(err instanceof ApiError ? err.message : txt.erroMembros);
      });

    return () => {
      cancelado = true;
    };
  }, [grupo.id]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={txt.membrosDoGrupo}
      onClick={onFechar}
    >
      <div
        className="bg-panel border border-white/10 rounded-2xl w-full max-w-sm max-h-full flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-4 p-5 border-b border-white/10">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-tight truncate">{grupo.name}</h2>
            <p className="text-sm text-white/50 mt-0.5">
              {grupo.memberCount} {txt.membros(grupo.memberCount)}
            </p>
          </div>

          <button
            autoFocus
            onClick={onFechar}
            aria-label={txt.fechar}
            className="shrink-0 w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            ✕
          </button>
        </header>

        {/* Só a lista rola: o cabeçalho fica à vista mesmo em grupo cheio. */}
        <div className="p-5 overflow-y-auto">
          {erro ? (
            <p className="text-sm text-rose-300">{erro}</p>
          ) : membros === null ? (
            <p className="text-sm text-white/40">{txt.carregando}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {membros.map((membro) => (
                <li key={membro.id} className="flex items-center gap-3">
                  {/* Mesmo círculo branco do menu do usuário: sem foto, fica só ele. */}
                  <span className="shrink-0 w-10 h-10 rounded-full bg-white overflow-hidden">
                    {membro.avatarUrl && (
                      <img
                        src={membro.avatarUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </span>

                  <span className="min-w-0 truncate">
                    {membro.username}
                    {membro.id === meuId && (
                      <span className="text-white/40 text-sm"> ({txt.euMesmo})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
