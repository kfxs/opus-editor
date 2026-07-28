/**
 * ⭐⭐ **AN ACCIDENTAL MUST CLEAR THE LEDGER LINE IT SITS BESIDE.**
 *
 * His report, off the page: *"the accidental for notes with ledger lines down are too close… it is
 * clear that there is a collision with the ledger line"*. He is right, and it is not a near miss —
 * it is arithmetic, and it happens to EVERY accidental on a ledger-line note:
 *
 *  - VexFlow stands an accidental **3px** off the notehead — 1px of
 *    `Accidental.noteheadAccidentalPadding` plus the flat 2px `getModifierStartXY` gives every LEFT
 *    modifier ({@link MODIFIER_LEFT_OFFSET}),
 *  - and overhangs a ledger line **3px** past it (`StaveNote.LEDGER_LINE_OFFSET`).
 *
 * The two numbers are equal, so the line's end lands exactly on the sign's right arm. Measured on
 * the page (C♯4 in treble): notehead at x=114, sharp spanning 101→**111**, ledger starting at
 * **111**. Touching, every time, with no air at all — which is what he was looking at.
 *
 * ⚠️ The first version of this module read the padding alone, called it a 2px overlap and corrected
 * by 3px. The page said otherwise: a *touch*, needing ~2. **Measure the drawn glyph** — the sign's
 * width is a font metric and its standoff is two constants in two different files.
 *
 * ## Why it is done THIS way — three measurements, in the order they closed the options
 *
 * 1. ⛔ **The room may not be RESERVED**, however natural that is (pad the accidental's width and
 *    let the formatter buy the space). Ledger lines depend on the CLEF, so reserving makes a bar's
 *    width depend on it too — and this editor proved bar width clef-INDEPENDENT and took `clef` out
 *    of the width-cache key (`MeasureLayout.clefWidthIndependence.test.ts`,
 *    docs/render-performance-plan.md §9). That key was worth **47% of layout time** on a score with
 *    one clef change. The spec caught the attempt, which is exactly what it is for.
 * 2. ⛔ **…so the sign moves at DRAW time, and it cannot move far.** Measured in a minimum-width bar
 *    (sixteen 16ths, every one signed): the gap between the previous notehead and the next
 *    accidental is exactly **3px**. Spend it all and dense music trades a collision with a ledger
 *    line for a collision with a notehead.
 * 3. ⭐ **So the ledger line gives up the other half — which is what engravers do anyway.** *"An
 *    expert engraver will shorten a ledger line to allow closer spacing with accidentals"*
 *    (LilyPond's engraving essay), shortening the line nearest the head when a sign is close. Ours
 *    trims to {@link LEDGER_OVERHANG_BESIDE_ACCIDENTAL} and only on notes that have such a sign.
 *
 * The arithmetic that falls out: with the sign standing `standoff` from the head and the line
 * overhanging by `overhang`, opening {@link LEDGER_ACCIDENTAL_GAP} of air needs the sign to move
 * `overhang + gap - standoff`. Trimming 3→2 makes that **1px** for 2px of air — a third of the
 * dense bar's slack, and the sign stays within half a staff space of its notehead.
 *
 * ⚠️ VexFlow's `strokePx` is ONE symmetric number per note, so the trim shortens that note's ledger
 * lines at both ends. The asymmetric version — trim the left, keep the right — is what LilyPond
 * does, and it needs the lines to be ours to draw. If they ever are, this module changes its mind.
 */
import { Metrics, StaveNote, Accidental } from 'vexflow'

/**
 * The clear air left between the end of the ledger line and the accidental — 0.2 of a staff space,
 * which is the air VexFlow itself leaves between a sign and its notehead less a whisker. Ink that
 * merely stops touching still reads as touching.
 */
export const LEDGER_ACCIDENTAL_GAP = 2

/**
 * How far an accidental glyph reaches above and below its own staff line, in LINES (1 line = 1
 * staff space). A sharp and a natural are ~2.7 spaces tall, so ~1.35 either side; 1.4 rounds it up
 * so a sign that only just crosses a ledger still gets its room. A flat is shorter and asks for
 * less, but a per-glyph height would buy a pixel and cost a table — the widest one decides.
 */
export const ACCIDENTAL_REACH_LINES = 1.4

/** VexFlow's own ledger overhang, when nothing is beside the line (`StaveNote.drawLedgerLines`). */
export const VEXFLOW_LEDGER_OVERHANG = StaveNote.LEDGER_LINE_OFFSET

/**
 * …and what it is trimmed to on a note whose accidental stands beside the line. Two thirds of the
 * default: still a visible overhang on both sides, and it halves what the sign has to give up.
 */
