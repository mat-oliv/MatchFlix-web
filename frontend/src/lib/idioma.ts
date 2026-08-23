export type Idioma = 'pt' | 'en';

/**
 * Idioma da interface, decidido uma vez quando o app carrega.
 *
 * Regra: navegador configurado em **português do Brasil** recebe português; qualquer
 * outra coisa recebe inglês, que é o padrão do site.
 *
 * `pt` sem região e `pt-PT` caem no inglês de propósito: a regra é sobre estar no
 * Brasil, e nenhum dos dois afirma isso. Só `navigator.language` conta — ele é a
 * primeira preferência da lista; alguém com `['en-US', 'pt-BR']` prefere inglês.
 *
 * Não há troca manual: o idioma é o do navegador, e muda quando o navegador mudar.
 */
function detectar(): Idioma {
  const preferido = navigator.language?.toLowerCase() ?? '';
  return preferido.startsWith('pt-br') ? 'pt' : 'en';
}

export const idioma: Idioma = detectar();

const pt = {
  // comuns
  semPoster: 'Sem pôster',
  carregando: 'Carregando...',
  fechar: 'Fechar',

  // cabeçalho
  abaFilmes: 'Filmes',
  abaGrupos: 'Grupos',
  abrirChat: 'Abrir dúvidas sobre o aplicativo',

  // entrada
  subtitulo: 'Descubra o filme que todo mundo do grupo quer ver.',
  entrar: 'Entrar',
  cadastrar: 'Cadastrar',
  usuario: 'Usuário',
  senha: 'Senha',
  confirmarSenha: 'Confirmar senha',
  aguarde: 'Aguarde...',
  criarConta: 'Criar conta',
  naoTemConta: 'Não tem conta?',
  cadastreSe: 'Cadastre-se',
  jaTemConta: 'Já tem conta?',
  algoDeuErrado: 'Algo deu errado. Tente de novo.',

  // filmes
  erroCarregarFilmes: 'Não foi possível carregar os filmes.',
  erroVoto: (titulo: string) => `Não foi possível registrar seu voto em "${titulo}".`,
  carregandoFilmes: 'Carregando filmes...',
  deuMatch: 'Deu match! 🎬',
  todosCurtiram: (titulo: string) => `Todo mundo do grupo curtiu "${titulo}"`,
  noGrupo: (nome: string) => `no grupo "${nome}"`,
  toqueParaContinuar: 'Toque em qualquer lugar para continuar',

  // card
  verDescricaoDe: (titulo: string) => `Ver descrição completa de ${titulo}`,
  toqueParaDescricao: 'Toque para ver a descrição completa',
  passar: 'Passar',
  curtir: 'Curtir',

  // detalhes
  detalhesDe: (titulo: string) => `Detalhes de ${titulo}`,
  semDescricao: 'Este filme ainda não tem descrição em português.',

  // aviso
  ops: 'Ops!',
  entendi: 'Entendi',

  // grupos
  criarGrupo: 'Criar grupo',
  nomeDoGrupo: 'Nome do grupo',
  criar: 'Criar',
  entrarEmGrupo: 'Entrar em um grupo',
  codigoConvite: 'Código de convite',
  entrarNoGrupo: 'Entrar',
  meusGrupos: 'Meus grupos',
  semGrupos: 'Você ainda não está em nenhum grupo. Crie um acima e mande o código pros seus amigos.',
  grupoCriado: (nome: string) => `Grupo "${nome}" criado!`,
  entrouNoGrupo: (nome: string) => `Você entrou em "${nome}"!`,
  erroCarregarGrupos: 'Não foi possível carregar seus grupos.',
  erroCriarGrupo: 'Não foi possível criar o grupo.',
  erroConvite: 'Código de convite não encontrado.',
  erroCopiar: 'Não foi possível copiar o código.',
  membros: (n: number): string => (n === 1 ? 'membro' : 'membros'),
  partidas: (n: number): string => (n === 1 ? 'match' : 'matches'),
  convite: 'Convite:',
  copiado: 'Copiado!',
  copiar: 'Copiar',
  nenhumMatch: 'Nenhum match ainda. Curtam filmes na aba Filmes!',

  // ranking
  abaRanking: 'Ranking',
  rankingTitulo: 'Mais curtidos da semana',
  rankingSubtitulo: (dias: number) => `Todos os likes do app nos últimos ${dias} dias`,
  rankingVazio: 'Ninguém curtiu nada nos últimos dias. Seja o primeiro na aba Filmes!',
  rankingErro: 'Não foi possível carregar o ranking.',
  curtidas: (n: number): string => (n === 1 ? 'curtida' : 'curtidas'),

  // menu do usuário
  menuUsuario: 'Menu do usuário',
  escolherFoto: 'Escolher foto de perfil',
  enviandoFoto: 'Enviando...',
  cliqueParaAlterar: 'Clique para alterar',
  gruposContagem: (n: number): string => (n === 1 ? 'grupo' : 'grupos'),
  curtidosContagem: (n: number): string => (n === 1 ? 'curtido' : 'curtidos'),
  carregandoMinusculo: 'carregando...',
  filmesCurtidos: 'Filmes curtidos',
  semCurtidos: 'Você ainda não curtiu nenhum filme. Vá para a aba Filmes!',
  tentarDeNovo: 'Tentar de novo',
  carregandoMais: 'Carregando mais...',
  sairDaConta: 'Sair da conta',
  erroPerfil: 'Não foi possível carregar seu perfil.',
  erroMaisFilmes: 'Não foi possível carregar mais filmes.',
  erroSalvarFoto: 'Não foi possível salvar a foto.',
  escolhaImagem: 'Escolha um arquivo de imagem.',
  erroLerImagem: 'Não foi possível ler esta imagem.',
  erroProcessarImagem: 'Não foi possível processar a imagem.',

  // chat de dúvidas
  chatTitulo: 'Dúvidas sobre o app',
  chatSubtitulo: 'Respostas de um assistente — pode errar',
  chatBoasVindas:
    'Oi! Por aqui você tira dúvidas sobre o MovieMatch — como montar um grupo, como o ' +
    'match acontece, o que aparece no feed. Pergunte à vontade.',
  escrevaDuvida: 'Escreva sua dúvida…',
  aguardeResposta: 'Aguarde a resposta…',
  suaDuvida: 'Sua dúvida',
  enviar: 'Enviar',
  escrevendoResposta: 'Escrevendo a resposta',
  erroAssistente: 'Não consegui falar com o assistente agora.',

  // camada de rede
  semServidor: 'Não foi possível falar com o servidor. Ele está rodando?',
  operacaoFalhou: 'Não foi possível completar a operação.',
  sessaoExpirada: 'Sessão expirada.',
};

