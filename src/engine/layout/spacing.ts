/**
 * THE SPACING RULE — how much horizontal room an event earns, and how a bar's surplus is shared
 * (docs/spacing-model-plan.md P1). Pure: no VexFlow, no DOM, `Fraction` in, staff spaces out.
 *
 * Gould states horizontal spacing as **two independent facts** about every event, and Dorico,
 * MuseScore, LilyPond and Verovio are all built the same way:
 *
 *  - **its own extent** — the ink either side of its notehead column: accidentals and arpeggio signs
 *    to the left, dots, displaced heads and ledger overhang to the right;
 *  - **the space that FOLLOWS it** — a function of its DURATION, non-linear and strongly compressed.
 *
 * ⭐⭐ **The two are ADDED, never conflated, and combined with a `max`**: the duration gives the
 * *ideal* gap, the ink gives the *minimum* one, and the wider of the two wins. That sentence is the
 * whole module, and P0 measured what its absence costs — today a quarter comes out at 1.94 staff
 * spaces bare and 3.75 with a sharp in front of it, because the ink either replaces the rule
 * outright or plays no part in it (docs/spacing-model-research.md §6).
 *
 * ## Why here and not in `utils/`
 *
 * A rule measured in **staff spaces** is the editor's engraving, not the music: `Measure.slots` does
 * not know what a staff space is and must not learn. `docs/DESIGN-PRINCIPLES.md` §3 names spacing as
 * presentation, and `utils/**` is inside the core fence beside `engine/models/**` — so this sits in
 * `engine/layout/`, where the derived-view arithmetic already lives (`barWidthRoom`, `measuredRoom`).
 *
 * ## What this module deliberately does NOT know
 *
 * It never asks what a column *is*. It takes durations, ink extents and a per-pair padding as
 * numbers, because the things that measure those need a browser (headless every glyph measures 0×0,
 * research §5.4) and because P3's padding table is keyed by the pair of things — a caller's
 * question, not a rule's. So this file is fully unit-testable against Gould's table in node, and
 * the ink half arrives as arguments.
 */
import type { Fraction } from '@/types/music'
import { fracToNumber } from '@/utils/fraction'

/** The rule, as two numbers. One instance for the WHOLE SCORE — see {@link GOULD_SPACING}. */
export interface SpacingRule {
  /** Staff spaces an ordinary quarter earns. Gould's 3½. */
  quarterSpace: number
  /** How much more space a doubled duration earns. √2 — Gould's table, Dorico's default. */
  ratio: number
}

/**
 * The default rule: **3.5 staff spaces for a quarter, ×√2 per doubling.**
 *
 * ⭐ **The anchor is ABSOLUTE — the quarter — not the shortest note in the system.** LilyPond's
 * `common-shortest-duration` and MuseScore's `minSysTicks` exist to stop dense music exploding,
 * which a compressed curve already does (sixteen 16ths = 28 spaces against four quarters at 14 —
 * twice the width for four times the events). A relative anchor also forced MuseScore into *"every
 * time a measure joins the system, if its shortest note is shorter, re-lay out every previous
 * measure"*. We get consistency across the whole score for free and never write that loop.
 *
 * ⭐ **ONE rule for the whole score, including inside a fan** (his call, 2026-07-30). A fanned group
 * is metrical notation with a ramp drawn over it — *"not symmetrical or even"* — so Gould's
 * literal-time-space exception does not reach it, and there is no per-context rule.
 *
 * ⚠️ **It is a FIT, not a reproduction.** Measured against Gould's eight values it lands within 1% on
 * five and misses three — the 16th by −12.5%, the 8th by +10%, the dotted quarter by +7.2% — because
 * her own 16th→8th step is ×1.125 against her 8th→♩ step of ×1.556, and **no single ratio fits
 * both**. `spacing.test.ts` pins all eight, the misses at their measured error rather than under a
 * tolerance loose enough to swallow them. The ratio is the knob if it reads wrong by eye; it is one
 * field for the whole score, never a second rule for one gesture.
 */
export const GOULD_SPACING: SpacingRule = { quarterSpace: 3.5, ratio: Math.SQRT2 }

