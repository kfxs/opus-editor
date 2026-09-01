/**
 * ⭐⭐ **WHICH SIDE A FRACTIONAL BEAM POINTS — P4c** (`docs/beam-hook-research.md`,
 * `docs/beam-engraving-plan.md`).
 *
 * ## ⭐ The term is FRACTIONAL BEAM, ⛔ never "hook"
 *
 * All four treatises have a section under that heading (Gould pp. 157–158, Ross p. 124, Gerou & Lusk
 * p. 31, Stone pp. 12–13); LilyPond's source says *beamlet*, Verovio *partial flag*, VexFlow *partial
 * beam*. ⛔ Grepping those books for *hook* finds the **REST** chapters instead — a quaver rest has
 * hooks — which is why this looked unresearched for so long.
 *
 * ## ⭐⭐ The rule, and ⛔ unlike the SLOPE it is NOT a taste call
 *
 * > **A fractional beam points in the direction of the beat, or division of the beat, to which it
 * > belongs.** — Gould p. 157
 *
 * Ross (*"pointing in the direction of the note to which it is a fraction"*), Gerou & Lusk and Stone
 * (*"must point toward the note of which they are a fraction"*) say the same thing in four wordings,
 * and Gould **draws** it: her ⅜ pair on p. 157 sets `♪. ♬ ♪` against `♪ ♬ ♪.` — the same three
 * note-values with **opposite** fractional beams — because in the first the semiquaver *completes*
 * the second quaver and in the second it *starts* it. That figure is measured in the research doc §3.
 *
 * ## ⭐⭐ Why the test below is TOTAL, and needs no tie-break
 *
 * A fractional beam exists exactly when a note is shorter than its neighbours' beam level. Its
 * {@link FractionalBeamPlace.division} is the metric unit **one beam level coarser** than the note —
 * an eighth for a semiquaver, a sixteenth for a demisemiquaver — i.e. **twice the note's own written
 * level**. ⇒ an undotted note of that level covers exactly HALF a division, so **exactly one of its
 * two ends lands on the division grid**, and which one it is *is* the answer:
 *
 * - it **starts** on a division ⇒ it begins that division ⇒ point **RIGHT**, into what follows;
 * - it **ends** on a division ⇒ it completes the division behind it ⇒ point **LEFT**.
 *
 * ⛔ **And when neither end lands on one** — a tuplet, a doubly-dotted oddity — the rule has nothing
 * to say and returns `null` rather than a guess (`reference_a_guessing_fallback_gets_believed`).
 * The incumbent then decides, which is the `neighbours` row below.
 *
 * ## ⚠️ What this module deliberately does NOT decide
 *
 * ⛔ **A fractional beam on the FIRST or LAST note of a group is not a free choice at all.** Ross and
 * Gerou & Lusk both state *"always inside the grouping"*, so the first note's can only point right
 * and the last note's can only point left — containment, not metre. VexFlow already gets both right,
 * and this module is never consulted for them (see {@link fractionalBeamSide}'s callers).
 * ⇒ ⭐ the only genuinely free case is an **interior** note, which is exactly where the rule speaks.
 *
 * ⛔ **The LENGTH is not here.** Every source says one notehead and we draw 0.9 sp; that is decision
 * **A** of the research doc §8, it is HIS, and it moves a different pixel. ⛔ Not changed by P4c.
 *
 * ⛔ **A fractional beam next to a REST is not here either.** Gould gives BOTH directions as
 * *"equally acceptable"* (p. 158) — the one genuinely open choice in the topic — so it stays open.
 */
import type { NoteDuration } from '@/types/music'
import { type Fraction, fracAdd, fracFromInt, fracIsZero, fracMul, fracSub } from '@/utils/fraction'
import { doubleDuration, durationToFraction } from '@/utils/durations'

/** Which way a fractional beam's stub lies from the stem it hangs on. */
export type FractionalBeamSide = 'left' | 'right'

/**
 * Where one note sits in its bar, as a fractional-beam rule needs it. ⛔ Plain values — no
 * `StaveNote`, no pixels: `rendering/EngravedBeam`'s caller is what knows how to measure these.
 */
export interface FractionalBeamPlace {
  /** Where the note begins, in **quarter-note units from the bar's start**. */
  start: Fraction
  /** The note's SOUNDING length in quarters — dots included. */
  length: Fraction
  /**
   * ⭐ The metric unit this note is a fraction OF, in quarters — one beam level coarser than the
   * note itself. {@link fractionalBeamDivision} derives it from the written duration.
   */
  division: Fraction
}

/**
 * ⭐ The division a note of this written duration is a fraction of: **twice its own level**, ⛔ dots
 * ignored. A semiquaver is a fraction of a quaver; a demisemiquaver of a semiquaver.
 *
 * Returns `null` for a duration that cannot carry a fractional beam at all (nothing is coarser than
 * a whole note to be a fraction of).
 */
export function fractionalBeamDivision(duration: NoteDuration): Fraction | null {
  const coarser = doubleDuration(duration)
  return coarser ? durationToFraction(coarser, 0) : null
}

/** True when `x` is an exact multiple of `grid` — i.e. `x` lands on the grid's lines. */
function onGrid(x: Fraction, grid: Fraction): boolean {
  if (fracIsZero(grid)) return false
  // x / grid integral ⇔ (x.num · grid.den) divisible by (x.den · grid.num).
  const num = x.num * grid.den
  const den = x.den * grid.num
  return den !== 0 && num % den === 0
}

