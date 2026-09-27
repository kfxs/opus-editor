import { test as base, expect, type Download, type Page } from '@playwright/test'
import type { Harness } from './harness'

/**
 * The one setup every geometry spec shares: open the harness page, wait for the engine to exist,
 * and fail the test if anything threw while the score was being drawn.
 *
 * That last part matters more than it looks. A renderer pass that throws half-way leaves a
 * PARTIALLY drawn score — VexFlow has already emitted everything before the throw — so a spec
 * asserting "there are four noteheads" can pass over a broken render. An uncaught error is a
 * failure whether or not the assertions happen to survive it.
 */
export const test = base.extend<{ score: Page }>({
  score: async ({ page }, use) => {
    const crashes: string[] = []
    page.on('pageerror', error => crashes.push(String(error)))
    // `/opus-editor/` is vite.config.ts's `base`, which the dev server honours as a path prefix.
    await page.goto('/opus-editor/e2e/harness.html')
    await page.waitForFunction(() => !!window.__h)
    // ⭐ `PW_SLUR_SOLVER=lilypond npm run test:e2e` runs the whole net under another slur PRESET
    //   (docs/plans/slur-search-plan.md P4) — what fails is a difference to REPORT, ⛔ not to fix.
    const solver = process.env.PW_SLUR_SOLVER
    if (solver) {
      const armed = await page.evaluate(name => window.__h.slurSolver(name), solver)
      if (!armed) throw new Error(`PW_SLUR_SOLVER: no slur solver named ${solver}`)
    }

    await use(page)

    expect(crashes, 'nothing threw in the page').toEqual([])
  },
})

export { expect }

/** Re-exported so a spec can name the types it is handling. */
export type { Download, Harness }
