import type { EditorState } from '../interactions/EditorState'
import { TextEditController } from '../interactions/TextEditController'
import { DomTextEdit } from '../interactions/DomTextEdit'
import { menus, openMenuAtViewport } from '../menus'

/**
 * Vue adapter for the in-canvas text editor. Pairs the framework-agnostic
 * {@link TextEditController} with the real-DOM overlay ({@link DomTextEdit}).
 * No logic here — mirrors the other thin bridges.
 *
 * The menu opener is INJECTED rather than imported by the overlay itself: `menus` is a singleton
 * that reaches the window layer for its host, and handing it in from the glue keeps DomTextEdit
 * dependent on nothing but the DOM (and keeps interactions/ -> menus/ from becoming a cycle).
 *
 * `isOpen` rides along because the overlay must stand down from Enter/Escape/arrows while a menu is
 * up — its keydown listener runs before the menu's, so it would otherwise eat them.
 */
export function useTextEditing(state: EditorState): TextEditController {
  return new TextEditController(state, new DomTextEdit(openMenuAtViewport, () => menus.isOpen))
}
