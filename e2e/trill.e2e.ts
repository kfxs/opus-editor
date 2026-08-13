import { test, expect } from './fixtures'

/**
 * TRILLS — the `tr` and its wavy extension, drawn (docs/trill-plan.md P2).
 *
 * ⚠️ **This suite has to be here and cannot be a unit test.** Every claim below is about where ink
 * landed, and the trill's whole geometry is font-dependent: the sign's width decides where the
 * wiggle starts, the wiggle's own glyph width decides how many repeats fit, and the y is stated
 * relative to the sign's ink extent. All three measure 0 in jsdom
 * (`reference_jsdom_cannot_measure_glyphs`), so a headless assertion would measure zeros and agree
 * with itself. The MODEL arithmetic is unit-tested without a browser (`trillOps.test.ts`,
 * `inkBand.test.ts`); what is checked here is that the drawing obeys it.
 */

/**
 * The two glyphs, as `placed()` reports them: a lowercase hex CODEPOINT, not the character.
 * ⚠️ Written as hex on purpose — a literal SMuFL character in a source file is invisible in most
 * diffs and editors, so a wrong one would be unreadable rather than merely wrong.
 */
const SIGN = 'e566'    // ornamentTrill
const WIGGLE = 'eaa4'  // wiggleTrill
// ⚠️ TEXT parentheses, not SMuFL's `accidentalParensLeft/Right` (U+E26A/E26B) — those were the first
// attempt and sat visibly too low, being shaped to bracket an accidental rather than a `tr`.
const PAREN_L = '28'   // '('
const PAREN_R = '29'   // ')'

/** Every glyph drawn inside a trill's own group, with where it landed. */
const trillGlyphs = (score: import('@playwright/test').Page) =>
  score.evaluate(() => window.__h.placed('g.vf-trill text'))

// ⭐⭐ HIS CALL, 2026-08-13, and it inverted this test: the line ALWAYS draws, including on a single
// note. docs/trill-plan.md §1 rule 5 said the opposite (LilyPond's and Gould's "a single note needs
// no wavy line") — he tested it and overruled it, because a bare `tr` leaves the duration implied.
// ⛔ If this ever goes back to expecting no wiggle, the decision has been undone by someone reading
// the sources instead of the note on `TrillSpan`.
test('⭐⭐ a trill on ONE note draws the sign AND a wiggle — the line always shows', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat =>
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!.id)
    h.engine.addTrill({ startNoteId: ids[1] })
    await h.render()
  })

  const glyphs = await trillGlyphs(score)
  const signs = glyphs.filter(g => g.code === SIGN)
  const wiggles = glyphs.filter(g => g.code === WIGGLE)
  expect(signs.length, 'one sign').toBe(1)
  expect(wiggles.length, 'and a line, even over one note').toBeGreaterThan(0)
  expect(wiggles[0].x).toBeGreaterThan(signs[0].x)
})

test('⭐⭐ a trill over a SPAN draws the sign plus a run of wiggles', async ({ score }) => {
  await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat =>
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!.id)
    h.engine.addTrill({ startNoteId: ids[0], endNoteId: ids[3] })
    await h.render()
  })

  const glyphs = await trillGlyphs(score)
  const signs = glyphs.filter(g => g.code === SIGN)
  const wiggles = glyphs.filter(g => g.code === WIGGLE)
  expect(signs.length, 'one sign').toBe(1)
  expect(wiggles.length, 'a run of wiggles').toBeGreaterThan(1)

  // The wiggle starts AFTER the sign, and every repeat is to the right of the one before it.
  expect(wiggles[0].x).toBeGreaterThan(signs[0].x)
  const xs = wiggles.map(w => w.x).sort((a, b) => a - b)
  for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
})

test('⭐⭐ the line STOPS SHORT of the next notehead — air at the end (his call)', async ({ score }) => {
  const { wiggles, heads, spacing } = await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat =>
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!.id)
    // Trill the first two notes: the line must stop before the THIRD note's head.
    h.engine.addTrill({ startNoteId: ids[0], endNoteId: ids[1] })
    await h.render()
    const staff = h.staves()[0]
    return {
      wiggles: h.placed('g.vf-trill text').filter(g => g.code === 'eaa4'),
      heads: h.placed('g.vf-notehead text'),
      spacing: (staff.bottom - staff.top) / 4,
    }
  })

  expect(wiggles.length).toBeGreaterThan(0)
  const lineEnd = Math.max(...wiggles.map(w => w.x))
  const thirdHead = heads.sort((a, b) => a.x - b.x)[2]

  // ⭐ It must stop BEFORE that head, not flush against it — the whole point of the inset. A glyph's
  // reported x is its left edge, so the last wiggle's own width is still to the right of `lineEnd`;
  // asserting a clear gap of most of a staff space is the honest form of "there is air".
  expect(lineEnd).toBeLessThan(thirdHead.x)
  expect(thirdHead.x - lineEnd).toBeGreaterThan(spacing * 0.4)
})

