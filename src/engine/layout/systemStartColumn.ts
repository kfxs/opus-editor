/**
 * ⭐⭐ **WHAT THE SIGNS AT A SYSTEM'S LEFT EDGE TAKE, AND WHERE EACH ONE SITS** — in staff spaces,
 * measured LEFTWARD from the staves' own left edge. P2 of docs/plans/braces-brackets-plan.md, and the one
 * genuinely new layout idea in the feature.
 *
 * ⭐⭐ **THERE IS NO CONSTANT TO COPY: NO ENGINE HAS A NESTING-INDENT CONSTANT.** Three codebases,
 * three routes to the same answer — LilyPond computes a **skyline**, Verovio advances **per symbol**,
 * MuseScore bakes the gap into **each bracket's own width** (research §2.1/§2.2/§2.3). ⇒ the indent
 * is **the sum of what the signs actually take**, which is what this module adds up.
 *
 * Structurally it is the below-staff LADDER turned ninety degrees
 * (`./outsideStaffBand`, `docs/how-it-works/above-staff-ladder.md`), and it keeps that module's shape: **pure,
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
 * the reason (`docs/how-it-works/pdf-export.md`'s audience rule, and `layout/pageBounds`): ink in the margin is
 * ink off the paper. ⇒ its consumer subtracts it from the content width — see the plan's P2, which
 * lists the four sites that must agree and the one (`ScoreHeaderPass`) that must not move.
 */
import type { Score } from '@/types/music'
import { groupsAt, type ResolvedStaffGroup } from '@/engine/models/staffGroups'
import { ENGRAVING_DEFAULTS } from '@/engine/fonts/bravuraMetrics'
import { glyphBox } from '@/engine/fonts/fontMetrics'
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

/**
 * ⭐⭐ **HOW THE BRACKET'S END IS BUILT — the ROD exceeds the staff line, and the WING caps it just
 * inside that.** Verovio's construction, **read from its source** and re-derived from OUR font.
 *
 * 🚨 **HIS CORRECTION, 2026-08-29**: *"are you just measuring the bracket in general? this makes no
 * sense, it depends on the distance between the staves. What you have to look is how much the WINGS
 * are from the top or bottom of the pentagram — that gives the answer. The problem is how much the
 * LINE of the bracket exceeds the limit."* ⛔ He is right: the bracket's total height is not a
 * quantity, it is the staff span. The two real numbers are **how far the rod passes the outer staff
 * line** and **how far out the wing then reaches**.
 *
 * ## 🚨 THE TREATISES MEASURED ONLY THE SUM
 *
 * research §3.3 gives the **total** ink projection past each outer staff line — Gould **0.99 / 1.05**,
 * Ross **0.90 / 1.04** — and ⛔ never splits it; §3.8 confirms no book states any of it in words. ⇒
 * **the split can only come from an engine**, and it is the split that decides what the end looks
 * like.
 *
 * ## ⭐⭐ VEROVIO'S SOURCE, verbatim (`src/view_page.cpp`, `View::DrawBracket`)
 *
 * ```cpp
 * const int offset = m_doc->GetDrawingStaffLineWidth(staffSize) / 2;          // ½ a staff line
 * const int bracketThickness = GetDrawingUnit(staffSize) * m_bracketThickness; // 1 unit = 0.5 sp
 *
 * DrawSmuflCode(dc, x1, y1 + offset + bracketThickness / 2, SMUFL_E003_bracketTop, …);
 * DrawFilledRectangle(dc, x1, y1 + 2 * offset + bracketThickness / 2, x2, …);
 * ```
 *
 * ⭐ **`bracketThickness / 2` — HALF THE ROD'S OWN THICKNESS**, so the rod's **corner** lands on the
 * staff line rather than its edge stopping short of it. 🚨 **This is the "plus half the stroke" I
 * took from MuseScore and then discarded as *"an engine's implementation detail, not a
 * measurement"*. It is not a MuseScore quirk — it is the shared rule of BOTH engines that draw this
 * sign**, and discarding it was the error.
 *
 * ⭐ **And the rod and the wing do NOT end together.** The wing's origin is `½ lineWidth + ½ rod`
 * above the line; the rod reaches `lineWidth + ½ rod`. So the wing sits **half a staff-line INSIDE**
 * the rod's end and overlaps its corner rather than perching on it — the detail the research summary
 * flattened into a single "0.325 sp" and the reason a wing stamped at the rod's tip looks stuck on.
 *
 * ## ⭐ DERIVED FROM OUR FONT, ⛔ not copied
 *
 * Verovio's `staffLineWidth` is 0.15 unit = 0.075 sp; **ours is Bravura's `staffLineThickness`,
 * 0.13**. So its literals (0.2875 / 0.325) are ⛔ not ours — the FORMULA is what transfers:
 *
 * | | formula | ours |
 * |---|---|---|
 * | wing origin above the line | `½ lineWidth + ½ rod` | 0.065 + 0.25 = **0.315 sp** |
 * | rod end above the line | `lineWidth + ½ rod` | 0.13 + 0.25 = **0.38 sp** |
 * | total ink (wing origin + 1.18) | | **≈1.50 sp** |
 *
 * ## 🚨 THE FOUR EARLIER ATTEMPTS, each wrong differently
 *
 * 1. ⛔ Natural wing, **no overshoot** (1.18) — the font's default, chosen by not choosing.
 * 2. ⛔ 0.25 overshoot from MuseScore — right rule, dismissed for the wrong reason (see above).
 * 3. ⛔ Gould's **1.75** wing, no overshoot (1.10) — **the smallest figure in the research**, so
 *    reaching for it made the thing he called short shorter still.
 * 4. ⛔ Ross's **2.3** wing, no overshoot (1.45) — right total, wrong construction: the largest wing
 *    in the research and no rod overshoot at all, the reverse of how it is drawn.
 *
 * ⭐ **The lesson: a composed measurement must be composed the way it is DRAWN.** Matching a total
 * while distributing it differently gives the same number and a different picture.
 */
