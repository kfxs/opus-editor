/**
 * ⭐ **TIES** — which note a tie joins to, and the two ways the editor asks for one: a single note
 * (`toggleTie`) and a whole selection (`planTieSelection` + `applyTiePairs`). Score logic, moved off `MusicEngine`
 * (docs/plans/code-shape-plan-2026-09-19.md, Phase 4.1): the facade keeps the undo entry and nothing else.
 *
 * ⭐ **One rule for the target, where the two callers each spelled it**: a tie goes to the next slot
 * STRICTLY AFTER the source in its own stream — the source's voice AND staff, because voices and
 * staves are independent streams — and within that slot it prefers the SAME PITCH, so a chord ties
 * like to like. Failing that it takes whatever is there, a different pitch or a rest included: the
 * "let ring" / l.v. tie.
 *
 * ⚠️ Two notes tying into one target is fine: a tie is owned by each source's `tiedTo`, and deleting
 * the target reassigns ALL of them onto the replacement rest (`deleteNoteOps.deleteNoteWithRepair`).
 *
 * ⛔ A FANNED MEMBER cannot carry a tie: a tie is a pitch-to-pitch continuation, and a member has
 * no length of its own to continue into (docs/plans/fanned-beam-pitches-plan.md §3). A single-note ask is
 * refused; in a selection the member is DROPPED, since the other notes were selected too.
 */
import type { Note, NoteParams, Score, TieOffsetOverride } from '@/types/music'
import { tieOffsetOverrideOf } from './engravingOverrides'
import { clearEngravingOverride, setEngravingOverride } from './overrideOps'
import { dbg } from '@/utils/debug'
import { fracToNumber } from '@/utils/fraction'
import { staffOf, voiceOf } from '@/utils/lanes'
import { compareByPosition } from '@/utils/musicUtils'
import { formatPitch } from '@/utils/pitchSpelling'

/** What tying needs of the score — `ScoreModel` answers all of it. */
export interface TieModel {
  getNote(id: string): Note | undefined
  getAllNotes(): Note[]
  isFanMember(noteId: string): boolean
  updateNote(noteId: string, updates: Partial<NoteParams>): Note
  clearTieDirection(fromNoteId: string): unknown
}

const describe = (n: Note) =>
  n.isRest ? 'rest' : `${formatPitch(n)} m${n.measure} beat:${fracToNumber(n.beat).toFixed(3)}`

/**
 * The note `source` would tie forward to, or null at the end of its stream. `sorted` is every note
 * in reading order.
 */
export function tieTargetOf(sorted: readonly Note[], source: Note): Note | null {
  const stream = sorted.filter(n => voiceOf(n) === voiceOf(source) && staffOf(n) === staffOf(source))
  const next = stream.find(n => compareByPosition(n, source) > 0)
  if (!next) return null
  const samePitch = stream.find(n =>
    compareByPosition(n, next) === 0 && !n.isRest
    && n.step === source.step && (n.alter ?? 0) === (source.alter ?? 0) && n.octave === source.octave)
  return samePitch ?? next
}

/**
 * Toggle the forward tie of one note. @returns true when a tie was ADDED, false when one was
 * REMOVED, null when nothing changed (a rest, a fanned member, or no next slot to tie to).
 */
export function toggleTie(model: TieModel, noteId: string): boolean | null {
  if (model.isFanMember(noteId)) {
    dbg(`[Fan] tie refused on member ${noteId} — it attaches to the slot, not to one member`)
    return null
  }
  const note = model.getNote(noteId)
  if (!note || note.isRest) return null
  dbg(`[Tie] toggleTie | source: ${describe(note)}`)

  if (note.tiedTo) {
    const tiedToNote = model.getNote(note.tiedTo)
    dbg(`[Tie] removing existing tie → was tied to: ${tiedToNote ? describe(tiedToNote) : 'NOT FOUND'}`)
    const tiedToId = note.tiedTo
    // Drop any flip override so a future re-tie starts from auto placement again.
    model.clearTieDirection(noteId)
    model.updateNote(noteId, { tiedTo: undefined })
    // The target may be gone (e.g. severed by a re-bar) — only clear it if present.
    if (tiedToNote) model.updateNote(tiedToId, { tiedFrom: undefined })
    return false
  }

  const sorted = model.getAllNotes().sort(compareByPosition)
  const source = sorted.find(n => n.id === noteId)
  const target = source ? tieTargetOf(sorted, source) : null
  if (!target) {
    dbg(`[Tie] no next slot found — tie not created`)
    return null
  }
  dbg(`[Tie] tying to next slot: ${describe(target)}`)
  model.updateNote(noteId, { tiedTo: target.id })
  model.updateNote(target.id, { tiedFrom: noteId })
  return true
}

/** One tie a selection asks for. */
export interface TiePair { source: Note; target: Note }

