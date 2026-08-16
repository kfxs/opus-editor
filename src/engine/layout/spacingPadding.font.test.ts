import { describe, it, expect } from 'vitest'
import { INK, INK_HEIGHT, accidentalExtent, accidentalHeight, restBand, restExtent } from './spacingPadding'
import {
  accidentalGlyph,
  engravingDefault,
  flagDropFromTip,
  glyphBox,
  ledgerExtension,
  noteheadInk,
  restGlyph,
  secondDisplacement,
} from '@/engine/fonts/fontMetrics'
import { restStaffLine } from './restPlacement'
import type { NoteDuration } from '@/types/music'

/**
 * ⭐⭐ **OURS AGAINST THE FONT** — the first half of the split check
 * (docs/font-metrics-plan.md §4, F2).
 *
 * ## Why this file exists at all, and why it is NOT a derivation
 *
 * `spacingPadding.ts`'s numbers were measured off our own drawing, in Chrome, over months. They are
 * right — Bravura agrees with most of them exactly (plan §2). But *"measured in a session"* is not a
 * source you can go back to, and the day the drawing stops being VexFlow's (P3) a table calibrated
 * to VexFlow's behaviour describes nothing.
 *
 * ⛔ **The obvious fix is the wrong one.** Deriving the rows from the font
 * (`notehead: glyphBox('noteheadBlack').right`) would make this file a tautology — a derivation
 * cannot disagree with what it was derived from — and would delete the numbers the table's own
 * paragraphs are written against (plan §4.1). So the literals stay, and this is the GATE: every row
 * either equals the font, or is a **named override carrying its sentence**.
 *
 * ## ⚠️ The other half is in the browser and is a different claim
 *
 * This says *"our table agrees with the font"*. `e2e/kerning.e2e.ts` says *"the font agrees with
 * what is drawn"*. 🚨 They are not the same claim and the tests go green either way, which is the
 * silent change of subject §4 was written about: before F2 the browser tests asserted *"the table
 * describes what VexFlow draws"*, and re-sourcing the table would have quietly turned them into
 * this one without a single edit.
 */

const DURATIONS: NoteDuration[] = ['w', 'h', 'q', '8', '16', '32']

/** How close a row has to be to count as agreement: a hundredth of a staff space, ~0.1 px. */
const EXACT = 0.005

/**
 * ⛔ **THE OVERRIDE LIST — every place we knowingly differ from the font, and why.**
 *
 * A row here is a decision someone took in the open. A difference NOT here is a bug, and the tests
 * below are what turn it into a failing build rather than a discovery years later (plan §3.5).
 *
 * ⏭️ The entries marked **HIS EYE** are `docs/font-metrics-plan.md` §3.6 — batched, awaiting one
 * look. Each is one line to flip once he has decided.
 */
