import type { Ref } from 'vue'
import type { MusicEngine } from '../engine/MusicEngine'
import { buildBeatMap } from '../utils/beatMap'

interface HighlightDeps {
  engine: Ref<MusicEngine | null>
  scoreCanvas: Ref<HTMLElement | null>
  selectedTool: Ref<'entry' | 'selection'>
  selectedNoteId: Ref<string | null>
  selectedArticulationNoteId: Ref<string | null>
  selectedArticulationType: Ref<string | null>
  selectedAccidentalNoteId: Ref<string | null>
  selectedAccidentalType: Ref<string | null>
  selectedTupletId: Ref<string | null>
}

export function useHighlight(deps: HighlightDeps) {
  const {
    engine, scoreCanvas,
    selectedTool, selectedNoteId,
    selectedArticulationNoteId, selectedArticulationType,
    selectedAccidentalNoteId, selectedAccidentalType,
    selectedTupletId,
  } = deps

  /**
   * Draw a vertical cursor line on the staff AFTER the currently selected note,
   * indicating where the next keyboard entry will land.
   * The cursor signals that keyboard entry mode is active (like Sibelius's blue cursor).
   */
  function applyKeyboardCursor() {
    if (selectedTool.value !== 'entry' || !selectedNoteId.value || !engine.value || !scoreCanvas.value) return

    const svg = scoreCanvas.value.querySelector('svg')
    if (!svg) return

    const score = engine.value.getScore()
    const registry = engine.value.getElementRegistry()

    // Build a flat sorted list of one representative note per beat (same logic as navigateSelection)
    const { allFlat, beats } = buildBeatMap(score)

    // Find the current note's position in the beat list
    const currentNote = allFlat.find(n => n.id === selectedNoteId.value)
    if (!currentNote) return
    const currentKey = `${currentNote.measureNumber}:${currentNote.beat.num}/${currentNote.beat.den}`
    const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat.num}/${n.beat.den}` === currentKey)
    if (currentIndex === -1) return

    // The cursor goes at the NEXT beat after the current one
    const nextBeat = beats[currentIndex + 1]

    let cursorX: number
    let cursorMeasure: number

    if (nextBeat) {
      // Position cursor at the left edge of the next note
      const nextInfo = engine.value.getElementById(nextBeat.id)
      if (!nextInfo) return
      cursorX = nextInfo.bbox.x
      cursorMeasure = nextBeat.measureNumber
    } else {
      // No next note — position cursor at the right edge of the current note
      const currentInfo = engine.value.getElementById(selectedNoteId.value)
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
    line.setAttribute('stroke', '#3B82F6') // Blue
    line.setAttribute('stroke-width', '2')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('class', 'keyboard-cursor')
    svg.appendChild(line)
  }

  function applySelectionHighlight() {
    if (!engine.value || !scoreCanvas.value || !selectedNoteId.value) return

    // Get the selected element's info from ElementRegistry
    const elementInfo = engine.value.getElementById(selectedNoteId.value)
    if (!elementInfo) return

    const svg = scoreCanvas.value.querySelector('svg')
    if (!svg) return

    const SELECTION_COLOR = '#F59E0B'
    const SELECTION_STROKE = '#D97706'

    // Get the element's data from the score model
    const score = engine.value.getScore()
    let notePitch: number | null = null
    let noteMeasure: number | null = null
    let isRest = false
    let noteTupletId: string | null = null

    for (const measure of score.measures) {
      const element = measure.notes.find(n => n.id === selectedNoteId.value)
      if (element) {
        noteMeasure = element.measure
        isRest = element.isRest || false
        noteTupletId = element.tupletId || null
        if (!element.isRest) {
          notePitch = element.pitch
        }
        break
      }
    }

    // If this note/rest belongs to a tuplet, get the tuplet's rendered bbox
    // so we can exclude the "3" text element from the note highlight
    let tupletBbox: { x: number; y: number; width: number; height: number } | null = null
    if (noteTupletId) {
      const tupletInfo = engine.value.getTupletElementById(noteTupletId)
      if (tupletInfo) tupletBbox = tupletInfo.bbox
    }

    // For chords, the bbox covers all notes. Calculate specific Y for this note's pitch.
    // For rests, use the bbox directly (no pitch-based positioning)
    const registry = engine.value.getElementRegistry()
    let targetY: number | null = null
    if (notePitch !== null && noteMeasure !== null) {
      targetY = registry.pitchToPixelY(notePitch, noteMeasure)
    }

    // Create a pitch-specific bounding box if we have a target Y (for notes)
    // For rests, use the full bbox
    const bbox = elementInfo.bbox
    const noteHeight = 25 // Approximate height of a single notehead
    const selectBbox = (targetY !== null && !isRest) ? {
      x: bbox.x,
      y: targetY - noteHeight / 2,
      width: bbox.width,
      height: noteHeight
    } : bbox

    // Determine if this note is part of a chord and get Y positions of all chord notes
    // Rests cannot be in chords
    let isInChord = false
    let chordNoteYPositions: number[] = []
    if (noteMeasure !== null && !isRest) {
      const measureData = score.measures.find(m => m.number === noteMeasure)
      if (measureData) {
        const noteData = measureData.notes.find(n => n.id === selectedNoteId.value)
        if (noteData) {
          const notesAtBeat = measureData.notes.filter(
            n => !n.isRest && n.beat.num === noteData.beat.num && n.beat.den === noteData.beat.den
          )
          isInChord = notesAtBeat.length > 1
          // Get Y positions for all notes in the chord (except the selected one)
          if (isInChord) {
            for (const chordNote of notesAtBeat) {
              if (chordNote.id !== selectedNoteId.value) {
                const chordNoteY = registry.pitchToPixelY(chordNote.pitch, noteMeasure)
                if (chordNoteY !== null) {
                  chordNoteYPositions.push(chordNoteY)
                }
              }
            }
          }
        }
      }
    }

    // Check if there are tuplets in this measure (used to filter out tuplet number from highlight)
    const hasTupletsInMeasure = noteMeasure !== null
      ? registry.getTupletsByMeasure(noteMeasure).length > 0
      : false

    // Find all SVG elements and check if they intersect with the note's bounding box
    // Include 'text' and 'use' as VexFlow may use font glyphs for noteheads
    const allElements = svg.querySelectorAll('path, ellipse, circle, line, rect, text, use')

    for (const el of allElements) {
      const elBBox = (el as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue

      // Check if element's bounding box intersects with note's bounding box
      const intersects = !(
        elBBox.x + elBBox.width < selectBbox.x ||
        elBBox.x > selectBbox.x + selectBbox.width ||
        elBBox.y + elBBox.height < selectBbox.y ||
        elBBox.y > selectBbox.y + selectBbox.height
      )

      if (intersects) {
        // Check if this is likely part of the note (not staff lines, etc.)
        // Staff lines are typically very wide, notes are narrow
        if (elBBox.width < 50) {
          const svgEl = el as SVGElement
          const elCenterY = elBBox.y + elBBox.height / 2

          const elCenterX = elBBox.x + elBBox.width / 2

          // Skip any SVG element whose centre falls inside the tuplet's bracket/number bbox.
          // That bbox covers only the bracket+number area, never the noteheads themselves.
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

          // Additional safety net for text elements: if there are tuplets in the measure
          // and we know the notehead Y, skip any text element that is too far from it.
          // This catches the "3" even if the registered bbox is slightly off.
          if (hasTupletsInMeasure && el.tagName === 'text' && targetY !== null) {
            if (Math.abs(elCenterY - targetY) > 8) {
              continue
            }
          }

          // For chords, we need extra filtering to only highlight the specific note
          if (isInChord && targetY !== null) {
            // For lines (stems), skip highlighting - stems are shared across chord notes
            // Only highlight if the line is very short (ledger lines, not chord stems)
            if (el.tagName === 'line') {
              // Skip chord stems (tall vertical lines) - only highlight short lines
              if (elBBox.height > 20) {
                continue
              }
            }

            // For noteheads (text, path, ellipse), only highlight if this element
            // is closer to the selected note than to any other note in the chord
            const distToSelectedNote = Math.abs(elCenterY - targetY)

            // Check if any other chord note is closer to this element
            let isCloserToOtherNote = false
            for (const otherNoteY of chordNoteYPositions) {
              const distToOtherNote = Math.abs(elCenterY - otherNoteY)
              if (distToOtherNote < distToSelectedNote) {
                isCloserToOtherNote = true
                break
              }
            }

            if (isCloserToOtherNote) {
              continue
            }

            // Also skip if too far from selected note (more than 20px)
            if (distToSelectedNote > 20) {
              continue
            }
          }

          // Store original values for potential restoration
          svgEl.dataset.originalFill = svgEl.getAttribute('fill') || ''
          svgEl.dataset.originalStroke = svgEl.getAttribute('stroke') || ''

          // Apply selection colors directly
          if (el.tagName === 'line') {
            svgEl.setAttribute('stroke', SELECTION_STROKE)
          } else if (el.tagName === 'text') {
            // Text elements use fill for color
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

  function applyArticulationHighlight() {
    if (!engine.value || !scoreCanvas.value || !selectedArticulationNoteId.value) return

    const registry = engine.value.getElementRegistry()
    const artElements = registry.getByType('articulation').filter(
      el => el.noteId === selectedArticulationNoteId.value &&
            el.articulationType === selectedArticulationType.value
    )
    if (!artElements.length) return

    const svg = scoreCanvas.value.querySelector('svg')
    if (!svg) return

    const ARTICULATION_COLOR = '#F59E0B'

    // SMuFL char codes for each articulation type.
    // Note: VexFlow maps 'a.' (staccato) to Glyphs.augmentationDot (U+E1E7), NOT articStaccatoAbove.
    // The staccato and dotted-note augmentation dots share the same glyph — x-position matching
    // below distinguishes them (staccato is centered on the note; augmentation dots are to the right).
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

  function applyAccidentalHighlight() {
    if (!engine.value || !scoreCanvas.value || !selectedAccidentalNoteId.value) return

    const registry = engine.value.getElementRegistry()
    const accElements = registry.getByType('accidental').filter(
      el => el.noteId === selectedAccidentalNoteId.value &&
            el.accidentalType === selectedAccidentalType.value
    )
    if (!accElements.length) return

    const svg = scoreCanvas.value.querySelector('svg')
    if (!svg) return

    const ACCIDENTAL_COLOR = '#F59E0B'

    for (const accEl of accElements) {
      const bbox = accEl.bbox
      // Accidental glyphs are <text> elements (SMuFL font), same as articulations.
      // Match by X start + width since getBBox heights are the full font line-box.
      const textEls = svg.querySelectorAll('text')
      for (const svgEl of textEls) {
        const elBBox = (svgEl as SVGGraphicsElement).getBBox?.()
        if (!elBBox) continue

        // Accidental bbox x/width from VexFlow and SVG getBBox differ by ~0.9px,
        // so match by center X (±1px) which is stable across both.
        const centerX_bbox = bbox.x + bbox.width / 2
        const centerX_el = elBBox.x + elBBox.width / 2
        const xMatches = Math.abs(centerX_el - centerX_bbox) < 1.0
        if (xMatches) {
          const el = svgEl as SVGElement
          el.setAttribute('fill', ACCIDENTAL_COLOR)
          el.style.fill = ACCIDENTAL_COLOR
          el.classList.add('selected-accidental')
        }
      }
    }
  }

  function applyTupletSelectionHighlight() {
    if (!engine.value || !scoreCanvas.value || !selectedTupletId.value) return

    // Get the tuplet element's info from ElementRegistry
    const elementInfo = engine.value.getTupletElementById(selectedTupletId.value)
    if (!elementInfo) return

    const svg = scoreCanvas.value.querySelector('svg')
    if (!svg) return

    const SELECTION_COLOR = '#F59E0B'
    const SELECTION_STROKE = '#D97706'

    const bbox = elementInfo.bbox

    // Find all SVG elements that could be part of the tuplet bracket/number
    // Include rect as VexFlow might use it for brackets
    const allElements = svg.querySelectorAll('path, line, text, rect, polygon, polyline')

    for (const el of allElements) {
      const elBBox = (el as SVGGraphicsElement).getBBox?.()
      if (!elBBox) continue

      const elCenterX = elBBox.x + elBBox.width / 2
      const elCenterY = elBBox.y + elBBox.height / 2

      // Check if element's center is within the tuplet bbox
      // Use a small margin (5px) on X to catch bracket legs that extend slightly beyond the notes
      const xMargin = 5
      const centerInBbox = (
        elCenterX >= bbox.x - xMargin &&
        elCenterX <= bbox.x + bbox.width + xMargin &&
        elCenterY >= bbox.y &&
        elCenterY <= bbox.y + bbox.height
      )

      if (centerInBbox) {
        // Additional filter based on element type:
        // - Text elements (the "3"): VexFlow text elements have height=160 (full staff),
        //   but we already checked their CENTER is in the bbox, so include them
        // - Line/path/rect elements (brackets): exclude wide elements (staff lines) and
        //   tall elements (note stems)
        let shouldHighlight = false
        if (el.tagName === 'text') {
          // Text elements with center in bbox are likely the tuplet number
          shouldHighlight = elBBox.width < 30 // Just filter out very wide text
        } else {
          // For lines/paths/rects, use stricter filter to exclude stems and staff lines
          shouldHighlight = elBBox.width < 80 && elBBox.height < 20
        }

        if (shouldHighlight) {
          const svgEl = el as SVGElement

          // Store original values for potential restoration
          svgEl.dataset.originalFill = svgEl.getAttribute('fill') || ''
          svgEl.dataset.originalStroke = svgEl.getAttribute('stroke') || ''

          // Apply selection colors based on element type
          if (el.tagName === 'line' || el.tagName === 'path') {
            svgEl.setAttribute('stroke', SELECTION_STROKE)
          }
          if (el.tagName === 'rect') {
            // Rect elements use fill for their color
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

  return {
    applySelectionHighlight,
    applyArticulationHighlight,
    applyAccidentalHighlight,
    applyTupletSelectionHighlight,
    applyKeyboardCursor,
  }
}