/**
 * ⭐⭐ **THE BOOKS' RULE** — Gould p. 157, Ross p. 124, Gerou & Lusk p. 31, Stone p. 12.
 *
 * ⛔ Returns `null` when the note straddles the division grid at neither end, which is the rule
 * having no opinion rather than a default.
 */
function sideByBeat(place: FractionalBeamPlace): FractionalBeamSide | null {
  const startsOnDivision = onGrid(place.start, place.division)
  const endsOnDivision = onGrid(fracAdd(place.start, place.length), place.division)
  if (startsOnDivision === endsOnDivision) return null
  return startsOnDivision ? 'right' : 'left'
}

/**
 * ⚠️ **NO OPINION — what we drew before P4c**, kept as a row so the two can be compared on the same
 * page. VexFlow's `lookupBeamDirection` then decides from the NEIGHBOURS' durations.
 *
 * ⭐⭐ It is not an invented straw man: it is **LilyPond's own non-default branch**
 * (`beaming-pattern.cc`, `point_right = right_count > left_count`, taken when `strict_beat_beaming_`
 * is off). 🚨 What VexFlow did was promote that fallback to the only rule — and its signature
 * `lookupBeamDirection(duration, prevTick, tick, nextTick, noteIndex)` carries **no beat and no
 * metre**, so Gould's two ⅜ bars are literally indistinguishable to it.
 */
function sideByNeighbours(): FractionalBeamSide | null {
  return null
}

/**
 * ⭐ The rules, as a table — the shape `engrave/beams/beamSlope` established for P4b.
 *
 * | row | what it is |
 * |---|---|
 * | `beat` | ⭐⭐ the four treatises' rule, and **the active one** |
 * | `neighbours` | ⚠️ what we drew before P4c — defer to VexFlow's neighbour-duration heuristic |
 */
export const FRACTIONAL_BEAM_SIDE_RULES = {
  beat: sideByBeat,
  neighbours: sideByNeighbours,
} satisfies Record<string, (place: FractionalBeamPlace) => FractionalBeamSide | null>

export type FractionalBeamSideRuleName = keyof typeof FRACTIONAL_BEAM_SIDE_RULES

/**
 * ⭐⭐ **The armed rule.** ⛔ Unlike P4b's slope, this one is NOT left open: the four books agree with
 * each other, with Gould's own plates and with LilyPond's `strict-beat-beaming` branch, so there is
 * no taste call here to leave to his eye — only a defect to fix. `neighbours` stays in the table so
 * the change is one word to undo and can be compared side by side.
 */
export const ACTIVE_FRACTIONAL_BEAM_SIDE_RULE: FractionalBeamSideRuleName = 'beat'

/**
 * Which side the fractional beam on this note should lie, or `null` for "no opinion — let the
 * incumbent decide".
 */
export function fractionalBeamSide(
  place: FractionalBeamPlace,
  rule: FractionalBeamSideRuleName = ACTIVE_FRACTIONAL_BEAM_SIDE_RULE,
): FractionalBeamSide | null {
  return FRACTIONAL_BEAM_SIDE_RULES[rule](place)
}

/** One slot of a beam group, as {@link fractionalBeamSides} needs it. */
export interface FractionalBeamNote {
  /** Where the note begins, in quarter-note units from the bar's start. */
  start: Fraction
  duration: NoteDuration
  dots?: number
  /** ⚠️ The SOUNDING length where it differs from the written one — a tuplet's `actualDuration`. */
  actualLength?: Fraction
  /** A beam may run over a rest; a rest may not carry a fractional beam. */
  isRest?: boolean
}

/**
 * ⭐ The whole group's answer, one entry per slot — `null` where the rule is silent or the note
 * cannot carry a fractional beam.
 *
 * ⚠️ **Interior notes only.** The first and last slots are answered `null` on purpose: their side is
 * forced by *"always inside the grouping"* (Ross p. 124, Gerou & Lusk p. 31), which VexFlow already
 * honours — see this module's header.
 */
export function fractionalBeamSides(
  notes: readonly FractionalBeamNote[],
  rule: FractionalBeamSideRuleName = ACTIVE_FRACTIONAL_BEAM_SIDE_RULE,
): (FractionalBeamSide | null)[] {
  return notes.map((note, i) => {
    if (i === 0 || i === notes.length - 1) return null
    // ⛔ A rest carries no stem and so no fractional beam, even when a beam runs OVER it
    // (`beamOver` — `utils/beaming`).
    if (note.isRest) return null
    const division = fractionalBeamDivision(note.duration)
    if (!division) return null
    // ⚠️ `actualLength` and NOT the written one wherever it is given: inside a tuplet the two differ,
    // and it is where the note really FALLS that the metre judges. ⭐ In practice a tuplet then lands
    // on no division at all and the rule abstains, which is the honest answer.
    const length = note.actualLength ?? durationToFraction(note.duration, note.dots ?? 0)
    return fractionalBeamSide({ start: note.start, length, division }, rule)
  })
}

/**
 * ⭐ The division grid, expressed as a length — exported for the spec, which checks the claim in this
 * module's header that a note covers exactly half of it.
 */
export function coversHalfOfDivision(place: FractionalBeamPlace): boolean {
  return fracIsZero(fracSub(fracMul(place.length, fracFromInt(2)), place.division))
}
