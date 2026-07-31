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
import { inkFloor, type InkBox } from './kerning'

/**
 * The rule. **One instance for the WHOLE SCORE** — see {@link DEFAULT_SPACING}.
 *
 * A union of two SHAPES, not of two contexts: the engines do not merely disagree about a constant,
 * they disagree about the kind of curve (research §2). Dorico, MuseScore, Verovio and Finale all use
 * a **power** law — each doubling MULTIPLIES the space; LilyPond uses a **log** law — each doubling
 * ADDS a fixed amount. That difference is not cosmetic: it sets how far apart the shortest and
 * longest notes on a page may be, which is the thing a reader of dense music actually feels.
 */
export type SpacingRule =
  /** `quarterSpace × t^log₂(ratio)` — Gould read as Dorico reads her. */
  | { law: 'power'; quarterSpace: number; ratio: number }
  /**
   * LilyPond's: `(2 + log₂(t / shortest)) × base` above `shortest`, and a LINEAR
   * `(1 + t / shortest) × base` below it — `lily/spacing-options.cc`, `get_duration_space`.
   */
  | { law: 'log'; base: number; shortest: number }

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
export const GOULD_SPACING: SpacingRule = { law: 'power', quarterSpace: 3.5, ratio: Math.SQRT2 }

/**
 * ⭐⭐ **THE DEFAULT — LilyPond's, his call: *"in general we should approximate to LilyPond as much
 * as possible."*** `(2 + log₂(t / ♪)) × 1.2` staff spaces, linear below the eighth.
 *
 * Reported by eye against the √2 curve above: *"dense passages seem too tight to me, LilyPond
 * numbers sound better."* He is reading a real property — the two laws differ most in their
 * **dynamic range**, the ratio between the longest note on a page and the shortest:
 *
 * | | 𝅘𝅥𝅰 | 𝅘𝅥𝅯 | ♪ | ♩ | 𝅗𝅥 | 𝅝 | 𝅝 ÷ 𝅘𝅥𝅰 |
 * |---|---|---|---|---|---|---|---|
 * | Gould | – | 2 | 2¼ | 3½ | 5 | 7 | – |
 * | power, √2 | 1.24 | 1.75 | 2.47 | 3.50 | 4.95 | 7.00 | **5.6** |
 * | **log (this)** | **1.50** | **1.80** | **2.40** | **3.60** | **4.80** | **6.00** | **4.0** |
 *
 * A log law compresses the long end hard and holds the short end open, so dense music keeps a much
 * larger share of a line. That is exactly the complaint, answered.
 *
 * ⚠️ **And it is FURTHER from Gould overall**, which is worth saying plainly since she is what the
 * model was anchored on: mean absolute error against her eight values goes from 4.1% to 7.0%. It is
 * closer on the two shortest (16th −10% vs −12.5%, 8th +6.7% vs +10%) and worse on the two longest
 * (dotted half −8.3%, whole −14.3%). Both are defensible houses; this is the one he chose.
 *
 * 🚨 **`shortest` is a FIXED reference here, and that is OURS, not LilyPond's.** This comment used to
 * say *"LilyPond's `common-shortest-duration` is a setting that defaults to an eighth"*. **Both halves
 * are false** (checked against the source, 2026-07-31): it is COMPUTED —
 * `Spacing_spanner::calc_common_shortest_duration` takes the *mode over measures* of each measure's
 * shortest starter — and the value it is capped at is `base-shortest-duration`, whose shipped default
 * is **3/16 of a whole, a dotted eighth**, not an eighth. LilyPond's own manual is stale about this
 * too, which is presumably where the belief came from.
 *
 * ⭐ Keeping it fixed is still a real choice — an ABSOLUTE anchor is what spares us MuseScore's *"every
 * time a measure joins the system, re-lay out every previous measure"* loop (plan §1.1). But it is a
 * choice with a measured cost at both ends of the range: a 32nd-dominated passage comes out 25–37%
 * too tight and a piece of nothing shorter than a crotchet ~24% too loose, because the anchor is a
 * duration neither of them contains. **`docs/shortest-duration-plan.md` is the fix, decided and not
 * yet built.**
 *
 * ⛔ What deriving it does NOT do is even out equal durations — that is `proportionalNotationDuration`,
 * i.e. FIXED time-space, i.e. a preset. See that plan's §9.
 */
export const LILYPOND_SPACING: SpacingRule = { law: 'log', base: 1.2, shortest: 0.5 }

/** The rule in force. ⭐ ONE for the whole score — never a per-context or per-gesture variant. */
export const DEFAULT_SPACING: SpacingRule = LILYPOND_SPACING

