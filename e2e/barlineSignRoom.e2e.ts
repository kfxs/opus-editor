import { test, expect } from './fixtures'

/**
 * ⭐⭐ **THE BAR RESERVES ROOM FOR ITS OWN SIGN, AND THE THREE GESTURES SURVIVE IT** — P3 of
 * docs/barline-types-plan.md §5.1 / §6.2.
 *
 * His constraint on the whole feature: *"even if we have the different barline we should be able to
 * change measure space by dragging, the same way we are doing now."* The rule that protects it is
 * §6.1's — the dividing line never leaves the boundary, so every room calculation still measures to
 * the same `x` — and what P3 adds is the other half: the bar has to ASK for the ≈1.0–1.5 staff
 * spaces the sign takes, or the sign is drawn through the bar's own last note.
 *
 * ⚠️ Browser-only, and not by preference: the reserved room only shows up as a DRAWN distance, and
 * jsdom measures every glyph as 0×0. `src/engine/layout/barlineSign.test.ts` holds the arithmetic.
 */

const SPACE = 10
/** `note↔barline`, the pair table's own row — the blank a bar keeps between its last head and the
 *  line, and the thing the sign's ink must NOT eat into. */
const NOTE_TO_BARLINE = 1.2 * SPACE

/**
 * Four bars of four quarters, with `setUp` applied before the render — then the first bar's last
 * notehead, its boundary, and every barline rect drawn near that boundary.
 *
 * ⚠️ `placed`, never a raw `x`: a bar whose shape has not changed is REUSED and translated, so its
 * glyphs keep the coordinates they were drawn at (`barlineGap.e2e.ts`'s own warning).
 */
async function drawn(score: import('@playwright/test').Page, setUp: string) {
  return score.evaluate(async ({ setUp }) => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 4) h.engine.addMeasure()
    for (let m = 1; m <= 4; m++) {
      for (const b of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: m, beat: h.frac(b, 1) })
      }
    }
    // eslint-disable-next-line no-new-func
    new Function('h', setUp)(h)
    await h.render()

    const bar = h.staves().sort((a, b) => a.measure - b.measure)[0]
    const heads = h.placed('g.notehead text')
      .filter(g => {
        const n = parseInt((g.code || '').toLowerCase(), 16)
        return n >= 0xe0a0 && n <= 0xe0ff && g.x > bar.x1 && g.x < bar.x2
          && g.y > bar.top - 40 && g.y < bar.bottom + 40
      })
      .map(g => g.x).sort((a, b) => a - b)
    const ink = h.barlines()
      .filter(r => r.x > bar.x2 - 3 * 10 && r.x <= bar.x2 + 1 && Math.abs(r.y - bar.top) < 2)
      .sort((a, b) => a.x - b.x)
    // ⚠️ **The strokes are RECTS and the dots are GLYPHS**, so `barlines()` cannot see a repeat's
    // leftmost ink — which is exactly the dots. Reading only the rects made an end repeat and a
    // final bar measure identically (9.8 both), because what differs between them is the half this
    // reader was blind to.
    const dots = h.glyphs('g.stavebarline text')
      .filter(g => g.x > bar.x2 - 3 * 10 && g.x <= bar.x2 + 1)
      .sort((a, b) => a.x - b.x)
    const leftmost = Math.min(ink[0]?.x ?? bar.x2, dots[0]?.x ?? bar.x2)
    return { x1: bar.x1, x2: bar.x2, lastHead: heads[heads.length - 1], heads, ink, dots, leftmost }
  }, { setUp })
}

test('⭐⭐ a final barline never comes closer to the last note than the pair table allows', async ({ score }) => {
  const plain = await drawn(score, '')
  const final = await drawn(score, `h.engine.setBarlineStyle(1, 'final')`)

  // ⭐⭐ **THE INVARIANT, and it is the whole of §5.2.** The gap is measured to the sign's leftmost
  //   INK, not to the line — LilyPond's `space-to-barline` — so a wide sign never eats the blank the
  //   pair table owes the bar's last note.
  const signLeft = final.leftmost
  expect(final.ink.length, 'the final bar drew both its strokes').toBe(2)
  expect(final.dots, 'and no dots').toHaveLength(0)
  expect(final.x2 - signLeft, 'and it is ≈1 staff space of ink').toBeGreaterThan(0.9 * SPACE)
  expect(signLeft - final.lastHead, 'the note keeps its whole note↔barline blank')
    .toBeGreaterThanOrEqual(NOTE_TO_BARLINE)

  // ⚠️ **The bar GROWS rather than the note moving, and that is the correct outcome** — measured, not
  //   assumed. The gap before a barline already carries a SPRING (a quarter earns ~3.5 spaces), so a
  //   sign whose ink fits inside that spring costs nothing at all; one that does not raises the gap's
  //   FLOOR and the bar asks the line for more room. Either way the note is never squeezed: what may
  //   not happen is the ink closing on it, which is the assertion above.
  expect(final.x2 - final.lastHead, 'the run-out never shrinks for having a sign')
    .toBeGreaterThanOrEqual(plain.x2 - plain.lastHead)
})

