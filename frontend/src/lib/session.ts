const CHAVE = 'moviematch:sessao';

export type Usuario = { id: string; username: string };
export type Sessao = { token: string; user: Usuario };

export function lerSessao(): Sessao | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;

    const sessao = JSON.parse(raw) as Sessao;
    return sessao?.token && sessao?.user?.id ? sessao : null;
  } catch {
    return null;
  }
}

export function salvarSessao(sessao: Sessao) {
  localStorage.setItem(CHAVE, JSON.stringify(sessao));
}

export function limparSessao() {
  localStorage.removeItem(CHAVE);
}
