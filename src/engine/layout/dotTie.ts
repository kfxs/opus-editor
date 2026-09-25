/**
 * ⭐⭐ **A DOTTED NOTE TIED — does the tie start before the dot or after it: a TABLE OF RULES**
 * (docs/plans/multiple-dots-plan.md R7, P4g).
 *
 * ## The books split
 *
 * - **Gould** p. 63: *"Place the dot within the tie – the tie does not follow the dot. Curve the tie
 *   sufficiently to avoid obscuring the dot"* (chords, p. 64: ties may start between the dots when they fit).
 * - **Gerou & Lusk** p. 22: *"Ties always avoid the dot – place the tie clearly to the right of the dot."*
 * - **Ross** p. 139 allows either — *"either slightly raising or lowering the dots, or … starting the ties
 *   after the dots"* — so he has no row of his own.
 *
 * ## What we drew until 2026-09-25 — which IS the `gould` row
 *
 * The tie springs from inside the head (`rendering/curves/tieEndpoints`, a quarter space in from its centre)
 * and bows AWAY from the stem, 0.20 sp off the head — measured in the browser (P3, P4g): a stem-up note's tie
 * runs under its dots; a stem-DOWN note on a line bows up OVER its lifted dot with ≈0.31 sp to spare. The dot
 * sits inside the arc, clear of it. His call (R7): presets, `gould` the default — so the default moves nothing.
 *
 * ⚠️ Not a width — ⚠️ but a re-arm must re-engrave, so its generation is in `layout/widthRowGenerations` (the
 * SHAPE key), as `layout/dotVoice`'s is.
 */

/** One rule: where a dotted note's tie starts — `null` = inside the head, as any tie; a number = past the LAST
 *  dot, by that white (staff spaces). */
export interface DotTieRule {
  afterDots: number | null
  source: string
}

export const DOT_TIE_RULES = {
  /** ✅ **ARMED — Gould** p. 63: the dot inside the tie. What we draw. */
  gould: { afterDots: null, source: 'Gould p. 63 — the dot within the tie; what we draw' },
  /**
   * **Gerou & Lusk** p. 22 (and p. 144, *"Begin the tie to the right of an augmentation dot"*): the tie after
   * the dot. ⚠️ **The white is UNKNOWN** — both figures (measured 2026-09-25, 450 dpi) draw NO dot, only two
   * tied whole notes and an arrow; their tie starts ≈0.9 head-heights (≈0.9 sp) past the head, which is where
   * a dot half a space off would END. ⇒ 0 white past the dot is THAT reading, ⛔ not a measurement — a number
   * his eye can move (CLAUDE.md: a number never blocks).
   */
  gerouLusk: { afterDots: 0, source: 'Gerou & Lusk pp. 22 + 144 — the tie after the dot (their white UNKNOWN: no dot drawn)' },
} as const satisfies Record<string, DotTieRule>

export type DotTieRuleName = keyof typeof DOT_TIE_RULES

/** ✅ What is armed — `gould` (his rule, 2026-09-25). */
export const ACTIVE_DOT_TIE_RULE: DotTieRuleName = 'gould'

const state: { rule: DotTieRuleName; generation: number } = { rule: ACTIVE_DOT_TIE_RULE, generation: 0 }

export function armedDotTie(): DotTieRule {
  return DOT_TIE_RULES[state.rule]
}
export function dotTieSettings(): { rule: DotTieRuleName; generation: number } {
  return { ...state }
}
export function dotTieGeneration(): number {
  return state.generation
}
export function setDotTieRule(rule: DotTieRuleName): boolean {
  if (!(rule in DOT_TIE_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}
export function resetDotTieRule(): void {
  state.rule = ACTIVE_DOT_TIE_RULE
  state.generation++
}
