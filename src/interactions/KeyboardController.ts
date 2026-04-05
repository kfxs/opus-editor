import type { ArticulationType, NoteDuration, Note, PitchStep, PitchAlter } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { buildBeatMap } from '../utils/beatMap'
import { durationToBeats, getMeasureNotes } from '../utils/musicUtils'
import { fracToNumber, fracEq } from '../utils/fraction'
import { spellingToMidi, accidentalToAlter } from '../utils/pitchSpelling'

/** Natural (no-accidental) semitone offsets for each step letter */
const STEP_SEMITONES: Record<PitchStep, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/** Letter → PitchStep mapping */
const LETTER_TO_STEP: Record<string, PitchStep> = {
  c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', a: 'A', b: 'B',
}

/**
 * Handles keyboard note/rest entry.
 * Framework-agnostic: reads/writes EditorState directly, no Vue/React/Angular imports.
 */
export class KeyboardController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private getPendingArticulations: () => ArticulationType[] | undefined,
    private renderScore: () => void,
    private setSelectedNote: (id: string | null) => void,
    private getContextPitch: () => number,
  ) {}

  /**
   * Enter a note by letter key (a–g).
   * In selection mode: edits the selected note in place and switches to keyboard entry mode.
   * In entry mode: places a new note at the cursor position and advances it.
   */
  enterNoteByLetter(letter: string): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return
    if (this.state.selectedTool !== 'selection' && this.state.selectedTool !== 'entry') return

    const step = LETTER_TO_STEP[letter]
    if (!step) return

    if (this.state.selectedTool === 'entry') {
      this.enterNoteAtCursorPosition(step)
      return
    }

    // Selection mode: edit in place, then switch to keyboard mode
    const alter: PitchAlter = accidentalToAlter(this.state.selectedAccidental)
    const reference = this.getContextPitch()
    const naturalPitchClass = STEP_SEMITONES[step]
    const k = Math.round((reference - naturalPitchClass) / 12)
    const targetMidi = naturalPitchClass + 12 * k
    const octave = Math.floor(targetMidi / 12) - 1

    const updatedNote = engine.updateNote(this.state.selectedNoteId, {
      step,
      alter,
      octave,
      isRest: false,
      ...(this.state.selectedAccidental === 'n' && { forceAccidental: true }),
    })

    const altStr = alter === 2 ? '##' : alter === 1 ? '#' : alter === -1 ? 'b' : alter === -2 ? 'bb' : ''
    console.log(`✓ KeyboardEntry (edit-in-place) | ${step}${altStr}${octave} dur:${updatedNote.duration} measure:${updatedNote.measure} beat:${fracToNumber(updatedNote.beat).toFixed(3)}`)

    this.state.selectedAccidental = null
    this.state.selectedTool = 'entry'
    this.renderScore()
  }

  /**
   * Place a note at the cursor position (the beat after selectedNoteId).
   * Overwrites whatever is there, filling leftover space with rests.
   * Handles measure overflow via tie splitting. Advances selectedNoteId.
   */
  enterNoteAtCursorPosition(step: PitchStep): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return

    const score = engine.getScore()
    const { allFlat, beats } = buildBeatMap(score)

    const currentNote = allFlat.find(n => n.id === this.state.selectedNoteId)
    if (!currentNote) {
      console.log('[Cursor] enterNoteAtCursorPosition: currentNote not found for id', this.state.selectedNoteId)
      return
    }
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) {
      console.log('[Cursor] enterNoteAtCursorPosition: beat not found in beatMap for key', currentKey)
      return
    }

    let nextBeat = beats[currentIndex + 1]
    if (!nextBeat) {
      console.log('[Cursor] enterNoteAtCursorPosition: cursor is at end of score, nowhere to place note')
      return
    }

    console.log(`[Cursor] position: m${currentNote.measureNumber} beat:${fracToNumber(currentNote.beat).toFixed(4)} (${currentNote.isRest ? 'rest' : currentNote.step + currentNote.octave}${currentNote.tupletId ? ' tuplet' : ''}) → targeting m${nextBeat.measureNumber} beat:${fracToNumber(nextBeat.beat).toFixed(4)}`)

    const targetMeasure = nextBeat.measureNumber
    const targetBeat = nextBeat.beat

    const alter: PitchAlter = accidentalToAlter(this.state.selectedAccidental)
    const referenceMidi = (!currentNote.isRest && currentNote.step)
      ? spellingToMidi(currentNote.step, currentNote.alter!, currentNote.octave!)
      : this.getContextPitch()
    const naturalPitchClass = STEP_SEMITONES[step]
    const k = Math.round((referenceMidi - naturalPitchClass) / 12)
    const targetMidi = naturalPitchClass + 12 * k
    const octave = Math.floor(targetMidi / 12) - 1

    const existingTuplet = engine.getTupletAtBeat(targetMeasure, targetBeat)
    console.log(`KeyboardEntry RAW | ${step}${alter !== 0 ? (alter > 0 ? '#' : 'b') : ''} dur:${this.state.selectedDuration} measure:${targetMeasure} beat:${fracToNumber(targetBeat).toFixed(3)} tupletMode:${this.state.tupletMode} existingTuplet:${existingTuplet ? existingTuplet.id : 'none'}`)

    const measure = score.measures.find(m => m.number === targetMeasure)
    if (!measure) return

    let newNote: Note | null

    if (this.state.tupletMode && !existingTuplet) {
      const result = engine.createTupletAtBeat(
        targetMeasure,
        fracToNumber(targetBeat),
        this.state.selectedDuration,
        { step, alter, octave },
      )
      newNote = result ? result.firstNote : null
    } else {
      newNote = engine.addNoteAtBeat({
        step,
        alter,
        octave,
        duration: this.state.selectedDuration,
        measure: targetMeasure,
        beat: targetBeat,
        dots: this.state.selectedDots || undefined,
        isRest: false,
        articulations: this.getPendingArticulations(),
        ...(this.state.selectedAccidental === 'n' && { forceAccidental: true }),
        ...(existingTuplet && { tupletId: existingTuplet.id }),
      })
    }

    if (!newNote) {
      console.log('✗ KeyboardEntry | placement failed')
      this.renderScore()
      return
    }

    // Follow the tie chain to the last note so the cursor lands after all tied continuations
    let lastNote = newNote
    const scoreAfter = engine.getScore()
    let safetyLimit = 16
    while (lastNote.tiedTo && safetyLimit-- > 0) {
      const tied = scoreAfter.measures.flatMap(m => getMeasureNotes(m)).find(n => n.id === lastNote.tiedTo)
      if (!tied) break
      lastNote = tied
    }
    if (lastNote.id !== newNote.id) {
      console.log(`[Keyboard] Tie chain: cursor advanced to last tied note id=${lastNote.id} measure=${lastNote.measure} beat=${fracToNumber(lastNote.beat).toFixed(3)}`)
    }

    // Clear accidental after keyboard entry
    this.state.selectedAccidental = null

    console.log(`[Cursor] → cursor lands on: m${lastNote.measure} beat:${fracToNumber(lastNote.beat).toFixed(4)} (${lastNote.isRest ? 'rest' : `${lastNote.step}${lastNote.octave}`}${lastNote.tupletId ? ' tuplet' : ''})`)
    this.setSelectedNote(lastNote.id)
    this.renderScore()
  }

  /**
   * Enter a rest at the cursor position. Only active in keyboard entry mode.
   * Rests don't tie across barlines — duration is capped to available measure space.
   */
  enterRestAtCursorPosition(): void {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'entry' || !this.state.selectedNoteId || !engine) return

    const score = engine.getScore()
    const { allFlat, beats } = buildBeatMap(score)

    const currentNote = allFlat.find(n => n.id === this.state.selectedNoteId)
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
    const newDurationBeats = durationToBeats(this.state.selectedDuration, this.state.selectedDots)

    const measureData = score.measures.find(m => m.number === targetMeasure)
    if (!measureData) return
    const measureTotalBeats = measureData.timeSignature.numerator * (4 / measureData.timeSignature.denominator)
    const availableBeats = measureTotalBeats - fracToNumber(targetBeat)
    const actualDurationBeats = Math.min(newDurationBeats, availableBeats)

    const durations: Array<{ dur: NoteDuration; beats: number }> = [
      { dur: 'w', beats: 4 }, { dur: 'h', beats: 2 }, { dur: 'q', beats: 1 },
      { dur: '8', beats: 0.5 }, { dur: '16', beats: 0.25 }, { dur: '32', beats: 0.125 },
    ]
    const fittingDur = durations.find(d => d.beats <= actualDurationBeats + 0.001)
      ?? { dur: this.state.selectedDuration, beats: newDurationBeats }

    console.log(`[Keyboard] Entering rest: dur=${fittingDur.dur} (${fittingDur.beats} beats) at measure=${targetMeasure} beat=${fracToNumber(targetBeat).toFixed(3)}${fittingDur.dur !== this.state.selectedDuration ? ` (capped from ${this.state.selectedDuration})` : ''}`)

    const newRest = engine.addNoteAtBeat({
      duration: fittingDur.dur,
      measure: targetMeasure,
      beat: targetBeat,
      isRest: true,
    })

    if (!newRest) {
      console.log('[Keyboard] addNoteAtBeat returned null for rest')
      this.renderScore()
      return
    }

    console.log(`[Keyboard] Rest placed: id=${newRest.id} dur=${newRest.duration} measure=${newRest.measure} beat=${fracToNumber(newRest.beat).toFixed(3)}`)
    this.state.selectedAccidental = null
    this.setSelectedNote(newRest.id)
    this.renderScore()
  }

  /**
   * Add a note to the chord at the selected note's position (Shift + letter key).
   * New note's pitch is >= the highest pitch already in the chord.
   * Falls back to enterNoteByLetter if a rest is selected.
   */
  addChordNoteByLetter(letter: string): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return
    if (this.state.selectedTool !== 'selection' && this.state.selectedTool !== 'entry') return

    const step = LETTER_TO_STEP[letter]
    if (!step) return

    const note = engine.getNote(this.state.selectedNoteId)
    if (!note) return

    if (note.isRest) {
      this.enterNoteByLetter(letter)
      return
    }

    const score = engine.getScore()
    const measure = score.measures.find(m => m.number === note.measure)
    const chordMidis = (measure ? getMeasureNotes(measure) : [])
      .filter(n => !n.isRest && fracEq(n.beat, note.beat))
      .map(n => spellingToMidi(n.step!, n.alter!, n.octave!))
    const baseMidi = chordMidis.length > 0
      ? Math.max(...chordMidis)
      : spellingToMidi(note.step!, note.alter!, note.octave!)

    const alter: PitchAlter = accidentalToAlter(this.state.selectedAccidental)
    const naturalPitchClass = STEP_SEMITONES[step]
    const k = Math.ceil((baseMidi - naturalPitchClass) / 12)
    let targetMidi = naturalPitchClass + 12 * k
    if (targetMidi === baseMidi) targetMidi += 12
    const octave = Math.floor(targetMidi / 12) - 1

    const newNote = engine.addChordNote({
      step,
      alter,
      octave,
      duration: note.duration,
      measure: note.measure,
      beat: note.beat,
      dots: note.dots,
      isRest: false,
      tupletId: note.tupletId,
    })
    this.setSelectedNote(newNote.id)
    this.renderScore()
  }
}
