/**
 * **A GESTURE IN FLIGHT** — what a press arms and `MouseController` holds exactly one of.
 *
 * A gesture owns its own state, in its closure: the mouse controller knows that one is live, hands
 * it every move, and ends it on the release. What the gesture is dragging, where it last accepted
 * the cursor and whether anything has been written yet are nobody else's business — which is what
 * keeps a new kind of drag from costing the controller five fields, a handler and an ender.
 *
 * ## THE RULE: a gesture ends on the RELEASE, wherever that release happens
 *
 * ⛔ Leaving the canvas ends nothing. Three paths see the release, so none can be missed:
 * `MouseController.onDocMouseUp` (document-level, capture phase), the canvas's own `mouseup`, and
 * `handleMouseMove`'s `buttons === 0` for a release outside the browser window, which fires no
 * `mouseup` at all. All three call {@link Gesture.end}, which must be safe to call once and must
 * release the host ({@link DragHost.release}) on its way out.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { RenderController } from '../RenderController'

/**
 * Every gesture a press can arm. ⭐ **Exactly ONE is ever live** — `handleMouseDown` is a chain of
 * branches that each `return`, so a press arms one thing or nothing.
 */
export type DragKind =
  | 'note' | 'barWidth' | 'barlineJoin' | 'clef' | 'staffSpacing' | 'staffGroupSpan'
  | 'slurHandle' | 'slurEndpoint' | 'slurBody'
  | 'dynamic' | 'tempo'
  | 'markEnd' | 'hairpinBody' | 'ottavaBody' | 'pedalBody' | 'trillBody'

export interface Gesture {
  kind: DragKind
  /** One mouse move, in SVG px. Absent on a gesture `MouseController` still drives itself. */
  move?: (engine: MusicEngine, x: number, y: number) => void
  /** Commit what the gesture wrote, and release the host. */
  end: () => void
}

/** A press is a click until it has been held this long; a gesture ignores moves before that. */
export const DRAG_TIME_THRESHOLD_MS = 150

/** What a gesture may ask of the controller that holds it. */
export interface DragHost {
  getEngine(): MusicEngine | null
  render: Pick<RenderController, 'previewMarks' | 'renderScore'>
  /** The gesture is over: the controller forgets it. */
  release(): void
}
