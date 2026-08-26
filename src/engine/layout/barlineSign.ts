/**
 * ⭐⭐ **WHAT A BARLINE SIGN IS MADE OF** — the strokes and dots of a plain line, a final bar and the
 * two repeats, in **staff spaces**, measured from the boundary the sign divides. P2 of
 * docs/barline-types-plan.md.
 *
 * Pure: no stave, no context, no score. That is deliberate and it is §6.2's first item — **ONE OWNER
 * FOR THE SIGN'S EXTENT.** Four consumers need the same number and none of them may compute its own:
 * the pass that draws it (`rendering/BarlineRenderer`), the width the bar reserves for it (§5.1), the
 * hit-box the drag grabs (§6.2), and the selection highlight that should cover the whole sign
 * (§8 P5). ⛔ A lookup into the drawing pass would not do: `ElementRegistry` registers a barline box
 * for **every bar in the score, painted or not**, so the extent must be answerable for a bar the pass
 * never drew.
 *
 * ## ⭐⭐ THE GEOMETRY RULE: the sign grows INTO ITS OWN BAR; the dividing line stays on the boundary
 *
 * §6.1, and it is the correction of an earlier draft that had every sign growing rightward from the
 * boundary. Two facts killed that: **the staff lines END at `x2`**, so a thick line and two dots hung
 * past the last bar's boundary would be attached to nothing; and the **reading order** puts the thick
 * line last — a final bar is thin→THICK and an end repeat is dots·thin·THICK, so the THICK LINE IS
 * THE DIVIDER and everything else in the sign precedes it. A start repeat is that mirrored: THICK
 * first, then thin, then dots, all inside the bar it opens.
 *
 * ⭐ The invariant this protects is the one four readers already depend on: **`x` IS the bar
 * boundary** (`rendering/barlineInk`). The spacing model measures the lead-in from it, the registry's
 * `noteEndX` hit-box sits at it, the selection highlight paints from it, and `barWidth.e2e` asserts a
 * drawn barline sits at the stave's own `x2`. Under this rule `x` never moves for any sign, so the
 * bar-width drag arithmetic is untouched — the bar merely has to RESERVE the sign's width, which is
 * LilyPond's `space-to-barline` exactly.
 *
 * ⚠️ **The plain single line is the one member that keeps its ink to the RIGHT of `x`,** where it has
 * always been (`barlineInk.inkBarlines` widened VexFlow's rect rightward and says why). At 0.16
 * spaces the line straddles nothing — it IS the boundary within its own thickness — and moving every
 * barline in every score 1.6 px leftward to make the table look tidier is a change nobody asked for.
 * A composite sign is 1.0–1.5 spaces and must therefore choose a side; the plain line need not.
 *
 * ## The numbers, and where each comes from
 *
 * ⛔ Never "because the font says so" (§4.6.5: neither MuseScore nor Verovio reads `engravingDefaults`
 * at render time — every engine ships its own numbers, and now so do we). ⭐ Always "because the
 * sources agree, and here is the seam".
 */
import type { Measure } from '@/types/music'
import { engravingDefault, glyphBox } from '@/engine/fonts/fontMetrics'
import { THIN_LINE_SPACES } from '@/engine/rendering/thinLineWeight'

/**
 * The thin stroke — **0.16 spaces**, the weight every thin structural line in this score shares
 * (`rendering/thinLineWeight`). Gould gives no number for it (*"thicker than a stave-line"*, p. 38)
 * and her engraved finals measure 0.15–0.20, which is where this sits.
 */
const THIN = THIN_LINE_SPACES

/**
 * The thick stroke — **0.50 spaces**, and this is the strongest-sourced number in the family: Gould
 * p. 39 states it as *"of beam thickness"* and p. 17 makes a beam ½ a space [T]; five of her engraved
 * final bars measure 0.45–0.50 at 450 dpi [M]; Bravura's `thickBarlineThickness` is 0.5 [E]. Three
 * independent sources, and the seam was already wired.
 */
const THICK = engravingDefault('thickBarlineThickness')

