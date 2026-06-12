import type { ArticulationType, PitchSpelling, Fraction } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import type { SelectionController } from './SelectionController'
import type { RenderController } from './RenderController'
import type { TextEditController } from './TextEditController'
import { DynamicTextSource } from './DynamicTextSource'
import { fracToNumber, fracEq } from '../utils/fraction'

/** Default text for a newly placed custom-text dynamic; edit it via double-click. */
const DEFAULT_DYNAMIC_TEXT = 'Text'
import { getMeasureNotes, beatToFrac, measureCapacityQuarters } from '../utils/musicUtils'
import { spellingToMidi, accidentalToAlter } from '../utils/pitchSpelling'

/**
 * Handles all mouse interactions: clicks, drags, ghost-note preview.
 * Framework-agnostic: no Vue/React/Angular imports.
 * Call setup() after mount and teardown() before unmount.
 */
export class MouseController {
  // --- Internal ephemeral state (not in EditorState — not needed for reactivity) ---
  private lastCanvasMousePosition: { x: number; y: number } | null = null
  private isMouseButtonDown = false
  private isDraggingNote = false
  private draggedNoteOriginalPitch: PitchSpelling | null = null
  private dragStartTime: number | null = null
  private lastPreviewRender = 0

  // --- Clef drag state (selection-tool drag, across slots and measures) ---
  private isDraggingClef = false
  private draggedClefMeasure: number | null = null      // current measure (updates during drag)
  private draggedClefBeat: Fraction | null = null        // current beat (updates during drag)
  private draggedClefStartMeasure: number | null = null  // measure at drag start (no-op check)
  private draggedClefStartBeat: Fraction | null = null   // beat at drag start (no-op check)
  private clefDragStartTime: number | null = null

  private readonly DRAG_TIME_THRESHOLD_MS = 150
  private readonly PREVIEW_THROTTLE_MS = 50

  // --- Manual double-click detection for the in-canvas text editor (the native
  // dblclick event is defeated by the re-render-on-select swapping SVG nodes) ---
  private lastDynamicDownId: string | null = null
  private lastDynamicDownTime = 0
  private readonly DOUBLE_CLICK_MS = 400

  private readonly onDocMouseDown = () => { this.isMouseButtonDown = true }
  private readonly onDocMouseUp = () => { this.isMouseButtonDown = false }

  constructor(
    private getEngine: () => MusicEngine | null,
    private getScoreCanvas: () => HTMLElement | null,
    private state: EditorState,
    private selection: SelectionController,
    private render: RenderController,
    private getPendingArticulations: () => ArticulationType[] | undefined,
    private getTextEdit: () => TextEditController | null,
  ) {}

  /** Register document-level event listeners. Call on mount. */
  setup(): void {
    document.addEventListener('mousedown', this.onDocMouseDown, true)
    document.addEventListener('mouseup', this.onDocMouseUp, true)
  }

  /** Remove document-level event listeners. Call on unmount. */
  teardown(): void {
    document.removeEventListener('mousedown', this.onDocMouseDown, true)
    document.removeEventListener('mouseup', this.onDocMouseUp, true)
  }

  getLastMousePosition(): { x: number; y: number } | null {
    return this.lastCanvasMousePosition
  }

  // --- Private helpers ---

  private clientToSvg(event: MouseEvent, svg: SVGSVGElement): { x: number; y: number } | null {
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const svgPoint = point.matrixTransform(ctm.inverse())
    return { x: svgPoint.x, y: svgPoint.y }
  }

