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
            <button
              @click="setDuration('32')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedDuration === '32'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Thirty-second note (Fusa) - 0.125 beats"
            >
              𝅘𝅥𝅰
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

          <!-- Dot Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Dot:</span>
            <button
              @click="toggleDot"
              :class="[
                'px-3 py-1 rounded text-lg font-bold',
                selectedDots > 0
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Toggle dot (.) - adds 50% duration"
            >
              •
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
          @mousedown="handleCanvasMouseDown"
          @mousemove="handleCanvasMouseMove"
          @mouseup="handleCanvasMouseUp"
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
import { ShortcutManager } from './shortcuts'

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

// Dot selection (0 = no dot, 1 = dotted, 2 = double-dotted)
const selectedDots = ref<number>(0)

// Cursor visibility (hide when ghost note renders, show when it doesn't)
const showCursor = ref(true)

// Ghost note preview throttling
let lastPreviewRender = 0
const PREVIEW_THROTTLE_MS = 50 // Only update preview every 50ms

// Track last mouse position on canvas for ghost note rendering
let lastCanvasMousePosition: { x: number; y: number } | null = null

// Computed properties
const totalNotes = computed(() => engine.value?.getScore().measures.flatMap(m => m.notes).length || 0)
const scoreJSON = computed(() => engine.value?.exportJSON() || '{}')


// Debug: Track if we're in a render to detect race conditions
let isRendering = false
let lastRenderTime = 0

// Track mouse button state to prevent re-renders during click
let isMouseButtonDown = false

// Drag-to-change-pitch state
let isDraggingNote = false
let draggedNoteOriginalPitch: number | null = null
let dragStartTime: number | null = null
const DRAG_TIME_THRESHOLD_MS = 150 // Must hold mouse down this long before drag activates

// Keyboard shortcuts manager
const shortcutManager = new ShortcutManager()

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

    // Register keyboard shortcuts
    shortcutManager.registerActions({
      setEntryMode: () => {
        selectedTool.value = 'entry'
        selectedNoteId.value = null
        resetPaletteToDefaults()
        // Show ghost note at last known mouse position
        if (lastCanvasMousePosition && engine.value) {
          engine.value.renderScoreWithPreview(
            lastCanvasMousePosition,
            selectedDuration.value,
            selectedAccidental.value || undefined,
            selectedDots.value
          )
        }
      },
      setSelectionMode: () => {
        // If already in selection mode with a note selected, clear selection
        if (selectedTool.value === 'selection' && selectedNoteId.value) {
          selectedNoteId.value = null
          renderScore()
        } else {
          // Otherwise, switch to selection mode
          selectedTool.value = 'selection'
          renderScore() // Clear ghost note immediately
        }
      },
      deleteSelected: () => {
        if (selectedNoteId.value && engine.value) {
          engine.value.deleteNote(selectedNoteId.value)
          selectedNoteId.value = null
          renderScore()
        }
      },
      setDurationThirtySecond: () => setDuration('32'),
      setDurationSixteenth: () => setDuration('16'),
      setDurationEighth: () => setDuration('8'),
      setDurationQuarter: () => setDuration('q'),
      setDurationHalf: () => setDuration('h'),
      setDurationWhole: () => setDuration('w'),
      setAccidentalNatural: () => setAccidental('n'),
      setAccidentalSharp: () => setAccidental('#'),
      setAccidentalFlat: () => setAccidental('b'),
      selectNextNote: () => navigateSelection(1),
      selectPreviousNote: () => navigateSelection(-1),
      pitchUp: () => adjustPitch(1),
      pitchDown: () => adjustPitch(-1),
      octaveUp: () => adjustOctave(1),
      octaveDown: () => adjustOctave(-1),
      undo: () => {
        if (engine.value?.undo()) {
          renderScore()
          // Update selection state after undo
          if (selectedNoteId.value) {
            const note = engine.value.getNote(selectedNoteId.value)
            if (note) {
              // Sync palette with restored note state
              selectedDuration.value = note.duration
              selectedAccidental.value = note.accidental || null
              selectedDots.value = note.dots || 0
            } else {
              // Note no longer exists after undo
              selectedNoteId.value = null
            }
          }
        }
      },
      redo: () => {
        if (engine.value?.redo()) {
          renderScore()
          // Update selection state after redo
          if (selectedNoteId.value) {
            const note = engine.value.getNote(selectedNoteId.value)
            if (note) {
              // Sync palette with restored note state
              selectedDuration.value = note.duration
              selectedAccidental.value = note.accidental || null
              selectedDots.value = note.dots || 0
            } else {
              // Note no longer exists after redo
              selectedNoteId.value = null
            }
          }
        }
      },
      toggleDot,
    })
    shortcutManager.enable()

    // Initialize with empty measures
    initializeEmptyScore()
    renderScore()
  }
})