export const LEDGER_OVERHANG_BESIDE_ACCIDENTAL = 2

/**
 * VexFlow's notehead-to-accidental padding, read from the same metric `Accidental.format` reads, so
 * the two can never drift: what we spend is the difference between these numbers, and a VexFlow
 * release that changed either one would otherwise leave us over- or under-shifting in silence.
 */
export const VEXFLOW_ACCIDENTAL_PADDING = (Metrics.get('Accidental.noteheadAccidentalPadding') as number) ?? 1

/**
 * ⚠️ …and the OTHER half of the standoff, which is not a metric at all: `StaveNote.getModifierStartXY`
 * begins every LEFT modifier at `-1 * 2`, a literal in VexFlow's source. It is two thirds of the
 * distance, so reading the metric alone (as this module first did) mis-states where the sign is.
 */
export const MODIFIER_LEFT_OFFSET = 2

/** Where a real note's accidental actually stands, measured from the notehead's left edge. */
export const VEXFLOW_ACCIDENTAL_STANDOFF = VEXFLOW_ACCIDENTAL_PADDING + MODIFIER_LEFT_OFFSET

/**
 * The ledger LEVELS a set of heads forces: whole lines from 6 upward, and from 0 downward — the
 * bounds `StaveNote.drawLedgerLines` uses, and the ones `drawFanLedgerLines` copies.
 */
export function ledgerLevels(headLines: number[]): number[] {
  if (!headLines.length) return []
  const levels: number[] = []
  for (let l = 6; l <= Math.max(...headLines); l++) levels.push(l)
  for (let l = 0; l >= Math.min(...headLines); l--) levels.push(l)
  return levels
}

/**
 * How far left an accidental must move for the ledger lines of its own note to stop short of it.
 *
 * `overhang` is how far those lines reach past the notehead, `standoff` how far the sign already
 * stands off it — both are the CALLER's, because a fan member's hand-drawn sign and ledger have
 * their own two numbers. 0 when the sign is nowhere near a ledger line, which is the ordinary case
 * and costs that note nothing.
 */
export function ledgerAccidentalClearance(
  accidentalLine: number,
  headLines: number[],
  overhang: number,
  standoff: number,
): number {
  if (!accidentalMeetsLedger(accidentalLine, headLines)) return 0
  return Math.max(0, overhang + LEDGER_ACCIDENTAL_GAP - standoff)
}

/**
 * Does a sign on this line stand beside any of the note's ledger lines? The question both halves of
 * the answer are asked from — how far the sign moves, and whether the LINE gives anything up.
 */
export function accidentalMeetsLedger(accidentalLine: number, headLines: number[]): boolean {
  return ledgerLevels(headLines).some(level => Math.abs(level - accidentalLine) <= ACCIDENTAL_REACH_LINES)
}

/**
 * ⭐ Spend it on real notes — **after `formatter.format`, before the draw**.
 *
 * After, because `Accidental.format` writes each sign's `xShift` from scratch (its column position)
 * and would overwrite anything set earlier; before the draw, because both numbers this touches are
 * read while drawing and nothing measured has happened yet. It is the same window the multi-voice
 * re-assert and the note offsets use.
 *
 * ⚠️ It must stay OUT of `NoteBuilder`: that builder is the width path too (see the header).
 *
 * Every sign of an affected note moves by the SAME amount — they are a column, and a per-sign shift
 * would rake it.
 */
export function clearLedgersForAccidentals(notes: StaveNote[]): void {
  for (const note of notes) {
    if (note.isRest()) continue
    const accidentals = note.getModifiers().filter((m): m is Accidental => m instanceof Accidental)
    if (!accidentals.length) continue
    const props = note.getKeyProps()
    const headLines = props.map(p => p.line)
    const shift = Math.max(...accidentals.map(acc => ledgerAccidentalClearance(
      props[acc.checkIndex()]?.line ?? 0,
      headLines,
      LEDGER_OVERHANG_BESIDE_ACCIDENTAL,
      VEXFLOW_ACCIDENTAL_STANDOFF,
    )))
    if (shift <= 0) continue
    // The line gives up a third of its overhang…
    ;(note.renderOptions as { strokePx?: number }).strokePx = LEDGER_OVERHANG_BESIDE_ACCIDENTAL
    // …and the signs move the rest of the way out. ⚠️ `Modifier.setXShift` NEGATES for a LEFT
    // modifier, so the stored value is negative and the amount to add back is its magnitude.
    for (const acc of accidentals) acc.setXShift(-acc.getXShift() + shift)
  }
}