/**
 * The white gap between the two strokes — **0.32 spaces**, and ⚠️ this is the one number where the
 * font and the treatise DISAGREE and we had to choose (§4.6.5). SMuFL's `barlineSeparation` is 0.40;
 * Gould's own engraved final bars measure a gap of **0.30–0.35** [M]. ⭐ Her drawing beats her
 * formula — the standing rule of this library, earned three times now (the p. 111 slur formula, the
 * p. 103 hairpin aperture, the p. 152 thin double) — and it beats the font here too.
 *
 * ⛔ Not `engravingDefault('barlineSeparation')`, deliberately. The seam is right there and reading it
 * would be the tidier line of code; it would also be 0.40, which is not what the page shows.
 */
const SEPARATION = 0.32

/**
 * Dot centre → the thin stroke it follows — **0.16 spaces**, SMuFL's `repeatBarlineDotSeparation`.
 *
 * ⚠️ **No treatise states one**, and the three candidates disagree wildly: Gould's page measures 0.35
 * [M], MuseScore uses 0.37, SMuFL says 0.16. ⭐ The tie-breaker is the one number two independent
 * sources DO agree on — the sign's TOTAL: Ross p. 147's footnote decomposes a repeat as
 * ½ + ½ + ½ = *"one and a half spaces"* [T], and Bravura's precomposed `repeatLeft` glyph is
 * **1.464** wide [E]. With 0.16 the parts here sum to 1.54, within 0.08 of both; with Gould's 0.35 it
 * would be 1.73, past the pair of them.
 */
const DOT_SEPARATION = engravingDefault('repeatBarlineDotSeparation')

/**
 * The repeat dot's width — **measured off `public/fonts/Bravura.otf`**, the font we engrave with, and
 * so exactly as wide as the dot that gets drawn (0.4 spaces, the same box as `augmentationDot`).
 *
 * ⚠️ **No treatise states a dot diameter**, and no engine declares one: MuseScore draws
 * `SymId::repeatDot` and Verovio `SMUFL_E044_repeatDot`, and **both size the sign from the glyph's
 * measured width** — `symBbox(SymId::repeatDot).width()` and
 * `GetGlyphWidth(SMUFL_E044_repeatDot, …)` respectively. This is that, in our seam. ⛔ Not a literal:
 * the number and the ink would be free to drift, which is the whole reason the metrics are generated.
 */
const DOT_WIDTH = glyphBox('repeatDot').advance

/**
 * **What sign divides a boundary.** ⭐ Note what is NOT here: `none`, `double`, `heavy`, `dashed` —
 * the family's other members are one case each in this file the day they are asked for, and a value
 * with no drawing behind it would be a lie the compiler cannot catch (plan §0).
 *
 * ⭐ `repeatBoth` is not a stored value anywhere and never will be: it is the DRAWING of two model
 * facts, bar *N*'s `repeatEnd` plus bar *N+1*'s `repeatStart` (§3.2, §4.3). MEI had to invent
 * `rptboth` because one stored slot could not hold two statements; we combine at the pen instead.
 */
export type BarlineSignKind = 'plain' | 'final' | 'repeatEnd' | 'repeatStart' | 'repeatBoth'

/** One vertical stroke of a sign: its LEFT edge and width, in staff spaces from the boundary
 *  (negative x = left of it, i.e. inside the bar the line ends). */
export interface SignStroke {
  x: number
  width: number
}

/**
 * A pair of repeat dots, by the LEFT EDGE of both (they share it) in staff spaces from the boundary.
 *
 * ⭐ A left edge rather than a centre because the dot is a GLYPH — `repeatDot`, U+E044, whose SMuFL
 * origin is its left edge — and the two engines that draw one draw exactly this code point
 * (MuseScore `drawSymbol(SymId::repeatDot, …)`, Verovio `DrawSmuflCode(…, SMUFL_E044_repeatDot, …)`).
 * ⛔ Not a circle of our own: it would be right in Bravura and wrong in the first music font whose
 * repeat dot is not perfectly round.
 *
 * ⭐ The vertical position is NOT here: it is read off the STAFF, which is what both engines do and
 * what makes the sign correct on a staff that is not five lines. See `BarlineRenderer`.
 */
