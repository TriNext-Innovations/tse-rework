import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Strip Next.js 'use client' / 'use server' directives — Vite doesn't understand them
const stripNextDirectives: Plugin = {
  name: 'strip-next-directives',
  enforce: 'pre',
  transform(code) {
    if (/^['"]use (client|server)['"]/m.test(code)) {
      return { code: code.replace(/^['"]use (client|server)['"]\s*;?\s*\n?/m, ''), map: null }
    }
  },
}

export default defineConfig({
  plugins: [react(), stripNextDirectives],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/components/ui/**',
        'src/app/layout.tsx',
        'src/app/(main)/**',
        'src/app/(storefront)/layout.tsx',
        'src/lib/woocommerce.ts',
        'src/lib/medusa.ts',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        'node_modules/**',
        '.next/**',
      ],
      // Set just under current actuals so the suite gates against regressions.
      // Ratchet these up as real test coverage is added across the app.
      thresholds: {
        lines: 24,
        functions: 42,
        branches: 70,
        statements: 24,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
