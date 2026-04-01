import { onMounted, onUnmounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { ArticulationType, Accidental, NoteDuration } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import { fracToNumber } from '../utils/fraction'
import { getMeasureNotes } from '../utils/musicUtils'

interface MouseInteractionDeps {
  engine: Ref<MusicEngine | null>
  scoreCanvas: Ref<HTMLElement | null>
  selectedTool: Ref<'entry' | 'selection'>
  selectedNoteId: Ref<string | null>
  selectedArticulationNoteId: Ref<string | null>
  selectedArticulationType: Ref<string | null>
  selectedAccidentalNoteId: Ref<string | null>
  selectedAccidentalType: Ref<string | null>
  selectedTupletId: Ref<string | null>
  // Palette state (for ghost note preview and note placement)
  selectedDuration: Ref<NoteDuration>
  selectedAccidental: Ref<Accidental | null>
  selectedDots: Ref<number>
  pendingArticulations: ComputedRef<ArticulationType[] | undefined>
  tupletMode: Ref<boolean>
  // Selection + render callbacks
  selectNote: (id: string | null) => void
  setSelectedNote: (id: string | null) => void
  renderScore: () => void
  applySelectionHighlight: () => void
  applyArticulationHighlight: () => void
  applyAccidentalHighlight: () => void
  applyTupletSelectionHighlight: () => void
  applyKeyboardCursor: () => void
  // App-level state that this composable writes to
  showCursor: Ref<boolean>
}

export function useMouseInteraction(deps: MouseInteractionDeps) {
  const {
    engine, scoreCanvas,
    selectedTool, selectedNoteId,
    selectedArticulationNoteId, selectedArticulationType,
    selectedAccidentalNoteId, selectedAccidentalType,
    selectedTupletId,
    selectedDuration, selectedAccidental, selectedDots,
    pendingArticulations, tupletMode,
    selectNote, setSelectedNote, renderScore,
    applySelectionHighlight, applyArticulationHighlight,
    applyAccidentalHighlight, applyTupletSelectionHighlight, applyKeyboardCursor,
    showCursor,
  } = deps

  // --- Internal mouse state ---
  let lastCanvasMousePosition: { x: number; y: number } | null = null
  let isMouseButtonDown = false

  onMounted(() => {
    document.addEventListener('mousedown', onDocMouseDown, true)
    document.addEventListener('mouseup', onDocMouseUp, true)
  })
  onUnmounted(() => {
    document.removeEventListener('mousedown', onDocMouseDown, true)
    document.removeEventListener('mouseup', onDocMouseUp, true)
  })

  function onDocMouseDown() { isMouseButtonDown = true }
  function onDocMouseUp() { isMouseButtonDown = false }

  function getLastMousePosition() { return lastCanvasMousePosition }

  // --- Internal drag state ---
  let isDraggingNote = false
  let draggedNoteOriginalPitch: number | null = null
  let dragStartTime: number | null = null
  const DRAG_TIME_THRESHOLD_MS = 150 // Must hold mouse down this long before drag activates

  // --- Ghost note preview throttle ---
  let lastPreviewRender = 0
  const PREVIEW_THROTTLE_MS = 50 // Only update preview every 50ms

  // --- Private helper ---

  /**
   * Convert a MouseEvent's client coordinates to SVG space.
   * Returns null if the SVG or its CTM is not available.
   */
  function clientToSvg(event: MouseEvent, svg: SVGSVGElement): { x: number; y: number } | null {
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const svgPoint = point.matrixTransform(ctm.inverse())
    return { x: svgPoint.x, y: svgPoint.y }
  }

  // --- Mouse handlers ---

  function handleCanvasMouseDown(event: MouseEvent) {
    if (!engine.value || !scoreCanvas.value) return

    // Only handle in selection mode
    if (selectedTool.value !== 'selection') return

    const svg = scoreCanvas.value.querySelector('svg') as SVGSVGElement | null
    if (!svg) return

    const coords = clientToSvg(event, svg)
    if (!coords) return
    const { x, y } = coords

    const registry = engine.value.getElementRegistry()
    const measureNum = engine.value.pixelToMeasure({ x, y })

    // Find closest note/rest element first
    const closestElement = registry.findClosestNoteOrRest(x, y, measureNum)

    // Check if clicking on a tuplet bracket (but prioritize notes over tuplets)
    const tupletAtClick = registry.getTupletAt(x, y, measureNum)

    // If click is inside a tuplet bbox, decide between selecting note or tuplet
    // based on VERTICAL distance to noteheads (not total distance, since notes spread horizontally)
    if (tupletAtClick && tupletAtClick.tupletId) {
      const tupletNotes = registry.getNotesByTupletId(tupletAtClick.tupletId)
      let minVerticalDistance = Infinity

      for (const note of tupletNotes) {
        if (note.pitch !== undefined) {
          const noteY = registry.pitchToPixelY(note.pitch, measureNum)
          if (noteY !== null) {
            const verticalDistance = Math.abs(y - noteY)
            minVerticalDistance = Math.min(minVerticalDistance, verticalDistance)
          }
        }
      }

      // If click Y is far from all noteheads (>12px), select the tuplet.
      // 12px is roughly half a staff line spacing, covers the notehead height.
      if (minVerticalDistance > 12) {
        selectedTupletId.value = tupletAtClick.tupletId
        selectedNoteId.value = null
        console.log(`✓ Tuplet selected on mousedown | id:${tupletAtClick.tupletId}`)
        renderScore()
        return
      }
    }

    // Clear tuplet selection when selecting notes
    selectedTupletId.value = null

    // Check if clicking directly on an accidental — select the accidental itself
    const accidentalAt = registry.getByType('accidental').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (accidentalAt?.noteId) {
      selectedNoteId.value = null
      selectedArticulationNoteId.value = null
      selectedArticulationType.value = null
      selectedAccidentalNoteId.value = accidentalAt.noteId
      selectedAccidentalType.value = accidentalAt.accidentalType || null
      console.log(`✓ Accidental selected | noteId:${accidentalAt.noteId} type:${accidentalAt.accidentalType}`)
      renderScore()
      return
    }

    // Check if clicking directly on an articulation — select the articulation itself.
    // (cannot use getAt here because the staff element is registered last and always wins)
    // Use a tolerance pad because small articulations like staccato have tiny bounding boxes.
    const artPad = 8
    const articulationAt = registry.getByType('articulation').find(el => {
      const b = el.bbox
      return x >= b.x - artPad && x <= b.x + b.width + artPad && y >= b.y - artPad && y <= b.y + b.height + artPad
    }) ?? null
    if (articulationAt?.noteId) {
      selectedNoteId.value = null
      selectedAccidentalNoteId.value = null
      selectedAccidentalType.value = null
      selectedArticulationNoteId.value = articulationAt.noteId
      selectedArticulationType.value = articulationAt.articulationType || null
      console.log(`✓ Articulation selected | noteId:${articulationAt.noteId} type:${articulationAt.articulationType}`)
      renderScore()
      return
    }

    if (closestElement && closestElement.id) {
      const bbox = closestElement.bbox
      const centerX = bbox.x + bbox.width / 2

      // For notes in chords, use pitch-based Y position; for rests, use bbox center
      let elementY: number
      if (closestElement.type === 'note' && closestElement.pitch !== undefined) {
        const pitchY = registry.pitchToPixelY(closestElement.pitch, measureNum)
        elementY = pitchY !== null ? pitchY : bbox.y + bbox.height / 2
      } else {
        elementY = bbox.y + bbox.height / 2
      }

      const distance = Math.sqrt((x - centerX) ** 2 + (y - elementY) ** 2)

      // Select if within 30px of element center
      if (distance < 30) {
        selectNote(closestElement.id)
        const typeLabel = closestElement.type === 'rest' ? 'Rest' : 'Note'
        console.log(`✓ ${typeLabel} selected on mousedown | id:${closestElement.id}`)
        renderScore()

        // If it's a note (not rest), prepare for potential drag
        if (closestElement.type === 'note' && closestElement.pitch !== undefined) {
          isDraggingNote = true
          draggedNoteOriginalPitch = closestElement.pitch
          dragStartTime = Date.now()
          console.log(`Drag ready | note:${closestElement.id} pitch:${closestElement.pitch}`)
          event.preventDefault() // Prevent text selection during drag
        }
      } else {
        // Clicked too far from element - clear selection
        selectNote(null)
        console.log('Selection cleared (too far from element)')
        renderScore()
      }
    } else {
      // Clicked on empty space - clear selection
      selectNote(null)
      console.log('Selection cleared')
      renderScore()
    }
  }

  function handleCanvasMouseUp(_event: MouseEvent) {
    if (isDraggingNote) {
      console.log(`Drag ended | note:${selectedNoteId.value}`)
      isDraggingNote = false
      draggedNoteOriginalPitch = null
      dragStartTime = null
    }
  }

  function handleCanvasClick(event: MouseEvent) {
    // Selection mode is handled entirely by mousedown, skip here
    if (selectedTool.value === 'selection') return

    console.log(`Click RAW | client:(${event.clientX},${event.clientY})`)

    if (!engine.value || !scoreCanvas.value) {
      console.log('✗ Click ignored: engine or canvas not ready')
      return
    }

    const svg = scoreCanvas.value.querySelector('svg') as SVGSVGElement | null
    if (!svg) {
      console.log('✗ Click ignored: SVG not found')
      return
    }

    const coords = clientToSvg(event, svg)
    if (!coords) {
      console.log('✗ Click ignored: no CTM')
      return
    }
    const { x, y } = coords

    // === DEBUG: Log click info ===
    const registry = engine.value.getElementRegistry()
    const measureNum = engine.value.pixelToMeasure({ x, y })
    const nearestElement = registry.findNearestNoteOrRest(x, measureNum)
    const elementAt = registry.getAt(x, y)
    console.log(`Click | svg:(${x.toFixed(0)},${y.toFixed(0)}) measure:${measureNum} | nearestElement:`, nearestElement ? {
      type: nearestElement.type,
      beat: nearestElement.beat,
      bbox: `(${nearestElement.bbox.x.toFixed(0)},${nearestElement.bbox.y.toFixed(0)}) ${nearestElement.bbox.width.toFixed(0)}x${nearestElement.bbox.height.toFixed(0)}`
    } : null, '| elementAt:', elementAt?.type || null)

    // Entry mode: add note or tuplet at position
    try {
      if (tupletMode.value) {
        // Tuplet mode: check if clicking inside an existing tuplet first.
        // If so, add a note to that tuplet instead of creating a new one.
        const score = engine.value.getScore()
        const measure = score.measures.find(m => m.number === measureNum)
        const beatsInMeasure = measure
          ? (4 / measure.timeSignature.denominator) * measure.timeSignature.numerator
          : 4
        const position = engine.value.pixelToPosition({ x, y }, beatsInMeasure)
        const existingTuplet = engine.value.getTupletAtBeat(measureNum, position.beat)

        if (existingTuplet) {
          // Clicking inside an existing tuplet - add a note instead of creating a new tuplet
          console.log(`Tuplet mode: clicking inside existing tuplet at beat ${fracToNumber(position.beat).toFixed(3)}, adding note instead`)
          const note = engine.value.addNoteAtPosition(
            { x, y },
            selectedDuration.value,
            selectedAccidental.value || undefined,
            selectedDots.value || undefined,
            pendingArticulations.value
          )

          if (note) {
            console.log(`✓ Note added to tuplet | pitch:${note.pitch} measure:${note.measure} beat:${note.beat}`)
            setSelectedNote(note.id)
            selectedTool.value = 'entry'
            renderScore()
          } else {
            console.log('✗ Note NOT added to tuplet (collision or invalid location)')
          }
        } else {
          // Not inside an existing tuplet - create a new tuplet
          let pitch = registry.pixelYToPitch(y, measureNum)
          if (pitch === null) {
            pitch = 71 // Default to B4 if pitch detection fails
          }

          const result = engine.value.createTupletAtPosition(
            { x, y },
            selectedDuration.value,
            pitch,
            selectedAccidental.value || undefined
          )

          if (result) {
            console.log(`✓ Tuplet created | tupletId:${result.tuplet.id} firstNote pitch:${result.firstNote.pitch}`)
            setSelectedNote(result.firstNote.id)
            selectedTool.value = 'entry'
            // Keep tuplet mode active - user must manually disable it
            renderScore()
          } else {
            console.log('✗ Tuplet NOT created (collision or invalid location)')
          }
        }
      } else {
        // Normal mode: add note at position
        const note = engine.value.addNoteAtPosition(
          { x, y },
          selectedDuration.value,
          selectedAccidental.value || undefined,
          selectedDots.value || undefined,
          pendingArticulations.value
        )

        if (note) {
          console.log(`✓ Note added | pitch:${note.pitch} measure:${note.measure} beat:${note.beat}`)
          setSelectedNote(note.id)
          selectedTool.value = 'entry'
          renderScore()
        } else {
          console.log('✗ Note NOT added (collision or invalid location)')
        }
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Cannot add note: ' + (error as Error).message)
    }
  }

  function handleCanvasMouseMove(event: MouseEvent) {
    if (!engine.value || !scoreCanvas.value) return

    const svg = scoreCanvas.value.querySelector('svg') as SVGSVGElement | null
    if (!svg) return

    const coords = clientToSvg(event, svg)
    if (!coords) return
    const { x, y } = coords

    // Track last mouse position for ghost note rendering when switching modes
    lastCanvasMousePosition = { x, y }

    // Handle drag-to-change-pitch in selection mode
    if (isDraggingNote && selectedNoteId.value && draggedNoteOriginalPitch !== null) {
      // Time-based threshold: must hold mouse down long enough before drag activates
      if (dragStartTime !== null) {
        const elapsed = Date.now() - dragStartTime
        if (elapsed < DRAG_TIME_THRESHOLD_MS) {
          // Not held long enough yet, don't allow pitch changes
          return
        }
      }

      const score = engine.value.getScore()
      let selectedNote = null
      for (const measure of score.measures) {
        const note = getMeasureNotes(measure).find(n => n.id === selectedNoteId.value)
        if (note) { selectedNote = note; break }
      }

      if (selectedNote && !selectedNote.isRest) {
        const measure = engine.value.getScore().measures.find(m => m.number === selectedNote.measure)
        if (measure) {
          const beatsInMeasure = measure.timeSignature.numerator
          const position = engine.value.pixelToPosition({ x, y }, beatsInMeasure)
          const cursorPitch = position.pitch

          // Only update if pitch actually changed
          if (cursorPitch !== selectedNote.pitch) {
            console.log(`Drag pitch change | ${selectedNote.pitch} -> ${cursorPitch}`)
            engine.value.updateNote(selectedNoteId.value, { pitch: cursorPitch })
            renderScore()
          }
        }
      }
      return
    }

    // Don't show ghost note preview in selection mode (when not dragging)
    if (selectedTool.value === 'selection') return

    // IMPORTANT: Don't re-render while mouse button is down.
    // This prevents the SVG elements from being replaced during a click,
    // which would cause the browser to not fire the click event.
    if (isMouseButtonDown) return

    // Throttle preview updates for performance
    const now = Date.now()
    if (now - lastPreviewRender < PREVIEW_THROTTLE_MS) return
    lastPreviewRender = now

    // Render score with ghost note preview using selected duration, accidental, and dots
    const ghostNoteRendered = engine.value.renderScoreWithPreview(
      { x, y },
      selectedDuration.value,
      selectedAccidental.value || undefined,
      selectedDots.value,
      pendingArticulations.value
    )

    applySelectionHighlight()
    applyArticulationHighlight()
    applyAccidentalHighlight()
    applyTupletSelectionHighlight()
    applyKeyboardCursor()

    // Hide cursor when ghost note is shown, show cursor when it's not
    showCursor.value = !ghostNoteRendered
  }

  function handleCanvasMouseLeave() {
    if (!engine.value) return

    // End any ongoing drag
    if (isDraggingNote) {
      console.log('Drag ended (mouse left canvas)')
      isDraggingNote = false
      draggedNoteOriginalPitch = null
      dragStartTime = null
    }

    // Clear last mouse position (mouse is no longer on canvas)
    lastCanvasMousePosition = null

    // Clear preview and render normal score
    renderScore()

    // Reset cursor visibility when leaving the canvas
    showCursor.value = true
  }

  return {
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleCanvasClick,
    handleCanvasMouseMove,
    handleCanvasMouseLeave,
    getLastMousePosition,
  }
}
