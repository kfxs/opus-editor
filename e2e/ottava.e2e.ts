import { test, expect } from './fixtures'

/**
 * OCTAVE LINES — the numeral and its dashed bracket, drawn (docs/ottava-plan.md P3).
 *
 * ⚠️ **This suite has to be here.** Every claim below is about where ink landed: the numeral's width
 * decides where the dashes start, the notehead's width decides where they stop, and the y is stated
 * against measured ink. All of those are 0 in jsdom (`reference_jsdom_cannot_measure_glyphs`), so a
 * headless assertion would agree with itself. The MODEL arithmetic is unit-tested without a browser
 * (`ottavaOps.test.ts`, `OttavaRenderer.ladder.test.ts`); what is checked here is that the drawing
 * obeys it.
 *
 * ⚠️ Codepoints as lowercase hex, `trill.e2e.ts`'s convention: a literal SMuFL character in a source
 * file is invisible in most diffs and editors, so a wrong one would be unreadable rather than wrong.
 */
// ⭐ HIS CALL, 2026-08-13: the ALTA/BASSA forms, not Gould's bare numeral (which was the first
// build, `ottava` E510). `8va` above, `8ba` below — see `OTTAVA_NUMERAL_GLYPHS`.
const ALTA = 'e511'     // SMuFL `ottavaAlta` — "8va"
const BASSA = 'e513'    // SMuFL `ottavaBassaBa` — "8ba" (⛔ not `8vb` E51C, the form Gould excludes)
// ⚠️ TEXT parentheses, not SMuFL's `octaveParensLeft`/`Right` (U+E51A/E51B) — his italic call,
// 2026-08-13, and the music font owns no italic face so the dedicated glyphs could not slant.
// See `OTTAVA_PAREN_LEFT` for the trade that was made.
const PAREN_L = '28'   // '('
const PAREN_R = '29'   // ')'

/** y grows DOWNWARD, so "further above the staff" means a SMALLER y. */

/** Four quarters in bar 1, an 8va over the first `covers` beats of them. */
async function overQuarters(
  score: import('@playwright/test').Page,
  covers: number,
  shift: 1 | -1 = 1,
  octave = 4,
) {
  return score.evaluate(async ({ covers, shift, octave }) => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addOttava(1, { beat: h.frac(0, 1), length: h.frac(covers, 1), shift })
    await h.render()
    const stave = h.staves()[0]
    return {
      glyphs: h.placed('g.vf-ottava text'),
      segments: h.segments('g.vf-ottava path'),
      heads: h.inkSizes('g.vf-notehead text'),
      // ⚠️ The bar's CLOSING barline — `barlines()[0]` is the opening one, which is left of
      // every note and would make this assertion pass on any geometry at all.
      barline: Math.max(...h.barlines().map(b => b.x)),
      top: stave.top,
      bottom: stave.bottom,
      spacing: (stave.bottom - stave.top) / 4,
    }
  }, { covers, shift, octave })
}

/** The dashed horizontal — the one nearly-flat segment the bracket draws. */
const horizontalOf = (segments: { x1: number; y1: number; x2: number; y2: number }[]) =>
  segments.find(s => Math.abs(s.y2 - s.y1) < 1 && s.x2 > s.x1)

/** The hook — the one vertical segment. */
const hookOf = (segments: { x1: number; y1: number; x2: number; y2: number }[]) =>
  segments.find(s => Math.abs(s.x2 - s.x1) < 1 && Math.abs(s.y2 - s.y1) > 1)

test('⭐ draws `8va` — the alta form, his call over Gould\'s bare numeral', async ({ score }) => {
  const { glyphs } = await overQuarters(score, 3)
  expect(glyphs.map(g => g.code)).toContain(ALTA)
  expect(glyphs.some(g => g.code === PAREN_L), 'no parens on the first fragment').toBe(false)
})

/**
 * ⭐⭐ **THE RULE THIS FEATURE TURNS ON** — Gould §1 rule 2: the line ends at the LAST NOTEHEAD, not
 * at the end of that note's duration. She calls the other reading *incorrect*.
 *
 * ⚠️⚠️ **It is the OPPOSITE of the trill's and the hairpin's x rule** ("read to the slot's END"), so
 * this test exists to fail the day someone makes the three consistent. If it goes red because the
 * bracket now reaches the next notehead or the barline, the neighbour's rule has been copied here
 * and the book has been overruled by tidiness.
 */
