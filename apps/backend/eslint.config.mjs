// ESLint 9 flat config resolves `eslint.config.*` from the directory it is run
// in, so each workspace app needs its own entry point — the shared config in
// @tse/config is not picked up implicitly.
import shared from '@tse/config/eslint'

export default [
  { ignores: ['dist/**', '.medusa/**'] },
  ...shared,
]
