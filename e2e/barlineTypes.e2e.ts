import { test, expect } from './fixtures'

/**
 * **The three signs, drawn** — P2 of docs/plans/barline-types-plan.md, measured in a browser.
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
      dots: h.glyphs('g.stavebarline text'),
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
  const { staves } = await drawn(score, 24, '')
  const systems = [...new Set(staves.map(s => s.top))].sort((a, b) => a - b)
  expect(systems.length, 'the score wrapped onto more than one system').toBeGreaterThan(2)

  // ⚠️ **The LAST system's opener, not the second's.** A start repeat makes its bar ~1.5 staff spaces
  // wider (P3 reserves the room), which can re-wrap the line it is on — and re-targeting the test
  // after the fact would be testing whichever bar the casting-off happened to leave there. The last
  // system has slack, so growing its first bar cannot pull anything into the system before it.
  const lastSystem = staves.filter(s => s.top === systems[systems.length - 1]).sort((a, b) => a.x1 - b.x1)
  const opener = lastSystem[0].measure
  expect(opener, 'the last system opens mid-score, so there is a previous one to close')
    .toBeGreaterThan(1)

  const after = await drawn(score, 24, `h.engine.setRepeatStart(${opener}, true)`)
  const openerStave = after.staves.find(s => s.measure === opener)!
  const closing = after.staves.find(s => s.measure === opener - 1)!
  expect(closing.top, 'the previous bar is still on the system above').toBeLessThan(openerStave.top)

  const ending = at(after.rects, closing.x2)
    .filter(r => Math.abs(r.x - closing.x2) < 1 && Math.abs(r.y - closing.top) < 2)
  expect(ending, `bar ${opener - 1} still closes its system`).toHaveLength(1)

  // …and the repeat is drawn at the START of the new system, where the reader arrives — but AFTER
  // the clef that opens it (Gould p. 234), so `x1` itself still carries only the system's own
  // opening line. ⭐ A displaced repeat suppresses nothing, which is the second half of that rule.
  // ⚠️ Filter by the BAND as well as the x — every system starts at the same x, so an x-only filter
  //    collects one row per system (`barlineGap.e2e.ts`'s standing warning).
  const opening = after.rects.filter(r => Math.abs(r.x - openerStave.x1) < 1
    && Math.abs(r.y - openerStave.top) < 2)
  expect(opening, 'the new system still opens with its own line').toHaveLength(1)

  const inBar = after.rects.filter(r => r.x > openerStave.x1 && r.x < openerStave.x2
    && Math.abs(r.y - openerStave.top) < 2)
  const thick = inBar.filter(r => Math.abs(r.width - THICK) < 0.6)
  expect(thick, 'and the repeat stands inside the bar, past the clef').toHaveLength(1)
  expect(thick[0].x, 'well clear of the stave edge').toBeGreaterThan(openerStave.x1 + 2 * SPACE)
  const openerDots = after.dots.filter(d => d.x > openerStave.x1 && d.x < openerStave.x2)
  expect(openerDots, 'with its two dots').toHaveLength(2)
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

test('⭐⭐ a displaced repeat stands ONE SPACE after the header — never on top of the meter', async ({ score }) => {
  // 🚨 **HIS REPORT, 2026-08-26**: *"look how close is initial repeat barline from time signature"*.
  // It was not merely close — the sign's thick stroke began 2 units LEFT of where the meter's ink
  // ended, while 2.4 spaces of air sat between the sign and the first notehead. The cause was the
  // ANCHOR: the position was measured back from `getNoteStartX()`, which is not where the note's ink
  // lands. It is now measured forward from the header's own ink (`BarlineRenderer.displacedRepeatX`,
  // where the three engines' numbers and Ross p. 147 are recorded).
  const measured = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.setRepeatStart(1, true)
    await h.render()
    const meter = h.inkSizes('.timesignature text')
    const head = h.inkSizes('.notehead')
    return {
      meterRight: Math.max(...meter.map(m => m.x + m.width)),
      headLeft: Math.min(...head.map(n => n.x)),
      rects: h.barlines(),
      dots: h.glyphs('g.stavebarline text'),
    }
  })

  // The sign, right of the meter: its thick stroke opens it, its dots close it.
  const sign = measured.rects.filter(r => r.x > measured.meterRight && r.x < measured.headLeft)
    .sort((a, b) => a.x - b.x)
  expect(sign.length, 'the two strokes of |: are between the meter and the note').toBe(2)
  const dotsRight = Math.max(...measured.dots.map(d => d.x)) + 0.4 * SPACE

  // ⭐ 1.0 space after the header — LilyPond's `TimeSignature.space-alist (staff-bar . 1.0)`, and
  // half of HEADER_TO_NOTE, which is why the other side comes out at least as wide.
  const before = sign[0].x - measured.meterRight
  expect(before, 'a full space of air after the meter').toBeGreaterThan(0.8 * SPACE)
  expect(before, '…and not more than one — the note needs the other half').toBeLessThan(1.4 * SPACE)
  // ⭐ …and Ross p. 143's one space before the first note survives it.
  expect(measured.headLeft - dotsRight, 'a space before the note too').toBeGreaterThan(0.8 * SPACE)
})

test('🚨🚨 a bar that MOVED without being re-engraved takes its barline with it', async ({ score }) => {
  // **His report, 2026-08-26**: *"the final bar and one of the simple bar that are in the second
  // stave [have] been stolen from the first stave"*, and then *"the bug occurs when i add another
  // staff"* — with a screenshot of three barlines floating in the blank space below a system.
  //
  // 🚨 **THE COORDINATES LIE.** A bar whose SHAPE has not changed is reused rather than re-engraved:
  // the renderer keeps the old `Stave` and moves the drawn group with a `transform: translate(dx,dy)`
  // (`replaySnapshot`). Everything drawn INSIDE that group rides the transform; this pass draws
  // outside it, so reading `stave.getX()` / `getTopLineTopY()` gave the position of the render
  // BEFORE last. Adding a staff pushes every bar down without changing one of them, which is why
  // that gesture showed it whole.
  //
  // ⭐ The same trap the barline selection HIGHLIGHT fell into once already
  // (docs/how-it-works/barline-selection.md, "PAINT don't RECOLOUR"). The fix is the same shape: take the
  // position from the PLACEMENT — the plan for THIS render — never from the stave.
  const out = await score.evaluate(async () => {
    const h = window.__h
    while (h.engine.getScore().measures.length < 6) h.engine.addMeasure()
    for (let m = 1; m <= 6; m++) {
      for (const b of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: m, beat: h.frac(b, 1) })
      }
    }
    h.engine.addStaffBelow(0)
    h.engine.setRepeatEnd(2, true)
    h.engine.setBarlineStyle(3, 'final')
    await h.render()

    // Translate every bar without re-engraving one: a staff-spacing nudge keeps every shape key.
    h.engine.nudgeStaffSpacing(1, 1, 4)
    await h.render()

    const staves = h.staves()
    const rects = h.barlines()
    return {
      perStaff: staves.map(s => ({
        m: s.measure,
        staff: s.staff,
        n: rects.filter(r => Math.abs(r.y - s.top) < 3 && r.x > s.x2 - 25 && r.x < s.x2 + 12).length,
      })),
      // Any barline rect sitting at a y where NO staff was drawn — the floating lines in his picture.
      orphans: rects.filter(r => !staves.some(s => Math.abs(r.y - s.top) < 3))
        .map(r => ({ x: Math.round(r.x), y: Math.round(r.y) })),
    }
  })

  expect(out.orphans, 'no barline is left behind at the previous render\'s position').toEqual([])
  // …and the two staves agree bar for bar, which is what "stolen from the first stave" looked like.
  for (const bar of [1, 2, 3, 4, 5]) {
    const [top, bottom] = out.perStaff.filter(p => p.m === bar).map(p => p.n)
    expect(top, `bar ${bar} drew its barline on the top staff`).toBeGreaterThan(0)
    expect(bottom, `bar ${bar}: both staves drew the same sign`).toBe(top)
  }
})
