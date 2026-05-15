import type { Config } from 'tailwindcss'

/*
 * Brand colour utilities are driven entirely by CSS variables defined in
 * globals.css. This file never needs changing for a rebrand — edit globals.css.
 *
 * Usage:  bg-brand-primary, text-brand-text, border-brand-border
 * With opacity modifiers: bg-brand-primary/50, text-brand-text-muted/75
 */
const config: Partial<Config> = {
  content: [],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:    'hsl(var(--brand-primary) / <alpha-value>)',
          'primary-foreground': 'hsl(var(--brand-primary-foreground) / <alpha-value>)',
          secondary:  'hsl(var(--brand-secondary) / <alpha-value>)',
          'secondary-foreground': 'hsl(var(--brand-secondary-foreground) / <alpha-value>)',
          accent:     'hsl(var(--brand-accent) / <alpha-value>)',
          'accent-foreground': 'hsl(var(--brand-accent-foreground) / <alpha-value>)',
          bg:         'hsl(var(--brand-bg) / <alpha-value>)',
          surface:    'hsl(var(--brand-surface) / <alpha-value>)',
          border:     'hsl(var(--brand-border) / <alpha-value>)',
          text:       'hsl(var(--brand-text) / <alpha-value>)',
          'text-muted': 'hsl(var(--brand-text-muted) / <alpha-value>)',
          destructive: 'hsl(var(--brand-destructive) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}

export default config
