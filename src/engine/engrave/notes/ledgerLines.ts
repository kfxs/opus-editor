/**
 * ⭐⭐ **THE LEDGER LINE — the first piece of a NOTE that is ours** (`docs/plans/own-engraving-engine.md`
 * P3, `docs/plans/note-engraving-plan.md` P3a).
 *
 * ## Why this one first
 *
 * P3 is *"the note"*, and the note is the largest single item in the plan. It is taken one piece of
 * ink at a time, and the ledger line is the piece that was already **owned three times over**:
 *
 * | who drew it | for what |
 * |---|---|
 * | `StaveNote.drawLedgerLines` (VexFlow) | every real note |
 * | `FanPass.drawFanLedgerLines` | a fanned member's hand-drawn head — *"`drawLedgerLines` belongs to `StaveNote`; a bare `NoteHead` only swaps to the ledger glyph"* |
 * | `ScoreRenderer.drawRestLedgerLines` | a rest a manual shift pushed off the staff |
 *
 * 🚨 That is `docs/plans/own-engraving-engine.md` §3.1's *"the second owner is the tell"*, found three
 * times in one element: **a rule with no home, copied because there was no module to import.** The
 * two copies were written from VexFlow's source and say so in their comments.
 *
 * ⭐ And it is ink with no font in it — two points and a stroke — so its whole rule is arithmetic,
 * its spec runs in jsdom, and the moment it draws through a {@link DrawContext} it becomes visible
 * to the SCENE. That is the migration's progress bar moving: *"the scene's coverage and the
 * migration's progress are one measurement"*.
 *
 * ## ⭐ The rule, as the books state it — Gould pp. 26–27
 *
 * - *"Ledger lines are an extension of the stave. They are spaced the same distance apart as
 *   stave-lines, but they are **about twice as thick**… so that a player reading a passage of
 *   ledger-line notes can take in the number of ledger lines at a glance."* ⭐⭐ **That is why a
 *   ledger line does NOT join the thin-line family** (`rendering/thinLineWeight`): it is
 *   deliberately heavier than a staff line, and the family is one weight for everything else.
 *   🚨 **But how much heavier is an OPEN disagreement, and P3a did not touch it**: this editor
 *   already decided the weight — `layoutConfig.LEDGER_LINE_STYLE`, black, at Bravura's own
 *   `legerLineThickness / staffLineThickness` **ratio (1.23×)**, pinned by
 *   `rendering/ledgerLineStyle.test.ts` — and Gould's sentence says **2×**. ⛔ Not this module's
 *   call, and ⛔ not a drift to "fix": see `docs/plans/note-engraving-plan.md` §3.
 * - *"The ledger line extends slightly beyond either side of the notehead and is just over two
 *   spaces long."* ⚠️ Ours is a notehead (1.18) + 2 × 0.3 = **1.78 spaces**, because the overhang is
 *   VexFlow's 3 px. The font's own `legerLineExtension` (0.4) would make it 1.98 — *"just over two
 *   spaces"* — and that is already **open taste call #5** awaiting his eye
 *   (`docs/plans/font-metrics-plan.md` §3.6, recorded in `layout/spacingPadding.font.test.ts`).
 *   ⛔ **Not decided here.** This module changed no pixel.
 * - *"Ledger lines of adjacent notes should not join up; the lines may be slightly shortened in
 *   cramped conditions."* ⏭️ The horizontal half of that is already the ink table's
 *   (`INK.ledgerLeft`/`ledgerRight` and the `note↔ledger` padding row); the **shortening** half is
 *   `rendering/ledgerAccidentalClearance`, which is the one case we shorten for today.
 * - *"When the displaced note is on a line, the ledger line extends the full width of both notes;
 *   when the displaced note is in a space, the last ledger line is shortened to single notehead
 *   width."* ⭐ {@link ledgerLineRuns} states that as one sentence — **a run reaches from the
 *   leftmost head that reaches its level to the rightmost** — which is the same answer VexFlow
 *   computes with a `doubleWidth` special case, and the same one `drawFanLedgerLines` reached
 *   independently. The three agree to the pixel; see the spec.
 *
 * ⛔ **What is NOT here yet**, so nobody reads its absence as a decision: Gould p. 27's
 * *"the two parts may share ledger lines"* — two voices at the same level draw one ledger between
 * them, and a ledger not shared *"should not cut through"* the nearer part's stem. Every voice
 * draws its own today. `docs/plans/note-engraving-plan.md` §4 holds it.
 *
 * ## ⚠️ Where the numbers come FROM
 *
 * ⛔ Nothing in this module. It takes the head width, the overhang and the weight as parameters,
 * because its three callers measure them differently (a real note asks its own glyph, a fan member
 * asks the note it hangs off, a rest ledger spans the rest glyph). ⭐ That is what keeps it a RULE
 * rather than a fourth owner of a constant.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'

/** One notehead, as a ledger line cares about it: which staff line it sits on, and its LEFT edge. */
export interface LedgerHead {
  /** VexFlow's line numbering — 1…5 are the staff's own lines, ≥ 6 above it, ≤ 0 below. */
  line: number
  /** The head's own left edge in the space it is drawn in. ⚠️ A DISPLACED head has its own x. */
  x: number
}

