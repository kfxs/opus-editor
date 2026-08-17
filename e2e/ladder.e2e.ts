import { test, expect } from './fixtures'

/**
 * THE ABOVE-STAFF LADDER — the four families in order, over one bar (docs/ottava-plan.md P0b,
 * docs/above-staff-ladder.md §4's module, finally due).
 *
 * ⚠️ **This cannot be a unit test and the distinction matters here more than usual.** The ladder's
 * order emerges from three passes each measuring their own glyph's ink and clearing what the last
 * one claimed; in jsdom every one of those measurements is 0, so a headless assertion would find all
 * four families stacked on the same y and agree with itself. The arithmetic each pass performs is
 * unit-tested without a browser (`inkBand.test.ts`, `outsideStaffBand.test.ts`,
 * `dynamicsLinePlan.test.ts`, `TrillRenderer.ladder.test.ts`); what is checked here is the ORDER
 * that falls out when the numbers are real.
 *
 * ⭐ LilyPond states the same order as `outside-staff-priority`: TrillSpanner **50**,
 * DynamicLineSpanner **250**, OttavaBracket 400, MetronomeMark **1300**. We have three of those
 * today and the fourth is what the ladder was built for.
 */

/** y grows DOWNWARD, so "further from the staff" (above it) means a SMALLER y. */
const above = (y: number, top: number) => y < top

/**
 * The one bar carrying all three families, plus the staff it sits on.
 *
 * ⚠️⚠️ **The note is HIGH on purpose, and the first version of this fixture was not.** Over
 * staff-resident music all three families land on their own floors (1.0, 2.1, 3.0), which come out
 * in order whether or not anything reads anything — so the ordering test passed with the tempo
 * pass's ladder read deleted. Proven by break-test, not by reading. A note four ledger lines up
 * pushes the trill and the dynamic past 3.0, so the tempo mark can only end up outside them by
 * actually clearing what they claimed.
 */
async function threeFamilies(score: import('@playwright/test').Page, octave = 6) {
  return score.evaluate(async (oct: number) => {
    const h = window.__h
    const id = h.engine.addNoteAtBeat({ step: 'B', octave: oct, duration: 'w', measure: 1, beat: h.frac(0, 1) })!.id
    h.engine.addTrill({ startNoteId: id })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p', placement: 'above' })
    h.engine.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegro' })
    await h.render()
    const stave = h.staves()[0]
    return {
      trill: h.placed('g.vf-trill text')[0],
      dynamic: h.placed('g.vf-annotation text')[0],
      tempo: h.placed('g.vf-tempo text')[0],
      tempoBox: h.inkSizes('g.vf-tempo text')[0],
      dynamicBox: h.inkSizes('g.vf-annotation text')[0],
      top: stave.top,
      spacing: (stave.bottom - stave.top) / 4,
    }
  }, octave)
}

test('⭐⭐ trill → dynamic → tempo: innermost to outermost, over one bar carrying all three', async ({ score }) => {
  const { trill, dynamic, tempo, top } = await threeFamilies(score)

  expect(trill, 'the trill drew').toBeDefined()
  expect(dynamic, 'the dynamic drew').toBeDefined()
  expect(tempo, 'the tempo mark drew').toBeDefined()

  // All three above the staff…
  expect(above(trill.y, top)).toBe(true)
  expect(above(dynamic.y, top)).toBe(true)
  expect(above(tempo.y, top)).toBe(true)

  // …and in the order the ladder says, each one further out than the last.
  expect(trill.y, 'the trill is nearest the staff (LilyPond 50)').toBeGreaterThan(dynamic.y)
  expect(dynamic.y, 'the dynamic is outside it (250) and inside tempo (1300)').toBeGreaterThan(tempo.y)
})

test('⭐⭐ the tempo mark and the dynamic below it do not OVERLAP', async ({ score }) => {
  const { tempoBox, dynamicBox } = await threeFamilies(score)
  // Boxes, not baselines: the ordering test above passes on baselines alone even if the two glyphs
  // interpenetrate. `y` is a box's top edge and y grows downward, so the tempo's BOTTOM must clear
  // the dynamic's TOP.
  expect(tempoBox.y + tempoBox.height, 'the tempo mark ends above where the dynamic begins')
    .toBeLessThanOrEqual(dynamicBox.y)
})

/**
 * ⭐⭐ THE DEFECT P0b EXISTS TO FIX. `TempoLayout` drew every mark at `stave.getYForTopText(1)` — a
 * baseline exactly 2 staff spaces above the top line, whatever was underneath it. A dynamic placed
 * above the staff sits at its own family's floor of 2.1 spaces, i.e. **through the words**.
 */