export interface SignDots {
  x: number
  width: number
}

/** Everything a sign is: its strokes, its dots (either side, or none), and how far its ink reaches
 *  from the boundary. ⭐ `extent` is derived from the parts rather than typed beside them — the one
 *  arrangement in which the drawing and the room reserved for it cannot drift apart. */
export interface BarlineSignParts {
  strokes: SignStroke[]
  /** Dots left of the boundary (an end repeat), right of it (a start repeat), or both. */
  dots: SignDots[]
  /** ⭐ WHICH stroke is the dividing line — the one that sits ON the boundary. Index into `strokes`.
   *  The hinting pass needs it (a sign is aligned by its divider or not at all), and so will the
   *  highlight. */
  divider: number
  /** How far the ink reaches either side of the boundary, in staff spaces. Both are ≥ 0. */
  extent: { left: number; right: number }
}

/** The dots of a repeat, measured out from the far side of the thin stroke at `edge` — `direction`
 *  is the way the sign grows, so the gap is always between the stroke and the nearest dot edge. */
function dotsAt(edge: number, direction: 1 | -1): SignDots {
  const left = direction === 1 ? edge + DOT_SEPARATION : edge - DOT_SEPARATION - DOT_WIDTH
  return { x: left, width: DOT_WIDTH }
}

/** The extent a set of parts reaches either side of 0. */
function extentOf(strokes: SignStroke[], dots: SignDots[]): { left: number; right: number } {
  let left = 0
  let right = 0
  for (const s of strokes) {
    left = Math.max(left, -s.x)
    right = Math.max(right, s.x + s.width)
  }
  for (const d of dots) {
    left = Math.max(left, -d.x)
    right = Math.max(right, d.x + d.width)
  }
  return { left, right }
}

function parts(strokes: SignStroke[], dots: SignDots[], divider: number): BarlineSignParts {
  return { strokes, dots, divider, extent: extentOf(strokes, dots) }
}

/**
 * **The sign, drawn out.** All offsets are in staff spaces from the boundary; positive is rightward.
 *
 * ⭐ Reading order is the whole of the layout. An end sign is *(dots) · thin · gap · THICK* with the
 * thick line's RIGHT edge on the boundary; a start sign is that mirrored. The back-to-back form takes
 * Gould's design **(A)** — dots · thin · **one shared THICK** · thin · dots (p. 234: *"Either of the
 * following designs may be used"*, and this is the one MuseScore draws; LilyPond's default is her
 * (B), two thick lines and no thin at the junction, which is the later option). ⛔ Never two complete
 * repeat signs side by side, which is the one thing she rules out.
 */
export function barlineSignParts(kind: BarlineSignKind): BarlineSignParts {
  switch (kind) {
    case 'plain':
      // ⚠️ The one sign whose ink is to the RIGHT of the boundary — see the header. This is byte for
      // byte where `inkBarlines` has always put it, and moving it would move every bar in the score.
      return parts([{ x: 0, width: THIN }], [], 0)

    case 'final': {
      const thick = { x: -THICK, width: THICK }
      const thin = { x: -(THICK + SEPARATION + THIN), width: THIN }
      return parts([thin, thick], [], 1)
    }

    case 'repeatEnd': {
      const thick = { x: -THICK, width: THICK }
      const thin = { x: -(THICK + SEPARATION + THIN), width: THIN }
      // Gould p. 39: a repeat *"uses the final double barline design together with repeat dots"* — so
      // the two strokes are the final bar's, verbatim, and only the dots are new.
      return parts([thin, thick], [dotsAt(thin.x, -1)], 1)
    }

    case 'repeatStart': {
      const thick = { x: 0, width: THICK }
      const thin = { x: THICK + SEPARATION, width: THIN }
      return parts([thick, thin], [dotsAt(thin.x + thin.width, 1)], 0)
    }

    case 'repeatBoth': {
      // ⭐ ONE shared thick line, centred on the boundary — the junction of two repeats is a single
      // divider, not two. Everything else is the two signs' own halves.
      const thick = { x: -THICK / 2, width: THICK }
      const thinLeft = { x: thick.x - SEPARATION - THIN, width: THIN }
      const thinRight = { x: thick.x + THICK + SEPARATION, width: THIN }
      return parts(
        [thinLeft, thick, thinRight],
        [dotsAt(thinLeft.x, -1), dotsAt(thinRight.x + thinRight.width, 1)],
        1,
      )
    }
  }
}

