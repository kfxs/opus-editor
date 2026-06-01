import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { buildBeatMap } from '../utils/beatMap'
import { getMeasureNotes } from '../utils/musicUtils'
import { spellingToMidi } from '../utils/pitchSpelling'

/**
 * Applies SVG highlight classes/colors after each render.
 * Framework-agnostic: operates on standard DOM APIs, no Vue/React/Angular imports.
 */
export class HighlightController {
  constructor(
    private getEngine: () => MusicEngine | null,
    private getScoreCanvas: () => HTMLElement | null,
    private state: EditorState,
  ) {}

  /**
   * Draw a vertical cursor line on the staff AFTER the currently selected note,
   * indicating where the next keyboard entry will land (like Sibelius's blue cursor).
   */
  applyKeyboardCursor(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (this.state.selectedTool !== 'entry' || !this.state.selectedNoteId || !engine || !scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const score = engine.getScore()
    const registry = engine.getElementRegistry()
    const { allFlat, beats } = buildBeatMap(score)

    const currentNote = allFlat.find(n => n.id === this.state.selectedNoteId)
    if (!currentNote) return
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) return

    const nextBeat = beats[currentIndex + 1]

    let cursorX: number
    let cursorMeasure: number

    if (nextBeat) {
      const nextInfo = engine.getElementById(nextBeat.id)
      if (!nextInfo) return
      cursorX = nextInfo.bbox.x
      cursorMeasure = nextBeat.measureNumber
    } else {
      const currentInfo = engine.getElementById(this.state.selectedNoteId)
      if (!currentInfo) return
      cursorX = currentInfo.bbox.x + currentInfo.bbox.width
      cursorMeasure = currentNote.measureNumber
    }

    const staffGeometry = registry.getStaffGeometry(cursorMeasure)
    if (!staffGeometry) return

    const topY = staffGeometry.lineYPositions[0]
    const bottomY = staffGeometry.lineYPositions[4]

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(cursorX))
    line.setAttribute('y1', String(topY - 6))
    line.setAttribute('x2', String(cursorX))
    line.setAttribute('y2', String(bottomY + 6))
    line.setAttribute('stroke', '#3B82F6')
    line.setAttribute('stroke-width', '2')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('class', 'keyboard-cursor')
    svg.appendChild(line)
  }

  applySelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedNoteId) return

    const elementInfo = engine.getElementById(this.state.selectedNoteId)
    if (!elementInfo) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const SELECTION_COLOR = '#F59E0B'
    const SELECTION_STROKE = '#D97706'

    const score = engine.getScore()
    let notePitch: number | null = null
    let noteMeasure: number | null = null
    let isRest = false
    let noteTupletId: string | null = null

    for (const measure of score.measures) {
      const element = getMeasureNotes(measure).find(n => n.id === this.state.selectedNoteId)
      if (element) {
        noteMeasure = element.measure
        isRest = element.isRest || false
        noteTupletId = element.tupletId || null
        if (!element.isRest) {
          notePitch = spellingToMidi(element.step!, element.alter!, element.octave!)
        }
        break
      }
    }

    let tupletBbox: { x: number; y: number; width: number; height: number } | null = null
    if (noteTupletId) {
      const tupletInfo = engine.getTupletElementById(noteTupletId)
      if (tupletInfo) tupletBbox = tupletInfo.bbox
    }

    const registry = engine.getElementRegistry()
    // X of the selected note, used to resolve its clef region (mid-measure changes)
    const noteCenterX = elementInfo.bbox.x + elementInfo.bbox.width / 2
    let targetY: number | null = null
    if (notePitch !== null && noteMeasure !== null) {
      targetY = registry.pitchToPixelY(notePitch, noteMeasure, noteCenterX)
    }

    const bbox = elementInfo.bbox
    const noteHeight = 25
    const selectBbox = (targetY !== null && !isRest) ? {
      x: bbox.x,
      y: targetY - noteHeight / 2,
      width: bbox.width,
      height: noteHeight,
    } : bbox

    let isInChord = false
    let chordNoteYPositions: number[] = []
    if (noteMeasure !== null && !isRest) {
      const measureData = score.measures.find(m => m.number === noteMeasure)
      if (measureData) {
        const measureNotes = getMeasureNotes(measureData)
        const noteData = measureNotes.find(n => n.id === this.state.selectedNoteId)
        if (noteData) {
          const notesAtBeat = measureNotes.filter(
            n => !n.isRest && n.beat.num === noteData.beat.num && n.beat.den === noteData.beat.den,
          )
          isInChord = notesAtBeat.length > 1
          if (isInChord) {
            for (const chordNote of notesAtBeat) {
              if (chordNote.id !== this.state.selectedNoteId) {
                const chordNoteY = registry.pitchToPixelY(spellingToMidi(chordNote.step!, chordNote.alter!, chordNote.octave!), noteMeasure, noteCenterX)
                if (chordNoteY !== null) {
                  chordNoteYPositions.push(chordNoteY)
                }
              }
            }
          }
        }
      }
    }

    const hasTupletsInMeasure = noteMeasure !== null
      ? registry.getTupletsByMeasure(noteMeasure).length > 0
      : false

    // Collect all tie bboxes so we can skip tie paths during note highlighting
    const tieBboxes = registry.getByType('tie').map(el => el.bbox)

    const allElements = svg.querySelectorAll('path, ellipse, circle, line, rect, text, use')

    for (const el of allElements) {
      const elBBox = (el as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue

      // Skip path elements that belong to a registered tie arc
      if (el.tagName === 'path') {
        const cx = elBBox.x + elBBox.width / 2
        const cy = elBBox.y + elBBox.height / 2
        const isTiePath = tieBboxes.some(tb =>
          cx >= tb.x && cx <= tb.x + tb.width &&
          cy >= tb.y - 4 && cy <= tb.y + tb.height + 4,
        )
        if (isTiePath) continue
      }

      const intersects = !(
        elBBox.x + elBBox.width < selectBbox.x ||
        elBBox.x > selectBbox.x + selectBbox.width ||
        elBBox.y + elBBox.height < selectBbox.y ||
        elBBox.y > selectBbox.y + selectBbox.height
      )

      if (intersects) {
        if (elBBox.width < 50) {
          const svgEl = el as SVGElement
          const elCenterY = elBBox.y + elBBox.height / 2
          const elCenterX = elBBox.x + elBBox.width / 2

          if (tupletBbox) {
            const xMargin = 5
            if (
              elCenterX >= tupletBbox.x - xMargin &&
              elCenterX <= tupletBbox.x + tupletBbox.width + xMargin &&
              elCenterY >= tupletBbox.y &&
              elCenterY <= tupletBbox.y + tupletBbox.height
            ) {
              continue
            }
          }

          if (hasTupletsInMeasure && el.tagName === 'text' && targetY !== null) {
            if (Math.abs(elCenterY - targetY) > 8) {
              continue
            }
          }

          if (isInChord && targetY !== null) {
            if (el.tagName === 'line') {
              if (elBBox.height > 20) {
                continue
              }
            }
            const distToSelectedNote = Math.abs(elCenterY - targetY)
            let isCloserToOtherNote = false
            for (const otherNoteY of chordNoteYPositions) {
              const distToOtherNote = Math.abs(elCenterY - otherNoteY)
              if (distToOtherNote < distToSelectedNote) {
                isCloserToOtherNote = true
                break
              }
            }
            if (isCloserToOtherNote) continue
            if (distToSelectedNote > 20) continue
          }

          svgEl.dataset.originalFill = svgEl.getAttribute('fill') || ''
          svgEl.dataset.originalStroke = svgEl.getAttribute('stroke') || ''

          if (el.tagName === 'line') {
            svgEl.setAttribute('stroke', SELECTION_STROKE)
          } else if (el.tagName === 'text') {
            svgEl.setAttribute('fill', SELECTION_COLOR)
            svgEl.style.fill = SELECTION_COLOR
          } else {
            const currentFill = svgEl.getAttribute('fill')
            if (currentFill && currentFill !== 'none') {
              svgEl.setAttribute('fill', SELECTION_COLOR)
            }
            svgEl.setAttribute('stroke', SELECTION_STROKE)
          }
          svgEl.classList.add('selected-note')
        }
      }
    }
  }

  applyArticulationHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedArticulationNoteId) return

    const registry = engine.getElementRegistry()
    const artElements = registry.getByType('articulation').filter(
      el => el.noteId === this.state.selectedArticulationNoteId &&
            el.articulationType === this.state.selectedArticulationType,
    )
    if (!artElements.length) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const ARTICULATION_COLOR = '#F59E0B'
    const articulationCharCodes: Record<string, number[]> = {
      accent:   [0xE4A0, 0xE4A1],
      staccato: [0xE1E7],
      tenuto:   [0xE4A4, 0xE4A5],
    }

    const textEls = svg.querySelectorAll('text')

    for (const artEl of artElements) {
      const bbox = artEl.bbox
      const expectedCodes = articulationCharCodes[artEl.articulationType ?? ''] ?? []

      for (const svgEl of textEls) {
        const charCode = svgEl.textContent?.charCodeAt(0) ?? 0
        if (!expectedCodes.includes(charCode)) continue

        const svgX = parseFloat(svgEl.getAttribute('x') || '0')
        if (Math.abs(svgX - bbox.x) > 3) continue

        const el = svgEl as SVGElement
        el.setAttribute('fill', ARTICULATION_COLOR)
        el.style.fill = ARTICULATION_COLOR
        el.classList.add('selected-articulation')
      }
    }
  }

  applyAccidentalHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedAccidentalNoteId) return

    const registry = engine.getElementRegistry()
    const accElements = registry.getByType('accidental').filter(
      el => el.noteId === this.state.selectedAccidentalNoteId &&
            el.accidentalType === this.state.selectedAccidentalType,
    )
    if (!accElements.length) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const ACCIDENTAL_COLOR = '#F59E0B'

    for (const accEl of accElements) {
      const bbox = accEl.bbox
      const textEls = svg.querySelectorAll('text')
      for (const svgEl of textEls) {
        const elBBox = (svgEl as SVGGraphicsElement).getBBox?.()
        if (!elBBox) continue

        const centerX_bbox = bbox.x + bbox.width / 2
        const centerX_el = elBBox.x + elBBox.width / 2
        if (Math.abs(centerX_el - centerX_bbox) < 1.0) {
          const el = svgEl as SVGElement
          el.setAttribute('fill', ACCIDENTAL_COLOR)
          el.style.fill = ACCIDENTAL_COLOR
          el.classList.add('selected-accidental')
        }
      }
    }
  }

  applyTieHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedTieFromNoteId) return

    const registry = engine.getElementRegistry()
    const tieEl = registry.getByType('tie').find(el => el.fromNoteId === this.state.selectedTieFromNoteId)
    if (!tieEl) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const TIE_COLOR = '#F59E0B'
    const bbox = tieEl.bbox

    // The tie is a filled SVG path — find it by matching its center to the bbox
    const paths = svg.querySelectorAll('path')
    for (const path of paths) {
      const elBBox = (path as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue

      const centerX = elBBox.x + elBBox.width / 2
      const centerY = elBBox.y + elBBox.height / 2
      if (
        centerX >= bbox.x && centerX <= bbox.x + bbox.width &&
        centerY >= bbox.y - 4 && centerY <= bbox.y + bbox.height + 4
      ) {
        const svgEl = path as SVGElement
        svgEl.setAttribute('fill', TIE_COLOR)
        svgEl.classList.add('selected-tie')
      }
    }
  }

  applyClefSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || this.state.selectedClefMeasure === null) return

    const registry = engine.getElementRegistry()
    const targetBeat = this.state.selectedClefBeat ?? 0
    const clefEl = registry.getByType('clef').find(
      el => el.measure === this.state.selectedClefMeasure && (el.beat ?? 0) === targetBeat,
    )
    if (!clefEl) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const SELECTION_COLOR = '#F59E0B'
    const SELECTION_STROKE = '#D97706'
    const bbox = clefEl.bbox

    // The clef glyph is a filled path/text near the measure's left edge.
    // Color glyphs whose center sits inside the clef bbox, skipping the wide
    // staff lines (which also intersect this region).
    const elements = svg.querySelectorAll('path, text')
    for (const el of elements) {
      const elBBox = (el as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue
      if (elBBox.width > 40) continue // skip staff lines / wide elements

      const cx = elBBox.x + elBBox.width / 2
      const cy = elBBox.y + elBBox.height / 2
      if (cx >= bbox.x && cx <= bbox.x + bbox.width && cy >= bbox.y && cy <= bbox.y + bbox.height) {
        const svgEl = el as SVGElement
        const currentFill = svgEl.getAttribute('fill')
        if (currentFill && currentFill !== 'none') svgEl.setAttribute('fill', SELECTION_COLOR)
        svgEl.style.fill = SELECTION_COLOR
        svgEl.setAttribute('stroke', SELECTION_STROKE)
        svgEl.classList.add('selected-clef')
      }
    }
  }

  applyTupletSelectionHighlight(): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas || !this.state.selectedTupletId) return

    const elementInfo = engine.getTupletElementById(this.state.selectedTupletId)
    if (!elementInfo) return

    const svg = scoreCanvas.querySelector('svg')
    if (!svg) return

    const SELECTION_COLOR = '#F59E0B'
    const SELECTION_STROKE = '#D97706'
    const bbox = elementInfo.bbox

    const allElements = svg.querySelectorAll('path, line, text, rect, polygon, polyline')

    for (const el of allElements) {
      const elBBox = (el as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue

      const elCenterX = elBBox.x + elBBox.width / 2
      const elCenterY = elBBox.y + elBBox.height / 2
      const xMargin = 5
      const centerInBbox = (
        elCenterX >= bbox.x - xMargin &&
        elCenterX <= bbox.x + bbox.width + xMargin &&
        elCenterY >= bbox.y &&
        elCenterY <= bbox.y + bbox.height
      )

      if (centerInBbox) {
        let shouldHighlight = false
        if (el.tagName === 'text') {
          shouldHighlight = elBBox.width < 30
        } else {
          shouldHighlight = elBBox.width < 80 && elBBox.height < 20
        }

        if (shouldHighlight) {
          const svgEl = el as SVGElement
          svgEl.dataset.originalFill = svgEl.getAttribute('fill') || ''
          svgEl.dataset.originalStroke = svgEl.getAttribute('stroke') || ''

          if (el.tagName === 'line' || el.tagName === 'path') {
            svgEl.setAttribute('stroke', SELECTION_STROKE)
          }
          if (el.tagName === 'rect') {
            svgEl.setAttribute('fill', SELECTION_COLOR)
          }
          if (el.tagName === 'text') {
            svgEl.setAttribute('fill', SELECTION_COLOR)
            svgEl.style.fill = SELECTION_COLOR
          }
          svgEl.classList.add('selected-tuplet')
        }
      }
    }
  }
}
