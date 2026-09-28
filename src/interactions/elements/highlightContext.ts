/**
 * ⭐ **WHAT A KIND'S `highlight` ROW IS HANDED** — the highlight layer's painting toolkit and the
 * four things every painter started by fetching, so the painting can live in the kind's OWN module
 * (docs/plans/code-shape-plan-2026-09-19.md, Phase 3.3) instead of as one more `apply…` on
 * `HighlightController`.
 *
 * ⛔ **Every write goes through the toolkit, never straight at the DOM.** A selection change no
 * longer redraws the score, so each mutation needs a real inverse — the four functions below record
 * theirs on the layer's undo log, and `clearHighlights` runs it. A `setAttribute` of your own on an
 * ENGRAVED node survives the clear; a node you append yourself is never removed.
 *
 * ⚠️ A registry entry a painter adds is NOT on that log: `clearHighlights` removes those by TYPE, so
 * a new highlight-owned entry type joins {@link HIGHLIGHT_OWNED_TYPES}.
 */
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ElementRegistry, ElementType } from '@/engine/ElementRegistry'

/**
 * ⭐ **EVERY REGISTRY TYPE A HIGHLIGHT REGISTERS** — the squares and handles that exist only while something is
 * selected. `HighlightController.clearHighlights` removes each of these, because a skipped render no longer clears the
 * registry for them. ⭐ A table, so a new handle type is a ROW here (the beam's squares, 2026-09-28, were the first
 * added this way — the list used to be ten `removeByType` lines in the controller).
 */
export const HIGHLIGHT_OWNED_TYPES: readonly ElementType[] = [
  'slur-handle', 'slur-endpoint', 'slur-segment-endpoint',
  'hairpin-endpoint', 'ottava-endpoint', 'pedal-endpoint', 'pedal-tether', 'trill-endpoint',
  'barline-join', 'staff-group-handle',
  'beam-group-handle',
]
import type { EditorState } from '../state/EditorState'

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
}
