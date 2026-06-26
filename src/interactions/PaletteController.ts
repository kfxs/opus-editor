import type { ArticulationType, Accidental, NoteDuration, PitchAlter, BeamMode, Clef, TimeSignature } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState, DynamicTool } from './EditorState'
import { activeVoiceToModel } from './EditorState'
import { fracToNumber } from '../utils/fraction'
import { sameTimeSignature } from '../utils/meter'
import { selectedNoteIds } from './selection'

/** Placeholder for a freshly placed custom-text dynamic (mirrors MouseController). */
const DEFAULT_DYNAMIC_TEXT = 'Text'

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
    this.state.selectedDynamic = null
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
    } else if (this.state.selectedTool === 'entry') {
      // Already in entry mode: refresh the ghost note so it shows the new
      // duration immediately, without waiting for the next mouse move.
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
        // Remove the accidental: revert to the measure's prevailing alteration so the
        // sign disappears in every case (lone sharp → natural; required ♮ → its sharp).
        engine.updateNote(this.state.selectedNoteId, {
          alter: engine.getPrevailingAlter(this.state.selectedNoteId),
          forceAccidental: undefined,
        })
      } else if (newValue === 'n') {
        // A ♮ that cancels an earlier sharp/flat shows automatically; otherwise it's a
        // courtesy natural that must be forced to appear.
        const wouldAutoShow = engine.getPrevailingAlter(this.state.selectedNoteId) !== 0
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
    if (!this.applyArticulationToSelection('accent')) {
      this.state.accent = !this.state.accent
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  toggleStaccato(): void {
    if (!this.applyArticulationToSelection('staccato')) {
      this.state.staccato = !this.state.staccato
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  toggleTenuto(): void {
    if (!this.applyArticulationToSelection('tenuto')) {
      this.state.tenuto = !this.state.tenuto
      const pos = this.getLastMousePosition()
      if (pos) this.renderPreview(pos)
    }
  }

  /**
   * Apply an articulation across the whole selection as ONE undoable action.
   * Returns false when not applicable (not in selection tool, or nothing selected)
   * so the caller can fall back to arming the articulation for the next note entry.
   *
   * Toggle direction is decided for the selection as a whole: if EVERY applicable
   * (non-rest) selected note already has the articulation, it's removed from all;
   * otherwise it's added to all. For a single selected note this is identical to the
   * old per-note toggle.
   */
  private applyArticulationToSelection(type: ArticulationType): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return false

    const ids = selectedNoteIds(this.state.selectedItems.values())
      .filter(id => {
        const note = engine.getNote(id)
        return note && !note.isRest
      })
    if (ids.length === 0) return false

    const allHaveIt = ids.every(id => engine.getNote(id)?.articulations?.includes(type))
    // toggleArticulation flips presence, so only call it on notes whose current
    // state differs from the target (add → notes missing it; remove → notes with it).
    engine.runBatch(allHaveIt ? `Remove ${type}` : `Add ${type}`, () => {
      for (const id of ids) {
        const hasIt = engine.getNote(id)?.articulations?.includes(type) ?? false
        if (hasIt === allHaveIt) engine.toggleArticulation(id, type)
      }
    })
    engine.updateUndoNoteId(this.state.selectedNoteId)
    this.renderScore()
    return true
  }

  toggleTie(): void {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return

    console.log(`[Tie] toggleTie on noteId:${this.state.selectedNoteId} (tool:${this.state.selectedTool})`)
    const result = engine.toggleTie(this.state.selectedNoteId)
    console.log(`[Tie] result:${result === null ? 'no candidate found' : result ? 'tie added' : 'tie removed'}`)
    this.renderScore()
  }

  /**
   * Add a phrasing slur over the current selection (key `s`). Reads the
   * multi-select set (range) and falls back to the scalar anchor (single note);
   * the engine resolves endpoints (single→next slot, range→first/last, voice 0).
   * Create-only and idempotent — removal is select-the-arc + Delete.
   */
  createSlur(): void {
    const engine = this.getEngine()
    if (!engine) return
    const ids = selectedNoteIds(this.state.selectedItems.values())
    const noteIds = ids.length ? ids : (this.state.selectedNoteId ? [this.state.selectedNoteId] : [])
    if (noteIds.length === 0) return
    const slur = engine.createSlur(noteIds)
    console.log(`[Slur] createSlur on ${noteIds.length} note(s) → ${slur ? `slur ${slur.id}` : 'no valid span'}`)
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
      this.state.selectedDynamic = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
      this.state.selectedDynamicId = null
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
      this.state.selectedDynamic = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
      this.state.selectedDynamicId = null
    }
    this.renderScore()
  }

  /**
   * Arm/disarm a dynamic for placement. Clicking the active value again disarms
   * it. A level (`p`/`mp`/`mf`/`f`) places that mark on the next canvas click;
   * `'text'` places a custom italic-text mark (MouseController prompts for the
   * text). Mutually exclusive with the clef/time-signature tools, and switches to
   * the entry tool so canvas clicks are handled for placement.
   */
  setDynamic(value: DynamicTool): void {
    // Selection mode with a note/rest selected → place the dynamic directly at that
    // element's slot (no arm-and-click), the same way articulations/accidentals apply
    // to the current selection. Only when nothing is selected do we fall back to the
    // arm-then-click placement flow below.
    if (this.state.selectedTool === 'selection' && this.state.selectedNoteId) {
      this.placeDynamicAtSelectedNote(value)
      return
    }

    const newValue = this.state.selectedDynamic === value ? null : value
    this.state.selectedDynamic = newValue
    if (newValue) {
      this.state.selectedClef = null
      this.state.selectedTimeSignature = null
      this.state.selectedTool = 'entry'
      this.state.selectedNoteId = null
      this.state.selectedClefMeasure = null
      this.state.selectedClefBeat = null
      this.state.selectedTimeSignatureMeasure = null
      this.state.selectedDynamicId = null
    }
    this.renderScore()
  }

  /**
   * Place the dynamic for `tool` directly at the currently selected note/rest's slot
   * (selection mode). The mark anchors to the element's (measure, beat); a level tool
   * drops its glyph, `'text'` drops the editable placeholder (double-click to edit,
   * matching canvas placement). Voice 0 — see the VOICE SEAM note in MouseController.
   */
  private placeDynamicAtSelectedNote(tool: DynamicTool): void {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedNoteId) return
    const note = engine.getNote(this.state.selectedNoteId)
    if (!note) return
    const beatStr = fracToNumber(note.beat).toFixed(3)
    if (tool === 'text') {
      engine.addDynamic(note.measure, { beat: note.beat, kind: 'text', text: DEFAULT_DYNAMIC_TEXT, voice: 0, placement: 'below' })
      console.log(`✓ Dynamic text at measure ${note.measure} beat ${beatStr} (on selected note ${this.state.selectedNoteId})`)
    } else {
      engine.addDynamic(note.measure, { beat: note.beat, kind: 'level', level: tool, voice: 0, placement: 'below' })
      console.log(`✓ Dynamic ${tool} at measure ${note.measure} beat ${beatStr} (on selected note ${this.state.selectedNoteId})`)
    }
    this.renderScore()
  }

  /**
   * Choose the active voice (Sibelius-style; palette buttons + Alt+1/Alt+2).
   *
   * In selection mode with a selection, a voice press MOVES the selected note(s)
   * into that voice (Sibelius Alt+1/2-on-selection) — preserving their ids so
   * ties/slurs/selection survive, as one atomic undo. Otherwise it arms the voice
   * for note entry: with nothing selected, flip to entry mode (mirrors the
   * duration/accidental tools).
   */
  setActiveVoice(voice: 1 | 2): void {
    this.state.activeVoice = voice
    console.log(`[Voice] active voice → ${voice}`)

    // Selection-mode + a selection → reassign voice instead of arming entry.
    const engine = this.getEngine()
    if (engine && this.state.selectedTool === 'selection') {
      const ids = selectedNoteIds(this.state.selectedItems.values())
      if (ids.length === 0 && this.state.selectedNoteId) ids.push(this.state.selectedNoteId)
      if (ids.length > 0) {
        const moved = engine.moveSelectionToVoice(ids, activeVoiceToModel(voice))
        if (moved) {
          // Ids are unchanged, so the selection Map stays valid — just re-render
          // (notes recolour to their new voice).
          this.renderScore()
          return
        }
        // Nothing moved (all already in the target voice, or rests) — leave the
        // selection as-is and fall through to the entry-arming refresh below.
      }
    }

    // Entry-arming behaviour (no selection, or nothing actually moved).
    if (this.state.selectedTool === 'selection' && !this.state.selectedNoteId) {
      this.state.selectedTool = 'entry'
    }
    const pos = this.getLastMousePosition()
    if (pos) this.renderPreview(pos)
  }

  resetToDefaults(): void {
    this.state.activeVoice = 1
    this.state.selectedDuration = 'q'
    this.state.selectedAccidental = null
    this.state.selectedDots = 0
    this.state.accent = false
    this.state.staccato = false
    this.state.tenuto = false
    this.state.selectedBeam = 'auto'
    this.disarmPositionalTools()
    this.state.selectedTimeSignatureMeasure = null
    this.state.selectedDynamicId = null
  }

  /**
   * Disarm the positional palette tools — clef, time signature, dynamic. These
   * are entry-mode-only (arming one switches to entry mode and a canvas click
   * places it); leaving entry mode makes them inert, so the palette should stop
   * showing them as selected. Does NOT touch note-entry settings (duration,
   * accidental, articulations) which carry over between modes.
   */
  disarmPositionalTools(): void {
    this.state.selectedClef = null
    this.state.selectedTimeSignature = null
    this.state.selectedDynamic = null
  }

  // --- Toolbar button active-state helpers ---
  // In selection mode: reflect the selected note's actual state.
  // In entry mode: reflect the pending palette state.

  /** True if the articulation-relevant selection (a note, or a group-selected
   *  articulation set) carries the given articulation. Group selection reflects the
   *  note's real articulations — every one shows active in the palette. */
  private selectedNoteHasArticulation(type: ArticulationType): boolean {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !engine) return false
    const noteId = this.state.selectedArticulationNoteId ?? this.state.selectedNoteId
    if (!noteId) return false
    return engine.getNote(noteId)?.articulations?.includes(type) ?? false
  }

  noteHasAccent(): boolean {
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('accent')
    return this.state.accent
  }

  noteHasStaccato(): boolean {
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('staccato')
    return this.state.staccato
  }

  noteHasTenuto(): boolean {
    if (this.state.selectedTool === 'selection') return this.selectedNoteHasArticulation('tenuto')
    return this.state.tenuto
  }

  noteHasTie(): boolean {
    const engine = this.getEngine()
    if (!this.state.selectedNoteId || !engine) return false
    const note = engine.getNote(this.state.selectedNoteId)
    return !!note?.tiedTo
  }
}