test('⭐⭐ the bracket stops at the LAST NOTEHEAD — not at the end of its duration', async ({ score }) => {
  const { segments, heads } = await overQuarters(score, 2)
  const line = horizontalOf(segments)!
  expect(line, 'a dashed horizontal was drawn').toBeDefined()

  const second = heads[1]
  const third = heads[2]
  const secondRight = second.x + second.width
  // It reaches PAST the second notehead's far side — his air before the hook (OTTAVA_END_AIR), so
  // the hook comes down clear of the note rather than hard against it…
  expect(line.x2).toBeGreaterThan(secondRight)
  expect(line.x2 - secondRight, 'but only a little — it is air, not another note').toBeLessThan(second.width)
  // …and stops well short of the third note, which the span does not cover.
  expect(line.x2, 'never reaches the note after the span').toBeLessThan(third.x)
})

test('⭐ …and over a whole bar it stops at the last note, not at the BARLINE', async ({ score }) => {
  const { segments, heads, barline } = await overQuarters(score, 4)
  const line = horizontalOf(segments)!
  const last = heads[heads.length - 1]
  const lastRight = last.x + last.width
  expect(line.x2).toBeGreaterThan(lastRight)              // the air
  expect(line.x2 - lastRight).toBeLessThan(last.width)    // …and no more than that
  expect(line.x2, 'the bar goes on; the octave line does not').toBeLessThan(barline - 5)
})

test('the dashed line is DASHED, and the numeral comes before it', async ({ score }) => {
  const dash = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addOttava(1, { beat: h.frac(0, 1), length: h.frac(4, 1), shift: 1 })
    await h.render()
    const paths = [...document.querySelectorAll('g.vf-ottava path')]
    return {
      dasharrays: paths.map(p => p.getAttribute('stroke-dasharray') ?? ''),
      glyphX: h.placed('g.vf-ottava text')[0]?.x ?? 0,
      lineX1: h.segments('g.vf-ottava path').find(s => Math.abs(s.y2 - s.y1) < 1)?.x1 ?? 0,
    }
  })
  expect(dash.dasharrays.some(d => d.length > 0), 'the horizontal carries a dash pattern').toBe(true)
  expect(dash.lineX1, 'the line starts after the numeral').toBeGreaterThan(dash.glyphX)
})

/**
 * ⭐ §1 rule 3 — **never a dangling hook**, and rule 4 — the hook's direction is half of what tells
 * the reader which way the octave goes.
 */
test('⭐ an 8va hooks DOWNWARD at its end, toward the staff', async ({ score }) => {
  const { segments } = await overQuarters(score, 3)
  const line = horizontalOf(segments)!
  const hook = hookOf(segments)
  expect(hook, 'the bracket is closed').toBeDefined()
  expect(hook!.x1).toBeCloseTo(line.x2, 0)
  expect(Math.max(hook!.y1, hook!.y2), 'it turns down, toward the staff').toBeGreaterThan(line.y1)
})

test('⭐ an 8vb sits BELOW the staff and hooks UPWARD — the side is DERIVED from the sign', async ({ score }) => {
  const { glyphs, segments, bottom } = await overQuarters(score, 3, -1)
  // ⭐ …and the GLYPH changes with it, not only the side: an 8vb prints `8ba`, a different
  // codepoint. That is the consequence of his alta/bassa call — the direction is now said twice.
  const numeral = glyphs.find(g => g.code === BASSA)!
  expect(numeral, 'the bassa glyph, not the alta one').toBeDefined()
  expect(numeral.y, 'below the bottom stave line').toBeGreaterThan(bottom)

  const line = horizontalOf(segments)!
  const hook = hookOf(segments)!
  expect(Math.min(hook.y1, hook.y2), 'it turns up, toward the staff').toBeLessThan(line.y1)
})

/**
 * ⚠️⚠️ **His report, 2026-08-13: *"for ottava alta the position of the line in y is good… for ottava
 * bassa is too low."*** The line offset was mirrored for `below` as if the numeral flipped with the
 * side. It does not: a glyph grows the same way from its baseline either way (`markBand` says so),
 * so the 8vb's line was drawn UNDER its own numeral.
 *
 * ⭐ Asserted as a RELATION between the line and the numeral, not as a number — the y depends on the
 * ladder, so any absolute value would be pinning the fixture rather than the rule.
 */