test('⭐ the sign LEFT-aligns to the left edge of its notehead (rule 4)', async ({ score }) => {
  const heads = await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat =>
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!.id)
    h.engine.addTrill({ startNoteId: ids[1] })
    await h.render()
    return h.placed('g.vf-notehead text')
  })

  const glyphs = await trillGlyphs(score)
  const sign = glyphs.find(g => g.code === SIGN)!
  const second = heads.sort((a, b) => a.x - b.x)[1]

  // ⭐ LEFT-aligned, not centred: the sign's left edge sits at the notehead's, so it must NOT be
  // shifted right by half the difference in their widths (which is what centring would do).
  expect(sign.x).toBeCloseTo(second.x, 0)
})

/** A one-note trill on a whole note of the given pitch, and where its sign landed relative to the
 *  staff. One score per page, so each pitch is its own test. */
const signOver = (score: import('@playwright/test').Page, octave: number) =>
  score.evaluate(async (oct) => {
    const h = window.__h
    const id = h.engine.addNoteAtBeat({ step: 'C', octave: oct, duration: 'w', measure: 1, beat: h.frac(0, 1) })!.id
    h.engine.addTrill({ startNoteId: id })
    await h.render()
    return { y: h.placed('g.vf-trill text')[0].y, top: h.staves()[0].top, spacing: (h.staves()[0].bottom - h.staves()[0].top) / 4 }
  }, octave)

test('⭐ the trill sits ABOVE the staff even over staff-resident music — the floor guarantees it', async ({ score }) => {
  const { y, top, spacing } = await signOver(score, 4) // C4: one ledger below, nothing high
  expect(y).toBeLessThan(top)
  // …and not absurdly far: the floor is 1.0 space plus the sign's own ink, so a couple of spaces.
  expect(top - y).toBeLessThan(spacing * 6)
})

test('⭐⭐ …and a note ABOVE the staff pushes it further up — it clears its own music', async ({ score }) => {
  const { y, top } = await signOver(score, 6) // C6: ledger lines well above the staff
  expect(y).toBeLessThan(top)
})

test('⭐ the trill sits NEARER the staff than a dynamic would — it is the innermost family', async ({ score }) => {
  const { trillY, dynY, top } = await score.evaluate(async () => {
    const h = window.__h
    const id = h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })!.id
    h.engine.addTrill({ startNoteId: id })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p', placement: 'above' })
    await h.render()
    return {
      trillY: h.placed('g.vf-trill text')[0].y,
      dynY: h.placed('g.vf-annotation text')[0]?.y ?? h.placed('text')[0].y,
      top: window.__h.staves()[0].top,
    }
  })

  // Both above the staff, and the trill is the closer of the two (docs/above-staff-ladder.md §3:
  // LilyPond gives TrillSpanner priority 50 against DynamicLineSpanner's 250).
  expect(trillY).toBeLessThan(top)
  expect(trillY).toBeGreaterThan(dynY)
})

/**
 * ⭐⭐ HIS REPORT, 2026-08-13: a trill on a note at the END of a system, tied over the break, drew
 * NOTHING AT ALL.
 *
 * ⚠️⚠️ The test below this one — a trill spanning bars 1→24 — PASSED throughout, and that is the
 * lesson worth keeping: it passed by luck of geometry. Its `endX` was the LAST system's right
 * margin, which happens to exceed bar 1's left edge, so the `endX <= startX` guard in `spanX` never
 * fired. Reverse the geometry (start at the right end of one system, end at the left of the next)
 * and the same guard threw the whole trill away.
 *
 * So this fixture is deliberately the awkward one: the trill must START LATE on a system and END
 * EARLY on the following one. A cross-system test that does not do that proves very little.
 */
