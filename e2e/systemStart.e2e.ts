import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * ⭐⭐ **THE BRACKET, AS IT IS ACTUALLY DRAWN** — P3 of docs/braces-brackets-plan.md.
 *
 * This cannot be a unit test even in principle, and the plan's done-condition says so: *"an e2e test
 * measures the drawn rod against the staves it spans"*. jsdom has no fonts, so the serif glyphs
 * measure 0×0 there and every claim about where their ink landed agrees with itself. The unit spec
 * beside the module pins the ARITHMETIC (rod width, the group, which glyph at which origin); this
 * pins the **ink**.
 *
 * Four things that would each be silently wrong on their own:
 *  - the rod spans **staff line to staff line**, across both staves — not one staff, not the slots;
 *  - it is **0.50 staff spaces** thick, the one number Gould, Ross and Bravura all state identically;
 *  - it stands **clear of the systemic barline**, on its LEFT — and the music starts to the right of
 *    it, which is the whole of P2's indent arriving in the picture;
 *  - the serifs **hook RIGHT, over the barline** — the direction that makes it a bracket and not a
 *    staple, and the reason the room it needs on the left is the rod's and not the tip's.
 */

/** A braced-staves score with a BRACKET authored on the group the model already made. */
async function bracketedSystem(score: Page): Promise<void> {
  await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    for (const staff of [0, 1]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1), staff })
    }
    // ⭐ `addStaff` has ALREADY created the group — this supplies only the `symbol`, which is exactly
    //   the half a user authors and the model's auto-writer never invents.
    h.engine.getScore().staffGroups![0].symbol = 'bracket'
    await h.render()
  })
}

/** The same score with no `symbol`, for the comparisons that need a "before". */
async function plainSystem(score: Page): Promise<void> {
  await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    for (const staff of [0, 1]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1), staff })
    }
    await h.render()
  })
}

/** The rod: the one rect in the grouping-sign layer. */
async function rod(score: Page) {
  return score.evaluate(() => {
    const svg = document.querySelector('svg')!
    const toScore = svg.getScreenCTM()!.inverse()
    const rects = [...svg.querySelectorAll<SVGRectElement>('g.vf-systemsign rect')]
    return rects.map(r => {
      const box = r.getBoundingClientRect()
      const p = svg.createSVGPoint()
      p.x = box.left; p.y = box.top
      const at = p.matrixTransform(toScore)
      const ctm = svg.getScreenCTM()!
      return { x: at.x, y: at.y, w: box.width / ctm.a, h: box.height / ctm.d }
    })
  })
}

/** One staff space, in the score's own units — read off the drawn staff rather than assumed. */
async function staffSpace(score: Page): Promise<number> {
  return score.evaluate(() => {
    const s = window.__h.staves()[0]
    return (s.bottom - s.top) / 4 // four spaces between the outer lines of a five-line staff
  })
}

test('⭐⭐ the rod spans staff line to staff line, across BOTH staves', async ({ score }) => {
  await bracketedSystem(score)
  const [bar] = await rod(score)
  const staves = await score.evaluate(() => window.__h.staves().filter(s => s.measure === 1))
  expect(staves, 'two staves drawn').toHaveLength(2)

  const top = Math.min(...staves.map(s => s.top))
  const bottom = Math.max(...staves.map(s => s.bottom))
  const space = await staffSpace(score)

  // ⭐⭐ **The rod EXCEEDS each outer staff line before its wing caps it** — his correction,
  //    2026-08-29: *"what you have to look is how much the wings are from the top or bottom of the
  //    pentagram… the problem is how much the LINE of the bracket exceeds the limit"*. Verovio's
  //    0.325 sp, taken with its natural-size wing as one package (`BRACKET_ROD_PROJECTION_SPACES`).
  //    ⚠️ Plus the staff line's own thickness, which `staves().top` reports as the line's ink top.
  // ⭐ `staffLineThickness + ½ rod` = 0.13 + 0.25 = 0.38 sp, plus the ~0.05 sp that `staves().top`
  //   reports as the staff line's own ink top ⇒ ≈0.43 sp as drawn.
  expect((top - bar.y) / space, 'the rod passes the top staff line').toBeCloseTo(0.43, 1)
  expect(((bar.y + bar.h) - bottom) / space, 'and the bottom one').toBeCloseTo(0.43, 1)
})

