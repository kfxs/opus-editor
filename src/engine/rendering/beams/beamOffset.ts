/**
 * ⭐ **A BEAM'S HAND NUDGE, HANDED TO THE BEAM** (his ask, 2026-09-28: a selected beam pushed up or down with the
 * arrows). Each beam built for a bar is told its {@link BeamOffsetOverride} — filed under the SLOT of the group's
 * first note, the chord a selected beam is anchored on (`beamHitInk.beamAnchorId`) — in px, BEFORE it formats:
 * `EngravedBeam.postFormat` moves the solved line by it and lengthens the stems to meet it.
 *
 * In STAFF spaces × `STAFF_SPACE_PX`, the tie's convention: the beam is drawn in its staff's own group, so a small
 * staff's beam moves by its own smaller space.
 *
 * ⛔ No DOM.
 */
import { beamOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { ChordRest, Score } from '@/types/music'
import type { EngravedBeam } from '../engraved/EngravedBeam'
import type { EngravedNote } from '../engraved/EngravedNote'

/** Tell each of `beams` its hand offset — AWAY from its noteheads, px (+ = longer stems; the beam turns it into a y). `slots` / `notes` are the lane's parallel arrays (slot `i` drew note `i`). */
export function applyBeamOffsets(
  score: Score, beams: readonly EngravedBeam[], slots: readonly ChordRest[], notes: readonly EngravedNote[],
): void {
  if (!score.engravingOverrides) return
  for (const beam of beams) {
    const first = beam.notes.map(note => slots[notes.indexOf(note)]).find(slot => slot?.type === 'chord')
    const away = first ? beamOffsetOverrideOf(score, first.id)?.away : undefined
    beam.handAwayPx = away ? away * STAFF_SPACE_PX : 0
  }
}