/**
 * The space that FOLLOWS an event of this duration, in staff spaces — `quarterSpace × t^log₂(ratio)`.
 *
 * ⚠️ `quarters` is ALREADY in quarters, so there is no `/ ¼` term to write: the unit of the argument
 * IS the quarter, and dividing by one would space a quarter at `3.5 × √4 = 7`. The prose name of the
 * rule ("3.5 spaces × √(duration / quarter)") is right; the code is `quarters ** log2(ratio)`.
 *
 * ⭐ **No floor here, on purpose.** Gould's table flattens at the bottom and the temptation is a
 * `minFollowing` constant. It is not needed: at the very short end the flattening IS the notehead
 * showing through, and modelling the ink brings the bottom of the table with it. Which is also why
 * the floor is {@link spaceColumns}'s business and not this function's — a floor is made of ink.
 *
 * ⭐ **Rests are notes.** One curve, no rest branch. What differs about a rest is its *extent* and
 * its padding to a barline, both of which are the other half's business.
 */
export function followingSpace(quarters: Fraction, rule: SpacingRule = GOULD_SPACING): number {
  const t = fracToNumber(quarters)
  if (t <= 0) return 0
  return rule.quarterSpace * t ** Math.log2(rule.ratio)
}

/** The ink either side of a column's notehead, in staff spaces from the head's own x. */
export interface EventExtent {
  /** Accidentals, arpeggio signs, articulations — everything drawn BEFORE the head. */
  left: number
  /** Dots, displaced heads, ledger overhang — everything drawn AFTER it. */
  right: number
}

/** No ink at all — the fixture a duration-only test spaces against, and a barline's default. */
export const NO_EXTENT: EventExtent = { left: 0, right: 0 }

/**
 * A rhythmic position at which something starts, holding every event that starts there — across all
 * voices **and all staves**. One x per column, shared by every staff in the system.
 *
 * ⚠️ `duration` is **the distance to the NEXT column, not the event's own written value.** In `♩ ♪ ♪`
 * the quarter's column is followed by an eighth's, so it earns a quarter's space; but where voice 2
 * has an eighth under voice 1's quarter, the quarter's *column* is followed half a beat later and
 * earns an eighth's space — the note is still a quarter and still drawn as one. That is Gould's rule
 * read correctly (space belongs to the gap, not to the notehead), and it is how MuseScore's
 * `computeSegmentDurationStretch` handles polyrhythm.
 *
 * ⭐ **A BARLINE is a column** — with an extent, a zero duration and nothing after it. That is what
 * turns "the padding before the barline" from a constant into the same question as every other gap.
 */
export interface Column {
  /** In quarters from the bar's start. Carried through so a caller can name what it got back. */
  beat: Fraction
  /** To the NEXT column, in quarters. The last column's is ignored. */
  duration: Fraction
  /** The widest ink at this column, over every staff and voice. */
  extent: EventExtent
  /**
   * The least ink-free space between this column and the next, in staff spaces — P3's pair table
   * (note↔note, note↔accidental, rest↔barline…). A property of the PAIR, which is why it is a
   * number the caller resolves rather than something either extent could carry.
   */
  padding: number
  /**
   * Authored space RESERVED before this column (client #10's leading space), in staff spaces.
   *
   * ⭐ Never squeezed and never stretched — *the gap you drag is the gap you get*. So it is added to
   * both the natural length and the minimum of the gap in front of this column, and held out of the
   * proportional share. 0 for almost every column.
   */
  authored: number
}

/** A column with nothing authored, no ink and no padding — the shorthand a duration-only test wants. */
export function plainColumn(beat: Fraction, duration: Fraction): Column {
  return { beat, duration, extent: NO_EXTENT, padding: 0, authored: 0 }
}

/**
 * What one gap between two columns is made of. The spring model, in three numbers.
 *
 * `spring` is elastic and shares the bar's surplus in proportion to its natural length; `floor` is
 * the ink and never yields; `rigid` is authored space, reserved out of the negotiation entirely.
 */
interface Gap {
  /** Natural length of the elastic part: {@link followingSpace} of the left column's duration. */
  spring: number
  /** What the elastic part may never compress below: the ink either side plus the pair's padding. */
  floor: number
  /** Reserved, never squeezed and never stretched. */
  rigid: number
}

function gapsBetween(columns: Column[], rule: SpacingRule): Gap[] {
  return columns.slice(0, -1).map((column, i) => {
    const next = columns[i + 1]
    return {
      spring: followingSpace(column.duration, rule),
      floor: column.extent.right + column.padding + next.extent.left,
      rigid: next.authored,
    }
  })
}

