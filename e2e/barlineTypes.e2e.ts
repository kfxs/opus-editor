import { test, expect } from './fixtures'

/**
 * **The three signs, drawn** — P2 of docs/barline-types-plan.md, measured in a browser.
 *
 * Here and not in the unit suite because every claim below is a POSITION. jsdom has no layout and no
 * fonts, so a barline's ink measures 0×0 there and any assertion about it agrees with itself. The
 * arithmetic that decides these numbers is unit-tested beside its module
 * (`src/engine/layout/barlineSign.test.ts`); this file is the half that can only be seen once
 * something has actually been drawn.
 *
 * ⭐ The harness draws at 1:1, and one staff space is 10 units — so 0.16 spaces is 1.6, 0.32 is 3.2
 * and 0.50 is 5.
 */

const SPACE = 10
const THIN = 0.16 * SPACE
const THICK = 0.5 * SPACE
const SEPARATION = 0.32 * SPACE

/** Every barline rect within half a space of `x`, nearest first — one boundary's ink. */
type Rect = { x: number; y: number; inkX: number; width: number; height: number }
function at(rects: Rect[], x: number): Rect[] {
  return rects.filter(r => r.x > x - 2 * SPACE && r.x < x + 2 * SPACE).sort((a, b) => a.x - b.x)
}

/** A score of `bars` empty measures with `setUp` applied to the engine before the render. */
async function drawn(score: import('@playwright/test').Page, bars: number, setUp: string) {
  return score.evaluate(async ({ bars, setUp }) => {
    const h = window.__h
    while (h.engine.getScore().measures.length < bars) h.engine.addMeasure()
    // eslint-disable-next-line no-new-func
    new Function('h', setUp)(h)
    await h.render()
    return {
      rects: h.barlines(),
      staves: h.staves(),
      // The repeat dots are GLYPHS (`repeatDot`, U+E044) — the same code point MuseScore, Verovio
      // and LilyPond each draw — so they are counted as text, never as rects.
      dots: h.glyphs('g.vf-stavebarline text'),
    }
  }, { bars, setUp })
}

test('⭐⭐ a final barline is thin + THICK, and the THICK line ends exactly on the boundary', async ({ score }) => {
  const { rects, staves, dots } = await drawn(score, 4, `h.engine.setBarlineStyle(2, 'final')`)
  const boundary = staves.find(s => s.measure === 2)!.x2

  const ink = at(rects, boundary)
  expect(ink, 'two strokes, and only two').toHaveLength(2)
  const [thin, thick] = ink

  // ⭐⭐ THE GEOMETRY RULE (§6.1): the dividing line stays on the boundary and the sign grows INTO
  // the bar it ends. Growing rightward — the first draft's rule — would hang the thick line past the
  // end of the drawn staff lines, attached to nothing.
  expect(thick.width, 'the thick line is 0.5 spaces').toBeCloseTo(THICK, 1)
  expect(thick.x + thick.width, 'and its RIGHT edge is the bar boundary').toBeCloseTo(boundary, 1)
  expect(thin.width, 'the thin line is the score\'s own thin-line weight').toBeCloseTo(THIN, 1)
  expect(thin.x + thin.width, 'separated from the thick one by Gould\'s measured gap').toBeCloseTo(thick.x - SEPARATION, 1)

  // Nothing past the boundary, and ≈1.0 space before it — which is what her engraved page measures.
  expect(boundary - thin.x, 'the whole sign is ≈1 staff space of ink').toBeCloseTo(0.98 * SPACE, 1)
  expect(dots, 'a final bar has no dots').toHaveLength(0)
})

test('every other boundary keeps the plain single line it always had', async ({ score }) => {
  const { rects, staves } = await drawn(score, 5, `h.engine.setBarlineStyle(3, 'final')`)

  for (const bar of [1, 2, 4]) {
    const boundary = staves.find(s => s.measure === bar)!.x2
    const ink = at(rects, boundary).filter(r => Math.abs(r.x - boundary) < 1)
    expect(ink, `bar ${bar} draws one plain line`).toHaveLength(1)
    // ⚠️ The plain line is the one sign whose ink is to the RIGHT of the boundary, where it has
    // always been. Moving it to match the composite signs would move every barline in every score.
    expect(ink[0].x, 'its LEFT edge is the boundary').toBeCloseTo(boundary, 1)
    expect(ink[0].width, 'at the thin-line weight, hinted to whole pixels').toBeGreaterThanOrEqual(1)
  }
})

