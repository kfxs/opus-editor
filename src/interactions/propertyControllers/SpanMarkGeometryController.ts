import type { MusicEngine } from '../../engine/MusicEngine'
import { SPAN_MARK_MODEL, type SpanMarkKind } from '../../engine/models/spanMarkModel'
import { SPAN_MARK_TOOLS, type SpanMarkGeometryTarget } from '../stamps/spanMarkTools'
import { dbg } from '../../utils/debug'

/**
 * ⭐⭐ **THE PROPERTIES PANEL'S OFFSET BOXES, FOR THE WHOLE SPAN-MARK FAMILY** — the typed twin of the
 * arrow keys that move a selected mark's ink. One controller reading {@link SPAN_MARK_TOOLS};
 * ⛔ **not** a `…GeometryController` per kind, which is what four of them were.
 *
 * The window is a **dumb publisher**: it writes an absolute number to its own bus store, the row
 * translates that store's spelling into a {@link SpanMarkGeometryTarget}, and this turns the target
 * into the engine's own nudge and repaints. Its two rules were identical in every copy:
 *
 * ⭐ **Absolute in, relative out.** The engine's nudge ACCUMULATES, so a typed absolute becomes
 * `delta = wanted − current` — which is what makes re-typing the same number a no-op rather than an
 * empty undo entry, and what puts the panel behind the same PAGE LIMIT as the keyboard
 * (docs/plans/engraving-overrides-plan.md §8; his report: *"the offset limit should also be true of
 * properties"*). ⛔ Writing the override directly from here would be a second door past that gate.
 *
 * ⚠️ **The current value is read from the COMPARTMENT, not from the request.** The panel could have
 * sent what it last painted, but a stale panel would then write a wrong delta: the number on screen
 * is a picture of the model, never a second copy of it.
 *
 * ⭐⭐ **THE VERTICAL IS ONE NUMBER FOR THE WHOLE MARK**, so it is asked for without an end named — and
 * it is applied through the START end only because an end has to be named, not because that end owns
 * it. Every kind's override carries a single vertical (a pedalling and its release share a baseline,
 * Gould p. 333; a bracket's two ends sit on one straight rule), so either square writes the same
 * field.
 *
 * ⭐ **No sign is flipped on this road.** The seam carries the MODEL's number and so does the nudge;
 * only the two EDGES with a direction on them convert — the keyboard (`↑` is a screen direction) and
 * the panel's own box (`+` is up, his rule for every offset box). ⛔ Converting here would leave
 * three places claiming to know which way is up.
 *
 * ⛔ It cannot touch a mark's EXTENT — which notes are held or displaced is the model, it is AUDIBLE,
 * and it has its own gestures (`Ctrl+Shift+←/→` and the drag, both measured in notes).
 *
 * ⚠️ **No `null` "reset" case**, the family's rule: for an offset the automatic value IS zero, so a
 * reset is a request for 0 and the model's own zero-pruning drops the entry.
 */
export class SpanMarkGeometryController {
  private unsubscribe: () => void

  constructor(
    private kind: SpanMarkKind,
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = SPAN_MARK_TOOLS[kind].onGeometrySet((target) => this.apply(target))
  }

  private apply({ id, field, wanted }: SpanMarkGeometryTarget): void {
    const engine = this.getEngine()
    if (!engine) return
    const model = SPAN_MARK_MODEL[this.kind]
    const delta = wanted - model.offsetOf(engine.getScore(), id, field)
    if (delta === 0) return // no change → no undo entry

    const tools = SPAN_MARK_TOOLS[this.kind]
    const moved = field === 'vertical'
      ? tools.nudgeEnd(engine, id, 'start', 0, delta)
      : tools.nudgeEnd(engine, id, field, delta, 0)
    if (!moved) return

    this.renderScore()
    const what = field === 'vertical'
      ? (model.vertical === 'outward' ? 'the outward distance' : 'the vertical')
      : `the ${field} ${model.endNoun}`
    const noun = model.noun.charAt(0).toUpperCase() + model.noun.slice(1)
    dbg(`[${noun}] Properties set ${what} → ${wanted} staff-space(s) | id:${id}`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
