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
    },
  },
  plugins: [],
};