test('⭐⭐ an open repeat draws INSIDE the bar it opens, and the bar before it draws no line of its own', async ({ score }) => {
  const { rects, staves, dots } = await drawn(score, 4, `h.engine.setRepeatStart(3, true)`)
  const boundary = staves.find(s => s.measure === 2)!.x2
  expect(boundary, 'bar 3 opens where bar 2 ends').toBeCloseTo(staves.find(s => s.measure === 3)!.x1, 1)

  const ink = at(rects, boundary)
  // 🚨 THE SUPPRESSION RULE. Bar 2 would have drawn a plain line here; the sign at this boundary is
  // bar 3's `|:`, and a boundary carries ONE sign. Three rects would mean the old line survived.
  expect(ink, 'THICK + thin, and no leftover plain line').toHaveLength(2)
  const [thick, thin] = ink
  expect(thick.x, 'the thick line\'s LEFT edge is the boundary — it grows into the bar it opens').toBeCloseTo(boundary, 1)
  expect(thick.width).toBeCloseTo(THICK, 1)
  expect(thin.x, 'then the gap, then the thin line').toBeCloseTo(thick.x + THICK + SEPARATION, 1)

  expect(dots, 'two repeat dots').toHaveLength(2)
  for (const dot of dots) {
    expect(dot.code, 'drawn as the SMuFL glyph repeatDot, not a shape of our own').toBe('e044')
    expect(dot.x, 'to the right of the thin line, inside the bar').toBeGreaterThan(thin.x)
  }
  // The two dots share an x and straddle the staff's middle line: on five lines, the 2nd and 3rd
  // spaces from the bottom. One staff space apart, and symmetric about the middle.
  expect(dots[0].x).toBeCloseTo(dots[1].x, 1)
  expect(Math.abs(dots[0].y - dots[1].y), 'one space apart').toBeCloseTo(SPACE, 1)
  // ⚠️ **Within a pixel, not to a pixel, and the slack is a real half-pixel that belongs to VexFlow.**
  // A drawn stave line is snapped half a pixel off the geometric grid (that is what keeps it crisp —
  // see `rendering/barlineInk`), while every glyph in the score is placed on the grid itself. So a
  // dot centred on the middle line reads half a pixel above the LINE the harness measures, exactly
  // as a notehead on that line does. ⛔ Tightening this would be asserting VexFlow's snap, not our
  // placement.
  const staff = staves.find(s => s.measure === 3)!
  const centre = (dots[0].y + dots[1].y) / 2
  expect(Math.abs(centre - (staff.top + staff.bottom) / 2), 'straddling the staff\'s middle line').toBeLessThanOrEqual(1)
})

test('⭐⭐ back-to-back repeats share ONE thick line — never two whole signs', async ({ score }) => {
  const { rects, staves, dots } = await drawn(score, 5, `
    h.engine.setRepeatEnd(2, true)
    h.engine.setRepeatStart(3, true)
  `)
  const boundary = staves.find(s => s.measure === 2)!.x2

  const ink = at(rects, boundary)
  // Gould p. 234 draws two legal designs and rules out a third: never two complete repeat signs side
  // by side. This is her (A) — dots · thin · ONE shared thick · thin · dots — which is also what
  // MuseScore draws for its combined type.
  expect(ink, 'thin · THICK · thin').toHaveLength(3)
  const [left, thick, right] = ink
  expect(thick.width, 'one thick line').toBeCloseTo(THICK, 1)
  expect(thick.x + thick.width / 2, 'centred on the boundary, because it divides both repeats').toBeCloseTo(boundary, 1)
  expect(left.width).toBeCloseTo(THIN, 1)
  expect(right.width).toBeCloseTo(THIN, 1)
  expect(boundary - left.x, 'and the sign is symmetric').toBeCloseTo(right.x + right.width - boundary, 1)

  expect(dots, 'a pair on each side').toHaveLength(4)
  expect(dots.filter(d => d.x < boundary), 'two facing back').toHaveLength(2)
  expect(dots.filter(d => d.x > boundary), 'two facing forward').toHaveLength(2)
})

