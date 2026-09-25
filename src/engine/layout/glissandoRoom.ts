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
import type { Chord, Fraction, Measure, Score } from '@/types/music'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { voiceOf } from '@/utils/lanes'
import { fracCompare, fracEq } from '@/utils/fraction'
import { getGlissandi, glissandoTarget } from '@/engine/models/glissandoOps'
import { findSlot } from '@/engine/models/slotLookup'
import { armedGlissandoEndRule, armedGlissandoFreeEnd } from '@/engine/engrave/marks/glissandoLine'
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
    if (!targetId) {
      // ⭐ P3 — a FREE end asks for its own length: after the note to the next column (or the barline), or
      //   before it from the previous one. ⛔ Nothing before the bar's first column (the lead-in is the header's).
      const { across, clearance } = armedGlissandoFreeEnd()
      const lane = laneBeats(score, measure, from.chord)
      const i = lane.findIndex(b => fracEq(b, from.chord.beat))
      if (glissando.side === 'before') {
        // The free START keeps the free-end row's clearance from whatever stands before it (a rest, a note).
        if (i > 0) rooms.push({ from: lane[i - 1], to: from.chord.beat, startGap: clearance, endGap: rule.endGap, accidentalGap: rule.accidentalGap, length: across })
      } else {
        // The free END keeps the free-end row's clearance from whatever follows (a fall ran into the rest after it;
        // Gould p. 411 (c) stops 0.6 sp short of the rest).
        rooms.push({ from: from.chord.beat, to: lane[i + 1] ?? null, startGap: rule.startGap, endGap: clearance, accidentalGap: clearance, length: across })
      }
      continue
    }
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

/** The beats of the slots in `chord`'s own lane (staff + voice) in this bar, in order. */
function laneBeats(score: Score, measure: Measure, chord: Chord): Fraction[] {
  const staff = staffIndexOfId(score, chord.staffId)
  const voice = voiceOf(chord)
  return measure.slots
    .filter(s => voiceOf(s) === voice && staffIndexOfId(score, s.staffId) === staff)
    .map(s => s.beat)
    .sort((a, b) => fracCompare(a, b))
}
