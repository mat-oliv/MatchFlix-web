import { txt } from '../lib/idioma';
import { useDialogo } from '../lib/useDialogo';

type Props = {
  titulo?: string;
  mensagem: string;
  onFechar: () => void;
};

/** Pop-up de aviso — usado para revelar exatamente qual erro a pessoa cometeu. */
export function Aviso({ titulo = txt.ops, mensagem, onFechar }: Props) {
  const painel = useDialogo(onFechar);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-6"
      onClick={onFechar}
    >
      {/*
        O papel de diálogo fica no painel, não no fundo escuro.
        Antes ele estava no `<div>` de fora — o que dizia ao leitor de tela que a caixa
        de diálogo era a tela inteira, fundo incluído, e fazia o conteúdo coberto contar
        como parte dela.
      */}
      <div
        ref={painel}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="aviso-titulo"
        aria-describedby="aviso-mensagem"
        className="bg-panel border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl shadow-black/50 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="aviso-titulo" className="font-display text-xl text-accent mb-2">
          {titulo}
        </h2>
        <p id="aviso-mensagem" className="text-cream/90 text-sm mb-5">
          {mensagem}
        </p>
        <button
          onClick={onFechar}
          className="w-full min-h-[44px] rounded-full bg-accent2 text-ink font-semibold transition hover:brightness-110 active:scale-[0.98]"
        >
          {txt.entendi}
        </button>
      </div>
    </div>
  );
}
