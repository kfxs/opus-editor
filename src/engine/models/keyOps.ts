/**
 * Mutating key-signature sub-API over a `Score` — the `clefOps` idiom exactly: free functions over
 * the score they are handed, no shared instance state, and {@link ScoreModel} keeps thin delegators
 * to them. The read side (`keyAt`, `keyBefore`, `keyAlterOf`, `fifthsOf`) stays in
 * `utils/keySignature.ts`; this module owns only the writes.
 *
 * ## ⭐⭐ A KEY CHANGE IS WRITTEN AT THE HEAD OF A BAR — there is no `beat` parameter here
 *
 * {@link KeyChange} carries a `beat` and {@link keyAt} resolves one, because the model permits a
 * mid-bar change (MuseScore stores one, reachable through its list selections, and an import may
 * carry it). ⛔ But nothing in this editor WRITES one, and this API says so rather than offering a
 * parameter with no feature behind it.
 *
 * ⚠️⚠️ **That is not tidiness — it is what keeps `rebarOps` correct, and the decision is recorded
 * here because this is the module that could break it.** `clearMeasureForRebar` deletes every
 * BEAT-ANCHORED array before a bar is re-tiled (clefs, dynamics, tempos, hairpins, ottavas, pedals),
 * precisely so that anything not re-anchored afterwards is a visible loss rather than a mark left
 * pointing at music that moved. `keys` is **not** in that list, and must not be:
 *
 *  - a **beat-0** signature is a BOUNDARY fact — "this bar is in E♭" — exactly like `timeSignature`,
 *    `barline` and `repeatStart`, none of which are deleted either. It rides its measure through a
 *    re-tile, which is the correct answer and costs no code;
 *  - a **beat > 0** signature would be beat-anchored and would need a `CapturedAnchor` kind. ⛔ Not
 *    built, because nothing writes one. ⏭️ The day a mid-bar key change becomes a feature, it needs
 *    that capture/restore pair IN THE SAME COMMIT — and `keys` must join `clearMeasureForRebar`.
 *
 * @see docs/key-signature-plan.md §1.2, §8.1
 */
import type { KeySignature, Measure, Score } from '@/types/music'
import { fracCreate, fracCompare, fracIsZero } from '@/utils/fraction'
import { keyBefore, keysEqual } from '@/utils/keySignature'
import { v4 as uuidv4 } from 'uuid'

const BEAT_ZERO = fracCreate(0, 1)

/**
 * Same-staff test for two key changes — `clefOps.sameStaff`'s twin. Staff 0 always stores an ABSENT
 * `staffId` (the write convention), any later staff its real id, so strict equality is exact.
 */
function sameStaff(a: string | undefined, b: string | undefined): boolean {
  return a === b
}

/** Find a measure by its number (mirrors `ScoreModel.getMeasure`). */
function getMeasure(score: Score, measureNumber: number): Measure | undefined {
  return score.measures.find(m => m.number === measureNumber)
}

/**
 * Set the key signature at the head of a measure, on one staff.
 *
 * ⭐ **Normalized the way a clef change is:** if `key` is the signature already in force entering
 * this bar on this staff, there is no visible change to make, so any change stored here is REMOVED
 * rather than a redundant one written. At measure 1 the "in force before" is C major, so setting C
 * major there stores nothing and the bar renders C major by inheritance — the same shape as setting
 * `treble` at m1 b0.
 *
 * ⚠️ **Which is exactly why open/atonal is not C major.** `keysEqual` compares `mode`, so setting an
 * OPEN key at measure 1 stores a real change: the ambiguity MuseScore refuses to guess at (*"it is
 * impossible to know whether you want a C major/A minor key signature, or an 'open/atonal' one"*) is
 * one we can store the answer to.
 *
 * @returns true if the score changed.
 */
export function setKeyAt(score: Score, measureNumber: number, key: KeySignature, staffId?: string): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false

  if (keysEqual(key, keyBefore(score, measureNumber, staffId))) {
    return removeKeyChangeAt(measure, staffId)
  }
  return upsertKeyChange(measure, key, staffId)
}

/**
 * Remove a measure's key change, reverting it to the signature inherited from earlier bars on this
 * staff.
 *
 * ⛔ **Measure 1 is protected — change only, never remove.** The clef has the same protection at
 * m1 b0 (`elements/clef.ts`: *"measure 1 opening: change only, cannot remove"*), and two shipped
 * applications reach the same answer for the key specifically, MuseScore stating the reason: with
 * nothing stored there, C major and open/atonal are indistinguishable.
 *
 * @returns true if a change was removed.
 */
export function removeKeyAt(score: Score, measureNumber: number, staffId?: string): boolean {
  if (measureNumber === 1) return false
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false
  return removeKeyChangeAt(measure, staffId)
}

/** Insert or replace the beat-0 key change of a measure ON A STAFF, keeping the list sorted. */
function upsertKeyChange(measure: Measure, key: KeySignature, staffId?: string): boolean {
  measure.keys ??= []
  const existing = measure.keys.find(k => fracIsZero(k.beat) && sameStaff(k.staffId, staffId))
  if (existing) {
    if (keysEqual(existing.key, key)) return false
    existing.key = key
    return true
  }
  measure.keys.push({ id: uuidv4(), beat: BEAT_ZERO, key, ...(staffId !== undefined ? { staffId } : {}) })
  measure.keys.sort((a, b) => fracCompare(a.beat, b.beat))
  return true
}

/** Remove a measure's beat-0 key change ON A STAFF, if present. ⚠️ A mid-bar change (which only an
 *  import can produce) is left alone: this API addresses the head of the bar. */
function removeKeyChangeAt(measure: Measure, staffId?: string): boolean {
  if (!measure.keys) return false
  const idx = measure.keys.findIndex(k => fracIsZero(k.beat) && sameStaff(k.staffId, staffId))
  if (idx === -1) return false
  measure.keys.splice(idx, 1)
  if (measure.keys.length === 0) delete measure.keys
  return true
}
