/**
 * **THE FOUR SPAN FAMILIES' SQUARE DRAG, AS A TABLE** — the wedge's tip, the bracket's end, the
 * pedal's sign and the trill's. The ink follows the hand and the END comes along through the music
 * when the ink reaches a stop, so the mouse and the arrows are one gesture and land in one state
 * (`../hairpinWalk`, `../ottavaWalk`, `../pedalWalk`, `../trillWalk`). {@link beginHeldDrag} is the
 * frame; what differs between the families is these three columns.
 *
 * ⭐ Adding the fifth family adds a ROW, ⛔ not a fifth handler.
 *
 * ⭐ Every family ends the gesture on a WRAP, and gets there by the SAME road — a `BreakWrapPort`,
 * `markBreakWrap.breakCrossing` (whose arrival test is symmetric, so it crosses BOTH ways) and
 * `leaveSystem`. ⛔ Not a rule of the trill's own: two bespoke tests were written for it and both
 * were wrong, the second stopping the drag before a crossing could happen at all. The only
 * family-specific thing there is the RULER — the trill's port measures on the ribbon.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import { dragHairpinEndpoint } from '../hairpinWalk'
import { dragOttavaEndpoint } from '../ottavaWalk'
import { dragPedalEndpoint } from '../pedalWalk'
import { dragTrillEndpoint } from '../trillWalk'
import { beginHeldDrag, type HeldFrame } from './heldDrag'
import type { DragHost, Gesture } from './gesture'

type End = 'start' | 'end'

interface MarkEndRow {
  label: string
  drag(engine: MusicEngine, id: string, which: End, cursorX: number, dxPx: number, dyPx: number): HeldFrame
  commit(engine: MusicEngine, which: End): void
}

const MARK_END_DRAGS = {
  hairpin: { label: 'Hairpin end', drag: dragHairpinEndpoint, commit: (engine, which) => engine.commitHairpinDrag(which) },
  ottava: { label: 'Ottava end', drag: dragOttavaEndpoint, commit: (engine, which) => engine.ottava.commitOttavaDrag(which) },
  pedal: { label: 'Pedal end', drag: dragPedalEndpoint, commit: (engine, which) => engine.pedal.commitPedalDrag(which) },
  trill: { label: 'Trill end', drag: dragTrillEndpoint, commit: (engine, which) => engine.trill.commitTrillDrag(which) },
} as const satisfies Record<string, MarkEndRow>

/** Which families have a square that can be dragged through the music. */
export type MarkEndKind = keyof typeof MARK_END_DRAGS

/**
 * A press on a square opens the gesture. ⛔ null when the arming left no id or no end behind: there
 * would be nothing for a frame to move, and a gesture with a hole in it is worse than none.
 */
export function beginMarkEndDrag(
  host: DragHost,
  kind: MarkEndKind,
  armed: { id?: string; endpoint?: End } | null | undefined,
  x: number,
  y: number,
): Gesture | null {
  if (!armed?.id || !armed.endpoint) return null
  const { id, endpoint } = armed
  const row: MarkEndRow = MARK_END_DRAGS[kind]
  return beginHeldDrag(host, {
    kind: 'markEnd',
    family: kind,
    label: `${row.label} ${endpoint}`,
    id,
    step: (engine, cursorX, heldDx, dy) => row.drag(engine, id, endpoint, cursorX, heldDx, dy),
    commit: engine => row.commit(engine, endpoint),
  }, x, y)
}
