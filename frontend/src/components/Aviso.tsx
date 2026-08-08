import { txt } from '../lib/idioma';

type Props = {
  titulo?: string;
  mensagem: string;
  onFechar: () => void;
};

/** Pop-up de aviso — usado para revelar exatamente qual erro a pessoa cometeu. */
export function Aviso({ titulo = txt.ops, mensagem, onFechar }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-6"
      role="alertdialog"
      aria-modal="true"
      onClick={onFechar}
    >
      <div
        className="bg-panel border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-accent mb-2">{titulo}</h2>
        <p className="text-white/80 text-sm mb-5">{mensagem}</p>
        <button
          autoFocus
          onClick={onFechar}
          className="w-full py-2 rounded-full bg-accent2 text-ink font-semibold hover:brightness-110 transition"
        >
          {txt.entendi}
        </button>
      </div>
    </div>
  );
}
