/**
 * ⭐ **HOW FAR A REST IS SHIFTED OFF ITS NEUTRAL LINE** — what `NoteBuilder.createStaveNotesFromSlots` is
 * handed as its `restShift`, asked by the page (`ScoreRenderer.drawMeasureContent`) and by the bent staff
 * (`eye/spineScore`), so the two cannot disagree.
 *
 * Two parts, in LilyPond's order (an explicit `staff-position` overrides its own collision result):
 * 1. **DERIVED** — in a multi-voice staff, where `layout/restVoicePlacement` puts the rest (the sign by
 *    voice, the magnitude from the content around it), minus the single-voice neutral line. Single voice:
 *    0 — Gould p. 34's centred rest, untouched.
 * 2. **The hand's** `restShift` override, a deviation from wherever the rule put it.
 */
import type { ChordRest, Clef, Fraction, Score } from '@/types/music'
import { restDrawnDuration, restLineInStaff, restNeutralLine } from '@/engine/layout/restVoicePlacement'
import { restPositionKey, restShiftOverrideOf } from '@/engine/models/engravingOverrides'
import { voiceOf } from '@/utils/lanes'

/**
 * The resolver for one staff's lane of one bar. `laneSlots` is EVERY voice of that staff (the rule's
 * context), `clefAt` the clef in effect at a beat, `multiVoice` whether the lane holds more than one voice.
 */
export function restShiftResolver(
  score: Score, measureId: string, laneSlots: ChordRest[], clefAt: (beat: Fraction) => Clef, multiVoice: boolean,
): (slot: ChordRest) => number {
  return slot => {
    const derived = multiVoice && slot.type === 'rest'
      ? restLineInStaff(laneSlots, slot, clefAt(slot.beat)) - restNeutralLine(restDrawnDuration(slot))
      : 0
    return derived + (restShiftOverrideOf(score, restPositionKey(measureId, voiceOf(slot), slot.beat, slot.staffId))?.steps ?? 0)
  }
}
