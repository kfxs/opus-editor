import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { activeVoiceToModel, armedTool } from './EditorState'
import { multipleNotesSelected } from './selection'
import type { ArmedFanStamp } from '@/bus'
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

/**
 * ⭐ **THE DIALOG'S OK WITH ONE NOTE SELECTED — the feather lands on the note that is already there.**
 *
 * His rule: *"if one note is selected (only one) and the user opens the dialog, we create the fan in
 * the position of the note, with the characteristics of the dialog and the PITCH of the note."* So
 * the note supplies its pitch and its place; the dialog supplies the value, the attacks and the
 * direction. Returns whether it applied — the window's OK ARMS the stamp when it did not, which is
 * the Time Signature window's shape (apply to what is selected, otherwise arm).
 *
 * ⭐ **THE VALUE GOES THROUGH `updateNote`, so a duration that does not fit behaves exactly as it does
 * everywhere else** — his call: *"if the duration doesn't fit we do the same as is done in stamp when
 * the duration doesn't fit… it's a better solution and the user will fix it."* Overflow, the rests
 * that fill what it vacates, the cross-barline split: one pipeline, one behaviour, nothing invented
 * here for the case where a half note is asked for on the last quarter of a bar.
 *
 * ⛔ A REST is not a candidate, and neither is a fanned member: `setFan` refuses both, and applying
 * the duration first would leave a resized rest wearing no fan — a half-done edit that looks like a
 * bug. The press falls back to arming the stamp instead, which is a thing the user can then place.
 */
export function featherSelectedNote(
  state: EditorState,
  engine: MusicEngine,
  armed: ArmedFanStamp,
  render: () => void,
): boolean {
  const noteId = state.selectedNoteId
  if (!noteId || multipleNotesSelected(state.selectedItems.values())) return false
  const note = engine.getNote(noteId)
  if (!note || note.isRest || engine.isFanMember(noteId)) return false

  let applied = false
  engine.runBatch(`Feather ${armed.attacks} attacks (${armed.direction})`, () => {
    engine.updateNote(noteId, { duration: armed.unit, dots: armed.dots })
    // ⚠️ Re-read: `updateNote` may have SPLIT the slot across the barline, and the fan belongs on the
    // piece that kept the note's own id — which is what `getNote` answers.
    if (!engine.getNote(noteId)) return
    applied = !!engine.setFan(noteId, {
      direction: armed.direction,
      count: armed.attacks,
      beams: DEFAULT_FAN_BEAMS,
    })
  })
  if (!applied) return false

  const now = engine.getNote(noteId)
  dbg(`✓ Feather applied | ${armed.attacks} attacks ${armed.direction} on ${armed.unit}${'.'.repeat(armed.dots)} `
    + `at m${now?.measure} b${now ? fracToNumber(now.beat).toFixed(3) : '?'}`)
  engine.updateUndoNoteId(noteId)
  render()
  return true
}
