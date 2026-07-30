import type { Clef, TimeSignature } from '@/types/music'

/**
 * ⭐⭐ **THE HEADER, AS INK** — what a clef and a meter actually cost at the front of a bar
 * (`docs/vexflow-boundary.md` priority 1). Pure: staff spaces out, no VexFlow, no DOM.
 *
 * The bar's own music has been the spacing model's since P2; its HEADER was still two numbers on
 * each side of a fence. We reserved `CLEF_WIDTH` (4.5 spaces), `CLEF_CHANGE_WIDTH` (3) and
 * `TIME_SIG_WIDTH` (3) for the casting-off while VexFlow laid the glyphs out and derived its own
 * `getNoteStartX` — two sets of numbers with nothing connecting them, which is the last of the
 * boundary's "costs us something" list.
 *
 * ## What the disagreement actually was — measured, in Chrome
 *
 * | bar draws | we reserved | VexFlow drew |
 * |---|---|---|
 * | treble + 4/4 at a line start | 8.7 | **7.8** |
 * | a mid-line clef change | 4.2 | **3.8** |
 * | a mid-line meter change, `3/4` | 4.2 | **3.6** |
 * | a mid-line meter change, **`12/8`** | 4.2 | **4.8** |
 *
 * ⭐ **It went BOTH ways, and the second direction is the one that mattered.** Over-reserving 0.9
 * spaces for a line-opening bar made its music 5% wider than the same music two bars later (see
 * `distributeLineWidths`). But a **two-digit meter is wider than the constant**, so that bar was
 * reserved less room than its own header takes and the music paid for the difference. One number
 * cannot describe a glyph whose width depends on how many digits are in it.
 *
 * ## ⭐ The header is a row of ink with a padding between the parts — like everything else
 *
 * Measured part by part and then *predicted* before being believed: a small bass clef followed by a
 * `3/4` was predicted at 7.2 spaces and drew 7.2; a line-opening alto with `12/8` was predicted at
 * 9.4 and drew 9.4. That is the same shape as the note columns — extents, plus a pair padding — so
 * the header needed no new idea, only its own numbers.
 *
 * ⚠️ **Every number here is a MEASUREMENT written down, and therefore a prediction from that moment
 * on.** `e2e/spacing.e2e.ts` re-measures them in a browser and fails if the drawing moves — the same
 * pairing `spacingPadding.ts` has, and the reason it is safe to predict at all.
 */

/**
 * ⭐⭐ **The gap between the header's last glyph and the first note — LilyPond's, 2.0 staff spaces.**
 *
 * Two rows of LilyPond's `space-alist` decide the front of a bar, and they turn out to be the same
 * number for us:
 *
 * | LilyPond | what it says | ours, measured |
 * |---|---|---|
 * | `TimeSignature.space-alist (first-note fixed-space . 2.0)` | 2.0 after the meter | **1.1** |
 * | `Clef.space-alist (first-note minimum-fixed-space . 5.0)` | ≥ 5.0 from the clef's LEFT edge | **4.0** |
 *
 * ⭐ The second row lands on the same answer: our clef's ink runs 0.4 → 3.3 spaces past the stave, so
 * LilyPond's 5.0-from-the-left puts the note at 5.4, which is **2.1 past the clef's ink** — the meter
 * row's 2.0 to within a rounding. So one constant reproduces both, which is why it is one constant.
 *
 * ⚠️ **It replaces the bar's own lead-in only where a header is DRAWN.** A bar with no clef and no meter
 * keeps `pairPadding('barline', …)` — and there LilyPond would go TIGHTER than we can draw:
 * `BarLine.space-alist` asks `next-note` **0.9** mid-line (and `first-note` 1.3 at a system start)
 * against our floor of 1.2, which is VexFlow's `Stave.padding` and not a choice (see `pairPadding`).
 *
 * ⚠️ And it is the same for a NOTE and a REST, in every engine checked — MuseScore assigns the note's
 * own value to the rest row (`table[BAR_LINE][REST] = barNoteDistance`), LilyPond keys on "the next
 * musical column", Sibelius has one control for "the first note/rest in a bar", Dorico calls the whole
 * thing note spacing for notes *and* rests, and Verovio gives a rest a note's alignment type.
 */
