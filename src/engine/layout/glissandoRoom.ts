/**
 * ⭐ **HOW MUCH ROOM A GLISSANDO ASKS FOR** — its least line length, as a named, sourced row
 * (docs/plans/glissando-plan.md P1b). Turned into a SOFT spacing request by `./noteLineRoom`.
 *
 * His call, 2026-09-25 — of the two answers to *"two heads too close for a line"*:
 *  - Gould p. 141 moves the line above or below the notes with a `gliss.`: ⛔ a USER choice (Properties,
 *    later), *"not the normal behaviour of the engine"*;
 *  - MuseScore asks the spacing for a minimum line length: ✅ the default — *"but the minimum distance
 *    should not avoid the user to make it shorter"* (so the request is SOFT: see `./noteLineRoom`) —
 *    *"and also current behaviour in preset to compare later"* (the `none` row).
 */
import type { Measure, Score } from '@/types/music'
import { getGlissandi, glissandoTarget } from '@/engine/models/glissandoOps'
import { findSlot } from '@/engine/models/slotLookup'
import { armedGlissandoEndRule } from '@/engine/engrave/marks/glissandoLine'
import type { LineRoom } from './noteLineRoom'

export interface GlissandoMinLengthRule {
  /** The least length of a straight line, staff spaces. */
  straight: number
  /** …of a wavy one (P-later: the style is not built yet). */
  wavy: number
  source: string
}

export const GLISSANDO_MIN_LENGTH_RULES = {
  /** ✅ ARMED — `Sid::minStraightGlissandoLength` / `minWavyGlissandoLength`. */
  musescore: { straight: 1.2, wavy: 2.0, source: 'MuseScore minStraight/WavyGlissandoLength (glissando-engines-research §1)' },
  /** What P1 drew: no request — the notes stand where the music alone puts them, and a line too
   *  cramped for its gaps is squeezed (or vanishes, per `GLISSANDO_SQUEEZE_RULES`). */
  none: { straight: 0, wavy: 0, source: 'no request (P1\'s behaviour)' },
} as const satisfies Record<string, GlissandoMinLengthRule>

export type GlissandoMinLengthRuleName = keyof typeof GLISSANDO_MIN_LENGTH_RULES

export const ACTIVE_GLISSANDO_MIN_LENGTH_RULE: GlissandoMinLengthRuleName = 'musescore'

const state: { rule: GlissandoMinLengthRuleName; generation: number } = {
  rule: ACTIVE_GLISSANDO_MIN_LENGTH_RULE, generation: 0,
}

export function armedGlissandoMinLength(): GlissandoMinLengthRule {
  return GLISSANDO_MIN_LENGTH_RULES[state.rule]
}

export function glissandoMinLengthSettings(): { rule: GlissandoMinLengthRuleName; generation: number } {
  return { ...state }
}

/** 🚨 A WIDTH — in `layout/widthRowGenerations`. */
export function glissandoMinLengthGeneration(): number {
  return state.generation
}

export function setGlissandoMinLengthRule(rule: GlissandoMinLengthRuleName): boolean {
  if (!(rule in GLISSANDO_MIN_LENGTH_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

export function resetGlissandoMinLengthRule(): void {
  state.rule = ACTIVE_GLISSANDO_MIN_LENGTH_RULE
  state.generation++
}

/**
 * The requests of every glissando that LEAVES a note of this bar and has a note to go to.
 * ⭐ The gaps are the armed END rule's, so the room asked for is the room the drawing leaves.
 * ⏳ A free end (P3) asks nothing yet.
 */
export function glissandoRoomIn(score: Score, measure: Measure): LineRoom[] {
  const length = armedGlissandoMinLength().straight
  if (length <= 0) return []
  const rule = armedGlissandoEndRule()
  const rooms: LineRoom[] = []
  for (const glissando of getGlissandi(score)) {
    const from = findSlot(score, glissando.noteId)
    if (from?.type !== 'chord' || from.chord.measure !== measure.number) continue
    const targetId = glissandoTarget(score, glissando)
    if (!targetId) continue
    const to = findSlot(score, targetId)
    if (to?.type !== 'chord') continue
    rooms.push({
      from: from.chord.beat,
      to: to.chord.measure === measure.number ? to.chord.beat : null,
      startGap: rule.startGap,
      endGap: rule.endGap,
      accidentalGap: rule.accidentalGap,
      length,
    })
  }
  return rooms
}