/** What a gap comes to when nothing is asking it to give: the `max` at the heart of the model. */
const naturalLength = (gap: Gap): number => gap.rigid + Math.max(gap.spring, gap.floor)

/**
 * The width these columns ASK for, in staff spaces — first column to last, unjustified.
 *
 * This is the bar's own answer to "how much room does this music need", and the number P2 hands the
 * casting-off in place of `max(vexflowInk × 1.15, columns × MIN_NOTE_SPACING)`. Include the barline
 * as the last column and it is the whole bar less its header.
 */
export function naturalWidth(columns: Column[], rule: SpacingRule = GOULD_SPACING): number {
  return gapsBetween(columns, rule).reduce((total, gap) => total + naturalLength(gap), 0)
}

/**
 * The width these columns will not go below, in staff spaces — the ink, and nothing the rule wants.
 *
 * The **incompressible** demand: what is left when every spring has been squeezed flat. A bar may be
 * asked to give up any part of `naturalWidth − minimumWidth` and no more, which is what the
 * casting-off needs to know before it decides how many bars fit on a line — and what stops a cap
 * like `MAX_MEASURE_WIDTH` from clamping a bar that genuinely cannot be narrower.
 */
export function minimumWidth(columns: Column[], rule: SpacingRule = GOULD_SPACING): number {
  return gapsBetween(columns, rule).reduce((total, gap) => total + gap.rigid + gap.floor, 0)
}

/**
 * Place every column, in staff spaces from the first — the spring solve (plan §1.3).
 *
 * Gourlay's model, which is TeX's glue and what LilyPond and MuseScore both do: one force is solved
 * for the whole bar, gaps already at their minimum do not move, and the rest absorb the difference
 * **in proportion to their natural length**. Freezing is iterative because freezing one gap raises
 * the force on the others, which can push a second gap onto its floor.
 *
 * `x[0]` is always 0 and `x[last]` is `targetWidth` whenever the music can be made to fit.
 *
 * ⚠️ **A floor is never violated, so an impossible target comes back OVERFULL rather than collided.**
 * Ask for less room than the ink needs and the last x exceeds `targetWidth`; the caller — the bar
 * width, which is the thing that should have asked for enough — is what decides what to do about it.
 * ⛔ The alternative is a bar that reports the width it was told and draws notes on top of each
 * other, which is the failure this whole model exists to end.
 *
 * ⛔ Justification BETWEEN bars is not this function's business. `distributeLineWidths`'s tiered
 * transfer — a bar of music pays nothing while an empty bar still has slack — is a rule he reported
 * into existence, and springs do not express it. Springs go inside a bar; the tiers stay between them.
 */
export function spaceColumns(
  columns: Column[],
  targetWidth: number,
  rule: SpacingRule = GOULD_SPACING,
): number[] {
  if (columns.length === 0) return []
  const gaps = gapsBetween(columns, rule)
  const lengths = solveGaps(gaps, targetWidth)

  const xs = [0]
  for (const length of lengths) xs.push(xs[xs.length - 1] + length)
  return xs
}

/**
 * The force solve: scale every elastic part by one factor, freeze whatever lands on its floor, and
 * go again with what is left. Terminates because each round freezes at least one gap or none at all.
 */
function solveGaps(gaps: Gap[], targetWidth: number): number[] {
  const frozen = gaps.map(() => false)

  for (;;) {
    // What the elastic parts must add up to, once the reserved space and the frozen gaps are paid.
    let budget = targetWidth
    let elastic = 0
    for (const [i, gap] of gaps.entries()) {
      budget -= gap.rigid
      if (frozen[i]) budget -= gap.floor
      else elastic += gap.spring
    }

    // Nothing elastic is left: every gap is either frozen on its floor or has no spring at all, so
    // the bar is at its incompressible minimum whatever was asked for.
    if (elastic <= 0) {
      return gaps.map((gap, i) => gap.rigid + (frozen[i] ? gap.floor : Math.max(gap.spring, gap.floor)))
    }

    const force = budget / elastic
    let froze = false
    for (const [i, gap] of gaps.entries()) {
      if (!frozen[i] && gap.spring * force < gap.floor) {
        frozen[i] = true
        froze = true
      }
    }
    // Freezing a gap raises the force on the rest, which can push a second one onto its floor.
    if (froze) continue

    return gaps.map((gap, i) => gap.rigid + (frozen[i] ? gap.floor : gap.spring * force))
  }
}
