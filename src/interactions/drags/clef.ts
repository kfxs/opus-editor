/**
 * The drag that slides a MOVABLE clef — every clef except the big line-start one — along its staff:
 * the cursor snaps to a slot boundary in whatever measure it is over and the change is relocated
 * there, across measures, one undo entry on the drop.
 *
 * ⭐ The exact `Fraction` beat is recovered from the MODEL at the press — the pixel beat on the
 * registry entry is rounded, and a drag has to move the real change.
 *
 * ⭐ **Line breaks are FROZEN for the gesture**, so sliding the clef re-pitches notes without
 * reflowing the score under the hand; the drop unfreezes and renders once, which settles the layout
 * and drops a clef `commitClefMove` found redundant at its final spot. ⚠️ That unfreeze-and-render
 * runs even when nothing moved: the freeze was taken at the press.
 *
 * The staff does not move with the drag — a clef slides along its own staff.
 */
import type { ElementInfo } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { Fraction } from '../../types/music'
import { fracEq, fracToNumber } from '../../utils/fraction'
import { dbg } from '../../utils/debug'
import { selectedOf, type EditorState } from '../EditorState'
import { DRAG_TIME_THRESHOLD_MS, type DragHost, type Gesture } from './gesture'

/**
 * @param slotBeatAt The slot boundary under an x in a measure — the controller's own resolver,
 *   which the marking tools share.
 * @returns ⛔ null for the immovable line-start clef, or a clef the model does not hold.
 */
export function beginClefDrag(
  host: DragHost,
  state: EditorState,
  clefAt: ElementInfo,
  slotBeatAt: (engine: MusicEngine, x: number, measure: number) => Fraction,
): Gesture | null {
  if (clefAt.immovable || clefAt.measure === undefined) return null
  const engine = host.getEngine()
  if (!engine) return null
  const approxBeat = clefAt.beat ?? 0
  const change = engine.getScore().measures.find(m => m.number === clefAt.measure)
    ?.clefs?.find(c => Math.abs(fracToNumber(c.beat) - approxBeat) < 1e-6)
  if (!change) return null

  const start = { measure: clefAt.measure, beat: change.beat }
  let at = start
  const pressedAt = Date.now()
  engine.setLayoutFrozen(true)
  engine.setDraggingClef(start)

  return {
    kind: 'clef',

    move(eng, x, y) {
      if (Date.now() - pressedAt < DRAG_TIME_THRESHOLD_MS) return
      const measure = eng.pixelToMeasure({ x, y })
      const beat = slotBeatAt(eng, x, measure)
      if (measure === at.measure && fracEq(beat, at.beat)) return
      if (!eng.moveClef(at.measure, at.beat, measure, beat)) return
      at = { measure, beat }
      // ⚠️ REASSIGN, never mutate — the selection follows the clef to its new address.
      state.selectedElement = {
        kind: 'clef', measure, beat: fracToNumber(beat), staff: selectedOf(state, 'clef')?.staff ?? 0,
      }
      eng.setDraggingClef(at)
      dbg(`Clef drag | measure:${measure} beat:${fracToNumber(beat)}`)
      host.render.renderScore()
    },

    end() {
      const eng = host.getEngine()
      if (eng && (at.measure !== start.measure || !fracEq(at.beat, start.beat))) {
        eng.commitClefMove(at.measure, at.beat)
        dbg(`Clef moved | measure:${at.measure} beat:${fracToNumber(at.beat)}`)
      }
      host.release()
      if (eng) {
        eng.setDraggingClef(null)
        eng.setLayoutFrozen(false)
        host.render.renderScore()
      }
    },
  }
}