test('⭐⭐ a tempo mark CLEARS a dynamic placed above the staff — the constant could not', async ({ score }) => {
  const { withDynamic, alone, top } = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegro' })
    await h.render()
    const alone = h.placed('g.vf-tempo text')[0].y

    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p', placement: 'above' })
    await h.render()
    return { withDynamic: h.placed('g.vf-tempo text')[0].y, alone, top: h.staves()[0].top }
  })

  expect(above(alone, top)).toBe(true)
  // Adding the dynamic must push the tempo mark FURTHER OUT. Under the old constant this number was
  // identical either way, which is precisely the bug.
  expect(withDynamic, 'the dynamic pushed the tempo mark out').toBeLessThan(alone)
})

test('⭐ …and it clears LEDGER LINES, which the constant was also blind to', async ({ score }) => {
  const { high, low, top } = await score.evaluate(async () => {
    const h = window.__h
    const id = h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })!.id
    h.engine.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegro' })
    await h.render()
    const low = h.placed('g.vf-tempo text')[0].y

    // The same bar, its one note moved four ledger lines up.
    h.engine.updateNote(id, { step: 'C', octave: 7 })
    await h.render()
    return { high: h.placed('g.vf-tempo text')[0].y, low, top: h.staves()[0].top }
  })

  expect(above(low, top)).toBe(true)
  expect(high, 'the high note pushed the tempo mark out').toBeLessThan(low)
})

/**
 * ⭐⭐ HIS REPORT, 2026-08-13: **clicking the `tr` selected the tempo mark.**
 *
 * Not a ladder bug — the two glyphs were drawn in the right order — but a HIT-BOX one, and
 * pre-existing: `drawTempoMarks` registered `group.getBBox()`, and a mark carrying a metronome glyph
 * has a MUSIC-font run in it whose full em box `getBBox` unions. Measured at **86 px tall** for one
 * 14 pt line, reaching from above the mark down past the staff's top line — so the trill's box sat
 * entirely inside it, and `ELEMENT_HIT_ORDER` asks `TEMPO_ELEMENT` (3rd) before `TRILL_ELEMENT` (8th).
 *
 * ⚠️ This is a REGISTRY test, not an ink test: the boxes are what the hit-test reads, and the glyphs
 * were never in the wrong place. The same defect, in the same form, is the one `DynamicsLayout`
 * already rebuilds its box to avoid.
 */
test('⭐⭐ the tempo mark’s hit-box is a TEXT LINE, and does not swallow the trill under it', async ({ score }) => {
  const { tempo, trill } = await score.evaluate(async () => {
    const h = window.__h
    // His fixture: a C5 whole note, a trill on it, and a metronome mark on the downbeat.
    const id = h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'w', measure: 1, beat: h.frac(0, 1) })!.id
    h.engine.addTrill({ startNoteId: id })
    h.engine.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegretto ♩ = 60', unit: 'q', bpm: 60 })
    await h.render()
    const boxes = h.engine.getElementRegistry().getAll()
    const of = (type: string) => boxes.filter(e => e.type === type).map(e => e.bbox)[0]
    return { tempo: of('tempo'), trill: of('trill') }
  })

  expect(tempo, 'the tempo mark registered a box').toBeDefined()
  expect(trill, 'the trill registered a box').toBeDefined()

  // A 14 pt line of text plus a 16 px glyph is ~15 px tall. The em box was 86.
  expect(tempo.height, 'the box is a text line, not a music-font em box').toBeLessThan(30)

  // …and the decisive one: they must not overlap vertically where they overlap horizontally.
  const sharesX = tempo.x < trill.x + trill.width && trill.x < tempo.x + tempo.width
  expect(sharesX, 'the fixture must actually put them over each other').toBe(true)
  expect(tempo.y + tempo.height, 'the tempo box ends above where the trill box begins')
    .toBeLessThanOrEqual(trill.y)
})

/**
 * ⚠️ The trap `dynamicMarkTransform` was written for, now that a second family translates: the pass
 * runs over measures nobody re-engraved, whose group still carries the last render's transform. If
 * the write ADDED instead of SET, the mark would walk up the page one row's worth per render.
 */
test('⚠️ rendering again does not move the mark — the translate is idempotent', async ({ score }) => {
  const { first, second, third } = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegro' })
    await h.render()
    const first = h.placed('g.vf-tempo text')[0].y
    await h.render()
    const second = h.placed('g.vf-tempo text')[0].y
    await h.render()
    return { first, second, third: h.placed('g.vf-tempo text')[0].y }
  })

  expect(second).toBeCloseTo(first, 3)
  expect(third).toBeCloseTo(first, 3)
})

