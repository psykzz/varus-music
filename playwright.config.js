// @ts-check
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // run serially — tests share a single backend DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Expect the dev servers to already be running (npm run dev).
  // Set START_SERVERS=1 to have Playwright spin them up automatically.
  ...(process.env.START_SERVERS
    ? {
        webServer: [
          {
            command: 'npm run dev:backend',
            url: 'http://localhost:3001/api/onboarding/genres',
            reuseExistingServer: true,
            timeout: 30_000,
            env: { DATABASE_URL: 'file:./dev.db' },
          },
          {
            command: 'npm run dev:frontend',
            url: 'http://localhost:5173',
            reuseExistingServer: true,
            timeout: 30_000,
          },
        ],
      }
    : {}),
})
