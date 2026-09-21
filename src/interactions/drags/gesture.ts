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
import type { RenderController } from '../controllers/RenderController'

/**
 * Every gesture a press can arm. ⭐ **Exactly ONE is ever live** — `handleMouseDown` is a chain of
 * branches that each `return`, so a press arms one thing or nothing.
 */
export type DragKind =
  | 'note' | 'barWidth' | 'barlineJoin' | 'clef' | 'staffSpacing' | 'staffGroupSpan'
  | 'slurHandle' | 'slurEndpoint' | 'slurBody'
  | 'dynamic' | 'tempo'
  | 'markEnd' | 'hairpinBody' | 'ottavaBody' | 'pedalBody' | 'trillBody'
  | 'markGroup'

export interface Gesture {
  kind: DragKind
  /** One mouse move, in SVG px.
   *  ⚠️ Answer `false` for a move that is NOT YET the gesture's — a press still inside its dead zone
   *  is a click, and the controller carries on with what a plain move does (the hover, the ghost).
   *  Anything else, nothing included, means the gesture owns the move. */
  move: (engine: MusicEngine, x: number, y: number) => boolean | void
  /** Commit what the gesture wrote, and release the host. */
  end: () => void
}

/** A press is a click until it has been held this long; a gesture ignores moves before that. */
export const DRAG_TIME_THRESHOLD_MS = 150

/** …or, for a gesture told from a click by DISTANCE, until the pointer has travelled this far. A
 *  little wider than the pan's dead zone (`MouseController.PAN_THRESHOLD_PX`): the note drag also
 *  has to tell two gestures apart, and 4px of jitter is a coin toss between them. */
export const DRAG_DISTANCE_THRESHOLD_PX = 6

/** What a gesture may ask of the controller that holds it. */
export interface DragHost {
  getEngine(): MusicEngine | null
  render: Pick<RenderController, 'previewMarks' | 'renderScore'>
  /** The gesture is over: the controller forgets it. */
  release(): void
  /** The score canvas's CSS cursor; `''` hands it back to the stylesheet. */
  setCursor(cursor: string): void
}
