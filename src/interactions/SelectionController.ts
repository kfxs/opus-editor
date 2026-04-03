import type { Accidental, Note, Measure, PitchStep, PitchAlter } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { buildBeatMap } from '../utils/beatMap'
import { fracLt, fracEq, fracCompare } from '../utils/fraction'
import { getMeasureNotes } from '../utils/musicUtils'
import { spellingToMidi, spellingDiatonicPos } from '../utils/pitchSpelling'

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

  /**
   * Select a note by ID and sync the palette (duration, accidental, dots) to its properties.
   * Pass null to clear the selection.
   * Also clears any articulation/accidental/tuplet sub-selections.
   */
  selectNote(noteId: string | null): void {
    this.state.selectedNoteId = noteId
    this.state.selectedArticulationNoteId = null
    this.state.selectedArticulationType = null
    this.state.selectedAccidentalNoteId = null
    this.state.selectedAccidentalType = null

    if (noteId) {
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

    this.selectNote(beats[newIndex].id)
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

  /** Adjust pitch of selected note by one diatonic step. No-op on rests. */
  adjustPitch(direction: number): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return
    if (this.state.selectedTool !== 'selection' && this.state.selectedTool !== 'entry') return

    const score = engine.getScore()
    let selectedNote = null
    for (const measure of score.measures) {
      const note = getMeasureNotes(measure).find(n => n.id === this.state.selectedNoteId)
      if (note) { selectedNote = note; break }
    }

    if (!selectedNote || selectedNote.isRest) return

    const newSpelling = this.movePitchDiatonically(
      selectedNote.step!, selectedNote.alter!, selectedNote.octave!, direction,
    )
    engine.updateNote(this.state.selectedNoteId, {
      step: newSpelling.step, alter: newSpelling.alter, octave: newSpelling.octave,
    })
    this.renderScore()
  }

  /** Adjust pitch of selected note by one octave. No-op on rests. */
  adjustOctave(direction: number): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return
    if (this.state.selectedTool !== 'selection' && this.state.selectedTool !== 'entry') return

    const score = engine.getScore()
    let selectedNote = null
    for (const measure of score.measures) {
      const note = getMeasureNotes(measure).find(n => n.id === this.state.selectedNoteId)
      if (note) { selectedNote = note; break }
    }

    if (!selectedNote || selectedNote.isRest) return

    engine.updateNote(this.state.selectedNoteId, { octave: selectedNote.octave! + direction })
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
