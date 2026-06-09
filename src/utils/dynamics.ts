/**
 * The single source of *meaning* for dynamics (docs/dynamics-plan.md §5–6).
 *
 * Three concerns are kept on independent axes; this module owns the **meaning**
 * axis (level → loudness) plus small display/type helpers. The glyph axis lives
 * in the render layer; the scope axis lives on `Dynamic.voice`.
 *
 * No consumer should hardcode the set of dynamics — derive it from
 * DYNAMIC_VELOCITY (and the DynamicLevel union) so adding a level is one row.
 */
import type { Dynamic, DynamicLevel, Score } from '@/types/music'
import { fracCompare, fracLte, fracGt } from './fraction'

/**
 * Interpreted level → Tone.js normalized velocity (0..1), used as the 4th arg of
 * `triggerAttackRelease(name, dur, time, velocity)`. NOT decibels.
 *
 * Add a row here when extending the DynamicLevel union; playback and any
 * level-aware UI read from this table rather than a private list.
 */
export const DYNAMIC_VELOCITY: Record<DynamicLevel, number> = {
  p: 0.25,
  mp: 0.45,
  mf: 0.7,
  f: 1.0,
}

/** The level assumed before any interpreted dynamic appears. */
export const DEFAULT_DYNAMIC: DynamicLevel = 'mf'

/**
 * Narrow a Dynamic to an interpreted (playback-affecting) one. Text dynamics —
 * and any malformed level dynamic missing its `level` — are not interpreted.
 */
export function isInterpreted(d: Dynamic): d is Dynamic & { level: DynamicLevel } {
  return d.kind === 'level' && d.level !== undefined
}

/**
 * The string to display for a dynamic: the level letters for interpreted marks,
 * or the user's custom text for text marks. (How those letters become a SMuFL
 * glyph is the render layer's job; this is the semantic label.)
 */
export function dynamicLabel(d: Dynamic): string {
  if (isInterpreted(d)) return d.level
  return d.text ?? ''
}

/** The voice a dynamic governs (default 0). */
export function dynamicVoice(d: Dynamic): number {
  return d.voice ?? 0
}

/** Dynamics of a measure, sorted ascending by beat (empty if none). */
export function measureDynamics(score: Score, measureNumber: number): Dynamic[] {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure?.dynamics?.length) return []
  return [...measure.dynamics].sort((a, b) => fracCompare(a.beat, b.beat))
}

/**
 * The interpreted dynamic level in effect at (measureNumber, beat) for `voice`:
 * the last interpreted dynamic at-or-before that position in the same voice,
 * walking back across earlier measures (mirrors clefUtils.inheritedClef), else
 * DEFAULT_DYNAMIC. Text dynamics are skipped — they carry the previous level.
 *
 * This is the *correctness* reference. Sequential playback uses an incremental
 * single-pass scan (Phase 3) instead of walking back per chord.
 */
export function resolveActiveLevel(
  score: Score,
  measureNumber: number,
  beat: Dynamic['beat'],
  voice: number = 0,
): DynamicLevel {
  // This measure: latest interpreted dynamic in this voice with beat <= target.
  const here = measureDynamics(score, measureNumber)
  for (let i = here.length - 1; i >= 0; i--) {
    const d = here[i]
    if (dynamicVoice(d) === voice && isInterpreted(d) && fracLte(d.beat, beat)) {
      return d.level
    }
  }
  // Earlier measures: latest interpreted dynamic in this voice (any beat).
  for (let n = measureNumber - 1; n >= 1; n--) {
    const earlier = measureDynamics(score, n)
    for (let i = earlier.length - 1; i >= 0; i--) {
      const d = earlier[i]
      if (dynamicVoice(d) === voice && isInterpreted(d)) {
        return d.level
      }
    }
  }
  return DEFAULT_DYNAMIC
}

/**
 * Resolve the interpreted level governing **every chord** in the score, in a
 * single in-order pass (the playback step-function). Returns `chord.id → level`.
 *
 * This is the O(n) sequential equivalent of calling {@link resolveActiveLevel}
 * per chord: a running per-voice level is carried forward across measures rather
 * than walked back each time. Rests carry no sound and are skipped. The result
 * matches `resolveActiveLevel` for every chord (asserted in tests).
 */
export function resolveChordLevels(score: Score): Map<string, DynamicLevel> {
  const out = new Map<string, DynamicLevel>()
  const activeLevels = new Map<number, DynamicLevel>()

  for (const measure of score.measures) {
    const measureDyns = (measure.dynamics ?? [])
      .filter(isInterpreted)
      .sort((a, b) => fracCompare(a.beat, b.beat))

    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      const voice = slot.voice ?? 0
      let level: DynamicLevel = activeLevels.get(voice) ?? DEFAULT_DYNAMIC
      for (const d of measureDyns) {
        if (fracGt(d.beat, slot.beat)) break // sorted: nothing later qualifies
        if ((d.voice ?? 0) === voice) level = d.level
      }
      out.set(slot.id, level)
    }

    // Carry each voice's last (highest-beat) dynamic forward to later measures.
    for (const d of measureDyns) {
      activeLevels.set(d.voice ?? 0, d.level)
    }
  }

  return out
}
