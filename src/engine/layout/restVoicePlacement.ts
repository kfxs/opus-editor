/**
 * ⭐⭐ **WHICH LINE A REST SITS ON WHEN ITS STAFF CARRIES MORE THAN ONE VOICE.**
 *
 * `restPlacement.ts` answers the single-voice question — the *neutral* line, from Gould p. 34, one
 * table keyed on duration alone. It stays exactly that. This module answers the other question, the
 * one the books spend three pages on and we had never asked:
 *
 * > ⭐⭐ **The SIGN is positional** (upper voice up, lower voice down), **the MAGNITUDE is DERIVED
 * > from surrounding content**, and **the RESULT is QUANTISED to whole staff spaces.**
 * > — docs/multi-voice-rest-position.md §3.3, the unanimous finding of Gould, Ross, Gerou & Lusk
 * > and Stone, and of LilyPond, Verovio and MuseScore.
 *
 * ⛔ **A fixed per-voice table can express the sign and NOTHING ELSE**, which is what we shipped
 * (`REST_LANE = [0, -1, 1, -2] × 3` in the renderer) and what cost 67 hand-placed `restShift`
 * overrides in `public/examples/prelude-bwv846.json` — one per rest, in a piece with one repeating
 * texture. The overrides were the user paying, by hand, for a rule the engine did not have.
 *
 * ## The shape of the rule
 *
 * **Verovio's shape** — take the OUTERMOST of a set of candidate lines (`rest.cpp:387-422`) — with
 * **LilyPond's ink clearance** (`rest-collision.cc:270`), which we can afford where Verovio could
 * not because our ink is a *measured data table* (`layout/spacingPadding.ts`) and not a runtime
 * measurement. ⭐⭐ That is what makes this both ink-aware and **jsdom-testable**: every number below
 * is a line number, so the whole module is a pure function of the model and none of it needs a
 * browser (`reference_jsdom_cannot_measure_glyphs`).
 *
 * ## ⚠️ The axis, settled once
 *
 * > **VexFlow's LINE: `3` = the middle line, `+1` = one staff space UP, `1`/`5` = bottom/top.**
 * > A diatonic step is `0.5`.
 *
 * Chosen because both neighbours already speak it: `clefUtils.staffLineForSpelling()` **returns** it
 * and `NoteBuilder`/`setKeyLine` **consume** it. ⚠️ `restPlacement`/`spacingPadding` speak the OTHER
 * one (spaces BELOW the top line, + down), so there are exactly **two** conversions in this file,
 * each named and commented at its site — {@link restNeutralLine} and {@link restInk}. ⛔ Nothing
 * else converts, and ⛔ no third axis is introduced. That two axes exist at all is a wart; it is not
 * this module's job to fix.
 *
 * ## ⛔ What this is not
 *
 * - ⛔ **Not a rendering change.** VexFlow keeps drawing the glyph; we keep deciding the line.
 * - ⛔ **Not a new field.** Nothing here is written back into the score or its JSON: it is a derived
 *   view, and a derived view that is stored stops being derived (DESIGN-PRINCIPLES §3). The manual
 *   `restShift` override survives as a *deviation from* this position — LilyPond has the identical
 *   seam, skipping collision entirely for a rest with an explicit `staff-position`
 *   (`rest-collision.cc:230-231`).
 * - ⛔ **Not the single-voice case.** Gould p. 34 owns that, `restPlacement.ts` implements it, and it
 *   is already right.
 *
 * See `docs/multi-voice-rest-position.md` (the evidence) and
 * `docs/multi-voice-rest-position-plan.md` (the decisions).
 */

import type { ChordRest, Clef, Fraction, NoteDuration, Rest } from '@/types/music'
import { restStaffLine } from './restPlacement'
import { INK_HEIGHT, restBand } from './spacingPadding'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { slotLength } from '@/utils/durations'
import { voiceOf } from '@/utils/lanes'
import { fracAdd, fracLt } from '@/utils/fraction'

/** The top and bottom staff lines — where a displaced whole or half rest attaches (§3.1). */
const TOP_LINE = 5
const BOTTOM_LINE = 1

