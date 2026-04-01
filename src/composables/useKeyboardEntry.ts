import type { Ref, ComputedRef } from 'vue'
import type { ArticulationType, Accidental, NoteDuration, Note } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import { buildBeatMap } from '../utils/beatMap'
import { durationToBeats, getMeasureNotes } from '../utils/musicUtils'
import { fracToNumber, fracEq } from '../utils/fraction'

interface KeyboardEntryDeps {
  selectedTool: Ref<'entry' | 'selection'>
  selectedNoteId: Ref<string | null>
  engine: Ref<MusicEngine | null>
  // Palette state
  selectedDuration: Ref<NoteDuration>
  selectedAccidental: Ref<Accidental | null>
  selectedDots: Ref<number>
  pendingArticulations: ComputedRef<ArticulationType[] | undefined>
  tupletMode: Ref<boolean>
  pendingTieFromNoteId: Ref<string | null>
  // From useSelection
  setSelectedNote: (id: string | null) => void
  getContextPitch: () => number
  // Render
  renderScore: () => void
}

export function useKeyboardEntry(deps: KeyboardEntryDeps) {
  const {
    selectedTool, selectedNoteId, engine,
    selectedDuration, selectedAccidental, selectedDots,
    pendingArticulations, tupletMode, pendingTieFromNoteId,
    setSelectedNote, getContextPitch, renderScore,
  } = deps

  /**
   * Enter a note by letter key (a-g).
   * In selection mode: edits the selected note in place and enters keyboard mode.
   * In keyboard mode: overwrites the note at the cursor position and advances the cursor.
   */
  function enterNoteByLetter(letter: string) {
    if (!selectedNoteId.value || !engine.value) return
    if (selectedTool.value !== 'selection' && selectedTool.value !== 'entry') return

    const letterToPitchClass: Record<string, number> = {
      c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
    }
    const pitchClass = letterToPitchClass[letter]
    if (pitchClass === undefined) return

    if (selectedTool.value === 'entry') {
      enterNoteAtCursorPosition(pitchClass)
      return
    }

    // Selection mode: edit in place, then switch to keyboard mode
    const reference = getContextPitch()
    const k = Math.round((reference - pitchClass) / 12)
    const targetPitch = pitchClass + 12 * k

    engine.value.updateNote(selectedNoteId.value, {
      pitch: targetPitch,
      isRest: false,
      accidental: selectedAccidental.value || undefined,
    })

    selectedTool.value = 'entry'
    renderScore()
  }

  /**
   * Place a note at the cursor position (the beat after selectedNoteId) using the current palette.
   * Overwrites whatever is there — notes or rests — filling leftover space with rests.
   * Handles measure overflow the same way mouse entry does (tie splitting across barlines).
   * Advances selectedNoteId to the newly placed note.
   */
  function enterNoteAtCursorPosition(pitchClass: number) {
    if (!selectedNoteId.value || !engine.value) return

    const score = engine.value.getScore()
    const { allFlat, beats } = buildBeatMap(score)

    // Find the cursor position: the next beat after the currently selected note
    const currentNote = allFlat.find(n => n.id === selectedNoteId.value)
    if (!currentNote) {
      console.log('[Keyboard] enterNoteAtCursorPosition: currentNote not found for id', selectedNoteId.value)
      return
    }
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) {
      console.log('[Keyboard] enterNoteAtCursorPosition: beat not found in beatMap for key', currentKey)
      return
    }

    const nextBeat = beats[currentIndex + 1]
    if (!nextBeat) {
      console.log('[Keyboard] enterNoteAtCursorPosition: cursor is at end of score, nowhere to place note')
      return
    }

    const targetMeasure = nextBeat.measureNumber
    const targetBeat = nextBeat.beat

    // Octave: choose the one closest to the note we just entered
    const reference = (!currentNote.isRest) ? currentNote.pitch : getContextPitch()
    const k = Math.round((reference - pitchClass) / 12)
    const targetPitch = pitchClass + 12 * k

    const existingTuplet = engine.value.getTupletAtBeat(targetMeasure, targetBeat)
    console.log(`KeyboardEntry RAW | pitch:${targetPitch} dur:${selectedDuration.value} measure:${targetMeasure} beat:${fracToNumber(targetBeat).toFixed(3)} tupletMode:${tupletMode.value} existingTuplet:${existingTuplet ? existingTuplet.id : 'none'}`)

    const measure = score.measures.find(m => m.number === targetMeasure)
    if (!measure) return

    let newNote: Note | null

    if (tupletMode.value && !existingTuplet) {
      // Tuplet mode and cursor is at a free beat — create a new tuplet
      const result = engine.value.createTupletAtBeat(
        targetMeasure,
        fracToNumber(targetBeat),
        selectedDuration.value,
        targetPitch,
        selectedAccidental.value || undefined
      )
      newNote = result ? result.firstNote : null
    } else {
      // Normal mode, or cursor is already inside an existing tuplet.
      // addNoteAtBeat auto-detects tuplet context and uses scaled durations.
      newNote = engine.value.addNoteAtBeat({
        pitch: targetPitch,
        duration: selectedDuration.value,
        measure: targetMeasure,
        beat: targetBeat,
        accidental: selectedAccidental.value || undefined,
        dots: selectedDots.value || undefined,
        isRest: false,
        articulations: pendingArticulations.value,
      })
    }

    if (!newNote) {
      console.log('✗ KeyboardEntry | placement failed')
      renderScore()
      return
    }

    // If a tie was armed, link the previous note to this new note
    if (pendingTieFromNoteId.value) {
      engine.value.linkTie(pendingTieFromNoteId.value, newNote.id)
      pendingTieFromNoteId.value = null
    }

    // Follow the tie chain to the last note — the cursor must land after all tied continuations,
    // not just the first segment (e.g. half note split across barline → cursor after measure 3 note)
    let lastNote = newNote
    const scoreAfter = engine.value.getScore()
    let safetyLimit = 16
    while (lastNote.tiedTo && safetyLimit-- > 0) {
      const tied = scoreAfter.measures.flatMap(m => getMeasureNotes(m)).find(n => n.id === lastNote.tiedTo)
      if (!tied) break
      lastNote = tied
    }
    if (lastNote.id !== newNote.id) {
      console.log(`[Keyboard] Tie chain: cursor advanced to last tied note id=${lastNote.id} measure=${lastNote.measure} beat=${lastNote.beat}`)
    }

    setSelectedNote(lastNote.id)
    renderScore()
  }

  /**
   * Enter a rest at the cursor position using the current palette duration.
   * Only active in keyboard mode. Advances the cursor like note entry does.
   * Rests don't tie across barlines — duration is capped to available space in the measure.
   */
  function enterRestAtCursorPosition() {
    if (selectedTool.value !== 'entry' || !selectedNoteId.value || !engine.value) return

    const score = engine.value.getScore()
    const { allFlat, beats } = buildBeatMap(score)

    const currentNote = allFlat.find(n => n.id === selectedNoteId.value)
    if (!currentNote) return
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) return

    const nextBeat = beats[currentIndex + 1]
    if (!nextBeat) {
      console.log('[Keyboard] enterRestAtCursorPosition: cursor is at end of score')
      return
    }

    const targetMeasure = nextBeat.measureNumber
    const targetBeat = nextBeat.beat
    const newDurationBeats = durationToBeats(selectedDuration.value, selectedDots.value)

    // Rests don't tie across barlines — cap to available space in the measure
    const measureData = score.measures.find(m => m.number === targetMeasure)
    if (!measureData) return
    const measureTotalBeats = measureData.timeSignature.numerator * (4 / measureData.timeSignature.denominator)
    const availableBeats = measureTotalBeats - fracToNumber(targetBeat)
    const actualDurationBeats = Math.min(newDurationBeats, availableBeats)
    // Find the largest standard duration that fits
    const durations: Array<{ dur: NoteDuration; beats: number }> = [
      { dur: 'w', beats: 4 }, { dur: 'h', beats: 2 }, { dur: 'q', beats: 1 },
      { dur: '8', beats: 0.5 }, { dur: '16', beats: 0.25 }, { dur: '32', beats: 0.125 },
    ]
    const fittingDur = durations.find(d => d.beats <= actualDurationBeats + 0.001) ?? { dur: selectedDuration.value, beats: newDurationBeats }

    console.log(`[Keyboard] Entering rest: dur=${fittingDur.dur} (${fittingDur.beats} beats) at measure=${targetMeasure} beat=${targetBeat}${fittingDur.dur !== selectedDuration.value ? ` (capped from ${selectedDuration.value})` : ''}`)

    // addNoteAtBeat handles overlap removal atomically
    const newRest = engine.value.addNoteAtBeat({
      pitch: 0,
      duration: fittingDur.dur,
      measure: targetMeasure,
      beat: targetBeat,
      isRest: true,
    })

    if (!newRest) {
      console.log('[Keyboard] addNoteAtBeat returned null for rest')
      renderScore()
      return
    }

    console.log(`[Keyboard] Rest placed: id=${newRest.id} dur=${newRest.duration} measure=${newRest.measure} beat=${newRest.beat}`)
    setSelectedNote(newRest.id)
    renderScore()
  }

  /**
   * Add a note to the chord at the selected note's position (Shift + letter key).
   * The new note's pitch is >= the selected note's pitch (same octave or higher).
   * If a rest is selected, falls back to enterNoteByLetter (single note replacement).
   */
  function addChordNoteByLetter(letter: string) {
    if (!selectedNoteId.value || !engine.value) return
    if (selectedTool.value !== 'selection' && selectedTool.value !== 'entry') return

    const letterToPitchClass: Record<string, number> = {
      c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
    }
    const pitchClass = letterToPitchClass[letter]
    if (pitchClass === undefined) return

    const note = engine.value.getNote(selectedNoteId.value)
    if (!note) return

    // If a rest is selected, just enter a single note as normal
    if (note.isRest) {
      enterNoteByLetter(letter)
      return
    }

    // Use the highest pitch already in the chord as the anchor, so each new
    // note lands above ALL existing chord notes, not just the selected one.
    const score = engine.value.getScore()
    const measure = score.measures.find(m => m.number === note.measure)
    const chordPitches = (measure ? getMeasureNotes(measure) : [])
      .filter(n => !n.isRest && fracEq(n.beat, note.beat))
      .map(n => n.pitch)
    const basePitch = chordPitches.length > 0 ? Math.max(...chordPitches) : note.pitch

    const k = Math.ceil((basePitch - pitchClass) / 12)
    let targetPitch = pitchClass + 12 * k

    // If equal to basePitch it would be a duplicate — go up one octave
    if (targetPitch === basePitch) targetPitch += 12

    const newNote = engine.value.addChordNote({
      pitch: targetPitch,
      duration: note.duration,
      measure: note.measure,
      beat: note.beat,
      accidental: selectedAccidental.value || undefined,
      dots: note.dots,
      isRest: false,
      tupletId: note.tupletId,
    })
    setSelectedNote(newNote.id)
    renderScore()
  }

  return {
    enterNoteByLetter,
    enterNoteAtCursorPosition,
    enterRestAtCursorPosition,
    addChordNoteByLetter,
  }
}