test('⭐⭐ the line NEVER hangs below the numeral\'s baseline — on either side', async ({ score }) => {
  // The first of the two reports: `baseline + raise` under the staff drew the 8vb's line beneath
  // its own numeral. A glyph does not flip with the side.
  for (const shift of [1, -1] as const) {
    const { glyphs, segments } = await overQuarters(score, 3, shift)
    const numeral = glyphs.find(g => g.code === (shift > 0 ? ALTA : BASSA))!
    const line = horizontalOf(segments)!
    // ⚠️ A half-pixel of slack, not a strict `<=`: the 8vb's line sits ON the baseline by design,
    // and both numbers are floats off a rendered SVG.
    expect(line.y1 - numeral.y, `shift ${shift}`).toBeLessThan(0.5)
    expect(numeral.y - line.y1, `shift ${shift}: and never floats off overhead`).toBeLessThan(20)
  }
})

/**
 * ⭐⭐ **The bracket closes TOWARD THE STAFF, so the two sides attach differently** — his second
 * report (*"now the line for ottava bassa is too up… it should align with `ba`"*). An 8va's hook
 * turns down, so its horizontal runs along the numeral's TOP; an 8vb's hook turns up, so its
 * horizontal runs along the numeral's FOOT. Measured, the two used to be identical.
 */
test('⭐⭐ an 8va\'s line runs along the numeral\'s TOP, an 8vb\'s along its FOOT', async ({ score }) => {
  const alta = await overQuarters(score, 3, 1)
  const altaNumeral = alta.glyphs.find(g => g.code === ALTA)!
  const altaLine = horizontalOf(alta.segments)!

  const bassa = await overQuarters(score, 3, -1)
  const bassaNumeral = bassa.glyphs.find(g => g.code === BASSA)!
  const bassaLine = horizontalOf(bassa.segments)!

  const altaRise = altaNumeral.y - altaLine.y1
  const bassaRise = bassaNumeral.y - bassaLine.y1
  expect(altaRise, 'the 8va sits well above its baseline').toBeGreaterThan(2)
  expect(bassaRise, 'the 8vb sits at it').toBeCloseTo(0, 1)
  expect(bassaRise, 'and the two are NOT the same attachment').toBeLessThan(altaRise)
})

/** A score long enough to break, with an octave line straddling the break. */
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
    h.engine.addOttava(onFirstRow, { beat: h.frac(0, 1), length: h.frac(8, 1), shift: 1 })
    await h.render()
    const heads2 = h.placed('g.vf-notehead text').filter(g => g.y > firstRowY + 5)
    const staves2 = h.staves().filter(s => s.measure > onFirstRow)
    return {
      glyphs: h.placed('g.vf-ottava text'),
      segments: h.segments('g.vf-ottava path'),
      row1Y: firstRowY,
      /** The first notehead of system 2 — what the continuation must sit LEFT of. */
      firstNoteOfRow2: Math.min(...heads2.map(g => g.x)),
      /** …and the stave's own left edge, which it must never reach back past. */
      staveLeftOfRow2: Math.min(...staves2.map(s => s.x1)),
    }
  })
}

test('⭐⭐ across a system break the numeral repeats PARENTHESISED — the documented convention', async ({ score }) => {
  const { glyphs, row1Y } = await acrossABreak(score)
  const onRow2 = glyphs.filter(g => g.y > row1Y + 5)
  expect(onRow2.length, 'the line continues onto the second system').toBeGreaterThan(0)
  expect(onRow2.map(g => g.code), 'and says (8va)').toEqual([PAREN_L, ALTA, PAREN_R])

  const onRow1 = glyphs.filter(g => g.y <= row1Y + 5)
  expect(onRow1.map(g => g.code), 'while the first fragment is unparenthesised').toEqual([ALTA])
})

/**
 * ⚠️ **His report, 2026-08-13, with a screenshot:** *"the x position of the continuation is more to
 * the right than i expected… basically it should be more to the left."* The bracket inherited
 * `planSlurSegments`' left edge, which is `noteStartX` — right for a slur (an arc resumes where the
 * music does) and wrong for a REMINDER, which is read before the first note rather than with it.
 */
test('⭐⭐ the continuation numeral sits LEFT of the first note, without reaching the stave edge', async ({ score }) => {
  const { glyphs, row1Y, firstNoteOfRow2, staveLeftOfRow2 } = await acrossABreak(score)
  const onRow2 = glyphs.filter(g => g.y > row1Y + 5)
  const openParen = onRow2.find(g => g.code === PAREN_L)!

  expect(openParen.x, 'left of the music it reminds you about').toBeLessThan(firstNoteOfRow2)
  expect(openParen.x, 'but still on the stave — never back past its left edge').toBeGreaterThanOrEqual(staveLeftOfRow2)
})