export const BRACKET_ROD_PROJECTION_SPACES
  = ENGRAVING_DEFAULTS.staffLineThickness + BRACKET_DEPTH_SPACES / 2

/**
 * ⭐ **How far INSIDE the rod's end the wing is stamped** — half a staff line, so it overlaps the
 * corner. Verovio's `offset`, and the difference between its two y expressions above.
 */
export const BRACKET_SERIF_INSET_SPACES = ENGRAVING_DEFAULTS.staffLineThickness / 2

/** ⭐ **The wing at the font's NATURAL size** — Verovio stamps this glyph unscaled, and the overshoot
 *  above is measured against it. ⛔ Not scaled to a treatise's tip width: that was attempts 3 and 4,
 *  and it changes the height the rest of the construction is built around. */
export const BRACKET_SERIF_WIDTH_SPACES = 1.876

/**
 * ⭐⭐ **THE GAP BETWEEN A SIGN AND THE SYSTEMIC BARLINE — 0.45 sp, and it has its OWN source.**
 *
 * 🚨 **His report, 2026-08-29**: *"the space between the bracket and the beginning of the staff is
 * too short too"*. It was **0.40** — {@link SIGN_SEPARATION_SPACES}, Bravura's `barlineSeparation`,
 * which is a **barline-to-barline** number borrowed for a job the research answers directly. ⛔ Two
 * different distances should not share one constant just because they were close.
 *
 * | | value | source |
 * |---|---|---|
 * | Gould / Ross | **0.35 – 0.45 sp** | research §3.3, **measured** off the plates |
 * | MuseScore `bracketDistance` | **0.45** | §2.1 style defaults |
 * | Verovio | 0.50 (1 unit) | §2.3 |
 * | ⛔ ours, before | 0.40 | Bravura's `barlineSeparation` — the wrong table |
 *
 * ⭐ **0.45 is the top of the measured range AND MuseScore's own named constant** — two independent
 * sources on one number, which is as good as this question gets. ⏳ Verovio's **0.50** is the ceiling
 * with a source behind it; ⛔ past that there is none.
 *
 * ⚠️ The BRACE keeps its own measured clearance (§3.4: **0.24–0.49 sp**, and MuseScore's
 * `akkoladeBarDistance` is 0.35) — ⏭️ it is inside this range, so the two share a number today; the
 * day his eye splits them, that is a second row here and not a fudge to this one.
 */
export const SIGN_TO_BARLINE_SPACES = 0.45

