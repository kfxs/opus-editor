/**
 * WHERE A NOTE ID LIVES — the one slot lookup over a `Score`, extracted from {@link ScoreModel}
 * (docs/history/modularity-plan-2026-07-28.md Phase 3).
 *
 * It sits in its own module because it is what every `*Ops` module needs first: `markOps` and
 * `voiceOps` are free functions over a score, and almost all of them begin by resolving an id to
 * the slot that holds it. `ScoreModel` keeps a private delegator, so its own mutators read exactly
 * as they did.
 */
import type { ArticulationType, Attack, BracketedGrace, Note, Score, Chord, ChordRest, FanMemberChord, GraceNote, GraceSide, NotePitch, Rest } from '@/types/music'
import { GRACE_SIDES, graceGroupOf } from '@/utils/graceNotes'
import { BRACKETED_SIDES, bracketedOf, type BracketedSide } from '@/utils/bracketedGraces'

/** ⭐ Where a BRACKETED pitch hangs (docs/plans/bracketed-grace-plan.md P2b): its bracketed grace, the
 *  side and its place — and, when its target is a GRACE, that grace. ⛔ Not an attack ({@link attackOf}). */
export interface FoundBracketedPitch {
  note: BracketedGrace
  side: BracketedSide
  index: number
  /** The grace it is bent into, when that is its target; absent = the slot itself. */
  onGrace?: GraceNote
}

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
      /** ⭐ A GRACE NOTE's pitch: `chord` is its MAIN chord (the slot), `note` the grace itself —
       *  the attack its marks live on. `index` is its place in the group, left to right. */
      grace?: { side: GraceSide; index: number; note: GraceNote }
      /** ⭐ A BRACKETED grace's pitch — found only with `{ bracketed: true }`. */
      bracketed?: FoundBracketedPitch
    }
  | {
      type: 'rest'
      rest: Rest
      /** ⭐ Set only for a GRACE hung on this rest (D7 reversed) — its pitch and its place, as above. */
      pitch?: NotePitch
      grace?: { side: 'before'; index: number; note: GraceNote }
      /** ⭐ A BRACKETED grace's pitch before this rest (or before its grace) — `{ bracketed: true }` only. */
      bracketed?: FoundBracketedPitch
    }

/**
 * Find the slot containing the given note/pitch ID.
 *
 * ⭐ **A FANNED MEMBER'S pitch is found ONLY when asked for** (`{ fanMembers: true }`), and that
 * default is the safety rule of docs/plans/fanned-beam-pitches-plan.md §2 P3. A member is a real pitch
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
export function findSlot(
  score: Score,
  noteId: string,
  opts?: { fanMembers?: boolean; graceNotes?: boolean; bracketed?: boolean },
): FoundSlot | undefined {
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      // ⭐ A BRACKETED grace's pitch, on the grace's terms: found ONLY when asked for — so every mutator
      //    that assumes `slot.notes` (or an attack) refuses one instead of half-writing it.
      if (opts?.bracketed) {
        const found = bracketedIn(slot, noteId)
        if (found) {
          return slot.type === 'chord'
            ? { type: 'chord', chord: slot, pitch: found.pitch, bracketed: found.at }
            : { type: 'rest', rest: slot, pitch: found.pitch, bracketed: found.at }
        }
      }
      if (slot.type === 'rest' && slot.id === noteId) {
        return { type: 'rest', rest: slot }
      }
      // ⭐ A GRACE hung on a REST (D7 reversed), found on the same opt-in terms as a chord's.
      if (slot.type === 'rest' && opts?.graceNotes && slot.graceBefore) {
        const notes = slot.graceBefore.notes
        for (let k = 0; k < notes.length; k++) {
          const found = notes[k].pitches.find(n => n.id === noteId)
          if (found) return { type: 'rest', rest: slot, pitch: found, grace: { side: 'before', index: k, note: notes[k] } }
        }
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
        // ⭐ A GRACE's pitch, on the same terms as a member's: found ONLY when asked for, so every
        // mutator that assumes `slot.notes` refuses one instead of half-writing it
        // (docs/plans/grace-notes-plan.md §2).
        if (opts?.graceNotes) {
          for (const side of GRACE_SIDES) {
            const notes = graceGroupOf(slot, side)?.notes ?? []
            for (let k = 0; k < notes.length; k++) {
              const found = notes[k].pitches.find(n => n.id === noteId)
              if (found) return { type: 'chord', chord: slot, pitch: found, grace: { side, index: k, note: notes[k] } }
            }
          }
        }
      }
    }
  }
  return undefined
}

/** A bracketed pitch hung on this slot — its own lists, or its graces'. */
function bracketedIn(slot: ChordRest, noteId: string): { pitch: NotePitch; at: FoundBracketedPitch } | undefined {
  const scan = (list: readonly BracketedGrace[] | undefined, side: BracketedSide, onGrace?: GraceNote) => {
    for (let index = 0; index < (list?.length ?? 0); index++) {
      const pitch = list![index].pitches.find(p => p.id === noteId)
      if (pitch) return { pitch, at: { note: list![index], side, index, ...(onGrace && { onGrace }) } }
    }
    return undefined
  }
  for (const gs of GRACE_SIDES) {
    for (const g of graceGroupOf(slot, gs)?.notes ?? []) {
      const hit = scan(g.bracketedBefore, 'before', g)
      if (hit) return hit
    }
  }
  for (const side of BRACKETED_SIDES) {
    const hit = scan(bracketedOf(slot, side), side)
    if (hit) return hit
  }
  return undefined
}

