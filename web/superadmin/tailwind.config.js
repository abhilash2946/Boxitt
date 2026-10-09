/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        'background-secondary': 'var(--color-background-secondary)',
        card: 'var(--color-card)',
        'card-elevated': 'var(--color-card-elevated)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-disabled': 'var(--color-text-disabled)',
        accent: 'var(--color-accent)',
        'accent-glow': 'var(--color-accent-glow)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
      },
      borderRadius: {
        'theme-sm': 'var(--radius-small)',
        'theme-md': 'var(--radius-medium)',
        'theme-lg': 'var(--radius-large)',
      },
      boxShadow: {
        'theme-card': 'var(--elevation-card)',
        'theme-elevated': 'var(--elevation-elevated)',
        'theme-floating': 'var(--elevation-floating)',
        'theme-modal': 'var(--elevation-modal)',
      }
    },
  },
  plugins: [],
}
