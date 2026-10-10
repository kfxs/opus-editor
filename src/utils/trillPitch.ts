/**
 * THE TRILL'S AUXILIARY — the note it alternates WITH, derived rather than stored.
 *
 * ⭐ **A trill carries no interval** ({@link Trill} has no such field, deliberately). The auxiliary
 * is the DIATONIC STEP ABOVE, resolved against the key in force and the accidentals already used in
 * the bar — which is what MusicXML, LilyPond and MuseScore all do, and what makes a trill survive a
 * transposition or a key change without anything having to be rewritten. Store it and you have a
 * second answer that goes stale the first time the music around it moves.
 *
 * ⚠️ **It is SEMANTIC, not decoration**: this is what plays (docs/plans/trill-plan.md §7), so getting it
 * wrong is an audible bug, not a typographic one.
 *
 * ## The two questions, and why they have different answers
 *
 * *What SOUNDS* is the alteration in force at the auxiliary's own diatonic position: an accidental
 * earlier in the bar holds for the rest of it, and where there is none the key signature answers.
 * That is the ordinary running-accidental rule — a trill's upper note is a note in the bar like any
 * other.
 *
 * *What is PRINTED* above the `tr` is narrower: **the sign appears when the auxiliary differs from
 * what the KEY ALONE would give.** So in C major, an F♯ earlier in the bar makes a trill on E print
 * a ♯ over the sign — the reader cannot otherwise tell whether the trill took the accidental, and
 * the printed sign is the composer saying so.
 *
 * ⚠️ There is a real editorial spectrum here that this does not model: Gould advises showing the
 * accidental wherever there is any doubt, and some houses print it for every altered auxiliary
 * regardless. Ours is the narrow, mechanical rule — one function, one decision to widen if his eye
 * wants more signs (docs/plans/trill-plan.md §9, "user chooses the step").
 */
import type { Accidental, Alteration, PitchStep } from '@/types/music'
import { alterationInForce, type BarAlterations } from './accidentalState'
import { keyAlterationOf, type KeySignature } from './keySignature'
import { drawnSignOf, sameAlteration } from './alterationSigns'

/** The seven letters, in order — the diatonic ladder the auxiliary climbs one rung of. */
const STEPS: readonly PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** The note a trill alternates with, and whether its sign is drawn. */
export interface TrillAuxiliary {
  step: PitchStep
  /** What SOUNDS — the bar's running accidental at this position, else the key's (absent = natural). */
  alteration?: Alteration
  octave: number
  /** The sign PRINTED above the `tr`, or null when the key already says it. */
  accidental: Accidental | null
}

/**
 * The auxiliary of a trill on `main`.
 *
 * ⭐ **`main`'s own alteration is not read, and that is correct**: the auxiliary is the next LETTER
 * up, and how far above it lands is the key's business, not the main note's. A trill on E♭ in C
 * major alternates with F♮ — a whole tone — while a trill on E♮ alternates with the same F♮, a
 * semitone. Both are right; the interval is a consequence, never an input.
 *
 * @param main the trilled note's letter and octave
 * @param key the key in force (`keyAt`)
 * @param barAlterations diatonic position → alteration already in force in this bar
 *   (`prevailingAlterations` from `utils/accidentalState` — the same walk every other pass uses,
 *   so a trill can never disagree with the accidental the reader can see)
 */
export function trillAuxiliary(
  main: { step: PitchStep; octave: number },
  key: KeySignature,
  barAlterations: BarAlterations,
): TrillAuxiliary {
  const index = STEPS.indexOf(main.step)
  const step = STEPS[(index + 1) % 7]
  // B → C crosses into the next octave: octave numbers change at C, not at A (scientific pitch).
  const octave = step === 'C' ? main.octave + 1 : main.octave

  // ⭐ The bar's running accidental, else the key — `accidentalState.alterationInForce`, which is the
  // SAME rule the drawn signs and note entry read. It was written out here first; naming it there
  // is what keeps a trill from ever sounding a pitch the page contradicts.
  const fromKey = keyAlterationOf(key, step)
  const alteration = alterationInForce(barAlterations, key, step, octave)

  return {
    step,
    ...(alteration ? { alteration } : {}),
    octave,
    accidental: sameAlteration(alteration, fromKey) ? null : accidentalFor(alteration),
  }
}

/**
 * The sign for an alteration, as PRINTED above a trill — its own (a double prints the double). Unlike
 * `accidentalOfAlteration`, no alteration here is a **natural** rather than nothing: reaching this
 * function at all means the auxiliary departs from the key, and "departs from a key with a sharp in
 * it, to zero" is exactly what a ♮ says.
 */
function accidentalFor(alteration: Alteration | undefined): Accidental {
  return drawnSignOf(alteration)
}
