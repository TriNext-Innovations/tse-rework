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
        /* shadcn semantic tokens — required for @apply bg-background, border-border etc. */
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        /* TSE brand utilities — change values in globals.css Brand Tokens block only */
        brand: {
          primary:              'hsl(var(--brand-primary) / <alpha-value>)',
          'primary-foreground': 'hsl(var(--brand-primary-foreground) / <alpha-value>)',
          secondary:            'hsl(var(--brand-secondary) / <alpha-value>)',
          'secondary-foreground': 'hsl(var(--brand-secondary-foreground) / <alpha-value>)',
          accent:               'hsl(var(--brand-accent) / <alpha-value>)',
          'accent-foreground':  'hsl(var(--brand-accent-foreground) / <alpha-value>)',
          bg:                   'hsl(var(--brand-bg) / <alpha-value>)',
          surface:              'hsl(var(--brand-surface) / <alpha-value>)',
          border:               'hsl(var(--brand-border) / <alpha-value>)',
          text:                 'hsl(var(--brand-text) / <alpha-value>)',
          'text-muted':         'hsl(var(--brand-text-muted) / <alpha-value>)',
          destructive:          'hsl(var(--brand-destructive) / <alpha-value>)',
          /* CMYK logo palette — bg-brand-cmyk-cyan, text-brand-cmyk-magenta etc. */
          cmyk: {
            cyan:    'hsl(var(--brand-cmyk-cyan) / <alpha-value>)',
            lime:    'hsl(var(--brand-cmyk-lime) / <alpha-value>)',
            magenta: 'hsl(var(--brand-cmyk-magenta) / <alpha-value>)',
            black:   'hsl(var(--brand-cmyk-black) / <alpha-value>)',
          },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl':['3rem',     { lineHeight: '1' }],
        '6xl':['3.75rem',  { lineHeight: '1' }],
        '7xl':['4.5rem',   { lineHeight: '1' }],
        '8xl':['6rem',     { lineHeight: '1' }],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
