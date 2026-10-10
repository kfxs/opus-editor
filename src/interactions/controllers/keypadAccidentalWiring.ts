import type { EditorState, StateListener } from '../state/EditorState'
import type { MusicEngine } from '../../engine/MusicEngine'
import { bus, type AccidentalKey } from '@/bus'
import { accidentalEnclosureLit, pressAccidentalEnclosure, type AccidentalEnclosureHost } from '../stamps/accidentalEnclosureTool'

/**
 * ⭐ **The Keypad Accidentals page's non-slot keys** (docs/plans/alteration-signs-plan.md K3) — `Enter`, the
 * accidental's parentheses, today. A press on `bus.accidentalKeys` goes to its tool module; the lights come
 * back from the same module's lit rule, re-read on every state change AND every model change (a press
 * changes the score while the selection stays — the Grace page's two-source rule, `./keypadGraceWiring`).
 *
 * Its own module, ⛔ not a slice of `keypadSync` (`CLAUDE.md`: a new feature adds a MODULE).
 * Returns a dispose fn.
 */
export function wireKeypadAccidentals(
  state: EditorState,
  host: () => AccidentalEnclosureHost,
  getEngine: () => MusicEngine | null,
  subscribe: (fn: StateListener) => () => void,
): () => void {
  const stopPress = bus.accidentalKeys.onPress((key: AccidentalKey) => {
    if (key === 'parenthesised') pressAccidentalEnclosure(host())
  })

  const sync = () => {
    const lit: AccidentalKey[] = []
    if (accidentalEnclosureLit(state, getEngine())) lit.push('parenthesised')
    bus.accidentalKeys.setActive(lit)
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
