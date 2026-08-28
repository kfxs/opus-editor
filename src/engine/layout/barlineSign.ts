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
export type BarlineSignKind = 'plain' | 'invisible' | 'final' | 'repeatEnd' | 'repeatStart' | 'repeatBoth'

/**
 * ⭐ **The signs a user PLACES** — the palette's three, and the vocabulary the editor's barline stamp
 * speaks (`interactions/barlineStamp.ts`, its ghost, docs/barline-types-plan.md P4).
 *
 * Declared HERE and narrowed from {@link BarlineSignKind} rather than listed again over there, for
 * the reason `engine/rendering/ghostTypes.ts` exists at all: the engine owns the vocabulary and the
 * editor translates into it (CLAUDE.md). The one member left out is `repeatBoth`, which is DRAWN
 * from two bars' statements and stored nowhere — there is no single field a stamp could write it to.
 * (The Properties chooser CAN say it, because it names a LINE and writes both owners:
 * `barlineOps.setBoundarySign`.)
 *
 * ⭐ **`plain` IS placeable, and it is the eraser** — his ask, 2026-08-26: *"let's add normal to the
 * barline palette, and the ghost is the normal barline, but it is another way to rewrite the open,
 * final and end repeat."* Stamping it says *"this bar's barlines are ordinary"*, which is the only
 * member of this union that clears rather than writes (`interactions/barlineStamp`).
 */
export type PlacedBarlineSign = Extract<BarlineSignKind, 'plain' | 'invisible' | 'final' | 'repeatStart' | 'repeatEnd'>

/**
 * ⭐⭐ **WHICH STATEMENT A PIECE OF INK BELONGS TO** — the answer to *"I clicked the left dots of a
 * `:||:`; why did the whole sign light up?"* (his report, 2026-08-26).
 *
 * A boundary can carry TWO statements at once — bar *N*'s `repeatEnd` and bar *N+1*'s `repeatStart`
 * — and each is separately selectable (`interactions/elements/barline.ts` and `./repeatStart.ts`).
 * So every part of a sign has to say whose it is, and the rule is the one the header already states:
 *
 * ⭐ **THE DIVIDER IS SHARED; everything LEFT of it belongs to the bar the line ends, everything
 * RIGHT of it to the bar it opens.** That falls straight out of §6.1's geometry rather than being a
 * second table to keep in step — the divider is the stroke ON the boundary, and a boundary is what
 * the two bars share. It also gives the right answer for every non-composite sign for free: a final
 * bar is thin(`end`) + THICK(`shared`), and a lone `|:` is THICK(`shared`) + thin(`start`) + dots.
 *
 * ⚠️ `shared` lights up with EITHER half, deliberately: the thick line really is part of both signs,
 * and leaving it black while its own dots turned blue would read as half a selection.
 */
export type SignHalf = 'end' | 'start' | 'shared'

/** One vertical stroke of a sign: its LEFT edge and width, in staff spaces from the boundary
 *  (negative x = left of it, i.e. inside the bar the line ends). */
export interface SignStroke {
  x: number
  width: number
  /** Whose ink this is — see {@link SignHalf}. */
  half: SignHalf
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
  /** Whose ink this is — see {@link SignHalf}. `end` for the dots of a `:|`, `start` for a `|:`'s. */
  half: SignHalf
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
 *  is the way the sign grows, so the gap is always between the stroke and the nearest dot edge.
 *  ⭐ Dots are never `shared`: they sit off the boundary, so the direction they grow in IS their
 *  half — leftward dots close a repeat, rightward dots open one. */
function dotsAt(edge: number, direction: 1 | -1): SignDots {
  const left = direction === 1 ? edge + DOT_SEPARATION : edge - DOT_SEPARATION - DOT_WIDTH
  return { x: left, width: DOT_WIDTH, half: direction === 1 ? 'start' : 'end' }
}

/**
 * ⭐ **HOW FAR A BARLINE'S REGISTERED HIT BOX STRADDLES THE BOUNDARY**, on each side, in px.
 *
 * A barline box is `[boundary − straddle − extent.left, boundary + straddle]`
 * (`VexFlowRenderer.registerMeasureElements`): it grows LEFTWARD with the sign's ink
 * ({@link barlineSignExtent}) and straddles the line itself by this much either way, because the
 * drawn stroke sits ON the boundary and a box that started there would be un-clickable from the left.
 *
 * ⭐ **Named because a second reader now has to run the arithmetic BACKWARDS.** The join squares
 * (`interactions/elements/barlineJoinHandles`) must sit exactly on the drawn line, so they recover
 * `boundary = box.right − straddle` — and a box whose right edge and this constant disagreed would
 * put every square a pixel or two off the line it belongs to. ⛔ Not the box's CENTRE, which is what
 * `barlineStamp.nearestBoundary` uses: that one is only ever compared with other boxes' centres, so
 * the sign's leftward growth cancels; here it would not.
 */
export const BARLINE_BOX_STRADDLE_PX = 2

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
    // ⭐⭐ **AN INVISIBLE LINE IS A PLAIN LINE, GEOMETRICALLY** — and sharing the case is the point,
    // not a shortcut. What "invisible" removes is the INK; the bar still ends there, the boundary is
    // still where it was, and the room reserved for it is unchanged (plan §10.0). If this returned
    // an empty sign the music either side would re-space the moment you hid a line, which is the one
    // thing hiding must never do — the hidden REST's rule, arriving at its second client.
    // ⚠️ So the difference is applied AFTER the draw, by the audience: `BarlineRenderer` hands the
    // drawn group to `applyHiddenTreatment`. eslint no-fallthrough: keep this comment's last line
    // adjacent to the case (`reference_eslint_no_fallthrough_multiline_comment`).
    case 'invisible':
      // ⚠️ The one sign whose ink is to the RIGHT of the boundary — see the header. This is byte for
      // byte where `inkBarlines` has always put it, and moving it would move every bar in the score.
      return parts([{ x: 0, width: THIN, half: 'shared' }], [], 0)

