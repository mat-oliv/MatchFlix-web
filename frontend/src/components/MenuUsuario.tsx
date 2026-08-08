import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  getMeuPerfil,
  getFilmesCurtidos,
  salvarAvatar,
  ApiError,
  type FilmeResumo,
  type Perfil,
} from '../lib/api';
import { txt } from '../lib/idioma';

type Props = {
  onFechar: () => void;
  onSair: () => void;
  /** Mantém a miniatura do cabeçalho igual à foto daqui, sem esperar um recarregamento. */
  onFotoAtualizada: (url: string | null) => void;
};

const TAMANHO_AVATAR = 256;

function mensagemDoErro(err: unknown, padrao: string) {
  return err instanceof ApiError ? err.message : padrao;
}

/**
 * Recorta o quadrado central e reduz para 256px antes de enviar. A foto viaja como
 * data URL e é guardada assim no banco — mandar o arquivo original, de vários MB,
 * estouraria o limite de corpo da API e encheria o banco à toa.
 */
async function prepararFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imagem = new Image();
      imagem.onload = () => resolve(imagem);
      imagem.onerror = () => reject(new Error(txt.erroLerImagem));
      imagem.src = url;
    });

    const lado = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = TAMANHO_AVATAR;
    canvas.height = TAMANHO_AVATAR;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(txt.erroProcessarImagem);

    ctx.drawImage(
      img,
      (img.width - lado) / 2,
      (img.height - lado) / 2,
      lado,
      lado,
      0,
      0,
      TAMANHO_AVATAR,
      TAMANHO_AVATAR
    );

    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Menu do usuário — sobrepõe a tela atual, não substitui. */
