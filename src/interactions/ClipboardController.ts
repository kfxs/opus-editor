import type { Fraction } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import type { SelectionController } from './SelectionController'
import type { RenderController } from './RenderController'
import { selectedNoteIds } from './selection'
import { fracToNumber } from '../utils/fraction'
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
      console.log('[Clipboard] copy: nothing selected')
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
    console.log(`[Clipboard] copied — ${clipboardSummary(payload)}`)
    console.log('[Clipboard] payload:', JSON.parse(JSON.stringify(payload)))
  }

  /**
   * Paste. With a selection → overwrite-forward from its start. With no selection →
   * arm placement mode (the next canvas click sets the origin; Esc cancels).
   */
  paste(): void {
    if (!this.payload) {
      console.log('[Clipboard] paste: clipboard empty')
      return
    }
    const engine = this.getEngine()
    if (!engine) return

    const ids = selectedNoteIds(this.state.selectedItems.values())
    if (ids.length === 0) {
      this.state.pastePlacementArmed = true
      this.state.showCursor = false
      console.log('[Clipboard] paste armed — click an insertion point (Esc to cancel)')
      return
    }
    const target = earliestSelectedPosition(engine.getScore(), ids)
    if (target) this.placeAt(target.measure, target.beat)
  }

  /** Commit an armed paste at a clicked position (called by MouseController). */
  pasteAt(measure: number, beat: Fraction): void {
    this.state.pastePlacementArmed = false
    this.placeAt(measure, beat)
  }

  /** Cancel an armed paste (Esc / leaving the mode). */
  cancelArmedPaste(): void {
    if (!this.state.pastePlacementArmed) return
    this.state.pastePlacementArmed = false
    this.state.showCursor = true
    this.render.renderScore()
    console.log('[Clipboard] paste cancelled')
  }

  private placeAt(measure: number, beat: Fraction): void {
    const engine = this.getEngine()
    if (!engine || !this.payload) return
    const pastedIds = engine.pasteEvents(measure, beat, this.payload.events, this.payload.spanBeats)
    console.log(`[Clipboard] pasted ${pastedIds.length} note(s) at measure ${measure} beat ${fracToNumber(beat)}`)
    this.selection.selectNotes(pastedIds)
    this.state.showCursor = true
    this.render.renderScore()
  }
}
