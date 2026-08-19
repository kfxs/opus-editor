/**
 * ⭐⭐ **WHICH LANES A DYNAMIC (OR A HAIRPIN) GOVERNS** — the scope axis of the dynamics family,
 * asked at a seam so there is one file to change. See docs/dynamic-voice-scope-plan.md.
 *
 * ⭐⭐ **ABSENT MEANS *ALL*, and that inverts `utils/lanes` for these two kinds only.** Everywhere
 * else in this model an absent `voice` means *the first one* (`voiceOf` — a note with no voice is
 * voice 1). A dynamic is not addressed by its lane, it *governs* lanes: a `p` under a piano staff
 * makes the whole staff quiet, and saying "voice 1" about it would be an accident of the default.
 * So the common case stores NOTHING, which is still the model's own idiom for a default — it is the
 * default itself that differs.
 *
 * ⛔ **`voiceOf()` must never be called on a `Dynamic` or a `Hairpin`.** It answers 0 for absent,
 * which is now exactly the wrong answer, and it fails silently — the mark simply governs one voice
 * instead of the staff. That is the whole reason this module exists rather than a branch at each
 * reader.
 *
 * ⭐ **ALL means every voice of the mark's OWN STAFF** — the ordinary notation rule. A dynamic under
 * the left hand does not govern the right, so {@link governsSlot} tests BOTH halves. ⚠️ It has to:
 * `resolveChordLevels` never compared staves at all, so before this module a staff-2 `p` already
 * governed staff-1's voice 1, and absent-means-ALL would have spread that to the whole score.
 *
 * ⚠️ **An absent `staffId` is a staff id here, not a missing answer** — the first staff stores an
 * absent id everywhere in this model (`utils/lanes`), so both sides are resolved against
 * `score.staves[0]` rather than normalised away. `pedalScope.pedalWindowCovers`' three lines, for
 * its reason: a `utils/` module may not reach into `engine/models/staffContent` for `matchesStaff`.
 *
 * Pure and engine-free, like {@link ./pedalScope} beside it.
 */
import type { Score } from '@/types/music'

/**
 * What a dynamic or a hairpin governs: one voice, or every voice of its staff.
 *
 * ⚠️ The voices are the MODEL's 0-based ones (`Note.voice`), not the Keypad's 1–4 — the editor's
 * display convention converts at its own edge (`EditorState.activeVoiceToModel`).
 */
export type VoiceScope = 'all' | 0 | 1 | 2 | 3

/**
 * The two fields the scope is made of, taken structurally so both `Dynamic` and `Hairpin` fit
 * without this module having to know which it was handed — they answer the same question and the
 * day a third dynamics-family mark arrives it fits too.
 */
export interface ScopedMark {
  voice?: 0 | 1 | 2 | 3
  staffId?: string
}

/** The voices a mark governs — **absent = `'all'`**. The dynamics family's `voiceOf`, and
 *  deliberately not in `utils/lanes`: it answers the opposite question with the opposite default. */
export function voiceScopeOf(mark: ScopedMark): VoiceScope {
  return mark.voice ?? 'all'
}

/** Does this scope reach `voice`? The voice half of {@link governsSlot}, which is the only caller —
 *  ⛔ deliberately not exported, see {@link onSameStaff} for why no POSITION question may ask it. */
function scopeCoversVoice(scope: VoiceScope, voice: 0 | 1 | 2 | 3): boolean {
  return scope === 'all' || scope === voice
}

/**
 * ⭐ The staff a mark or a slot belongs to, RESOLVED: an absent id IS the first staff's.
 *
 * ⚠️ Exported because a caller that BUCKETS by staff (`resolveChordLevels`' carried levels) must key
 * on the resolved value, not the raw field — `undefined` and the first staff's real id are the same
 * staff, and two buckets for it would let a mark miss the very slots it governs.
 */
export function staffScopeKey(score: Score, staffId: string | undefined): string | undefined {
  return staffId ?? score.staves?.[0]?.id
}

/**
 * ⭐⭐ **WHERE THE MARK MAY STAND — a STAFF question, and never a voice one** (his call, 2026-08-19:
 * *"walking should work in general no matter the voice"*).
 *
 * Scope and position are orthogonal, exactly as `Dynamic.staffId` and `Dynamic.voice` say they are:
 * the staff is where the mark IS, the voice is which of that staff's streams it speaks for. So every
 * POSITION reader asks this — the walk's stops, the drag's candidates, the drawn anchor, the wedge's
 * tips — and a mark narrowed to voice 2 still steps onto voice 1's notes, because they are columns
 * on its own staff and a column is a place. ⛔ Only {@link governsSlot} may look at the voice, and
 * only for the question the voice answers: who gets louder.
 */
export function onSameStaff(score: Score, mark: ScopedMark, slot: ScopedMark): boolean {
  return staffScopeKey(score, mark.staffId) === staffScopeKey(score, slot.staffId)
}

/**
 * ⭐ **Does `mark` govern this slot?** — both halves at once: the slot's staff must be the mark's,
 * and its voice must be in the mark's scope. ⚠️ The predicate for LOUDNESS (and for what hangs off a
 * note), ⛔ never for where a mark may sit — {@link onSameStaff} above.
 *
 * `slot` is anything carrying the lane pair — a `Chord`, a `Rest`, or a bare `{ voice, staffId }`.
 */
export function governsSlot(score: Score, mark: ScopedMark, slot: ScopedMark): boolean {
  if (!onSameStaff(score, mark, slot)) return false
  return scopeCoversVoice(voiceScopeOf(mark), slot.voice ?? 0)
}

/** Do two marks have the same scope? The idempotency test `hairpinOps.addHairpinOverNotes` needs —
 *  `undefined` and `0` are DIFFERENT scopes now, so `(a.voice ?? 0) === (b.voice ?? 0)` would call
 *  an ALL wedge a duplicate of a voice-1 one. */
export function sameScope(a: ScopedMark, b: ScopedMark): boolean {
  return voiceScopeOf(a) === voiceScopeOf(b)
}
