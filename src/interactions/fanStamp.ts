import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { activeVoiceToModel, armedTool } from './EditorState'
import { DEFAULT_FAN_BEAMS } from '../utils/fannedBeam'
import { fracToNumber } from '../utils/fraction'

/**
 * ⭐ THE FEATHER STAMP'S CLICK — one press of the mouse writes the whole gesture.
 *
 * A module of its own, not a twelfth `stamp…AtClick` method on `MouseController`, per CLAUDE.md's
 * rule; the controller keeps one line in its dispatch chain.
 *
 * WHAT ONE CLICK MAKES. A note of the dialog's written value at the clicked pitch, carrying a
 * {@link FanMark} of `attacks` attacks in the dialog's direction — the shape `PaletteController.
 * pressFan` builds when it marks a plain note, with the COUNT coming from the dialog instead of
 * `DEFAULT_FAN_COUNT`. `FanMark.length` stays absent, which is the model's spelling of "exactly this
 * note's duration": the dialog said *in the time of a half*, and the note it just placed IS a half,
 * so there is no second span to store. `beams` is the default — the wide end's line count is an
 * engraving dial the Properties window already edits, and the dialog does not ask it.
 *
 * TWO ENGINE CALLS, ONE UNDO. `addNoteAtPosition` then `setFan`, inside a `runBatch`: a note that
 * appeared and a fan that was marked on it are one act, and Ctrl+Z must take back the act. Without
 * the batch the first undo would leave a plain note sitting where you clicked — a state you never
 * asked for and cannot tell from one you typed.
 *
 * ⚠️ It is NOT a hit-test, for the reason the rest stamp is not: a click anywhere in the bar chooses
 * a POSITION (`addNoteAtPosition` maps x→slot and y→pitch), because you are placing something new
 * rather than marking something that is already drawn.
 *
 * The tool stays armed — a stamp is used in runs, and placing one says nothing about being finished.
 */
export function stampFanAtClick(
  state: EditorState,
  engine: MusicEngine,
  x: number,
  y: number,
  render: () => void,
): boolean {
  const tool = armedTool(state, 'fan')
  if (!tool) return false

  let placedId: string | null = null
  engine.runBatch(`Feather ${tool.attacks} attacks (${tool.direction})`, () => {
    const note = engine.addNoteAtPosition(
      { x, y },
      tool.unit,
      undefined,
      tool.dots || undefined,
      undefined,
      undefined,
      activeVoiceToModel(state.activeVoice),
    )
    if (!note) return
    // Refusals are the engine's to make and they are quiet ones — a bar with no room takes no note,
    // and then there is nothing to fan. Reading the returned note rather than assuming one is what
    // keeps a refused placement from marking the note that happens to be there already.
    if (engine.setFan(note.id, { direction: tool.direction, count: tool.attacks, beams: DEFAULT_FAN_BEAMS })) {
      placedId = note.id
    }
  })

  if (placedId) {
    const note = engine.getNote(placedId)
    dbg(`✓ Feather stamped | ${tool.attacks} attacks ${tool.direction} on ${tool.unit}${'.'.repeat(tool.dots)} at m${note?.measure} b${note ? fracToNumber(note.beat).toFixed(3) : '?'}`)
    // PLACING is what ends keyboard entry — the same rule the rest stamp follows. The caret is
    // `selectedNoteId` in entry mode, so dropping it takes the caret down and leaves you stamping
    // with the mouse, which is what you just did. (Reassign, never mutate: the Proxy traps the SET.)
    state.selectedNoteId = null
    render()
  } else {
    dbg(`· Feather stamp: nothing placed at the click`)
  }
  // The click is ours either way, so a refused placement does not fall through to note entry.
  return true
}