/**
 * ⭐⭐ **THE SUB-BRACKET — a hairline `[`, ⛔ NOT a thinner rod.**
 *
 * The thin secondary sign grouping a subset inside a bracket — divisi strings under the section's
 * own bracket. P6 of docs/plans/braces-brackets-plan.md.
 *
 * | | value | source |
 * |---|---|---|
 * | **width** | **0.60 sp** | Gould, measured (research §3.3) — ⏳ Verovio uses 0.5 |
 * | **vertical stroke** | **0.10 sp** | Gould measured, **and Verovio's `subBracketThickness` default of 0.20 unit = 0.10 sp exactly** |
 * | arm thickness | a staff line's | Verovio draws the arms at `staffLineWidth` (`View::DrawSquareBracket`) |
 * | serifs | ⛔ **none** | measured; the arms ARE the terminals |
 *
 * 🚨 **A FOUR-WAY DISAGREEMENT, and the font loses.** Gould **0.10** + all three engines
 * (**0.10–0.11**) against **Ross 0.63** (his *"second bracket"*, full thickness — identical to his
 * main one) and against **Bravura's own `subBracketThickness` 0.16**. ⭐ Four drawings against one
 * sentence and one font default: this repo takes the drawings
 * ([[reference_behind_bars_full_text]]'s *the scan beats the sentence*).
 *
 * ⚠️ **Gould's p. 509 Table 2 could NOT re-confirm the weight, and that is an honest limit:** it is a
 * miniature schematic at **9.0 px per staff space** at 450 dpi, so a 0.10 sp stroke is under one
 * pixel. ⭐ What the plate DOES confirm is the SHAPE — a thin `[` with square ends and **no serifs**,
 * its open side abutting the main bracket, which is why it reads as a closed rectangle.
 *
 * ⛔ **The term *"sub-brace"* appears in no source** — there is no thin brace.
 */
export const SUB_BRACKET_WIDTH_SPACES = 0.60
/** Its vertical stroke — Gould measured, = Verovio's own default. ⛔ Not Bravura's 0.16. */
export const SUB_BRACKET_STROKE_SPACES = 0.10

/** How deep one sign's ink is, in staff spaces. ⭐ A total over `StaffGroup['symbol']` — a new
 *  member of that union is a row HERE, not a `default` somewhere. */
const DEPTH_SPACES: Record<ResolvedStaffGroup['symbol'], number> = {
  brace: BRACE_DEPTH_SPACES,
  bracket: BRACKET_DEPTH_SPACES,
  subBracket: SUB_BRACKET_WIDTH_SPACES,
}

/**
 * ⭐⭐ **HOW FAR A SIGN'S INK REACHES PAST EACH OUTER STAFF LINE**, in staff spaces.
 *
 * 🚨 **His report, 2026-08-29**: *"in the brace the squares are good in position, but in the brackets
 * the squares vertically are too close."* ⭐ Dead right, and the cause is that the sign's registered
 * box was its **SPAN** (staff line to staff line) rather than its **INK** — so a handle hanging
 * 10 px off the box sat *inside* a bracket's serif, which reaches ~1.5 sp further out. A brace is
 * FLUSH, which is exactly why its squares looked right.
 *
 * ⭐ It fixes the HIT-BOX too, and that was the same bug wearing another hat: a press on a bracket's
 * serif was outside the box and selected nothing.
 *
 * ⚠️ A total over `StaffGroup['symbol']` — a new sign is a row HERE. ⛔ Never a single constant: the
 * three signs genuinely differ, and that difference is the whole content of this table.
 */
