import { useEffect, useRef, useState } from 'react';

type Autor = 'pessoa' | 'assistente';

type Mensagem = {
  id: number;
  autor: Autor;
  texto: string;
};

type Props = {
  onFechar: () => void;
};

const BOAS_VINDAS: Mensagem = {
  id: 0,
  autor: 'assistente',
  texto:
    'Oi! Por aqui você tira dúvidas sobre o MovieMatch — como montar um grupo, como o ' +
    'match acontece, o que aparece no feed. Pergunte à vontade.',
};

/**
 * Resposta fixa enquanto não existe assistente de verdade. A conversa precisa reagir a
 * alguma coisa para a tela poder ser avaliada, mas inventar respostas sobre o app seria
 * pior que não responder: a pessoa acreditaria nelas.
 */
const SEM_ASSISTENTE =
  'Ainda não estou ligado a um assistente de verdade — por enquanto esta é só a tela da ' +
  'conversa. Sua pergunta ficou registrada aqui na tela.';

/**
 * Pop-up de dúvidas sobre o aplicativo, aberto pelo botão redondo no canto inferior
 * esquerdo. Segue a convenção dos outros diálogos (fecha no fundo, no ✕ e no Escape,
 * conteúdo interno com `stopPropagation`), mas ancorado no canto em vez de centralizado,
 * e com o fundo mais leve que os demais: é uma ajuda lateral, não uma tela que interrompe
 * o que a pessoa estava fazendo.
 *
 * Não há chatbot ligado ainda. Quando houver, o único ponto a mudar é `responder()`.
 */
export function ChatDuvidas({ onFechar }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([BOAS_VINDAS]);
  const [rascunho, setRascunho] = useState('');
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  // Mensagem nova entra embaixo; sem isso ela nasceria fora da área visível.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: 'end' });
  }, [mensagens]);

  /** Ponto de entrada do assistente. É aqui que a chamada de verdade vai entrar. */
  function responder(_pergunta: string): string {
    return SEM_ASSISTENTE;
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    const pergunta = rascunho.trim();
    if (!pergunta) return;

    setMensagens((anteriores) => {
      const proximoId = anteriores.length;
      return [
        ...anteriores,
        { id: proximoId, autor: 'pessoa', texto: pergunta },
        { id: proximoId + 1, autor: 'assistente', texto: responder(pergunta) },
      ];
    });
    setRascunho('');
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
            <p className="text-xs text-white/40 mt-0.5">Assistente ainda não conectado</p>
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
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {mensagens.map((mensagem) => (
            <Balao key={mensagem.id} mensagem={mensagem} />
          ))}
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
            placeholder="Escreva sua dúvida…"
            aria-label="Sua dúvida"
            className="flex-1 min-w-0 px-4 py-2 rounded-full bg-black/30 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-accent2/60 transition"
          />
          <button
            type="submit"
            disabled={!rascunho.trim()}
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

/** Balão de uma mensagem — a da pessoa vai à direita, a do assistente à esquerda. */
function Balao({ mensagem }: { mensagem: Mensagem }) {
  const daPessoa = mensagem.autor === 'pessoa';

  return (
    <div className={`flex ${daPessoa ? 'justify-end' : 'justify-start'}`}>
      <p
        className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
          daPessoa
            ? 'bg-accent2 text-ink rounded-br-md'
            : 'bg-white/10 text-white/85 rounded-bl-md'
        }`}
      >
        {mensagem.texto}
      </p>
    </div>
  );
}
