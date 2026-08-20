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
      /** The second system's stave left edge — what a reminder must never reach back past. */
      staveLeftOfRow2: Math.min(...h.staves().filter(s => s.measure > onFirstRow).map(s => s.x1)),
      /** One staff space in px, so the separation can be asserted in the unit the constant is in. */
      spacing: (h.staves()[0].bottom - h.staves()[0].top) / 4,
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
  const { glyphs, firstNoteOfRow2, staveLeftOfRow2, spacing, row1Y } = await continuationOf(score, 'parenthesised')
  const onRow2 = glyphs.filter(g => g.y > row1Y + 5)
  const paren = onRow2.find(g => g.code === '28')
  const sign = onRow2.find(g => g.code === SIGN)
  expect(paren, 'parenthesised').toBeDefined()
  expect(sign).toBeDefined()

  // ⭐ The label starts CLEARLY left of the music it reminds you about (TRILL_CONTINUATION_INSET).
  // ⚠️ Asserted as a GAP in staff spaces, not as "less than": `noteStartX` is already a few px left
  // of the notehead's own x, so a bare `<` passed with the inset deleted — proved by break-test.
  expect(firstNoteOfRow2 - paren!.x, 'a real separation, not a rounding one')
    .toBeGreaterThan(1.5 * spacing)
  // …and the SIGN inside it is pushed right by the bracket's width.
  expect(sign!.x).toBeGreaterThan(paren!.x)

  // ⚠️ **This assertion used to record a DEFECT as a limit, and it is worth remembering why.** It
  // read "at the margin and on the note are only a bracket's width apart" — measured, honestly, and
  // wrong about the cause: `planSlurSegments`' left edge is `noteStartX`, i.e. where NOTES may begin
  // (after the clef and meter), so the "margin" the rule asked for was never reached. The identical
  // defect on the octave line is what exposed it (docs/ottava-plan.md, his eye §5). The label now
  // genuinely precedes the music — and still never reaches back onto the clef.
  expect(paren!.x, 'never back past the stave').toBeGreaterThanOrEqual(staveLeftOfRow2)
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

/**
 * 🚨🚨 **THE HIT-BOX FOLLOWS THE NUDGED SIGN** — his report, 2026-08-18: *"the left endpoint does not
 * move with the offset."*
 *
 * The registry entry was built from `piece.x0`, the fragment's SPAN start, at both ends. So a
 * `startX` nudge moved the drawn `tr` and left its box — and the START square hanging off it —
 * exactly where they were. ⭐ The END square moved all along, because `lineEnd` carries its own
 * nudge, which is why only one of the two looked broken: a fix that checked "the box moved" without
 * separating the two ends would have passed before the bug was fixed.
 *
 * ⚠️ In the browser because the claim is about the DRAWN sign: its glyph x is what the box has to
 * agree with, and jsdom measures every glyph at 0.
 */
test('🚨 nudging the START moves the sign AND its hit-box together', async ({ score }) => {
  const read = async () => score.evaluate(() => {
    const h = window.__h
    const box = h.engine.getElementRegistry().getByType('trill')[0]
    const sign = h.placed('g.vf-trill text')[0]
    return { boxX: box.bbox.x, signX: sign.x }
  })

  await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat =>
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!.id)
    h.engine.addTrill({ startNoteId: ids[1], endNoteId: ids[2] })
    await h.render()
  })
  const before = await read()

  await score.evaluate(async () => {
    const h = window.__h
    const trill = h.engine.getTrills()[0]
    h.engine.nudgeTrillEndpoint(trill.id, 'start', -1, 0)   // one staff space LEFT
    await h.render()
  })
  const after = await read()

  const signMoved = after.signX - before.signX
  const boxMoved = after.boxX - before.boxX
  expect(signMoved, 'the sign went left by a staff space').toBeLessThan(-5)
  expect(boxMoved, 'and its box went with it, by the SAME amount').toBeCloseTo(signMoved, 1)
})