test('⭐ an end repeat is wider ink, so it asks the line for more room than a final bar', async ({ score }) => {
  const final = await drawn(score, `h.engine.setBarlineStyle(1, 'final')`)
  const repeat = await drawn(score, `h.engine.setRepeatEnd(1, true)`)

  // ≈1.54 spaces against ≈0.98 — the dots and their separation, which is the whole difference, and
  // the two strokes are identical between them (Gould p. 39: a repeat "uses the final double barline
  // design together with repeat dots"). So the comparison has to be on the sign's LEFTMOST ink.
  expect(repeat.dots, 'the repeat drew its dots').toHaveLength(2)
  expect(repeat.x2 - repeat.leftmost, 'the repeat reaches further back into its bar')
    .toBeGreaterThan(final.x2 - final.leftmost)
  expect(repeat.leftmost - repeat.lastHead, 'and its dots still clear the last note')
    .toBeGreaterThanOrEqual(NOTE_TO_BARLINE)
  // ⭐ Here the sign's ink no longer fits inside the gap's own spring, so the FLOOR rises and the bar
  //   asks the line for more room — the trailing width term of §5.1, visible as a wider bar.
  expect(repeat.x2, 'the bar itself widened to hold it').toBeGreaterThan(final.x2)
})

test('⭐ a bar that OPENS a repeat starts its music after the sign, not under it', async ({ score }) => {
  // ⚠️ Bar 2, not bar 1: bar 1 draws a clef and a meter, which displaces its repeat past the header
  // (Gould p. 234) — a different case, pinned in `barlineTypes.e2e.ts`.
  const read = `
    const bar = h.staves().find(s => s.measure === 2)
    const heads = h.placed('g.notehead text')
      .filter(g => {
        const n = parseInt((g.code || '').toLowerCase(), 16)
        return n >= 0xe0a0 && n <= 0xe0ff && g.x > bar.x1 && g.x < bar.x2
          && g.y > bar.top - 40 && g.y < bar.bottom + 40
      })
      .map(g => g.x).sort((a, b) => a - b)
    return { x1: bar.x1, firstHead: heads[0], dots: h.glyphs('g.stavebarline text').filter(g => g.x > bar.x1 && g.x < bar.x2) }`

  const build = async (setUp: string) => score.evaluate(async ({ setUp, read }) => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 4) h.engine.addMeasure()
    for (let m = 1; m <= 4; m++) {
      for (const b of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: m, beat: h.frac(b, 1) })
      }
    }
    // eslint-disable-next-line no-new-func
    new Function('h', setUp)(h)
    await h.render()
    // eslint-disable-next-line no-new-func
    return new Function('h', read)(h) as { x1: number; firstHead: number; dots: { x: number }[] }
  }, { setUp, read })

  const plain = await build('')
  const opened = await build(`h.engine.setRepeatStart(2, true)`)

  expect(opened.dots, 'the sign is drawn inside bar 2').toHaveLength(2)
  // ⭐ The LEADING term (§5.1): the bar reserves the sign's width at its start, `applyLeadIn` spends
  //   it, and the first note therefore begins past the dots instead of on top of them.
  const lastDot = Math.max(...opened.dots.map(d => d.x))
  expect(opened.firstHead, 'the first note clears the dots').toBeGreaterThan(lastDot)
  expect(opened.firstHead - opened.x1, 'starting further into the bar than one with no sign')
    .toBeGreaterThan(plain.firstHead - plain.x1)
})

test('⭐⭐ the bar-width nudge still moves the barline by exactly what was asked', async ({ score }) => {
  // His constraint, measured. `Ctrl+→` is the keyboard half of the bar-width drag, and the sign must
  // not change its arithmetic by a pixel — the boundary it moves is the same `x` it always was.
  const moved = await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 4) h.engine.addMeasure()
    for (let m = 1; m <= 4; m++) {
      for (const b of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: m, beat: h.frac(b, 1) })
      }
    }
    h.engine.setRepeatEnd(1, true)
    await h.render()
    const before = h.staves().find(s => s.measure === 1)!.x2
    h.engine.nudgeBarWidth(1, 20)
    await h.render()
    const after = h.staves().find(s => s.measure === 1)!.x2
    return { before, after }
  })

  expect(moved.after - moved.before, 'the barline moved by what was asked').toBeCloseTo(20, 0)
})

test('⭐ the barline-gap room is measured to the SIGN, so a nudge cannot squeeze the last note into it', async ({ score }) => {
  const room = await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 4) h.engine.addMeasure()
    for (let m = 1; m <= 4; m++) {
      for (const b of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: m, beat: h.frac(b, 1) })
      }
    }
    await h.render()
    const plain = h.engine.barlineGapRoom(1)
    h.engine.setRepeatEnd(1, true)
    await h.render()
    return { plain, withSign: h.engine.barlineGapRoom(1) }
  })

  // 🚨 The floor rose by the sign's own reach, so the room left to give up fell by it. Without this
  // `Shift+←` would close the gap onto the boundary and draw the repeat dots over the last note.
  expect(room.plain, 'a plain bar has some gap to give').not.toBeNull()
  expect(room.withSign, 'and so does a signed one — it just has less').not.toBeNull()
  expect(room.withSign!, 'the sign keeps ≈1.5 spaces the plain line did not').toBeLessThan(room.plain! - 1)
})