test('⭐ …and only the LAST fragment is hooked — a hook at a break would say the line stopped', async ({ score }) => {
  const { segments, row1Y } = await acrossABreak(score)
  const hooks = segments.filter(s => Math.abs(s.x2 - s.x1) < 1 && Math.abs(s.y2 - s.y1) > 1)
  expect(hooks.length, 'exactly one hook for the whole line').toBe(1)
  expect(hooks[0].y1, 'and it is on the second system').toBeGreaterThan(row1Y + 5)
})

/**
 * ⭐⭐ **THE LADDER — the ottava reads what the inner families took.**
 *
 * ⚠️⚠️ **The note is FOUR LEDGER LINES UP on purpose, and a lower one would prove nothing.** Over
 * staff-resident music the trill and the ottava land on their own floors (1.0 and 2.5), which come
 * out in order whether or not either reads anything. High music drives BOTH off the same ink band,
 * so with the `bandOver` read deleted they land on top of each other — which is the failure this
 * fixture is shaped to produce. That lesson is `e2e/ladder.e2e.ts`'s, learned by break-test, and it
 * applies to every family added to this ladder.
 */
test('⭐⭐ an 8va clears a TRILL under it — LilyPond\'s 400 against 50', async ({ score }) => {
  const { trill, ottava } = await score.evaluate(async () => {
    const h = window.__h
    const id = h.engine.addNoteAtBeat({ step: 'B', octave: 6, duration: 'w', measure: 1, beat: h.frac(0, 1) })!.id
    h.engine.addTrill({ startNoteId: id })
    h.engine.addOttava(1, { beat: h.frac(0, 1), length: h.frac(4, 1), shift: 1 })
    await h.render()
    return {
      trill: h.placed('g.vf-trill text')[0],
      ottava: h.placed('g.vf-ottava text')[0],
    }
  })
  expect(ottava, 'the bracket drew').toBeDefined()
  expect(ottava.y, 'the 8va sits OUTSIDE the trill').toBeLessThan(trill.y)
})

test('⭐⭐ …and the TEMPO mark clears the 8va in turn — the rung above it', async ({ score }) => {
  const { ottava, tempo } = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'B', octave: 6, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addOttava(1, { beat: h.frac(0, 1), length: h.frac(4, 1), shift: 1 })
    h.engine.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegro' })
    await h.render()
    return {
      ottava: h.placed('g.vf-ottava text')[0],
      tempo: h.placed('g.vf-tempo text')[0],
    }
  })
  expect(tempo.y, 'tempo is the outermost family').toBeLessThan(ottava.y)
})

test('an 8va does NOT move a notehead — written pitch, so no bar gets wider', async ({ score }) => {
  const { before, after } = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    await h.render()
    const before = h.placed('g.vf-notehead text').map(g => ({ x: g.x, y: g.y }))
    h.engine.addOttava(1, { beat: h.frac(0, 1), length: h.frac(4, 1), shift: 1 })
    await h.render()
    return { before, after: h.placed('g.vf-notehead text').map(g => ({ x: g.x, y: g.y })) }
  })
  // The claim `MEASURE_RENDER_ROLE`'s `'ignored'` row makes, checked where it is actually true:
  // an octave line changes what a note SOUNDS, never where its head sits.
  expect(after).toEqual(before)
})

/**
 * ⭐⭐ **THE ENDPOINT SQUARES' INK NUDGE — and the one claim that can only be made here** (his ask,
 * 2026-08-17: *"take into consideration that ottava is a straight line, so offset in y should result
 * in offset the two points in y"*).
 *
 * The model half is unit-tested (`ottavaOps.test.ts`: there is one `y` and both squares write it).
 * What a headless test cannot say is that the DRAWING stayed straight — that the numeral, the dashes
 * and the hook all moved together and by the same amount. Every one of those is measured ink, and
 * measured ink is 0 in jsdom.
 */
