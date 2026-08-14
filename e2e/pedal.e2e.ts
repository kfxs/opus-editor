import { test, expect } from './fixtures'

/**
 * SUSTAIN PEDALS — `Ped.` and its release `✻`, drawn (docs/pedal-plan.md P2).
 *
 * ⚠️ **This suite has to be here.** Every claim below is about where ink landed: the `Ped.`'s width
 * decides where the `✻` may go, the barline's x decides where it must stop, and the y is stated
 * against measured ink and against what other families already took. All of those are 0 in jsdom
 * (`reference_jsdom_cannot_measure_glyphs`), so a headless assertion would agree with itself. The
 * MODEL arithmetic is unit-tested without a browser (`pedalOps.test.ts`,
 * `PedalRenderer.ladder.test.ts`); what is checked here is that the drawing obeys it.
 *
 * ⚠️ Codepoints as lowercase hex, `ottava.e2e.ts`'s convention: a literal SMuFL character in a source
 * file is invisible in most diffs and editors, so a wrong one would be unreadable rather than wrong.
 */
const PED = 'e650'      // SMuFL `keyboardPedalPed` — the `Ped.` sign
const STAR = 'e655'     // SMuFL `keyboardPedalUp` — the release ✻
const PAREN_L = 'e676'  // `keyboardPedalParensLeft`  ⚠️ his eye may move these to italic TEXT parens,
const PAREN_R = 'e677'  // `keyboardPedalParensRight`    exactly as it moved the ottava's (§12.5).

/** y grows DOWNWARD, so "further below the staff" means a LARGER y. */

/** Four quarters in bar 1, a pedal over the first `covers` beats of them. */
async function overQuarters(score: import('@playwright/test').Page, covers: number) {
  return score.evaluate(async ({ covers }) => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addPedal(1, { beat: h.frac(0, 1), length: h.frac(covers, 1) })
    await h.render()
    const stave = h.staves()[0]
    return {
      glyphs: h.placed('g.vf-pedal text'),
      sizes: h.inkSizes('g.vf-pedal text'),
      heads: h.inkSizes('g.vf-notehead text'),
      // ⚠️ The bar's CLOSING barline — `barlines()[0]` is the opening one, which is left of every
      // note and would make the release assertion pass on any geometry at all.
      barline: Math.max(...h.barlines().map(b => b.x)),
      top: stave.top,
      bottom: stave.bottom,
      spacing: (stave.bottom - stave.top) / 4,
    }
  }, { covers })
}

test('⭐ draws the two signs — `Ped.` where the foot goes down, `✻` where it comes up', async ({ score }) => {
  const { glyphs } = await overQuarters(score, 3)
  expect(glyphs.map(g => g.code)).toContain(PED)
  expect(glyphs.map(g => g.code)).toContain(STAR)
  expect(glyphs.some(g => g.code === PAREN_L), 'no parens on a pedal that starts here').toBe(false)
  // ⭐ …and the press comes before the release, which is the only ordering there is to get wrong
  // while the pair is two free-standing glyphs.
  const ped = glyphs.find(g => g.code === PED)!
  const star = glyphs.find(g => g.code === STAR)!
  expect(star.x).toBeGreaterThan(ped.x)
})

test('⛔ draws NO line between the signs — the style is not the feature', async ({ score }) => {
  const paths = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addPedal(1, { beat: h.frac(0, 1), length: h.frac(4, 1) })
    await h.render()
    return document.querySelectorAll('g.vf-pedal path').length
  })
  expect(paths).toBe(0)
})

/**
 * ⭐⭐ **GOULD'S PAIR RULE (§1 rule 2, p. 333): a pedal and ITS OWN release align on one level.**
 *
 * Stated as an equality of baselines rather than as a number, because the y itself is the ladder's
 * and any absolute value would pin the fixture rather than the rule.
 */
test('⭐⭐ `Ped.` and `✻` share ONE baseline', async ({ score }) => {
  const { glyphs } = await overQuarters(score, 3)
  const ped = glyphs.find(g => g.code === PED)!
  const star = glyphs.find(g => g.code === STAR)!
  expect(star.y).toBeCloseTo(ped.y, 1)
})

test('sits BELOW the staff', async ({ score }) => {
  const { glyphs, bottom } = await overQuarters(score, 3)
  for (const sign of glyphs) expect(sign.y, `${sign.code} is under the staff`).toBeGreaterThan(bottom)
})

