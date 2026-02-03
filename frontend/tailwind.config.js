/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chimera: {
          dark: '#0a0a0f',
          darker: '#050508',
          accent: '#00d4aa',
          'accent-dim': '#00a888',
          gold: '#ffd700',
          'gold-dim': '#b8860b',
          purple: '#8b5cf6',
          'purple-dim': '#6d28d9',
          red: '#ef4444',
          green: '#22c55e',
          blue: '#3b82f6',
          muted: '#6b7280',
          surface: 'rgba(255, 255, 255, 0.03)',
          'surface-hover': 'rgba(255, 255, 255, 0.06)',
          border: 'rgba(255, 255, 255, 0.08)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'chimera-gradient': 'linear-gradient(135deg, rgba(0,212,170,0.1) 0%, rgba(139,92,246,0.1) 100%)',
        'price-back': 'linear-gradient(180deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 100%)',
        'price-lay': 'linear-gradient(180deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.05) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0,212,170,0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0,212,170,0.4)' },
        }
      }
    },
  },
  plugins: [],
}
