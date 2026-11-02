import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Fight night" arena: near-black stage, blue corner (you) vs orange corner (rival)
        ink: '#0A0B10',
        well: '#07080C',
        panel: '#11131B',
        raised: '#1A1D28',
        line: '#262A38',
        text: '#ECEDF3',
        muted: '#959AB0',
        faint: '#60657B',
        you: '#38D6F5',
        rival: '#FF8F2B',
        pass: '#4BE38A',
        fail: '#FF5A5F',
        easy: '#4BE38A',
        medium: '#FFC23D',
        hard: '#FF5A5F',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'clock-pulse': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        sweep: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } },
        'rise-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
        'ghost-blink': { '0%, 100%': { opacity: '0.35' }, '50%': { opacity: '0.9' } },
      },
      animation: {
        'clock-pulse': 'clock-pulse 1s ease-in-out infinite',
        sweep: 'sweep 1.6s ease-in-out infinite',
        'rise-in': 'rise-in 0.5s ease-out both',
        'ghost-blink': 'ghost-blink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
