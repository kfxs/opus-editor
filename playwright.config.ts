import { defineConfig, devices } from '@playwright/test'

/**
 * `npm run test:e2e` — the GEOMETRY net (docs/refactor-plan-2026-07-27.md Phase 5).
 *
 * The unit suite runs in jsdom, which has no layout engine and no fonts, so every glyph measures
 * 0×0 and an assertion about engraved geometry passes vacuously. These specs run the real engine in
 * a real browser against `e2e/harness.html`, so the pixels are pixels. They are deliberately a
 * SMALL net — enough to catch a code-motion regression in the renderer, not a picture-perfect
 * golden of every feature.
 *
 * A dedicated port, so a run never fights (or silently reuses) the `npm run dev` server a person
 * has open on 5173. `reuseExistingServer` then applies to THIS server only, which makes a repeat
 * run instant.
 */
const PORT = 5199

export default defineConfig({
  testDir: './e2e',
  // `*.e2e.ts`, not `*.spec.ts`: vitest's default glob picks up `*.spec.ts`, and `npm run test`
  // would then try to run these in jsdom — where they cannot even launch a browser.
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries, on purpose. A geometry assertion is deterministic: the same engine, the same font,
  // the same browser build. A test that only passes on the second run is telling us something, and
  // a retry would swallow it.
  retries: 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    // The base from vite.config.ts is part of the path: the dev server serves the harness under it.
    url: `http://localhost:${PORT}/opus-editor/e2e/harness.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