test('⭐ …and nudging the END moves the line\'s end, leaving the sign where it was', async ({ score }) => {
  const read = async () => score.evaluate(() => {
    const h = window.__h
    const box = h.engine.getElementRegistry().getByType('trill')[0]
    const sign = h.placed('g.vf-trill text')[0]
    return { right: box.bbox.x + box.bbox.width, signX: sign.x }
  })

  await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat =>
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!.id)
    h.engine.addTrill({ startNoteId: ids[0], endNoteId: ids[2] })
    await h.render()
  })
  const before = await read()

  await score.evaluate(async () => {
    const h = window.__h
    h.engine.nudgeTrillEndpoint(h.engine.getTrills()[0].id, 'end', 1, 0)
    await h.render()
  })
  const after = await read()

  expect(after.right - before.right, 'the line reaches a space further right').toBeGreaterThan(5)
  expect(after.signX, 'the sign has not moved — the horizontal is PER END').toBeCloseTo(before.signX, 1)
})

test('🚨🚨 a BIG NEGATIVE end nudge leaves the SIGN standing — his report, 2026-08-20', async ({ score }) => {
  // *"the `tr` disappears, this should not happen"* — on a trill carrying `endX: -5`. Pulling the
  // end back past the sign is a way of asking for a bare `tr`, ⛔ not for no ornament: the wiggle
  // goes, the sign stays, and so do its hit-box and both squares.
  //
  // 🚨 It regressed the day the end nudge moved INTO the geometry (it had to, for the system FOLD):
  // `cutIntoPieces` drops a piece whose end has crossed its own start, which deleted the only piece
  // there was. ⭐ The cut is now floored at the sign, and `drawsLine` alone decides the wiggle.
  const read = async () => score.evaluate(() => {
    const h = window.__h
    const marks = h.placed('g.vf-trill text')
    const box = h.engine.getElementRegistry().getByType('trill')[0]
    return { signs: marks.length, signX: marks[0]?.x ?? null, hasBox: !!box }
  })

  await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat =>
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!.id)
    // ⭐ A ONE-NOTE trill, as his was: its line is about a quarter-note wide, so a 5-space pull is
    // enough to take the end back past the sign — which is the state that used to erase everything.
    h.engine.addTrill({ startNoteId: ids[0] })
    await h.render()
  })
  const before = await read()
  // ⚠️ Every glyph of the wiggle is a `<text>` too, so the count is sign + line segments.
  expect(before.signs, 'the fixture draws a sign AND a wiggle to begin with').toBeGreaterThan(1)

  await score.evaluate(async () => {
    const h = window.__h
    h.engine.nudgeTrillEndpoint(h.engine.getTrills()[0].id, 'end', -5, 0)
    await h.render()
  })
  const after = await read()

  expect(after.signs, 'the `tr` is STILL DRAWN — and it is all that is left').toBe(1)
  expect(after.signX, 'and it has not moved — the end nudge is the END\'s').toBeCloseTo(before.signX!, 1)
  expect(after.hasBox, 'and the ornament still has a hit-box to grab').toBe(true)
})

test('⭐⭐ the vertical is OUTWARD: + lifts an `above` trill, and LOWERS a `below` one', async ({ score }) => {
  // 🚨 THE BREAK-TEST FOR THE WHOLE CONVERSION. Every case above uses an `above` trill, where
  // outward-from-the-staff and "up the screen" agree up to a sign — so they would all pass with the
  // conversion deleted. A `below` trill is the one that bites, exactly as the ottava's 8vb did.
  const signY = async () => score.evaluate(() => window.__h.placed('g.vf-trill text')[0].y)

  await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat =>
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })!.id)
    h.engine.addTrill({ startNoteId: ids[1] })
    await h.render()
  })
  const aboveBefore = await signY()
  await score.evaluate(async () => {
    const h = window.__h
    h.engine.nudgeTrillEndpoint(h.engine.getTrills()[0].id, 'start', 0, 1)   // +1 OUTWARD
    await h.render()
  })
  expect(await signY(), 'above the staff, further out is UP the screen').toBeLessThan(aboveBefore)

  // …the same +1 outward on a `below` trill must move it DOWN.
  await score.evaluate(async () => {
    const h = window.__h
    const trill = h.engine.getTrills()[0]
    h.engine.resetTrillOffset(trill.id)
    h.engine.toggleTrillPlacement(trill.id)
    await h.render()
  })
  const belowBefore = await signY()
  await score.evaluate(async () => {
    const h = window.__h
    h.engine.nudgeTrillEndpoint(h.engine.getTrills()[0].id, 'start', 0, 1)
    await h.render()
  })
  expect(await signY(), 'below the staff, further out is DOWN the screen').toBeGreaterThan(belowBefore)
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * ⭐⭐ **THE TRILL AND THE CURVE UNDER IT** — docs/trill-slur-clearance-plan.md, his report of
 * 2026-08-18: *a `tr` on a note inside a slur's span collides with the arc.*
 *
 * > **Gould p. 135**: the sign sits *"further from the note than any articulation marks. Only a long
 * > slur, a pause or octave sign goes further from the stave."* Her p. 138 (d) draws the hardest
 * > case — a slur STARTING on the trilled note — and the `tr` is outside there too, by 0.55–1.35 sp
 * > measured at 450 dpi.
 *
 * ⚠️ **These cannot be unit tests, and not only for the usual font reason.** The obstacle IS the
 * drawn curve: in jsdom there is no arc to be over.
 */

