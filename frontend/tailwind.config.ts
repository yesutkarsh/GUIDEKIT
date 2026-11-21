import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          primary: '#0A0A0C',
          elevated: '#121316',
          border: '#1F2229',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#F5F5F7',
          muted: '#8E929F',
        },
        accent: {
          emerald: '#10B981',
          'emerald-hover': '#059669',
          amber: '#F59E0B',
          rose: '#F43F5E',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
