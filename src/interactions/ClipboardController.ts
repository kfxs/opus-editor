import { dbg } from '@/utils/debug'
import type { Fraction } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import type { SelectionController } from './SelectionController'
import type { RenderController } from './RenderController'
import { selectedNoteIds } from './selection'
import { activeVoiceToModel } from './EditorState'
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
    if (target) this.placeAt(target.measure, target.beat, target.voice, target.staff)
  }

  /** Commit an armed paste at a clicked position (called by MouseController). `staff` is the
   *  0-based stacked staff the click landed on — the paste destination staff. */
  pasteAt(measure: number, beat: Fraction, staff: number = 0): void {
    this.state.pastePlacementArmed = false
    // Armed click → the active voice is the destination for a single-voice clip; the clicked
    // staff is the destination staff.
    this.placeAt(measure, beat, activeVoiceToModel(this.state.activeVoice), staff)
  }

  /** Cancel an armed paste (Esc / leaving the mode). */
  cancelArmedPaste(): void {
    if (!this.state.pastePlacementArmed) return
    this.state.pastePlacementArmed = false
    this.state.showCursor = true
    this.render.renderScore()
    dbg('[Clipboard] paste cancelled')
  }

  private placeAt(measure: number, beat: Fraction, targetVoice: number, targetStaff: number = 0): void {
    const engine = this.getEngine()
    if (!engine || !this.payload) return
    // Carry each lane's rest shifts (clip-relative offsets + relative staff) so they re-base by
    // the paste start and re-map onto the paste target staves.
    const clipRestShifts = this.payload.lanes
      .filter((l) => l.restShifts?.length)
      .map((l) => ({ staff: l.staff, voice: l.voice, restShifts: l.restShifts! }))
    // Likewise the hidden rests (client #6) — re-based, re-voiced and re-staffed the same way.
    const clipRestHidden = this.payload.lanes
      .filter((l) => l.restHidden?.length)
      .map((l) => ({ staff: l.staff, voice: l.voice, restHidden: l.restHidden! }))
    // Note horizontal offsets (client #12) carry per lane like the rest shifts — re-based, re-voiced
    // and re-staffed the same way (a note offset is slot-keyed, so it covers chords and rests).
    const clipNoteOffsets = this.payload.lanes
      .filter((l) => l.noteOffsets?.length)
      .map((l) => ({ staff: l.staff, voice: l.voice, noteOffsets: l.noteOffsets! }))
    // Two-note tremolos travel the same way, and for a sharper reason: the event stream deliberately
    // cannot hold the relation at all (see `ClipboardLane.tremoloPairs`), so this channel IS how a
    // copied pair comes back. Re-validated against the tiling it lands in.
    const clipTremoloPairs = this.payload.lanes
      .filter((l) => l.tremoloPairs?.length)
      .map((l) => ({ staff: l.staff, voice: l.voice, tremoloPairs: l.tremoloPairs! }))
    // Authored leading spaces (client #10) need no lane mapping at all: a space belongs to the
    // column, so its clip-relative offset is its whole address.
    const pastedIds = engine.pasteEvents(measure, beat, this.payload.lanes, this.payload.spanBeats, targetVoice, clipRestShifts, clipRestHidden, targetStaff, this.payload.dynamics, this.payload.slurs, this.payload.spaces ?? [], clipNoteOffsets, clipTremoloPairs)
    dbg(`[Clipboard] pasted ${pastedIds.length} note(s) at measure ${measure} beat ${fracToNumber(beat)}`)
    this.selection.selectNotes(pastedIds)
    this.state.showCursor = true
    this.render.renderScore()
  }
}
