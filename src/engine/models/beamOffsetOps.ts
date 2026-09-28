/**
 * ⭐ **A BEAM's score operation — its vertical hand nudge** (his ask, 2026-09-28: a selected beam pushed up or down
 * with ↑/↓ and `Ctrl+↑/↓`). What it writes is a {@link BeamOffsetOverride}; the undo entry and the limit that may
 * refuse a step are the command's (`engine/commands/beamCommands`). ⚠️ Its own module, beside `./beamOps` (which is what a NOTE says about its own beam — the fractional side).
 *
 * A beam has no id of its own — it is DERIVED from the meter's grouping and the notes' `beam` marks — so it is
 * addressed by the pitch a selected beam is anchored on (its group's first note, `beamGroup`), and its offset is
 * filed under that note's SLOT (see the type for why a slot).
 */
import type { BeamOffsetOverride, Score } from '@/types/music'
import { beamOffsetOverrideOf } from './engravingOverrides'
import { clearEngravingOverride, setEngravingOverride } from './overrideOps'
import { findSlot } from './slotLookup'

/** The slot a beam's anchor pitch stands in — what its offset is filed under. Undefined when it is not a chord's. */
export function beamOffsetSlotOf(score: Score, anchorNoteId: string): string | undefined {
  const found = findSlot(score, anchorNoteId)
  return found?.type === 'chord' ? found.chord.id : undefined
}

/** Which end of a beam — its first stem or its last. */
export type BeamEnd = 'start' | 'end'

/** The beam's current offset at each end, staff spaces AWAY from the heads (+ = longer stems) — 0 when never moved. */
export function beamOffsetOf(score: Score, anchorNoteId: string): { start: number; end: number } {
  const slotId = beamOffsetSlotOf(score, anchorNoteId)
  const o = slotId ? beamOffsetOverrideOf(score, slotId) : undefined
  return { start: o?.start ?? 0, end: o?.end ?? 0 }
}

/** Write both ends; both 0 deletes the entry, so "absent = the engraver's place" holds and the JSON stays clean. */
function write(score: Score, slotId: string, start: number, end: number): void {
  const round = (n: number) => (Math.abs(n) < 1e-9 ? 0 : Math.round(n * 1e6) / 1e6)
  const s = round(start)
  const e = round(end)
  if (s === 0 && e === 0) clearEngravingOverride(score, slotId, 'beamOffset')
  else setEngravingOverride(score, slotId, { kind: 'beamOffset', start: s, end: e } as BeamOffsetOverride)
}

/**
 * Move the WHOLE beam by `dAway` staff spaces AWAY from its noteheads (+ = longer stems — relative, so a flip keeps
 * its meaning), **accumulating**, at both ends — its angle kept. No undo entry here: the command owns it (and
 * translates the screen arrows into this).
 * @returns false when the anchor is not a chord's pitch — there is nothing to move.
 */
export function nudgeBeamOffset(score: Score, anchorNoteId: string, dAway: number): boolean {
  const slotId = beamOffsetSlotOf(score, anchorNoteId)
  if (!slotId) return false
  const { start, end } = beamOffsetOf(score, anchorNoteId)
  write(score, slotId, start + dAway, end + dAway)
  return true
}

/**
 * Set ONE end of the beam to `away` staff spaces from the heads — the other end stays, so the ANGLE changes (a
 * square dragged). Absolute, not accumulating: a drag frame writes where the hand is.
 * @returns false when the anchor is not a chord's pitch.
 */
export function setBeamEndOffset(score: Score, anchorNoteId: string, which: BeamEnd, away: number): boolean {
  const slotId = beamOffsetSlotOf(score, anchorNoteId)
  if (!slotId) return false
  const now = beamOffsetOf(score, anchorNoteId)
  write(score, slotId, which === 'start' ? away : now.start, which === 'end' ? away : now.end)
  return true
}

/** Set BOTH ends — a whole-beam drag frame writes where the hand is (absolute, not accumulating). */
export function setBeamOffset(score: Score, anchorNoteId: string, start: number, end: number): boolean {
  const slotId = beamOffsetSlotOf(score, anchorNoteId)
  if (!slotId) return false
  write(score, slotId, start, end)
  return true
}

/** Back to where the engraver put it — both ends. ⚠️ False when it was never moved — `Ctrl+Backspace` has other tenants. */
export function resetBeamOffset(score: Score, anchorNoteId: string): boolean {
  const slotId = beamOffsetSlotOf(score, anchorNoteId)
  return !!slotId && clearEngravingOverride(score, slotId, 'beamOffset')
}