onUnmounted(() => {
  shortcutManager.disable()
  if (engine.value) {
    engine.value.dispose()
  }
})

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
  // Reset dots when changing duration
  selectedDots.value = 0
  // If a note is selected, update its duration (and remove dots)
  if (selectedNoteId.value && engine.value) {
    engine.value.updateNote(selectedNoteId.value, { duration, dots: 0 })
    renderScore()
  } else if (selectedTool.value === 'selection') {
    // Switch to entry mode when pressing duration in selection mode with nothing selected
    selectedTool.value = 'entry'
    if (lastCanvasMousePosition && engine.value) {
      engine.value.renderScoreWithPreview(
        lastCanvasMousePosition,
        duration,
        selectedAccidental.value || undefined,
        0
      )
    }
  }
}

function setAccidental(accidental: '#' | 'b' | 'n' | null) {
  // Toggle behavior: if same accidental is already selected, deselect it
  const newValue = selectedAccidental.value === accidental ? null : accidental
  selectedAccidental.value = newValue
  // If a note is selected, update its accidental
  if (selectedNoteId.value && engine.value) {
    engine.value.updateNote(selectedNoteId.value, { accidental: newValue || undefined })
    renderScore()
  } else if (selectedTool.value === 'selection') {
    // Switch to entry mode when pressing accidental in selection mode with nothing selected
    selectedTool.value = 'entry'
    if (lastCanvasMousePosition && engine.value) {
      engine.value.renderScoreWithPreview(
        lastCanvasMousePosition,
        selectedDuration.value,
        newValue || undefined,
        selectedDots.value
      )
    }
  } else if (selectedTool.value === 'entry' && lastCanvasMousePosition && engine.value) {
    // Re-render ghost note with new accidental
    engine.value.renderScoreWithPreview(
      lastCanvasMousePosition,
      selectedDuration.value,
      newValue || undefined,
      selectedDots.value
    )
  }
}

function toggleDot() {
  // Toggle between 0 (no dot) and 1 (dotted)
  const newValue = selectedDots.value > 0 ? 0 : 1
  selectedDots.value = newValue
  // If a note is selected, update its dots
  if (selectedNoteId.value && engine.value) {
    engine.value.updateNote(selectedNoteId.value, { dots: newValue })
    renderScore()
  } else if (selectedTool.value === 'selection') {
    // Switch to entry mode when pressing dot in selection mode with nothing selected
    selectedTool.value = 'entry'
    if (lastCanvasMousePosition && engine.value) {
      engine.value.renderScoreWithPreview(
        lastCanvasMousePosition,
        selectedDuration.value,
        selectedAccidental.value || undefined,
        newValue
      )
    }
  } else if (selectedTool.value === 'entry' && lastCanvasMousePosition && engine.value) {
    // Re-render ghost note with new dot
    engine.value.renderScoreWithPreview(
      lastCanvasMousePosition,
      selectedDuration.value,
      selectedAccidental.value || undefined,
      newValue
    )
  }
}

// Helper to select a note and sync palette to its properties
function selectNote(noteId: string | null) {
  selectedNoteId.value = noteId

  if (noteId && engine.value) {
    // Find the note in the score and sync palette
    const score = engine.value.getScore()
    for (const measure of score.measures) {
      const note = measure.notes.find(n => n.id === noteId)
      if (note) {
        // Sync duration palette (works for both notes and rests)
        selectedDuration.value = note.duration
        // Sync accidental palette (only relevant for notes, rests have no accidental)
        selectedAccidental.value = note.accidental || null
        // Sync dots palette
        selectedDots.value = note.dots || 0
        break
      }
    }
  }
}

// Navigate selection left/right by direction (-1 for previous, 1 for next)
function navigateSelection(direction: number) {
  // Only works in selection mode with something selected
  if (selectedTool.value !== 'selection' || !selectedNoteId.value || !engine.value) {
    return
  }

  const score = engine.value.getScore()

  // Build a sorted list of all notes/rests across all measures
  const allNotes = score.measures
    .flatMap(m => m.notes.map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) => {
      if (a.measureNumber !== b.measureNumber) {
        return a.measureNumber - b.measureNumber
      }
      return a.beat - b.beat
    })

  // Find current selection index
  const currentIndex = allNotes.findIndex(n => n.id === selectedNoteId.value)
  if (currentIndex === -1) return

  const newIndex = currentIndex + direction

  // If going past boundaries, deselect
  if (newIndex < 0 || newIndex >= allNotes.length) {
    selectNote(null)
    renderScore()
    return
  }

  const nextNote = allNotes[newIndex]
  if (nextNote) {
    selectNote(nextNote.id)
    renderScore()
    scrollSelectedNoteIntoView()
  }
}