/**
 * **The sign at one boundary**, from the two bars that meet there. Either may be absent: `ends` is
 * undefined at a system's opening edge, `begins` at its closing one — and "absent" here means *not on
 * this system*, which is what makes the system condition local to this one function.
 *
 * ⭐ The order of these tests IS the family's precedence, and only one row of it is a judgement call:
 * a bar carrying BOTH a `final` style and a `repeatEnd` draws the repeat, because Gould's repeat
 * *"uses the final double barline design together with repeat dots"* (p. 39) — the repeat is the
 * final bar plus something, so it subsumes it rather than competing with it.
 */
export function signAtBoundary(ends: Measure | undefined, begins: Measure | undefined): BarlineSignKind | null {
  const closes = ends?.repeatEnd !== undefined
  const opens = begins?.repeatStart !== undefined
  if (closes && opens) return 'repeatBoth'
  if (opens) return 'repeatStart'
  if (closes) return 'repeatEnd'
  if (ends?.barline?.style === 'final') return 'final'
  // A bar ends here, and nothing was said about it: the plain single line every boundary draws.
  // ⛔ Nothing when no bar ends here — a system's opening edge is the stave's own begin bar.
  return ends ? 'plain' : null
}

/**
 * ⭐⭐ **WHICH TWO SPACES THE REPEAT DOTS GO IN — read off the staff, never hardcoded.**
 *
 * Returned as staff-line numbers (0 = top line), so a half-integer is a space centre. On the five
 * lines everybody actually writes on this is **1.5 and 2.5** — the 2nd and 3rd spaces from the
 * bottom — which is Gould's measured 1.48 / 2.48 (p. 234) and, to 0.01, where Bravura's precomposed
 * `repeatDots` puts them.
 *
 * ⚠️ **The general case is not "the middle line ± half a space", which is wrong on an even staff.**
 * Four lines have no middle LINE — their middle is a space — so ±0.5 lands the dots ON two lines,
 * where they are invisible. The rule that holds for every count is *the two space centres nearest
 * the middle, one either side*: 5 lines → 1.5 / 2.5, 4 → 0.5 / 2.5, 3 → 0.5 / 1.5, 1 → −0.5 / 0.5
 * (either side of the single line). ⭐ Those are MuseScore's numbers for the same staves, arrived at
 * by its own arithmetic — the books say nothing about non-standard line counts (§4.2 is UNKNOWN
 * there), so agreeing with the engine that has shipped it longest is the evidence available.
 *
 * ⚠️ Verovio diverges here and it is deliberate on their side: `3 - lines % 2` gives an EVEN staff
 * **three** dots rather than two. Not copied — two dots is what both treatises draw and what
 * MuseScore does — but recorded, because it is the one place the engines disagree about this sign.
 */
export function dotLines(numLines: number): [number, number] {
  const middle = (numLines - 1) / 2
  // A whole number means there IS a middle line, so the nearest space centres are half a space away;
  // otherwise the middle is itself a space and its neighbours are a whole space out.
  const reach = Number.isInteger(middle) ? 0.5 : 1
  return [middle - reach, middle + reach]
}

/**
 * How far this sign's ink reaches either side of the boundary, in staff spaces — §6.2's one owner of
 * the number, for the hit-box, the room floor and the two width terms.
 */
export function barlineSignExtent(kind: BarlineSignKind): { left: number; right: number } {
  return barlineSignParts(kind).extent
}