/**
 * What tying a whole selection WOULD do — resolved before anything is written, because the caller
 * names its undo entry after the answer ("Add ties" / "Remove ties").
 *
 * Each selected note ties to the same pitch in the next slot, so a chord ties pitch-for-pitch to
 * the next chord. Notes at the LAST selected position do not tie forward (nothing in the selection
 * follows them) — but a single-position selection (one chord) does, matching the single-note
 * behaviour. `allTied` = every resolved pair is already tied, so the press toggles them OFF.
 *
 * ⭐ `single`: one usable note is not a selection — it routes to {@link toggleTie}, which keeps
 * tie-into-rest and the flip-direction reset on removal.
 *
 * @returns null when there is nothing to tie.
 */
export function planTieSelection(
  model: TieModel, noteIds: readonly string[],
): { single: string } | { pairs: TiePair[]; allTied: boolean } | null {
  const ids = [...new Set(noteIds.filter(id => !model.isFanMember(id)))]
  if (ids.length <= 1) return ids[0] ? { single: ids[0] } : null

  const sorted = model.getAllNotes().sort(compareByPosition)
  const selected = ids
    .map(id => sorted.find(n => n.id === id))
    .filter((n): n is Note => !!n && !n.isRest)
    .sort(compareByPosition)
  if (selected.length === 0) return null

  const posKey = (n: Note) => `${n.measure}:${fracToNumber(n.beat)}`
  const positions = [...new Set(selected.map(posKey))]
  const lastPos = positions[positions.length - 1]
  const sources = positions.length > 1 ? selected.filter(n => posKey(n) !== lastPos) : selected

  const pairs: TiePair[] = []
  for (const source of sources) {
    const target = tieTargetOf(sorted, source)
    if (target) pairs.push({ source, target })
  }
  if (pairs.length === 0) return null
  return { pairs, allTied: pairs.every(p => p.source.tiedTo === p.target.id) }
}

/** Write a {@link planTieSelection} answer: every pair tied, or — when all already were — untied. */
export function applyTiePairs(model: TieModel, pairs: readonly TiePair[], allTied: boolean): void {
  for (const { source, target } of pairs) {
    if (allTied) {
      model.clearTieDirection(source.id)
      model.updateNote(source.id, { tiedTo: undefined })
      model.updateNote(target.id, { tiedFrom: undefined })
    } else if (source.tiedTo !== target.id) {
      model.updateNote(source.id, { tiedTo: target.id })
      model.updateNote(target.id, { tiedFrom: source.id })
    }
  }
}

/**
 * Clear `tiedTo`/`tiedFrom` pointers that reference ids no longer present in the
 * score (e.g. after re-barring regenerates region slot ids). Ties are severed,
 * never left dangling, so tie editing/rendering can't hit a missing note.
 */
export function repairDanglingTies(score: Score): void {
  const ids = new Set<string>()
  for (const m of score.measures) {
    for (const s of m.slots) {
      if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
      else ids.add(s.id)
    }
  }
  for (const m of score.measures) {
    for (const s of m.slots) {
      if (s.type === 'chord') {
        for (const p of s.notes) {
          if (p.tiedTo && !ids.has(p.tiedTo)) delete p.tiedTo
          if (p.tiedFrom && !ids.has(p.tiedFrom)) delete p.tiedFrom
        }
      } else if (s.tiedFrom && !ids.has(s.tiedFrom)) {
        delete s.tiedFrom
      }
    }
  }
}

/**
 * ⭐ Move a tie's arc by `dy` staff spaces (screen-signed, + is down), **accumulating** — the arrows
 * on a selected tie ({@link TieOffsetOverride}). A net 0 deletes the entry, so "absent = the
 * engraver's place" holds and the JSON stays clean. No undo entry here: the command owns it.
 *
 * @returns false when `fromNoteId` owns no tie — there is nothing to move.
 */
export function nudgeTieOffset(score: Score, fromNoteId: string, dy: number): boolean {
  if (!ownsTie(score, fromNoteId)) return false
  const y = (tieOffsetOverrideOf(score, fromNoteId)?.y ?? 0) + dy
  if (y === 0) clearEngravingOverride(score, fromNoteId, 'tieOffset')
  else setEngravingOverride(score, fromNoteId, { kind: 'tieOffset', y } as TieOffsetOverride)
  return true
}

/** Back to where the engraver put it. ⚠️ False when it was never moved — `Ctrl+Backspace` has other
 *  tenants behind it, and a "yes" for no change would swallow the press. */
export function resetTieOffset(score: Score, fromNoteId: string): boolean {
  return clearEngravingOverride(score, fromNoteId, 'tieOffset')
}

function ownsTie(score: Score, fromNoteId: string): boolean {
  for (const measure of score.measures) for (const slot of measure.slots) {
    if (slot.type === 'chord' && slot.notes.some(p => p.id === fromNoteId && !!p.tiedTo)) return true
  }
  return false
}