async function nudgedBracket(
  score: import('@playwright/test').Page,
  offset: { startX?: number; endX?: number; outward?: number; shift?: 1 | -1 },
) {
  return score.evaluate(async (offset) => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    const ottava = h.engine.addOttava(1, { beat: h.frac(0, 1), length: h.frac(4, 1), shift: offset.shift ?? 1 })!
    await h.render()
    const before = {
      glyphs: h.placed('g.vf-ottava text'),
      segments: h.segments('g.vf-ottava path'),
    }
    // The two squares' own writes, through the same door the arrow keys use.
    if (offset.startX) h.engine.nudgeOttavaEndpoint(ottava.id, 'start', offset.startX, 0)
    if (offset.endX) h.engine.nudgeOttavaEndpoint(ottava.id, 'end', offset.endX, 0)
    // ⭐ The vertical is OUTWARD from the staff, not a screen y — see `OttavaOffsetOverride`.
    if (offset.outward) h.engine.nudgeOttavaEndpoint(ottava.id, 'start', 0, offset.outward)
    await h.render()
    return {
      before,
      after: {
        glyphs: h.placed('g.vf-ottava text'),
        segments: h.segments('g.vf-ottava path'),
      },
      spacing: (h.staves()[0].bottom - h.staves()[0].top) / 4,
    }
  }, offset)
}

test('⭐⭐ an OUTWARD nudge moves BOTH ends by the SAME amount — the bracket stays straight', async ({ score }) => {
  // +1 staff space further FROM the staff. On an 8va that is up the screen.
  const { before, after, spacing } = await nudgedBracket(score, { outward: 1 })
  const lineBefore = horizontalOf(before.segments)!
  const lineAfter = horizontalOf(after.segments)!
  const hookBefore = hookOf(before.segments)!
  const hookAfter = hookOf(after.segments)!

  const lifted = lineBefore.y1 - lineAfter.y1
  expect(lifted, 'one staff space up').toBeCloseTo(spacing, 0)
  // ⭐⭐ THE CLAIM: the far end of the same line rose by the same amount, so it is still level…
  expect(lineAfter.y1).toBeCloseTo(lineAfter.y2, 1)
  expect(lineBefore.y2 - lineAfter.y2).toBeCloseTo(lifted, 1)
  // …and the hook and the NUMERAL came with it, rather than the line detaching from its own mark.
  expect(hookBefore.y1 - hookAfter.y1).toBeCloseTo(lifted, 1)
  expect(before.glyphs[0].y - after.glyphs[0].y).toBeCloseTo(lifted, 1)
  // ⛔ And nothing moved sideways: a vertical nudge is vertical.
  expect(after.glyphs[0].x).toBeCloseTo(before.glyphs[0].x, 1)
  expect(lineAfter.x2).toBeCloseTo(lineBefore.x2, 1)
})

test('⭐ an `endX` nudge pulls the HOOK alone, leaving the numeral where it was', async ({ score }) => {
  const { before, after, spacing } = await nudgedBracket(score, { endX: -1 })
  const lineBefore = horizontalOf(before.segments)!
  const lineAfter = horizontalOf(after.segments)!
  expect(lineBefore.x2 - lineAfter.x2, 'the far end came in one space').toBeCloseTo(spacing, 0)
  expect(lineAfter.x1, 'the line still leaves the numeral where it did').toBeCloseTo(lineBefore.x1, 1)
  expect(after.glyphs[0].x).toBeCloseTo(before.glyphs[0].x, 1)
  expect(hookOf(after.segments)!.x1).toBeCloseTo(lineAfter.x2, 1) // the hook rode with it
})

test('⭐ a `startX` nudge pulls the NUMERAL and the line that leaves it, holding the hook', async ({ score }) => {
  const { before, after, spacing } = await nudgedBracket(score, { startX: 1 })
  const lineBefore = horizontalOf(before.segments)!
  const lineAfter = horizontalOf(after.segments)!
  expect(after.glyphs[0].x - before.glyphs[0].x, 'the numeral moved right one space').toBeCloseTo(spacing, 0)
  expect(lineAfter.x1 - lineBefore.x1).toBeCloseTo(spacing, 0)
  expect(lineAfter.x2, 'the far end stayed put').toBeCloseTo(lineBefore.x2, 1)
})

/**
 * 🚨🚨 **HIS BUG, 2026-08-17: the nudge stopped dead at the barline** — *"i cannot offset the right
 * side from a limit"*, with a log showing `numeralX` frozen at 350.0 while the ask ran on to −45
 * spaces. The cause was `Math.max(piece.x0 − inset, barLeft)`, a clamp that exists to stop the
 * AUTOMATIC continuation inset reaching back onto the clef, applied to the hand's nudge as well.
 *
 * ⭐ **A machine's guess is worth clamping; the engraver's own instruction is not.** The three cases
 * above all nudge by ONE space and passed throughout — they never reached the clamp, which is
 * precisely why this one nudges far enough to leave the bar.
 */
