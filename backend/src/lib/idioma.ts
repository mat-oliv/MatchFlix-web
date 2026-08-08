import type { FastifyRequest } from 'fastify';

export type Idioma = 'pt' | 'en';

/**
 * Idioma da requisição, a partir do cabeçalho `Accept-Language` que o frontend manda.
 *
 * A regra é a mesma dos dois lados e está descrita em `frontend/src/lib/idioma.ts`:
 * só `pt-BR` recebe português; qualquer outra coisa — inclusive `pt` sem região e
 * `pt-PT` — recebe inglês, que é o padrão do site.
 *
 * O cabeçalho pode vir com lista de prioridades (`pt-BR,pt;q=0.9,en;q=0.8`); só a
 * primeira entrada interessa, que é a preferida.
 */
export function idiomaDaRequisicao(request: FastifyRequest): Idioma {
  const cabecalho = request.headers['accept-language'];
  const preferido = cabecalho?.split(',')[0]?.trim().toLowerCase() ?? '';

  return preferido.startsWith('pt-br') ? 'pt' : 'en';
}

const pt = {
  // auth
  preenchaCadastro: 'Preencha usuário, senha e confirmação.',
  informeUsuario: 'Informe um nome de usuário.',
  usuarioCurto: (min: number) => `O usuário precisa ter pelo menos ${min} caracteres.`,
  usuarioComEspacos: 'O usuário não pode conter espaços.',
  informeSenha: 'Informe uma senha.',
  senhaCurta: (min: number) => `A senha precisa ter pelo menos ${min} caracteres.`,
  senhasNaoConferem: 'As senhas não conferem.',
  usuarioEmUso: (usuario: string) => `O usuário "${usuario}" já está em uso.`,
  preenchaLogin: 'Preencha usuário e senha.',
  credenciaisInvalidas: 'Usuário ou senha inválidos.',
  usuarioNaoEncontrado: 'Usuário não encontrado.',

  // perfil
  imagemInvalida: 'Imagem inválida ou grande demais. Tente outra foto.',

  // grupos
  conviteNaoEncontrado: 'Código de convite não encontrado.',
  foraDoGrupo: 'Você não faz parte deste grupo.',

  // filmes
  filmeSemTitulo: (id: number) => `Filme #${id}`,

  // chat
  semPergunta: 'Pode mandar a sua dúvida sobre o app que eu tento ajudar.',
  semResposta: 'Não consegui formular uma resposta. Pode perguntar de outro jeito?',
  perguntaInvalida: 'Pergunta inválida ou longa demais.',
  ultimaFalaPrecisaSerSua: 'A última mensagem precisa ser sua.',
  muitasPerguntas: 'Você fez muitas perguntas seguidas. Tente de novo mais tarde.',
  assistenteNaoConfigurado: 'O assistente ainda não está configurado neste servidor.',
  cotaEsgotada: 'Muita gente perguntando agora. Tente de novo em alguns segundos.',
  assistenteSemResposta: 'O assistente não respondeu agora. Tente de novo em instantes.',
};

/**
 * `typeof pt` obriga o inglês a ter exatamente as mesmas chaves, com os mesmos
 * parâmetros. Esquecer uma tradução vira erro de compilação, não texto em português
 * aparecendo para quem está em inglês. (Sem `as const` no objeto acima de propósito:
 * com ele cada frase viraria um tipo literal e o inglês teria de ser idêntico ao
 * português, que é o oposto do que se quer aqui.)
 */
const en: typeof pt = {
  // auth
  preenchaCadastro: 'Fill in username, password and confirmation.',
  informeUsuario: 'Enter a username.',
  usuarioCurto: (min: number) => `The username must be at least ${min} characters long.`,
  usuarioComEspacos: 'The username cannot contain spaces.',
  informeSenha: 'Enter a password.',
  senhaCurta: (min: number) => `The password must be at least ${min} characters long.`,
  senhasNaoConferem: 'The passwords do not match.',
  usuarioEmUso: (usuario: string) => `The username "${usuario}" is already taken.`,
  preenchaLogin: 'Fill in username and password.',
  credenciaisInvalidas: 'Invalid username or password.',
  usuarioNaoEncontrado: 'User not found.',

  // perfil
  imagemInvalida: 'Invalid or oversized image. Try another photo.',

  // grupos
  conviteNaoEncontrado: 'Invite code not found.',
  foraDoGrupo: 'You are not a member of this group.',

  // filmes
  filmeSemTitulo: (id: number) => `Movie #${id}`,

  // chat
  semPergunta: 'Go ahead and send your question about the app.',
  semResposta: "I couldn't put an answer together. Could you ask it another way?",
  perguntaInvalida: 'Question is invalid or too long.',
  ultimaFalaPrecisaSerSua: 'The last message must be yours.',
  muitasPerguntas: 'You have asked too many questions in a row. Try again later.',
  assistenteNaoConfigurado: 'The assistant is not configured on this server yet.',
  cotaEsgotada: 'Too many people asking right now. Try again in a few seconds.',
  assistenteSemResposta: "The assistant didn't answer. Try again in a moment.",
};

/** Mensagens de um idioma já conhecido — para quem não tem a requisição em mãos. */
export function textosDe(idioma: Idioma) {
  return idioma === 'pt' ? pt : en;
}

/** Mensagens no idioma da requisição. Use sempre isto, nunca texto literal na rota. */
export function textos(request: FastifyRequest) {
  return textosDe(idiomaDaRequisicao(request));
}