test('⭐⭐ a repeat opening the NEXT system does not strip this system\'s last barline', async ({ score }) => {
  // ⚠️ The system clause of the suppression rule, and the reason it is not decoration: drop it and a
  // bar whose successor opens a repeat on the next line ends its system with no barline at all. All
  // three engines print the start repeat at the beginning of the new line and nothing at the end of
  // the previous one.
  const { staves, dots } = await drawn(score, 24, '')
  const systems = [...new Set(staves.map(s => s.top))].sort((a, b) => a - b)
  expect(systems.length, 'the score wrapped onto more than one system').toBeGreaterThan(1)

  const secondSystem = staves.filter(s => s.top === systems[1]).sort((a, b) => a.x1 - b.x1)
  const opener = secondSystem[0].measure
  const lastOfFirst = opener - 1

  const after = await drawn(score, 24, `h.engine.setRepeatStart(${opener}, true)`)
  const closing = after.staves.find(s => s.measure === lastOfFirst)!
  const ending = at(after.rects, closing.x2).filter(r => Math.abs(r.x - closing.x2) < 1 && Math.abs(r.y - closing.top) < 1)
  expect(ending, `bar ${lastOfFirst} still closes its system`).toHaveLength(1)

  // …and the repeat is drawn at the START of the new system, where the reader arrives.
  const openerStave = after.staves.find(s => s.measure === opener)!
  const opening = at(after.rects, openerStave.x1).filter(r => Math.abs(r.y - openerStave.top) < 1)
  expect(opening.length, 'the new line opens with the repeat sign').toBeGreaterThanOrEqual(2)
  expect(after.dots.length - dots.length, 'and its two dots').toBe(2)
})

test('the drag invariant survives every sign: the dividing line is still at the stave\'s own x2', async ({ score }) => {
  // ⭐ His constraint on the whole feature — *"even if we have the different barline we should be
  // able to change measure space by dragging, the same way we are doing now"* — is protected by `x`
  // never moving. Every room calculation in the layout measures to this number.
  const { rects, staves } = await drawn(score, 6, `
    h.engine.setBarlineStyle(2, 'final')
    h.engine.setRepeatEnd(4, true)
  `)

  for (const [bar, edge] of [[2, 'right'], [4, 'right']] as const) {
    const boundary = staves.find(s => s.measure === bar)!.x2
    const ink = at(rects, boundary)
    const divider = ink[ink.length - 1]
    expect(divider.x + divider.width, `bar ${bar}'s dividing line ends on its ${edge} boundary`).toBeCloseTo(boundary, 1)
    for (const r of ink) {
      expect(r.x, 'and no part of the sign crosses it').toBeLessThanOrEqual(boundary + 0.5)
    }
  }
})

test('⭐⭐ a repeat opening a bar that draws a CLEF stands AFTER the clef, not on the boundary', async ({ score }) => {
  // Gould p. 234: "When there is a new clef, key signature or time signature at the beginning of a
  // repeated section, place the repeat marks afterwards." Ross p. 147 states the same order as three
  // numbered spacings. Bar 1 draws a clef and a meter, so its `|:` cannot sit on its own left edge —
  // it would be drawn straight through them.
  const { rects, staves, dots } = await drawn(score, 4, `h.engine.setRepeatStart(1, true)`)
  const staff = staves.find(s => s.measure === 1)!

  // ⚠️ The whole bar, not a window around the boundary: the sign is displaced by the width of the
  // clef AND the meter, which is further than any of the other cases here move anything.
  const inBar = rects.filter(r => r.x >= staff.x1 && r.x < staff.x2)
  const sign = inBar.filter(r => Math.abs(r.width - THICK) < 0.6)
  expect(sign, 'the thick stroke of the repeat was drawn').toHaveLength(1)
  expect(sign[0].x, 'well right of the stave edge — the clef and meter come first').toBeGreaterThan(staff.x1 + 2 * SPACE)
  expect(dots, 'with its two dots').toHaveLength(2)
  for (const dot of dots) expect(dot.x).toBeGreaterThan(sign[0].x)

  // ⭐ …and the bar's own opening line is STILL THERE. A displaced repeat suppresses nothing: it
  // never stands on the boundary, so the line that opens the system keeps its place.
  const opening = inBar.filter(r => Math.abs(r.x - staff.x1) < 1)
  expect(opening, 'the system still opens with a line').toHaveLength(1)
})