/**
 * ⭐ **The one tunable, and it is sourced**: LilyPond's `minimum-distance`
 * (`scm/define-grobs.scm:2987`), in staff spaces, between the rest's near ink edge and the other
 * part's notehead.
 *
 * ⚠️ MuseScore uses 0.35 (0.55 for whole/half) but measures a `Chord::shape()` that *includes the
 * stem*, so its smaller number is not comparable to ours. ⛔ **No book states a clearance number at
 * all** (research §8) — so this is an engine constant, honestly labelled as one, and it is the
 * single knob to turn if the eye disagrees. ⛔ It is not to be joined by a second knob.
 */
const GAP = 0.75

/** Half a notehead, from `INK_HEIGHT` — measured data, like every other ink number here. */
const NOTEHEAD_HALF = INK_HEIGHT.notehead

/**
 * ⚠️ Float dust guard for the outward quantisation. The candidates are sums of measured decimals
 * (`0.716`, `1.492`, …), so a displacement that IS a whole number can arrive as `2.0000000000000004`
 * and `ceil` would answer 3. ⛔ Not a rounding policy — the policy is `ceil` (outward), stated at
 * {@link quantiseOutward}; this only stops the policy misreading its own input.
 */
const EPS = 1e-9

/** ⚠️ The two durations that attach to a fixed outer staff line instead of tracking content (§3.1). */
function attachesToOuterLine(duration: NoteDuration): boolean {
  return duration === 'w' || duration === 'h'
}

/** The least a rest has to say about itself to be placed. Satisfied by a `Rest` slot AND a flat `Note`. */
export interface RestPlacement {
  beat: Fraction
  duration: NoteDuration
  dots?: number
  actualDuration?: Fraction
  voice?: 0 | 1 | 2 | 3
  isMeasureRest?: boolean
}

/**
 * The duration a rest is DRAWN as. ⚠️ A measure rest is drawn from the whole rest's glyph and line
 * whatever it stores (`NoteBuilder`'s `restKey('w')`), so it must be *placed* as one too — and both
 * the derived line and the neutral it is measured against have to agree about which it is.
 */
export function restDrawnDuration(rest: RestPlacement): NoteDuration {
  return rest.isMeasureRest ? 'w' : rest.duration
}

/**
 * Does this slot SOUND at any point inside `[beat, end)`? Half-open on purpose: a slot that ends
 * exactly where the rest begins is not under it, and one that begins exactly where the rest ends is
 * not either.
 *
 * ⚠️ The span is `slotLength`, ⛔ never `writtenLength` — a held tuplet member or a whole-bar rest
 * otherwise reports a span it does not have, which is the exact failure *"what SOUNDS, not what
 * STARTS"* exists to prevent.
 */
function soundsDuring(slot: ChordRest, beat: Fraction, end: Fraction): boolean {
  return fracLt(slot.beat, end) && fracLt(beat, fracAdd(slot.beat, slotLength(slot)))
}

/**
 * The line a rest of this duration takes when nothing displaces it — {@link restStaffLine} on this
 * module's axis. **Conversion 1 of 2.**
 *
 * ⚠️ `restPlacement` counts staff spaces BELOW the top line (top 0, middle 2, bottom 4); we count
 * VexFlow lines UP from the bottom (bottom 1, middle 3, top 5). `5 − n` is the whole conversion.
 *
 * ⭐ The renderer needs this as well as {@link restLineForVoice}: what it hands VexFlow is a
 * *shift*, so it subtracts one from the other.
 */
export function restNeutralLine(duration: NoteDuration): number {
  return TOP_LINE - restStaffLine(duration)
}

/**
 * How far a rest's ink reaches above and below its own anchor, in staff spaces. **Conversion 2 of
 * 2.**
 *
 * ⚠️ It comes from `restBand`, ⛔ never from `getBBox()` — which is both what keeps this module pure
 * and what keeps the numbers held against Bravura by `spacingPadding.font.test.ts`. `restBand`
 * returns a band on the downward axis around `restStaffLine`, so the two reaches are the two
 * differences, and both come out positive.
 */
function restInk(duration: NoteDuration): { above: number; below: number } {
  const band = restBand(duration)
  const anchor = restStaffLine(duration)
  return { above: anchor - band.top, below: band.bottom - anchor }
}

