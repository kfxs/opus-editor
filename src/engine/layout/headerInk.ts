import type { Clef, KeySignature, Measure, TimeSignature } from '@/types/music'
import { armedClefMeterInk } from './clefMeterGap'
import { armedBarlineMeterInk } from './barlineMeterGap'
import {
  CLEF_TO_KEY_INK, KEY_TO_METER_INK, METER_PART_LEFT_AIR, keySignatureExtent,
} from './keySignatureLayout'
import { armedHeaderGapRule } from './headerAccidentalLadder'

/**
 * ⭐⭐ **THE HEADER, AS INK** — what a clef and a meter actually cost at the front of a bar
 * (`docs/history/vexflow-boundary.md` priority 1). Pure: staff spaces out, no VexFlow, no DOM.
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

/**
 * ⭐⭐ **…AND AFTER A CLEF OR A KEY SIGNATURE IT IS 2½, not 2 — decision D, HIS, 2026-09-01**
 * (`docs/research/header-spacing-research.md` §8 D).
 *
 * **Gould p. 42** keys this gap on **what stands immediately before the note**: 2½ staff spaces after
 * a clef or a key signature, 2 after a time signature. Her own drawn examples measure
 * **2.60 / 2.59 / 2.11**.
 *
 * ⭐⭐ **And it is not her alone — MuseScore has exactly this pair as two named constants**, keyed the
 * same way: `systemHeaderDistance` **2.5** and `systemHeaderTimeSigDistance` **2.0**. LilyPond
 * distinguishes it too, with three separate `space-alist` tags.
 *
 * 🚨 **So the single 2.0 above was LilyPond's TIME-SIGNATURE row promoted to the only row** — the
 * same shape as the fractional-beam defect found the same day, where VexFlow took LilyPond's
 * non-default branch and made it the whole rule. ⭐ It was right for one of the three cases and ~0.5
 * sp tight for the other two.
 *
 * ⚠️ **This is a LAYOUT number, ⛔ not ink**: widening the header takes room from the music, so it can
 * change how many bars fit on a line. ⭐ And per his standing directive it is one HOUSE STYLE's
 * answer — the user will be able to set it (`project_engraving_defaults_are_a_house_style`).
 */
export const HEADER_TO_NOTE_AFTER_SIGN = 2.5

/**
 * ⭐⭐ **…AND IT CLOSES UP WHEN THE FIRST NOTE CARRIES AN ACCIDENTAL — decision E, HIS, 2026-09-02**
 * (*"lets do what gould say"*; `docs/research/header-spacing-research.md` §8 E).
 *
 * > *"A first note or chord with an accidental **may move closer to the preceding symbol(s)**. When
 * > further accidentals are added, these move closer to the clef. However, **an accidental should
 * > never be closer to a preceding symbol than one stave-space**"* — Gould p. 42
 *
 * Her *Recommended distances before first note*, p. 42 — the whole of this table:
 *
 * | | plain | with one accidental | with more |
 * |---|---|---|---|
 * | after a **clef** | 2½ | **1½** | **1** |
 * | after a **key signature** | 2½ | **1½** | **1** |
 * | after a **time signature** | 2 | **1** | **1** |
 *
 * ⭐⭐ **AND SHE DRAWS IT — all nine cells of that figure, measured off the scan** (450 dpi, staff
 * space 20.0 px, ink to ink, `docs/research/header-spacing-research.md` §3.7):
 *
 * | | plain | one accidental | more |
 * |---|---|---|---|
 * | clef only | **2.65** | **1.65** | **1.15** |
 * | key signature | **2.49** | **1.45** | **1.10** |
 * | time signature | **2.15** | **1.15** | **1.10** |
 *
 * — every cell her printed label plus a consistent 0.10–0.15 sp. ⛔ There was no guessing left to do.
 *
 * 🚨🚨 **AND THE MEASUREMENT OVERTURNED THE OBVIOUS READING, which is why it was made.** The
 * plausible model — *"measure the gap to the NOTEHEAD and let the accidental live inside it"*, which
 * is what MuseScore's mechanism does (`horizontalspacing.cpp:1360–1374`: 2.5 to the note's own
 * position, floored at 1.5 of clear white) — predicts the head standing at a CONSTANT distance. Her
 * plate says otherwise: after a clef her noteheads sit at **2.65 · 3.05 · 3.75**. ⇒ ⭐ **the ladder
 * is on the FRONT of the note group, and the head drifts right as accidentals are added.** That is
 * also what the brackets in her figure span — clef to *the sharp*, not clef to the note.
 *
 * ⏳⏳ **AND WHICH ROW IS DRAWN IS OPEN, and it is HIS** — `layout/headerAccidentalLadder` holds four
 * sourced ladders and `__header.rule(…)` arms one, because minutes after her printed table reached
 * the page his eye reported one cell of it: *"i the case of the clef is not problem but when there is
 * a time signature, is a little too close to the time signature"*. ⛔ So this function reads the ARMED
 * row rather than a constant, and nothing below is frozen except decision D's `none` column.
 *
 * ⚠️ **It is keyed on a COUNT, ⛔ not on the ink's width**, because that is what she wrote. Two
 * engines disagree with her outright and are recorded for the day the house style changes: Verovio
 * gives an accidental its own `leftMarginAccid` (0.5 sp, the same margin a note gets) so an opening
 * with an accidental comes out WIDER, and VexFlow — what we drew until today — does the same by
 * adding `Stave.padding` to every note regardless.
 *
 * ⭐ Which of the two ROWS this is comes from the part that ENDS the header. ⚠️ That test is simply
 * *"is a meter drawn?"*, and it is total rather than lazy: a time signature is always the LAST part
 * of the run (`headerExtent` builds the parts in printed order — clef, key, meter), so a header
 * carrying one always ends with it, and a header without one ends with a key signature or a clef.
 * ⇒ ⛔ there is no fourth case to miss.
 */
