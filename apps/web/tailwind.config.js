/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0e17',
        'bg-secondary': '#111827',
        'bg-card': '#182235',
        'bg-card-hover': '#1e2a40',
        'accent-orange': '#ee4d2d',
        'accent-orange-2': '#ff6b3d',
        'accent-green': '#10b981',
        'accent-blue': '#3b82f6',
        'accent-yellow': '#f59e0b',
        'accent-purple': '#8b5cf6',
        'accent-red': '#ef4444',
        'text-primary': '#f8fafc',
        'text-secondary': '#cbd5e1',
        'text-muted': '#64748b',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Sora', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
