/**
 * **A BODY drag: a whole span mark follows the hand** — sideways through the music, its ink
 * interpolating between the notes, and onto another staff or system when the hand leaves its own.
 * The hairpin, the ottava and the pedal share this frame; what differs is each family's walk
 * (`../hairpinWalk`, `../ottavaWalk`, `../pedalWalk`) and its row here.
 *
 * The rules every body drag keeps:
 *
 * - **The delta is measured from the last ACCEPTED frame.** On a refusal (the page limit) the
 *   anchor is left where it was, so the gesture re-synchronises when the cursor comes back instead
 *   of the mark jumping the distance it never travelled.
 * - **A jump ends the FRAME, ⛔ not the gesture.** The mark has landed where the hand is, so the hand
 *   carries straight on; what must not happen is spending this frame's `dx` against a slot it was
 *   never near. (The walk decides that; the frame only reports `jumped`.)
 * - **A frame draws its own family and nothing else** (`previewMarks`): the music does not move
 *   while a mark does. ⚠️ A walk that decides from the mark's OWN DRAWN INK is only sound while
 *   the preview draws it exactly where a full render would — a preview that reads the last
 *   render's stale lane views redraws the mark on the staff it left, and the walk crosses again.
 * - ⛔ **The drop renders for real.** The frames leave the ladder around the mark unrestacked, and
 *   `commitPreviewed` deliberately paints nothing; leaving the cheap picture standing is the one
 *   thing a preview may never do.
 * - **One undo entry per gesture**, and none when the press never became a drag.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { MarkPreviewKind } from '../../engine/rendering/marks/markPreviewPass'
import { dbg } from '../../utils/debug'
import { DRAG_TIME_THRESHOLD_MS, type DragHost, type DragKind, type Gesture } from './gesture'

/** What a family's walk answers for one frame. ⛔ null = the mark is not drawn, so there is no
 *  px→staff-space scale to convert with: the frame is dropped and the anchor left alone. */
export type BodyFrame = { moved: boolean; jumped: boolean } | null

/** One family's row. */
export interface BodyDragSpec {
  kind: DragKind
  /** The family a frame redraws. */
  family: MarkPreviewKind
  /** For the log line. */
  label: string
  /** One frame of the family's walk: the cursor's x, and its delta since the last accepted frame. */
  step(engine: MusicEngine, id: string, cursorX: number, dxPx: number, dyPx: number): BodyFrame
  /** After an accepted frame has been DRAWN. Answer true when it wrote again, and the frame draws a
   *  second time — inside the same mouse event, so the first picture is never on screen. */
  afterFrame?(engine: MusicEngine, id: string, frame: NonNullable<BodyFrame>): boolean
  /** Before the commit, so the one undo entry carries it — a landing on the very last frame is
   *  still owed its settlement, and there is no next frame to pay it. */
  beforeCommit?(engine: MusicEngine, id: string): void
  /** Record the gesture's ONE undo entry. */
  commit(engine: MusicEngine): void
}

/**
 * @param press Where the press landed — the first frame's delta is measured from there. ⚠️ Omit it
 *   for a mark that is its OWN handle (a dynamic), armed on the very press that selects it: the
 *   baseline is then taken on the first frame PAST the time threshold, because the travel that
 *   decided this was a drag rather than a click belongs to neither, and charging it would start
 *   the gesture with a jump.
 */
export function beginBodyDrag(
  host: DragHost, spec: BodyDragSpec, id: string, press?: { x: number; y: number },
): Gesture {
  let last = press ?? null
  let changed = false
  const pressedAt = Date.now()

  return {
    kind: spec.kind,

    move(engine, mx, my) {
      if (Date.now() - pressedAt < DRAG_TIME_THRESHOLD_MS) return
      if (last === null) { last = { x: mx, y: my }; return }
      const frame = spec.step(engine, id, mx, mx - last.x, my - last.y)
      if (frame === null || !frame.moved) return
      last = { x: mx, y: my }
      changed = true
      host.render.previewMarks(spec.family, id)
      if (spec.afterFrame?.(engine, id, frame)) host.render.previewMarks(spec.family, id)
    },

    end() {
      const engine = host.getEngine()
      if (engine && changed) {
        spec.beforeCommit?.(engine, id)
        spec.commit(engine)
        host.render.renderScore()
        dbg(`${spec.label} moved | id:${id}`)
      }
      host.release()
    },
  }
}
