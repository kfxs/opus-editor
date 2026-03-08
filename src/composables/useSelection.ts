import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Accidental, NoteDuration } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import { buildBeatMap } from '../utils/beatMap'

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
        const note = measure.notes.find(n => n.id === noteId)
        if (note) {
          // Sync duration palette (works for both notes and rests)
          selectedDuration.value = note.duration
          // Sync accidental palette (only relevant for notes, rests have no accidental)
          selectedAccidental.value = note.accidental || null
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
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat}` === currentKey)
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
    const chordNotes = measure.notes
      .filter(n => !n.isRest && Math.abs(n.beat - note.beat) < 0.001)
      .sort((a, b) => a.pitch - b.pitch)

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
      const note = measure.notes.find(n => n.id === selectedNoteId.value)
      if (note) { selectedNote = note; break }
    }

    if (!selectedNote || selectedNote.isRest) return

    const newPitch = movePitchDiatonically(selectedNote.pitch, direction)
    engine.value.updateNote(selectedNoteId.value, { pitch: newPitch })
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
      const note = measure.notes.find(n => n.id === selectedNoteId.value)
      if (note) { selectedNote = note; break }
    }

    if (!selectedNote || selectedNote.isRest) return

    const newPitch = selectedNote.pitch + (direction * 12)
    engine.value.updateNote(selectedNoteId.value, { pitch: newPitch })
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
      .flatMap(m => m.notes.map(n => ({ ...n, measureNumber: m.number })))
      .sort((a, b) =>
        a.measureNumber !== b.measureNumber
          ? a.measureNumber - b.measureNumber
          : a.beat - b.beat
      )

    const currentIndex = allNotes.findIndex(n => n.id === selectedNoteId.value)
    if (currentIndex === -1) return 60

    let prevPitch: number | null = null
    let nextPitch: number | null = null

    for (let i = currentIndex - 1; i >= 0; i--) {
      if (!allNotes[i].isRest) { prevPitch = allNotes[i].pitch; break }
    }
    for (let i = currentIndex + 1; i < allNotes.length; i++) {
      if (!allNotes[i].isRest) { nextPitch = allNotes[i].pitch; break }
    }

    if (prevPitch !== null && nextPitch !== null) return Math.round((prevPitch + nextPitch) / 2)
    if (prevPitch !== null) return prevPitch
    if (nextPitch !== null) return nextPitch
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
   * Move pitch by one diatonic step (C, D, E, F, G, A, B) preserving accidental.
   * Note: 'pitch' is the STAFF POSITION (the natural note line/space),
   * and accidentals modify the sounding pitch. This only moves the staff position.
   */
  function movePitchDiatonically(pitch: number, direction: number): number {
    const staffPosition = pitch
    const octave = Math.floor(staffPosition / 12)
    const semitone = ((staffPosition % 12) + 12) % 12 // Handle negative values

    // Diatonic note semitones within octave: C=0, D=2, E=4, F=5, G=7, A=9, B=11
    const diatonicSemitones = [0, 2, 4, 5, 7, 9, 11]

    let diatonicIndex = diatonicSemitones.indexOf(semitone)
    if (diatonicIndex === -1) {
      // Staff position is on a black key - shouldn't normally happen,
      // but handle it by rounding to nearest diatonic note
      for (let i = 0; i < diatonicSemitones.length; i++) {
        if (diatonicSemitones[i] > semitone) {
          diatonicIndex = direction > 0 ? i : i - 1
          break
        }
      }
      if (diatonicIndex === -1) diatonicIndex = 6 // B
    }

    let newDiatonicIndex = diatonicIndex + direction
    let newOctave = octave

    if (newDiatonicIndex > 6) {
      newDiatonicIndex = 0
      newOctave++
    } else if (newDiatonicIndex < 0) {
      newDiatonicIndex = 6
      newOctave--
    }

    const newSemitone = diatonicSemitones[newDiatonicIndex]
    return newOctave * 12 + newSemitone
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