  /**
   * Resolve a click X within a measure to the beat of the nearest slot boundary
   * (by the slot's left edge). A beat-anchored marking (clef change, dynamic) is
   * placed at that slot; clicking near the measure start resolves to beat 0.
   * Returns the slot's exact Fraction beat when available.
   */
  private resolveSlotBeat(engine: MusicEngine, x: number, measureNum: number): Fraction {
    const registry = engine.getElementRegistry()
    const els = registry.getByMeasure(measureNum)
      .filter(e => (e.type === 'note' || e.type === 'rest') && e.beat !== undefined)

    let bestBeatNum = 0
    let bestDist = Infinity
    for (const e of els) {
      const dist = Math.abs(x - e.bbox.x)
      if (dist < bestDist) {
        bestDist = dist
        bestBeatNum = e.beat as number
      }
    }

    // Recover the slot's exact Fraction beat from the model (numbers lose tuplet precision).
    const measure = engine.getScore().measures.find(m => m.number === measureNum)
    const slot = measure?.slots.find(s => Math.abs(fracToNumber(s.beat) - bestBeatNum) < 1e-6)
    return slot ? slot.beat : beatToFrac(bestBeatNum)
  }

  /**
   * Open the in-canvas text editor on a custom-text dynamic. Builds a
   * {@link DynamicTextSource} (which carries the model write + positioning + glyph
   * hide) and hands it to the shared {@link TextEditController}. No-op if the text
   * editor isn't wired (e.g. before mount).
   */
  private openTextEditor(dynamicId: string, isNew: boolean): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit) return
    const source = new DynamicTextSource(
      dynamicId,
      isNew,
      engine,
      () => this.getScoreCanvas(),
      () => this.render.renderScore(),
    )
    textEdit.open(source)
  }

  // --- Mouse handlers ---

  handleMouseDown(event: MouseEvent): void {
    if (this.state.editingText) return // modal: a text edit is open (belt; DOM swallows the click-away)
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return
    if (this.state.selectedTool !== 'selection') return

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) return

    const coords = this.clientToSvg(event, svg)
    if (!coords) return
    const { x, y } = coords

    const registry = engine.getElementRegistry()
    // Selection is resolved by each element's own rendered geometry, NOT by the
    // click's vertical staff band: a note/tuplet drawn far from its staff (ledger
    // lines, brackets) lands in a neighbouring band, so a band-derived measure would
    // pick the wrong line and miss the element. (Band resolution via pixelToMeasure
    // is still correct for note entry / clef tool / clef drag below.)
    const closestElement = registry.findClosestNoteOrRest(x, y)
    const tupletAtClick = registry.getTupletAt(x, y)

    // Modifier clicks build a multi-selection (Phase 1: notes only, so they ignore
    // every other element kind, never clear the set, and arm no drag — clicking
    // empty space or a non-note element is a no-op):
    //   - Shift  → select the temporal range pivot→target (rests + whole chords),
    //              unioned onto the existing selection (range wins when both held).
    //   - Ctrl/Cmd → toggle the clicked note in/out.
    const additive = event.ctrlKey || event.metaKey
    const range = event.shiftKey
    if (additive || range) {
      if (closestElement && closestElement.id) {
        const bbox = closestElement.bbox
        const centerX = bbox.x + bbox.width / 2
        let elementY: number
        if (closestElement.type === 'note' && closestElement.pitch !== undefined && closestElement.measure !== undefined) {
          const pitchY = registry.pitchToPixelY(closestElement.pitch, closestElement.measure, centerX)
          elementY = pitchY !== null ? pitchY : bbox.y + bbox.height / 2
        } else {
          elementY = bbox.y + bbox.height / 2
        }
        const distance = Math.sqrt((x - centerX) ** 2 + (y - elementY) ** 2)
        if (distance < 30) {
          const typeLabel = closestElement.type === 'rest' ? 'Rest' : 'Note'
          if (range) {
            this.selection.extendSelectionTo(closestElement.id)
            console.log(`✓ Range extended to ${typeLabel} | id:${closestElement.id} | size:${this.state.selectedItems.size}`)
          } else {
            this.selection.toggleNote(closestElement.id)
            console.log(`✓ ${typeLabel} toggled in selection | id:${closestElement.id} | size:${this.state.selectedItems.size}`)
          }
          this.render.renderScore()
        }
      }
      return
    }

    if (tupletAtClick && tupletAtClick.tupletId) {
      const tupletNotes = registry.getNotesByTupletId(tupletAtClick.tupletId)
      let minVerticalDistance = Infinity

      for (const note of tupletNotes) {
        if (note.pitch !== undefined && note.measure !== undefined) {
          const noteY = registry.pitchToPixelY(note.pitch, note.measure, note.bbox.x + note.bbox.width / 2)
          if (noteY !== null) {
            const verticalDistance = Math.abs(y - noteY)
            minVerticalDistance = Math.min(minVerticalDistance, verticalDistance)
          }
        }
      }

      if (minVerticalDistance > 12) {
        this.state.selectedTupletId = tupletAtClick.tupletId
        this.state.selectedNoteId = null
        console.log(`✓ Tuplet selected on mousedown | id:${tupletAtClick.tupletId}`)
        this.render.renderScore()
        return
      }
    }

    this.state.selectedTupletId = null
    this.state.selectedTieFromNoteId = null
    this.state.selectedClefMeasure = null
    this.state.selectedClefBeat = null
    this.state.selectedTimeSignatureMeasure = null
    this.state.selectedDynamicId = null

    // Clef change selection — click a clef glyph to select it for removal.
    const clefAt = registry.getByType('clef').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (clefAt?.measure !== undefined) {
      this.selection.selectNote(null)
      this.state.selectedClefMeasure = clefAt.measure
      this.state.selectedClefBeat = clefAt.beat ?? 0
      const isProtected = clefAt.measure === 1 && (clefAt.beat ?? 0) === 0
      console.log(`✓ Clef selected | measure:${clefAt.measure} beat:${clefAt.beat ?? 0}${isProtected ? ' (measure 1 opening: change only, cannot remove)' : ''}`)

      // Arm horizontal dragging for movable clefs (every clef except the big
      // line-start one). Recover the exact Fraction beat from the model.
      if (!clefAt.immovable) {
        const measure = engine.getScore().measures.find(m => m.number === clefAt.measure)
        const approxBeat = clefAt.beat ?? 0
        const change = measure?.clefs?.find(c => Math.abs(fracToNumber(c.beat) - approxBeat) < 1e-6)
        if (change) {
          this.isDraggingClef = true
          this.draggedClefMeasure = clefAt.measure
          this.draggedClefBeat = change.beat
          this.draggedClefStartMeasure = clefAt.measure
          this.draggedClefStartBeat = change.beat
          this.clefDragStartTime = Date.now()
          // Freeze line breaks so sliding the clef re-pitches notes without
          // reflowing the score; we settle the layout on drop.
          engine.setLayoutFrozen(true)
          engine.setDraggingClef({ measure: clefAt.measure, beat: change.beat })
          event.preventDefault()
        }
      }
      this.render.renderScore()
      return
    }

    // Time-signature selection — click the TS glyph to select it for removal.
    // The TS column sits to the right of the clef (no overlap), and the glyph is
    // only registered where it's drawn (measure 1 + change measures).
    const timeSigAt = registry.getByType('timeSignature').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (timeSigAt?.measure !== undefined) {
      this.selection.selectNote(null)
      this.state.selectedTimeSignatureMeasure = timeSigAt.measure
      const isDefault = timeSigAt.measure === 1
      console.log(`✓ Time signature selected | measure:${timeSigAt.measure}${isDefault ? ' (measure 1 default: delete hides the glyph, meter kept)' : ' (delete reverts to prior meter + rebars)'}`)
      this.render.renderScore()
      return
    }

    // Dynamic selection — click a dynamic mark (below the staff) to select it for
    // removal. Small pad makes the small glyph/text easier to hit.
    const dynPad = 6
    const dynamicAt = registry.getByType('dynamic').find(el => {
      const b = el.bbox
      return x >= b.x - dynPad && x <= b.x + b.width + dynPad
        && y >= b.y - dynPad && y <= b.y + b.height + dynPad
    }) ?? null
    if (dynamicAt?.id) {
      // Manual double-click detection: a second mousedown on the SAME dynamic within
      // the threshold opens the in-canvas text editor. We can't use the native
      // `dblclick` event here because selecting re-renders the score on every
      // mousedown, swapping the SVG nodes — so the two clicks land on different
      // element instances and the browser never fires dblclick.
      const now = Date.now()
      const isDoubleClick = this.lastDynamicDownId === dynamicAt.id
        && (now - this.lastDynamicDownTime) < this.DOUBLE_CLICK_MS
      this.lastDynamicDownId = dynamicAt.id
      this.lastDynamicDownTime = now

      if (isDoubleClick) {
        const dyn = engine.getDynamicById(dynamicAt.id)
        if (dyn && dyn.kind === 'text') {
          this.lastDynamicDownId = null // consume, so a 3rd click isn't a double
          // Stop the browser's default mousedown focus/selection — otherwise it
          // steals focus back from the overlay right after we focus it, and typing
          // goes nowhere.
          event.preventDefault()
          console.log(`✓ Editing dynamic text | id:${dynamicAt.id}`)
          this.openTextEditor(dynamicAt.id, false)
          return
        }
      }

      this.selection.selectNote(null)
      this.state.selectedDynamicId = dynamicAt.id
      console.log(`✓ Dynamic selected | id:${dynamicAt.id} (Delete to remove, double-click text to edit)`)
      this.render.renderScore()
      return
    }

    const tiePad = 6
    const tieAt = registry.getByType('tie').find(el => {
      const b = el.bbox
      return x >= b.x - tiePad && x <= b.x + b.width + tiePad
        && y >= b.y - tiePad && y <= b.y + b.height + tiePad
    }) ?? null
    if (tieAt?.fromNoteId) {
      this.state.selectedNoteId = null
      this.state.selectedArticulationNoteId = null
      this.state.selectedArticulationType = null
      this.state.selectedAccidentalNoteId = null
      this.state.selectedAccidentalType = null
      this.state.selectedTieFromNoteId = tieAt.fromNoteId
      console.log(`✓ Tie selected | fromNoteId:${tieAt.fromNoteId} toNoteId:${tieAt.toNoteId} fromMeasure:${tieAt.fromMeasure} toMeasure:${tieAt.toMeasure}`)
      this.render.renderScore()
      return
    }

    const accidentalAt = registry.getByType('accidental').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (accidentalAt?.noteId) {
      this.state.selectedNoteId = null
      this.state.selectedArticulationNoteId = null
      this.state.selectedArticulationType = null
      this.state.selectedAccidentalNoteId = accidentalAt.noteId
      this.state.selectedAccidentalType = accidentalAt.accidentalType || null
      console.log(`✓ Accidental selected | noteId:${accidentalAt.noteId} type:${accidentalAt.accidentalType}`)
      this.render.renderScore()
      return
    }

    const artPad = 8
    const articulationAt = registry.getByType('articulation').find(el => {
      const b = el.bbox
      return x >= b.x - artPad && x <= b.x + b.width + artPad && y >= b.y - artPad && y <= b.y + b.height + artPad
    }) ?? null
    if (articulationAt?.noteId) {
      this.state.selectedNoteId = null
      this.state.selectedAccidentalNoteId = null
      this.state.selectedAccidentalType = null
      this.state.selectedArticulationNoteId = articulationAt.noteId
      this.state.selectedArticulationType = articulationAt.articulationType || null
      console.log(`✓ Articulation selected | noteId:${articulationAt.noteId} type:${articulationAt.articulationType}`)
      this.render.renderScore()
      return
    }

    if (closestElement && closestElement.id) {
      const bbox = closestElement.bbox
      const centerX = bbox.x + bbox.width / 2

      let elementY: number
      if (closestElement.type === 'note' && closestElement.pitch !== undefined && closestElement.measure !== undefined) {
        const pitchY = registry.pitchToPixelY(closestElement.pitch, closestElement.measure, centerX)
        elementY = pitchY !== null ? pitchY : bbox.y + bbox.height / 2
      } else {
        elementY = bbox.y + bbox.height / 2
      }

      const distance = Math.sqrt((x - centerX) ** 2 + (y - elementY) ** 2)

      if (distance < 30) {
        this.selection.selectNote(closestElement.id)
        const typeLabel = closestElement.type === 'rest' ? 'Rest' : 'Note'
        console.log(`✓ ${typeLabel} selected on mousedown | id:${closestElement.id}`)
        this.render.renderScore()

        if (closestElement.type === 'note' && closestElement.pitch !== undefined) {
          this.isDraggingNote = true
          const origNote = engine.getNote(closestElement.id)
          this.draggedNoteOriginalPitch = origNote && origNote.step
            ? { step: origNote.step, alter: origNote.alter!, octave: origNote.octave! }
            : null
          this.dragStartTime = Date.now()
          console.log(`Drag ready | note:${closestElement.id} pitch:${closestElement.pitch}`)
          event.preventDefault()
        }
      } else {
        this.selection.selectNote(null)
        console.log('Selection cleared (too far from element)')
        this.render.renderScore()
      }
    } else {
      this.selection.selectNote(null)
      console.log('Selection cleared')
      this.render.renderScore()
    }
  }

  handleMouseUp(_event: MouseEvent): void {
    if (this.isDraggingNote) {
      console.log(`Drag ended | note:${this.state.selectedNoteId}`)
      this.isDraggingNote = false
      this.draggedNoteOriginalPitch = null
      this.dragStartTime = null
    }
    if (this.isDraggingClef) {
      this.endClefDrag()
    }
  }

  /** Finish a clef drag: record one undo entry if it actually moved, then reset. */
  private endClefDrag(): void {
    const engine = this.getEngine()
    const moved = this.draggedClefMeasure !== null && this.draggedClefBeat !== null
      && (this.draggedClefMeasure !== this.draggedClefStartMeasure
        || (this.draggedClefStartBeat !== null && !fracEq(this.draggedClefBeat, this.draggedClefStartBeat)))
    if (engine && moved && this.draggedClefMeasure !== null && this.draggedClefBeat !== null) {
      engine.commitClefMove(this.draggedClefMeasure, this.draggedClefBeat)
      console.log(`Clef moved | measure:${this.draggedClefMeasure} beat:${fracToNumber(this.draggedClefBeat)}`)
    }
    this.isDraggingClef = false
    this.draggedClefMeasure = null
    this.draggedClefBeat = null
    this.draggedClefStartMeasure = null
    this.draggedClefStartBeat = null
    this.clefDragStartTime = null
    // Clear the ghost, unfreeze, and re-render once so the layout settles (and a
    // redundant clef, now removed by commitClefMove, is gone) at its final spot.
    if (engine) {
      engine.setDraggingClef(null)
      engine.setLayoutFrozen(false)
      this.render.renderScore()
    }
  }

  handleClick(event: MouseEvent): void {
    if (this.state.editingText) return // modal: a text edit is open (belt; DOM swallows the click-away)
    if (this.state.selectedTool === 'selection') return

    console.log(`Click RAW | client:(${event.clientX},${event.clientY})`)

    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) {
      console.log('✗ Click ignored: engine or canvas not ready')
      return
    }

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) {
      console.log('✗ Click ignored: SVG not found')
      return
    }

    const coords = this.clientToSvg(event, svg)
    if (!coords) {
      console.log('✗ Click ignored: no CTM')
      return
    }
    const { x, y } = coords

    const registry = engine.getElementRegistry()
    const measureNum = engine.pixelToMeasure({ x, y })

    // Time-signature tool: set/change the measure's time signature (always at
    // beat 0). Propagation + rest reconcile are handled by the engine.
    if (this.state.selectedTimeSignature) {
      const ts = this.state.selectedTimeSignature
      try {
        const changed = engine.setTimeSignature(measureNum, ts)
        console.log(changed
          ? `✓ Time signature set | ${ts.numerator}/${ts.denominator} at measure ${measureNum}`
          : `Time signature unchanged at measure ${measureNum}`)
      } catch (e) {
        console.warn(`✗ Time signature ${ts.numerator}/${ts.denominator} rejected:`, e)
      }
      this.render.renderScore()
      return
    }

    // Clef tool: set/change the clef at the nearest slot boundary. A clef change
    // anchors to a slot (beat 0 = the measure's opening clef, drawn at the
    // barline; beat > 0 = an inline mid-measure clef before that slot).
    if (this.state.selectedClef) {
      const beat = this.resolveSlotBeat(engine, x, measureNum)
      const changed = engine.setClefAt(measureNum, beat, this.state.selectedClef)
      console.log(changed
        ? `✓ Clef set | ${this.state.selectedClef} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`
        : `Clef unchanged at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
      this.render.renderScore()
      return
    }

    // Dynamics tool: place a dynamic at the nearest slot boundary. A level mark is
    // interpreted (drives playback); the `'text'` tool drops a silent custom mark.
    // Always placed below the staff.
    //
    // VOICE SEAM: `voice: 0` is the only hardcoded voice in the dynamics feature —
    // every resolution/render/playback path already keys on `voice ?? 0` (see
    // utils/dynamics resolveActiveLevel/resolveChordLevels, ScoreModel.addDynamic,
    // VexFlowRenderer.attachDynamicsToSlots). When multi-voice editing lands, the
    // ONLY change here is to source the voice from a UI selector (or the active
    // voice) instead of the literal 0; the timeline math needs no rework.
    if (this.state.selectedDynamic) {
      const tool = this.state.selectedDynamic
      const beat = this.resolveSlotBeat(engine, x, measureNum)
      if (tool === 'text') {
        // Custom-text mark: drop the default text. Edit it later by double-clicking
        // the mark with the selection tool (→ MouseController.handleDoubleClick).
        engine.addDynamic(measureNum, { beat, kind: 'text', text: DEFAULT_DYNAMIC_TEXT, voice: 0, placement: 'below' })
        console.log(`✓ Dynamic text at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
        this.render.renderScore()
        return
      }
      engine.addDynamic(measureNum, { beat, kind: 'level', level: tool, voice: 0, placement: 'below' })
      console.log(`✓ Dynamic ${tool} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
      this.render.renderScore()
      return
    }

    const nearestElement = registry.findNearestNoteOrRest(x, measureNum)
    const elementAt = registry.getAt(x, y)
    console.log(`Click | svg:(${x.toFixed(0)},${y.toFixed(0)}) measure:${measureNum} | nearestElement:`, nearestElement ? {
      type: nearestElement.type,
      beat: nearestElement.beat,
      bbox: `(${nearestElement.bbox.x.toFixed(0)},${nearestElement.bbox.y.toFixed(0)}) ${nearestElement.bbox.width.toFixed(0)}x${nearestElement.bbox.height.toFixed(0)}`,
    } : null, '| elementAt:', elementAt?.type || null)

    try {
      if (this.state.tupletMode) {
        const score = engine.getScore()
        const measure = score.measures.find(m => m.number === measureNum)
        const barQuarters = measure
          ? measureCapacityQuarters(measure)
          : 4
        const position = engine.pixelToPosition({ x, y }, barQuarters)
        const existingTuplet = engine.getTupletAtBeat(measureNum, position.beat)

        if (existingTuplet) {
          console.log(`Tuplet mode: clicking inside existing tuplet at beat ${fracToNumber(position.beat).toFixed(3)}, adding note instead`)
          const note = engine.addNoteAtPosition(
            { x, y },
            this.state.selectedDuration,
            this.state.selectedAccidental || undefined,
            this.state.selectedDots || undefined,
            this.getPendingArticulations(),
            this.state.selectedBeam !== 'auto' ? this.state.selectedBeam : undefined,
          )

          if (note) {
            const pitch = note.isRest ? 'rest' : `${note.step}${note.alter === 2 ? '##' : note.alter === 1 ? '#' : note.alter === -1 ? 'b' : note.alter === -2 ? 'bb' : ''}${note.octave}`
            console.log(`✓ Note added to tuplet | ${pitch} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}`)
            this.selection.setSelectedNote(note.id)
            this.state.selectedTool = 'entry'
            this.render.renderScore()
          } else {
            console.log('✗ Note NOT added to tuplet (collision or invalid location)')
          }
        } else {
          const naturalSpelling = registry.pixelYToPitch(y, measureNum)
          const spelling: PitchSpelling = naturalSpelling
            ? { ...naturalSpelling, alter: accidentalToAlter(this.state.selectedAccidental) }
            : { step: 'B', alter: 0, octave: 4 }

          const result = engine.createTupletAtPosition(
            { x, y },
            this.state.selectedDuration,
            spelling,
          )

          if (result) {
            const fn = result.firstNote
            const fnPitch = `${fn.step}${fn.alter === 2 ? '##' : fn.alter === 1 ? '#' : fn.alter === -1 ? 'b' : fn.alter === -2 ? 'bb' : ''}${fn.octave}`
            console.log(`✓ Tuplet created | tupletId:${result.tuplet.id} firstNote:${fnPitch} measure:${fn.measure} beat:${fracToNumber(fn.beat).toFixed(3)}`)
            this.selection.setSelectedNote(result.firstNote.id)
            this.state.selectedTool = 'entry'
            this.render.renderScore()
          } else {
            console.log('✗ Tuplet NOT created (collision or invalid location)')
          }
        }
      } else {
        const note = engine.addNoteAtPosition(
          { x, y },
          this.state.selectedDuration,
          this.state.selectedAccidental || undefined,
          this.state.selectedDots || undefined,
          this.getPendingArticulations(),
          this.state.selectedBeam !== 'auto' ? this.state.selectedBeam : undefined,
        )

        if (note) {
          const pitch = note.isRest ? 'rest' : `${note.step}${note.alter === 2 ? '##' : note.alter === 1 ? '#' : note.alter === -1 ? 'b' : note.alter === -2 ? 'bb' : ''}${note.octave}`
          console.log(`✓ Note added | ${pitch} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}`)
          this.selection.setSelectedNote(note.id)
          this.state.selectedTool = 'entry'
          this.render.renderScore()
        } else {
          console.log('✗ Note NOT added (collision or invalid location)')
        }
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Cannot add note: ' + (error as Error).message)
    }
  }

  handleMouseMove(event: MouseEvent): void {
    if (this.state.editingText) return // modal: suppress ghost/preview while a text edit is open
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) return

    const coords = this.clientToSvg(event, svg)
    if (!coords) return
    const { x, y } = coords

    this.lastCanvasMousePosition = { x, y }

    if (this.isDraggingNote && this.state.selectedNoteId && this.draggedNoteOriginalPitch !== null) {
      if (this.dragStartTime !== null) {
        const elapsed = Date.now() - this.dragStartTime
        if (elapsed < this.DRAG_TIME_THRESHOLD_MS) return
      }

      const score = engine.getScore()
      let selectedNote = null
      for (const measure of score.measures) {
        const note = getMeasureNotes(measure).find(n => n.id === this.state.selectedNoteId)
        if (note) { selectedNote = note; break }
      }

      if (selectedNote && !selectedNote.isRest) {
        const measure = engine.getScore().measures.find(m => m.number === selectedNote.measure)
        if (measure) {
          const barQuarters = measureCapacityQuarters(measure)
          const position = engine.pixelToPosition({ x, y }, barQuarters)
          const cursorSpelling = position.spelling
          const cursorMidi = spellingToMidi(cursorSpelling.step, cursorSpelling.alter, cursorSpelling.octave)
          const noteMidi = spellingToMidi(selectedNote.step!, selectedNote.alter!, selectedNote.octave!)

          if (cursorMidi !== noteMidi) {
            console.log(`Drag pitch change | midi:${noteMidi} -> ${cursorMidi}`)
            engine.updateNote(this.state.selectedNoteId, { step: cursorSpelling.step, alter: cursorSpelling.alter, octave: cursorSpelling.octave })
            this.render.renderScore()
          }
        }
      }
      return
    }

    // Clef drag: snap the cursor to a slot boundary in whatever measure it's over
    // and relocate the clef there (raw move, across measures; undo on drop).
    if (this.isDraggingClef && this.draggedClefMeasure !== null && this.draggedClefBeat !== null) {
      if (this.clefDragStartTime !== null) {
        const elapsed = Date.now() - this.clefDragStartTime
        if (elapsed < this.DRAG_TIME_THRESHOLD_MS) return
      }
      const targetMeasure = engine.pixelToMeasure({ x, y })
      const targetBeat = this.resolveSlotBeat(engine, x, targetMeasure)
      if (targetMeasure !== this.draggedClefMeasure || !fracEq(targetBeat, this.draggedClefBeat)) {
        if (engine.moveClef(this.draggedClefMeasure, this.draggedClefBeat, targetMeasure, targetBeat)) {
          this.draggedClefMeasure = targetMeasure
          this.draggedClefBeat = targetBeat
          this.state.selectedClefMeasure = targetMeasure
          this.state.selectedClefBeat = fracToNumber(targetBeat)
          engine.setDraggingClef({ measure: targetMeasure, beat: targetBeat })
          console.log(`Clef drag | measure:${targetMeasure} beat:${fracToNumber(targetBeat)}`)
          this.render.renderScore()
        }
      }
      return
    }

    if (this.state.selectedTool === 'selection') return
    if (this.isMouseButtonDown) return

    const now = Date.now()
    if (now - this.lastPreviewRender < this.PREVIEW_THROTTLE_MS) return
    this.lastPreviewRender = now

    // Clef tool armed: show a ghost clef at the hovered measure instead of a
    // ghost note, and hide the keyboard cursor.
    if (this.state.selectedClef) {
      this.render.renderClefGhost({ x, y }, this.state.selectedClef)
      this.state.showCursor = false
      return
    }

    // Time-signature tool armed: show a ghost time signature following the cursor
    // (mirrors the clef tool), and hide the keyboard cursor.
    if (this.state.selectedTimeSignature) {
      this.render.renderTimeSignatureGhost({ x, y }, this.state.selectedTimeSignature)
      this.state.showCursor = false
      return
    }

    // Dynamics tool armed: show a ghost dynamic (level glyph or custom-text
    // placeholder) following the cursor, and hide the keyboard cursor.
    if (this.state.selectedDynamic) {
      this.render.renderDynamicGhost({ x, y }, this.state.selectedDynamic)
      this.state.showCursor = false
      return
    }

    const ghostNoteRendered = this.render.renderPreview({ x, y })
    this.state.showCursor = !ghostNoteRendered
  }

  handleMouseLeave(): void {
    const engine = this.getEngine()
    if (!engine) return

    if (this.isDraggingNote) {
      console.log('Drag ended (mouse left canvas)')
      this.isDraggingNote = false
      this.draggedNoteOriginalPitch = null
      this.dragStartTime = null
    }
    if (this.isDraggingClef) {
      console.log('Clef drag ended (mouse left canvas)')
      this.endClefDrag()
    }

    this.lastCanvasMousePosition = null
    this.render.renderScore()
    this.state.showCursor = true
  }
}
