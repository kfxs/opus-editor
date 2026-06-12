import type { Accidental, Note, Measure, PitchStep, PitchAlter } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { buildBeatMap, notesInRange } from '../utils/beatMap'
import { fracLt, fracEq, fracCompare } from '../utils/fraction'
import { getMeasureNotes } from '../utils/musicUtils'
import { spellingToMidi, spellingDiatonicPos } from '../utils/pitchSpelling'
import { itemKey, selectedNoteIds, type SelectionItem } from './selection'

/**
 * Handles note selection, navigation, pitch adjustment, and scroll-into-view.
 * Framework-agnostic: reads/writes EditorState directly, no Vue/React/Angular imports.
 */
export class SelectionController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private getScoreCanvas: () => HTMLElement | null,
    private renderScore: () => void,
  ) {}

  /**
   * Compute which accidental sign would actually be displayed for a note, given the
   * running accidental state of its measure up to that beat.
   * Returns null if no sign is shown, 'n' for a cautionary natural.
   */
  private computeDisplayedAccidental(note: Note, measure: Measure): Accidental | 'n' | null {
    if (note.isRest || note.tiedFrom) return null
    if (note.forceAccidental && note.alter) return note.alter > 0 ? '#' : 'b'

    const active = new Map<number, number>()
    const preceding = getMeasureNotes(measure)
      .filter(n => !n.isRest && !n.tiedFrom && fracLt(n.beat, note.beat))
      .sort((a, b) => fracCompare(a.beat, b.beat))

    for (const n of preceding) {
      const dPos = spellingDiatonicPos(n.step!, n.octave!)
      active.set(dPos, n.alter ?? 0)
    }

    const dPos = spellingDiatonicPos(note.step!, note.octave!)
    const activeAlter = active.get(dPos)
    const noteAlter = note.alter ?? 0

    if (noteAlter !== 0) {
      return activeAlter === noteAlter ? null : (noteAlter > 0 ? '#' : 'b')
    } else {
      if (activeAlter !== undefined && activeAlter !== 0) return 'n'
      if (note.forceAccidental) return 'n'
      return null
    }
  }

  /** Clear the per-element scalar sub-selections (articulation/accidental/tie/clef/…).
   *  Notes are mutually exclusive with these in Phase 1, so selecting a note clears them. */
  private clearScalarSubSelections(): void {
    this.state.selectedBeam = 'auto'
    this.state.selectedArticulationNoteId = null
    this.state.selectedArticulationType = null
    this.state.selectedAccidentalNoteId = null
    this.state.selectedAccidentalType = null
    this.state.selectedTieFromNoteId = null
    this.state.selectedClefMeasure = null
    this.state.selectedClefBeat = null
    this.state.selectedTimeSignatureMeasure = null
  }

  /** Sync the palette (duration, accidental, dots) to a note's properties. No-op if not found. */
  private syncPaletteToNote(noteId: string): void {
    const engine = this.getEngine()
    if (!engine) return
    const score = engine.getScore()
    for (const measure of score.measures) {
      const note = getMeasureNotes(measure).find(n => n.id === noteId)
      if (note) {
        this.state.selectedDuration = note.duration
        this.state.selectedAccidental = this.computeDisplayedAccidental(note, measure)
        this.state.selectedDots = note.dots || 0
        break
      }
    }
  }

  /** Recompute the anchor (selectedNoteId) as the last note item in the set, or null. */
  private recomputeAnchor(): void {
    const ids = selectedNoteIds(this.state.selectedItems.values())
    this.state.selectedNoteId = ids.length ? ids[ids.length - 1] : null
  }

  /**
   * REPLACE the selection with a single note by ID (or clear it with null), and
   * sync the palette to that note. Also clears any scalar sub-selections.
   * This is the plain-click / navigation / entry path.
   */
  selectNote(noteId: string | null): void {
    this.state.selectedItems.clear()
    if (noteId) {
      const item: SelectionItem = { kind: 'note', id: noteId }
      this.state.selectedItems.set(itemKey(item), item)
    }
    this.state.selectedNoteId = noteId
    // A plain click (re)sets the Shift pivot and the range base = this single note.
    this.state.selectionPivotId = noteId
    this.state.selectionBase = noteId ? [{ kind: 'note', id: noteId }] : []
    this.clearScalarSubSelections()
    if (noteId) this.syncPaletteToNote(noteId)
  }

  /**
   * REPLACE the selection with a set of notes by id (e.g. the freshly pasted
   * notes). The last id becomes the anchor and the Shift pivot; the palette syncs
   * to it. Empty list clears the selection.
   */
  selectNotes(noteIds: string[]): void {
    this.state.selectedItems.clear()
    for (const id of noteIds) {
      const item: SelectionItem = { kind: 'note', id }
      this.state.selectedItems.set(itemKey(item), item)
    }
    const anchor = noteIds.length ? noteIds[noteIds.length - 1] : null
    this.state.selectedNoteId = anchor
    this.state.selectionPivotId = anchor
    this.state.selectionBase = Array.from(this.state.selectedItems.values())
    this.clearScalarSubSelections()
    if (anchor) this.syncPaletteToNote(anchor)
  }

  /**
   * TOGGLE a note in/out of the multi-selection (ctrl/cmd-click). Adding a note
   * makes it the anchor and syncs the palette; removing one recomputes the anchor
   * to the remaining last note. Also clears scalar sub-selections, since notes are
   * mutually exclusive with the other element kinds in Phase 1.
   */
  toggleNote(noteId: string): void {
    const item: SelectionItem = { kind: 'note', id: noteId }
    const key = itemKey(item)
    if (this.state.selectedItems.has(key)) {
      this.state.selectedItems.delete(key)
      this.recomputeAnchor()
      if (this.state.selectedNoteId) this.syncPaletteToNote(this.state.selectedNoteId)
    } else {
      this.state.selectedItems.set(key, item)
      this.state.selectedNoteId = noteId
      this.syncPaletteToNote(noteId)
    }
    // The last Ctrl-clicked note becomes the Shift pivot; the range base is the
    // current selection, so a following Shift-click keeps these notes.
    this.state.selectionPivotId = noteId
    this.state.selectionBase = Array.from(this.state.selectedItems.values())
    this.clearScalarSubSelections()
  }

  /**
   * SHIFT-click: select the inclusive temporal range from the pivot to `targetId`
   * (rests in between and whole chords included), unioned onto the range base (the
   * selection as of the last plain/Ctrl click). The pivot stays fixed, so a further
   * Shift-click re-flows the range from the same point while keeping the base.
   * With no pivot yet, falls back to a plain single-select.
   */
  extendSelectionTo(targetId: string): void {
    const engine = this.getEngine()
    if (!engine) return
    if (!this.state.selectionPivotId) {
      this.selectNote(targetId)
      return
    }

    const rangeIds = notesInRange(engine.getScore(), this.state.selectionPivotId, targetId)

    this.state.selectedItems.clear()
    for (const item of this.state.selectionBase) {
      this.state.selectedItems.set(itemKey(item), item)
    }
    for (const id of rangeIds) {
      const item: SelectionItem = { kind: 'note', id }
      this.state.selectedItems.set(itemKey(item), item)
    }
    // Nav anchor follows the Shift target; the pivot is intentionally left unchanged.
    this.state.selectedNoteId = targetId
    this.clearScalarSubSelections()
    this.syncPaletteToNote(targetId)
  }

  /**
   * Set selectedNoteId and notify the engine's undo manager.
   * Use this instead of selectNote when the change should be tracked for undo/redo.
   */
  setSelectedNote(id: string | null): void {
    this.state.selectedNoteId = id
    const engine = this.getEngine()
    if (engine) engine.updateUndoNoteId(id)
  }

  /**
   * Navigate selection left/right. Chords are treated as a single unit.
   * Past the first/last beat clears selection.
   */
  navigateSelection(direction: number): void {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return

    const score = engine.getScore()
    const { allFlat, beats } = buildBeatMap(score)

    const currentNote = allFlat.find(n => n.id === this.state.selectedNoteId)
    if (!currentNote) return
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) return

    const newIndex = currentIndex + direction
    if (newIndex < 0 || newIndex >= beats.length) {
      this.selectNote(null)
      this.renderScore()
      return
    }

    const dest = beats[newIndex]
    const destNote = allFlat.find(n => n.id === dest.id)
    const destDesc = destNote
      ? (destNote.isRest ? `rest m${dest.measureNumber} beat:${dest.beat.num / dest.beat.den}` : `${destNote.step}${destNote.alter !== 0 ? (destNote.alter! > 0 ? '#' : 'b') : ''}${destNote.octave} m${dest.measureNumber} beat:${dest.beat.num / dest.beat.den}`)
      : `id:${dest.id}`
    console.log(`[Nav] ${direction > 0 ? '→' : '←'} → ${destDesc} (tool:${this.state.selectedTool})`)
    this.selectNote(dest.id)
    this.renderScore()
    this.scrollSelectedNoteIntoView()
  }

  /**
   * Navigate within a chord by pitch (up/down). Clamped at top/bottom note.
   */
  navigateChord(direction: number): void {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return

    const note = engine.getNote(this.state.selectedNoteId)
    if (!note || note.isRest) return

    const score = engine.getScore()
    const measure = score.measures.find(m => m.number === note.measure)
    if (!measure) return

    const chordNotes = getMeasureNotes(measure)
      .filter(n => !n.isRest && fracEq(n.beat, note.beat))
      .sort((a, b) => spellingToMidi(a.step!, a.alter!, a.octave!) - spellingToMidi(b.step!, b.alter!, b.octave!))

    if (chordNotes.length <= 1) return

    const currentIndex = chordNotes.findIndex(n => n.id === this.state.selectedNoteId)
    if (currentIndex === -1) return

    const newIndex = Math.max(0, Math.min(chordNotes.length - 1, currentIndex + direction))
    if (newIndex === currentIndex) return

    this.selectNote(chordNotes[newIndex].id)
    this.renderScore()
  }

  /** Adjust pitch of EVERY selected note by one diatonic step. Rests are skipped. */
  adjustPitch(direction: number): void {
    const engine = this.getEngine()
    if (!engine) return
    if (this.state.selectedTool !== 'selection' && this.state.selectedTool !== 'entry') return

    const ids = selectedNoteIds(this.state.selectedItems.values())
    // One undoable action for the whole selection (a single Ctrl-Z reverts it all).
    const moved = engine.runBatch(`Transpose ${ids.length} note(s)`, () => {
      for (const id of ids) {
        const note = engine.getNote(id)
        if (!note || note.isRest) continue
        const newSpelling = this.movePitchDiatonically(note.step!, note.alter!, note.octave!, direction)
        engine.updateNote(id, {
          step: newSpelling.step, alter: newSpelling.alter, octave: newSpelling.octave,
        })
      }
    })
    if (!moved) return
    console.log(`[Pitch] ${direction > 0 ? '↑' : '↓'} → ${ids.length} note(s) (tool:${this.state.selectedTool})`)
    this.renderScore()
  }

  /** Adjust pitch of EVERY selected note by one octave. Rests are skipped. */
  adjustOctave(direction: number): void {
    const engine = this.getEngine()
    if (!engine) return
    if (this.state.selectedTool !== 'selection' && this.state.selectedTool !== 'entry') return

    const ids = selectedNoteIds(this.state.selectedItems.values())
    // One undoable action for the whole selection (a single Ctrl-Z reverts it all).
    const moved = engine.runBatch(`Octave ${ids.length} note(s)`, () => {
      for (const id of ids) {
        const note = engine.getNote(id)
        if (!note || note.isRest) continue
        engine.updateNote(id, { octave: note.octave! + direction })
      }
    })
    if (!moved) return
    console.log(`[Pitch] octave${direction > 0 ? '↑' : '↓'} → ${ids.length} note(s)`)
    this.renderScore()
  }

  /**
   * Get a reference pitch (MIDI) from neighboring notes for octave context.
   * Returns average of nearest prev/next non-rest notes, or 60 if none exist.
   */
  getContextPitch(): number {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedNoteId) return 60

    const score = engine.getScore()
    const allNotes = score.measures
      .flatMap(m => getMeasureNotes(m).map(n => ({ ...n, measureNumber: m.number })))
      .sort((a, b) =>
        a.measureNumber !== b.measureNumber
          ? a.measureNumber - b.measureNumber
          : fracCompare(a.beat, b.beat),
      )

    const currentIndex = allNotes.findIndex(n => n.id === this.state.selectedNoteId)
    if (currentIndex === -1) return 60

    let prevMidi: number | null = null
    let nextMidi: number | null = null

    for (let i = currentIndex - 1; i >= 0; i--) {
      const n = allNotes[i]
      if (!n.isRest && n.step) { prevMidi = spellingToMidi(n.step, n.alter!, n.octave!); break }
    }
    for (let i = currentIndex + 1; i < allNotes.length; i++) {
      const n = allNotes[i]
      if (!n.isRest && n.step) { nextMidi = spellingToMidi(n.step, n.alter!, n.octave!); break }
    }

    if (prevMidi !== null && nextMidi !== null) return Math.round((prevMidi + nextMidi) / 2)
    if (prevMidi !== null) return prevMidi
    if (nextMidi !== null) return nextMidi
    return 60
  }

  /** Scroll the canvas so the selected note is visible. */
  scrollSelectedNoteIntoView(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedNoteId) return

    const elementInfo = engine.getElementById(this.state.selectedNoteId)
    if (!elementInfo) return

    const bbox = elementInfo.bbox
    const padding = 50
    const containerRect = scoreCanvas.getBoundingClientRect()

    const elementLeft = bbox.x
    const elementRight = bbox.x + bbox.width
    const visibleLeft = scoreCanvas.scrollLeft
    const visibleRight = scoreCanvas.scrollLeft + containerRect.width

    if (elementLeft < visibleLeft + padding) {
      scoreCanvas.scrollLeft = Math.max(0, elementLeft - padding)
    } else if (elementRight > visibleRight - padding) {
      scoreCanvas.scrollLeft = elementRight - containerRect.width + padding
    }

    const elementTop = bbox.y
    const elementBottom = bbox.y + bbox.height
    const visibleTop = scoreCanvas.scrollTop
    const visibleBottom = scoreCanvas.scrollTop + containerRect.height

    if (elementTop < visibleTop + padding) {
      scoreCanvas.scrollTop = Math.max(0, elementTop - padding)
    } else if (elementBottom > visibleBottom - padding) {
      scoreCanvas.scrollTop = elementBottom - containerRect.height + padding
    }
  }

  private movePitchDiatonically(
    step: PitchStep, alter: PitchAlter, octave: number, direction: number,
  ): { step: PitchStep; alter: PitchAlter; octave: number } {
    const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    let idx = STEPS.indexOf(step)
    let newOctave = octave
    idx += direction
    if (idx > 6) { idx = 0; newOctave++ }
    else if (idx < 0) { idx = 6; newOctave-- }
    return { step: STEPS[idx], alter, octave: newOctave }
  }
}
