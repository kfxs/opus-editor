/**
 * ⭐ **WHAT A NOTE'S BEAM ACTUALLY IS** — begin / continue / end / single — as opposed to what was authored
 * on it (`getNote().beam`, absent when nobody decided). Extracted from `ScoreModel.getBeamRole`, which keeps
 * a one-line delegation (`CLAUDE.md`: a new feature adds a MODULE), so the GRACE's answer has a home.
 *
 * - A SLOT's role is read against its whole LANE — its voice of its staff, sorted by beat — because a beam
 *   may cross a barline (docs/plans/cross-barline-beaming-plan.md).
 * - ⭐ A GRACE's role is read against its own GROUP's beam runs (`engrave/notes/graceBeam.graceBeamRuns`, the
 *   drawing's own rule): first of a run `begin`, last `end`, between `continue`, in none `single` — so the
 *   beam keys light for a selected grace as they do for a note (his report, 2026-09-23: *"the grace group is
 *   not responding to the beaming of the beam palette, it should be posible to do this similar to normal
 *   notes"*).
 *
 * @returns null for an unknown id, a REST (you cannot beam silence), and anything else that is not a slot's
 *   note or a grace — a fan member, a bracketed grace.
 */
import type { Score } from '@/types/music'
import { getMeterInfo } from '@/utils/meter'
import { fracCompare } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { beamRoleAtRef, type BeamRole } from '@/utils/beaming'
import { graceBeamRuns } from '@/engine/engrave/notes/graceBeam'
import { matchesStaff } from './staffContent'
import { findSlot } from './slotLookup'
import { graceGroupOf } from '@/utils/graceNotes'

export function beamRoleOf(score: Score, noteId: string): BeamRole | null {
  const graceRole = graceBeamRole(score, noteId)
  if (graceRole) return graceRole

  const measureIndex = score.measures.findIndex(m => m.slots.some(s =>
    s.type === 'rest' ? s.id === noteId : s.notes.some(n => n.id === noteId)))
  if (measureIndex === -1) return null

  const slot = score.measures[measureIndex].slots.find(s =>
    s.type === 'rest' ? s.id === noteId : s.notes.some(n => n.id === noteId))!
  if (slot.type === 'rest') return null

  const bars = score.measures.map(measure => ({
    slots: measure.slots
      .filter(s => matchesStaff(s.staffId, slot.staffId, score) && voiceOf(s) === voiceOf(slot))
      .sort((a, b) => fracCompare(a.beat, b.beat)),
    meter: getMeterInfo(measure.timeSignature),
  }))
  return beamRoleAtRef(bars, { bar: measureIndex, slot: bars[measureIndex].slots.indexOf(slot) })
}

/** A GRACE's role in its group's beam runs, or null when `noteId` is not a grace. */
function graceBeamRole(score: Score, noteId: string): BeamRole | null {
  const found = findSlot(score, noteId, { graceNotes: true })
  if (!found?.grace) return null
  const slot = found.type === 'chord' ? found.chord : found.rest
  const group = graceGroupOf(slot, found.grace.side)
  if (!group) return null
  const run = graceBeamRuns(group.notes).find(r => r.includes(found.grace!.index))
  if (!run) return 'single'
  const at = run.indexOf(found.grace.index)
  return at === 0 ? 'begin' : at === run.length - 1 ? 'end' : 'continue'
}
