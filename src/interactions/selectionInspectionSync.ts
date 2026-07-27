import type { EditorState, StateListener } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import { bus } from '@/bus'
import { selectedElements } from './selectionSnapshot'

/**
 * Keep {@link bus.inspection} in step with the editor's selection, so the Properties window
 * always shows what is selected NOW.
 *
 * Its own wire rather than a few lines inside `wireKeypadSync`, which also runs on every state
 * change: that function is the Keypad's, and this has nothing to do with the Keypad. It also needs
 * something the Keypad's wire does not have — the engine, to resolve ids into objects.
 *
 * Satisfies the subscriber contract the same way the Keypad's does: a pure read, idempotent, and
 * tolerant of torn state (it recomputes wholesale). The de-dup lives in the store, so firing on
 * every change is cheap and the panel repaints only when the selection really moved.
 *
 * Returns a dispose fn.
 */
export function wireSelectionInspection(
  state: EditorState,
  getEngine: () => MusicEngine | null,
  subscribe: (fn: StateListener) => () => void,
): () => void {
  const sync = () => bus.inspection.set(selectedElements(state, getEngine()))
  sync() // prime

  const stopState = subscribe(sync)

  // TWO sources, because a panel showing an element's contents can go stale in two ways. The
  // selection can move to a different element (state) — or the SAME element can be edited under it
  // (model). Retuning a selected rest is the second: the model changes and the selection does not,
  // and the one state change it does emit (`selectedDuration`) fires before the mutation, so a
  // state-only subscriber reads the old note and then hears nothing more.
  //
  // The engine may not exist yet when this is wired (App.ts creates it on mount), so the model
  // subscription is taken lazily, on the first sync that finds one.
  let stopModel: (() => void) | null = null
  const attachModel = () => {
    if (stopModel) return
    const engine = getEngine()
    if (engine) stopModel = engine.onModelChange(sync)
  }
  attachModel()
  const stopStateForAttach = subscribe(attachModel)

  return () => {
    stopState()
    stopStateForAttach()
    stopModel?.()
  }
}
