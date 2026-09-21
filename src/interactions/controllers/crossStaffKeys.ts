/**
 * ⭐ **`Ctrl+Shift+↑/↓` — write the selected heads on the adjacent staff** (cross-staff notation,
 * docs/plans/cross-staff-plan.md Phase 3). The editor's half only: WHICH heads, the log, the render.
 * What may cross is `engine/models/crossStaffOps`; the undo entry is `MusicEngine.crossNotesToStaff`.
 *
 * ⭐ The selection is the unit, head by head — `Alt+↑/↓` picks one note of a chord, so D4 + F♯4 of a
 * bass-staff chord cross while its B2 stays (the Satie bar). A head that cannot cross (the score's
 * edge, a rest, two staves from home) is reported in the log and the others still move.
 *
 * Registered from `App.ts` through `wireShortcuts(…).register` — ⛔ not as entries in
 * `shortcutWiring`'s own map, which is at its ceiling on purpose (`lint:hubs`).
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'
import { dbg } from '@/utils/debug'

export function crossSelectedNotes(
  engine: MusicEngine | null,
  state: EditorState,
  direction: -1 | 1,
  render: () => void,
): boolean {
  if (!engine) return false
  if (state.selectedTool !== 'selection' && state.selectedTool !== 'entry') return false
  const ids = selectedNoteIds(state.selectedItems.values())
  if (ids.length === 0) return false

  const outcomes = engine.crossNotesToStaff(ids, direction)
  const arrow = direction < 0 ? '↑' : '↓'
  for (const o of outcomes) {
    dbg(`[CrossStaff] ${arrow} ${o.pitchId.slice(0, 8)} → ${o.result}${o.result === 'refused' ? ` (${o.why})` : ''}`)
  }
  if (outcomes.every(o => o.result === 'refused')) return false
  render()
  return true
}

/** The two actions `ShortcutConfig` names, for `wireShortcuts(…).register`. */
export function crossStaffActions(
  getEngine: () => MusicEngine | null,
  state: EditorState,
  render: () => void,
): Record<string, () => void> {
  return {
    crossStaffUp: () => { crossSelectedNotes(getEngine(), state, -1, render) },
    crossStaffDown: () => { crossSelectedNotes(getEngine(), state, 1, render) },
  }
}
