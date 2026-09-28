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

/** The beam's current offset, staff spaces AWAY from the heads (+ = longer stems) — 0 when it was never moved. */
export function beamOffsetOf(score: Score, anchorNoteId: string): number {
  const slotId = beamOffsetSlotOf(score, anchorNoteId)
  return (slotId && beamOffsetOverrideOf(score, slotId)?.away) || 0
}

/**
 * Move the beam by `dAway` staff spaces AWAY from its noteheads (+ = longer stems — relative, so a flip keeps its
 * meaning), **accumulating**. A net 0 deletes the entry, so "absent = the engraver's place" holds and the JSON stays
 * clean. No undo entry here: the command owns it (and translates the screen arrows into this).
 * @returns false when the anchor is not a chord's pitch — there is nothing to move.
 */
export function nudgeBeamOffset(score: Score, anchorNoteId: string, dAway: number): boolean {
  const slotId = beamOffsetSlotOf(score, anchorNoteId)
  if (!slotId) return false
  const away = (beamOffsetOverrideOf(score, slotId)?.away ?? 0) + dAway
  if (Math.abs(away) < 1e-9) clearEngravingOverride(score, slotId, 'beamOffset')
  else setEngravingOverride(score, slotId, { kind: 'beamOffset', away } as BeamOffsetOverride)
  return true
}

/** Back to where the engraver put it. ⚠️ False when it was never moved — `Ctrl+Backspace` has other tenants. */
export function resetBeamOffset(score: Score, anchorNoteId: string): boolean {
  const slotId = beamOffsetSlotOf(score, anchorNoteId)
  return !!slotId && clearEngravingOverride(score, slotId, 'beamOffset')
}
