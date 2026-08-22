const CHAVE = 'moviematch:sessao';

export type Usuario = { id: string; username: string };
export type Sessao = { token: string; user: Usuario };

/**
 * A sessão mora em DOIS lugares, e a diferença entre eles é o que permite duas contas
 * ao mesmo tempo no mesmo navegador.
 *
 * O `localStorage` é compartilhado por todas as abas da mesma origem. Com a sessão só
 * lá, entrar como outra pessoa numa segunda aba trocava o token da primeira por baixo:
 * a aba antiga continuava exibindo o nome de quem tinha entrado antes, mas toda chamada
 * à API já saía com o token do segundo — porque `lerSessao()` é consultada a cada
 * requisição. Na prática não dava para ter dois usuários logados.
 *
 * O `sessionStorage` é por aba. A sessão passa a ser fixada nele, e o `localStorage`
 * fica só como memória entre visitas: aba nova (ou navegador reaberto) adota a última
 * sessão conhecida, mas dali em diante cada aba segue a sua.
 */
function ler(store: Storage): Sessao | null {
  try {
    const raw = store.getItem(CHAVE);
    if (!raw) return null;

    const sessao = JSON.parse(raw) as Sessao;
    return sessao?.token && sessao?.user?.id ? sessao : null;
  } catch {
    return null;
  }
}

export function lerSessao(): Sessao | null {
  // A sessão da aba manda. Só quando ela não existe é que a última do navegador vale —
  // e aí a aba a adota como sua, para não voltar a mudar se outra aba trocar de conta.
  const daAba = ler(sessionStorage);
  if (daAba) return daAba;

  const doNavegador = ler(localStorage);
  if (doNavegador) {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(doNavegador));
    } catch {
      // Sem sessionStorage (modo privado de alguns navegadores) o app continua
      // funcionando com uma conta só, que é o comportamento antigo.
    }
  }
  return doNavegador;
}

export function salvarSessao(sessao: Sessao) {
  const bruto = JSON.stringify(sessao);
  sessionStorage.setItem(CHAVE, bruto);
  // No `localStorage` também, para sobreviver ao fechamento da aba. As outras abas já
  // têm a sessão delas fixada, então gravar aqui não as derruba.
  localStorage.setItem(CHAVE, bruto);
}

export function limparSessao() {
  sessionStorage.removeItem(CHAVE);
  // Some dos dois: senão reabrir o navegador ressuscitaria a conta de quem acabou de
  // sair. Outras abas seguem intactas, cada uma com a sua.
  localStorage.removeItem(CHAVE);
}
