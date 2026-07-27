import { dbg } from '@/utils/debug'
import type { Fraction } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import type { SelectionController } from './SelectionController'
import type { RenderController } from './RenderController'
import { selectedNoteIds } from './selection'
import { activeVoiceToModel } from './EditorState'
import { fracToNumber } from '../utils/fraction'
import type { ClipTarget } from '../utils/clip'
import {
  buildClipboardFromSelection,
  earliestSelectedPosition,
  clipboardSummary,
  type ClipboardPayload,
} from './clipboard'

/**
 * Copy / paste of the current selection. Phase A handles notes/chords/rests; the
 * payload is sectioned so future element kinds slot in without reworking this.
 * Framework-agnostic: reads/writes EditorState + engine, no Vue/React imports.
 *
 * Paste semantics: overwrite-forward from the selection's start. With nothing
 * selected, Ctrl+V arms a placement mode (colored caret) and the next canvas click
 * commits the origin.
 */
export class ClipboardController {
  private payload: ClipboardPayload | null = null

  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private selection: SelectionController,
    private render: RenderController,
  ) {}

  hasContent(): boolean {
    return this.payload !== null
  }

  /** Copy the selected notes into the clipboard, dumping the payload to the console. */
  copy(): void {
    const engine = this.getEngine()
    if (!engine) return
    const ids = selectedNoteIds(this.state.selectedItems.values())
    if (ids.length === 0) {
      dbg('[Clipboard] copy: nothing selected')
      return
    }
    const payload = buildClipboardFromSelection(engine.getScore(), ids)
    if (!payload) {
      console.warn('[Clipboard] copy: selection produced no copyable events')
      return
    }
    this.payload = payload
    // Debug dump (requested): a readable summary + the full payload, to diff against
    // the data model / VexFlow output when a paste looks wrong.
    dbg(`[Clipboard] copied — ${clipboardSummary(payload)}`)
    dbg('[Clipboard] payload:', JSON.parse(JSON.stringify(payload)))
  }

  /**
   * Paste. With a selection → overwrite-forward from its start. With no selection →
   * arm placement mode (the next canvas click sets the origin; Esc cancels).
   */
  paste(): void {
    if (!this.payload) {
      dbg('[Clipboard] paste: clipboard empty')
      return
    }
    const engine = this.getEngine()
    if (!engine) return

    const ids = selectedNoteIds(this.state.selectedItems.values())
    if (ids.length === 0) {
      this.state.pastePlacementArmed = true
      this.state.showCursor = false
      dbg('[Clipboard] paste armed — click an insertion point (Esc to cancel)')
      return
    }
    // Paste onto a selection → overwrite forward from the earliest selected note,
    // into that note's voice AND staff (the destination for a single-voice/single-staff clip).
    const target = earliestSelectedPosition(engine.getScore(), ids)
    if (target) this.placeAt(target)
  }

  /** Commit an armed paste at a clicked position (called by MouseController). `staff` is the
   *  0-based stacked staff the click landed on — the paste destination staff. */
  pasteAt(measure: number, beat: Fraction, staff: number = 0): void {
    this.state.pastePlacementArmed = false
    // Armed click → the active voice is the destination for a single-voice clip; the clicked
    // staff is the destination staff.
    this.placeAt({ measure, beat, voice: activeVoiceToModel(this.state.activeVoice), staff })
  }

  /** Cancel an armed paste (Esc / leaving the mode). */
  cancelArmedPaste(): void {
    if (!this.state.pastePlacementArmed) return
    this.state.pastePlacementArmed = false
    this.state.showCursor = true
    this.render.renderScore()
    dbg('[Clipboard] paste cancelled')
  }

  /** Paste the held clip at `target` — the one place this controller hands the clip to the engine. */
  private placeAt(target: ClipTarget): void {
    const engine = this.getEngine()
    if (!engine || !this.payload) return
    // The payload IS the clip (it adds only the clipboard's envelope), so everything that travels
    // with the music — each lane's rest shifts, hidden rests, note offsets and two-note tremolos,
    // plus the clip-wide dynamics, slurs and authored spaces — goes across as fields of it. This
    // controller's job is the TARGET: which (measure, beat, voice, staff) it lands on.
    const pastedIds = engine.pasteEvents(this.payload, target)
    dbg(`[Clipboard] pasted ${pastedIds.length} note(s) at measure ${target.measure} beat ${fracToNumber(target.beat)}`)
    this.selection.selectNotes(pastedIds)
    this.state.showCursor = true
    this.render.renderScore()
  }
}
