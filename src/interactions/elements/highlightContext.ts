/**
 * ⭐ **WHAT A KIND'S `highlight` ROW IS HANDED** — the highlight layer's painting toolkit and the
 * four things every painter started by fetching, so the painting can live in the kind's OWN module
 * (docs/code-shape-plan-2026-09-19.md, Phase 3.3) instead of as one more `apply…` on
 * `HighlightController`.
 *
 * ⛔ **Every write goes through the toolkit, never straight at the DOM.** A selection change no
 * longer redraws the score, so each mutation needs a real inverse — the four functions below record
 * theirs on the layer's undo log, and `clearHighlights` runs it. A `setAttribute` of your own on an
 * ENGRAVED node survives the clear; a node you append yourself is never removed.
 *
 * ⚠️ A registry entry a painter adds is NOT on that log: `clearHighlights` removes those by TYPE, so
 * a new highlight-owned entry type joins its list.
 */
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ElementRegistry } from '@/engine/ElementRegistry'
import type { EditorState } from '../EditorState'
import type { HighlightController } from '../HighlightController'

export interface HighlightContext {
  engine: MusicEngine
  /** The score's `<svg>` — where a node the highlight layer OWNS is appended. */
  svg: SVGSVGElement
  state: EditorState
  registry: ElementRegistry
  /** Set an attribute, remembering its PREVIOUS value (voice 2's heads are green by default). */
  setAttr(el: Element, name: string, value: string): void
  /** The same for an inline style property — colours are set both ways, the two have different
   *  precedence against the stylesheet. */
  setStyleProp(el: SVGElement, name: string, value: string): void
  addClass(el: Element, cls: string): void
  /** Append a node the highlight layer owns; it comes off with the layer. */
  addNode(parent: Element, node: Element): void
  /** Raise a group above a coincident sibling so the recoloured glyph is the one that paints
   *  (unison heads, two voices' rests on one spot, overlapping tuplet brackets). The layer puts it
   *  back on clear — the reorder only means anything while the element is selected. */
  raiseToFront(group: Element): void
  /**
   * ⏳ **TRANSITIONAL** — the painters that have not moved to their kind's module yet. A row that
   * still reads `ctx.controller.apply…()` is a row Phase 3.3 has not reached; this member goes when
   * the last one stops.
   */
  controller: HighlightController
}
