import type { EditorState, StateListener } from '../state/EditorState'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { DotKeyHost } from '../stamps/dotCountTool'
import { dotsLit, pressDots } from '../stamps/dotCountTool'
import { barRestLit, pressBarRest } from '../stamps/barRestTool'
import { glissandoLit, pressGlissando } from '../stamps/glissandoTool'
import { cueLit, pressCue } from '../stamps/cueTool'
import { bus, type GraceKey } from '@/bus'
import { graceToolLit, pressGraceTool } from '../stamps/graceTool'
import { bracketedToolLit, pressBracketedTool } from '../stamps/bracketedGraceTool'
import { enclosureLit, pressEnclosure } from '../stamps/enclosureTool'

/**
 * ⭐ **The Keypad's GRACE keys, wired the dev toolbar's way** (his ask, 2026-09-23: *"wire the grace page of the
 * keypad the same way is wired the dev shell grace pallete"*). The Grace page's `/` (appoggiatura), `*`
 * (acciaccatura) and `-` (bracketed grace) press `bus.grace`; this routes each press to the SAME function the
 * toolbar's button calls — `pressGraceTool` / `pressBracketedTool`, which arm the stamp or act on the
 * selection — and pushes the lights back from the SAME lit rules (`graceToolLit` / `bracketedToolLit`).
 * ⭐ The page's `1` (the parenthesised note) joined them on 2026-09-26, his ask: *"wire … the 1 the same way it
 * is wired the parenthesis in the dev shell palette"* — `pressEnclosure` / `enclosureLit`, the `paren.` button's —
 * and `2` / `3` the same day: `pressDots` / `dotsLit` with 2 and 3, the `..` / `...` buttons'. That is why the
 * host is the DOT key's (`palette.dotKeyHost()`, a span-tool host plus the ghost repaint and the note select).
 * ⭐ And `0` — the full-bar rest, the toolbar's `full bar` (`pressBarRest` / `barRestLit`) — and `.`, the
 * glissando, the toolbar's `gliss` (`pressGlissando` / `glissandoLit`) — and `Enter`, cue size, the toolbar's
 * `cue` (`pressCue` / `cueLit`): his asks, the same day.
 *
 * Its own module, ⛔ not a slice of `keypadSync` (`CLAUDE.md`: a new feature adds a MODULE). It re-reads the
 * lights on every state change AND every model change: a selected grace's FORM lights its key, and a press
 * on it changes the score while the selection may stay (the Properties sync's two-source rule).
 *
 * Returns a dispose fn.
 */
export function wireKeypadGrace(
  state: EditorState,
  host: () => DotKeyHost,
  getEngine: () => MusicEngine | null,
  subscribe: (fn: StateListener) => () => void,
): () => void {
  const stopPress = bus.grace.onPress((key: GraceKey) => {
    if (key === 'bracketed') pressBracketedTool(host(), 'before')
    else if (key === 'parenthesised') pressEnclosure(host())
    else if (key === 'doubleDot') pressDots(host(), 2)
    else if (key === 'tripleDot') pressDots(host(), 3)
    else if (key === 'barRest') pressBarRest(host())
    else if (key === 'gliss') pressGlissando(host())
    else if (key === 'cue') pressCue(host())
    else pressGraceTool(host(), key, 'before')
  })

  const sync = () => {
    const engine = getEngine()
    const lit: GraceKey[] = []
    if (graceToolLit(state, 'appoggiatura', 'before', engine)) lit.push('appoggiatura')
    if (graceToolLit(state, 'acciaccatura', 'before', engine)) lit.push('acciaccatura')
    if (bracketedToolLit(state, 'before', engine)) lit.push('bracketed')
    if (enclosureLit(state, engine)) lit.push('parenthesised')
    if (dotsLit(state, engine, 2)) lit.push('doubleDot')
    if (dotsLit(state, engine, 3)) lit.push('tripleDot')
    if (barRestLit(state, engine)) lit.push('barRest')
    if (glissandoLit(state, engine)) lit.push('gliss')
    if (cueLit(state, engine)) lit.push('cue')
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
