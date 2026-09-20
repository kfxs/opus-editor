/**
 * ⭐ **THE TWO ENDPOINT SQUARES OF A SELECTED SPAN** — hairpin, ottava, pedal, trill: one at the
 * beginning, one at the end. The editor has ONE look for "this is an end of a span", so this is one
 * painter; it used to be four 34-line copies on `HighlightController`, each "the neighbour verbatim
 * but for the geometry it reads". The geometry is still the kind's own (`./<kind>Handles`), and it
 * arrives here as `handles`.
 *
 * ⭐ The armed square reads as PICKED — larger, a darker blue, a thicker white ring — the slur
 * squares' own rule and the same three numbers. Cosmetic only; the registered hit-box never changes,
 * so what you can grab does not move when you grab it.
 *
 * ⛔ Each square registers a `<kind>-endpoint` entry so a press can find it, under `<kind>Id` and
 * never `id` — `getById` answers with the FIRST entry holding one, so a square sharing the mark's
 * id would shadow the mark. `clearHighlights` removes them again, since the highlight pass owns them
 * (the render never draws one); the squares themselves ride the layer's undo log.
 */
import type { HighlightContext } from './highlightContext'

/** The ROUND slur handle's radius; a square's half-side is one more, so the two read as one size. */
export const HANDLE_R = 5
/** Half-side of the hit-box every handle registers — wider than its ink, a pointer's worth. */
export const HANDLE_HIT = 9

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
  const S = HANDLE_R + 1
  const cls = `${kind}-endpoint-handle`
  for (const handle of handles) {
    const armed = handle.which === selected.endpoint
    const half = armed ? S + 2 : S
    const sq = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    sq.setAttribute('x', String(handle.x - half))
    sq.setAttribute('y', String(handle.y - half))
    sq.setAttribute('width', String(half * 2))
    sq.setAttribute('height', String(half * 2))
    sq.setAttribute('fill', armed ? '#1D4ED8' : '#2563EB')
    sq.setAttribute('stroke', '#ffffff')
    sq.setAttribute('stroke-width', armed ? '2.5' : '1.5')
    sq.setAttribute('class', armed
      ? `${cls} ${cls}--${handle.which} ${cls}--selected`
      : `${cls} ${cls}--${handle.which}`)
    sq.style.cursor = 'pointer'
    ctx.addNode(ctx.svg, sq)

    ctx.registry.add({
      type: `${kind}-endpoint`,
      [`${kind}Id`]: selected.id,
      endpoint: handle.which,
      bbox: { x: handle.x - HANDLE_HIT, y: handle.y - HANDLE_HIT, width: HANDLE_HIT * 2, height: HANDLE_HIT * 2 },
    })
  }
}