/**
 * ⭐⭐ **THE BELOW-STAFF LADDER, AND THE ONE PAIR THAT CHANGED SIDES ON 2026-08-17.**
 *
 * 🚨 **Gould p. 101**: *"other markings — such as those for articulation, slurs, **octave signs** and
 * tuplet brackets — are **required to be closer to notes**, so add these markings to the music
 * **before positioning dynamics**"*, with p. 102 drawing the correct/incorrect pair. We had it the
 * other way round on LilyPond's priorities (OttavaBracket 400 vs DynamicLineSpanner 250) plus a
 * misread sentence of hers, and the "incorrect" half of her figure is what this renderer produced.
 *
 * ⚠️⚠️ **IT HAS TO BE AN 8v*B* AND A DYNAMIC PLACED BELOW, and that is why the whole above-staff
 * suite above missed this.** An 8va lives above the staff and dynamics default below it, so the two
 * never compete — every existing ottava and ladder case stayed green through the reorder because
 * none of them put the pair on the same side. Gould's own figure is an ottava *bassa* for exactly
 * this reason.
 *
 * ⚠️⚠️ **AND THE MUSIC IS LOPSIDED ON PURPOSE — the first fixture here was not, and proved less than
 * it looked.** With every note equally low, the bracket and the dynamic compute the SAME big ink band
 * from the same columns, and the dynamic lands outside simply because its own clearance is the larger
 * of the two. That version passed with the dynamics' ladder read deleted. So: one very low note at the
 * START of the bar, which only the bracket spans, and the dynamic on a STAFF-RESIDENT note at the end,
 * where its own ink would put it near its 2.1 floor. It can then only end up outside the bracket by
 * having read the bracket's claim.
 */
async function belowStaffPair(score: import('@playwright/test').Page) {
  return score.evaluate(async () => {
    const h = window.__h
    // ⭐ The low note is the BRACKET's problem alone; the dynamic's column is ordinary music.
    h.engine.addNoteAtBeat({ step: 'C', octave: 2, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(2, 1) })
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(3, 1) })
    h.engine.addOttava(1, { beat: h.frac(0, 1), length: h.frac(4, 1), shift: -1 })
    h.engine.addDynamic(1, { beat: h.frac(3, 1), text: 'p' })
    await h.render()
    const stave = h.staves()[0]
    const flat = (seg: { x1: number; y1: number; x2: number; y2: number }) => Math.abs(seg.y2 - seg.y1) < 1
    return {
      ottavaLine: h.segments('g.vf-ottava path').filter(flat)[0],
      dynamic: h.placed('g.vf-annotation text')[0],
      bottom: stave.bottom,
      spacing: (stave.bottom - stave.top) / 4,
    }
  })
}

test('⭐⭐ below the staff, the 8vb sits INSIDE the dynamic — Gould p. 101–102', async ({ score }) => {
  const { ottavaLine, dynamic, bottom, spacing } = await belowStaffPair(score)

  expect(ottavaLine, 'the bracket drew').toBeDefined()
  expect(dynamic, 'the dynamic drew').toBeDefined()

  // y grows DOWNWARD, and both are below the staff — so "closer to the notes" is the SMALLER y.
  expect(ottavaLine.y1, 'the bracket is below the staff at all').toBeGreaterThan(bottom)
  expect(dynamic.y, '⭐⭐ the dynamic is FURTHER out than the bracket').toBeGreaterThan(ottavaLine.y1)

  // ⭐⭐ THE DISCRIMINATING HALF. The dynamic sits on staff-resident music, so its OWN ink band would
  // put it around its 2.1-space floor. It is further out than that only because it cleared the
  // bracket, which the low note at the start of the bar pushed well past it.
  expect(ottavaLine.y1 - bottom, 'the low note pushed the bracket past the dynamics\' floor')
    .toBeGreaterThan(spacing * 2.1)
  expect(dynamic.y - bottom, 'so the dynamic had to travel past its own floor too')
    .toBeGreaterThan(spacing * 2.1)
})

/**
 * ⭐ The FLOORS, on their own — an empty-handed check that the order survives where there is no ink to
 * read. This is the case `OTTAVA_LINE.minFromStaff` exists for, and the one that catches it being left
 * behind by a pass reorder: 1.5 sits between the trill's 1.0 and the dynamics' 2.1, where 2.5 (its
 * value until 2026-08-17) sat outside the dynamics and was correct for the OLD rung.
 *
 * ⚠️ Deliberately staff-resident music, i.e. exactly the fixture the case above may NOT use.
 */
test('⭐ …and on ordinary music the FLOORS keep the same order', async ({ score }) => {
  const { ottavaLine, dynamic, bottom } = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    h.engine.addOttava(1, { beat: h.frac(0, 1), length: h.frac(4, 1), shift: -1 })
    h.engine.addDynamic(1, { beat: h.frac(0, 1), text: 'p' })
    await h.render()
    const stave = h.staves()[0]
    const flat = (seg: { x1: number; y1: number; x2: number; y2: number }) => Math.abs(seg.y2 - seg.y1) < 1
    return {
      ottavaLine: h.segments('g.vf-ottava path').filter(flat)[0],
      dynamic: h.placed('g.vf-annotation text')[0],
      bottom: stave.bottom,
    }
  })
  expect(ottavaLine.y1).toBeGreaterThan(bottom)
  expect(dynamic.y, 'the dynamic is still the outer of the two').toBeGreaterThan(ottavaLine.y1)
})