/**
 * Every y the drawn curves reach inside an x-window — the same question the layout pass asks of
 * `curveObstacleBand`, put to the ink instead of to the model.
 *
 * ⚠️ **Sampled ink, via `h.curveSamples`, ⛔ never the `d` attribute.** A slur is ONE cubic whose four
 * stored points all sit near its ends: parsing the string found nothing inside a window over the
 * middle of the bar and reported a confident zero, which is how this test first "passed" its way to a
 * wrong answer. The points cross the boundary and are windowed HERE, since a helper declared in this
 * file does not exist inside `page.evaluate`.
 */
const curveYsIn = (points: { x: number; y: number }[], x0: number, x1: number): number[] => {
  const [left, right] = x0 <= x1 ? [x0, x1] : [x1, x0]
  return points.filter(p => p.x >= left && p.x <= right).map(p => p.y)
}

/**
 * ⭐ **THE LOPSIDED FIXTURE, and it is lopsided on purpose** — the ladder's own recorded lesson
 * (`ladder.e2e.ts`: over staff-resident music every family lands on its own floor, so the order
 * comes out right *whether or not anything reads anything*). Here the trilled note is a low B4 whose
 * own ink cannot lift the sign at all, while the slur leaps to C6 either side of it — so the arc
 * passes high over the `tr`, and only a pass that actually reads the curve can get out of its way.
 *
 * ⭐ It carries a DYNAMIC as well, at the trilled note. That is the second half of the claim: the
 * families outside the trill are placed after it, so a lifted `tr` must push the `p` out too.
 */
async function slurOverTrill(score: import('@playwright/test').Page, opts: { slur: boolean }) {
  return score.evaluate(async ({ slur }: { slur: boolean }) => {
    const h = window.__h
    const pitches = [{ step: 'C', octave: 6 }, { step: 'B', octave: 4 },
      { step: 'B', octave: 4 }, { step: 'C', octave: 6 }]
    const ids = pitches.map((p, beat) => h.engine.addNoteAtBeat({
      step: p.step, octave: p.octave, duration: 'q', measure: 1, beat: h.frac(beat, 1),
    })!.id)
    if (slur) h.engine.createSlur([ids[0], ids[3]])
    h.engine.addTrill({ startNoteId: ids[1] })
    h.engine.addDynamic(1, { beat: h.frac(1, 1), text: 'p', placement: 'above' })
    await h.render()

    const stave = h.staves()[0]
    const marks = h.placed('g.vf-trill text')
    const xs = marks.map(m => m.x)
    return {
      sign: marks[0],
      // ⭐ The window is the trill's OWN drawn ink — sign and wiggle — which is the stretch of x the
      //   layout pass looked for a curve over.
      from: Math.min(...xs),
      to: Math.max(...xs),
      arcs: h.curveSamples('g.vf-slur path'),
      dynamic: h.placed('g.vf-annotation text')[0],
      top: stave.top,
      spacing: (stave.bottom - stave.top) / 4,
    }
  }, opts)
}