export function MenuUsuario({ onFechar, onSair, onFotoAtualizada }: Props) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [curtidos, setCurtidos] = useState<FilmeResumo[]>([]);
  const [temMais, setTemMais] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroPagina, setErroPagina] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  const arquivoRef = useRef<HTMLInputElement | null>(null);

  // Cursor da próxima página e trava de concorrência: nenhum dos dois afeta a
  // renderização, então ficam em ref pra não disparar efeito à toa.
  const cursor = useRef<string | undefined>(undefined);
  const buscando = useRef(false);

  const areaCurtidos = useRef<HTMLDivElement | null>(null);
  const sentinela = useRef<HTMLDivElement | null>(null);

  const carregarMais = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;
    setErroPagina(null);

    try {
      const pagina = await getFilmesCurtidos(cursor.current);
      cursor.current = pagina.nextCursor ?? undefined;
      setTemMais(pagina.nextCursor !== null);

      // Um filme recém-curtido entra no topo da lista e empurra os outros: sem
      // deduplicar, ele reapareceria na página seguinte.
      setCurtidos((prev) => {
        const conhecidos = new Set(prev.map((f) => f.movieId));
        return [...prev, ...pagina.movies.filter((f) => !conhecidos.has(f.movieId))];
      });
    } catch (err) {
      // Sem sentinela enquanto houver erro, senão o observer tentaria de novo em loop.
      setErroPagina(mensagemDoErro(err, txt.erroMaisFilmes));
    } finally {
      buscando.current = false;
    }
  }, []);

  useEffect(() => {
    getMeuPerfil()
      .then((dados) => {
        setPerfil(dados);
        // Ressincroniza o cabeçalho: se a busca dele no boot falhou, é aqui que a
        // miniatura acerta.
        onFotoAtualizada(dados.user.avatarUrl);
      })
      .catch((err) => setErro(mensagemDoErro(err, txt.erroPerfil)));

    carregarMais();
  }, [carregarMais, onFotoAtualizada]);

  // O observer é recriado a cada página: se a sentinela seguir visível depois de
  // carregar, o callback dispara de novo sozinho e a próxima página vem em seguida.
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo) return;

    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas[0].isIntersecting) carregarMais();
      },
      // Raiz é a área que rola dentro do menu, não a janela.
      { root: areaCurtidos.current, rootMargin: '120px' }
    );

    observer.observe(alvo);
    return () => observer.disconnect();
  }, [carregarMais, curtidos.length, temMais, erroPagina]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  async function aoEscolherFoto(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    // Zera o input: sem isso, escolher o MESMO arquivo de novo não dispara `change`.
    evento.target.value = '';
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      setErroFoto(txt.escolhaImagem);
      return;
    }

    setEnviandoFoto(true);
    setErroFoto(null);

    try {
      const { avatarUrl } = await salvarAvatar(await prepararFoto(arquivo));
      setPerfil((atual) => (atual ? { ...atual, user: { ...atual.user, avatarUrl } } : atual));
      onFotoAtualizada(avatarUrl);
    } catch (err) {
      setErroFoto(mensagemDoErro(err, txt.erroSalvarFoto));
    } finally {
      setEnviandoFoto(false);
    }
  }

  // Acima de 10 a lista passa a rolar dentro do menu, em vez de esticar a tela.
  const precisaRolar = curtidos.length > 10;
  const carregandoPrimeiraPagina = curtidos.length === 0 && temMais && !erroPagina;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center px-4 py-10 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={txt.menuUsuario}
      onClick={onFechar}
    >
      <div
        className="bg-panel border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-4 p-5 border-b border-white/10">
          {/* Clicar na foto abre o seletor de arquivos do sistema. */}
          <div className="shrink-0 w-16">
            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              disabled={enviandoFoto}
              aria-label={txt.escolherFoto}
              className="block w-16 h-16 rounded-full bg-white overflow-hidden"
            >
              {perfil?.user.avatarUrl && (
                <img src={perfil.user.avatarUrl} alt="" className="w-full h-full object-cover" />
              )}
            </button>

            <p
              className={`mt-1 text-center text-[10px] leading-tight ${
                erroFoto ? 'text-rose-300' : 'text-white/40'
              }`}
            >
              {erroFoto ?? (enviandoFoto ? txt.enviandoFoto : txt.cliqueParaAlterar)}
            </p>

            <input
              ref={arquivoRef}
              type="file"
              accept="image/*"
              onChange={aoEscolherFoto}
              className="hidden"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-display text-xl truncate">
              {perfil?.user.username ?? '...'}
            </p>
            <p className="text-sm text-white/50 mt-0.5">
              {perfil ? (
                <>
                  {perfil.groupCount} {txt.gruposContagem(perfil.groupCount)} ·{' '}
                  {perfil.likedCount} {txt.curtidosContagem(perfil.likedCount)}
                </>
              ) : (
                txt.carregandoMinusculo
              )}
            </p>
          </div>

          <button
            onClick={onFechar}
            aria-label={txt.fechar}
            className="shrink-0 w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            ✕
          </button>
        </header>

        <section className="p-5">
          <h3 className="font-display text-sm text-white/70 mb-3">{txt.filmesCurtidos}</h3>

          {erro ? (
            <p className="text-sm text-rose-300">{erro}</p>
          ) : carregandoPrimeiraPagina ? (
            <p className="text-sm text-white/40">{txt.carregando}</p>
          ) : curtidos.length === 0 && !erroPagina ? (
            <p className="text-sm text-white/40">
              {txt.semCurtidos}
            </p>
          ) : (
            <div
              ref={areaCurtidos}
              className={precisaRolar ? 'max-h-72 overflow-y-auto pr-1' : ''}
            >
              <div className="grid grid-cols-3 gap-3">
                {curtidos.map((filme) => (
                  <figure key={filme.movieId}>
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-black/30 mb-1">
                      {filme.posterUrl ? (
                        <img
                          src={filme.posterUrl}
                          alt={filme.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40 text-center px-1">
                          {txt.semPoster}
                        </div>
                      )}
                    </div>
                    <figcaption className="text-[11px] text-white/70 leading-tight line-clamp-2">
                      {filme.title}
                    </figcaption>
                  </figure>
                ))}
              </div>

              {erroPagina ? (
                <div className="pt-3 text-center">
                  <p className="text-xs text-rose-300 mb-2">{erroPagina}</p>
                  <button
                    onClick={carregarMais}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 transition"
                  >
                    {txt.tentarDeNovo}
                  </button>
                </div>
              ) : (
                temMais && (
                  <div ref={sentinela} className="py-3 text-center text-xs text-white/40">
                    {txt.carregandoMais}
                  </div>
                )
              )}
            </div>
          )}
        </section>

        <footer className="p-5 pt-0">
          <button
            onClick={onSair}
            className="w-full py-2 rounded-full text-sm text-white/70 border border-white/15 hover:text-white hover:border-white/30 transition"
          >
            {txt.sairDaConta}
          </button>
        </footer>
      </div>
    </div>
  );
}
