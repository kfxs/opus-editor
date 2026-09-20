/**
 * **WHAT THE KEYS DO TO THE ONE SELECTED ELEMENT** — the `keys` column of `ELEMENT_SPECS`
 * (`./chain`). A kind that answers the arrows says so in its own module (`./<kind>Keys`), and
 * `shortcutWiring` asks the selected element's row: ⛔ no `nudgeSelected<Kind>` closure there, and
 * no `||` chain that grows by one link per kind.
 *
 * ⭐ Dispatch on the KIND is sound because `selectedElement` is ONE element: the chains this
 * replaces were lists of "is a wedge selected? is a bracket selected?…", disjoint by construction.
 * What is NOT disjoint — an armed square against the whole mark — is one kind, and its module
 * decides between them.
 *
 * A row answers `true` when it CONSUMED the key, `false` to DECLINE — and then the key falls
 * through to what it does with nothing of this kind selected (the pitch edit, the navigation, the
 * note-spacing nudge). A key nobody consumed stays free for the browser.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { MarkPreviewKind } from '../../engine/rendering/marks/markPreviewPass'
import type { EditorState, SelectedElement } from '../EditorState'

/** What a kind's key handlers may use. */
export interface KeysCtx {
  engine: MusicEngine
  state: EditorState
  /** A full render. */
  render(): void
  /**
   * What a mark's nudge owes the screen. A HORIZONTAL press is part of a key RUN (`../keyRun`):
   * the frame previews the one family, and the run's settle commits once and renders for real — so
   * a held arrow costs neither a whole-score render nor an undo entry per repeat. Anything else
   * (a vertical nudge) renders at once.
   */
  afterMarkPress(kind: MarkPreviewKind, id: string, dx: number, dy: number, commit: () => void): void
}

/** One kind's answers. `E` is that kind's member of the `SelectedElement` union. */
export interface ElementKeys<E extends SelectedElement = SelectedElement> {
  /**
   * The arrows: plain = fine, `Ctrl` = coarse. `dx` / `dy` are SCREEN staff-spaces — ⚠️ screen-down
   * is +y, so "up" arrives as a negative `dy`, whatever the kind's own stored convention is.
   */
  nudge?(ctx: KeysCtx, element: E, dx: number, dy: number): boolean
  /** `Ctrl+Backspace`: back to the engraver's own position. DECLINE when nothing was nudged. */
  reset?(ctx: KeysCtx, element: E): boolean
  /**
   * `Ctrl+Shift+←/→`: **move it through the MUSIC** by one stop of its lane — the other category
   * from {@link nudge}. ⭐ Two chords, two categories: the plain and `Ctrl` arrows say where the INK
   * goes (an override, resettable); this one writes the MODEL, and for most kinds audibly — which
   * notes get louder, are displaced, ring, are trilled, from which beat a level or a tempo applies.
   * On a span the ARMED SQUARE is the gate and says which end; a point mark (a dynamic, a tempo, a
   * clef) has no end to point at and moves whole.
   */
  reanchor?(ctx: KeysCtx, element: E, direction: 1 | -1): boolean
  /**
   * `Tab` / `Shift+Tab`: arm the selected element's next drawn handle. ⚠️ The REGISTRY is the
   * list, so this declines wherever the handles are not drawn (linear view).
   */
  cycle?(ctx: KeysCtx, element: E, step: 1 | -1): boolean
}

/** A row of `ELEMENT_SPECS`, narrowed: a kind's keys are handed its OWN element. */
export type KeysOf<K extends SelectedElement['kind']> = ElementKeys<Extract<SelectedElement, { kind: K }>>
