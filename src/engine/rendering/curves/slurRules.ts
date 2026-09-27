/**
 * ⭐ **THE ARMED ROWS of the slur compromise** (docs/plans/slur-search-plan.md P8) — the renderer's side of
 * `engrave/curves/slurSearch/searchDetails.SlurSearchRules`: which choice each row has now, set from the
 * console (`__slur.rule(…)`, `dev/slurShapeConsole`), read by the search wherever it runs
 * (`./slurLilypondSolver`, whole slurs and broken pieces).
 *
 * ⛔ `engine/` may not import `dev/`, so the setting lives HERE — the shape of `./slurSolvers`. ⭐ Its
 * generation is in the render's VIEW key (`./slurSolvers.slurViewGeneration`): a row is a picture change with
 * no model change.
 */
import {
  LILYPOND_SLUR_RULES, SLUR_RULE_CHOICES, type SlurSearchRules,
} from '@/engine/engrave/curves/slurSearch/searchDetails'

const state = { rules: { ...LILYPOND_SLUR_RULES } as SlurSearchRules, generation: 0 }

/** The rows as armed now — a fresh copy, so a caller cannot change them behind the generation's back. */
export function slurRules(): SlurSearchRules {
  return { ...state.rules }
}

/** Arm one row. ⛔ An unknown row or choice is refused, not ignored. */
export function setSlurRule(row: string, choice: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(SLUR_RULE_CHOICES, row)) return false
  const key = row as keyof SlurSearchRules
  if (!(SLUR_RULE_CHOICES[key] as readonly string[]).includes(choice)) return false
  state.rules = { ...state.rules, [key]: choice as SlurSearchRules[typeof key] }
  state.generation++
  return true
}

/** Every row back to LilyPond's own choice. */
export function resetSlurRules(): void {
  state.rules = { ...LILYPOND_SLUR_RULES }
  state.generation++
}

/** ⚠️ In the render's view key, through `./slurSolvers.slurViewGeneration`. */
export function slurRulesGeneration(): number {
  return state.generation
}