    case 'final': {
      const thick: SignStroke = { x: -THICK, width: THICK, half: 'shared' }
      const thin: SignStroke = { x: -(THICK + SEPARATION + THIN), width: THIN, half: 'end' }
      return parts([thin, thick], [], 1)
    }

    case 'repeatEnd': {
      const thick: SignStroke = { x: -THICK, width: THICK, half: 'shared' }
      const thin: SignStroke = { x: -(THICK + SEPARATION + THIN), width: THIN, half: 'end' }
      // Gould p. 39: a repeat *"uses the final double barline design together with repeat dots"* — so
      // the two strokes are the final bar's, verbatim, and only the dots are new.
      return parts([thin, thick], [dotsAt(thin.x, -1)], 1)
    }

    case 'repeatStart': {
      const thick: SignStroke = { x: 0, width: THICK, half: 'shared' }
      const thin: SignStroke = { x: THICK + SEPARATION, width: THIN, half: 'start' }
      return parts([thick, thin], [dotsAt(thin.x + thin.width, 1)], 0)
    }

    case 'repeatBoth': {
      // ⭐ ONE shared thick line, centred on the boundary — the junction of two repeats is a single
      // divider, not two. Everything else is the two signs' own halves.
      const thick: SignStroke = { x: -THICK / 2, width: THICK, half: 'shared' }
      const thinLeft: SignStroke = { x: thick.x - SEPARATION - THIN, width: THIN, half: 'end' }
      const thinRight: SignStroke = { x: thick.x + THICK + SEPARATION, width: THIN, half: 'start' }
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
 * ⭐ The order of these tests IS the family's precedence, and two rows of it are judgement calls:
 *
 *  - **`invisible` first, above everything** — it is not a sign but a statement about whatever sign
 *    would stand here, so it cannot lose to one. His call, 2026-08-26; the body says why.
 *  - a bar carrying BOTH a `final` style and a `repeatEnd` draws the **repeat**, because Gould's
 *    repeat *"uses the final double barline design together with repeat dots"* (p. 39) — the repeat
 *    is the final bar plus something, so it subsumes it rather than competing with it.
 */
export function signAtBoundary(ends: Measure | undefined, begins: Measure | undefined): BarlineSignKind | null {
  // ⭐⭐ **INVISIBLE WINS OVER EVERYTHING** — 🚨 his report, 2026-08-26: *"why can I not override a
  // repeat line with an invisible?"* He had a `|:` on this line, stamped invisible, and the picture
  // did not move: the style was stored, and the repeat below out-ranked it.
  //
  // ⭐ Right, and the fix is the precedence rather than the field. `invisible` is not a fourth sign
  // competing for the boundary — it is a statement that **this line is not engraved**, which is a
  // statement ABOUT whatever sign would otherwise stand there. Every engine models it that way
  // (MuseScore's barline `visible` flag is orthogonal to its type), and it is the hidden REST's rule
  // once more: what disappears is the INK, never the content. The repeat is still in the model, still
  // exported, still what a play order would read.
  //
  // ⚠️ The ROOM is deliberately NOT affected — `ownEndSignKind` still answers `repeatEnd` for a
  // hidden repeat, so hiding a line never re-spaces the music around it (that function's own rule:
  // reserving more than is drawn is always safe, the reverse never is).
  if (ends?.barline?.style === 'invisible') return 'invisible'

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
 * ⭐ **Does this sign carry a half belonging to `half`?** — i.e. is there ink here that the bar on
 * that side of the boundary is the owner of.
 *
 * The one caller that matters is the DRAWING pass, which registers a `repeatStart` hit-box exactly
 * when the sign it just painted has a `start` half ({@link BarlineRenderer}). ⛔ Read off the parts
 * rather than listed as a second table of kinds, for {@link BarlineSignParts.extent}'s reason: a
 * fourth sign is then a row in {@link barlineSignParts} and a case nowhere.
 *
 * ⚠️ `shared` is not a half anything owns alone, so `signHasHalf('plain', 'end')` is **false** — a
 * plain line is nothing but its divider. Ask this about ownership, never about what to light up:
 * the highlight paints `half` PLUS `shared`, which is what makes a plain line's own selection show.
 */
export function signHasHalf(kind: BarlineSignKind, half: SignHalf): boolean {
  const { strokes, dots } = barlineSignParts(kind)
  return strokes.some(s => s.half === half) || dots.some(d => d.half === half)
}

/**
 * ⭐⭐ **CAN THIS SIGN CARRY WINGS?** — the flared tips at the top and bottom of its thick line.
 *
 * ⭐ **A sign with a HALF has a thick line; one without is a bare stroke.** So the answer is read off
 * the parts, exactly as {@link signHasHalf} is, and there is no third table to keep in step: `final`,
 * both repeats and the back-to-back form all qualify, while a `plain` line and an `invisible` one —
 * which are nothing but their divider — have nothing to flare.
 *
 * 🚨 **HIS RULE, 2026-08-26:** *"it should be only checkable when wings are allowed — this is for
 * open repeat, for end repeat and for final; other barlines do not allow wings."* ⚠️ Note the FINAL:
 * MuseScore wings the two repeats and the back-to-back form and never the final bar
 * (`repeatBarTips` is checked in three cases only). He asked for the final too, which is his call and
 * a defensible one — a final bar's thick line is the same stroke a repeat's is.
 */
export function wingsAllowed(kind: BarlineSignKind): boolean {
  return signHasHalf(kind, 'end') || signHasHalf(kind, 'start')
}

/**
 * ⭐⭐ **WHERE A WINGED SIGN'S TIPS GO** — one entry per pair, each with the glyph to stamp and the x
 * to stamp it at, in staff spaces from the boundary.
 *
 * ⛔ **SMuFL has no wing glyph**, so these are the STAFF BRACKET's own tips — his identification
 * (*"similar to Bravura `\uE002`"*), and what MuseScore's `drawTips` stamps. ⭐ The two families
 * attach differently and that is the whole of the arithmetic: a `bracket*` tip's stem is its LEFT
 * edge (it flares right), a `reversedBracket*` tip's is its RIGHT edge (it flares left), which is why
 * MuseScore draws the mirrored pair at `x − symWidth`.
 *
 * ⭐ **Which pairs a sign gets falls out of its halves**, and is the same rule again: ink to the LEFT
 * of the divider is an ENDING sign, so its tips flare left off the divider's right edge; ink to the
 * RIGHT is an OPENING sign, so its tips flare right off the divider's left edge. A `:||:` is both.
 * ⛔ Not MuseScore's arrangement, and it cannot be: it draws the back-to-back form with TWO thick
 * lines (Gould's design (B)) and puts a pair on each, where we draw her (A) — one shared divider.
 */
export interface SignWings {
  /** Which way this pair flares. `right` is the `bracket*` family, `left` the mirrored one. */
  flare: 'left' | 'right'
  /**
   * ⭐⭐ **WHOSE TIPS THESE ARE** — and ⛔ never `shared`, which is the bug this field exists to fix.
   *
   * 🚨 **HIS REPORT (screenshot), 2026-08-26:** selecting the open repeat of a `:||:` lit its own dots
   * correctly *"but the wing highlight is not — it is also highlighting the close wing."* ⭐ A wing
   * pair belongs to the half whose direction it FLARES: the left-flaring tips are the closing sign's,
   * the right-flaring ones the opening sign's. The divider they spring from is shared; the tips
   * themselves are not, and are the one part of a sign that says which half it is by its SHAPE.
   */
  half: SignHalf
  /** The glyph's ORIGIN x, in staff spaces from the boundary — already offset for the mirrored
   *  family, so the caller stamps at this x and nothing else. */
  x: number
}

export function signWings(kind: BarlineSignKind): SignWings[] {
  if (!wingsAllowed(kind)) return []
  const parts = barlineSignParts(kind)
  const divider = parts.strokes[parts.divider]
  const width = glyphBox('bracketTop').advance
  const wings: SignWings[] = []
  // The ENDING half's tips: flaring LEFT off the divider's right edge, so their own right edge is
  // that edge — the mirrored family attaches by its right.
  if (signHasHalf(kind, 'end')) {
    wings.push({ flare: 'left', half: 'end', x: divider.x + divider.width - width })
  }
  // The OPENING half's: flaring RIGHT off the divider's left edge, which is where they attach.
  if (signHasHalf(kind, 'start')) {
    wings.push({ flare: 'right', half: 'start', x: divider.x })
  }
  return wings
}

/**
 * How far this sign's ink reaches either side of the boundary, in staff spaces — §6.2's one owner of
 * the number, for the hit-box, the room floor and the two width terms.
 */
export function barlineSignExtent(kind: BarlineSignKind): { left: number; right: number } {
  return barlineSignParts(kind).extent
}

/**
 * ⭐ **The sign this bar ends with, from THIS bar's own fields and nothing else** — what the WIDTH
 * asks, as against {@link signAtBoundary}, which is what the DRAWING asks.
 *
 * The two differ on purpose and only ever in the bar's favour. Room is owed by the measure that
 * stores the statement (§5.1, and it is what ONE OWNER PER LINE buys), so this may not read a
 * neighbour; the picture is decided by both bars, so `signAtBoundary` must. ⚠️ Where they disagree —
 * a `repeatEnd` whose neighbour opens a repeat, drawn as the back-to-back form — the drawn sign is
 * **narrower** on this side than an end repeat (one shared thick line, not two halves), so reserving
 * this bar's own sign always covers what is drawn. ⛔ Never the other way round: a bar that reserved
 * less than it draws would put ink through its own last note.
 */
export function ownEndSignKind(measure: Measure): BarlineSignKind {
  if (measure.repeatEnd !== undefined) return 'repeatEnd'
  if (measure.barline?.style === 'final') return 'final'
  // ⭐ `invisible` deliberately falls through to `plain`'s room, which is the same room: hiding a
  // line must not re-space the music around it. It is not even reachable as a distinct answer here
  // — the two kinds share their parts — and is left unwritten rather than spelled out as a case
  // that could drift from `barlineSignParts`.
  return 'plain'
}

/**
 * ⭐ **The gap between the last header glyph and a start repeat displaced past it**, in staff spaces.
 *
 * LilyPond's `TimeSignature.space-alist (staff-bar . (extra-space . 1.0))` — one staff space between
 * a time signature and a following bar line (its `Clef` says 0.7, its `KeySignature` 1.1; MuseScore's
 * `timesigBarlineDistance` is 0.5; Ross p. 147 measures from the glyph's LEFT and works out at ≈1.6
 * for Bravura's meter). It is also exactly half of `HEADER_TO_NOTE`, so the displaced sign lands with
 * one space either side of it.
 *
 * Read by the DRAWING (`BarlineRenderer.displacedRepeatX`) and by the WIDTH
 * (`MeasureLayout`, which must know how much of the bar stands before the sign) — which is why it
 * lives here, with the rest of the sign's geometry, and not in either of them.
 */
export const HEADER_TO_REPEAT = 1.0

/**
 * ⭐ **How much extra room this bar owes at its START, for a repeat it opens with** — §5.1's
 * "leading term", in staff spaces. Zero for every bar that does not open one.
 *
 * A start repeat is the one sign whose ink is inside the bar that BEGINS at the boundary, so unlike
 * the trailing side it falls in no gap the column model sums: `measureLeadIn` is the bar's first
 * column, and the sign stands before it. Both readers of the lead-in have to add this — the width
 * (`MeasureLayout`) and the drawing (`applyLeadIn`) — or the bar reserves room the notes never move
 * out of, or moves them without reserving it.
 *
 * ⚠️ It is the same number whether or not the bar draws a header. With no header the sign stands on
 * the boundary and grows right, so the notes start that much further in; with one it is displaced
 * past the clef (`BarlineRenderer.displacedRepeatX`) into the gap between header and music, which
 * has to grow by exactly as much. ⛔ Do not make it conditional on the header: the two cases need
 * the same room for different reasons, and the drawing already computes its own x from `noteStartX`.
 */
export function repeatStartRoom(measure: Measure): number {
  return measure.repeatStart === undefined ? 0 : barlineSignExtent('repeatStart').right
}
