/**
 * ⭐⭐ **THE ARROWS ASK THE SELECTED ELEMENT'S OWN ROW** (`./keys`, the `keys` column of
 * `ELEMENT_SPECS`) — the dispatch `shortcutWiring` runs first on every arrow chord. ⛔ No per-kind
 * closure and no `||` link per kind: a kind that answers the arrows says so in `./<kind>Keys`.
 * Each verb DECLINEs when nothing is selected, or the kind has no answer — and then the key carries
 * on down whatever is left of its chain.
 *
 * Moved out of `shortcutWiring` unchanged (2026-09-21) when the GROUP arrived (`./groupKeys`): with
 * no single element selected, `nudge` and `reset` ask the group of marks instead.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { ELEMENT_SPECS } from './chain'
import { nudgeMarkGroup, resetMarkGroup } from './groupKeys'
import type { KeysCtx } from './keys'

export function selectedElementKeys(
  getEngine: () => MusicEngine | null,
  state: EditorState,
  keysCtx: (engine: MusicEngine) => KeysCtx,
) {
  return {
    nudge(dx: number, dy: number): boolean {
      const eng = getEngine()
      if (!eng) return false
      const element = state.selectedElement
      if (!element) return nudgeMarkGroup(keysCtx(eng), dx, dy)
      return ELEMENT_SPECS[element.kind].keys?.nudge?.(keysCtx(eng), element, dx, dy) ?? false
    },
    reset(): boolean {
      const eng = getEngine()
      if (!eng) return false
      const element = state.selectedElement
      if (!element) return resetMarkGroup(keysCtx(eng))
      return ELEMENT_SPECS[element.kind].keys?.reset?.(keysCtx(eng), element) ?? false
    },
    reanchor(direction: 1 | -1): boolean {
      const eng = getEngine()
      const element = state.selectedElement
      if (!eng || !element) return false
      return ELEMENT_SPECS[element.kind].keys?.reanchor?.(keysCtx(eng), element, direction) ?? false
    },
    cycle(step: 1 | -1): boolean {
      const eng = getEngine()
      const element = state.selectedElement
      if (!eng || !element) return false
      return ELEMENT_SPECS[element.kind].keys?.cycle?.(keysCtx(eng), element, step) ?? false
    },
  }
}
