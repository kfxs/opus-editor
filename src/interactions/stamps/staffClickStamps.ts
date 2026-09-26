/**
 * ⭐ **The stamps whose click names a STAFF in a BAR** — one row each, asked in turn; each answers only
 * for its own armed tool, so the order decides nothing. `MouseController` gives the table ONE line
 * (it holds a line ceiling, `lint:hubs`), the shape of `./noteMarkStamps`.
 *
 * - the GROUPING SIGN (`./groupStamp`) — a brace or bracket on the staff clicked;
 * - the FULL-BAR REST (`./barRestStamp`) — the active voice of the staff clicked, silent for the bar.
 */
import type { MusicEngine } from '@/engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { stampGroupAtClick } from './groupStamp'
import { stampBarRestAtClick } from './barRestStamp'

/** @returns whether the click was consumed. */
export function stampStaffAtClick(
  state: EditorState,
  engine: Pick<MusicEngine, 'applyGroupSymbol' | 'silentBar' | 'getElementRegistry'>,
  y: number,
  measureNum: number,
  render: () => void,
): boolean {
  return stampGroupAtClick(state, engine, y, measureNum, render)
    || stampBarRestAtClick(state, engine, y, measureNum, render)
}
