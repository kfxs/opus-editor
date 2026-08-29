/**
 * ⭐⭐ **WHAT THE SIGNS AT A SYSTEM'S LEFT EDGE TAKE, AND WHERE EACH ONE SITS** — in staff spaces,
 * measured LEFTWARD from the staves' own left edge. P2 of docs/braces-brackets-plan.md, and the one
 * genuinely new layout idea in the feature.
 *
 * ⭐⭐ **THERE IS NO CONSTANT TO COPY: NO ENGINE HAS A NESTING-INDENT CONSTANT.** Three codebases,
 * three routes to the same answer — LilyPond computes a **skyline**, Verovio advances **per symbol**,
 * MuseScore bakes the gap into **each bracket's own width** (research §2.1/§2.2/§2.3). ⇒ the indent
 * is **the sum of what the signs actually take**, which is what this module adds up.
 *
 * Structurally it is the below-staff LADDER turned ninety degrees
 * (`./outsideStaffBand`, `docs/above-staff-ladder.md`), and it keeps that module's shape: **pure,
 * ordered, unit-testable**, with ⛔ **no priority-number table** — the ORDER is the order the signs
 * come in, and `models/staffGroups.groupsAt` has already put them innermost-first.
 *
 * ## The axis, because mixing them is what this kind of module gets wrong
 *
 * **x = 0 is the SYSTEMIC BARLINE**, i.e. the staves' left edge, and everything here is a
 * **positive distance LEFT of it** in staff spaces. ⛔ Not pixels: a pixel x is in one system's
 * coordinates and is scaled by its staff's size, while these distances are the same on every system
 * of the score. The caller multiplies once, at the point it draws.
 *
 * ## ⛔ Never into the margin
 *
 * The indent this returns is room the SYSTEM gives up, ⛔ not room borrowed from the page. Print is
 * the reason (`docs/pdf-export.md`'s audience rule, and `layout/pageBounds`): ink in the margin is
 * ink off the paper. ⇒ its consumer subtracts it from the content width — see the plan's P2, which
 * lists the four sites that must agree and the one (`ScoreHeaderPass`) that must not move.
 */
import type { Score } from '@/types/music'
import { groupsAt, type ResolvedStaffGroup } from '@/engine/models/staffGroups'
import { ENGRAVING_DEFAULTS } from '@/engine/fonts/bravuraMetrics'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { SurfaceMetrics } from './surface'

/**
 * ⭐⭐ **THE BRACE'S DEPTH, AND IT IS CONSTANT — ⛔ it does NOT widen with height.**
 *
 * **0.89 sp**, measured off Gould p. 331 Table 1: her engraved braces are **0.89 / 0.89 / 0.84** for
 * 2 / 3 / 4 staves — flat, where a proportional scale would have widened the four-staff one by half
 * again. 0.89 is her mode and her two-staff figure, which is the case that exists today.
 *
 * ⭐⭐ **FOUR independent confirmations** (research §3.4): Gould measured · Ross states it (*flush,
 * top staff-line to bottom staff-line*) · Verovio hard-codes a flat 1.0 sp · **Finale draws exactly
 * 1.00 sp across 99 real files, with no per-group width field to vary it.** ⛔ Against: only
 * MuseScore's `magx` and LilyPond's 576-glyph ladder, the two that widen.
 *
 * 🚨 **SMuFL says the opposite** — a brace *"should be scaled proportionally (i.e. in both
 * dimensions, not only in the vertical dimension)"* — **and her engraving does not.** ⭐ The scan
 * beats the sentence, for the fourth time in this repo.
 *
 * ⏳ Between Gould's 0.89 and Finale/Verovio's 1.00 there is 0.11 sp of taste; this takes the
 * measured one. It is one number in one place if his eye disagrees.
 */
export const BRACE_DEPTH_SPACES = 0.89

/**
 * **The bracket's rod, 0.50 sp** — *stated identically* by Gould p. 516 + p. 21 and Ross p. 155, and
 * it is Bravura's own `bracketThickness`, so it is read from the font rather than written twice.
 *
 * ⭐ **The serifs cost nothing here.** They hook **RIGHT**, over the systemic barline (up-right at
 * the top, down-right at the bottom), so the bracket's ink crosses the line it stands beside — the
 * room it needs on the LEFT is the **rod's**, not the tip's.
 */
export const BRACKET_DEPTH_SPACES = ENGRAVING_DEFAULTS.bracketThickness

/**
 * ⭐ **The air between a sign and what stands to its right** — the systemic barline for the innermost
 * sign, the previous sign for every one after it.
 *
 * **0.40 sp**, and ⛔ not invented: the treatises measure **0.35–0.45 sp** between a bracket and the
 * systemic barline (research §3.3), and Bravura's `barlineSeparation` — the font's own answer to
 * *"how far apart are two vertical marks"* — is **0.40**, which sits in the middle of that range.
 * ⭐ Taking the font's number rather than the midpoint of ours means one source, not two.
 *
 * ⚠️ The treatises say nothing about the gap between two NESTED signs (research §3.8: checked, and
 * genuinely absent — no engine has a constant for it either). The same 0.40 is used, because *"the
 * indent is the sum of what the signs take"* needs a gap and this is the only sourced one we have.
 * ⏭️ If his eye wants nested signs closer or wider apart, it is this constant.
 */
export const SIGN_SEPARATION_SPACES = ENGRAVING_DEFAULTS.barlineSeparation

/** How deep one sign's ink is, in staff spaces. ⭐ A total over `StaffGroup['symbol']` — a new
 *  member of that union is a row HERE, not a `default` somewhere. */
const DEPTH_SPACES: Record<ResolvedStaffGroup['symbol'], number> = {
  brace: BRACE_DEPTH_SPACES,
  bracket: BRACKET_DEPTH_SPACES,
}