const OVERRIDES = {
  'INK.notehead': {
    ours: INK.notehead,
    font: () => noteheadInk('q'),
    why: '⏭️ HIS EYE (§3.6 #2). 1.13 is the DISPLACEMENT we measured off VexFlow wearing the ink\'s '
      + 'name; the font\'s head is 1.18. Taking it moves EVERY note-to-note gap and lifts '
      + 'MIN_COLUMN_GAP 1.43 → 1.48, which is the drag floor and the empty-bar floor.',
  },
  'INK.secondDisplacement': {
    ours: INK.secondDisplacement,
    font: () => secondDisplacement('q'),
    why: 'Kept at the 1.13 measured in Chrome against the font\'s 1.12 — 0.01 spaces is a tenth of '
      + 'a pixel, and a redraw is not worth it. ⛔ Not a taste question; delete this row whenever.',
  },
  'INK.flagReach': {
    ours: INK.flagReach,
    // The composition, not a glyph: reach past the HEAD = ink − stem + the flag's own width.
    font: () => glyphBox('flag8thUp').right - engravingDefault('stemThickness'),
    why: '⏭️ RIDES ON #2 (§3.1b). A flag\'s box is measured from the STEM\'s x, so its reach past '
      + 'the head is a composition; it cannot be re-sourced before the head\'s ink is settled.',
  },
  'INK.ledgerLeft': {
    ours: INK.ledgerLeft,
    font: () => ledgerExtension(),
    why: '⏭️ HIS EYE (§3.6 #5). The font\'s legerLineExtension is 0.40 each side; ours is 0.30 left. '
      + 'Slightly longer ledgers.',
  },
  'INK.ledgerRight': {
    ours: INK.ledgerRight,
    font: () => noteheadInk('q') + ledgerExtension(),
    why: '⏭️ HIS EYE (§3.6 #5). Same decision as ledgerLeft, from the other end: 1.18 + 0.40 = 1.58 '
      + 'against our 1.50.',
  },
  'INK_HEIGHT.notehead': {
    ours: INK_HEIGHT.notehead,
    font: () => glyphBox('noteheadBlack').up,
    why: '⭐ DELIBERATE AND SETTLED (§3.5). The font says 0.50; we round OUT to 0.6 because a height '
      + 'is used as a CLEARANCE, and a generous clearance is safe where a tight one collides.',
  },
  'INK_HEIGHT.flagFromTip': {
    ours: INK_HEIGHT.flagFromTip,
    font: () => flagDropFromTip('8', true),
    why: '⭐ DELIBERATE AND SETTLED. 3.3 against the font\'s 3.24 — rounded out, same clearance '
      + 'argument as the notehead height.',
  },
  'INK_HEIGHT.ledger': {
    ours: INK_HEIGHT.ledger,
    font: () => engravingDefault('legerLineThickness') / 2,
    why: '⭐ DELIBERATE. A ledger is a LINE, so its "height" is half its weight either side of '
      + 'itself: 0.16 / 2 = 0.08. Ours is 0.15, nearly double — the band is what a NEIGHBOUR must '
      + 'clear, and a hairline that two inks merely touch reads as one line through both.',
  },
} as const

