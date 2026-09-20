/**
 * The drag that re-anchors one END of a slur — a press on its square. The ink follows the hand, and
 * the anchor comes along when the ink reaches a note (`../slurEndpointWalk`): the arrow keys'
 * gesture with a mouse in it — same arithmetic, same module, same model state at the end of an
 * equal journey. A row of {@link beginHeldDrag}, whose hold was first built for this gesture.
 *
 * ⛔ Not a snap to the nearest notehead: that teleports the ink, can never place an end between two
 * notes, and wipes this end's nudge and the arc's shape on the way past (`slurOps.setSlurEndpoint`).
 * What shows where the end belongs is the anchor note itself, tinted for as long as the square is
 * armed, plus the dotted line back to where the engraver would have put the end — which is why a
 * frame renders the SCORE and not only the slurs.
 *
 * ⭐ A latch fires both ways — onto the next note and back onto the one the end already had —
 * because the walk reports the event rather than the cause. Several crossings in one frame (a fast
 * sweep) leave one hold, not N: a hand moving that fast is plainly not asking to be stopped at each
 * note on the way.
 *
 * The gesture starts from where the press LANDED, not from the square's centre, which would jerk
 * the end by the grab offset. The end stays ARMED after the drop — the drop ends the gesture, not
 * the selection — so the arrows carry on from where the hand stopped.
 */
import type { EditorState } from '../state/EditorState'
import { dragArmedSlurEndpoint } from '../slurEndpointWalk'
import { beginHeldDrag } from './heldDrag'
import type { DragHost, Gesture } from './gesture'

export function beginSlurEndpointDrag(
  host: DragHost, state: EditorState, slurId: string, which: 'start' | 'end', x: number, y: number,
): Gesture {
  return beginHeldDrag(host, {
    kind: 'slurEndpoint',
    family: 'score',
    label: `Slur endpoint ${which}`,
    id: slurId,
    // ⛔ null from the walk = nothing moved (a refusal, or no armed end): the anchor stays put.
    step: (engine, _cursorX, heldDx, dy) => {
      const move = dragArmedSlurEndpoint(state, engine, heldDx, dy)
      if (move === null) return { moved: false, wrapped: false, crossings: 0, latched: false, droppedPx: 0, gapAheadPx: 0 }
      return {
        moved: true, wrapped: false, crossings: move.crossings,
        latched: move.latched, droppedPx: move.discarded, gapAheadPx: move.gapAhead,
      }
    },
    commit: engine => engine.slur.commitSlurEndpoint(),
  }, x, y)
}
