import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Accidental, NoteDuration, Note, Measure, PitchStep, PitchAlter } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import { buildBeatMap } from '../utils/beatMap'
import { fracLt, fracEq, fracCompare } from '../utils/fraction'
import { getMeasureNotes } from '../utils/musicUtils'
import { spellingToMidi, spellingDiatonicPos } from '../utils/pitchSpelling'

interface SelectionDeps {
  selectedTool: Ref<'entry' | 'selection'>
  selectedNoteId: Ref<string | null>
  engine: Ref<MusicEngine | null>
  scoreCanvas: Ref<HTMLElement | null>
  // Palette refs — written to when a note is selected, to sync the palette
  selectedDuration: Ref<NoteDuration>
  selectedAccidental: Ref<Accidental | null>
  selectedDots: Ref<number>
  renderScore: () => void
}

export function useSelection(deps: SelectionDeps) {
  const {
    selectedTool, selectedNoteId, engine, scoreCanvas,
    selectedDuration, selectedAccidental, selectedDots,
    renderScore,
  } = deps

  // --- State ---

  const selectedArticulationNoteId = ref<string | null>(null)
  const selectedArticulationType = ref<string | null>(null)

  // Selected accidental (separate from note selection)
  const selectedAccidentalNoteId = ref<string | null>(null)
  const selectedAccidentalType = ref<string | null>(null)

  // Selected tuplet ID (for tuplet selection/deletion)
  const selectedTupletId = ref<string | null>(null)

  // --- Functions ---

  /**
   * Compute which accidental sign would actually be displayed for a note, given the
   * running accidental state of its measure up to that beat.
   * Returns null if no sign is shown, 'n' for a cautionary natural.
   */
  function computeDisplayedAccidental(note: Note, measure: Measure): Accidental | 'n' | null {
    if (note.isRest || note.tiedFrom) return null
    if (note.forceAccidental && note.alter) return note.alter > 0 ? '#' : 'b'

    // Build active-alter state from notes strictly before this note's beat.
    // Key = diatonic staff position (same as the renderer) — this is what determines
    // whether a natural sign is needed, not the MIDI pitch. C# and C natural share the
    // same diatonic position, so a preceding C# requires a ♮ on a later C natural.
    const active = new Map<number, PitchAlter>()
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
      // Note has an accidental — show it only if it differs from the active state
      return activeAlter === noteAlter ? null : (noteAlter > 0 ? '#' : 'b')
    } else {
      // Natural note — show 'n' cautionary if there was a previous accidental
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
  function selectNote(noteId: string | null) {
    selectedNoteId.value = noteId
    selectedArticulationNoteId.value = null
    selectedArticulationType.value = null
    selectedAccidentalNoteId.value = null
    selectedAccidentalType.value = null

    if (noteId && engine.value) {
      const score = engine.value.getScore()
      for (const measure of score.measures) {
        const note = getMeasureNotes(measure).find(n => n.id === noteId)
        if (note) {
          // Sync duration palette (works for both notes and rests)
          selectedDuration.value = note.duration
          // Sync accidental palette to what is VISUALLY DISPLAYED, not the raw stored value.
          // This ensures the palette accurately reflects what the user sees in the score.
          selectedAccidental.value = computeDisplayedAccidental(note, measure)
          // Sync dots palette
          selectedDots.value = note.dots || 0
          break
        }
      }
    }
  }

  /**
   * Set selectedNoteId and notify the engine's undo manager.
   * Use this instead of writing selectedNoteId directly when the change
   * should be tracked for undo/redo purposes.
   */
  function setSelectedNote(id: string | null) {
    selectedNoteId.value = id
    if (engine.value) engine.value.updateUndoNoteId(id)
  }

  /**
   * Navigate selection left/right by direction (-1 for previous, 1 for next).
   * Chords are treated as a single unit — horizontal navigation moves between
   * beats, not between individual chord notes (use navigateChord for that).
   * Landing on a chord always selects its lowest-pitch note.
   * Past the first/last beat: clears selection.
   */
  function navigateSelection(direction: number) {
    if (selectedTool.value !== 'selection' || !selectedNoteId.value || !engine.value) return

    const score = engine.value.getScore()
    const { allFlat, beats } = buildBeatMap(score)

    // Find the beat group the current selection belongs to
    const currentNote = allFlat.find(n => n.id === selectedNoteId.value)
    if (!currentNote) return
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) return

    const newIndex = currentIndex + direction

    // Past boundaries → deselect
    if (newIndex < 0 || newIndex >= beats.length) {
      selectNote(null)
      renderScore()
      return
    }

    selectNote(beats[newIndex].id)
    renderScore()
    scrollSelectedNoteIntoView()
  }

  /**
   * Navigate within a chord by pitch (up/down).
   * Moves selection to the next higher or lower note at the same beat.
   * Clamped: stays on the top/bottom note instead of wrapping.
   */
  function navigateChord(direction: number) {
    if (selectedTool.value !== 'selection' || !selectedNoteId.value || !engine.value) return

    const note = engine.value.getNote(selectedNoteId.value)
    if (!note || note.isRest) return

    const score = engine.value.getScore()
    const measure = score.measures.find(m => m.number === note.measure)
    if (!measure) return

    // All non-rest notes at the same beat, sorted low → high
    const chordNotes = getMeasureNotes(measure)
      .filter(n => !n.isRest && fracEq(n.beat, note.beat))
      .sort((a, b) => spellingToMidi(a.step!, a.alter!, a.octave!) - spellingToMidi(b.step!, b.alter!, b.octave!))

    if (chordNotes.length <= 1) return

    const currentIndex = chordNotes.findIndex(n => n.id === selectedNoteId.value)
    if (currentIndex === -1) return

    const newIndex = Math.max(0, Math.min(chordNotes.length - 1, currentIndex + direction))
    if (newIndex === currentIndex) return

    selectNote(chordNotes[newIndex].id)
    renderScore()
  }

  /**
   * Adjust pitch of selected note by one diatonic step up or down.
   * Works in both selection and entry mode. No-op on rests.
   */
  function adjustPitch(direction: number) {
    if (!selectedNoteId.value || !engine.value) return
    if (selectedTool.value !== 'selection' && selectedTool.value !== 'entry') return

    const score = engine.value.getScore()
    let selectedNote = null
    for (const measure of score.measures) {
      const note = getMeasureNotes(measure).find(n => n.id === selectedNoteId.value)
      if (note) { selectedNote = note; break }
    }

    if (!selectedNote || selectedNote.isRest) return

    const newSpelling = movePitchDiatonically(selectedNote.step!, selectedNote.alter!, selectedNote.octave!, direction)
    engine.value.updateNote(selectedNoteId.value, { step: newSpelling.step, alter: newSpelling.alter, octave: newSpelling.octave })
    renderScore()
  }

  /**
   * Adjust pitch of selected note by one octave (12 semitones).
   * Works in both selection and entry mode. No-op on rests.
   */
  function adjustOctave(direction: number) {
    if (!selectedNoteId.value || !engine.value) return
    if (selectedTool.value !== 'selection' && selectedTool.value !== 'entry') return

    const score = engine.value.getScore()
    let selectedNote = null
    for (const measure of score.measures) {
      const note = getMeasureNotes(measure).find(n => n.id === selectedNoteId.value)
      if (note) { selectedNote = note; break }
    }

    if (!selectedNote || selectedNote.isRest) return

    engine.value.updateNote(selectedNoteId.value, { octave: selectedNote.octave! + direction })
    renderScore()
  }

  /**
   * Get a reference pitch from neighboring notes for octave context.
   * Returns the average pitch of the nearest prev/next non-rest notes,
   * or just one neighbor if only one exists, or 60 (C4) if there are none.
   */
  function getContextPitch(): number {
    if (!engine.value || !selectedNoteId.value) return 60

    const score = engine.value.getScore()
    const allNotes = score.measures
      .flatMap(m => getMeasureNotes(m).map(n => ({ ...n, measureNumber: m.number })))
      .sort((a, b) =>
        a.measureNumber !== b.measureNumber
          ? a.measureNumber - b.measureNumber
          : fracCompare(a.beat, b.beat)
      )

    const currentIndex = allNotes.findIndex(n => n.id === selectedNoteId.value)
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
    return 60 // default: middle C octave
  }

  /** Scroll the canvas so the selected note is visible. */
  function scrollSelectedNoteIntoView() {
    if (!engine.value || !scoreCanvas.value || !selectedNoteId.value) return

    const elementInfo = engine.value.getElementById(selectedNoteId.value)
    if (!elementInfo) return

    const container = scoreCanvas.value
    const bbox = elementInfo.bbox
    const padding = 50

    const containerRect = container.getBoundingClientRect()

    // Horizontal scroll check
    const elementLeft = bbox.x
    const elementRight = bbox.x + bbox.width
    const visibleLeft = container.scrollLeft
    const visibleRight = container.scrollLeft + containerRect.width

    if (elementLeft < visibleLeft + padding) {
      container.scrollLeft = Math.max(0, elementLeft - padding)
    } else if (elementRight > visibleRight - padding) {
      container.scrollLeft = elementRight - containerRect.width + padding
    }

    // Vertical scroll check
    const elementTop = bbox.y
    const elementBottom = bbox.y + bbox.height
    const visibleTop = container.scrollTop
    const visibleBottom = container.scrollTop + containerRect.height

    if (elementTop < visibleTop + padding) {
      container.scrollTop = Math.max(0, elementTop - padding)
    } else if (elementBottom > visibleBottom - padding) {
      container.scrollTop = elementBottom - containerRect.height + padding
    }
  }

  // --- Private helpers ---

  /**
   * Move a pitch spelling by one diatonic step (C↔D↔E↔F↔G↔A↔B), preserving the alter.
   */
  function movePitchDiatonically(step: PitchStep, alter: PitchAlter, octave: number, direction: number): { step: PitchStep; alter: PitchAlter; octave: number } {
    const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    let idx = STEPS.indexOf(step)
    let newOctave = octave
    idx += direction
    if (idx > 6) { idx = 0; newOctave++ }
    else if (idx < 0) { idx = 6; newOctave-- }
    return { step: STEPS[idx], alter, octave: newOctave }
  }

  return {
    // State
    selectedArticulationNoteId,
    selectedArticulationType,
    selectedAccidentalNoteId,
    selectedAccidentalType,
    selectedTupletId,
    // Functions
    selectNote,
    setSelectedNote,
    navigateSelection,
    navigateChord,
    adjustPitch,
    adjustOctave,
    getContextPitch,
    scrollSelectedNoteIntoView,
  }
}
