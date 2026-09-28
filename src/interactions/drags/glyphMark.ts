/**
 * ⭐ **DRAGGING A USER SYMBOL** (docs/plans/symbol-plan.md P4) — its hand offset follows the pointer, in
 * staff spaces, both axes. The symbol stays on its EVENT: a drag moves its ink, never which note it belongs
 * to (that is a cut and paste). Each frame writes the offset with no undo entry and renders; the drop
 * records ONE entry (`engine.glyphMark.commitDrag`).
 *
 * ⚠️ A frame is a full render, the beam drag's arrangement — a symbol has no preview family of its own yet.
 */
import { dbg } from '../../utils/debug'
import { DRAG_DISTANCE_THRESHOLD_PX, type DragHost, type Gesture } from './gesture'

/** Offsets are kept to a hundredth of a space — finer is noise, and it keeps the saved numbers readable. */
const round = (v: number): number => Math.round(v * 100) / 100

/** ⛔ null = the symbol is not drawn, or its staff has no geometry — the press stays a plain selection. */
export function beginGlyphMarkDrag(host: DragHost, id: string, press: { x: number; y: number }): Gesture | null {
  const engine = host.getEngine()
  if (!engine) return null
  const registry = engine.getElementRegistry()
  const drawn = registry.getById(id)
  if (!drawn) return null
  const spacePx = registry.getStaffGeometry(drawn.measure ?? 0, drawn.staff ?? 0)?.lineSpacing
  if (!spacePx) return null
  const from = engine.glyphMark.offsetOf(id)
  let now = from
  let live = false

  return {
    kind: 'glyphMark',

    move(eng, x, y) {
      // A press that has not yet travelled is still a click (it selected the symbol).
      if (!live && Math.hypot(x - press.x, y - press.y) < DRAG_DISTANCE_THRESHOLD_PX) return false
      live = true
      const want = { x: round(from.x + (x - press.x) / spacePx), y: round(from.y + (y - press.y) / spacePx) }
      if ((want.x !== now.x || want.y !== now.y) && eng.glyphMark.previewOffset(id, want.x, want.y)) {
        now = want
        host.render.renderScore()
      }
      return true
    },

    end() {
      const eng = host.getEngine()
      if (eng && (now.x !== from.x || now.y !== from.y)) {
        eng.glyphMark.commitDrag()
        dbg(`Symbol moved | offset ${now.x}, ${now.y} sp`)
      }
      host.release()
    },
  }
}
