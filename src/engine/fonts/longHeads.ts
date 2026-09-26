/**
 * ⭐ **Which head a BREVE and a LONGA are drawn with** — a house-style ROW (docs/plans/other-durations-plan.md
 * §2.2–§2.3, P4). Gould p. 10 gives the breve's shapes as equals (an oval with two lines each side, with
 * one, or a square); the engines split — MuseScore and LilyPond default ROUND, Verovio SQUARE
 * (`docs/research/durations-engines.md`). SMuFL has no longa head of its own: a longa is a breve head
 * and a stem, so it takes one of the same two cuts.
 *
 * Defaults: the breve ROUND (two of three engines), the longa SQUARE (Verovio's body — his default for
 * the longa's stem, decision f — and the Keypad's own drawing). ⭐ Each is a row; ⛔ neither is a decision.
 * Armed from the console, `__durations.breveHead(…)` / `.longaHead(…)`.
 */
import type { GlyphName } from './fontMetrics'

export const LONG_HEADS = {
  round: 'noteheadDoubleWhole',
  square: 'noteheadDoubleWholeSquare',
} as const satisfies Record<string, GlyphName>

export type LongHeadShape = keyof typeof LONG_HEADS

export const DEFAULT_BREVE_HEAD: LongHeadShape = 'round'
export const DEFAULT_LONGA_HEAD: LongHeadShape = 'square'

const state = { breve: DEFAULT_BREVE_HEAD as LongHeadShape, longa: DEFAULT_LONGA_HEAD as LongHeadShape, generation: 0 }

/** The glyph a breve's / longa's head is drawn with, as armed. */
export function longHeadGlyph(duration: 'breve' | 'longa'): GlyphName {
  return LONG_HEADS[state[duration]]
}

export function longHeadSettings(): { breve: LongHeadShape; longa: LongHeadShape } {
  return { breve: state.breve, longa: state.longa }
}

/** 🚨 In the width AND shape keys (`layout/widthRowGenerations`): a square head is a different width. */
export function longHeadGeneration(): number {
  return state.generation
}

/** Arm a shape. ⛔ An unknown name is REFUSED, never ignored. */
export function setLongHead(duration: 'breve' | 'longa', shape: LongHeadShape): boolean {
  if (!(shape in LONG_HEADS)) return false
  state[duration] = shape
  state.generation++
  return true
}

export function resetLongHeads(): void {
  state.breve = DEFAULT_BREVE_HEAD
  state.longa = DEFAULT_LONGA_HEAD
  state.generation++
}