test('is 0.50 staff spaces thick — Gould p. 516, Ross p. 155, Bravura’s `bracketThickness`', async ({ score }) => {
  await bracketedSystem(score)
  const [bar] = await rod(score)
  const space = await staffSpace(score)
  expect(bar.w / space).toBeCloseTo(0.5, 1)
})

test('⭐⭐ stands to the LEFT of the systemic barline, clear of it', async ({ score }) => {
  await bracketedSystem(score)
  const [bar] = await rod(score)
  const space = await staffSpace(score)
  const left = await score.evaluate(() => Math.min(...window.__h.staves()
    .filter(s => s.measure === 1).map(s => s.x1)))

  expect(bar.x + bar.w, 'the rod ends before the staves begin').toBeLessThan(left)
  // ⭐ The clearance the treatises MEASURED (0.35–0.45, research §3.3) at its top, which is also
  //   MuseScore's own `bracketDistance` — `SIGN_TO_BARLINE_SPACES`.
  expect((left - (bar.x + bar.w)) / space).toBeCloseTo(0.45, 1)
})

test('⭐⭐ …and the MUSIC moved right to make room for it — P2’s indent, in the picture', async ({ score }) => {
  await plainSystem(score)
  const plainLeft = await score.evaluate(() => window.__h.staves()[0].x1)

  await score.reload()
  await score.waitForFunction(() => !!window.__h)
  await bracketedSystem(score)
  const bracketedLeft = await score.evaluate(() => window.__h.staves()[0].x1)
  const [bar] = await rod(score)

  expect(bracketedLeft, 'the staves start further right than they did').toBeGreaterThan(plainLeft)
  // ⭐⭐ …by the sign's own reach PLUS the air it keeps from the page margin. 🚨 His report,
  //    2026-08-29: *"brackets are almost touching the border"* — measured at 0.00 sp, because the
  //    indent used to be exactly the rod's left edge. The rod now stands one separation inside it.
  const space = await staffSpace(score)
  const airAtMargin = (bracketedLeft - plainLeft) - (bracketedLeft - bar.x)
  expect(airAtMargin / space, 'the sign is clear of the margin, not flush with it').toBeCloseTo(0.4, 1)
})

test('🚨 the serifs hook RIGHT, over the barline — ⛔ not left, and not merely up', async ({ score }) => {
  await bracketedSystem(score)
  const [bar] = await rod(score)
  const serifs = await score.evaluate(() => {
    const svg = document.querySelector('svg')!
    const toScore = svg.getScreenCTM()!.inverse()
    const ctm = svg.getScreenCTM()!
    return [...svg.querySelectorAll<SVGTextElement>('g.vf-systemsign text')].map(t => {
      const box = t.getBoundingClientRect()
      const p = svg.createSVGPoint()
      p.x = box.left; p.y = box.top
      const at = p.matrixTransform(toScore)
      return { code: t.textContent!.codePointAt(0)!.toString(16), x: at.x, y: at.y,
               w: box.width / ctm.a, h: box.height / ctm.d }
    }).sort((a, b) => a.y - b.y)
  })

  expect(serifs.map(s => s.code), 'bracketTop and bracketBottom').toEqual(['e003', 'e004'])
  const staffLeft = await score.evaluate(() => Math.min(...window.__h.staves()
    .filter(s => s.measure === 1).map(s => s.x1)))

  for (const serif of serifs) {
    // Its ink begins at the rod and reaches PAST the barline — the overhang Gould measures at 1.75 sp
    // from the stroke's left edge, which is what makes the room it needs on the left the rod's alone.
    expect(Math.abs(serif.x - bar.x), 'springs from the rod’s own left edge').toBeLessThan(1.5)
    expect(serif.x + serif.w, 'and hooks right, past the staves’ edge').toBeGreaterThan(staffLeft)
  }

  // The top serif is ABOVE the rod's top and the bottom one BELOW its bottom — they project.
  expect(serifs[0].y).toBeLessThan(bar.y + 1)
  expect(serifs[1].y + serifs[1].h).toBeGreaterThan(bar.y + bar.h - 1)
})

test('⛔ a group with no symbol draws nothing at all — the gate, at the pen', async ({ score }) => {
  await plainSystem(score)
  expect(await rod(score), 'no grouping sign was drawn').toHaveLength(0)
})