test('⭐⭐ a big nudge is NOT clamped at the barline — the hand overrules the automatic inset', async ({ score }) => {
  // ⚠️⚠️ **THE FIXTURE IS THE TEST HERE, and the first version of it proved nothing.** Put the
  // bracket in bar 1 and its numeral starts ~9 spaces right of the barline, because the clef and
  // meter push the first note along — so a six-space nudge never reaches the clamp and the case
  // passed against the BROKEN code. His score had the 8va on a later bar, where the numeral sits
  // roughly 2px off the bar's left edge and `←` hits the clamp on the second press.
  const { before, after, spacing, barLeft } = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    for (const measure of [1, 2]) {
      for (const beat of [0, 1, 2, 3]) {
        h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure, beat: h.frac(beat, 1) })
      }
    }
    const ottava = h.engine.addOttava(2, { beat: h.frac(0, 1), length: h.frac(4, 1), shift: 1 })!
    await h.render()
    const before = { glyphs: h.placed('g.vf-ottava text'), segments: h.segments('g.vf-ottava path') }
    // Six presses of `←`, one staff space each — the gesture, not one big write.
    for (let i = 0; i < 6; i++) h.engine.nudgeOttavaEndpoint(ottava.id, 'start', -1, 0)
    await h.render()
    const stave = h.staves()[0]
    return {
      before,
      after: { glyphs: h.placed('g.vf-ottava text'), segments: h.segments('g.vf-ottava path') },
      spacing: (stave.bottom - stave.top) / 4,
      // Bar 2's own left edge — the clamp that used to freeze the numeral.
      barLeft: h.barlines().map(b => b.x).sort((a, b) => a - b)[1],
    }
  })

  const moved = before.glyphs[0].x - after.glyphs[0].x
  expect(moved, 'six spaces left, all six of them').toBeCloseTo(6 * spacing, 0)
  // …and it really did leave the bar, or the clamp was simply never in the way.
  expect(before.glyphs[0].x - barLeft, 'the fixture starts hard against the barline').toBeLessThan(2 * spacing)
  expect(after.glyphs[0].x, 'past it — where the old clamp stopped dead').toBeLessThan(barLeft)
  // The line that leaves the numeral came too, so the mark is still one object.
  expect(horizontalOf(before.segments)!.x1 - horizontalOf(after.segments)!.x1).toBeCloseTo(moved, 1)
})

test('⭐ the END may still not be pulled shorter than a bracket that can CLOSE', async ({ score }) => {
  // The one floor that legitimately overrules the hand: `OTTAVA_MIN_LINE`. Pulled far left, the line
  // stops with a space of horizontal still past the numeral — a numeral, no rule and no hook would
  // leave the reader with nothing saying where the displacement ends.
  const { after } = await nudgedBracket(score, { endX: -40 })
  const line = horizontalOf(after.segments)
  expect(line, 'there is still a line').toBeDefined()
  expect(line!.x2).toBeGreaterThan(line!.x1)
  expect(hookOf(after.segments), 'and it still closes').toBeDefined()
})


test('⭐⭐ …and on an 8vb, further OUT is further DOWN — the stored number is not a screen y', async ({ score }) => {
  // ⚠️ The case that fails if the renderer stops negating above the staff, or starts negating below
  // it. His correction, 2026-08-17: the model stores a distance FROM the staff so that flipping an
  // ottava's direction cannot invert a nudge the user already made; the two sides therefore move in
  // OPPOSITE screen directions for the same positive number, and only a drawn test can say so.
  const { before, after, spacing } = await nudgedBracket(score, { outward: 1, shift: -1 })
  const lineBefore = horizontalOf(before.segments)!
  const lineAfter = horizontalOf(after.segments)!
  expect(lineAfter.y1 - lineBefore.y1, 'one staff space DOWN, away from the staff').toBeCloseTo(spacing, 0)
  expect(lineAfter.y1, 'and still level').toBeCloseTo(lineAfter.y2, 1)
  // The numeral came too, so the mark is still one object.
  expect(after.glyphs[0].y - before.glyphs[0].y).toBeCloseTo(spacing, 0)
})
