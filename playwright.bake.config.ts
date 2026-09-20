import { defineConfig, devices } from '@playwright/test'

/**
 * `npm run bake:keypad` — NOT a test run: a one-off browser step that WRITES
 * `src/windows/keypad/keypadBakedIcons.ts` (see e2e/keypadIcons.bake.ts). Same server as the
 * geometry suite; its own `testMatch`, so `npm run test:e2e` never bakes anything.
 */
const PORT = 5199

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.bake.ts',
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, deviceScaleFactor: 1 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/opus-editor/e2e/harness.html`,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
