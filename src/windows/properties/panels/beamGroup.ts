import { bus } from '@/bus'
import type { BeamOffsetOverride } from '@/types/music'
import { scalarOffsetRow } from '../rows'
import { overrideOf, type PanelRows } from './panel'

/**
 * ⭐ A selected BEAM's panel (his ask, 2026-09-28: *"the offset we have been doing in the beam and the endpoint
 * control I want to have it in the properties"*). Three boxes, in staff spaces AWAY from the noteheads (+ = longer
 * stems — the arrows' and the drags' own meaning, so a flip keeps it):
 *   • **offset** — the whole beam: the MIDDLE of its two ends; typing moves both, the angle kept;
 *   • **start** / **end** — one end each: the ANGLE.
 * Each box's `reset` puts its number back to 0. A DUMB PUBLISHER: it writes to `bus.beamOffset` and never touches
 * the engine (`interactions/propertyControllers/BeamOffsetController`), so a typed value meets the same band limit
 * and stem floor as the keys — a refused one simply comes back on the repaint.
 */
export const beamGroupRows: PanelRows<'beamGroup'> = (element) => {
  const anchorNoteId = element.data.noteId
  const offset = overrideOf<BeamOffsetOverride>(element, 'beamOffset')
  const start = offset?.start ?? 0
  const end = offset?.end ?? 0
  return [
    scalarOffsetRow('offset (sp)', (start + end) / 2,
      'The whole beam, staff spaces AWAY from the noteheads (+ = longer stems) — both ends move, the angle kept. The arrows’ and the drag’s number, typed.',
      middle => bus.beamOffset.set({ anchorNoteId, middle })),
    scalarOffsetRow('start (sp)', start,
      'The beam’s FIRST end, staff spaces away from the noteheads — the other end stays, so the angle changes. The start square’s number, typed.',
      value => bus.beamOffset.set({ anchorNoteId, start: value })),
    scalarOffsetRow('end (sp)', end,
      'The beam’s LAST end, staff spaces away from the noteheads — the other end stays, so the angle changes. The end square’s number, typed.',
      value => bus.beamOffset.set({ anchorNoteId, end: value })),
  ]
}
