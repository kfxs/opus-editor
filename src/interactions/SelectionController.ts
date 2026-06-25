import type { Accidental, Note, Measure, PitchStep, PitchAlter, Clef } from '../types/music'
import { middleLineDiatonicPos } from '../utils/clefUtils'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Rect } from '../engine/ViewportModel'
import type { EditorState } from './EditorState'
import { modelVoiceToActive } from './EditorState'
import { buildBeatMap, notesInRange, expandTieChains } from '../utils/beatMap'
import { fracLt, fracEq, fracCompare, fracToNumber } from '../utils/fraction'
import { getMeasureNotes } from '../utils/musicUtils'
import { spellingToMidi, spellingDiatonicPos } from '../utils/pitchSpelling'
import { itemKey, selectedNoteIds, selectedArticulationNoteIds, type SelectionItem } from './selection'

/**
 * Handles note selection, navigation, pitch adjustment, and scroll-into-view.
 * Framework-agnostic: reads/writes EditorState directly, no Vue/React/Angular imports.
 */
export class SelectionController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private state: EditorState,
    /** Scroll a content-coordinate rect into the viewport (ViewportModel-backed). */
    private ensureVisible: (rect: Rect) => void,
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
    this.state.selectedSlurId = null
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
        // Selecting a note makes its voice the active voice, so keyboard entry
        // continues in that voice (and the cursor advances along its stream)
        // rather than silently falling back to voice 1.
        this.state.activeVoice = modelVoiceToActive(note.voice)
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
   * Clear the ENTIRE selection: the multi-select set + note anchor (and the scalar
   * sub-selections those reset), plus the dynamic and tuplet selections that
   * `clearScalarSubSelections` doesn't cover. The Esc / deselect-everything path.
   */
  deselectAll(): void {
    this.selectNote(null)
    this.state.selectedDynamicId = null
    this.state.selectedTupletId = null
    // Clearing the selection returns entry to the default voice 1 (Sibelius-style).
    this.state.activeVoice = 1
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

    // Shift-range respects ties (= duration): a range ending mid-tie grabs the
    // whole held note. (Ctrl-click / single click stay literal — they don't expand.)
    const rangeIds = expandTieChains(
      engine.getScore(),
      notesInRange(engine.getScore(), this.state.selectionPivotId, targetId),
    )

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
   * REPLACE the selection with a single articulation GROUP (all articulations on
   * `noteId`) — the plain-click path. Clears the note set and every scalar
   * sub-selection, then records this note as the articulation anchor.
   */
  selectArticulation(noteId: string): void {
    this.state.selectedItems.clear()
    const item: SelectionItem = { kind: 'articulation', noteId, type: '' }
    this.state.selectedItems.set(itemKey(item), item)
    this.state.selectedNoteId = null
    this.state.selectionPivotId = null
    this.state.selectionBase = []
    this.clearScalarSubSelections()
    // Mark the group selection (type null) so highlight/delete/flip act on the whole note.
    this.state.selectedArticulationNoteId = noteId
    this.state.selectedArticulationType = null
  }

  /**
   * TOGGLE an articulation GROUP in/out of the multi-selection (ctrl/cmd-click).
   * Articulation groups are mutually exclusive with notes (Phase 1), so toggling one
   * onto a note selection starts a fresh articulation-only set. The anchor follows the
   * last remaining group.
   */
  toggleArticulation(noteId: string): void {
    // Mixing kinds isn't supported yet: a Ctrl-click onto a note selection (or any
    // other kind) restarts the set as articulations-only.
    const onlyArticulations = [...this.state.selectedItems.values()].every(i => i.kind === 'articulation')
    if (!onlyArticulations) this.state.selectedItems.clear()

    const item: SelectionItem = { kind: 'articulation', noteId, type: '' }
    const key = itemKey(item)
    if (this.state.selectedItems.has(key)) {
      this.state.selectedItems.delete(key)
    } else {
      this.state.selectedItems.set(key, item)
    }
    this.state.selectedNoteId = null
    this.state.selectionPivotId = null
    this.state.selectionBase = []
    this.clearScalarSubSelections()
    const ids = selectedArticulationNoteIds(this.state.selectedItems.values())
    this.state.selectedArticulationNoteId = ids.length ? ids[ids.length - 1] : null
    this.state.selectedArticulationType = null
  }

  /**
   * Select a single note AND notify the engine's undo manager. Use this instead of
   * selectNote when the change should be tracked for undo/redo (note entry, chord-note
   * entry, rest entry — anywhere a model edit lands a fresh selection).
   *
   * It must run the FULL selectNote sync, not just set selectedNoteId: the highlight is
   * driven by state.selectedItems, so setting only the anchor leaves the previous note
   * highlighted while navigation/edits target the new one. That split is what made
   * Alt+Up after entering a chord note a no-op (selectedNoteId was the new top note, but
   * selectedItems still held the lower note, so chord nav was already "at the top").
   */
  setSelectedNote(id: string | null): void {
    this.selectNote(id)
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
    // Arrow nav stays within the selected note's own voice (independent streams).
    const selectedVoice = engine.getNote(this.state.selectedNoteId)?.voice ?? 0
    const { allFlat, beats } = buildBeatMap(score, selectedVoice)

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
   * Scoped to the selected note's OWN voice — in a multi-voice bar this must not walk
   * into the other voice's noteheads at the same beat (that's navigateVoice's job).
   */
  navigateChord(direction: number): void {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return

    const note = engine.getNote(this.state.selectedNoteId)
    if (!note || note.isRest) return

    const score = engine.getScore()
    const measure = score.measures.find(m => m.number === note.measure)
    if (!measure) return

    const noteVoice = note.voice ?? 0
    const chordNotes = getMeasureNotes(measure)
      .filter(n => !n.isRest && fracEq(n.beat, note.beat) && (n.voice ?? 0) === noteVoice)
      .sort((a, b) => spellingToMidi(a.step!, a.alter!, a.octave!) - spellingToMidi(b.step!, b.alter!, b.octave!))

    if (chordNotes.length <= 1) return

    const currentIndex = chordNotes.findIndex(n => n.id === this.state.selectedNoteId)
    if (currentIndex === -1) return

    const newIndex = Math.max(0, Math.min(chordNotes.length - 1, currentIndex + direction))
    if (newIndex === currentIndex) return

    this.selectNote(chordNotes[newIndex].id)
    this.renderScore()
  }

  /**
   * The vertical staff position of an element, used to order voices geometrically.
   * A note uses its diatonic pitch position; a rest has no pitch, so we place it in its
   * voice's rendered lane (upper voice above the middle line, lower voice below) — the
   * same V1-up / V2-down separation the renderer draws. All values share one clef-aware
   * diatonic scale so notes and rests across voices are directly comparable.
   *
   * ⚠️ FUTURE / REST POSITIONING: the rest branch ASSUMES a rest sits in its voice's
   * default lane (derived purely from the voice index). That holds today because rest
   * vertical offset is not user-editable. The moment we add manual rest positioning
   * (a per-rest vertical offset / line override), this derivation goes stale and the
   * voice hop will jump to the wrong place. When that lands, read the rest's ACTUAL
   * vertical offset here (e.g. `n.restLine`/`restYOffset`) instead of the voice lane,
   * mirroring however the renderer ends up drawing it — keep these two in lockstep.
   */
  private elementVerticalPos(n: Note, clef: Clef): number {
    if (n.isRest) {
      // TODO(rest-positioning): replace this voice-lane default with the rest's real
      // vertical offset once rests become vertically movable (see method doc above).
      const lane = (n.voice ?? 0) === 0 ? 2 : -2
      return middleLineDiatonicPos(clef) + lane
    }
    return spellingDiatonicPos(n.step!, n.octave!)
  }

  /**
   * Jump the selection to the nearest element in an ADJACENT voice (Alt+Shift+up/down),
   * Sibelius-style — a direct voice-to-voice hop, NOT a walk through the current chord
   * (that's navigateChord on Alt+up/down). "Above/below" is decided geometrically by
   * vertical staff position, so voice-crossing is handled automatically: pressing up
   * lands in whichever voice sits higher AT THIS BEAT, regardless of voice number.
   * Notes and rests are both valid landing targets.
   */
  navigateVoice(direction: number): void {
    const engine = this.getEngine()
    if (this.state.selectedTool !== 'selection' || !this.state.selectedNoteId || !engine) return

    const current = engine.getNote(this.state.selectedNoteId)
    if (!current) return

    const score = engine.getScore()
    const measure = score.measures.find(m => m.number === current.measure)
    if (!measure) return

    const currentVoice = current.voice ?? 0
    const clef = engine.getEffectiveClefAt(current.measure, current.beat)
    const currentPos = this.elementVerticalPos(current, clef)

    // Candidate elements live in OTHER voices (a voice hop never targets our own chord).
    const others = getMeasureNotes(measure).filter(n => (n.voice ?? 0) !== currentVoice)
    if (!others.length) return

    // Prefer elements sounding at this exact beat; only if no other voice has anything
    // here (rhythmically offset) fall back to the nearest beat that does.
    let pool = others.filter(n => fracEq(n.beat, current.beat))
    if (!pool.length) {
      const nearest = Math.min(...others.map(n => Math.abs(fracToNumber(n.beat) - fracToNumber(current.beat))))
      pool = others.filter(n => Math.abs(fracToNumber(n.beat) - fracToNumber(current.beat)) === nearest)
    }

    // Keep only the elements in the requested vertical direction, then pick the closest
    // one (nearest notehead/rest above for up, below for down). No match → no jump
    // (e.g. pressing up from the top voice). Ties break toward the nearer beat.
    const dirElements = pool
      .map(n => ({ n, pos: this.elementVerticalPos(n, clef) }))
      .filter(({ pos }) => direction > 0 ? pos > currentPos : pos < currentPos)
    if (!dirElements.length) return

    dirElements.sort((a, b) => {
      const da = Math.abs(a.pos - currentPos)
      const db = Math.abs(b.pos - currentPos)
      if (da !== db) return da - db
      return Math.abs(fracToNumber(a.n.beat) - fracToNumber(current.beat)) -
             Math.abs(fracToNumber(b.n.beat) - fracToNumber(current.beat))
    })

    this.selectNote(dirElements[0].n.id)
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

  /**
   * Scroll the viewport so the selected note is visible. The both-axis, leading-edge math now
   * lives in `ViewportModel.ensureVisible`; this just resolves the element's bbox (engine-side,
   * no DOM) and hands it to the injected `ensureVisible`, which the `useViewport` host applies to
   * the real scroll element. The bbox is in SVG-internal coordinates — the same space the old
   * inline version compared against `scrollLeft/Top`, so behavior is preserved (the ~padding
   * absorbs the content-surface inset).
   */
  scrollSelectedNoteIntoView(): void {
    const engine = this.getEngine()
    if (!engine || !this.state.selectedNoteId) return

    const elementInfo = engine.getElementById(this.state.selectedNoteId)
    if (!elementInfo) return

    this.ensureVisible(elementInfo.bbox)
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