/**
 * ⭐ **Gould's floor, and it is why every row of {@link HEADER_TO_NOTE_LADDER} bottoms out at the
 * same number**: *"an accidental should never be closer to a preceding symbol than one
 * stave-space"* (p. 42). She draws 1.10–1.15.
 *
 * ⛔ Not read by the table — the table states her numbers directly. It is here so the 1.0 in two
 * rows is a quoted rule rather than a coincidence, and so a house style that moves the ladder knows
 * what it may not go below.
 */
export const HEADER_ACCIDENTAL_FLOOR = 1.0

/**
 * ⭐ The gap this header earns before the first note — see {@link HEADER_TO_NOTE_LADDER}.
 *
 * @param accidentals how many accidentals stand in front of the bar's FIRST note group
 *   (`measureColumns`' `LeadIn.accidentals`). ⚠️ Clamped to the table's last row, so *"more"* means
 *   two or twelve alike — which is Gould's own wording.
 */
export function headerToNoteGap(header: Header, accidentals = 0): number {
  const rule = armedHeaderGapRule()
  const row = header.meter ? rule.meter : rule.sign
  return row[Math.min(Math.max(accidentals, 0), row.length - 1)]
}

/**
 * ⭐⭐ **THE INDENTATION — how far the clef's ink sits inside the staff's left edge.**
 * Decision **A**, HIS, 2026-09-01 (`docs/research/header-spacing-research.md` §8 A, §3.4).
 *
 * > *"A clef is indented into the stave by one stave-space (⌐) **or a little less**"* — Gould p. 6
 * > *"indented from the open end of the staff (or from the systematic barline) by **½ to 1 space**"* — Ross p. 144
 *
 * ⭐ **Three sources and no dissent.** Gould's four drawn clefs measure **0.67 / 0.74 / 0.67 / 0.70**
 * — she really does draw the *"little less"* she writes. Gerou & Lusk's figures measure **0.62** and
 * **0.70**. LilyPond uses **0.80** and MuseScore **0.75** (`clefLeftMargin`), both just above.
 *
 * 🚨 **This was the ONE gap in the whole run nobody here had ever chosen.** It was **0.50** — not a
 * decision but a side effect: VexFlow's own opening barline is 5 px wide and its first modifier slot
 * carries no padding (`stave.js:393–400`), so the clef landed against it. Verovio happens to use
 * 0.50 too, which is the only reason it looked defensible.
 */
export const CLEF_INDENT = 0.7

/**
 * What VexFlow leaves us at, so {@link CLEF_INDENT_SHIFT} is a DIFFERENCE and not a second copy of
 * the indent. ⛔ Not a choice — see {@link CLEF_INDENT}.
 */
const VEXFLOW_CLEF_INDENT = 0.5

/**
 * ⭐ How far right a line-opening clef must move to reach {@link CLEF_INDENT}, in staff spaces.
 *
 * ⚠️ **A line-opening clef only.** The indent is measured from *"the open end of the staff or the
 * systematic barline"* (Ross p. 144) — a mid-line clef CHANGE follows a barline inside the music and
 * is not indented from anything, which is why `headerExtent` adds this to the full clef and never to
 * the small one.
 */
