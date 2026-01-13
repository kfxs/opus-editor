<template>
  <div class="min-h-screen bg-gray-900 text-white p-8">
    <h1 class="text-4xl font-bold mb-8">Opus Score Editor</h1>

    <div class="mb-8">
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="mb-4 flex gap-2 flex-wrap">
          <button
            @click="addSampleNotes"
            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Add Sample Notes
          </button>
          <button
            @click="clearNotes"
            class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            Clear Notes
          </button>
          <div class="border-l border-gray-600 mx-2"></div>

          <!-- Tool Mode Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Tool:</span>
            <button
              @click="selectedTool = 'entry'; selectedNoteId = null"
              :class="[
                'px-3 py-1 rounded text-sm',
                selectedTool === 'entry'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Note Entry Tool"
            >
              Entry
            </button>
            <button
              @click="selectedTool = 'selection'"
              :class="[
                'px-3 py-1 rounded text-sm',
                selectedTool === 'selection'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Selection Tool"
            >
              Select
            </button>
          </div>

          <div class="border-l border-gray-600 mx-2"></div>

          <!-- Note Duration Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Duration:</span>
            <button
              @click="setDuration('w')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedDuration === 'w'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Whole note (Redonda) - 4 beats"
            >
              𝅝
            </button>
            <button
              @click="setDuration('h')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedDuration === 'h'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Half note (Blanca) - 2 beats"
            >
              𝅗𝅥
            </button>
            <button
              @click="setDuration('q')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedDuration === 'q'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Quarter note (Negra) - 1 beat"
            >
              ♩
            </button>
            <button
              @click="setDuration('8')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedDuration === '8'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Eighth note (Corchea) - 0.5 beats"
            >
              ♪
            </button>
            <button
              @click="setDuration('16')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedDuration === '16'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Sixteenth note (Semicorchea) - 0.25 beats"
            >
              𝅘𝅥𝅯
            </button>
          </div>

          <!-- Accidental Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Alteration:</span>
            <button
              @click="setAccidental(null)"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedAccidental === null
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="No alteration (Natural)"
            >
              —
            </button>
            <button
              @click="setAccidental('#')"
              :class="[
                'px-3 py-1 rounded text-lg font-bold',
                selectedAccidental === '#'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Sharp (Sostenido)"
            >
              ♯
            </button>
            <button
              @click="setAccidental('b')"
              :class="[
                'px-3 py-1 rounded text-lg font-bold',
                selectedAccidental === 'b'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Flat (Bemol)"
            >
              ♭
            </button>
            <button
              @click="setAccidental('n')"
              :class="[
                'px-3 py-1 rounded text-lg font-bold',
                selectedAccidental === 'n'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Natural (Becuadro)"
            >
              ♮
            </button>
          </div>

          <div class="border-l border-gray-600 mx-2"></div>
          <button
            @click="togglePlayback"
            :class="[
              'px-4 py-2 rounded min-w-[80px]',
              playbackState === 'playing'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-purple-600 hover:bg-purple-700',
            ]"
          >
            {{ playbackState === 'playing' ? '⏹ Stop' : '▶ Play' }}
          </button>
        </div>

        <div class="text-left mb-4 grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-400 mb-2">Score Info:</p>
            <p>Title: {{ engine?.getScore().title || 'Loading...' }}</p>
            <p>Tempo: {{ engine?.getScore().tempo || 120 }} BPM</p>
            <p>Measures: {{ engine?.getScore().measures.length || 0 }}</p>
            <p>Total Notes: {{ totalNotes }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-400 mb-2">Playback Status:</p>
            <p>State: <span class="capitalize">{{ playbackState }}</span></p>
            <p>Measure: {{ playbackPosition.measure }}</p>
            <p>Beat: {{ playbackPosition.beat.toFixed(2) }}</p>
            <p>Progress: {{ (playbackPosition.progress * 100).toFixed(0) }}%</p>
          </div>
        </div>

        <!-- VexFlow Rendering Area (Score Container/Canvas) -->
        <div
          ref="scoreCanvas"
          class="score-container bg-white rounded-lg p-4 min-h-[300px] overflow-auto cursor-default"
          @click="handleCanvasClick"
          @mousemove="handleCanvasMouseMove"
          @mouseleave="handleCanvasMouseLeave"
        ></div>

      </div>
    </div>

    <div class="bg-gray-800 p-4 rounded-lg text-left">
      <h3 class="text-xl mb-2">Score JSON:</h3>
      <pre class="bg-gray-900 p-4 rounded overflow-auto text-xs max-h-96">{{ scoreJSON }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { MusicEngine } from './engine/MusicEngine'
import type { PlaybackPosition } from './engine/audio/PlaybackEngine'

// Create the music engine
const engine = ref<MusicEngine | null>(null)
const scoreCanvas = ref<HTMLElement | null>(null)

// Playback state
const playbackState = ref<'stopped' | 'playing' | 'paused'>('stopped')
const playbackPosition = ref<PlaybackPosition>({
  measure: 1,
  beat: 0,
  progress: 0,
  time: 0,
})

// Tool mode selection
const selectedTool = ref<'entry' | 'selection'>('entry')
const selectedNoteId = ref<string | null>(null)

// Note duration selection
const selectedDuration = ref<'w' | 'h' | 'q' | '8' | '16' | '32'>('q') // Default to quarter note

// Accidental selection
const selectedAccidental = ref<'#' | 'b' | 'n' | null>(null) // Default to no accidental

// Cursor visibility (hide when ghost note renders, show when it doesn't)
const showCursor = ref(true)

// Ghost note preview throttling
let lastPreviewRender = 0
const PREVIEW_THROTTLE_MS = 50 // Only update preview every 50ms

// Computed properties
const totalNotes = computed(() => engine.value?.getScore().measures.flatMap(m => m.notes).length || 0)
const scoreJSON = computed(() => engine.value?.exportJSON() || '{}')


// Debug: Track if we're in a render to detect race conditions
let isRendering = false
let lastRenderTime = 0

// Track mouse button state to prevent re-renders during click
let isMouseButtonDown = false

onMounted(() => {
  if (scoreCanvas.value) {
    engine.value = new MusicEngine({
      container: scoreCanvas.value,
      width: 1000,
      height: 400,
    })

    // Setup playback callbacks
    engine.value.setPlaybackCallbacks({
      onStateChange: state => {
        playbackState.value = state
      },
      onPositionChange: position => {
        playbackPosition.value = position
      },
      onPlaybackComplete: () => {
        playbackState.value = 'stopped'
      },
    })

    // Track mousedown/mouseup to prevent re-renders during click
    document.addEventListener('mousedown', () => {
      isMouseButtonDown = true  // Prevent ghost note re-renders
    }, true)
    document.addEventListener('mouseup', () => {
      isMouseButtonDown = false  // Allow ghost note re-renders again
    }, true)

    // Handle Delete key for removing selected note
    document.addEventListener('keydown', handleKeyDown)

    // Initialize with empty measures
    initializeEmptyScore()
    renderScore()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  if (engine.value) {
    engine.value.dispose()
  }
})

function handleKeyDown(event: KeyboardEvent) {
  // Delete or Backspace key removes selected note
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNoteId.value && engine.value) {
    // Prevent default browser behavior (like navigating back)
    event.preventDefault()
    engine.value.deleteNote(selectedNoteId.value)
    selectedNoteId.value = null
    renderScore()
  }
}

function initializeEmptyScore() {
  if (!engine.value) return

  // Clear any existing notes (refills with rests)
  engine.value.clearAllNotes()

  // Add 7 more measures (1 already exists by default) for a total of 8
  // Each new measure is automatically filled with rests
  for (let i = 0; i < 7; i++) {
    engine.value.addMeasure()
  }
}

function addSampleNotes() {
  if (!engine.value) return

  // Clear existing notes first
  engine.value.clearAllNotes()

  // Add some sample notes as an example
  engine.value.addNote({ pitch: 60, duration: 'q', measure: 1, beat: 0 }) // C4
  engine.value.addNote({ pitch: 64, duration: 'q', measure: 1, beat: 1 }) // E4
  engine.value.addNote({ pitch: 67, duration: 'q', measure: 1, beat: 2 }) // G4
  engine.value.addNote({ pitch: 72, duration: 'q', measure: 1, beat: 3 }) // C5

  renderScore()
}

function clearNotes() {
  if (!engine.value) return
  engine.value.clearAllNotes()
  selectedNoteId.value = null
  renderScore()
}

function setDuration(duration: 'w' | 'h' | 'q' | '8' | '16' | '32') {
  selectedDuration.value = duration
  // If a note is selected, update its duration
  if (selectedNoteId.value && engine.value) {
    engine.value.updateNote(selectedNoteId.value, { duration })
    renderScore()
  }
}

function setAccidental(accidental: '#' | 'b' | 'n' | null) {
  selectedAccidental.value = accidental
  // If a note is selected, update its accidental
  if (selectedNoteId.value && engine.value) {
    engine.value.updateNote(selectedNoteId.value, { accidental: accidental || undefined })
    renderScore()
  }
}

function renderScore() {
  if (!engine.value) return
  isRendering = true
  engine.value.clearCanvas()
  engine.value.renderScore()
  isRendering = false
  lastRenderTime = Date.now()

  // Apply selection highlight if a note is selected
  applySelectionHighlight()
}

function applySelectionHighlight() {
  if (!engine.value || !scoreCanvas.value || !selectedNoteId.value) return

  // Get the selected note's bounding box from ElementRegistry
  const elementInfo = engine.value.getElementById(selectedNoteId.value)
  if (!elementInfo) {
    // Note was deleted or no longer exists
    selectedNoteId.value = null
    return
  }

  // Get SVG element and transform coordinates
  const svg = scoreCanvas.value.querySelector('svg')
  if (!svg) return

  // Calculate center of the bounding box in screen coordinates
  const bbox = elementInfo.bbox
  const centerX = bbox.x + bbox.width / 2
  const centerY = bbox.y + bbox.height / 2

  // Transform SVG coordinates to screen coordinates
  const point = svg.createSVGPoint()
  point.x = centerX
  point.y = centerY
  const ctm = svg.getScreenCTM()
  if (!ctm) return

  const screenPoint = point.matrixTransform(ctm)

  // Find elements at that screen position
  const elements = document.elementsFromPoint(screenPoint.x, screenPoint.y)

  // Find the parent SVG group (usually the first <g> ancestor)
  for (const el of elements) {
    if (el instanceof SVGElement && el.closest('svg') === svg) {
      // Find the nearest ancestor <g> element that represents the note
      let group = el.closest('g')
      if (group) {
        group.classList.add('selected-note')
        return
      }
    }
  }
}

async function togglePlayback() {
  if (!engine.value) return

  if (playbackState.value === 'playing') {
    engine.value.stop()
  } else {
    try {
      await engine.value.play()
    } catch (error) {
      console.error('Playback error:', error)
    }
  }
}

function handleCanvasClick(event: MouseEvent) {
  // Log raw click immediately
  console.log(`Click RAW | client:(${event.clientX},${event.clientY})`)

  if (!engine.value || !scoreCanvas.value) {
    console.log('✗ Click ignored: engine or canvas not ready')
    return
  }

  // Get coordinates in SVG space using SVG's native coordinate transformation
  // This automatically handles padding, scroll, zoom, and any CSS transforms
  const svg = scoreCanvas.value.querySelector('svg')
  if (!svg) {
    console.log('✗ Click ignored: SVG not found')
    return
  }

  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) {
    console.log('✗ Click ignored: no CTM')
    return
  }

  const svgPoint = point.matrixTransform(ctm.inverse())
  const x = svgPoint.x
  const y = svgPoint.y

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

  // Handle based on current tool mode
  if (selectedTool.value === 'selection') {
    // Selection mode: find and select note under cursor
    // Use nearestElement since getAt often returns 'staff' due to overlapping bboxes
    if (nearestElement && nearestElement.type === 'note' && nearestElement.id) {
      // Check if click is within a reasonable distance of the note
      const bbox = nearestElement.bbox
      const centerX = bbox.x + bbox.width / 2
      const centerY = bbox.y + bbox.height / 2
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)

      // Select if within 30px of note center
      if (distance < 30) {
        selectedNoteId.value = nearestElement.id
        console.log(`✓ Note selected | id:${nearestElement.id}`)
      } else {
        selectedNoteId.value = null
        console.log('Selection cleared (too far from note)')
      }
    } else {
      // Clicked on empty space - clear selection
      selectedNoteId.value = null
      console.log('Selection cleared')
    }
    renderScore()
  } else {
    // Entry mode: add note at position
    try {
      const note = engine.value.addNoteAtPosition(
        { x, y },
        selectedDuration.value,
        selectedAccidental.value || undefined
      )

      if (note) {
        console.log(`✓ Note added | pitch:${note.pitch} measure:${note.measure} beat:${note.beat}`)
        renderScore()
      } else {
        console.log('✗ Note NOT added (collision or invalid location)')
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Cannot add note: ' + (error as Error).message)
    }
  }
}

function handleCanvasMouseMove(event: MouseEvent) {
  if (!engine.value || !scoreCanvas.value) return

  // Don't show ghost note preview in selection mode
  if (selectedTool.value === 'selection') {
    return
  }

  // IMPORTANT: Don't re-render while mouse button is down
  // This prevents the SVG elements from being replaced during a click,
  // which would cause the browser to not fire the click event
  if (isMouseButtonDown) {
    return
  }

  // Throttle preview updates for performance
  const now = Date.now()
  if (now - lastPreviewRender < PREVIEW_THROTTLE_MS) {
    return
  }
  lastPreviewRender = now

  // Get coordinates in SVG space using SVG's native coordinate transformation
  // This automatically handles padding, scroll, zoom, and any CSS transforms
  const svg = scoreCanvas.value.querySelector('svg')
  if (!svg) return

  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return

  const svgPoint = point.matrixTransform(ctm.inverse())
  const x = svgPoint.x
  const y = svgPoint.y

  // Render score with ghost note preview using selected duration and accidental
  const ghostNoteRendered = engine.value.renderScoreWithPreview(
    { x, y },
    selectedDuration.value,
    selectedAccidental.value || undefined
  )

  // Hide cursor when ghost note is shown, show cursor when it's not
  showCursor.value = !ghostNoteRendered
}

function handleCanvasMouseLeave() {
  if (!engine.value) return

  // Clear preview and render normal score
  renderScore()

  // Reset cursor visibility when leaving the canvas
  showCursor.value = true
}

</script>

<style>
/* Style ghost note preview elements */
.ghost-note-preview path,
.ghost-note-preview ellipse,
.ghost-note-preview circle {
  fill: #3B82F6 !important;
  stroke: #2563EB !important;
  opacity: 0.7 !important;
}

.ghost-note-preview line {
  stroke: #2563EB !important;
  opacity: 0.7 !important;
}

/* Style selected note elements */
.selected-note path,
.selected-note ellipse,
.selected-note circle {
  fill: #F59E0B !important;
  stroke: #D97706 !important;
}

.selected-note line {
  stroke: #D97706 !important;
}

/* Score container with rounded corners that work with scrollbars */
.score-container {
  /* Ensure scrollbar doesn't break rounded corners */
  scrollbar-gutter: stable;
}

/* Custom scrollbar styling to respect rounded corners */
.score-container::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.score-container::-webkit-scrollbar-track {
  background: #e2e8f0;
  border-radius: 0 8px 8px 0;
}

.score-container::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 6px;
}

.score-container::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.score-container::-webkit-scrollbar-corner {
  background: #e2e8f0;
  border-radius: 0 0 8px 0;
}
</style>
