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
import type { BeamMode, Chord, GraceGroup, GraceNote, GraceSide, NoteDuration, NotePitch, PitchSpelling, Rest, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { GRACE_SIDES, graceGroupOf, graceKey } from '@/utils/graceNotes'
import { chordStoredPitches } from '@/utils/fannedBeam'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { maxDots } from '@/utils/durations'
import { findSlot, type FoundSlot } from './slotLookup'
import { clearEngravingOverride, moveNoteOffsetKey } from './overrideOps'

/** The two forms a press makes. ⚠️ Read only when the GROUP is created: after that the slash is the
 *  group's own flag ({@link setGraceSlash}), one for the group (Gould p. 126). */
export type GraceForm = 'acciaccatura' | 'appoggiatura'

/** A grace's pitch — a spelling, and whether its sign is FORCED (an armed ♮ the key would hide). */
export type GraceSpelling = PitchSpelling & { forceAccidental?: boolean }

/** What a grace is DRAWN as — its written value. ⛔ Never counted. */
export interface GraceWritten {
  duration: NoteDuration
  dots?: number
}

/** Is this id a GRACE NOTE's pitch? The public face of `findSlot`'s opt-in — for the commands that
 *  must refuse one (a tie, a duration change: they are the SLOT's, and a grace is not one). */
export function isGraceNote(score: Score, noteId: string): boolean {
  return findSlot(score, noteId, { graceNotes: true })?.grace !== undefined
}

/** Where a grace group can hang: a chord (either side) or — BEFORE only — a rest (D7 reversed). */
type GraceHost = { graceBefore?: GraceGroup; graceAfter?: GraceGroup }

/**
 * Append a grace of `spelling` to the chord holding `hostNoteId`, on `side`, creating the group.
 * @returns the new grace, or null when refused:
 *
 * - **a grace AFTER a rest** — ⭐ a grace BEFORE a rest is taken (D7 reversed, his call 2026-09-22:
 *   the user enters the grace first, on an empty bar; the note that later takes the rest's place
 *   takes the group — `restGraceOps`). After a silence it is not a notation;
 * - **a fan MEMBER or a GRACE** as host — neither resolves without its opt-in, so both fail closed:
 *   the host is a SLOT's chord;
 * - **a tied CONTINUATION, for a grace BEFORE** — the attack is at the chain's head, and a grace
 *   between two tied notes would be struck into a note that is not struck;
 * - **a note TIED ON, for a grace AFTER** — the same, from the other end: a Nachschlag belongs to the
 *   END of its note (D2), and the end is the chain's last piece.
 *
 * @param index where it stands in the group, left to right — ⭐ the click's place (P2a: *"it should
 *   behave like note entry"*, a grace lands in the gap that was clicked). Absent = the end, beside the
 *   main note; clamped to the group.
 */
export function addGrace(
  score: Score,
  hostNoteId: string,
  side: GraceSide,
  spelling: GraceSpelling,
  form: GraceForm,
  written: GraceWritten,
  index?: number,
): GraceNote | null {
  const found = findSlot(score, hostNoteId)
  if (!found) {
    dbg(`[graceOps.addGrace] refused: ${hostNoteId} is not a slot's note (a fan member, a grace, or gone)`)
    return null
  }
  if (found.type === 'rest' && side === 'after') {
    dbg(`[graceOps.addGrace] refused: a grace AFTER a rest`)
    return null
  }
  if (found.type === 'rest') return appendGrace(found.rest, side, spelling, form, written, index)
  const chord = found.chord
  if (side === 'before' && chord.notes.every(p => p.tiedFrom)) {
    dbg(`[graceOps.addGrace] refused: a grace BEFORE a tied continuation — the attack is at the chain's head`)
    return null
  }
  if (side === 'after' && chord.notes.every(p => p.tiedTo)) {
    dbg(`[graceOps.addGrace] refused: a grace AFTER a note tied on — the note ends at the chain's last piece`)
    return null
  }

  return appendGrace(chord, side, spelling, form, written, index)
}

/**
 * ⭐ **A click in a grace's COLUMN adds its pitch: a grace CHORD** (P2a — note entry's chord rule).
 * The pitch is spelled as the caller spelled it; the grace takes the written value the click carries,
 * as a note-entry chord note brings its chord to the armed duration.
 * @returns the new pitch, or null when refused: not a grace, or ⛔ a pitch it already HAS (by sound —
 *   note entry's same-pitch rule).
 */
export function addGracePitch(
  score: Score, gracePitchId: string, spelling: GraceSpelling, written?: GraceWritten,
): NotePitch | null {
  const found = findSlot(score, gracePitchId, { graceNotes: true })
  if (!found?.grace) return null
  const note = found.grace.note
  const midi = spellingToMidi(spelling.step, spelling.alter, spelling.octave)
  if (note.pitches.some(p => spellingToMidi(p.step, p.alter, p.octave) === midi)) {
    dbg(`[graceOps.addGracePitch] refused: the grace already sounds ${spelling.step}${spelling.octave}`)
    return null
  }
  const pitch = newGracePitch(spelling)
  note.pitches.push(pitch)
  if (written) {
    note.duration = written.duration
    if (written.dots) note.dots = written.dots
    else delete note.dots
  }
  dbg(`[graceOps.addGracePitch] +${spelling.step}${spelling.octave} → a grace chord of ${note.pitches.length}`)
  return pitch
}

function newGracePitch(spelling: GraceSpelling): NotePitch {
  const pitch: NotePitch = { id: uuidv4(), step: spelling.step, alter: spelling.alter, octave: spelling.octave }
  // An explicitly armed sign the running rule would hide (a ♮ in C major) — note entry's courtesy.
  if (spelling.forceAccidental) pitch.forceAccidental = true
  return pitch
}

/** Put one grace into `host`'s group on `side` at `index` (absent = the end), creating the group (its
 *  slash from `form`). */
function appendGrace(
  host: Chord | Rest, side: GraceSide, spelling: GraceSpelling, form: GraceForm, written: GraceWritten, index?: number,
): GraceNote {
  const grace: GraceNote = { pitches: [newGracePitch(spelling)], duration: written.duration }
  if (written.dots) grace.dots = written.dots

  const at = host as GraceHost
  const key = graceKey(side)
  const group: GraceGroup = at[key] ?? { notes: [] }
  if (!at[key] && form === 'acciaccatura') group.slash = true
  const place = index === undefined ? group.notes.length : Math.max(0, Math.min(index, group.notes.length))
  group.notes.splice(place, 0, grace)
  at[key] = group
  dbg(`[graceOps.addGrace] ${side} ${host.type} ${host.id}: +${spelling.step}${spelling.octave} ${written.duration} at ${place} (${group.notes.length} in the group${group.slash ? ', slashed' : ''})`)
  return grace
}

/** The slot a found grace hangs on. */
function hostOf(found: FoundSlot): GraceHost {
  return found.type === 'chord' ? found.chord : found.rest
}

/**
 * Take a grace PITCH out; the last pitch of a grace takes the grace, the last grace takes the group
 * (never stored as `{ notes: [] }`). @returns whether anything was removed.
 */
export function removeGrace(score: Score, pitchId: string): boolean {
  const found = findSlot(score, pitchId, { graceNotes: true })
  if (!found?.grace || !found.pitch) return false
  const { pitch, grace } = found
  const host = hostOf(found)
  const key = graceKey(grace.side)
  const group = host[key]!
  // ⭐ Its OFFSET is keyed by the grace's first pitch (`ScoreModel.offsetTargetOf`): the key moves
  //    with the first pitch, and dies with the grace — the fan member's sweep.
  const offsetKey = grace.note.pitches[0].id
  if (grace.note.pitches.length > 1) {
    grace.note.pitches.splice(grace.note.pitches.indexOf(pitch), 1)
    if (pitch.id === offsetKey) moveNoteOffsetKey(score, offsetKey, grace.note.pitches[0].id)
    dbg(`[graceOps.removeGrace] one pitch of grace ${grace.index} (${grace.note.pitches.length} left)`)
    return true
  }
  group.notes.splice(grace.index, 1)
  clearEngravingOverride(score, offsetKey, 'noteOffset')
  if (group.notes.length === 0) delete host[key]
  dbg(`[graceOps.removeGrace] grace ${grace.index} ${grace.side} ${found.type} removed (${group.notes.length} left)`)
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
 * ⭐ **A grace's WRITTEN value** — what a duration key or the dot key does to a selected grace (plan §3:
 * *"a value set by hand with the duration keys is always respected"*). ⛔ Never counted, so nothing in
 * the bar moves. `dots: 0` deletes the field (absent is the only spelling of the default).
 * @returns whether anything changed.
 */
export function setGraceWritten(score: Score, pitchId: string, written: Partial<GraceWritten>): boolean {
  const found = findSlot(score, pitchId, { graceNotes: true })
  if (!found?.grace) return false
  const note = found.grace.note
  // ⭐ A grace is a note: the same dot limit (multiple-dots-plan D7, D1) — a value whose last dot would be
  //    worth less than the shortest duration is REFUSED WHOLE, ⛔ neither trimmed nor half-written.
  if ((written.dots ?? note.dots ?? 0) > maxDots(written.duration ?? note.duration)) return false
  let changed = false
  if (written.duration !== undefined && note.duration !== written.duration) {
    note.duration = written.duration
    changed = true
  }
  if (written.dots !== undefined && (note.dots ?? 0) !== written.dots) {
    if (written.dots > 0) note.dots = written.dots
    else delete note.dots
    changed = true
  }
  return changed
}

/**
 * The group on `side` of the chord `noteId` names — the id may be a pitch of the MAIN chord or of a
 * grace in that very group. A grace of the OTHER side's group answers undefined: the caller named a
 * group that id is not in.
 */
function groupAt(score: Score, noteId: string, side: GraceSide): { group: GraceGroup } | undefined {
  const found = findSlot(score, noteId, { graceNotes: true })
  if (!found || (found.type === 'chord' && found.member)) return undefined
  if (found.grace && found.grace.side !== side) return undefined
  const group = graceGroupOf(found.type === 'chord' ? found.chord : found.rest, side)
  return group ? { group } : undefined
}

/**
 * ⭐ Make the group a SELECTED grace belongs to an acciaccatura (slashed) or an appoggiatura — what a
 * grace button does to a selected grace (his rule, 2026-09-22; plan §3 rule 2). The FORM is the
 * group's (one slash per group, Gould p. 126), so every grace in it changes. @returns whether it changed.
 */
export function setGraceForm(score: Score, gracePitchId: string, form: GraceForm): boolean {
  const found = findSlot(score, gracePitchId, { graceNotes: true })
  if (!found?.grace) return false
  return setGraceSlash(score, gracePitchId, found.grace.side, form === 'acciaccatura')
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

/**
 * ⭐ **Flip the STEMS of the groups these graces belong to** — up ↔ down, `X` on selected graces (P6;
 * Gould p. 126: the lower part of two on a stave takes down-stems). The direction is the GROUP's, so
 * each group turns ONCE however many of its graces are named; UP is absent (the default's only
 * spelling). @returns how many groups turned.
 */
export function flipGraceStems(score: Score, gracePitchIds: readonly string[]): number {
  const turned = new Set<GraceGroup>()
  for (const id of gracePitchIds) {
    const found = findSlot(score, id, { graceNotes: true })
    if (!found?.grace) continue
    const group = graceGroupOf(found.type === 'chord' ? found.chord : found.rest, found.grace.side)
    if (!group || turned.has(group)) continue
    turned.add(group)
    setGraceStem(score, id, found.grace.side, group.stemDirection === 'down' ? null : 'down')
  }
  return turned.size
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
        if ('graceAfter' in slot) problems.push(`bar ${measure.number}: a REST carries graceAfter — a grace after a silence is not a notation`)
        seen.add(slot.id)
        continue
      }
      for (const p of chordStoredPitches(slot)) seen.add(p.id)
    }
  }
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
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

/**
 * ⭐ A grace's authored BEAM statement — a beam key with it selected (his report, 2026-09-23: *"the grace group
 * is not responding to the beaming of the beam palette"*). `auto` DELETES it (absent is the only spelling of
 * the default — the width-cache key's reason). @returns whether it changed.
 */
export function setGraceBeam(score: Score, pitchId: string, beam: BeamMode): boolean {
  const found = findSlot(score, pitchId, { graceNotes: true })
  const grace = found?.grace?.note
  if (!grace) return false
  const next = beam === 'auto' ? undefined : beam
  if (grace.beam === next) return false
  if (next) grace.beam = next
  else delete grace.beam
  dbg(`[graceOps.setGraceBeam] ${grace.pitches[0]?.step}${grace.pitches[0]?.octave} → ${beam}`)
  return true
}