/**
 * ⭐⭐ **THE RULE THIS FAMILY TURNS ON** — §1 rule 3: the release lands at or before the barline,
 * never after it (Gould, against MuseScore, which anchors the end to the next bar's first note).
 *
 * ⚠️ It is asserted on the `✻`'s RIGHT EDGE, and that is the point of right-aligning the glyph
 * (§5.1a): the lift x for a bar-length pedal IS the bar's `noteEndX`, so a left-aligned release
 * would put its ink straight through the line it must stay inside of.
 */
test('⭐⭐ a bar-length pedal releases INSIDE the barline', async ({ score }) => {
  const { glyphs, sizes, barline, spacing } = await overQuarters(score, 4)
  const i = glyphs.findIndex(g => g.code === STAR)
  const star = sizes[i]
  const gap = barline - (star.x + star.width)
  expect(gap, 'the whole release glyph is left of the line').toBeGreaterThan(0)
  // …and only just: this is air off the line (`PEDAL_BARLINE_AIR`), not the release drifting into
  // the middle of the bar.
  expect(gap, 'but it still belongs to this bar').toBeLessThan(2 * spacing)
})

test('⭐ the release marks the LIFT, not the last note — a short pedal lets go early', async ({ score }) => {
  const { glyphs, heads } = await overQuarters(score, 2)
  const star = glyphs.find(g => g.code === STAR)!
  // The pedal covers beats 0–2, so it lifts AT the third note's onset: the release sits before that
  // notehead and after the second one. ⛔ Not at the end of the second note's duration and ⛔ not on
  // the last notehead — those are the trill's and the ottava's rules (§5.2's table).
  expect(star.x).toBeGreaterThan(heads[1].x)
  expect(star.x).toBeLessThan(heads[2].x + heads[2].width)
})

/**
 * ⭐ §5.1a: the two signs are wide glyphs, so a SHORT pedal must not print them as one smudge —
 * `PEDAL_MIN_SPAN` pushes the release right, the one place the drawing knowingly overruns the lift x.
 */
test('⭐ a very short pedal still reads as two separate signs', async ({ score }) => {
  const { glyphs, sizes, spacing } = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: '16', measure: 1, beat: h.frac(0, 1) })
    h.engine.addPedal(1, { beat: h.frac(0, 1), length: h.frac(1, 4) })
    await h.render()
    const stave = h.staves()[0]
    return {
      glyphs: h.placed('g.vf-pedal text'),
      sizes: h.inkSizes('g.vf-pedal text'),
      spacing: (stave.bottom - stave.top) / 4,
    }
  })
  const pedIdx = glyphs.findIndex(g => g.code === PED)
  const starIdx = glyphs.findIndex(g => g.code === STAR)
  const ped = sizes[pedIdx]
  const star = sizes[starIdx]
  expect(star.x, 'the release clears the Ped. ink').toBeGreaterThan(ped.x + ped.width)
  expect(star.x + star.width - ped.x, 'and the pair keeps its minimum width')
    .toBeGreaterThan(3 * spacing)
})

/**
 * ⭐⭐ **THE LADDER — §1 rule 1: outside EVERYTHING on the underneath side.** The pedal pass runs
 * last of the below-staff families, so it clears whatever they claimed. ⛔ There is no priority
 * number anywhere; if this goes red, a pass has been reordered.
 */
test('⭐⭐ clears a dynamic and a hairpin in the same bars', async ({ score }) => {
  const { pedals, dynamics, hairpins } = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addDynamic(1, { beat: h.frac(0, 1), level: 'p' })
    h.engine.addHairpin(1, { type: 'cresc', beat: h.frac(1, 1), length: h.frac(3, 1) })
    h.engine.addPedal(1, { beat: h.frac(0, 1), length: h.frac(4, 1) })
    await h.render()
    return {
      pedals: h.placed('g.vf-pedal text'),
      dynamics: h.inkSizes('g.vf-dynamics text, g.vf-annotation text'),
      hairpins: h.segments('g.vf-hairpin path'),
    }
  })
  const pedalTop = Math.min(...pedals.map(g => g.y))
  const dynamicBottom = Math.max(...dynamics.map(d => d.y + d.height))
  const hairpinBottom = Math.max(...hairpins.flatMap(s => [s.y1, s.y2]))
  expect(pedals.length, 'the pedal drew').toBeGreaterThan(0)
  expect(pedalTop, 'below the dynamic').toBeGreaterThan(dynamicBottom)
  expect(pedalTop, 'below the wedge').toBeGreaterThan(hairpinBottom)
})

