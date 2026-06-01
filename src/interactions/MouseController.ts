import type { ArticulationType, PitchSpelling, Fraction } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import type { SelectionController } from './SelectionController'
import type { RenderController } from './RenderController'
import { fracToNumber } from '../utils/fraction'
import { getMeasureNotes, beatToFrac } from '../utils/musicUtils'
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

  private readonly DRAG_TIME_THRESHOLD_MS = 150
  private readonly PREVIEW_THROTTLE_MS = 50

  private readonly onDocMouseDown = () => { this.isMouseButtonDown = true }
  private readonly onDocMouseUp = () => { this.isMouseButtonDown = false }

  constructor(
    private getEngine: () => MusicEngine | null,
    private getScoreCanvas: () => HTMLElement | null,
    private state: EditorState,
    private selection: SelectionController,
    private render: RenderController,
    private getPendingArticulations: () => ArticulationType[] | undefined,
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
   * (by the slot's left edge). A clef change anchors before that slot; clicking
   * near the measure start resolves to beat 0 (the opening clef). Returns the
   * slot's exact Fraction beat when available.
   */
  private resolveClefBeat(engine: MusicEngine, x: number, measureNum: number): Fraction {
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

  // --- Mouse handlers ---

  handleMouseDown(event: MouseEvent): void {
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
    const measureNum = engine.pixelToMeasure({ x, y })
    const closestElement = registry.findClosestNoteOrRest(x, y, measureNum)
    const tupletAtClick = registry.getTupletAt(x, y, measureNum)

    if (tupletAtClick && tupletAtClick.tupletId) {
      const tupletNotes = registry.getNotesByTupletId(tupletAtClick.tupletId)
      let minVerticalDistance = Infinity

      for (const note of tupletNotes) {
        if (note.pitch !== undefined) {
          const noteY = registry.pitchToPixelY(note.pitch, measureNum, note.bbox.x + note.bbox.width / 2)
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

    // Clef change selection — click a clef glyph to select it for removal.
    const clefAt = registry.getByType('clef').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (clefAt?.measure !== undefined) {
      this.selection.selectNote(null)
      this.state.selectedClefMeasure = clefAt.measure
      console.log(`✓ Clef selected | measure:${clefAt.measure}${clefAt.measure === 1 ? ' (measure 1: change only, cannot remove)' : ''}`)
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
      if (closestElement.type === 'note' && closestElement.pitch !== undefined) {
        const pitchY = registry.pitchToPixelY(closestElement.pitch, measureNum, centerX)
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
  }

  handleClick(event: MouseEvent): void {
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

    // Clef tool: set/change the clef at the nearest slot boundary. A clef change
    // anchors to a slot (beat 0 = the measure's opening clef, drawn at the
    // barline; beat > 0 = an inline mid-measure clef before that slot).
    if (this.state.selectedClef) {
      const beat = this.resolveClefBeat(engine, x, measureNum)
      const changed = engine.setClefAt(measureNum, beat, this.state.selectedClef)
      console.log(changed
        ? `✓ Clef set | ${this.state.selectedClef} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`
        : `Clef unchanged at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
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
        const beatsInMeasure = measure
          ? (4 / measure.timeSignature.denominator) * measure.timeSignature.numerator
          : 4
        const position = engine.pixelToPosition({ x, y }, beatsInMeasure)
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
          const beatsInMeasure = measure.timeSignature.numerator
          const position = engine.pixelToPosition({ x, y }, beatsInMeasure)
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

    this.lastCanvasMousePosition = null
    this.render.renderScore()
    this.state.showCursor = true
  }
}
