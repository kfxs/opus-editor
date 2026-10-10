/**
 * ⭐⭐ **THE ALTERATION A PITCH IS BORN WITH** — what a newly typed, clicked or stepped-to note
 * carries when nobody has said otherwise.
 *
 * ## Why this module exists at all (docs/plans/key-signature-plan.md §3.1)
 *
 * Note entry takes *"natural pitch spelling from Y coordinate (that staff's clef), then apply
 * accidental"*: the click gives a diatonic position, the entered pitch is that letter with
 * no alteration, and the armed accidental was the only thing that ever changed it. Combine that with
 * the display rule (`accidentalState.displayedAccidentals`, which now folds the key in) and
 * **G major breaks on the first click**: the entered F carries no alteration, the key says F♯, the
 * two disagree, so the renderer draws a **natural**. Every note typed in a sharp or flat key gets
 * a spurious ♮ and the score is unusable in any key but C.
 *
 * ⭐ So **the key is the DEFAULT ALTERATION AT ENTRY, and the armed accidental OVERRIDES it** — the
 * other face of the same fallback the drawing reads: the bar's running accidental first, the key
 * underneath it, no alteration only where the key is silent. One rule
 * ({@link alterationInForceAt}), asked from three places, ⛔ not three patches:
 *
 *  - `NoteEntryCoordinator` — the click,
 *  - `KeyboardController` — typing a letter, and stacking a chord note onto one,
 *  - `SelectionController.adjustPitch` — the arrow-key diatonic step, where the letter changes
 *    under a stationary alteration (a step up from F♯ in G major is **G♮**, and the F it left must
 *    not have been an F♮ to begin with).
 *
 * ⏳ **PASTE is deliberately not one of them.** An incoming note already carries its own spelling,
 * and it keeps it: a pasted F♯ stays F♯ and simply stops drawing its sign. That is the same
 * *"a key signature changes what is DRAWN, never what is STORED"* this whole feature rests on —
 * applying a signature transposes nothing (MuseScore touches pitches only when the *instrument's*
 * transposition changed, `editing/editkeysig.cpp:85-143`).
 *
 * ⚠️ It lives in `engine/models/` rather than beside the rule in `utils/` for `trillOps`' reason
 * exactly: the rule is pure, and this one needs the SCORE — it resolves an address (which bar, which
 * staff) before it can ask.
 */
import type { Accidental, Alteration, Fraction, PitchStep, Score } from '@/types/music'
import { alterationInForceAt } from '@/utils/accidentalState'
import { keyAt } from '@/utils/keySignature'
import { measureAccidentalNotes } from '@/utils/musicUtils'
import { armedAlteration } from '@/utils/alterationSigns'
import { keyStaffId } from './staffContent'

/** Where the new pitch is going — the address the key and the bar's accidentals are read at. */
export interface EntryAddress {
  measure: number
  beat: Fraction
  /** 0-based staff index, `utils/lanes`' convention — absent is the first staff. */
  staff?: number
}

/**
 * The alteration to give a note being placed at `where` on the letter `step`/`octave`.
 *
 * @param armed the ARMED accidental, which wins outright when there is one — that is what an armed
 *   tool means. `'n'` gives no alteration, and the caller is the one that also sets `forceAccidental` so the
 *   courtesy sign survives (a natural asked for in C major cancels nothing and would otherwise be
 *   invisible).
 */
export function entryAlteration(
  score: Score,
  where: EntryAddress,
  step: PitchStep,
  octave: number,
  armed?: Accidental | null,
): Alteration | undefined {
  if (armed) return armedAlteration(armed)

  const measure = score.measures.find(m => m.number === where.measure)
  if (!measure) return undefined

  const staffId = keyStaffId(score, where.staff)
  // ⭐ The bar's own accidentals FIRST (a note typed after an F♯ in the bar is another F♯ — the
  //   same answer `MusicEngine.getPrevailingAlteration` already gives "remove the accidental"), and the
  //   key underneath them. `measureAccidentalNotes` is the scope every other accidental query uses,
  //   fanned members included.
  return alterationInForceAt(measureAccidentalNotes(measure), where.beat, keyAt(score, where.measure, staffId), step, octave)
}