test('⭐⭐ a trill ENDING on the next system still draws — the x\'s are in different systems', async ({ score }) => {
  const { glyphs, staves, broke } = await score.evaluate(async () => {
    const h = window.__h
    // One whole note per bar, enough bars to break.
    const ids: string[] = []
    for (let m = 1; m <= 20; m++) {
      if (m > 1) h.engine.addMeasure()
      ids.push(h.engine.addNoteAtBeat({ step: 'A', octave: 3, duration: 'w', measure: m, beat: h.frac(0, 1) })!.id)
    }
    await h.render()

    // ⭐ FIND THE BREAK, rather than guessing where it falls. Noteheads come back sorted by x, so
    // group them by ROW: the count on the first row is how many bars that system holds. The trill
    // then runs from the LAST bar of system 1 to the FIRST of system 2 — the reversed geometry.
    const heads = h.placed('g.vf-notehead text')
    const firstRowY = Math.min(...heads.map(g => g.y))
    const onFirstRow = heads.filter(g => Math.abs(g.y - firstRowY) < 5).length
    if (onFirstRow >= ids.length) return { glyphs: [], staves: h.staves().length, broke: false }

    h.engine.addTrill({ startNoteId: ids[onFirstRow - 1], endNoteId: ids[onFirstRow] })
    await h.render()
    return { glyphs: h.placed('g.vf-trill text'), staves: h.staves().length, broke: true }
  })

  expect(staves, 'the fixture must actually break into systems').toBeGreaterThan(1)
  expect(broke, 'the trill must genuinely straddle the break').toBe(true)

  // ⭐⭐ HIS CALL: the RESUMED sign is parenthesised — `(tr)`, Sibelius's convention — so a reader
  // can tell a trill that carries over from one that starts here. Exactly ONE pair: the first
  // fragment keeps a bare `tr`, and only the continuation is bracketed.
  const parensL = glyphs.filter(g => g.code === PAREN_L)
  const parensR = glyphs.filter(g => g.code === PAREN_R)
  expect(parensL.length, 'one opening paren — on the continuation only').toBe(1)
  expect(parensR.length, 'and one closing').toBe(1)
  // …and they BRACKET a sign: ( then tr then ), left to right.
  const bracketed = glyphs.filter(g => g.code === SIGN).find(t => t.x > parensL[0].x && t.x < parensR[0].x)
  expect(bracketed, 'the parens sit either side of a tr').toBeDefined()
  // …and the bracketed one is NOT the first system's sign.
  expect(bracketed!.y).toBeGreaterThan(Math.min(...glyphs.filter(g => g.code === SIGN).map(g => g.y)))

  // ⭐ ITALIC, because the `tr` glyph is itself a stylised italic "tr".
  //
  // ⚠️⚠️ Asserting `font-style: italic` alone is NOT ENOUGH and this test learned it the hard way:
  // that assertion passed while the picture rendered bolt upright, because the family in force had
  // no italic FACE. So the family is checked too — it must be the serif stack that owns one.
  const parenFonts = await score.evaluate(() =>
    Array.from(document.querySelectorAll('g.vf-trill text'))
      .filter(t => t.textContent === '(' || t.textContent === ')')
      .map(t => ({ style: getComputedStyle(t).fontStyle, family: getComputedStyle(t).fontFamily, size: parseFloat(getComputedStyle(t).fontSize) })))
  expect(parenFonts.length, 'both parens found in the DOM').toBe(2)
  expect(parenFonts.every(f => f.style === 'italic'), 'style is italic').toBe(true)
  expect(parenFonts.every(f => /georgia|times|serif/i.test(f.family)), 'in a family that HAS an italic face').toBe(true)

  // ⭐ …and SMALLER than the sign (his: 0.85 was "definitely too big"), and RAISED off its baseline,
  // because a text paren descends where a `tr` does not.
  const signSize = await score.evaluate(() => {
    const t = Array.from(document.querySelectorAll('g.vf-trill text')).find(e => e.textContent === '\ue566')
    return parseFloat(getComputedStyle(t!).fontSize)
  })
  expect(parenFonts[0].size).toBeLessThan(signSize)
  expect(parensL[0].y).toBeLessThan(bracketed!.y)
  // ⭐ THE POINT: it draws AT ALL. The bug threw the whole trill away because `endX` (early on the
  // second system) was numerically less than `startX` (late on the first).
  expect(glyphs.length, 'the trill draws something').toBeGreaterThan(0)
  const signs = glyphs.filter(g => g.code === SIGN)
  expect(signs.length, 'a sign on each system it reaches').toBeGreaterThan(1)
  const rows = new Set(glyphs.map(g => Math.round(g.y / 20)))
  expect(rows.size, 'ink on both rows').toBeGreaterThan(1)
})

/**
 * The three CONTINUATION LABELS (`Trill.continuationLabel`), each drawn. ⭐ Their POSITIONS differ,
 * and that is his rule rather than a tidy-up: `(tr)` is a REMINDER so it sits at the system's left
 * edge like an `(8)`, while a plain `tr` is THE SIGN RESTARTING so it sits on its note — which is
 * what LilyPond and the Cotta Op. 111 plates both do.
 */
