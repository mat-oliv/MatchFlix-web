import { txt } from '../lib/idioma';

/**
 * Crédito à TMDB, de onde vêm todos os filmes, sinopses e pôsteres do app.
 *
 * Não é cortesia: os termos da API gratuita da TMDB exigem citar a fonte e dizer, com
 * essas palavras, que o app não é endossado por ela. Fica na tela de entrada (que todo
 * visitante vê) e no fim do menu do usuário — e não num rodapé fixo, que no celular
 * tiraria altura do card do filme.
 */
export function CreditoTmdb({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-faint text-center leading-relaxed ${className}`}>
      {txt.creditoTmdbAntes}
      <a
        href="https://www.themoviedb.org"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-cream transition"
      >
        TMDB
      </a>
      .<br />
      {txt.creditoTmdbAviso}
    </p>
  );
}
