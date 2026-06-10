import type { EditorState } from '../interactions/EditorState'
import { TextEditController } from '../interactions/TextEditController'
import { DomTextEdit } from '../interactions/DomTextEdit'

/**
 * Vue adapter for the in-canvas text editor. Pairs the framework-agnostic
 * {@link TextEditController} with the real-DOM overlay ({@link DomTextEdit}).
 * No logic here — mirrors the other thin bridges.
 */
export function useTextEditing(state: EditorState): TextEditController {
  return new TextEditController(state, new DomTextEdit())
}