/**
 * ⭐ Where a rest's INK CENTRE sits relative to its own anchor, on this module's axis
 * (positive = the centre is BELOW the anchor, so the anchor must rise to put the centre somewhere).
 *
 * ⚠️ **`restPlacement.ts` forbids deriving a rest's NEUTRAL position from a bounding box**, and is
 * emphatic about it: the table gives each rest *"an ANCHOR, not a bounding box"*, and *"an engine
 * that centred those glyphs BY BOUNDING BOX would land several of them wrong"*. That prohibition
 * and this function are answering different questions, and the difference is the whole
 * reconciliation:
 *
 * ⭐ The prohibition is on the NEUTRAL line — a crotchet rest is not symmetric about the middle line
 * and never was, so centring its box there would move it off the line Gould names. **Displacing an
 * already-anchored rest to sit level with surrounding pitches is a different question**, and it is
 * the one Gould p. 37 asks: *"The space in which a rest centres, or its distance from the stave,
 * should be on the same level as surrounding pitches."* So the asymmetry is subtracted out of the
 * measured band rather than assumed away.
 */
function restInkCentre(duration: NoteDuration): number {
  const ink = restInk(duration)
  return (ink.below - ink.above) / 2
}

/** ⭐ Gould p. 35: *"rests move an exact number of stave-spaces up or down"* — and always OUTWARD. */
function quantiseOutward(line: number, neutral: number, dir: 1 | -1): number {
  return neutral + dir * Math.ceil(dir * (line - neutral) - EPS)
}

/** What {@link restLineForVoice} needs to know. All of it comes from the model; none of it is ink. */
export interface RestVoicePlacement {
  duration: NoteDuration
  /** `+1` this voice is the upper one on its staff, `-1` the lower. Voice PARITY — see {@link restVoiceContext}. */
  dir: 1 | -1
  /** Lines of THIS voice's notes in the bar — Gould's *"surrounding pitches"*. May be empty. */
  own: number[]
  /** Lines of the OTHER voices' notes SOUNDING during the rest's span. May be empty. */
  others: number[]
  /**
   * ⭐⭐ **HIS LANE ORDER.** The already-placed rests of the same-parity INNER voice sounding during
   * this one's span — V1's for V3, V2's for V4. Absent/empty for V1 and V2, which are the inner
   * pair and have nothing to stand outside of. See {@link laneOrder} for why this exists.
   */
  inner?: { line: number; duration: NoteDuration }[]
}

/**
 * ⭐⭐ **The rule.** The outermost of three candidate lines, quantised outward to a whole number of
 * staff spaces from the neutral position.
 *
 * | candidate | what it is | source |
 * |---|---|---|
 * | `base` | one space out for `q`/`8`/`16`/`32`, **the outer staff line** for `w`/`h`. ⭐ Also the FLOOR: nothing may come nearer the middle | Gould p. 36, measured at **±1 stave-space**; MuseScore ±1 space (`restlayout.cpp:757-766`) |
 * | `ownLevel` | the ANCHOR placed so the rest's ink *centre* sits at `mean(own)` — ⛔ not for `w`/`h` | Gould p. 37; Verovio's same-layer mean (`rest.cpp:503-509`) |
 * | `clearance` | the near ink edge clears the other voice's extreme note by {@link GAP} | Gould p. 37 *"the rest moves further away from the stave"*; LilyPond `minimum-distance` |
 * | `laneOrder` | the near ink edge clears the same-parity INNER voice's REST by {@link GAP} — ⭐ V3 outside V1, V4 outside V2 | ⭐ **HIS convention**, `docs/multi-voice-plan.md` §13 — see {@link laneOrder} |
 *
 * ⛔ **The fourth candidate an earlier draft listed was an illusion** — a *"floor — never nearer the
 * middle than `base`"*, which under `max`/`min` **is** `base`, the same number twice. Verovio can
 * have both because its two differ in kind (a duration-keyed default table *and* a separate
 * `GetMarginLayerLocation` floor at `:586-601`); ours collapse, so the floor is a property of `base`
 * and there is no row for it. ⭐ `laneOrder` is the row that *does* earn one: it reads something no
 * other candidate reads (another rest), and it carries its own source. ⚠️ That is the bar a fifth
 * would have to clear too — ⛔ never a re-listing of one already here.
 *
 * ⚠️ **The candidates are NAMED, and that is not decoration.** In a score editor `c3` reads as *the
 * pitch C3* before it reads as *candidate 3*, and the pitch register is precisely what this rule
 * computes in.
 */
