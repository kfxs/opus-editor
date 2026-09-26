/**
 * ⭐ **Which SIDE a longa's stem stands on** — a house-style ROW (docs/plans/other-durations-plan.md §2.3,
 * decision f, his call 2026-09-26: *"lets do verovio default and the other as customizable"*).
 *
 * The stem's DIRECTION is the normal stem rule in both — up or down by pitch (`NOTE_DURATION_ROWS.longa.stem`).
 * Only where a DOWN stem stands differs:
 * - `'right'` (**default**, Verovio / the mensural shape) — always on the head's right side;
 * - `'normal'` (MuseScore, LilyPond) — like a half note: right when up, left when down.
 * Armed from the console, `__durations.longaStem(…)`.
 */
export const LONGA_STEM_SIDES = ['right', 'normal'] as const
export type LongaStemSide = (typeof LONGA_STEM_SIDES)[number]

export const DEFAULT_LONGA_STEM_SIDE: LongaStemSide = 'right'

const state = { side: DEFAULT_LONGA_STEM_SIDE as LongaStemSide, generation: 0 }

export function longaStemSide(): LongaStemSide {
  return state.side
}

/** 🚨 In the SHAPE key (`layout/widthRowGenerations`): the stem moves, so the bar re-engraves. */
export function longaStemGeneration(): number {
  return state.generation
}

export function setLongaStemSide(side: LongaStemSide): boolean {
  if (!LONGA_STEM_SIDES.includes(side)) return false
  state.side = side
  state.generation++
  return true
}

export function resetLongaStemSide(): void {
  state.side = DEFAULT_LONGA_STEM_SIDE
  state.generation++
}
