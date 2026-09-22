/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b1523',
        panel: '#201c2e',
        accent: '#ff5470',
        accent2: '#2dd4bf',
        cream: '#f5f0ff',

        /*
         * Níveis de texto e de borda com contraste conferido contra os DOIS fundos do
         * app (`ink` e `panel`), pela fórmula da WCAG.
         *
         * Existem porque `text-white/40` não passa: dá 3,83:1 sobre o `ink` e 3,77:1
         * sobre o `panel`, contra o mínimo de 4,5:1 que a própria tabela da Apple adota
         * (`accessibility.md › Vision`). Estava em uso em uma dúzia de lugares — número
         * da posição no ranking, legenda de pôster, rodapé do cadastro, contadores do
         * menu. Opacidade sobre fundo escuro engana: parece discreto e é ilegível.
         *
         * Use estes tokens para texto secundário em vez de `text-white/NN`. Se um dia
         * mudar o fundo, reconfira os números — eles valem para este par de fundos.
         */
        muted: '#a09aab', // 6,54:1 no ink · 6,08:1 no panel — texto secundário
        faint: '#968fa2', // 5,73:1 no ink · 5,33:1 no panel — legenda miúda
        edge: '#726a88', // 3,51:1 no ink · 3,26:1 no panel — limite de campo (mínimo 3:1)
      },

      /*
       * Troca de card no feed: o filme votado encolhe até o centro e o seguinte nasce
       * do centro, crescendo.
       *
       * As durações são curtas de propósito. Votar é a ação mais repetida do app —
       * centenas de vezes por sessão — e `motion.md` pede movimento "purposeful, brief,
       * and rare on frequent interactions". Aqui ele não é raro, então tem de ser breve:
       * cada metade some antes de virar espera. A saída é mais rápida que a entrada
       * porque o card que sai já não interessa; quem a pessoa quer ver é o próximo.
       *
       * `forwards` na saída segura o card encolhido até o React trocar o filme — sem
       * ele, o card reapareceria em tamanho normal por um quadro antes de sumir.
       *
       * Quem pediu menos movimento no sistema não vê nada disso: a regra de
       * `prefers-reduced-motion` no `index.css` zera a duração, e a troca fica imediata
       * (ver o comentário em `SwipeScreen`, que depende do `animationend`).
       */
      keyframes: {
        'encolher-ao-centro': {
          from: { transform: 'scale(1)', opacity: '1' },
          to: { transform: 'scale(0)', opacity: '0' },
        },
        'surgir-do-centro': {
          from: { transform: 'scale(0)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'encolher-ao-centro': 'encolher-ao-centro 150ms ease-in forwards',
        'surgir-do-centro': 'surgir-do-centro 190ms ease-out',
      },
    },
  },
  plugins: [],
};
