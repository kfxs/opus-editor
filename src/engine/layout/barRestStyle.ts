/**
 * ⭐ **Which GLYPH a whole-bar rest is drawn with** — a house-style ROW (docs/plans/other-durations-plan.md
 * §1 c, his call 2026-09-26: *"lets do the convention then as default but lets make it also custom"*).
 *
 * The research is unanimous (Sibelius, Gould p. 160, Ross p. 173, Stone p. 136, Gerou & Lusk p. 113,
 * MuseScore, Verovio, LilyPond): a bar of a breve or longer takes a BREVE rest.
 * - `'convention'` (**default**) — the whole rest below 8 quarters, the breve rest from 8 up;
 * - `'whole'` — the whole rest in every meter (what the editor drew before 2026-09-26);
 * - `'lilypond'` — as `'convention'`, and a LONGA rest from 16 quarters.
 *
 * ⛔ THE MODEL IS UNTOUCHED: a bar rest is still the nominal `'w'` + `isMeasureRest` (`utils/restFill`,
 * `models/barRestOps`, every saved score). This only answers which glyph DRAWS it — asked by the drawing,
 * the placement and the ink alike through {@link barRestDuration}, ⛔ never a second `'w'` assumed.
 * Armed from the console, `__durations.barRest(…)`.
 */
import type { NoteDuration } from '@/types/music'
import { type Fraction, fracToNumber } from '@/utils/fraction'

export const BAR_REST_STYLES = ['convention', 'whole', 'lilypond'] as const
export type BarRestStyle = (typeof BAR_REST_STYLES)[number]

export const DEFAULT_BAR_REST_STYLE: BarRestStyle = 'convention'

const state = { style: DEFAULT_BAR_REST_STYLE as BarRestStyle, generation: 0 }

/** The duration whose rest glyph draws a whole-bar rest in a bar of `barQuarters`. */
export function barRestDuration(barQuarters: Fraction | number): NoteDuration {
  const quarters = typeof barQuarters === 'number' ? barQuarters : fracToNumber(barQuarters)
  if (state.style === 'whole') return 'w'
  if (state.style === 'lilypond' && quarters >= 16) return 'longa'
  return quarters >= 8 ? 'breve' : 'w'
}

export function barRestStyle(): BarRestStyle {
  return state.style
}

/** 🚨 In the width AND shape keys (`layout/widthRowGenerations`): a breve rest is narrower. */
export function barRestGeneration(): number {
  return state.generation
}

export function setBarRestStyle(style: BarRestStyle): boolean {
  if (!BAR_REST_STYLES.includes(style)) return false
  state.style = style
  state.generation++
  return true
}

export function resetBarRestStyle(): void {
  state.style = DEFAULT_BAR_REST_STYLE
  state.generation++
}
