/**
 * ⭐ **THE STAMPS THAT MARK THE HEAD A CLICK LANDS ON** — one table, run in turn by `MouseController`'s armed
 * click. Each answers only for its OWN armed tool (it checks `armedTool` first and declines otherwise), so the
 * order among them decides nothing.
 *
 * A TABLE so a new note-mark stamp is a ROW here and ⛔ not another line in `MouseController`, which sits at its
 * `lint:hubs` line ceiling (`CLAUDE.md`: a new feature adds a MODULE). The glissando's stamp is the row that
 * made it one (docs/plans/glissando-plan.md).
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import type { EditorState } from '../state/EditorState'
import { stampArticulationAtClick } from './articulationStamp'
import { stampDotAtClick } from './dotStamp'
import { stampTremoloAtClick } from './tremoloStamp'
import { stampEnclosureAtClick } from './enclosureStamp'
import { stampGlissandoAtClick } from './glissandoStamp'

type NoteMarkStamp = (
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
) => boolean

const NOTE_MARK_STAMPS: ReadonlyArray<NoteMarkStamp> = [
  stampArticulationAtClick,
  stampDotAtClick,
  stampTremoloAtClick,
  stampEnclosureAtClick,
  stampGlissandoAtClick,
]

/** Run the note-mark stamps; true when one of them consumed the click. */
export function stampNoteMarkAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
): boolean {
  return NOTE_MARK_STAMPS.some(stamp => stamp(state, engine, registry, x, y, render))
}
