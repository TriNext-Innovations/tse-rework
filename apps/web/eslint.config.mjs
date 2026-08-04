// ESLint 9 flat config resolves `eslint.config.*` from the directory it is run
// in, so each workspace app needs its own entry point — the shared config in
// @tse/config is not picked up implicitly.
import shared from '@tse/config/eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['.next/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  ...shared,
  // Three components already carried `eslint-disable react-hooks/exhaustive-deps`
  // comments for a plugin that was never actually loaded, so the rule they were
  // silencing had never run. Loading it makes those comments mean something.
  //
  // Deliberately NOT the plugin's `recommended-latest` preset. v7 ships the
  // React-Compiler-era rules, and `set-state-in-effect` alone errors on ten
  // existing components — CookieBanner, AuthContext, ThemeToggle and others —
  // for the ordinary "read localStorage after hydration" pattern. Adopting that
  // is a refactor with its own risk profile, not a dependency-hygiene change.
  // Enabling the rest belongs in its own issue.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