async function continuationOf(score: import('@playwright/test').Page, label: 'parenthesised' | 'plain' | 'none') {
  return score.evaluate(async (lab) => {
    const h = window.__h
    const ids: string[] = []
    for (let m = 1; m <= 20; m++) {
      if (m > 1) h.engine.addMeasure()
      ids.push(h.engine.addNoteAtBeat({ step: 'A', octave: 3, duration: 'w', measure: m, beat: h.frac(0, 1) })!.id)
    }
    await h.render()
    const heads = h.placed('g.vf-notehead text')
    const firstRowY = Math.min(...heads.map(g => g.y))
    const onFirstRow = heads.filter(g => Math.abs(g.y - firstRowY) < 5).length
    const trill = h.engine.addTrill({ startNoteId: ids[onFirstRow - 1], endNoteId: ids[onFirstRow] })!
    if (lab !== 'parenthesised') h.engine.setTrillContinuationLabel(trill.id, lab)
    await h.render()
    // The second row's first notehead — what a plain restart must sit on.
    const after = h.placed('g.vf-notehead text')
    const secondRow = after.filter(g => g.y > firstRowY + 5)
    return {
      glyphs: h.placed('g.vf-trill text'),
      firstNoteOfRow2: Math.min(...secondRow.map(g => g.x)),
      row1Y: firstRowY,
    }
  }, label)
}

test('⭐ label `none` — the wavy line continues with NO sign at all (MuseScore\'s)', async ({ score }) => {
  const { glyphs, row1Y } = await continuationOf(score, 'none')
  const onRow2 = glyphs.filter(g => g.y > row1Y + 5)
  expect(onRow2.length, 'the line does continue').toBeGreaterThan(0)
  expect(onRow2.every(g => g.code === WIGGLE), 'and it is ALL wiggle — no sign, no parens').toBe(true)
})

test('⭐⭐ label `plain` — a bare `tr`, ON its note rather than at the margin', async ({ score }) => {
  const { glyphs, firstNoteOfRow2, row1Y } = await continuationOf(score, 'plain')
  const onRow2 = glyphs.filter(g => g.y > row1Y + 5)
  const sign = onRow2.find(g => g.code === SIGN)
  expect(sign, 'the sign is repeated').toBeDefined()
  expect(onRow2.some(g => g.code === '28'), 'and NOT parenthesised').toBe(false)
  // ⭐ THE POSITION RULE: on the note, not at the left edge.
  expect(sign!.x).toBeCloseTo(firstNoteOfRow2, 0)
})

test('⭐ label `(tr)` — parenthesised, its bracket at the margin and the sign pushed right of it', async ({ score }) => {
  const { glyphs, firstNoteOfRow2, row1Y } = await continuationOf(score, 'parenthesised')
  const onRow2 = glyphs.filter(g => g.y > row1Y + 5)
  const paren = onRow2.find(g => g.code === '28')
  const sign = onRow2.find(g => g.code === SIGN)
  expect(paren, 'parenthesised').toBeDefined()
  expect(sign).toBeDefined()

  // The label starts at the fragment's own left edge…
  expect(paren!.x).toBeLessThanOrEqual(firstNoteOfRow2 + 1)
  // …so the SIGN inside it is pushed right by the bracket's width — which is the only difference
  // from `plain` in this fixture.
  expect(sign!.x).toBeGreaterThan(paren!.x)

  // ⚠️⚠️ **A HONEST LIMIT, measured rather than assumed.** The system's left content edge and the
  // first notehead sit at very nearly the SAME x (a whole note begins each bar right after the
  // clef), so "at the margin" and "on the note" are only a bracket's width apart HERE. The position
  // rule is still right — it separates them whenever the first note is not hard against the margin
  // (a bar opening with a rest, a key signature, a pickup) — but it is not the dramatic difference
  // the rule's wording might suggest, and this test says so rather than implying otherwise.
  expect(Math.abs(paren!.x - firstNoteOfRow2)).toBeLessThan(12)
})

test('⭐⭐ a trill crossing a system break repeats its SIGN on the new system (rule 6)', async ({ score }) => {
  const lines = await score.evaluate(async () => {
    const h = window.__h
    // Enough bars to force a break, one note each, trilled end to end.
    const ids: string[] = []
    for (let m = 1; m <= 24; m++) {
      if (m > 1) h.engine.addMeasure()
      ids.push(h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: m, beat: h.frac(0, 1) })!.id)
    }
    h.engine.addTrill({ startNoteId: ids[0], endNoteId: ids[ids.length - 1] })
    await h.render()
    return { staves: h.staves().length, glyphs: h.placed('g.vf-trill text') }
  })

  expect(lines.staves, 'the fixture must actually break into systems').toBeGreaterThan(1)
  const signs = lines.glyphs.filter(g => g.code === SIGN)
  // ⭐ ONE SIGN PER SYSTEM the trill reaches — not one for the whole ornament. A reader arriving on
  // the second system has to be told what the wavy line means.
  expect(signs.length).toBeGreaterThan(1)
  // …and each is on a different row.
  const rows = new Set(signs.map(s => Math.round(s.y / 10)))
  expect(rows.size).toBe(signs.length)
})