test('⭐⭐ a `tr` inside a slur’s span sits OUTSIDE the arc — Gould p. 135', async ({ score }) => {
  const r = await slurOverTrill(score, { slur: true })
  const arcYs = curveYsIn(r.arcs, r.from, r.to)

  expect(arcYs.length, 'the fixture really does draw an arc over the sign').toBeGreaterThan(0)
  const arcTop = Math.min(...arcYs)
  // y grows DOWN, so "outside" is a smaller y.
  expect(r.sign.y, 'the sign clears the arc').toBeLessThan(arcTop)

  // ⭐ And by the family's own padding, which is the 0.5 sp the three engines agree on (MuseScore's
  // `Sid::trillMinDistance`, Verovio's margin, LilyPond's 0.46) — read as air, not as a constant.
  //
  // ⚠️ **A HAIR under 0.5, and the reason is worth knowing: the two are not sampling the same curve
  // at the same rate.** `drawCurveArc` records 17 points for the layout to read; this test walks the
  // drawn path at 64, so it finds a point slightly higher on the arch than the model ever saw
  // (measured: 0.488 sp, i.e. 0.012 short). Asserting an exact 0.5 would be asserting our own
  // arithmetic back to us; what the picture owes is *about half a space, and never zero*.
  const air = (arcTop - r.sign.y) / r.spacing
  expect(air, 'there is real air between the two').toBeGreaterThan(0.4)
  expect(air, 'and it is the padding, not a flight off the page').toBeLessThan(1.5)
})

test('🚨 …and the SLUR is what put it there — the same bar without one keeps its floor', async ({ score }) => {
  // The break-test for the fixture itself: if the trilled note's own ink were doing this work, the
  // two would come out the same and the test above would pass with the curve read deleted.
  const withSlur = await slurOverTrill(score, { slur: true })
  const without = await slurOverTrill(score, { slur: false })

  expect(without.sign.y, 'no arc to clear → the sign sits nearer the staff').toBeGreaterThan(withSlur.sign.y)
  expect((without.sign.y - withSlur.sign.y) / withSlur.spacing,
    'and the difference is the arc, not a rounding wobble').toBeGreaterThan(1)
})

test('⭐⭐ the DYNAMIC above it moves too — the ladder reads the LIFTED trill, not a snapshot', async ({ score }) => {
  // The cascade, which is where the first design of this went wrong: the dynamics used to be planned
  // (and drawn) before any slur existed, so a lifted `tr` would have been pushed through the `p`
  // above it. The families are now planned after the curves, in ladder order, so this is true by
  // construction rather than by a repair pass.
  const withSlur = await slurOverTrill(score, { slur: true })
  const without = await slurOverTrill(score, { slur: false })

  expect(withSlur.dynamic.y, 'the `p` stays outside the trill it clears').toBeLessThan(withSlur.sign.y)
  expect(without.dynamic.y, 'and it followed the trill outward when the slur lifted it')
    .toBeGreaterThan(withSlur.dynamic.y)
})

test('⭐ the ENDPOINT case: a slur STARTING on the trilled note — Gould p. 138 (d)', async ({ score }) => {
  // ⛔ An ornament does NOT follow the articulation rule (Gould p. 121–122), which flips an accent
  // INSIDE a slur mid-span and outside at its ends. The trill has its own rung and does not flip:
  // her p. 138 (d) is an endpoint case and the `tr` is outside there too.
  const r = await score.evaluate(async () => {
    const h = window.__h
    const ids = [{ step: 'B', octave: 4 }, { step: 'C', octave: 6 },
      { step: 'C', octave: 6 }, { step: 'B', octave: 4 }].map((p, beat) =>
      h.engine.addNoteAtBeat({
        step: p.step, octave: p.octave, duration: 'q', measure: 1, beat: h.frac(beat, 1),
      })!.id)
    h.engine.createSlur([ids[0], ids[3]])   // the slur STARTS on the note that is trilled
    h.engine.addTrill({ startNoteId: ids[0] })
    await h.render()
    const marks = h.placed('g.vf-trill text')
    const xs = marks.map(m => m.x)
    return {
      sign: marks[0],
      from: Math.min(...xs),
      to: Math.max(...xs),
      arcs: h.curveSamples('g.vf-slur path'),
    }
  })

  const arcYs = curveYsIn(r.arcs, r.from, r.to)
  expect(arcYs.length).toBeGreaterThan(0)
  expect(r.sign.y, 'the trill is outside its own slur’s first note').toBeLessThan(Math.min(...arcYs))
})

