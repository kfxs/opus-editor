/**
 * ⭐ **PARENTHESISED NOTES — the operations**, free functions over a `Score` (⛔ not methods on
 * `ScoreModel`). The brackets a head WEARS: `NotePitch.enclosure` (docs/plans/parenthesised-note-plan.md
 * N1, N2). The editor's half — the undo entry — is `engine/commands/enclosureCommands`.
 *
 * ⭐ Any head may wear them: a chord's, a GRACE's (on a note or on a rest), a fan MEMBER's (N5). ⛔ A
 * BRACKETED grace's may not — it is already in brackets — and `findSlot` never finds one here, because
 * this module does not ask for them (`{ bracketed: true }`): the refusal is the lookup's.
 *
 * ⛔ Absent is the only spelling of "none": taking the brackets off DELETES the field (the width-cache
 * key stringifies the slot, `laneFingerprint`).
 */
import type { Chord, HeadEnclosure, NotePitch, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { chordStoredPitches } from '@/utils/fannedBeam'
import { gracePitchesOf } from '@/utils/graceNotes'
import { bracketedPitchesOf } from '@/utils/bracketedGraces'
import { findSlot } from './slotLookup'

/** Every shape this build draws — the union's members, as a value (the JSON check reads it). */
export const HEAD_ENCLOSURES: readonly HeadEnclosure[] = ['round']

/** The head this id names — a chord's, a grace's, a fan member's — or undefined (a rest, a bracketed
 *  grace's pitch, an unknown id). */
function headOf(score: Score, pitchId: string): NotePitch | undefined {
  return findSlot(score, pitchId, { fanMembers: true, graceNotes: true })?.pitch
}

/** The brackets this head wears; undefined for none, or for an id that names no head. */
export function enclosureOf(score: Score, pitchId: string): HeadEnclosure | undefined {
  return headOf(score, pitchId)?.enclosure
}

/**
 * Put `shape` on each head, or take the brackets off (`null`). Ids that name no head — a rest, a
 * bracketed grace's pitch — are skipped.
 * @returns how many heads CHANGED (0 = nothing to record).
 */
export function setEnclosure(score: Score, pitchIds: readonly string[], shape: HeadEnclosure | null): number {
  let changed = 0
  for (const id of pitchIds) {
    const head = headOf(score, id)
    if (!head || (head.enclosure ?? null) === shape) continue
    if (shape) head.enclosure = shape
    else delete head.enclosure
    changed++
  }
  if (changed) dbg(`[enclosure] ${shape ?? 'none'} on ${changed} head(s)`)
  return changed
}

/**
 * ⭐ **The button's rule** (MuseScore's `toggleParentheses`, research A.4): if ANY of the heads is
 * without brackets, all of them get `shape`; if every one already wears them, all lose them. Only the
 * ids that name a head vote.
 * @returns what was written — the shape, `null` for "taken off", or undefined when no id named a head.
 */
export function toggleEnclosure(score: Score, pitchIds: readonly string[], shape: HeadEnclosure = 'round'): HeadEnclosure | null | undefined {
  const heads = pitchIds.map(id => headOf(score, id)).filter((h): h is NotePitch => h !== undefined)
  if (!heads.length) return undefined
  const next = heads.some(h => h.enclosure !== shape) ? shape : null
  setEnclosure(score, pitchIds, next)
  return next
}

/**
 * ⛔ **Report, never repair** (`docs/plans/json-io-plan.md`) — what a loaded file says about brackets
 * that this build cannot draw as written: a shape it does not know, or brackets on a bracketed grace.
 * `MusicEngine.loadJSON` warns each line; nothing is changed.
 */
export function enclosureProblems(score: Score): string[] {
  const problems: string[] = []
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      const heads = [...(slot.type === 'chord' ? chordStoredPitches(slot) : []), ...gracePitchesOf(slot)]
      for (const p of heads) {
        if (p.enclosure !== undefined && !HEAD_ENCLOSURES.includes(p.enclosure)) {
          problems.push(`bar ${measure.number}: head "${p.id}" has an unknown enclosure "${String(p.enclosure)}"`)
        }
      }
      for (const p of bracketedPitchesOf(slot)) {
        if (p.enclosure !== undefined) problems.push(`bar ${measure.number}: bracketed grace pitch "${p.id}" carries an enclosure — it is already in brackets`)
      }
    }
  }
  return problems
}