// Adjust pitch of selected note by diatonic steps (up/down on staff)
function adjustPitch(direction: number) {
  // Only works in selection mode with a note selected (not rests)
  if (selectedTool.value !== 'selection' || !selectedNoteId.value || !engine.value) {
    return
  }

  // Find the selected note
  const score = engine.value.getScore()
  let selectedNote = null
  for (const measure of score.measures) {
    const note = measure.notes.find(n => n.id === selectedNoteId.value)
    if (note) {
      selectedNote = note
      break
    }
  }

  if (!selectedNote || selectedNote.isRest) {
    return // Can't change pitch of a rest
  }

  // Calculate new pitch moving diatonically (accidental is preserved automatically)
  const newPitch = movePitchDiatonically(selectedNote.pitch, direction)

  // Update the note (keeping the same accidental)
  engine.value.updateNote(selectedNoteId.value, { pitch: newPitch })
  renderScore()
}

// Adjust pitch of selected note by octave (12 semitones)
function adjustOctave(direction: number) {
  // Only works in selection mode with a note selected (not rests)
  if (selectedTool.value !== 'selection' || !selectedNoteId.value || !engine.value) {
    return
  }

  // Find the selected note
  const score = engine.value.getScore()
  let selectedNote = null
  for (const measure of score.measures) {
    const note = measure.notes.find(n => n.id === selectedNoteId.value)
    if (note) {
      selectedNote = note
      break
    }
  }

  if (!selectedNote || selectedNote.isRest) {
    return // Can't change pitch of a rest
  }

  // Move by one octave (12 semitones)
  const newPitch = selectedNote.pitch + (direction * 12)

  // Update the note (keeping the same accidental)
  engine.value.updateNote(selectedNoteId.value, { pitch: newPitch })
  renderScore()
}

// Move pitch by one diatonic step (C, D, E, F, G, A, B) preserving accidental
// Note: In this system, 'pitch' is the STAFF POSITION (the natural note line/space),
// and accidentals modify the sounding pitch. This function only moves the staff position.
function movePitchDiatonically(pitch: number, direction: number): number {
  // The pitch IS the staff position (natural note), accidentals don't affect it
  const staffPosition = pitch

  // Get the octave and semitone within octave
  const octave = Math.floor(staffPosition / 12)
  const semitone = ((staffPosition % 12) + 12) % 12 // Handle negative values

  // Diatonic note semitones within octave: C=0, D=2, E=4, F=5, G=7, A=9, B=11
  const diatonicSemitones = [0, 2, 4, 5, 7, 9, 11]

  // Find which diatonic note we're on
  let diatonicIndex = diatonicSemitones.indexOf(semitone)
  if (diatonicIndex === -1) {
    // Staff position is on a black key - this shouldn't normally happen
    // but handle it by rounding to nearest diatonic note
    for (let i = 0; i < diatonicSemitones.length; i++) {
      if (diatonicSemitones[i] > semitone) {
        diatonicIndex = direction > 0 ? i : i - 1
        break
      }
    }
    if (diatonicIndex === -1) diatonicIndex = 6 // B
  }

  // Move diatonically
  let newDiatonicIndex = diatonicIndex + direction
  let newOctave = octave

  if (newDiatonicIndex > 6) {
    newDiatonicIndex = 0
    newOctave++
  } else if (newDiatonicIndex < 0) {
    newDiatonicIndex = 6
    newOctave--
  }

  // Convert back to staff position
  const newSemitone = diatonicSemitones[newDiatonicIndex]
  return newOctave * 12 + newSemitone
}

// Scroll the canvas so the selected note is visible
function scrollSelectedNoteIntoView() {
  if (!engine.value || !scoreCanvas.value || !selectedNoteId.value) return

  const elementInfo = engine.value.getElementById(selectedNoteId.value)
  if (!elementInfo) return

  const container = scoreCanvas.value
  const bbox = elementInfo.bbox

  // Add some padding around the element
  const padding = 50

  // Calculate scroll positions to center the element (or at least make it visible)
  const containerRect = container.getBoundingClientRect()

  // Check if element is outside visible horizontal area
  const elementLeft = bbox.x
  const elementRight = bbox.x + bbox.width
  const visibleLeft = container.scrollLeft
  const visibleRight = container.scrollLeft + containerRect.width

  if (elementLeft < visibleLeft + padding) {
    // Element is to the left of visible area
    container.scrollLeft = Math.max(0, elementLeft - padding)
  } else if (elementRight > visibleRight - padding) {
    // Element is to the right of visible area
    container.scrollLeft = elementRight - containerRect.width + padding
  }

  // Check if element is outside visible vertical area
  const elementTop = bbox.y
  const elementBottom = bbox.y + bbox.height
  const visibleTop = container.scrollTop
  const visibleBottom = container.scrollTop + containerRect.height

  if (elementTop < visibleTop + padding) {
    // Element is above visible area
    container.scrollTop = Math.max(0, elementTop - padding)
  } else if (elementBottom > visibleBottom - padding) {
    // Element is below visible area
    container.scrollTop = elementBottom - containerRect.height + padding
  }
}

