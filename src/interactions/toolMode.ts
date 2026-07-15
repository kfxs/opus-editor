import type { ToolMode } from './EditorState'

/**
 * The current tool mode — entry vs selection — as a TINY framework-agnostic observable.
 *
 * `EditorState.selectedTool` is still the truth the rest of the app reads and writes; this store is
 * only a window onto it for code that lives OUTSIDE Vue. A plain-TS panel — the Keypad — cannot watch
 * a Vue ref, so App.vue mirrors the reactive tool into this store (a `watch` one way) and back out of
 * it (a `subscribe` the other). The Keypad then reads {@link get} and is told of changes via
 * {@link subscribe}, and never imports Vue — the boundary the whole `windows/` layer keeps.
 *
 * Its shape is WindowManager's, on purpose: `subscribe` hands back its own unsubscribe, and `set`
 * SHORT-CIRCUITS on no change — which is also what stops the App.vue round-trip (store → state →
 * store) from looping.
 */
class ToolModeStore {
  private mode: ToolMode = 'selection'
  private listeners = new Set<(mode: ToolMode) => void>()

  get(): ToolMode {
    return this.mode
  }

  set(mode: ToolMode): void {
    if (mode === this.mode) return
    this.mode = mode
    for (const fn of this.listeners) fn(mode)
  }

  subscribe(fn: (mode: ToolMode) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

/** The app's one tool-mode store — a module singleton, like `windows`, so any plain-TS module reaches it. */
export const toolMode = new ToolModeStore()
