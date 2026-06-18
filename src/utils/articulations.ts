/**
 * The single source of *meaning* for articulations in playback.
 *
 * Articulations are stored on a Chord as `articulations?: ArticulationType[]`
 * (a chord may carry more than one). This module owns the **sound** axis:
 * how each mark bends a chord's duration and attack. The glyph axis lives in
 * the render layer.
 *
 * Mirrors utils/dynamics.ts (level → velocity): playback derives its numbers
 * here rather than hardcoding them, so tuning each mark is one table edit.
 */
import type { ArticulationType } from '@/types/music'

/**
 * Per-mark playback effect, applied multiplicatively on top of the chord's
 * nominal duration and dynamic velocity:
 *   - durationFactor: scales the sounding duration (staccato shortens, tenuto
 *     holds to full value, defeating any default gap).
 *   - velocityScale:  scales the attack velocity (accent emphasizes).
 */
export interface ArticulationEffect {
  durationFactor: number
  velocityScale: number
}

const ARTICULATION_EFFECT: Record<ArticulationType, ArticulationEffect> = {
  staccato: { durationFactor: 0.5, velocityScale: 1.0 },
  tenuto: { durationFactor: 1.0, velocityScale: 1.0 },
  accent: { durationFactor: 1.0, velocityScale: 1.3 },
}

/**
 * Combine the effects of all articulations on a chord into a single
 * { durationFactor, velocityScale } pair. Multiple marks compose
 * multiplicatively; an empty/undefined list is a no-op (identity).
 */
export function articulationEffect(
  articulations: ArticulationType[] | undefined,
): ArticulationEffect {
  const effect: ArticulationEffect = { durationFactor: 1, velocityScale: 1 }
  if (!articulations) return effect

  for (const a of articulations) {
    const e = ARTICULATION_EFFECT[a]
    if (!e) continue
    effect.durationFactor *= e.durationFactor
    effect.velocityScale *= e.velocityScale
  }
  return effect
}
