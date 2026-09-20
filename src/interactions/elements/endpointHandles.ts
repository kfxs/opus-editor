/**
 * ⭐ **THE TWO ENDPOINT SQUARES OF A SELECTED SPAN** — hairpin, ottava, pedal, trill: one at the
 * beginning, one at the end. The editor has ONE look for "this is an end of a span", so this is one
 * painter; it used to be four 34-line copies on `HighlightController`, each "the neighbour verbatim
 * but for the geometry it reads". The geometry is still the kind's own (`./<kind>Handles`), and it
 * arrives here as `handles`.
 *
 * ⭐ The armed square reads as PICKED — `./handleSquare`'s look, which the square itself owns.
 *
 * ⛔ Each square registers a `<kind>-endpoint` entry so a press can find it, under `<kind>Id` and
 * never `id` — `getById` answers with the FIRST entry holding one, so a square sharing the mark's
 * id would shadow the mark. `clearHighlights` removes them again, since the highlight pass owns them
 * (the render never draws one); the squares themselves ride the layer's undo log.
 */
import type { HighlightContext } from './highlightContext'
import { handleHitBox, paintHandleSquare } from './handleSquare'

export type EndpointHandleKind = 'hairpin' | 'ottava' | 'pedal' | 'trill'

export interface EndpointHandle {
  which: 'start' | 'end'
  x: number
  y: number
}

export function paintEndpointHandles(
  ctx: HighlightContext,
  kind: EndpointHandleKind,
  selected: { id: string; endpoint?: 'start' | 'end' },
  handles: readonly EndpointHandle[],
): void {
  const cls = `${kind}-endpoint-handle`
  for (const handle of handles) {
    const armed = handle.which === selected.endpoint
    paintHandleSquare(ctx, handle, {
      className: armed
        ? `${cls} ${cls}--${handle.which} ${cls}--selected`
        : `${cls} ${cls}--${handle.which}`,
      cursor: 'pointer',
      armed,
    })
    ctx.registry.add({
      type: `${kind}-endpoint`,
      [`${kind}Id`]: selected.id,
      endpoint: handle.which,
      bbox: handleHitBox(handle),
    })
  }
}
