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
 * @see docs/plans/key-signature-plan.md §1.2, §8.1
 */
import type { CautionaryKeyGapOverride, KeyChange, KeySignature, Measure, Score } from '@/types/music'
import { cautionaryKeyGapKey, cautionaryKeyGapOf } from './engravingOverrides'
import { clearEngravingOverride, setEngravingOverride } from './overrideOps'
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
 * staff — and at measure 1, to C major.
 *
 * ## ⭐⭐ MEASURE 1 IS **NOT** PROTECTED, and the reason it once was does not apply to us
 *
 * 🚨 **His report, 2026-08-28:** three flats at bar 1, selected, Delete — *"here i remove the key but
 * nothing hapend i still see the key on screen."* The guard that refused him was copied from
 * MuseScore, which disables deleting bar 1's key **in its own words** because *"it is impossible to
 * know whether you want a C major/A minor key signature, or an 'open/atonal' one"*.
 *
 * ⭐ **That impossibility is theirs, not ours.** §1.1 decided open/atonal is a DISTINCT VALUE carried
 * by `mode` — `keysEqual` compares it, so an open key at measure 1 stores a real change while C major
 * stores nothing. Our model can tell the two apart, so "nothing stored at bar 1" has exactly one
 * meaning (C major) and removing a change there is a sayable, unambiguous edit. ⛔ Do not restore the
 * refusal by pointing at MuseScore again: the citation is right and the premise is not.
 *
 * ⚠️ **And it is NOT the clef's case either**, which is the comparison that made the guard look
 * natural: a staff must be read in SOME clef, so there is no "no clef" state to revert to and removal
 * is genuinely meaningless there (`elements/clef.ts`). Every bar is in some key, and C major is one.
 *
 * @returns true if a change was removed.
 */
export function removeKeyAt(score: Score, measureNumber: number, staffId?: string): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false
  return removeKeyChangeAt(measure, staffId)
}

/**
 * ⭐⭐ **A NEW STAFF ADOPTS ITS NEIGHBOUR'S KEY SIGNATURES** — every change on `fromStaffId`, copied
 * onto `toStaffId` bar for bar.
 *
 * 🚨 **His report, 2026-08-28:** with three flats set at bar 1, *"Added staff below staff 0 … the new
 * stave has no key signature."* Dead right, and it is the per-staff model showing through: a key
 * change is stored per staff (that is what lets Bartók write four sharps against four flats), so a
 * staff that did not exist when the key was written carries none and reads as C major.
 *
 * ⭐ **Why a key is not a CLEF here**, which is the comparison that decides the fix: a fresh staff
 * deliberately carries no clef change and resolves to the universal `'treble'` default, because
 * "which clef" is a fact about the INSTRUMENT and the user is expected to say. A key signature is a
 * fact about the MUSIC — one statement for the system in every classical score, which is why a plain
 * drop writes all staves (`interactions/stamps/keySignatureStamp`, MuseScore's polarity). Defaulting a new
 * staff to C major would be answering that question wrongly rather than leaving it open.
 *
 * ⚠️ Copies from the REFERENCE staff rather than from staff 0, so an added staff joins the hand it
 * was added beside — the best available answer where the two hands genuinely differ, and identical to
 * "all staves" in every score where they do not.
 *
 * ⭐ The signature is CLONED, never shared: two staves pointing at one `KeySignature` object would
 * make a later edit of one silently change the other.
 *
 * @returns true if the score changed.
 */
export function copyStaffKeys(score: Score, fromStaffId: string | undefined, toStaffId: string): boolean {
  // The absent-`staffId` convention, resolved on BOTH sides exactly as `keyOnStaff` does — the source
  // staff's changes are untagged whenever it is (or was) the first staff.
  const first = score.staves?.[0]?.id
  const onFrom = (k: KeyChange) => (k.staffId ?? first) === (fromStaffId ?? first)
  const onTo = (k: KeyChange) => (k.staffId ?? first) === toStaffId

  let changed = false
  for (const measure of score.measures) {
    const sources = (measure.keys ?? []).filter(onFrom)
    if (sources.length === 0) continue
    measure.keys ??= []
    for (const source of sources) {
      const copy = cloneKey(source.key)
      const existing = measure.keys.find(k => onTo(k) && fracCompare(k.beat, source.beat) === 0)
      if (existing) {
        if (keysEqual(existing.key, copy)) continue
        existing.key = copy
      } else {
        measure.keys.push({ id: uuidv4(), beat: source.beat, key: copy, staffId: toStaffId })
      }
      changed = true
    }
    measure.keys.sort((a, b) => fracCompare(a.beat, b.beat))
  }
  return changed
}

/** A signature nobody else holds a reference to — see {@link copyStaffKeys}. */
function cloneKey(key: KeySignature): KeySignature {
  return {
    alterations: key.alterations.map(a => ({ ...a })),
    ...(key.mode !== undefined ? { mode: key.mode } : {}),
  }
}

/**
 * ⭐⭐ **Set (or clear) the bare staff drawn after this change's CAUTIONARY at a system break** — in
 * staff spaces, `null` to hand it back to the engraver.
 *
 * 🚨 **His ask, 2026-08-28:** *"lets make what we have now default but give the user the freedom to
 * change the number in properties."* The default is `CAUTIONARY_KEY_TO_LINE_END`, and Gould's own
 * figure measures 1.9 sp there — so the freedom matters precisely because the sources and his eye
 * disagree, and neither should be nailed into the drawing.
 *
 * ⚠️ **Keyed by the measure the CHANGE starts at**, not by the bar that happens to draw the courtesy
 * — which bar ends a system moves on every reflow, and the author's decision must not move with it.
 * `cautionaryKeyGapKey` is that key, and the meter's and the clef's cautionary overrides are keyed
 * the same way for the same reason.
 *
 * ⭐ **Geometry, so it lives in the OVERRIDES compartment** and never on `KeyChange`: a number of
 * staff spaces is not what key the music is in, and transposition, playback and re-barring must be
 * able to walk the model without stepping over pixels (docs/plans/engraving-overrides-plan.md).
 *
 * ⛔ A gap of **0 is a real answer** ("no tail at all") and is stored, not treated as absent.
 *
 * @returns true if the score changed.
 */
export function setCautionaryKeyGap(
  score: Score, measureNumber: number, gap: number | null, staffId?: string,
): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false
  const key = cautionaryKeyGapKey(measure.id, staffId)
  if (gap === null) {
    if (cautionaryKeyGapOf(score, measure.id, staffId) === undefined) return false
    clearEngravingOverride(score, key, 'cautionaryKeyGap')
    return true
  }
  if (!(gap >= 0) || !Number.isFinite(gap)) return false
  if (cautionaryKeyGapOf(score, measure.id, staffId) === gap) return false
  const override: CautionaryKeyGapOverride = { kind: 'cautionaryKeyGap', gap }
  setEngravingOverride(score, key, override)
  return true
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