/** One sign, placed. All distances are staff spaces LEFT of the staves' edge — see the header. */
export interface PlacedSystemStartSign {
  group: ResolvedStaffGroup
  /** Distance from the staves' left edge to this sign's own LEFT edge. */
  leftSpaces: number
  /** How deep the sign's ink is. `leftSpaces - depthSpaces` is its right edge. */
  depthSpaces: number
}

export interface SystemStartColumn {
  /** Innermost first — the order they were handed in, which is the order they are drawn. */
  signs: PlacedSystemStartSign[]
  /**
   * ⭐ **What the system must give up on the left**, in staff spaces: the outermost sign's left edge.
   * **Zero when there are no signs**, which is what keeps every score without an authored `symbol`
   * exactly where it is.
   */
  indentSpaces: number
}

/**
 * **Lay out a system's left-edge signs**, innermost first.
 *
 * @param groups from `models/staffGroups.groupsAt` — already ordered and already gated on `symbol`.
 */
export function systemStartColumn(groups: readonly ResolvedStaffGroup[]): SystemStartColumn {
  const signs: PlacedSystemStartSign[] = []
  // Walk outward. `edge` is the left edge of everything placed so far — the systemic barline's own
  // position (0) before the first sign, and each sign's left edge after it.
  let edge = 0
  for (const group of groups) {
    const depthSpaces = DEPTH_SPACES[group.symbol]
    const leftSpaces = edge + SIGN_SEPARATION_SPACES + depthSpaces
    signs.push({ group, leftSpaces, depthSpaces })
    edge = leftSpaces
  }
  // ⭐ `edge` is the outermost sign's left edge, and 0 when nothing was placed — so the "no groups
  //   indent by zero" case falls out of the walk rather than being a guard of its own.
  return { signs, indentSpaces: edge }
}

/**
 * ⭐⭐ **THE SCORE'S INDENT — the widest left edge any bar asks for, in staff spaces.**
 *
 * ## 🚨🚨 WHY THE MAXIMUM, AND NOT "THE INDENT OF EACH SYSTEM"
 *
 * The obvious reading of a positional grouping is *"each system indents by its own signs"*. ⛔ **That
 * is CIRCULAR and cannot be computed**: the indent shrinks the width the casting-off gets, the
 * casting-off decides which bars OPEN systems, and which bars open systems is what would decide the
 * indent. A layout cannot depend on its own output.
 *
 * ⭐ So the question is asked of **every bar in the score**, not of the system openings — a set that
 * exists before any casting-off — and the widest answer wins. It is an upper bound, so no system can
 * ever want more room than it was given.
 *
 * ⭐ **And it is the right picture anyway**: the systems of a score share one left edge. A score
 * whose grouping changes at bar 40 does not step its staves sideways there — the signs differ, the
 * margin does not.
 *
 * ⚠️ Today `groupsAt` answers the same at every bar, so this loop has one distinct answer. It is
 * written as a loop regardless: the day a group carries a measure range, ⛔ **nothing here changes**,
 * which is the whole point of asking per bar (`models/staffGroups`' header).
 */
export function scoreSystemStartIndentSpaces(score: Score): number {
  // The bar-less call covers a score with no measures, and is the answer for every bar today.
  let widest = systemStartColumn(groupsAt(score)).indentSpaces
  for (const measure of score.measures) {
    widest = Math.max(widest, systemStartColumn(groupsAt(score, measure.number)).indentSpaces)
  }
  return widest
}

/**
 * ⛔ **NOT scaled by staff size.** A staff drawn at 0.7 gets smaller ink; the signs at a system's
 * left edge do not, for `systemStart.drawSystemConnector`'s reason — *a system bracket belongs to
 * the SYSTEM, not to either staff's ink* — and because one sign may span staves of two different
 * sizes, so there is no staff whose scale it could take.
 */
export function scoreSystemStartIndentPx(score: Score): number {
  return scoreSystemStartIndentSpaces(score) * STAFF_SPACE_PX
}

/**
 * ⭐⭐ **THE MUSIC'S SURFACE — the page, minus what the left-edge signs took.**
 *
 * ⛔ **This is not the PAGE's surface and the two must not be confused**, which is the distinction
 * P2 of docs/braces-brackets-plan.md exists to draw. The paper does not shrink when a brace is
 * added; what shrinks is the room the *music* is cast off into.
 *
 * | reads the PAGE (raw) | reads the MUSIC (this) |
 * |---|---|
 * | `pageCastOff` · `pageOriginPx` · `surfaceSizePx` — where the sheets are | `MeasureLayout`'s `availableWidth` — casting-off AND justification |
 * | `ScoreHeaderPass` — ⛔ **the title centres on the PAGE**, and a brace must not move it | `lineLeftPx` — where a system's first bar starts |
 * | | `layout/barWidthRoom`'s `lineTotal` — or the derived view disagrees with the layout it describes |
 *
 * ⚠️ ⛔ **Never into the margin.** The indent is room the system gives up, not room borrowed from
 * the page: `marginLeftPx` grows by exactly what `contentWidthPx` loses, so the right edge does not
 * move and nothing is pushed off the paper (`docs/pdf-export.md`'s audience rule, `layout/pageBounds`).
 */
export function musicSurface(surface: SurfaceMetrics, score: Score): SurfaceMetrics {
  const indentPx = scoreSystemStartIndentPx(score)
  if (indentPx === 0) return surface // ⭐ byte-identical for every score with no authored sign.
  return {
    ...surface,
    marginLeftPx: surface.marginLeftPx + indentPx,
    contentWidthPx: surface.contentWidthPx - indentPx,
  }
}
