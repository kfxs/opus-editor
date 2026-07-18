/**
 * Running-accidental state within a measure — the ONE walk shared by the passes that
 * ask "what is already in effect at this staff position?"
 *
 * Common-practice rule: an explicit accidental holds for the rest of the bar at its own
 * diatonic position. To decide a note's prevailing alteration (or whether its sign is
 * redundant), we replay the measure's earlier notes and remember the last alteration seen
 * at each diatonic position. Key signatures are NOT folded in here — VexFlow draws those
 * separately (this editor has no key-signature feature yet).
 *
 * Pure and dependency-light. The CALLER chooses which notes to feed in (the whole measure
 * across voices, or a single voice) — that scope is the caller's interpretation, not part
 * of this walk. `MusicEngine.getPrevailingAlter` ("prevailing alter") and
 * `SelectionController.computeDisplayedAccidental` ("displayed sign") both build on this;
 * `NoteBuilder`'s render pass implements the same rule incrementally as it lays out slots.
 */
import type { Fraction, PitchAlter, PitchStep } from '@/types/music'
import { fracLt, fracCompare } from './fraction'
import { spellingDiatonicPos } from './pitchSpelling'

/** The minimal note shape the running-accidental walk reads. */
export interface AccidentalNote {
  isRest?: boolean
  tiedFrom?: string
  step?: PitchStep
  octave?: number
  alter?: PitchAlter
  beat: Fraction
}

/**
 * Map from diatonic position ({@link spellingDiatonicPos}) → the alteration of the LAST
 * note there strictly before `beat`. A position absent from the map has not appeared yet
 * in the bar. Only non-rest, non-tied notes count (a tied continuation re-states nothing),
 * and same-beat notes are excluded (strictly `< beat`), so a chord never alters itself.
 */
export function prevailingAlterations(notes: AccidentalNote[], beat: Fraction): Map<number, PitchAlter> {
  const active = new Map<number, PitchAlter>()
  const preceding = notes
    .filter(n => !n.isRest && !n.tiedFrom && n.step !== undefined && n.octave !== undefined && fracLt(n.beat, beat))
    .sort((a, b) => fracCompare(a.beat, b.beat))
  for (const n of preceding) {
    active.set(spellingDiatonicPos(n.step!, n.octave!), n.alter ?? 0)
  }
  return active
}

/** The active alteration at one diatonic position for `beat` (0 = natural / none seen). */
export function prevailingAlterAt(notes: AccidentalNote[], dPos: number, beat: Fraction): PitchAlter {
  return prevailingAlterations(notes, beat).get(dPos) ?? 0
}
