import { lerSessao, limparSessao, type Sessao } from './session';
import { idioma, txt } from './idioma';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

/** Erro que carrega a mensagem vinda do backend, para a UI exibir no pop-up. */
export class ApiError extends Error {}

async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
  const sessao = lerSessao();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        // Diz ao backend em que idioma devolver mensagem de erro, filme da TMDB e
        // resposta do assistente. Sem isto a tela ficaria em inglês e os erros que
        // vêm da API, em português.
        'Accept-Language': idioma === 'pt' ? 'pt-BR' : 'en',
        ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(txt.semServidor);
  }

  // 401 com sessão guardada = token venceu ou foi invalidado: derruba e volta pro login.
  if (res.status === 401 && sessao) {
    limparSessao();
    window.location.reload();
    throw new ApiError(txt.sessaoExpirada);
  }

  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    throw new ApiError(corpo?.error ?? txt.operacaoFalhou);
  }

  return res.json();
}

// --- autenticação ---

export function entrar(username: string, password: string): Promise<Sessao> {
  return pedir('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function cadastrar(
  username: string,
  password: string,
  confirmPassword: string
): Promise<Sessao> {
  return pedir('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, confirmPassword }),
  });
}

// --- filmes ---

export type Movie = {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  releaseDate: string;
  voteAverage: number;
};

/** Sem `page`, o backend sorteia onde começar no catálogo. */
export function getMovieFeed(page?: number): Promise<{ movies: Movie[]; nextPage: number }> {
  return pedir(`/movies/feed${page ? `?page=${page}` : ''}`);
}

export function sendSwipe(
  movieId: number,
  liked: boolean
): Promise<{ newMatches: { groupId: string; movieId: number }[] }> {
  return pedir('/swipes', {
    method: 'POST',
    body: JSON.stringify({ movieId, liked }),
  });
}

// --- grupos ---

export type Group = {
  id: string;
  name: string;
  inviteCode: string;
};

/** Filme resolvido com título e pôster — usado em matches e em filmes curtidos. */
export type FilmeResumo = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  createdAt: string;
};

export type UserGroup = Group & {
  memberCount: number;
  matchCount: number;
  matches: FilmeResumo[];
};

// --- perfil ---

export type Perfil = {
  user: { id: string; username: string; avatarUrl: string | null };
  groupCount: number;
  likedCount: number;
};

/** Só identificação e contadores — a lista de curtidos vem de `getFilmesCurtidos`. */
export function getMeuPerfil(): Promise<Perfil> {
  return pedir('/me/profile');
}

/** `avatar` é uma data URL; quem reduz a imagem é o navegador, antes de chamar aqui. */
export function salvarAvatar(avatar: string): Promise<{ avatarUrl: string }> {
  return pedir('/me/avatar', { method: 'PUT', body: JSON.stringify({ avatar }) });
}

/**
 * Filmes curtidos em páginas de 20, do mais recente pro mais antigo.
 * `cursor` é o `nextCursor` da página anterior; `nextCursor: null` = acabou.
 */
export function getFilmesCurtidos(
  cursor?: string
): Promise<{ movies: FilmeResumo[]; nextCursor: string | null }> {
  return pedir(`/me/liked${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
}

export function getMeusGrupos(): Promise<UserGroup[]> {
  return pedir('/me/groups');
}

export function createGroup(name: string): Promise<Group> {
  return pedir('/groups', { method: 'POST', body: JSON.stringify({ name }) });
}

export function joinGroup(inviteCode: string): Promise<Group> {
  return pedir('/groups/join', { method: 'POST', body: JSON.stringify({ inviteCode }) });
}

// --- chat de dúvidas ---

export type FalaDoChat = { autor: 'pessoa' | 'assistente'; texto: string };

/**
 * Manda a conversa inteira e recebe a próxima resposta. Nada fica guardado no servidor:
 * o histórico vive no componente e volta a cada pergunta.
 */
export function perguntarAoAssistente(conversa: FalaDoChat[]): Promise<{ resposta: string }> {
  return pedir('/chat', { method: 'POST', body: JSON.stringify({ conversa }) });
}
