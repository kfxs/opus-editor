import type { Widget } from '../content/Widget'
import { bus } from '@/bus'
import type { InspectedElement } from '../../interactions/inspectedElement'
import { panelRowsFor } from './panels'
import { AMBER, PHOSPHOR } from './rows'

/**
 * What is selected, as the model holds it.
 *
 * A SKETCH, deliberately: it stringifies, it does not edit. Properties will eventually offer the
 * controls for each kind of element, and the way to find out what those controls should be is to
 * look at the objects for a while — which is precisely what this does. It is also the honest state
 * of the seam: the selection reaches this window and repaints when it moves; only the widgets are
 * missing.
 *
 * The panel reads {@link bus.inspection} and nothing else. It never touches EditorState, never
 * holds the engine, and cannot write — so no edit can escape from a window that is not yet an
 * editor.
 */
export class PropertiesWidget implements Widget {
  private body: HTMLElement | null = null
  private unsubscribe: (() => void) | null = null

  mount(host: HTMLElement): void {
    host.style.overflow = 'hidden'

    const body = document.createElement('div')
    const s = body.style
    s.flex = '1'
    s.minHeight = '0'
    s.overflow = 'auto'
    // Monospace, because this is DATA: aligned braces and columns are how you read a dump. The rest
    // of the toolkit is prose and uses the inherited face.
    s.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    s.lineHeight = '1.45'
    s.whiteSpace = 'pre-wrap'
    // Long ids and pitch keys have no spaces to break at, and a panel that scrolls SIDEWAYS to show
    // the end of an id is a panel you cannot read at a glance.
    s.overflowWrap = 'anywhere'
    s.color = PHOSPHOR

    host.appendChild(body)
    this.body = body

    this.paint(bus.inspection.get())
    this.unsubscribe = bus.inspection.onChange((elements) => this.paint(elements))
  }

  /** The selection lives outside this widget, so the subscription MUST go when the window does. */
  destroy(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private paint(elements: InspectedElement[]): void {
    const body = this.body
    if (!body) return
    body.textContent = ''

    if (!elements.length) {
      const empty = document.createElement('div')
      empty.textContent = 'Nothing selected'
      body.appendChild(empty)
      return
    }

    for (const element of elements) {
      // The kind is the one thing that is NOT in the JSON — `data` is the element's own object, and
      // an object does not say what it is. Without this a rest and a note are told apart only by
      // spotting `isRest` in the dump.
      const heading = document.createElement('div')
      heading.textContent = element.kind
      heading.style.color = AMBER
      heading.style.margin = '8px 0 2px'
      heading.style.textTransform = 'uppercase'
      heading.style.letterSpacing = '0.06em'
      body.appendChild(heading)

      // ⭐ The kind's own controls, above its dump — `./panels` is the table, and this loop knows no
      // kind by name. Most kinds have none yet.
      for (const row of panelRowsFor(element)) body.appendChild(row)

      const dump = document.createElement('div')
      dump.textContent = stringify(element.data)
      body.appendChild(dump)

      // Its own section, under its own label, because the overrides are their own COMPARTMENT — the
      // authored geometry the model deliberately keeps out of the content (staff-spaces, never
      // pixels). Printing them inside the element's object would show a shape the score does not
      // have. Nothing is drawn when the element has none, which is most of the time.
      if (element.overrides) {
        const label = document.createElement('div')
        label.textContent = 'engraving overrides'
        label.style.color = AMBER
        label.style.margin = '6px 0 2px'
        label.style.letterSpacing = '0.06em'
        body.appendChild(label)

        const overrides = document.createElement('div')
        overrides.textContent = stringify(element.overrides)
        body.appendChild(overrides)
      }
    }
    (body.firstElementChild as HTMLElement).style.marginTop = '0'
  }
}

/**
 * JSON, or a plain description of why there isn't any. A `Fraction` beat, a Map, a cyclic reference
 * — anything the model holds that JSON cannot express must show as itself and not take the panel
 * down with it, because a debugging window that throws on the very object you were debugging is
 * worse than useless.
 */
function stringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2) ?? String(data)
  } catch (err) {
    return `[unserializable: ${err instanceof Error ? err.message : String(err)}]`
  }
}
