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
import type { ChordRest, Fraction, NotePitch, PitchAlter, PitchStep } from '@/types/music'
import { fracLt, fracCompare } from './fraction'
import { spellingDiatonicPos, alterToString } from './pitchSpelling'

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

/**
 * ⭐ The SIGN each pitch of a lane actually displays — the same running-accidental rule as above,
 * but walked FORWARD slot by slot, which is what the render pass needs: the state as of each slot,
 * updated within a chord as signs are shown.
 *
 * Extracted from `NoteBuilder`'s inline accumulator so that a FANNED slot's members can obey it too
 * (docs/fanned-beam-pitches-plan.md §2). ⚠️ **The drawing READS this decision, it never makes one.**
 * The `StaveNote`s and the hand-drawn member heads look the answer up in the SAME map, so the two
 * cannot drift — a second accidental rule inside the fan renderer is the one thing this feature
 * cannot afford.
 *
 * ⭐ **A member's accidental HOLDS FOR THE REST OF THE BAR.** A member is a note in the bar, so it
 * alters its diatonic position like any other, and a later ordinary F after a member's F♯ draws its
 * natural. The members are folded in immediately AFTER their own slot's pitches — where they lie in
 * time — which is also why the default fan (every member the note you typed) shows exactly one sign:
 * the members repeat an alteration that is already active.
 *
 * Returns `pitchId → VexFlow accidental string`, or `null` where the sign is suppressed. Ids that
 * are absent were never asked about (a rest, another lane).
 *
 * Scope is the CALLER's, as everywhere else in this file: pass one lane's slots, in beat order.
 */
export function displayedAccidentals(slots: ChordRest[]): Map<string, string | null> {
  const signs = new Map<string, string | null>()
  // Key = spellingDiatonicPos(step, octave); value = the alteration in force there. A position
  // absent from the map has not appeared yet in this bar.
  const active = new Map<number, PitchAlter>()

  const decide = (p: NotePitch): void => {
    if (p.tiedFrom) {
      signs.set(p.id, null) // a tied continuation re-states nothing
      return
    }
    const dPos = spellingDiatonicPos(p.step, p.octave)
    const activeAlter = active.get(dPos)
    if (p.alter !== 0) {
      // Altered pitch — show the sign unless the same alteration is already in force.
      if (!p.forceAccidental && activeAlter === p.alter) {
        signs.set(p.id, null)
      } else {
        signs.set(p.id, alterToString(p.alter))
        active.set(dPos, p.alter)
      }
    } else if (activeAlter !== undefined && activeAlter !== 0) {
      signs.set(p.id, 'n') // cancel an earlier alteration at this position
      active.set(dPos, 0)
    } else if (p.forceAccidental) {
      signs.set(p.id, 'n') // a courtesy natural, asked for explicitly
      active.set(dPos, 0)
    } else {
      signs.set(p.id, null)
    }
  }

  for (const slot of slots) {
    if (slot.type !== 'chord') continue
    for (const p of slot.notes) decide(p)
    // The fan's other members, in the order they sound — inside this slot, before the next one.
    for (const member of slot.fan?.members ?? []) for (const p of member.pitches) decide(p)
  }
  return signs
}
