import type { ArticulationType, Accidental, NoteDuration, PitchAlter, BeamMode, Clef, TimeSignature } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { fracLt, fracCompare } from '../utils/fraction'
import { sameTimeSignature } from '../utils/meter'
import { getMeasureNotes } from '../utils/musicUtils'
import { spellingDiatonicPos } from '../utils/pitchSpelling'

/**
 * Handles palette actions: duration, accidental, articulations, tie, dot, tuplet.
 * Framework-agnostic: reads/writes EditorState directly, no Vue/React/Angular imports.
 */
export class PaletteController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    private renderScore: () => void,
    private renderPreview: (coords: { x: number; y: number }) => void,
    private getLastMousePosition: () => { x: number; y: number } | null,
    private selectNote: (id: string | null) => void,
  ) {}

  /** Returns the articulations currently armed for the next note entry. */
  getPendingArticulations(): ArticulationType[] | undefined {
    const arts: ArticulationType[] = []
    if (this.state.accent) arts.push('accent')
    if (this.state.staccato) arts.push('staccato')
    if (this.state.tenuto) arts.push('tenuto')
    return arts.length ? arts : undefined
  }

  setDuration(duration: NoteDuration): void {
    this.state.selectedDuration = duration
    this.state.selectedDots = 0
    this.state.tupletMode = false
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const before = engine.getNote(this.state.selectedNoteId)
      engine.updateNote(this.state.selectedNoteId, { duration, dots: 0 })
      if (before && !before.isRest) {
        const pitch = `${before.step}${before.alter === 1 ? '#' : before.alter === -1 ? 'b' : before.alter === 2 ? '##' : before.alter === -2 ? 'bb' : ''}${before.octave}`
        const oldDur = `${before.duration}${'.'.repeat(before.dots ?? 0)}`
        console.log(`[Duration] ${pitch} | ${oldDur} → ${duration}`)
      }
      this.renderScore()
    } else if (this.state.selectedTool === 'selection') {
      this.state.selectedTool = 'entry'
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  setAccidental(accidental: Accidental | null): void {
    const newValue = this.state.selectedAccidental === accidental ? null : accidental
    this.state.selectedAccidental = newValue
    const engine = this.getEngine()

    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const note = engine.getNote(this.state.selectedNoteId)
      // Rests have no accidental — keep palette value armed for next note entry.
      if (note?.isRest) return
      if (newValue === null) {
        if (note?.forceAccidental) {
          engine.updateNote(this.state.selectedNoteId, { forceAccidental: undefined })
        } else {
          engine.updateNote(this.state.selectedNoteId, { alter: 0, forceAccidental: undefined })
        }
      } else if (newValue === 'n') {
        const score = engine.getScore()
        const measure = score.measures.find(m => m.number === note!.measure)
        let wouldAutoShow = false
        if (measure) {
          const active = new Map<number, PitchAlter>()
          const preceding = getMeasureNotes(measure)
            .filter(n => !n.isRest && !n.tiedFrom && fracLt(n.beat, note!.beat))
            .sort((a, b) => fracCompare(a.beat, b.beat))
          for (const n of preceding) {
            const dPos = spellingDiatonicPos(n.step!, n.octave!)
            active.set(dPos, n.alter ?? 0)
          }
          const dPos = spellingDiatonicPos(note!.step!, note!.octave!)
          const activeAlter = active.get(dPos)
          wouldAutoShow = activeAlter !== undefined && activeAlter !== 0
        }
        engine.updateNote(this.state.selectedNoteId, {
          alter: 0,
          forceAccidental: wouldAutoShow ? undefined : true,
        })
      } else {
        const newAlter: PitchAlter = newValue === '#' ? 1 : -1
        const forceAccidental = note?.alter === newAlter ? true : undefined
        engine.updateNote(this.state.selectedNoteId, { alter: newAlter, forceAccidental })
      }
      this.renderScore()
      this.selectNote(this.state.selectedNoteId)
    } else if (this.state.selectedTool === 'selection') {
      this.state.selectedTool = 'entry'
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    } else if (this.state.selectedTool === 'entry') {
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  toggleAccent(): void {
    const engine = this.getEngine()
    if (this.state.selectedTool === 'selection' && this.state.selectedNoteId && engine) {
      engine.toggleArticulation(this.state.selectedNoteId, 'accent')
      engine.updateUndoNoteId(this.state.selectedNoteId)
      this.renderScore()
    } else {
      this.state.accent = !this.state.accent
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  toggleStaccato(): void {
    const engine = this.getEngine()
    if (this.state.selectedTool === 'selection' && this.state.selectedNoteId && engine) {
      engine.toggleArticulation(this.state.selectedNoteId, 'staccato')
      engine.updateUndoNoteId(this.state.selectedNoteId)
      this.renderScore()
    } else {
      this.state.staccato = !this.state.staccato
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  toggleTenuto(): void {
    const engine = this.getEngine()
    if (this.state.selectedTool === 'selection' && this.state.selectedNoteId && engine) {
      engine.toggleArticulation(this.state.selectedNoteId, 'tenuto')
      engine.updateUndoNoteId(this.state.selectedNoteId)
      this.renderScore()
    } else {
      this.state.tenuto = !this.state.tenuto
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  toggleTie(): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return

    console.log(`[Tie] toggleTie on noteId:${this.state.selectedNoteId} (tool:${this.state.selectedTool})`)
    const result = engine.toggleTie(this.state.selectedNoteId)
    console.log(`[Tie] result:${result === null ? 'no candidate found' : result ? 'tie added' : 'tie removed'}`)
    this.renderScore()
  }

  toggleDot(): void {
    const newValue = this.state.selectedDots >= 1 ? 0 : 1
    this.state.selectedDots = newValue
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const before = engine.getNote(this.state.selectedNoteId)
      engine.updateNote(this.state.selectedNoteId, { dots: newValue })
      if (before && !before.isRest) {
        const pitch = `${before.step}${before.alter === 1 ? '#' : before.alter === -1 ? 'b' : before.alter === 2 ? '##' : before.alter === -2 ? 'bb' : ''}${before.octave}`
        const oldDur = `${before.duration}${'.'.repeat(before.dots ?? 0)}`
        const newDur = `${before.duration}${'.'.repeat(newValue)}`
        console.log(`[Duration] ${pitch} | ${oldDur} → ${newDur}`)
      }
      this.renderScore()
    } else if (this.state.selectedTool === 'selection') {
      this.state.selectedTool = 'entry'
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    } else if (this.state.selectedTool === 'entry') {
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  toggleTuplet(): void {
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const note = engine.getNote(this.state.selectedNoteId)
      if (!note) return
      if (note.tupletId) {
        engine.deleteTuplet(note.tupletId)
      } else {
        const result = engine.applyTupletToNote(this.state.selectedNoteId)
        if (result) this.selectNote(result.note.id)
      }
      this.renderScore()
      return
    }
    this.state.tupletMode = !this.state.tupletMode
    if (this.state.tupletMode) {
      this.state.selectedDots = 0
    }
  }

  setBeam(beam: BeamMode): void {
    this.state.selectedBeam = beam
    const engine = this.getEngine()
    if (this.state.selectedNoteId && engine && this.state.selectedTool === 'selection') {
      const note = engine.getNote(this.state.selectedNoteId)
      if (note && !note.isRest) {
        engine.updateNote(this.state.selectedNoteId, { beam })
        this.renderScore()
      }
    }
  }

  /**
   * Arm/disarm a clef for placement. Clicking the active clef again disarms it.
   * While armed, canvas clicks set/change a measure's clef (see MouseController)
   * and the ghost note is suppressed. Switches to the entry tool so canvas clicks
   * are handled (the selection tool ignores clicks for placement).
   */
  setClef(clef: Clef): void {
    const newValue = this.state.selectedClef === clef ? null : clef
    this.state.selectedClef = newValue
    if (newValue) {
      this.state.selectedTimeSignature = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
    }
    this.renderScore()
  }

  /**
   * Arm/disarm a time signature for placement. Clicking the active signature
   * again disarms it. While armed, canvas clicks set/change a measure's time
   * signature (see MouseController) and the ghost note is suppressed. Switches to
   * the entry tool so canvas clicks are handled for placement.
   */
  setTimeSignature(ts: TimeSignature): void {
    const current = this.state.selectedTimeSignature
    const newValue = current && sameTimeSignature(current, ts) ? null : ts
    this.state.selectedTimeSignature = newValue
    if (newValue) {
      this.state.selectedClef = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
    }
    this.renderScore()
  }

  resetToDefaults(): void {
    this.state.selectedDuration = 'q'
    this.state.selectedAccidental = null
    this.state.selectedDots = 0
    this.state.accent = false
    this.state.staccato = false
    this.state.tenuto = false
    this.state.selectedBeam = 'auto'
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    this.state.selectedTimeSignatureMeasure = null
  }

  // --- Toolbar button active-state helpers ---
  // In selection mode: reflect the selected note's actual state.
  // In entry mode: reflect the pending palette state.

  noteHasAccent(): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool === 'selection' && engine) {
      if (this.state.selectedArticulationNoteId) {
        return this.state.selectedArticulationType === 'accent'
      }
      if (this.state.selectedNoteId) {
        const note = engine.getNote(this.state.selectedNoteId)
        return note?.articulations?.includes('accent') ?? false
      }
    }
    return this.state.accent
  }

  noteHasStaccato(): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool === 'selection' && engine) {
      if (this.state.selectedArticulationNoteId) {
        return this.state.selectedArticulationType === 'staccato'
      }
      if (this.state.selectedNoteId) {
        const note = engine.getNote(this.state.selectedNoteId)
        return note?.articulations?.includes('staccato') ?? false
      }
    }
    return this.state.staccato
  }

  noteHasTenuto(): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool === 'selection' && engine) {
      if (this.state.selectedArticulationNoteId) {
        return this.state.selectedArticulationType === 'tenuto'
      }
      if (this.state.selectedNoteId) {
        const note = engine.getNote(this.state.selectedNoteId)
        return note?.articulations?.includes('tenuto') ?? false
      }
    }
    return this.state.tenuto
  }

  noteHasTie(): boolean {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return false
    const note = engine.getNote(this.state.selectedNoteId)
    return !!note?.tiedTo
  }
}