/** A score long enough to break, with a pedal straddling the break. */
async function acrossABreak(score: import('@playwright/test').Page) {
  return score.evaluate(async () => {
    const h = window.__h
    for (let m = 1; m <= 20; m++) {
      if (m > 1) h.engine.addMeasure()
      h.engine.addNoteAtBeat({ step: 'A', octave: 4, duration: 'w', measure: m, beat: h.frac(0, 1) })
    }
    await h.render()
    const heads = h.placed('g.vf-notehead text')
    const firstRowY = Math.min(...heads.map(g => g.y))
    const onFirstRow = heads.filter(g => Math.abs(g.y - firstRowY) < 5).length
    // From the LAST bar of system 1, through the first of system 2.
    h.engine.addPedal(onFirstRow, { beat: h.frac(0, 1), length: h.frac(8, 1) })
    await h.render()
    const glyphs = h.placed('g.vf-pedal text')
    return {
      firstRow: glyphs.filter(g => Math.abs(g.y - Math.min(...glyphs.map(x => x.y))) < 40),
      glyphs,
      rows: [...new Set(glyphs.map(g => Math.round(g.y)))].sort((a, b) => a - b),
    }
  })
}

/**
 * ⭐⭐ **§5.3 — a broken pedal RESTATES `(Ped.)`, and it is not decoration.** Without it the reader
 * turning the page finds a release sign for a pedal they cannot see: the text style has no line to
 * carry the meaning across, which makes this MORE necessary here than for the bracket style, not
 * less. Dorico ships the parenthesised continuation as a named setting and SMuFL ships the glyphs
 * for it. ⚠️ Gould is NOT the source for this one (§5.3's warning).
 */
test('⭐⭐ a pedal crossing a system break shows `Ped.` on one system and `(Ped.) … ✻` on the next', async ({ score }) => {
  const { glyphs, rows } = await acrossABreak(score)
  expect(rows.length, 'the pedal drew on two systems').toBeGreaterThan(1)

  const firstY = rows[0]
  const first = glyphs.filter(g => Math.abs(g.y - firstY) < 5)
  const later = glyphs.filter(g => Math.abs(g.y - firstY) >= 5)

  expect(first.map(g => g.code), 'the press, unparenthesised').toContain(PED)
  expect(first.some(g => g.code === PAREN_L), 'the first system is not a resumption').toBe(false)
  expect(first.some(g => g.code === STAR), 'and it does not release here').toBe(false)

  expect(later.map(g => g.code), 'the resumption opens with a bracket').toContain(PAREN_L)
  expect(later.map(g => g.code), '…around another `Ped.`').toContain(PED)
  expect(later.map(g => g.code), '…and closes it').toContain(PAREN_R)
  expect(later.map(g => g.code), 'and the release is here').toContain(STAR)
})

test('the resumed `(Ped.)` sits LEFT of the music, in the clef\'s space', async ({ score }) => {
  const left = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 1; m <= 20; m++) {
      if (m > 1) h.engine.addMeasure()
      h.engine.addNoteAtBeat({ step: 'A', octave: 4, duration: 'w', measure: m, beat: h.frac(0, 1) })
    }
    await h.render()
    const heads = h.placed('g.vf-notehead text')
    const firstRowY = Math.min(...heads.map(g => g.y))
    const onFirstRow = heads.filter(g => Math.abs(g.y - firstRowY) < 5).length
    h.engine.addPedal(onFirstRow, { beat: h.frac(0, 1), length: h.frac(8, 1) })
    await h.render()
    const glyphs = h.placed('g.vf-pedal text')
    const lastRowY = Math.max(...glyphs.map(g => g.y))
    const resumed = glyphs.filter(g => Math.abs(g.y - lastRowY) < 5)
    const secondRowHeads = h.placed('g.vf-notehead text').filter(g => g.y > firstRowY + 5)
    return {
      signX: Math.min(...resumed.map(g => g.x)),
      firstHeadX: Math.min(...secondRowHeads.map(g => g.x)),
      staveX: Math.min(...h.staves().map(s => s.x1)),
    }
  })
  // A resumption is a REMINDER, read before the first note rather than with it — but never so far
  // left that it lands on the clef (the draw site clamps it at the bar's own edge).
  expect(left.signX, 'left of the first note of the system').toBeLessThan(left.firstHeadX)
  expect(left.signX, 'and never off the stave').toBeGreaterThanOrEqual(left.staveX - 1)
})
