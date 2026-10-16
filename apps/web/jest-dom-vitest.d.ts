// jest-dom 7.0.1 augments vitest's `Assertion<T>`, but vitest 5 declares
// `Assertion<R, T>` (R is the matcher's return: void, or Promise<void> under
// `expect.poll`/`.resolves`). The one-parameter declaration does not merge, so
// toBeInTheDocument() and friends vanish from the types while still working at
// runtime. Delete this once jest-dom ships vitest 5 types.
import 'vitest'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  interface Assertion<R, T> extends TestingLibraryMatchers<unknown, R> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