export function restLineForVoice(input: RestVoicePlacement): number {
  const { duration, dir, own, others, inner } = input
  const neutral = restNeutralLine(duration)
  const ink = restInk(duration)
  const outer = dir > 0 ? TOP_LINE : BOTTOM_LINE

  const candidates: number[] = []

  // `base` — the floor as well as a candidate: the outermost-wins combination below can only ever
  // push a rest FURTHER from the middle than this, never back toward it.
  candidates.push(attachesToOuterLine(duration) ? outer : neutral + dir)

  // `ownLevel` — ⛔ dropped for `w`/`h`: the fixed outer line is the whole point of that practice
  // (Gould p. 37 reports it as done "to avoid confusion"), so a whole rest does not track its own
  // voice's mean. It still yields to `clearance`, which can only push it further out.
  if (own.length > 0 && !attachesToOuterLine(duration)) {
    const mean = own.reduce((a, b) => a + b, 0) / own.length
    candidates.push(mean + restInkCentre(duration))
  }

  // `clearance` — ⭐ the UPPER voice's rest clears the LOWER voice's HIGHEST note, UPWARD; the lower
  // voice is the mirror in BOTH the extreme it takes and the ink edge it presents. 🚨 This is the
  // one line of this rule that was first written backwards (the lower voice's extreme *and* the
  // lower voice's ink edge, under the label "upper voice") — each half looks right on its own. The
  // check that catches it: on this axis an upper-voice rest's line must come out LARGER than every
  // number in `others`, and only `max` and `+` can make it so.
  if (others.length > 0) {
    candidates.push(dir > 0
      ? Math.max(...others) + NOTEHEAD_HALF + GAP + ink.below
      : Math.min(...others) - NOTEHEAD_HALF - GAP - ink.above)
  }

  // `laneOrder` — ⭐ the SAME clearance shape as above, with the inner voice's REST in place of a
  // notehead: its far ink edge, then the gap, then our own near reach. ⛔ Not a new constant and not
  // a new kind of arithmetic — which is the whole reason his lane order can be honoured without a
  // second knob to retune. See {@link laneOrder}.
  for (const rest of inner ?? []) {
    const innerInk = restInk(rest.duration)
    candidates.push(dir > 0
      ? rest.line + innerInk.above + GAP + ink.below
      : rest.line - innerInk.below - GAP - ink.above)
  }

  // Verovio's combination: the outermost wins (`rest.cpp:387-422`).
  const line = dir > 0 ? Math.max(...candidates) : Math.min(...candidates)
  return quantiseOutward(line, neutral, dir)
}

/**
 * ⭐⭐ **HIS LANE ORDER — V3 / V1 / V2 / V4, top to bottom**, and the one part of this module that is
 * a TASTE CALL rather than a reading of the literature.
 *
 * ⛔ **Three and four voices are UNKNOWN in every source we hold** (`docs/multi-voice-rest-position.md`
 * §8): no rest-height rule in Gould, Ross, Gerou & Lusk or Stone; Gould handles four parts as **2+2
 * on two staves**; Gerou & Lusk say *"avoid combining three instruments on one staff"*; Verovio
 * declines the question in code (`rest.cpp:366-367`); and LilyPond's V3/V4 are **vertically
 * identical** to V1/V2, differing only in horizontal shift.
 *
 * ⭐ So the ordering is not derivable, and it is HIS: stated 2026-07-23 and recorded in
 * `docs/multi-voice-plan.md` §13 as *"the values the user picked"* — **V3 +3 / V1 0 / V2 −3 / V4 −6**
 * under the old fixed ladder. 🚨 The derived rule dropped it on first writing, because `dir` is
 * parity and V1/V3 therefore shared a direction with nothing to tell them apart. That was reported
 * as a regression and **he refused it**: a settled convention of his is not a casualty of a rule
 * that did not think about it.
 *
 * ## ⭐ What survives the change, and what does not
 *
 * ⛔ **The ladder's MAGNITUDES do not.** `REST_LINE_STEP = 3` was unsourced and is exactly what the
 * derived rule replaced; reinstating it as a lane gap would be reinstating the thing measured to be
 * wrong. ⭐ **The ORDER does**, and it is expressible without a constant at all: an outer voice's
 * rest must clear the inner voice's rest the same way any rest clears a notehead — by measured INK
 * plus {@link GAP}. Two 16th rests come out ~4 spaces apart, two whole rests ~2, because that is
 * what their ink actually needs; the old flat 3 was one number for both.
 *
 * ## ⚠️ It only binds where the order is VISIBLE
 *
 * `inner` holds the inner voice's rests **sounding during this one's span**, so the lane order is
 * enforced exactly when two rests could be confused for each other. Where the inner voice has a
 * NOTE instead, `clearance` has already dealt with it, and where it has nothing at all there is
 * nothing to stand outside of. ⛔ That is deliberate: a lane that separated a rest from silence
 * would be the old fixed ladder again, under a new name.
 */