export const CLEF_INDENT_SHIFT = CLEF_INDENT - VEXFLOW_CLEF_INDENT

/** A full-size clef, at a line start. Measured from the stave's x to the first notehead, less the lead-in.
 *  ⚠️ **The indent is INSIDE these numbers** — they were measured from the stave's own x — so moving it
 *  widens the part by exactly {@link CLEF_INDENT_SHIFT}, which {@link headerExtent} adds. */
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
 * ⭐⭐ **The room a key signature takes at the head of a bar, INCLUDING the padding that separates it
 * from whatever is drawn next** — and **0** when it draws nothing.
 *
 * Exported because the DRAWING needs the same number the width reserved: `ScoreRenderer` pushes
 * VexFlow's own time-signature modifier right by exactly this, so the meter lands one
 * {@link keyToMeterGap} past the signature's last sign — which is where {@link headerExtent} has already
 * charged for it. ⛔ Two numbers here would be the two-sets-of-numbers problem this file exists to
 * end, one layer down.
 */
export function headerKeyRoom(key: KeySignature | undefined): number {
  const ink = key ? keySignatureExtent(key) : 0
  if (ink <= 0) return 0
  // What inserting the signature ADDS to a header that already ran clef → meter: its two own gaps
  // and its ink, less the one gap it DISPLACED.
  // 🚨 That last term is `clefToMeterGap()` and ⛔ no longer a flat `BETWEEN_PARTS` — caught by
  //    `headerInk.test.ts`'s own pairing of this against `headerExtent`, which is exactly the
  //    two-numbers failure this function's header warns about: a signature's room and the shift the
  //    drawing is given must come from ONE arithmetic, or arming a clef→meter row would move the
  //    meter without moving the width that pays for it.
  return CLEF_TO_KEY_INK + ink + keyToMeterGap() - clefToMeterGap()
}

/**
 * ⭐⭐ **The BOX gap the model charges between a CLEF and the METER, with no key signature between
 * them** — the armed ink gap (`layout/clefMeterGap`) less the meter part's own left air, exactly as
 * {@link keyToMeterGap} does for the pair next door.
 *
 * 🚨 **This subtraction is the whole point, and its absence was a real defect.** Until 2026-09-12
 * this pair was charged a flat `BETWEEN_PARTS` (1.0) with the air left IN, so the model reserved
 * ≈**1.6 sp** of ink gap while the drawing used **1.42** — two numbers for one distance, neither
 * chosen (`docs/research/header-spacing-research.md` §4.4, §4.5). ⭐ Now both sides read
 * {@link armedClefMeterInk}, so they agree by construction.
 *
 * ⚠️ ⛔ Never quote this number; quote the ink one.
 */
export function clefToMeterGap(): number {
  return armedClefMeterInk() - METER_PART_LEFT_AIR
}

/**
 * ⭐ **The BOX gap the model charges between the signature and the meter** — {@link KEY_TO_METER_INK}
 * of visible white, less the air the meter's own extent already carries in front of its digits
 * ({@link METER_PART_LEFT_AIR}). ⛔ Never quote this number; quote the ink one.
 */
function keyToMeterGap(): number {
  return KEY_TO_METER_INK - METER_PART_LEFT_AIR
}

/**
 * ⭐ **The BOX gap the model charges between the BARLINE and a meter that follows it with nothing in
 * between** — a mid-line time-signature change. {@link armedBarlineMeterInk} of visible white, less
 * the air the meter's own extent already carries in front of its digits. ⛔ Never quote this number;
 * quote the ink one.
 *
 * 🚨 **This is the one part that pays a gap while being FIRST**, and the exception is real rather
 * than tidy: every other opening part is either a clef (whose distance from the edge is its own
 * INDENT, decision A) or stands after a part that already paid. A lone meter follows a drawn
 * BARLINE, and the books give that pair its own number — Stone p. 46 states it outright.
 */
export function barlineToMeterGap(): number {
  return armedBarlineMeterInk() - METER_PART_LEFT_AIR
}

/**
 * ⭐ A CAUTIONARY clef, key or meter, drawn at the END of a line to warn of the next one's — same
 * glyphs, same measurements, and no reason for a second set of numbers.
 *
 * ⭐⭐ **A courtesy KEY SIGNATURE takes the METER's branch, not the clef's, and that is sourced**:
 * Gerou & Lusk p. 52 — a courtesy clef is CUE size, while the key signature and time signature are
 * NORMAL size. So the clef is the odd one here, and a signature simply costs what it costs.
 */
