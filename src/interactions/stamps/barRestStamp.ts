/**
 * ⭐ **THE FULL-BAR REST STAMP's click** (docs/plans/voice-measure-rest-plan.md P2) — which BAR, which
 * STAFF, which VOICE. What the stamp does to the bar is the core's (`engine/models/barRestOps`), reached
 * through `engine.silentBar` (one undo entry).
 *
 * - The BAR is the one the press landed in (`pixelToMeasure`) — a full-bar rest is a statement about a
 *   bar, the key signature's question, ⛔ not the barline's nearest-line one.
 * - The STAFF is the one under the pointer — a voice is a lane of ONE staff.
 * - The VOICE is the ACTIVE one, read now rather than armed (R2): the Keypad's voice row goes on
 *   choosing it while the stamp is live.
 *
 * ⭐ ONE click, then the tool DISARMS and the editor is back in SELECTION mode — unlike the other stamps,
 * which stay armed (his call, 2026-09-26: *"we should stamp full bar just once… after stamp we just go
 * back to select mode"*). Several bars at once is the selected-bars press (`./barRestTool`).
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import { activeVoiceToModel, type EditorState } from '../state/EditorState'

/** @returns whether the click was consumed. */
export function stampBarRestAtClick(
  state: EditorState,
  engine: Pick<MusicEngine, 'silentBar' | 'getElementRegistry'>,
  y: number,
  measureNum: number,
  render: () => void,
): boolean {
  if (state.selectedMarkingTool?.kind !== 'barRest') return false
  const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
  const voice = activeVoiceToModel(state.activeVoice)
  const id = engine.silentBar.stamp(measureNum, staff, voice)
  dbg(`[barRest] click m${measureNum} staff${staff} v${voice + 1} → ${id ?? 'already stamped'}`)
  // Spent: back to selection (PaletteController.disarmMarkingTool's two writes). Repaint even when nothing
  // changed — the click consumed the placement (`stampGroupAtClick`'s rule).
  state.selectedMarkingTool = null
  state.selectedTool = 'selection'
  render()
  return true
}
