/**
 * **THE JOIN DRAG** — pull the grabbed end of a barline PAST THE MIDDLE of the gap between two
 * staves and the gap **flips**: an unjoined one joins, a joined one comes apart. Come back before
 * the middle and it is as it was (docs/barline-join-plan.md P3).
 *
 * ⭐ **The gesture is relative to the STATE, ⛔ not an absolute position** ("the gesture should be
 * opposite to the state"): grab the lower staff's square on an already-joined gap and pull away,
 * and an absolute reading has nothing to do. `joinedAtPointer` carries the table.
 *
 * ⛔ **No selection change, and no threshold.** The barline stays selected — that is what keeps the
 * square on screen — and there is no dead zone to tune, because the decision is a POSITION and not
 * a delta: a press that never moves is still on its own side of the middle, so a click cannot flip
 * anything.
 *
 * ⭐ **The preview IS the picture.** `previewBarlineJoinBelow` writes the model without undo and the
 * render redraws, so what shows mid-drag is drawn by exactly the code that draws it after the drop
 * — ⛔ never `GhostRenderer`, which is the table of what an armed MARKING TOOL will do to the next
 * click. It writes only on a CHANGE of the boolean, so wandering inside one half costs no renders.
 *
 * ⭐ **`baseline` and `current` keep the drop honest**: a gesture that crosses the middle and comes
 * back has written twice and changed nothing, and committing that would file an undo entry for a
 * score that never moved. ⛔ So the test is `current !== baseline`, never "was anything written" —
 * which the continuous drags can afford and a boolean cannot.
 */
import type { EditorState } from '../EditorState'
import {
  joinedAtPointer, squareAtPointer, type BarlineJoinGrab, type BarlineJoinSquareEnd,
} from '../elements/barlineJoinHandles'
import { dbg } from '../../utils/debug'
import type { DragHost, Gesture } from './gesture'

export function beginBarlineJoinDrag(host: DragHost, state: EditorState, grab: BarlineJoinGrab): Gesture {
  const baseline = host.getEngine()?.barlineJoinsBelow(grab.staffAbove, grab.measure) ?? false
  let current = baseline
  dbg(`Barline join drag ready | bar ${grab.measure} · gap below staff ${grab.staffAbove} · `
    + `${baseline ? 'joined' : 'not joined'} · middle of the gap at y ${grab.gapMidY.toFixed(1)} · `
    + `away is ${grab.awayIsDown ? 'down' : 'up'}`)

  /**
   * **The square jumps to the end the drag reached**, so the gesture is visible. The selection's
   * own `staff` + `pressedAt` ARE the lever — the highlight filters the gap's two squares by them
   * — so moving the pair turns the grabbed square off and the far one on with no new state and no
   * extra render: this runs on the frame already re-rendering for the flip. ⚠️ REASSIGN, never
   * mutate (`EditorState` traps the SET of a top-level field only). It does not change WHAT is
   * selected: the barline is one system-wide boundary and this pair was never part of its identity.
   */
  const moveSquare = ({ staff, end }: BarlineJoinSquareEnd): void => {
    const selected = state.selectedElement
    if (selected?.kind !== 'barline') return
    if (selected.staff === staff && selected.pressedAt === end) return
    state.selectedElement = { ...selected, staff, pressedAt: end }
  }

  return {
    kind: 'barlineJoin',

    move(engine, _x, y) {
      const want = joinedAtPointer(grab, y, baseline)
      if (want === current) return
      if (engine.previewBarlineJoinBelow(grab.staffAbove, want)) {
        current = want
        moveSquare(squareAtPointer(grab, y))
        host.render.renderScore()
      }
    },

    end() {
      const engine = host.getEngine()
      if (engine && current !== baseline) {
        engine.commitBarlineJoin()
        dbg(`Barline join ${current ? 'made' : 'removed'} | gap below staff ${grab.staffAbove}`)
      }
      host.release()
    },
  }
}