describe('⭐ the ink table, against Bravura itself', () => {
  it('a DOT is exact, in both directions — the row that needed no argument', () => {
    // Plan §2: measured by eye over months, and the font agrees to the third decimal.
    expect(INK.dotWidth).toBeCloseTo(glyphBox('augmentationDot').right, 2)
    expect(INK_HEIGHT.dot).toBeCloseTo(glyphBox('augmentationDot').up, 2)
    expect(INK_HEIGHT.dot).toBeCloseTo(glyphBox('augmentationDot').down, 2)
  })

  it('⭐⭐ every ACCIDENTAL\'s height is the font\'s, ROUNDED OUT — never in', () => {
    // ⭐⭐ The property, and it is a better one than "equal": all ten numbers (five signs, two
    //    directions) are ≥ the font's and none is generous by more than 0.10 spaces. A height here
    //    is a CLEARANCE, so rounding OUT is correct and rounding IN is a collision — the same
    //    argument INK_HEIGHT.notehead's 0.5 → 0.6 carries (plan §3.5), holding across the table.
    //
    // ⚠️ So this is deliberately NOT `toBeCloseTo`. Pinning these to the font would be pinning the
    //    wrong side of a one-sided claim, and would fail the day someone rounds one out further for
    //    a reason.
    for (const sign of ['#', 'b', 'n', '##', 'bb']) {
      const glyph = accidentalGlyph(sign)
      expect(glyph, `${sign} has a glyph`).not.toBeNull()
      const box = glyphBox(glyph!)
      const ours = accidentalHeight(sign)
      expect(ours.up, `${sign} up clears the ink`).toBeGreaterThanOrEqual(box.up - EXACT)
      expect(ours.down, `${sign} down clears the ink`).toBeGreaterThanOrEqual(box.down - EXACT)
      expect(ours.up - box.up, `${sign} up is not generous`).toBeLessThan(0.12)
      expect(ours.down - box.down, `${sign} down is not generous`).toBeLessThan(0.12)
    }

    // ⭐ And the two facts the vertical table was built to say, from the font this time: a SHARP is
    //   symmetric about its line, a FLAT is not — its bowl sits a whole space higher than it hangs.
    const sharp = glyphBox('accidentalSharp')
    expect(sharp.up).toBeCloseTo(sharp.down, 1)
    const flat = glyphBox('accidentalFlat')
    expect(flat.up).toBeGreaterThan(flat.down + 1)
  })

  it('⭐⭐ an accidental COLUMN decomposes into the glyph plus ONE padding, ~0.31 spaces', () => {
    // Plan §3.2. `ACCIDENTAL_WIDTH` is a column width, not a glyph width, and nothing said what the
    // difference was. Against the font it comes out as one number across five glyphs of four
    // different widths — so the split is verifiable rather than a guess, and the two outliers
    // (a natural at 0.33, a double flat at 0.36) become VISIBLE instead of baked in.
    //
    // ⏭️ HIS EYE (§3.6 #3): whether to keep the five numbers or flatten them to one 0.31.
    const paddings = ['#', 'b', 'n', '##', 'bb'].map(sign => {
      // One sign at position 0 is one column, plus the gap to the head — so the column width is the
      // extent less that gap.
      const column = accidentalExtent([{ position: 0, sign }]) - INK.accidentalToHead
      return { sign, padding: column - glyphBox(accidentalGlyph(sign)!).right }
    })

    for (const { sign, padding } of paddings) {
      expect(padding, `${sign}'s column padding`).toBeGreaterThan(0.28)
      expect(padding, `${sign}'s column padding`).toBeLessThan(0.38)
    }

    // ⭐ ONE number, to within 0.06 across the whole family — which is the claim that makes it a
    //   padding at all rather than five unrelated widths.
    const spread = Math.max(...paddings.map(p => p.padding)) - Math.min(...paddings.map(p => p.padding))
    expect(spread, 'the family agrees on its padding').toBeLessThan(0.07)
  })

  it('⚠️ every REST is WIDER than the font says — the slack `REST_WIDTH` documents', () => {
    // Plan §3.3. The comment on that table feared 0.17 spaces of slack from measuring the layout box
    // instead of the ink; the font says it is really 0.01–0.07, and always in the safe direction.
    // ⏭️ HIS EYE (§3.6 #1): tightening them lets dense bars get narrower, which is visible.
    for (const duration of DURATIONS) {
      const ours = restExtent(duration)
      const font = glyphBox(restGlyph(duration)).right
      expect(ours, `${duration} is not TIGHTER than the ink`).toBeGreaterThanOrEqual(font - EXACT)
      expect(ours - font, `${duration}'s slack is small`).toBeLessThan(0.1)
    }
  })

  it('⭐⭐ a rest\'s BAND is the font\'s ink at the line the rule puts it on', () => {
    // The row that was never there (§3.4). Two facts, and only one of them is the font's: the
    // EXTENT is Bravura's, the LINE is `layout/restPlacement`'s — and both the model and the
    // DRAWING read that one module, which is the whole point of it existing.
    for (const duration of DURATIONS) {
      const band = restBand(duration)
      const box = glyphBox(restGlyph(duration))
      const line = restStaffLine(duration)
      expect(band.top, `${duration} top`).toBeCloseTo(line - box.up, 2)
      expect(band.bottom, `${duration} bottom`).toBeCloseTo(line + box.down, 2)
    }
  })

  it('⭐⭐ a WHOLE rest and a HALF rest are MIRROR IMAGES meeting in one space', () => {
    // ⭐⭐ The check that says the placement is right, and the one that was failing before the
    //    drawing was fixed. The two glyphs are the same shape and the same width; a whole rest hangs
    //    from the fourth line and a half rest sits on the middle one, so together they fill the
    //    single space between those lines — whole on top, half beneath, meeting at 1.5.
    const whole = restBand('w')
    const half = restBand('h')

    // ⚠️ They MEET, they do not abut exactly: each glyph is a shade over half a space tall (0.540
    //    and 0.568 against a half-space's 0.500), so the two overlap by about a tenth in the middle
    //    of the space. That is the font's design — a rest reads as solid — and the two are never
    //    drawn at once. ⛔ Hence a bound, not a `toBeCloseTo` that would be pinning that surplus.
    expect(Math.abs(whole.bottom - half.top), 'they meet in the middle of the space').toBeLessThan(0.15)
    expect(whole.top, 'the whole rest is the upper half of the space').toBeGreaterThan(1 - 0.1)
    expect(half.bottom, 'the half rest is the lower half').toBeLessThan(2 + 0.1)

    // …and each hangs off its own line from the correct SIDE.
    expect(whole.bottom - 1, 'a whole rest hangs below its line').toBeGreaterThan(1 - whole.top)
    expect(2 - half.top, 'a half rest sits above its line').toBeGreaterThan(half.bottom - 2)
    // ⭐ Neither fills the staff, which is what the old `top: 0, bottom: 4` claimed.
    expect(whole.top).toBeGreaterThan(0)
    expect(half.bottom).toBeLessThan(4)
  })

  it('a rest\'s band never leaves the staff', () => {
    // A sanity floor on the placement table: every rest is drawn INSIDE the five lines.
    for (const duration of DURATIONS) {
      const band = restBand(duration)
      expect(band.top, `${duration} top`).toBeGreaterThanOrEqual(0)
      expect(band.bottom, `${duration} bottom`).toBeLessThanOrEqual(4)
    }
  })
})