function innerVoiceRests(slots: ChordRest[], voice: number, beat: Fraction, length: Fraction): Rest[] {
  if (voice < 2) return [] // V1 and V2 are the inner pair — nothing to stand outside of.
  const end = fracAdd(beat, length)
  return slots.filter((slot): slot is Rest =>
    slot.type === 'rest' && voiceOf(slot) === voice - 2 && soundsDuring(slot, beat, end))
}

/**
 * ⭐ **The composed answer for ONE rest in one staff's lane** — the entry point both seams call, and
 * the only place the depth-1 recursion lives.
 *
 * An outer voice needs the inner voice's rest to be **already placed** ({@link innerVoiceRests}), so
 * this asks for it by asking itself. The recursion terminates at depth 1 by construction: V3 needs
 * V1, V4 needs V2, and neither V1 nor V2 has an inner voice. ⛔ No cache, and no ordering
 * requirement on the caller — a lane holds a handful of rests, and an answer that does not depend
 * on the order the renderer happens to walk its voices in is worth more than the arithmetic it
 * saves.
 */
export function restLineInStaff(slots: ChordRest[], rest: RestPlacement, clef: Clef): number {
  const voice = voiceOf(rest)
  const length = slotLength(rest)
  const inner = innerVoiceRests(slots, voice, rest.beat, length).map(r => ({
    line: restLineInStaff(slots, r, clef), duration: restDrawnDuration(r),
  }))
  return restLineForVoice({
    duration: restDrawnDuration(rest),
    ...restVoiceContext(slots, voice, rest.beat, length, clef),
    inner,
  })
}

/**
 * Gather `own` and `others` for one rest from its staff's slots — the only score-shaped part of this
 * module, and the reason the rule itself stays a function of four plain numbers.
 *
 * ⭐ `slots` is **ONE STAFF'S LANE** (`staffMeasureView`, which is what `drawMeasureContent` already
 * holds), so it carries every voice of this staff and nothing else — which is exactly this
 * function's input and the reason `others` needs no cross-staff lookup. ⛔ It is deliberately NOT
 * given a `staffId` to filter by: resolving *"absent means the first staff"* needs the score
 * (`engine/models/staffContent.ts`), and a half-resolution here would silently drop every note on
 * staff 0 that stores no id.
 *
 * ⭐⭐ **`others` is what SOUNDS, not what STARTS.** A held half note under a 16th rest is the
 * prelude's whole problem, and it is the one thing VexFlow structurally cannot see (its
 * `ModifierContext` is keyed on the start tick). LilyPond says it in a comment — *"Include notes
 * that started any time"* (`rest-collision-engraver.cc:75`).
 *
 * ⚠️ **The other slot's span is `slotLength`, ⛔ never `writtenLength`.** A held tuplet member or a
 * whole-bar rest otherwise reports a span it does not have — the exact failure *"what SOUNDS, not
 * what STARTS"* is here to prevent.
 */
export function restVoiceContext(
  slots: ChordRest[],
  voice: number,
  beat: Fraction,
  length: Fraction,
  clef: Clef,
): { dir: 1 | -1; own: number[]; others: number[] } {
  // ⚠️ PARITY, matching the stem directions the renderer already forces (odd voices V1/V3 up, even
  // V2/V4 down). ⭐ `dir` is the SIDE and nothing more: V1 and V3 share it, and what puts V3 outside
  // V1 is the `inner` candidate, not this — see {@link innerVoiceRests}.
  const dir: 1 | -1 = voice % 2 === 0 ? 1 : -1
  const end = fracAdd(beat, length)

  const own: number[] = []
  const others: number[] = []
  for (const slot of slots) {
    if (slot.type !== 'chord') continue
    const mine = voiceOf(slot) === voice
    if (!mine && !soundsDuring(slot, beat, end)) continue
    for (const pitch of slot.notes) {
      (mine ? own : others).push(staffLineForSpelling(pitch.step, pitch.octave, clef))
    }
  }
  return { dir, own, others }
}