/** One ledger line: the level it lies on, and the two ends of the stroke. */
export interface LedgerLineRun {
  line: number
  x1: number
  x2: number
}

/**
 * How a ledger line is inked. ⚠️ The caller's, not ours — see the header. Only the three properties
 * a ledger actually uses; a shadow or a dash would need a reason (`paint/DrawContext`'s rule 4).
 */
export interface LedgerLineStyle {
  fillStyle?: string
  strokeStyle?: string
  lineWidth?: number
}

/**
 * ⭐ **THE RULE.** Which ledger lines a set of heads forces, and how far each one runs.
 *
 * Levels come in whole staff lines from 6 upward and 0 downward — the staff occupies 1…5, so a head
 * at line 7 needs lines 6 and 7, and a head *in a space* (7.5) hangs off the last whole line below
 * it. Each run reaches from the **leftmost head that reaches that level** to the **rightmost**,
 * plus `overhang` at both ends: one sentence covering the single head, the second-interval chord
 * whose displaced head shares the level (Gould's *"the full width of both notes"*), and the chord
 * whose outermost head stands alone up there (*"shortened to single notehead width"*).
 *
 * Empty for anything inside the staff, which is nearly every note.
 */
export function ledgerLineRuns(
  heads: readonly LedgerHead[],
  /** The width of one notehead — what a run spans past its rightmost head's left edge. */
  headWidth: number,
  /** How far the line runs past the heads at each end. */
  overhang: number,
): LedgerLineRun[] {
  if (heads.length === 0) return []
  const highest = Math.max(...heads.map(h => h.line))
  const lowest = Math.min(...heads.map(h => h.line))
  if (highest < 6 && lowest > 0) return []

  const runs: LedgerLineRun[] = []
  const run = (line: number, reaching: readonly LedgerHead[]): void => {
    const xs = reaching.map(h => h.x)
    runs.push({
      line,
      x1: Math.min(...xs) - overhang,
      x2: Math.max(...xs) + headWidth + overhang,
    })
  }
  for (let line = 6; line <= highest; line++) run(line, heads.filter(h => h.line >= line))
  for (let line = 0; line >= lowest; line--) run(line, heads.filter(h => h.line <= line))
  return runs
}

/**
 * ⭐ **THE INK** — and it is the whole of what a ledger line is: a stroked two-point path per run.
 *
 * `yOfLine` is the caller's staff, asked rather than computed: ⛔ rule 5 of
 * `docs/plans/own-engraving-engine.md` §0.3 — *"no inverse mapping written as straight-staff arithmetic"*
 * — cuts both ways, and a module that turned a line number into a y by multiplying would be the
 * reader that assumes the staff is straight.
 *
 * ⚠️ `save`/`restore` are still no-ops for style in VexFlow's SVG context (one of P1's four standing
 * gotchas, open until P1e). They are called anyway, in the same order VexFlow's own ledger drawing
 * called them, so the intent is in the code and the recorded scene is right about which style each
 * stroke carried.
 */
export function drawLedgerLines(
  ctx: DrawContext,
  runs: readonly LedgerLineRun[],
  yOfLine: (line: number) => number,
  style: LedgerLineStyle,
): void {
  if (runs.length === 0) return
  ctx.save()
  // ⚠️ Exactly VexFlow's `Element.applyStyle` order and its `if (…)` guards, so a style that omits a
  // property leaves the context's own alone rather than resetting it to a default of ours.
  if (style.fillStyle) ctx.setFillStyle(style.fillStyle)
  if (style.strokeStyle) ctx.setStrokeStyle(style.strokeStyle)
  if (style.lineWidth) ctx.setLineWidth(style.lineWidth)
  for (const run of runs) {
    const y = yOfLine(run.line)
    ctx.beginPath()
    ctx.moveTo(run.x1, y)
    ctx.lineTo(run.x2, y)
    ctx.stroke()
  }
  ctx.restore()
}
