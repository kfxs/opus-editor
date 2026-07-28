/**
 * WHERE A NOTE ID LIVES — the one slot lookup over a `Score`, extracted from {@link ScoreModel}
 * (docs/modularity-plan-2026-07-28.md Phase 3).
 *
 * It sits in its own module because it is what every `*Ops` module needs first: `markOps` and
 * `voiceOps` are free functions over a score, and almost all of them begin by resolving an id to
 * the slot that holds it. `ScoreModel` keeps a private delegator, so its own mutators read exactly
 * as they did.
 */
import type { Score, Chord, FanMemberChord, NotePitch, Rest } from '@/types/music'

/** What an id resolved to: a pitch inside a chord (possibly a fanned MEMBER), or a rest slot. */
export type FoundSlot =
  | {
      type: 'chord'
      chord: Chord
      pitch: NotePitch
      /** ⭐ `chord` is the MEMBER's own record — a member is a chord in its own right, so what it
       *  carries beyond its pitches (its articulations) is addressed through this and not through
       *  the SLOT's chord above. `pitches` stays for the readers that only ever wanted those. */
      member?: { index: number; pitches: NotePitch[]; chord: FanMemberChord }
    }
  | { type: 'rest'; rest: Rest }

/**
 * Find the slot containing the given note/pitch ID.
 *
 * ⭐ **A FANNED MEMBER'S pitch is found ONLY when asked for** (`{ fanMembers: true }`), and that
 * default is the safety rule of docs/fanned-beam-pitches-plan.md §2 P3. A member is a real pitch
 * with a real id, so an id can now name something that is NOT in `slot.notes` — and almost every
 * mutator assumes it is: the delete paths are `chord.notes.filter(n => n.id !== pitch.id)`,
 * which would no-op on a member and report success, and the tie would write `tiedTo` onto a pitch
 * `TieRenderer` looks up in `slot.notes` — stored, never drawn, invisible until export.
 *
 * Failing CLOSED turns every one of those into a refusal (the caller gets `undefined` and returns
 * null/false) instead of a silent half-write, and a mutator written next year refuses without
 * knowing fans exist. The handful of callers that genuinely mean "this pitch, wherever it lives"
 * — `getNote`, `getNotePitch`, `slotIdForNote`, `updateNote`, `deleteNote` — opt in, and each
 * states what it does with a member.
 */
export function findSlot(score: Score, noteId: string, opts?: { fanMembers?: boolean }): FoundSlot | undefined {
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type === 'rest' && slot.id === noteId) {
        return { type: 'rest', rest: slot }
      }
      if (slot.type === 'chord') {
        const pitch = slot.notes.find(n => n.id === noteId)
        if (pitch) return { type: 'chord', chord: slot, pitch }
        if (opts?.fanMembers && slot.fan?.members) {
          for (let k = 0; k < slot.fan.members.length; k++) {
            const found = slot.fan.members[k].pitches.find(n => n.id === noteId)
            // `index` is the member's place in the GROUP (1-based), not in the list: member 0 is
            // the slot's own chord, so the list holds members 1…count-1.
            if (found) return { type: 'chord', chord: slot, pitch: found, member: { index: k + 1, pitches: slot.fan.members[k].pitches, chord: slot.fan.members[k] } }
          }
        }
      }
    }
  }
  return undefined
}
