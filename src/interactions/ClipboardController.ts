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
  windowSlotIds,
  type ClipboardPayload,
} from './clipboard'
import { copyElement, pasteElement, elementClipSummary, type ElementClip } from './elementClipboard'
import { markItems } from './enclosedMarks'
import { pasteAnchorFor, type PasteAnchor } from './pasteAnchor'

/**
 * Copy / paste of the current selection. Phase A handles notes/chords/rests; the
 * payload is sectioned so future element kinds slot in without reworking this.
 * Framework-agnostic: reads/writes EditorState + engine, no Vue/React imports.
 *
 * Paste semantics: overwrite-forward from the selection's start. With nothing
 * selected, Ctrl+V arms a placement mode — the blue place-cursor, and nothing drawn on the score —
 * and the next canvas click commits the origin.
 *
 * ⭐ **TWO THINGS CAN BE HELD, and only ever one at a time** (2026-08-19): the MUSIC
 * ({@link ClipboardPayload} — notes, and everything that travels with a lane) or ONE on-score
 * ELEMENT ({@link ElementClip} — an expression today). A copy replaces whatever was held, so
 * Ctrl+V never has to guess which of two clipboards the user meant: the last Ctrl+C is the answer.
 * The controller stays the facade — WHAT travels is `./elementClipboard`, WHERE it lands is
 * `./pasteAnchor`.
 */
export class ClipboardController {
  private payload: ClipboardPayload | null = null
  private element: ElementClip | null = null

  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private selection: SelectionController,
    private render: RenderController,
  ) {}

  hasContent(): boolean {
    return this.payload !== null || this.element !== null
  }

  /** Copy the selected notes into the clipboard, dumping the payload to the console. */
  copy(): void {
    const engine = this.getEngine()
    if (!engine) return

    // ⭐ The ELEMENT first: selecting an element clears the note selection (selecting IS clearing),
    // so the two branches can never both have something to copy — the order is readability, not a
    // precedence rule.
    const element = copyElement(engine, this.state.selectedElement)
    if (element) {
      this.element = element
      this.payload = null
      dbg(`[Clipboard] copied — ${elementClipSummary(element)}`)
      return
    }

    const ids = selectedNoteIds(this.state.selectedItems.values())
    if (ids.length === 0) {
      dbg('[Clipboard] copy: nothing selected')
      return
    }
    // ⭐ **THE CLIP CARRIES WHAT IS SELECTED**, not what the note window happens to enclose (his
    // report, 2026-08-19: *"i'm not selecting the dynamic, however it paste it"*, holding a
    // Ctrl-built selection of three notes and one slur). A box or a passage click puts every
    // enclosed mark in the set, so those copies are unchanged; a hand-built one carries exactly
    // the marks it shows as selected.
    const markIds = new Set(markItems(this.state.selectedItems.values()).map(m => m.id))
    const payload = buildClipboardFromSelection(engine.getScore(), ids, markIds)
    if (!payload) {
      console.warn('[Clipboard] copy: selection produced no copyable events')
      return
    }
    this.payload = payload
    this.element = null
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
    if (!this.payload && !this.element) {
      dbg('[Clipboard] paste: clipboard empty')
      return
    }
    const engine = this.getEngine()
    if (!engine) return

    // An element pastes at whatever the SELECTION points at — a note/rest exactly, anything else at
    // the nearest anchorable point (`./pasteAnchor`). Nothing selected → the same armed click the
    // music clip uses, because there is nothing to anchor to and a paste must never guess a place.
    if (this.element) {
      const anchor = pasteAnchorFor(engine, this.state)
      if (!anchor) { this.armPlacement(); return }
      this.placeElementAt(anchor)
      return
    }

    const ids = selectedNoteIds(this.state.selectedItems.values())
    if (ids.length === 0) {
      this.armPlacement()
      return
    }
    // Paste onto a selection → overwrite forward from the earliest selected note,
    // into that note's voice AND staff (the destination for a single-voice/single-staff clip).
    const target = earliestSelectedPosition(engine.getScore(), ids)
    if (target) this.placeAt(target)
  }

  /** Commit an armed paste at a clicked position (called by MouseController). `staff` is the
   *  0-based stacked staff the click landed on — the paste destination staff. */
  pasteAt(measure: number, beat: Fraction, staff: number = 0, noteId?: string): void {
    this.state.pastePlacementArmed = false
    // Armed click → the active voice is the destination for a single-voice clip; the clicked
    // staff is the destination staff. ⭐ `noteId` is the note the click landed ON, when it did: the
    // kinds whose anchor must BE a note (the slur) refuse without it — see {@link PasteAnchor}.
    const target = {
      measure, beat, voice: activeVoiceToModel(this.state.activeVoice), staff,
      ...(noteId ? { noteId } : {}),
    }
    if (this.element) this.placeElementAt(target)
    else this.placeAt(target)
  }

  /** Arm click-to-place: the paste has nowhere to anchor, so the next click on the score says
   *  where. Shows as the blue place-cursor (`scoreCursorClass`) — nothing is drawn on the music. */
  private armPlacement(): void {
    this.state.pastePlacementArmed = true
    this.state.showCursor = false
    dbg('[Clipboard] paste armed — click an insertion point (Esc to cancel)')
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
    // ⭐ A clip of pure SILENCE creates no notes, so `pasteEvents` reports none — and selecting
    // nothing after a paste reads as "nothing happened", which is exactly what the rest paste is not
    // (it overwrote the window). Fall back to the slots the window now holds: the rests it wrote.
    const selected = pastedIds.length ? pastedIds : windowSlotIds(engine.getScore(), target, this.payload.spanBeats)
    dbg(`[Clipboard] pasted ${pastedIds.length} note(s)`
      + `${pastedIds.length === 0 ? ` + ${selected.length} rest slot(s)` : ''}`
      + ` at measure ${target.measure} beat ${fracToNumber(target.beat)}`)
    this.selection.selectNotes(selected)
    this.state.showCursor = true
    this.render.renderScore()
  }

  /**
   * Paste the held ELEMENT at `anchor` — the element twin of {@link placeAt}, and the one place the
   * element clip reaches the engine. The new mark becomes the selection (a paste leaves you holding
   * what you just made), which means clearing the note selection exactly as an element PRESS does.
   */
  private placeElementAt(anchor: PasteAnchor): void {
    const engine = this.getEngine()
    if (!engine || !this.element) return
    const created = pasteElement(engine, this.element, anchor)
    if (!created) {
      dbg(`[Clipboard] element paste refused at measure ${anchor.measure}`)
      return
    }
    dbg(`[Clipboard] pasted ${elementClipSummary(this.element)} at measure ${anchor.measure} `
      + `beat ${fracToNumber(anchor.beat)}${anchor.staff !== undefined ? ` staff ${anchor.staff}` : ''}`)
    this.selection.selectNote(null)
    this.state.selectedElement = created
    this.state.showCursor = true
    this.render.renderScore()
  }
}
