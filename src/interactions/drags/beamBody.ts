/**
 * **THE WHOLE-BEAM DRAG** — a press on a beam's own ink that then travels (his ask, 2026-09-28: *"the same offset we
 * are doing with the whole beam with arrow… also by dragging"*). Both ends follow the pointer up or down together —
 * the angle kept — and every stem is lengthened or shortened to meet the beam. A press that does not travel stays a
 * plain click: it selects.
 *
 * The square's drag (`./beamEnd`) with both ends moving: the pointer's screen travel is turned into "away from the
 * heads" by the side the beam stands on, the floor is read ONCE at the press (the SHORTEST stem decides,
 * `layout/beamStemFloor.beamBodyDragFloor`), every frame previews, the drop records ONE entry.
 */
import { beamBodyDragFloor, beamGroupStems, beamStandsAbove } from '../../engine/layout/beamStemFloor'
import { dbg } from '../../utils/debug'
import { DRAG_DISTANCE_THRESHOLD_PX, type DragHost, type Gesture } from './gesture'

/** ⛔ null = the beam is not drawn, or its staff has no geometry — the press stays a plain selection. */
export function beginBeamBodyDrag(host: DragHost, anchorNoteId: string, pressY: number): Gesture | null {
  const engine = host.getEngine()
  if (!engine) return null
  const registry = engine.getElementRegistry()
  const lines = registry.getByType('beamGroup').filter(el => el.noteId === anchorNoteId)
  if (lines.length === 0) return null
  const spacePx = registry.getStaffGeometry(lines[0].measure ?? 0, lines[0].staff ?? 0)?.lineSpacing
  if (!spacePx) return null
  const stems = registry.getByType('stem')
  const above = beamStandsAbove(lines, beamGroupStems(lines, stems))
  const floor = beamBodyDragFloor(lines, stems, spacePx)
  const baseline = engine.beam.offsetOf(anchorNoteId)
  let delta = 0
  let live = false
  dbg(`Beam drag ready | from ${baseline.start}/${baseline.end} sp · floor ${floor === -Infinity ? 'none' : floor.toFixed(2)} sp`)

  return {
    kind: 'beamBody',

    move(eng, _x, y) {
      // A press that has not yet travelled is still a click (it selected the beam).
      if (!live && Math.abs(y - pressY) < DRAG_DISTANCE_THRESHOLD_PX) return false
      live = true
      const screenSpaces = (y - pressY) / spacePx
      // Screen-up is AWAY from the heads for a beam above its stems, TOWARD them for one below.
      const want = Math.round(Math.max(floor, above ? -screenSpaces : screenSpaces) * 100) / 100
      if (want !== delta && eng.beam.previewBeamOffset(anchorNoteId, baseline.start + want, baseline.end + want)) {
        delta = want
        host.render.renderScore()
      }
      return true
    },

    end() {
      const eng = host.getEngine()
      if (eng && delta !== 0) {
        eng.beam.commitBeamDrag()
        dbg(`Beam moved | ${delta} sp away`)
      }
      host.release()
    },
  }
}