export function cautionaryExtent(
  part: { clef: Clef } | { meter: TimeSignature } | { key: KeySignature },
): number {
  if ('clef' in part) return CLEF_SMALL[part.clef] + BETWEEN_PARTS
  if ('key' in part) return keySignatureExtent(part.key) + BETWEEN_PARTS
  return meterExtent(part.meter) + BETWEEN_PARTS
}

/**
 * ⭐ What a bar pays EXTRA the moment it becomes line-opening: a full clef where it drew a small one
 * (or none). The bar-width gesture has to know it, because a bar aiming to grow onto its own system
 * stops paying that premium the moment it gets there.
 */
export function lineOpeningClefPremium(clef: Clef): number {
  return CLEF_FULL[clef] - CLEF_SMALL[clef]
}

/** What a bar draws before its first note. Each part absent = that part is not drawn. */
export interface Header {
  clef?: { clef: Clef; small: boolean }
  /**
   * ⭐ The signature drawn at this bar's head — **between the clef and the meter**, which is the
   * order every source prints and the order this file's `parts` array must therefore keep.
   *
   * 🚨 **Absent, never empty.** A C-major or open signature draws no glyphs, so it is not a PART: a
   * part that priced itself at 0 would still be charged a `BETWEEN_PARTS` below, widening the header
   * of every bar of every C-major score — which is every score today. `keySignatureExtent` returning
   * 0 is the caller's cue to omit it, not this file's cue to add a zero.
   */
  key?: KeySignature
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
  /**
   * ⭐⭐ **Each part, with the gap that goes BEFORE it — because the gaps are not all the same, and
   * pretending they were is what put half a space too much on each side of a key signature.**
   *
   * `BETWEEN_PARTS` remains the answer for the pair it was measured on (clef → meter, where it
   * reproduces LilyPond's own `Clef.space-alist (time-signature . 1.52)` once the meter's left air
   * is counted). The key signature's two neighbours have their own numbers, each quoted at its
   * definition in `keySignatureLayout.ts`. ⛔ A new header part adds a ROW here, never a constant
   * somewhere else — the same rule `spacingPadding` follows for note columns.
   */
  const parts: Array<{ gap: number; extent: number; paysWhenFirst?: boolean }> = []
  if (header.clef) {
    // ⭐ The full clef carries the INDENT shift (decision A); the small one does not — a mid-line
    //   clef change is not indented from anything. See {@link CLEF_INDENT_SHIFT}.
    parts.push({
      gap: 0,
      extent: header.clef.small
        ? CLEF_SMALL[header.clef.clef]
        : CLEF_FULL[header.clef.clef] + CLEF_INDENT_SHIFT,
    })
  }
  // ⚠️ Between the clef and the meter — the printed order, three-way agreement (research §9's table),
  // and the order the drawing must match.
  // 🚨 An empty signature is NOT a part: see {@link Header.key}. `keySignatureExtent` is 0 exactly
  // when there is no ink, so the guard is the extent itself and there is no second rule to keep.
  const keyInk = header.key ? keySignatureExtent(header.key) : 0
  if (keyInk > 0) parts.push({ gap: CLEF_TO_KEY_INK, extent: keyInk })
  if (header.meter) {
    // ⭐ Keyed on WHAT PRECEDES IT — a key signature, a clef, or (below) the barline itself.
    parts.push({
      gap: keyInk > 0 ? keyToMeterGap() : header.clef ? clefToMeterGap() : barlineToMeterGap(),
      extent: meterExtent(header.meter),
      paysWhenFirst: true,
    })
  }
  if (parts.length === 0) return 0
  // ⭐ The FIRST part pays no gap — the bar's lead-in is what stands in front of it — ⚠️ **except a
  // lone METER, which follows a drawn BARLINE and whose distance from it the books do state**
  // ({@link barlineToMeterGap}). A clef never pays here: its distance from the edge is its INDENT.
  return parts.reduce(
    (sum, part, i) => sum + part.extent + (i > 0 || part.paysWhenFirst ? part.gap : 0), 0)
}

/**
 * Whether a time-signature glyph is drawn at the start of this measure:
 * measure 1 always, plus any measure that begins an explicit TS change
 * (engraving standard) — UNLESS the glyph has been explicitly hidden
 * (`timeSignatureHidden`, e.g. the deleted default on measure 1; the meter
 * still applies, only the glyph is suppressed). Drives the drawing, its width
 * reservation, AND the clickable registry element.
 */
export function drawsTimeSignature(measure: Measure): boolean {
  if (measure.timeSignatureHidden === true) return false
  return measure.number === 1 || measure.timeSignatureChange === true
}
