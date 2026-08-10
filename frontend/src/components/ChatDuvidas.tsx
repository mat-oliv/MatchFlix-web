import { useEffect, useRef, useState } from 'react';
import { perguntarAoAssistente, ApiError, type FalaDoChat } from '../lib/api';

type Autor = 'pessoa' | 'assistente' | 'erro';

type Mensagem = {
  id: number;
  autor: Autor;
  texto: string;
  /**
   * Fica só na tela e não vai para o assistente. É o caso da saudação e dos erros: a API
   * exige que a conversa comece por uma fala da pessoa, e mandar erro de volta como se
   * fosse fala do assistente só confundiria o modelo.
   */
  apenasLocal?: boolean;
};

type Props = {
  onFechar: () => void;
};

const BOAS_VINDAS: Mensagem = {
  id: 0,
  autor: 'assistente',
  apenasLocal: true,
  texto:
    'Oi! Por aqui você tira dúvidas sobre o MovieMatch — como montar um grupo, como o ' +
    'match acontece, o que aparece no feed. Pergunte à vontade.',
};

/**
 * Pop-up de dúvidas sobre o aplicativo, aberto pelo botão redondo no canto inferior
 * esquerdo. Segue a convenção dos outros diálogos (fecha no fundo, no ✕ e no Escape,
 * conteúdo interno com `stopPropagation`), mas ancorado no canto em vez de centralizado,
 * e com o fundo mais leve que os demais: é uma ajuda lateral, não uma tela que interrompe
 * o que a pessoa estava fazendo.
 *
 * A conversa vive só aqui: nada é guardado no servidor nem no navegador, e o histórico
 * inteiro sobe a cada pergunta para o assistente ter contexto.
 */
export function ChatDuvidas({ onFechar }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([BOAS_VINDAS]);
  const [rascunho, setRascunho] = useState('');
  const [pensando, setPensando] = useState(false);
  const proximoId = useRef(1);
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  // Mensagem nova entra embaixo; sem isso ela nasceria fora da área visível.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: 'end' });
  }, [mensagens, pensando]);

  function acrescentar(mensagem: Omit<Mensagem, 'id'>) {
    setMensagens((anteriores) => [...anteriores, { ...mensagem, id: proximoId.current++ }]);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    const pergunta = rascunho.trim();
    if (!pergunta || pensando) return;

    const conversaEnviada: FalaDoChat[] = [
      ...mensagens
        .filter((m) => !m.apenasLocal && m.autor !== 'erro')
        .map((m) => ({ autor: m.autor as 'pessoa' | 'assistente', texto: m.texto })),
      { autor: 'pessoa', texto: pergunta },
    ];

    acrescentar({ autor: 'pessoa', texto: pergunta });
    setRascunho('');
    setPensando(true);

    // Sem try/catch a rejeição some e a tela trava sem erro nenhum no console.
    try {
      const { resposta } = await perguntarAoAssistente(conversaEnviada);
      acrescentar({ autor: 'assistente', texto: resposta });
    } catch (erro) {
      acrescentar({
        autor: 'erro',
        apenasLocal: true,
        texto:
          erro instanceof ApiError
            ? erro.message
            : 'Não consegui falar com o assistente agora.',
      });
    } finally {
      setPensando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-start p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Dúvidas sobre o aplicativo"
      onClick={onFechar}
    >
      <div
        className="bg-panel border border-white/10 rounded-2xl w-full max-w-sm h-[min(30rem,80dvh)] flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight">Dúvidas sobre o app</h2>
            <p className="text-xs text-white/40 mt-0.5">Respostas de um assistente — pode errar</p>
          </div>

          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            ✕
          </button>
        </header>

        {/* Só a conversa rola; o cabeçalho e o campo de escrita ficam parados. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3"
          aria-live="polite"
        >
          {mensagens.map((mensagem) => (
            <Balao key={mensagem.id} mensagem={mensagem} />
          ))}
          {pensando && <Pensando />}
          <div ref={fimDaLista} />
        </div>

        <form
          onSubmit={enviar}
          className="shrink-0 flex items-center gap-2 p-3 border-t border-white/10"
        >
          <input
            autoFocus
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            disabled={pensando}
            maxLength={1000}
            placeholder={pensando ? 'Aguarde a resposta…' : 'Escreva sua dúvida…'}
            aria-label="Sua dúvida"
            className="flex-1 min-w-0 px-4 py-2 rounded-full bg-black/30 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-accent2/60 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={!rascunho.trim() || pensando}
            aria-label="Enviar"
            className="shrink-0 w-10 h-10 rounded-full bg-accent2 text-ink grid place-items-center hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100 transition"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
              <path d="M3.4 20.4l17.5-8.4a1 1 0 000-1.8L3.4 1.8a.9.9 0 00-1.3 1l2.3 7.1a1 1 0 00.8.7l9.2 1.5-9.2 1.5a1 1 0 00-.8.7l-2.3 7.1a.9.9 0 001.3 1z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

/** Balão de uma mensagem — a da pessoa vai à direita, as demais à esquerda. */
function Balao({ mensagem }: { mensagem: Mensagem }) {
  const daPessoa = mensagem.autor === 'pessoa';
  const ehErro = mensagem.autor === 'erro';

  const estilo = daPessoa
    ? 'bg-accent2 text-ink rounded-br-md'
    : ehErro
      ? 'bg-accent/15 text-accent border border-accent/30 rounded-bl-md'
      : 'bg-white/10 text-white/85 rounded-bl-md';

  return (
    <div className={`flex ${daPessoa ? 'justify-end' : 'justify-start'}`}>
      <p
        className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${estilo}`}
      >
        {mensagem.texto}
      </p>
    </div>
  );
}

/** Três pontinhos enquanto a resposta não chega. */
function Pensando() {
  return (
    <div className="flex justify-start" aria-label="Escrevendo a resposta">
      <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
        {[0, 150, 300].map((atraso) => (
          <span
            key={atraso}
            className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce"
            style={{ animationDelay: `${atraso}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