/**
 * ⭐ **Is the chord's ONE-PAIR switch in force?** (parenthesised-note-plan P5, his rule 2026-09-23: *"the
 * switch should only work when all the notes are in parenthesis"*). `Chord.enclosureSpan` says `'chord'` AND
 * every head wears brackets; otherwise each bracketed head keeps its own pair. ⭐ The ONE reader of the
 * field — the drawing, the room, the tie and the editor all ask this.
 */
export function chordEnclosureSpan(chord: Pick<Chord, 'notes' | 'enclosureSpan'>): 'chord' | null {
  return chord.enclosureSpan === 'chord' && chord.notes.length > 0 && chord.notes.every(p => p.enclosure) ? 'chord' : null
}

/** The CHORD a head belongs to, when it is a main chord's head (⛔ not a grace's or a fan member's). */
function mainChordOf(score: Score, pitchId: string): Chord | undefined {
  const found = findSlot(score, pitchId, { fanMembers: true, graceNotes: true })
  return found?.type === 'chord' && !found.grace && !found.member ? found.chord : undefined
}

/**
 * Set the chord's switch — one pair round the whole chord, or `null` for a pair per head (DELETES the field:
 * absent is the default's only spelling). ⛔ `'chord'` is refused unless every head wears brackets (his rule:
 * the switch is offered only then). @returns whether it changed.
 */
export function setEnclosureSpan(score: Score, pitchId: string, span: 'chord' | null): boolean {
  const chord = mainChordOf(score, pitchId)
  if (!chord || (chord.enclosureSpan ?? null) === span) return false
  if (span === 'chord' && !chord.notes.every(p => p.enclosure)) return false
  if (span) chord.enclosureSpan = span
  else delete chord.enclosureSpan
  dbg(`[enclosure] chord ${chord.id} → ${span ?? 'per head'}`)
  return true
}

/**
 * ⭐ The heads a selected pair of brackets COVERS — this head alone, or, when its chord's one-pair switch is
 * in force, every head of the chord (so Delete on the chord's pair takes the brackets off all of them).
 */
export function enclosureHeads(score: Score, pitchId: string): string[] {
  const chord = mainChordOf(score, pitchId)
  return chord && chordEnclosureSpan(chord) ? chord.notes.map(p => p.id) : [pitchId]
}

/**
 * The head whose id names the drawn pair this head's brackets are in — itself, or its chord's FIRST head
 * when the one-pair switch is in force (`layout/headEnclosure` files the chord's pair under it). What the
 * selected-note highlight asks, so any head of the chord lights the one pair.
 */
export function enclosureOwner(score: Score, pitchId: string): string {
  const chord = mainChordOf(score, pitchId)
  return chord && chordEnclosureSpan(chord) ? chord.notes[0].id : pitchId
}

/**
 * The chord's switch as the Properties row shows it: what is IN FORCE (`span`), what the user SET
 * (`stored` — kept while a head is unbracketed, his rule), and whether the switch may be used at all
 * (`available`: a chord of 2+ heads, every one in brackets). Undefined for a head that is not a main
 * chord's (a grace's, a fan member's, a rest).
 */
export function enclosureSpanState(score: Score, pitchId: string): { span: 'chord' | null; stored: 'chord' | null; available: boolean } | undefined {
  const chord = mainChordOf(score, pitchId)
  if (!chord) return undefined
  return {
    span: chordEnclosureSpan(chord),
    stored: chord.enclosureSpan ?? null,
    available: chord.notes.length > 1 && chord.notes.every(p => p.enclosure),
  }
}
