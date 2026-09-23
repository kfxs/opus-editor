import type { EditorState, StateListener } from '../state/EditorState'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { SpanToolHost } from '../stamps/spanToolPress'
import { bus, type GraceKey } from '@/bus'
import { graceToolLit, pressGraceTool } from '../stamps/graceTool'
import { bracketedToolLit, pressBracketedTool } from '../stamps/bracketedGraceTool'

/**
 * ⭐ **The Keypad's GRACE keys, wired the dev toolbar's way** (his ask, 2026-09-23: *"wire the grace page of the
 * keypad the same way is wired the dev shell grace pallete"*). The Grace page's `/` (appoggiatura), `*`
 * (acciaccatura) and `-` (bracketed grace) press `bus.grace`; this routes each press to the SAME function the
 * toolbar's button calls — `pressGraceTool` / `pressBracketedTool`, which arm the stamp or act on the
 * selection — and pushes the lights back from the SAME lit rules (`graceToolLit` / `bracketedToolLit`).
 *
 * Its own module, ⛔ not a slice of `keypadSync` (`CLAUDE.md`: a new feature adds a MODULE). It re-reads the
 * lights on every state change AND every model change: a selected grace's FORM lights its key, and a press
 * on it changes the score while the selection may stay (the Properties sync's two-source rule).
 *
 * Returns a dispose fn.
 */
export function wireKeypadGrace(
  state: EditorState,
  host: () => SpanToolHost,
  getEngine: () => MusicEngine | null,
  subscribe: (fn: StateListener) => () => void,
): () => void {
  const stopPress = bus.grace.onPress((key: GraceKey) => {
    if (key === 'bracketed') pressBracketedTool(host(), 'before')
    else pressGraceTool(host(), key, 'before')
  })

  const sync = () => {
    const engine = getEngine()
    const lit: GraceKey[] = []
    if (graceToolLit(state, 'appoggiatura', 'before', engine)) lit.push('appoggiatura')
    if (graceToolLit(state, 'acciaccatura', 'before', engine)) lit.push('acciaccatura')
    if (bracketedToolLit(state, 'before', engine)) lit.push('bracketed')
    bus.grace.setActive(lit)
  }
  sync()
  const stopState = subscribe(sync)

  // The engine may not exist yet when this is wired, so the model subscription is taken lazily.
  let stopModel: (() => void) | null = null
  const attachModel = () => {
    if (stopModel) return
    const engine = getEngine()
    if (engine) stopModel = engine.onModelChange(sync)
  }
  attachModel()
  const stopAttach = subscribe(attachModel)

  return () => {
    stopPress()
    stopState()
    stopAttach()
    stopModel?.()
  }
}