export function signOutwardReachSpaces(symbol: ResolvedStaffGroup['symbol']): number {
  switch (symbol) {
    // ⭐ FLUSH — top staff-line to bottom staff-line, no overshoot (Ross p. 155, measured in all six
    //   of Gould's examples; MuseScore and LilyPond both give it zero).
    case 'brace': return 0
    // The rod passes the line, the wing is stamped a little INSIDE that end, and its own box rises
    // from there — `rendering/staff/systemStart.drawBracket` composes exactly these three.
    case 'bracket':
      return BRACKET_ROD_PROJECTION_SPACES - BRACKET_SERIF_INSET_SPACES + glyphBox('bracketTop').up
    // Its arms sit ON the outer lines and are a staff line thick, so it reaches out by half of one.
    case 'subBracket': return ENGRAVING_DEFAULTS.staffLineThickness / 2
  }
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
  // 🚨🚨 **THE ORDER IS OUTERMOST-FIRST, AND GETTING IT BACKWARDS IS THE EASY MISTAKE.**
  //
  // ⭐⭐ *THE SMALLER THE GROUP, THE FURTHER LEFT ITS SIGN* — research §3.2, and the layout it draws
  // reads left-to-right as:
  //
  //     [innermost group's sign] [outer group's sign] [section bracket] [systemic barline = staves]
  //
  // Measured in Gould p. 509/518, Ross pp. 155–6 and Stone p. 6; LilyPond states it outright (*"a
  // piano context included within a staff group should cause the piano brace to be drawn to the left
  // of the staff angle bracket"*) and Verovio agrees. ⛔ MuseScore is the odd one out. ⭐ Gould p. 516
  // adds the corollary: *"A brace should only ever be used as the OUTERMOST bracket."*
  //
  // ⚠️ `groupsAt` hands them **innermost-first**, so the walk runs the list backwards.
  //
  // ## ⭐⭐ AND IT IS A SKYLINE, ⛔ NOT FIXED COLUMNS
  //
  // 🚨 **His report, 2026-08-29** (screenshot): a bracket on staff 1 and a brace on staff 2 — two
  // INDEPENDENT one-staff groups — drew at **different x's**. *"The brace somehow is displacing the
  // position of the bracket but there is no reason for this… both are independent, applied to
  // independent groups."* ⛔ Dead right: a sign only has to clear signs it could COLLIDE with, and
  // two signs on disjoint staves never touch.
  //
  // ⭐ The research named this before it was built — §2.2 on LilyPond: *"Stacking is a SKYLINE, not
  // fixed columns (`side-position-interface.cc:263-322`), so **vertically disjoint signs can share
  // an x**."* So each sign clears only the placed signs whose STAFF SPAN overlaps its own; where
  // nothing overlaps, it sits against the barline like a first sign.
  const outermostFirst = [...groups].reverse()
  const placed = new Map<ResolvedStaffGroup, PlacedSystemStartSign>()
  for (const group of outermostFirst) {
    const depthSpaces = DEPTH_SPACES[group.symbol]
    // The left edge of everything already placed that shares a staff with this sign — 0 when
    // nothing does, which puts it against the systemic barline.
    let edge = 0
    let blocked = false
    for (const [other, sign] of placed) {
      if (other.bottomStaffIndex < group.topStaffIndex || other.topStaffIndex > group.bottomStaffIndex) continue
      blocked = true
      edge = Math.max(edge, sign.leftSpaces)
    }
    // ⭐ The sign next to the staves clears the systemic BARLINE — a distance the treatises measured
    //   ({@link SIGN_TO_BARLINE_SPACES}). One stacked outside another clears that one instead, for
    //   which there is no measurement anywhere ({@link SIGN_SEPARATION_SPACES}).
    const gap = blocked ? SIGN_SEPARATION_SPACES : SIGN_TO_BARLINE_SPACES
    placed.set(group, { group, leftSpaces: edge + gap + depthSpaces, depthSpaces })
  }
  // ⭐ Returned in the order they arrived — innermost first — so a caller that walks `signs` sees the
  //   same ordering `groupsAt` promised. Only the POSITIONS were computed outward-in.
  const signs = groups.map(g => placed.get(g)!)
  // ⭐ `edge` is the outermost sign's left edge, and 0 when nothing was placed — so the "no groups
  //   indent by zero" case falls out of the walk rather than being a guard of its own.
  return {
    signs,
    // ⭐⭐ **…and ONE MORE SEPARATION, so the outermost sign stands as clear of the MARGIN as every
    //   sign stands of its neighbour.** 🚨 His report, 2026-08-29: *"brackets are almost touching the
    //   border"* — measured at **0.00 sp** from the page margin, because the indent was exactly the
    //   signs' reach and no more. ⭐ This is not a new constant, it is **this walk's own rule applied
    //   to its own outer edge**: every sign is placed `SIGN_SEPARATION_SPACES` clear of whatever
    //   stands beside it — the barline for the innermost, the previous sign for the rest — and the
    //   thing beside the OUTERMOST one is the margin. ⛔ The treatises say nothing about it (research
    //   §3.8: *nothing anywhere on how an indented first system affects bracket geometry*, two
    //   independent searches), so a number invented for it would have no source; this one has the
    //   module's.
    // ⚠️ Zero when nothing was placed, so a score with no sign still indents by exactly nothing.
    //    ⭐ The WIDEST reach of any sign, not the last one placed — with a skyline the outermost sign
    //    is no longer necessarily the one furthest left.
    indentSpaces: signs.length > 0
      ? Math.max(...signs.map(s => s.leftSpaces)) + SIGN_SEPARATION_SPACES
      : 0,
  }
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
 * P2 of docs/plans/braces-brackets-plan.md exists to draw. The paper does not shrink when a brace is
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
 * move and nothing is pushed off the paper (`docs/how-it-works/pdf-export.md`'s audience rule, `layout/pageBounds`).
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
