/**
 * **THE BEAM-ANGLE DRAG** — a press on one of the two squares of a selected beam (his ask, 2026-09-28: *"squares at the
 * edge of the beam… so I can control the angle of the beam"*). The grabbed END follows the pointer up or down; the
 * other end stays, so the beam tilts, and every stem is lengthened or shortened to meet it.
 *
 * ⭐ Stored RELATIVE to the stems (`BeamOffsetOverride` — + = away from the heads), so the pointer's screen travel is
 * turned into "away" by the side the beam stands on, read once at the press.
 *
 * ⭐ **The floor is read ONCE, at the press** (`layout/beamStemFloor.beamEndDragFloor`) — off the stems as drawn then —
 * and each frame clamps to it: a gesture may not read its own outcome (every frame re-engraves the bar it reads).
 *
 * ⭐ The preview IS the picture — each frame writes the model without undo and renders; the drop records ONE entry.
 * `baseline` keeps the drop honest: a gesture that wanders and comes back records nothing.
 */
import { beamEndDragFloor, beamGroupStems, beamStandsAbove } from '../../engine/layout/beamStemFloor'
import { dbg } from '../../utils/debug'
import { DRAG_DISTANCE_THRESHOLD_PX, type DragHost, type Gesture } from './gesture'

/** ⛔ null = the beam is not drawn, or its staff has no geometry — the press stays a plain selection. */
export function beginBeamEndDrag(
  host: DragHost, anchorNoteId: string, which: 'start' | 'end', pressY: number,
): Gesture | null {
  const engine = host.getEngine()
  if (!engine) return null
  const registry = engine.getElementRegistry()
  const lines = registry.getByType('beamGroup').filter(el => el.noteId === anchorNoteId)
  if (lines.length === 0) return null
  const spacePx = registry.getStaffGeometry(lines[0].measure ?? 0, lines[0].staff ?? 0)?.lineSpacing
  if (!spacePx) return null
  const stems = registry.getByType('stem')
  const above = beamStandsAbove(lines, beamGroupStems(lines, stems))
  const floor = beamEndDragFloor(lines, stems, spacePx, which)
  const baseline = engine.beam.offsetOf(anchorNoteId)[which]
  let current = baseline
  let live = false
  dbg(`Beam angle ready | ${which} end · from ${baseline} sp · floor ${floor === -Infinity ? 'none' : floor.toFixed(2)} sp`)

  return {
    kind: 'beamEnd',

    move(eng, _x, y) {
      // A press that has not yet travelled is still a click.
      if (!live && Math.abs(y - pressY) < DRAG_DISTANCE_THRESHOLD_PX) return false
      live = true
      const screenSpaces = (y - pressY) / spacePx
      // Screen-up is AWAY from the heads for a beam above its stems, TOWARD them for one below.
      const delta = Math.max(floor, above ? -screenSpaces : screenSpaces)
      const want = Math.round((baseline + delta) * 100) / 100
      if (want !== current && eng.beam.previewBeamEnd(anchorNoteId, which, want)) {
        current = want
        host.render.renderScore()
      }
      return true
    },

    end() {
      const eng = host.getEngine()
      if (eng && current !== baseline) {
        eng.beam.commitBeamEndDrag()
        dbg(`Beam angled | ${which} end ${baseline} → ${current} sp`)
      }
      host.release()
    },
  }
}