// Reset palette to defaults (for entry mode)
function resetPaletteToDefaults() {
  selectedDuration.value = 'q'
  selectedAccidental.value = null
  selectedDots.value = 0
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

  // Get the selected element's info from ElementRegistry
  const elementInfo = engine.value.getElementById(selectedNoteId.value)
  if (!elementInfo) {
    // Element was deleted or no longer exists
    selectedNoteId.value = null
    return
  }

  // Get SVG element
  const svg = scoreCanvas.value.querySelector('svg')
  if (!svg) return

  const SELECTION_COLOR = '#F59E0B'
  const SELECTION_STROKE = '#D97706'

  // Get the element's data from the score model
  const score = engine.value.getScore()
  let notePitch: number | null = null
  let noteMeasure: number | null = null
  let isRest = false

  for (const measure of score.measures) {
    const element = measure.notes.find(n => n.id === selectedNoteId.value)
    if (element) {
      noteMeasure = element.measure
      isRest = element.isRest || false
      if (!element.isRest) {
        notePitch = element.pitch
      }
      break
    }
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

  console.log('Highlight debug:', { notePitch, noteMeasure, targetY, isRest, bbox, selectBbox })

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
          n => !n.isRest && n.beat === noteData.beat
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

        // For chords, we need extra filtering to only highlight the specific note
        if (isInChord && targetY !== null) {
          const elCenterY = elBBox.y + elBBox.height / 2

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

function handleCanvasMouseDown(event: MouseEvent) {
  if (!engine.value || !scoreCanvas.value) return

  // Only handle in selection mode
  if (selectedTool.value !== 'selection') return

  // Get SVG coordinates
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

  const registry = engine.value.getElementRegistry()
  const measureNum = engine.value.pixelToMeasure({ x, y })

  // Find closest element to select
  const closestElement = registry.findClosestNoteOrRest(x, y, measureNum)

  if (closestElement && closestElement.id) {
    const bbox = closestElement.bbox
    const centerX = bbox.x + bbox.width / 2

    // For notes in chords, use pitch-based Y position
    // For rests, use bbox center
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
      selectedNoteId.value = null
      console.log('Selection cleared (too far from element)')
      renderScore()
    }
  } else {
    // Clicked on empty space - clear selection
    selectedNoteId.value = null
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
  if (selectedTool.value === 'selection') {
    return
  }

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

  // Entry mode: add note at position
  try {
    const note = engine.value.addNoteAtPosition(
      { x, y },
      selectedDuration.value,
      selectedAccidental.value || undefined,
      selectedDots.value || undefined
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

function handleCanvasMouseMove(event: MouseEvent) {
  if (!engine.value || !scoreCanvas.value) return

  // Get SVG coordinates (needed for both drag and ghost note preview)
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

    // Get the measure of the selected note
    const score = engine.value.getScore()
    let selectedNote = null
    for (const measure of score.measures) {
      const note = measure.notes.find(n => n.id === selectedNoteId.value)
      if (note) {
        selectedNote = note
        break
      }
    }

    if (selectedNote && !selectedNote.isRest) {
      // Calculate what pitch the cursor is at
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

  // Render score with ghost note preview using selected duration, accidental, and dots
  const ghostNoteRendered = engine.value.renderScoreWithPreview(
    { x, y },
    selectedDuration.value,
    selectedAccidental.value || undefined,
    selectedDots.value
  )

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
.selected-note circle,
.selected-note rect {
  fill: #F59E0B !important;
  stroke: #D97706 !important;
}

.selected-note line {
  stroke: #D97706 !important;
}

/* Force notehead fill color (VexFlow uses inline styles) */
.selected-note [fill="black"],
.selected-note [fill="#000"],
.selected-note [fill="#000000"] {
  fill: #F59E0B !important;
}

/* Score container with rounded corners that work with scrollbars */
.score-container {
  /* Ensure scrollbar doesn't break rounded corners */
  scrollbar-gutter: stable;
  /* Prevent browser text selection from affecting the canvas */
  user-select: none;
  -webkit-user-select: none;
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
