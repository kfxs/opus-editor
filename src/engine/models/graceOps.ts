/**
 * ⭐ **GRACE NOTES — the operations**, free functions over a `Score` (⛔ not methods on `ScoreModel`).
 * `docs/plans/grace-notes-plan.md` §2.
 *
 * A grace is a CHILD of its main chord (D1, decided 2026-09-22): `Chord.graceBefore` /
 * `graceAfter`, never a slot. So nothing here touches the bar's arithmetic — adding or removing a
 * grace changes no beat, no capacity, no rest — and there is no repair to owe afterwards.
 *
 * What is NOT here, deliberately: a grace's PITCH, accidental and articulations. A grace pitch has a
 * real id, so those go through `attackOf` and `ScoreModel.updateNote` exactly as a fan member's do.
 */
import { v4 as uuidv4 } from 'uuid'
import type { Chord, GraceGroup, GraceNote, GraceSide, NoteDuration, NotePitch, PitchSpelling, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { GRACE_SIDES, graceGroupOf, graceKey } from '@/utils/graceNotes'
import { chordStoredPitches } from '@/utils/fannedBeam'
import { findSlot } from './slotLookup'

/** The two forms a press makes. ⚠️ Read only when the GROUP is created: after that the slash is the
 *  group's own flag ({@link setGraceSlash}), one for the group (Gould p. 126). */
export type GraceForm = 'acciaccatura' | 'appoggiatura'

/** What a grace is DRAWN as — its written value. ⛔ Never counted. */
export interface GraceWritten {
  duration: NoteDuration
  dots?: number
}

/** Is this id a GRACE NOTE's pitch? The public face of `findSlot`'s opt-in — for the commands that
 *  must refuse one (a tie, a duration change: they are the SLOT's, and a grace is not one). */
export function isGraceNote(score: Score, noteId: string): boolean {
  const found = findSlot(score, noteId, { graceNotes: true })
  return found?.type === 'chord' && found.grace !== undefined
}

/**
 * Append a grace of `spelling` to the chord holding `hostNoteId`, on `side`, creating the group.
 * @returns the new grace, or null when refused:
 *
 * - **a REST** — D7 (decided 2026-09-22, ⚠️ reversible): no book shows one, and `Rest` carries no
 *   grace field;
 * - **a fan MEMBER or a GRACE** as host — neither resolves without its opt-in, so both fail closed:
 *   the host is a SLOT's chord;
 * - **a tied CONTINUATION, for a grace BEFORE** — the attack is at the chain's head, and a grace
 *   between two tied notes would be struck into a note that is not struck;
 * - **a note TIED ON, for a grace AFTER** — the same, from the other end: a Nachschlag belongs to the
 *   END of its note (D2), and the end is the chain's last piece.
 */
export function addGrace(
  score: Score,
  hostNoteId: string,
  side: GraceSide,
  spelling: PitchSpelling,
  form: GraceForm,
  written: GraceWritten,
): GraceNote | null {
  const found = findSlot(score, hostNoteId)
  if (!found) {
    dbg(`[graceOps.addGrace] refused: ${hostNoteId} is not a slot's note (a fan member, a grace, or gone)`)
    return null
  }
  if (found.type === 'rest') {
    dbg(`[graceOps.addGrace] refused: a grace on a REST (plan D7)`)
    return null
  }
  const chord = found.chord
  if (side === 'before' && chord.notes.every(p => p.tiedFrom)) {
    dbg(`[graceOps.addGrace] refused: a grace BEFORE a tied continuation — the attack is at the chain's head`)
    return null
  }
  if (side === 'after' && chord.notes.every(p => p.tiedTo)) {
    dbg(`[graceOps.addGrace] refused: a grace AFTER a note tied on — the note ends at the chain's last piece`)
    return null
  }

  const pitch: NotePitch = { id: uuidv4(), step: spelling.step, alter: spelling.alter, octave: spelling.octave }
  const grace: GraceNote = { pitches: [pitch], duration: written.duration }
  if (written.dots) grace.dots = written.dots

  const key = graceKey(side)
  const group: GraceGroup = chord[key] ?? { notes: [] }
  if (!chord[key] && form === 'acciaccatura') group.slash = true
  group.notes.push(grace)
  chord[key] = group
  dbg(`[graceOps.addGrace] ${side} chord ${chord.id}: +${spelling.step}${spelling.octave} ${written.duration} (${group.notes.length} in the group${group.slash ? ', slashed' : ''})`)
  return grace
}

/**
 * Take a grace PITCH out; the last pitch of a grace takes the grace, the last grace takes the group
 * (never stored as `{ notes: [] }`). @returns whether anything was removed.
 */
export function removeGrace(score: Score, pitchId: string): boolean {
  const found = findSlot(score, pitchId, { graceNotes: true })
  if (found?.type !== 'chord' || !found.grace) return false
  const { chord, pitch, grace } = found
  const key = graceKey(grace.side)
  const group = chord[key]!
  if (grace.note.pitches.length > 1) {
    grace.note.pitches.splice(grace.note.pitches.indexOf(pitch), 1)
    dbg(`[graceOps.removeGrace] one pitch of grace ${grace.index} (${grace.note.pitches.length} left)`)
    return true
  }
  group.notes.splice(grace.index, 1)
  if (group.notes.length === 0) delete chord[key]
  dbg(`[graceOps.removeGrace] grace ${grace.index} ${grace.side} chord ${chord.id} removed (${group.notes.length} left)`)
  return true
}

/**
 * ⭐ **Take the grace AFTER off the END of the tie chain `headNoteId` starts** — the chain's last
 * piece is where a Nachschlag lives (D2) — for a caller about to rebuild that chain
 * (`spanningNoteOps`, a duration change across the barline, which re-makes the continuations from
 * the pitch alone and would otherwise drop it with the old tail). @returns the group, now detached.
 */
export function detachGraceAfterOfChain(score: Score, headNoteId: string): GraceGroup | undefined {
  let found = findSlot(score, headNoteId)
  for (let guard = 0; found?.type === 'chord' && found.pitch.tiedTo && guard < 64; guard++) {
    const next = findSlot(score, found.pitch.tiedTo)
    if (next?.type !== 'chord') break
    found = next
  }
  if (found?.type !== 'chord' || !found.chord.graceAfter) return undefined
  const group = found.chord.graceAfter
  delete found.chord.graceAfter
  return group
}

/** Hang `group` after the chord holding `noteId` — unless it has one of its own, which wins (one group
 *  per side). The other half of {@link detachGraceAfterOfChain}. @returns whether it was attached. */
export function attachGraceAfter(score: Score, noteId: string, group: GraceGroup): boolean {
  const found = findSlot(score, noteId)
  if (found?.type !== 'chord' || found.chord.graceAfter) return false
  found.chord.graceAfter = group
  return true
}

/**
 * The group on `side` of the chord `noteId` names — the id may be a pitch of the MAIN chord or of a
 * grace in that very group. A grace of the OTHER side's group answers undefined: the caller named a
 * group that id is not in.
 */
function groupAt(score: Score, noteId: string, side: GraceSide): { chord: Chord; group: GraceGroup } | undefined {
  const found = findSlot(score, noteId, { graceNotes: true })
  if (found?.type !== 'chord' || found.member) return undefined
  if (found.grace && found.grace.side !== side) return undefined
  const group = graceGroupOf(found.chord, side)
  return group ? { chord: found.chord, group } : undefined
}

/** Slash the group (acciaccatura) or not (appoggiatura). @returns whether it changed. */
export function setGraceSlash(score: Score, noteId: string, side: GraceSide, on: boolean): boolean {
  const at = groupAt(score, noteId, side)
  if (!at || !!at.group.slash === on) return false
  if (on) at.group.slash = true
  else delete at.group.slash
  return true
}

/** The group's stem: `'up'` / `'down'` by hand, null = the default (UP). Absent is the only spelling
 *  of the default, so null DELETES the field rather than pinning `'up'`. @returns whether it changed. */
export function setGraceStem(score: Score, noteId: string, side: GraceSide, direction: 'up' | 'down' | null): boolean {
  const at = groupAt(score, noteId, side)
  if (!at || (at.group.stemDirection ?? null) === direction) return false
  if (direction) at.group.stemDirection = direction
  else delete at.group.stemDirection
  return true
}

/** The group's own slur (D3): on = the default (absent), off = `false`. @returns whether it changed. */
export function setGraceSlur(score: Score, noteId: string, side: GraceSide, on: boolean): boolean {
  const at = groupAt(score, noteId, side)
  if (!at || (at.group.slur !== false) === on) return false
  if (on) delete at.group.slur
  else at.group.slur = false
  return true
}

/**
 * ⛔ **Report, never repair** (`docs/plans/json-io-plan.md`) — what a loaded file says about graces
 * that this build cannot hold as written. `MusicEngine.loadJSON` warns each line; nothing is changed.
 */
export function graceProblems(score: Score): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type === 'rest') {
        for (const side of GRACE_SIDES) {
          if (graceKey(side) in slot) problems.push(`bar ${measure.number}: a REST carries ${graceKey(side)} — a grace needs a note to belong to`)
        }
        continue
      }
      for (const p of chordStoredPitches(slot)) seen.add(p.id)
    }
  }
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      for (const side of GRACE_SIDES) {
        const group = graceGroupOf(slot, side)
        if (!group) continue
        const where = `bar ${measure.number}, ${graceKey(side)}`
        if (!Array.isArray(group.notes) || group.notes.length === 0) {
          problems.push(`${where}: a grace group with no notes`)
          continue
        }
        group.notes.forEach((note, k) => {
          if (!Array.isArray(note.pitches) || note.pitches.length === 0) {
            problems.push(`${where}: grace ${k} has no pitches`)
            return
          }
          for (const p of note.pitches) {
            if (seen.has(p.id)) problems.push(`${where}: grace ${k} pitch id "${p.id}" is not unique`)
            seen.add(p.id)
          }
        })
      }
    }
  }
  return problems
}