describe('⛔ the overrides — every place we knowingly differ, and nowhere else', () => {
  for (const [row, override] of Object.entries(OVERRIDES)) {
    it(`${row} really does differ from the font — else the override is dead`, () => {
      // ⭐ The direction that matters: an override that has stopped differing is a lie left in the
      //   source, and the next reader takes its sentence for a live reason. Deleting it is the fix.
      const font = override.font()
      expect(Math.abs(override.ours - font), `${row}: ${override.why}`).toBeGreaterThan(EXACT)
    })
  }

  it('⭐⭐ and NOTHING ELSE differs — a new divergence has to be declared here', () => {
    // The totality check, and the point of the whole file. Any row of INK or INK_HEIGHT that drifts
    // from the font without an entry above fails right here, with its name.
    const undeclared: string[] = []
    const check = (row: string, ours: number, font: number) => {
      if (row in OVERRIDES) return
      if (Math.abs(ours - font) > EXACT) undeclared.push(`${row}: ours ${ours}, font ${font.toFixed(3)}`)
    }

    check('INK.notehead', INK.notehead, noteheadInk('q'))
    check('INK.secondDisplacement', INK.secondDisplacement, secondDisplacement('q'))
    check('INK.dotWidth', INK.dotWidth, glyphBox('augmentationDot').right)
    check('INK.ledgerLeft', INK.ledgerLeft, ledgerExtension())
    check('INK.ledgerRight', INK.ledgerRight, noteheadInk('q') + ledgerExtension())
    check('INK.flagReach', INK.flagReach, glyphBox('flag8thUp').right - engravingDefault('stemThickness'))
    check('INK_HEIGHT.notehead', INK_HEIGHT.notehead, glyphBox('noteheadBlack').up)
    check('INK_HEIGHT.dot', INK_HEIGHT.dot, glyphBox('augmentationDot').up)
    check('INK_HEIGHT.ledger', INK_HEIGHT.ledger, engravingDefault('legerLineThickness') / 2)
    check('INK_HEIGHT.flagFromTip', INK_HEIGHT.flagFromTip, flagDropFromTip('8', true))

    expect(undeclared, 'undeclared divergences from the font').toEqual([])
  })

  it('⚠️ every ROW of INK and INK_HEIGHT is accounted for — adding one without a source fails HERE', () => {
    // ⛔ `a new drawn element adds a ROW here` (spacingPadding.ts's own rule) now means a row AND a
    //   font quantity to hold it against. These are the rows the checks above cover; a new key in
    //   either table lands in this list and this test names it.
    const covered = new Set([
      'notehead', 'secondDisplacement', 'dotWidth', 'ledgerLeft', 'ledgerRight', 'flagReach',
      // ⭐ These three are POSITIONS, not extents: where the first dot lands, how far the next one
      //   steps, and the gap VexFlow leaves before the accidental column. They are placements, so
      //   the font has nothing to say about them — the browser check is their source (plan §3.1).
      'firstDot', 'dotStep', 'accidentalToHead',
    ])
    expect(Object.keys(INK).filter(key => !covered.has(key)), 'unsourced INK rows').toEqual([])

    const coveredHeights = new Set(['notehead', 'dot', 'ledger', 'flagFromTip'])
    expect(
      Object.keys(INK_HEIGHT).filter(key => !coveredHeights.has(key)),
      'unsourced INK_HEIGHT rows',
    ).toEqual([])
  })
})