/**
 * The space that FOLLOWS an event of this duration, in staff spaces.
 *
 * ⚠️ `quarters` is ALREADY in quarters, so there is no `/ ¼` term to write for the power law: the
 * unit of the argument IS the quarter, and dividing by one would space a quarter at `3.5 × √4 = 7`.
 *
 * ⭐ **No floor here, on purpose.** Gould's table flattens at the bottom and the temptation is a
 * `minFollowing` constant. It is not needed: at the very short end the flattening IS the notehead
 * showing through, and modelling the ink brings the bottom of the table with it. Which is also why
 * the floor is {@link spaceColumns}'s business and not this function's — a floor is made of ink.
 *
 * ⭐ **Rests are notes.** One curve, no rest branch. What differs about a rest is its *extent* and
 * its padding to a barline, both of which are the other half's business.
 */
export function followingSpace(quarters: Fraction, rule: SpacingRule = DEFAULT_SPACING): number {
  const t = fracToNumber(quarters)
  if (t <= 0) return 0
  if (rule.law === 'power') return rule.quarterSpace * t ** Math.log2(rule.ratio)
  // LilyPond's, `lily/spacing-options.cc`. ⚠️ The LINEAR branch below `shortest` is the whole reason
  // the curve does not collapse at the dense end: a log law alone reaches zero at `shortest / 4` and
  // goes negative below it, which is why LilyPond stops using it there rather than flooring it.
  const ratio = t / rule.shortest
  return (ratio < 1 ? 1 + ratio : 2 + Math.log2(ratio)) * rule.base
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
  /** The widest ink at this column, over every staff and voice — the PROJECTION of {@link ink}. */
  extent: EventExtent
  /**
   * ⭐⭐ The same ink, **located**: one box per drawn piece, with the vertical band it occupies
   * (`layout/kerning.ts`). It is what lets the floor ask *"can these two get out of each other's
   * way?"* instead of treating a column as a solid block — an accidental low on the staff tucks under
   * a preceding high notehead rather than buying room nobody looks at.
   *
   * ⚠️ **Empty for a column a FIXTURE built by hand** (`plainColumn`), and then the floor falls back to
   * `extent.right + padding + extent.left` — the horizontal-only algebra, which is what a
   * duration-only test means to exercise. Real columns always carry boxes (`measureColumns`).
   */
  ink: InkBox[]
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
  /**
   * ⭐⭐ **THE ROD** — the least room the gap after this column may have, in staff spaces, for material
   * that is NOT a column of its own.
   *
   * ⭐ **The name is the field's, not ours.** Renz's GUIDO spacing model (ICMC 2002; TU Darmstadt
   * dissertation, 2002) states it exactly: springs carry the duration-based stretch, and *"rods are
   * introduced, which determine the minimum stretch for one or more springs"*. LilyPond ships the same
   * pair — `Separation_item` *"compute[s] widths to generate spacing rods"*, exposed as
   * `springs-and-rods`. A minimum width spanning several columns is the published primitive for this,
   * so this field is a rod and says so; it was `minGap` for one afternoon.
   *
   * ⭐ **WHAT IT IS FOR** — his rule, and the shape contemporary notation keeps needing: *"some music
   * will be FIXED in the time-space of the score and other elements not, and we have to be able to
   * work with that."*
   *
   *   FIXED   → a COLUMN, one x for the whole system  (every ordinary note; a fan's owner)
   *   UNFIXED → a ROD over the gaps it crosses         (a fan's members; boxed cells; gestures)
   *
   * A fan is the first: its members fall on rationals nobody else in the system shares, so they
   * cannot be columns — as columns they dictated where every other staff's notes fell. But they are
   * real ink spanning several gaps of the grid they sit over, which is precisely what a rod says.
   * `gapsBetween` takes the larger of the rod and the pair's own ink, so the solve never learns which
   * kind of material asked.
   *
   * ⚠️ The rod is over the SPAN. Handing each gap its own members' width lumps the demand where the
   * group is densest and bends the grid there — see `engine/layout/fanRampRoom.ts`.
   *
   * 0 for every ordinary column.
   */
  rod: number
}

/** A column with nothing authored, no ink and no padding — the shorthand a duration-only test wants. */
export function plainColumn(beat: Fraction, duration: Fraction): Column {
  return { beat, duration, extent: NO_EXTENT, ink: [], padding: 0, authored: 0, rod: 0 }
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
      // ⭐ The floor is a max over box PAIRS once the ink is located — so a pair that can get out of
      //   the other's way costs nothing (`layout/kerning.ts`). With nothing clear it comes out at
      //   exactly the merged expression below, which is why this cannot widen a bar.
      floor: Math.max(
        column.ink.length > 0 && next.ink.length > 0
          ? inkFloor(column.ink, next.ink)
          : column.extent.right + column.padding + next.extent.left,
        // …and the ROD: whatever crosses this gap without being a column of it (see `Column.rod`).
        column.rod,
      ),
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
export function naturalWidth(columns: Column[], rule: SpacingRule = DEFAULT_SPACING): number {
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
export function minimumWidth(columns: Column[], rule: SpacingRule = DEFAULT_SPACING): number {
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
  rule: SpacingRule = DEFAULT_SPACING,
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