export const HEADER_TO_NOTE = 2.0

/** A full-size clef, at a line start. Measured from the stave's x to the first notehead, less the lead-in. */
const CLEF_FULL: Record<Clef, number> = {
  treble: 3.2,
  bass: 3.5,
  alto: 3.6,
  tenor: 3.6,
}

/** The smaller clef VexFlow draws for a mid-line change. */
const CLEF_SMALL: Record<Clef, number> = {
  treble: 2.6,
  bass: 2.6,
  alto: 2.7,
  tenor: 2.7,
}

/**
 * A time signature is **1.2 staff spaces per digit, plus 1.2**.
 *
 * ⭐ Which is the whole point of measuring rather than assuming: `3/4` is 2.4 spaces and `12/8` is
 * 3.6, so the flat `TIME_SIG_WIDTH` of 3 was over by a fifth on one and under by a fifth on the
 * other. The digits are the widest row — a `12` over an `8` is as wide as the `12`.
 */
function meterExtent(meter: TimeSignature): number {
  const digits = Math.max(String(meter.numerator).length, String(meter.denominator).length)
  return 1.2 * digits + 1.2
}

/**
 * The space between two adjacent header parts — a clef and the meter after it.
 *
 * ⚠️ It is why the parts are not simply summed, and it is why the first attempt at this table came
 * out wrong: a meter costs 2.4 spaces alone and 3.4 after a clef. That extra is this.
 */
const BETWEEN_PARTS = 1.0

/**
 * ⭐ An INLINE clef change — one drawn mid-bar, at a beat other than 0. Not part of the header: it
 * sits inside the music, so it buys its room the same way but adds nothing to the bar's lead-in.
 */
export function inlineClefExtent(clef: Clef): number {
  return CLEF_SMALL[clef] + BETWEEN_PARTS
}

/**
 * ⭐ A CAUTIONARY clef or meter, drawn at the END of a line to warn of the next one's — same glyphs,
 * same measurements, and no reason for a second set of numbers.
 */
export function cautionaryExtent(part: { clef: Clef } | { meter: TimeSignature }): number {
  return 'clef' in part
    ? CLEF_SMALL[part.clef] + BETWEEN_PARTS
    : meterExtent(part.meter) + BETWEEN_PARTS
}

/**
 * ⭐ What a bar pays EXTRA the moment it becomes line-opening: a full clef where it drew a small one
 * (or none). The bar-width gesture has to know it, because a bar aiming to grow onto its own system
 * stops paying that premium the moment it gets there.
 */
export function lineOpeningClefPremium(clef: Clef): number {
  return CLEF_FULL[clef] - CLEF_SMALL[clef]
}

/** What a bar draws before its first note. `clef` absent = no clef drawn; `meter` absent = none. */
export interface Header {
  clef?: { clef: Clef; small: boolean }
  meter?: TimeSignature
}

/**
 * How far past the stave's own x a bar's first note starts, in staff spaces — the header's ink plus
 * the lead-in the caller adds.
 *
 * ⭐ Returns 0 for a bar that draws no header at all, so the caller's lead-in is the whole answer
 * and there is no special case anywhere.
 */
export function headerExtent(header: Header): number {
  const parts: number[] = []
  if (header.clef) {
    parts.push((header.clef.small ? CLEF_SMALL : CLEF_FULL)[header.clef.clef])
  }
  if (header.meter) parts.push(meterExtent(header.meter))
  if (parts.length === 0) return 0
  return parts.reduce((sum, part) => sum + part, 0) + BETWEEN_PARTS * (parts.length - 1)
}
