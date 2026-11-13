import { defineConfig, devices } from '@playwright/test'

/**
 * Full-stack E2E (#571) — the real Medusa backend, seeded Postgres, Meilisearch
 * and the storefront's production build, all started by scripts/e2e-fullstack.sh.
 * Unlike playwright.config.ts (fixtures, no backend), a red run here means a
 * customer can't do something on the real stack.
 */
export default defineConfig({
  testDir: 'e2e-fullstack',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1, // one shared database; specs create their own carts and customers
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-fullstack' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /order\.spec/ },
  ],
})