/**
 * ⭐ **The ATTACK an id belongs to** — the thing a mark is written on and read from.
 *
 * The member when the id is a fanned member's, the GRACE when it is a grace's, the chord otherwise,
 * and `null` for a rest (silence is not struck). This one line is what lets a mark operation have ONE body: before it existed,
 * every such operation forked on `found.member` and wrote the same code twice, which is how a
 * member came to be missing marks the slot had had for a year.
 *
 * ⚠️ It answers "what carries the MARK", never "what carries the rhythm" — those are the same object
 * for an ordinary note and different objects inside a fan, which is the entire point. Reach for
 * `found.chord` when you mean the slot's duration, beat or stem; they belong to the gesture and a
 * member has none of its own.
 */
export function attackOf(found: FoundSlot): Attack | null {
  // ⛔ A BRACKETED pitch is information, not an attack (B6): no mark is struck with it.
  if (found.bracketed) return null
  if (found.type === 'rest') return found.grace?.note ?? null
  return found.grace?.note ?? found.member?.chord ?? found.chord
}

/**
 * Write a mark update onto an {@link Attack} — the one place `articulations` / `articulationPlacement`
 * are stored, whichever carrier they land on.
 *
 * ⚠️ Absent, never empty. `laneFingerprint` stringifies the whole slot for the width-cache key, so
 * `[]` and absent would be two keys for one piece of music; `undefined` and absent likewise. Only
 * the keys actually present in `updates` are touched, so a caller changing one mark field cannot
 * silently clear the other.
 */
export function writeAttackMarks(
  attack: Attack,
  updates: { articulations?: ArticulationType[]; articulationPlacement?: 'above' | 'below' },
): void {
  if ('articulations' in updates) {
    if (updates.articulations?.length) attack.articulations = [...updates.articulations]
    else delete attack.articulations
  }
  if ('articulationPlacement' in updates) {
    if (updates.articulationPlacement) attack.articulationPlacement = updates.articulationPlacement
    else delete attack.articulationPlacement
  }
}

/**
 * Copy an {@link Attack}'s marks onto the flat {@link Note} projection, replacing whatever came
 * through from the slot's chord. The read twin of {@link writeAttackMarks}: a mark field added to
 * `Attack` is reported by `getNote` the moment it is added here, rather than being quietly dropped
 * for members only.
 */
export function projectAttackMarks(note: Note, attack: Attack): void {
  if (attack.articulations?.length) note.articulations = [...attack.articulations]
  else delete note.articulations
  if (attack.articulationPlacement) note.articulationPlacement = attack.articulationPlacement
  else delete note.articulationPlacement
}

/**
 * ⭐ The KEY a note's horizontal offset is stored at — see `ScoreModel.offsetTargetOf`, its public
 * face, for the fan member's reasons. ⭐ A GRACE is keyed the member's way, by its own first pitch id,
 * and moves alone: its main note and the columns stay put (his call, 2026-09-22: *"a normal offset
 * with the grace"*).
 */
export function offsetTargetOf(score: Score, noteId: string): { key: string; memberIndex: number } | undefined {
  const found = findSlot(score, noteId, { fanMembers: true, graceNotes: true, bracketed: true })
  if (!found) return undefined
  // ⭐ A BRACKETED grace is keyed the grace's way, by its own first pitch id, and moves alone (his ask,
  //    2026-09-23: *"horizontal offset to the bracket similar to [grace]"*).
  if (found.bracketed) return { key: found.bracketed.note.pitches[0].id, memberIndex: 0 }
  if (found.grace) return { key: found.grace.note.pitches[0].id, memberIndex: 0 }
  if (found.type === 'rest') return { key: found.rest.id, memberIndex: 0 }
  if (!found.member) return { key: found.chord.id, memberIndex: 0 }
  return { key: found.member.pitches[0].id, memberIndex: found.member.index }
}