test('⭐ a TIE under the wavy line is an obstacle too — Gould p. 139', async ({ score }) => {
  // *Change of trilling note* draws ties hugging the noteheads with the wavy line above them — and a
  // trill's span runs THROUGH ties by definition (`Trill.endNoteId` absent = the start note's own
  // sounding duration, through ties), so this is the commoner of the two collisions.
  const read = async (tied: boolean) => score.evaluate(async (tie: boolean) => {
    const h = window.__h
    const first = h.engine.addNoteAtBeat({
      step: 'C', octave: 6, duration: 'w', measure: 1, beat: h.frac(0, 1) })!.id
    h.engine.addMeasure()
    const second = h.engine.addNoteAtBeat({
      step: 'C', octave: 6, duration: 'w', measure: 2, beat: h.frac(0, 1) })!.id
    if (tie) h.engine.updateNote(first, { tiedTo: second })
    h.engine.addTrill({ startNoteId: first })
    await h.render()
    const marks = h.placed('g.vf-trill text')
    const xs = marks.map(m => m.x)
    return {
      sign: marks[0],
      from: Math.min(...xs),
      to: Math.max(...xs),
      arcs: h.curveSamples('g.vf-tie path'),
    }
  }, tied)

  const tied = await read(true)
  const tieYs = curveYsIn(tied.arcs, tied.from, tied.to)
  expect(tieYs.length, 'the tie is drawn above these stemless high notes').toBeGreaterThan(0)
  expect(tied.sign.y, 'the sign clears the tie').toBeLessThan(Math.min(...tieYs))
  expect((await read(false)).sign.y, 'and without the tie it sits nearer the staff')
    .toBeGreaterThan(tied.sign.y)
})

test('🚨🚨 the BELOW mirror: flip both, and the `tr` goes UNDER the arc', async ({ score }) => {
  // ⛔ NOT optional, and ⛔ not "a second voice" — a trill's side is STORED and flipped by `x`
  // (`trillOps.toggleTrillPlacement`), so any trill in any score can be on this side. A lift written
  // with an implicit "up" in it passes every case above with the side term deleted; this is the one
  // that bites, exactly as the ottava's 8vb did.
  const r = await score.evaluate(async () => {
    const h = window.__h
    // Low outer notes → stems up → the slur goes BELOW, on the notehead side.
    const ids = [{ step: 'C', octave: 4 }, { step: 'G', octave: 4 },
      { step: 'G', octave: 4 }, { step: 'C', octave: 4 }].map((p, beat) =>
      h.engine.addNoteAtBeat({
        step: p.step, octave: p.octave, duration: 'q', measure: 1, beat: h.frac(beat, 1),
      })!.id)
    h.engine.createSlur([ids[0], ids[3]])
    const trill = h.engine.addTrill({ startNoteId: ids[1] })!
    h.engine.toggleTrillPlacement(trill.id)
    await h.render()
    const stave = h.staves()[0]
    const marks = h.placed('g.vf-trill text')
    const xs = marks.map(m => m.x)
    return {
      sign: marks[0],
      from: Math.min(...xs),
      to: Math.max(...xs),
      arcs: h.curveSamples('g.vf-slur path'),
      bottom: stave.bottom,
    }
  })

  const arcYs = curveYsIn(r.arcs, r.from, r.to)
  expect(arcYs.length, 'the arc is drawn under the notes').toBeGreaterThan(0)
  expect(r.sign.y, 'the sign is below the staff at all').toBeGreaterThan(r.bottom)
  expect(r.sign.y, 'and OUTSIDE the arc, which below the staff means a LARGER y')
    .toBeGreaterThan(Math.max(...arcYs))
})