/**
 * `typeof pt` obriga o inglês a ter exatamente as mesmas chaves, com os mesmos
 * parâmetros: esquecer uma tradução vira erro de compilação, e não uma frase em
 * português aparecendo no meio da tela em inglês.
 */
const en: typeof pt = {
  // comuns
  semPoster: 'No poster',
  carregando: 'Loading...',
  fechar: 'Close',

  // cabeçalho
  abaFilmes: 'Movies',
  abaGrupos: 'Groups',
  abrirChat: 'Open help about the app',

  // entrada
  subtitulo: 'Find the movie everyone in the group wants to watch.',
  entrar: 'Sign in',
  cadastrar: 'Sign up',
  usuario: 'Username',
  senha: 'Password',
  confirmarSenha: 'Confirm password',
  aguarde: 'Please wait...',
  criarConta: 'Create account',
  naoTemConta: "Don't have an account?",
  cadastreSe: 'Sign up',
  jaTemConta: 'Already have an account?',
  algoDeuErrado: 'Something went wrong. Try again.',

  // filmes
  erroCarregarFilmes: 'Could not load the movies.',
  erroVoto: (titulo: string) => `Could not save your vote on "${titulo}".`,
  carregandoFilmes: 'Loading movies...',
  deuMatch: "It's a match! 🎬",
  todosCurtiram: (titulo: string) => `Everyone in the group liked "${titulo}"`,
  noGrupo: (nome: string) => `in the group "${nome}"`,
  toqueParaContinuar: 'Tap anywhere to continue',

  // card
  verDescricaoDe: (titulo: string) => `See the full description of ${titulo}`,
  toqueParaDescricao: 'Tap to see the full description',
  passar: 'Pass',
  curtir: 'Like',

  // detalhes
  detalhesDe: (titulo: string) => `Details for ${titulo}`,
  semDescricao: 'This movie has no description yet.',

  // aviso
  ops: 'Oops!',
  entendi: 'Got it',

  // grupos
  criarGrupo: 'Create a group',
  nomeDoGrupo: 'Group name',
  criar: 'Create',
  entrarEmGrupo: 'Join a group',
  codigoConvite: 'Invite code',
  entrarNoGrupo: 'Join',
  meusGrupos: 'My groups',
  semGrupos: "You're not in any group yet. Create one above and send the code to your friends.",
  grupoCriado: (nome: string) => `Group "${nome}" created!`,
  entrouNoGrupo: (nome: string) => `You joined "${nome}"!`,
  erroCarregarGrupos: 'Could not load your groups.',
  erroCriarGrupo: 'Could not create the group.',
  erroConvite: 'Invite code not found.',
  erroCopiar: 'Could not copy the code.',
  membros: (n: number): string => (n === 1 ? 'member' : 'members'),
  partidas: (n: number): string => (n === 1 ? 'match' : 'matches'),
  convite: 'Invite:',
  copiado: 'Copied!',
  copiar: 'Copy',
  nenhumMatch: 'No matches yet. Like some movies in the Movies tab!',

  // ranking
  abaRanking: 'Top',
  rankingTitulo: 'Most liked this week',
  rankingSubtitulo: (dias: number) => `Every like in the app over the last ${dias} days`,
  rankingVazio: 'Nobody liked anything in the last few days. Be the first, in the Movies tab!',
  rankingErro: 'Could not load the leaderboard.',
  curtidas: (n: number): string => (n === 1 ? 'like' : 'likes'),

  // menu do usuário
  menuUsuario: 'User menu',
  escolherFoto: 'Choose a profile photo',
  enviandoFoto: 'Uploading...',
  cliqueParaAlterar: 'Click to change',
  gruposContagem: (n: number): string => (n === 1 ? 'group' : 'groups'),
  curtidosContagem: (): string => 'liked',
  carregandoMinusculo: 'loading...',
  filmesCurtidos: 'Liked movies',
  semCurtidos: "You haven't liked any movie yet. Go to the Movies tab!",
  tentarDeNovo: 'Try again',
  carregandoMais: 'Loading more...',
  sairDaConta: 'Sign out',
  erroPerfil: 'Could not load your profile.',
  erroMaisFilmes: 'Could not load more movies.',
  erroSalvarFoto: 'Could not save the photo.',
  escolhaImagem: 'Choose an image file.',
  erroLerImagem: 'Could not read this image.',
  erroProcessarImagem: 'Could not process the image.',

  // chat de dúvidas
  chatTitulo: 'App help',
  chatSubtitulo: 'Answers from an assistant — it can be wrong',
  chatBoasVindas:
    'Hi! Ask me anything about MovieMatch — how to set up a group, how a match happens, ' +
    'what shows up in the feed.',
  escrevaDuvida: 'Type your question…',
  aguardeResposta: 'Waiting for the answer…',
  suaDuvida: 'Your question',
  enviar: 'Send',
  escrevendoResposta: 'Writing the answer',
  erroAssistente: "I couldn't reach the assistant right now.",

  // camada de rede
  semServidor: 'Could not reach the server. Is it running?',
  operacaoFalhou: 'Could not complete the operation.',
  sessaoExpirada: 'Session expired.',
};

/** Textos da interface no idioma detectado. */
export const txt = idioma === 'pt' ? pt : en;

/**
 * Mantém o `lang` do documento coerente com o que está na tela. Importa para leitor de
 * tela escolher a pronúncia certa e para o navegador oferecer tradução na hora certa.
 */
document.documentElement.lang = idioma === 'pt' ? 'pt-BR' : 'en';
