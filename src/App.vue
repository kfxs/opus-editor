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

          <!-- Tuplet Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Tuplet:</span>
            <button
              @click="toggleTuplet"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                tupletMode
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Toggle triplet mode (T) - creates 3 notes in space of 2"
            >
              3
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
import { durationToBeats } from './utils/musicUtils'

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

// Tuplet mode (for creating triplets)
const tupletMode = ref<boolean>(false)

// Selected tuplet ID (for tuplet selection/deletion)
const selectedTupletId = ref<string | null>(null)

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
        if (lastCanvasMousePosition) renderPreview(lastCanvasMousePosition)
      },
      enterEntryFromSelection: () => {
        // Only acts when in selection mode with a note selected
        if (selectedTool.value !== 'selection' || !selectedNoteId.value) return
        selectedTool.value = 'entry'
        renderScore()
      },
      setSelectionMode: () => {
        if (selectedTool.value === 'entry') {
          // Exit entry mode → back to selection, keep current note selected
          selectedTool.value = 'selection'
          renderScore()
        } else if (selectedTool.value === 'selection' && selectedNoteId.value) {
          // If already in selection mode with a note selected, clear selection
          selectedNoteId.value = null
          renderScore()
        } else {
          // Otherwise, switch to selection mode
          selectedTool.value = 'selection'
          renderScore() // Clear ghost note immediately
        }
      },
      deleteSelected: () => {
        if (selectedTupletId.value && engine.value) {
          // Delete selected tuplet
          engine.value.deleteTuplet(selectedTupletId.value)
          selectedTupletId.value = null
          renderScore()
        } else if (selectedNoteId.value && engine.value) {
          // Delete selected note
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
      selectNextNote: () => {
        if (selectedTool.value === 'entry') {
          // Right arrow: exit keyboard mode and land on the note AT the cursor
          // (the next beat after the last edited note)
          selectedTool.value = 'selection'
          navigateSelection(1)
        } else {
          navigateSelection(1)
        }
      },
      selectPreviousNote: () => {
        if (selectedTool.value === 'entry') {
          // Left arrow: exit keyboard mode and land on the note to the LEFT of the cursor
          // (the last edited note — already selectedNoteId, no movement needed)
          selectedTool.value = 'selection'
          renderScore()
        } else {
          navigateSelection(-1)
        }
      },
      chordNoteUp: () => navigateChord(1),
      chordNoteDown: () => navigateChord(-1),
      pitchUp: () => adjustPitch(1),
      pitchDown: () => adjustPitch(-1),
      octaveUp: () => adjustOctave(1),
      octaveDown: () => adjustOctave(-1),
      undo: () => {
        if (engine.value?.undo()) {
          const restoredId = engine.value.getLastRestoredNoteId()
          selectedNoteId.value = restoredId && engine.value.getNote(restoredId) ? restoredId : null
          renderScore()
          if (selectedNoteId.value) {
            const note = engine.value.getNote(selectedNoteId.value)!
            selectedDuration.value = note.duration
            selectedAccidental.value = note.accidental || null
            selectedDots.value = note.dots || 0
          }
        }
      },
      redo: () => {
        if (engine.value?.redo()) {
          const restoredId = engine.value.getLastRestoredNoteId()
          selectedNoteId.value = restoredId && engine.value.getNote(restoredId) ? restoredId : null
          renderScore()
          if (selectedNoteId.value) {
            const note = engine.value.getNote(selectedNoteId.value)!
            selectedDuration.value = note.duration
            selectedAccidental.value = note.accidental || null
            selectedDots.value = note.dots || 0
          }
        }
      },
      toggleDot,
      toggleTuplet,
      enterNoteA: () => enterNoteByLetter('a'),
      enterNoteB: () => enterNoteByLetter('b'),
      enterNoteC: () => enterNoteByLetter('c'),
      enterNoteD: () => enterNoteByLetter('d'),
      enterNoteE: () => enterNoteByLetter('e'),
      enterNoteF: () => enterNoteByLetter('f'),
      enterNoteG: () => enterNoteByLetter('g'),
      enterRest: () => enterRestAtCursorPosition(),
      addChordA: () => addChordNoteByLetter('a'),
      addChordB: () => addChordNoteByLetter('b'),
      addChordC: () => addChordNoteByLetter('c'),
      addChordD: () => addChordNoteByLetter('d'),
      addChordE: () => addChordNoteByLetter('e'),
      addChordF: () => addChordNoteByLetter('f'),
      addChordG: () => addChordNoteByLetter('g'),
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
  // Clear tuplet mode when changing duration - user likely wants a new note value
  tupletMode.value = false
  // If a note is selected in selection mode, update its duration (and remove dots)
  if (selectedNoteId.value && engine.value && selectedTool.value === 'selection') {
    engine.value.updateNote(selectedNoteId.value, { duration, dots: 0 })
    renderScore()
  } else if (selectedTool.value === 'selection') {
    // Switch to entry mode when pressing duration in selection mode with nothing selected
    selectedTool.value = 'entry'
    if (lastCanvasMousePosition) renderPreview(lastCanvasMousePosition)
  }
}

function setAccidental(accidental: '#' | 'b' | 'n' | null) {
  // Toggle behavior: if same accidental is already selected, deselect it
  const newValue = selectedAccidental.value === accidental ? null : accidental
  selectedAccidental.value = newValue
  // If a note is selected in selection mode, update its accidental
  if (selectedNoteId.value && engine.value && selectedTool.value === 'selection') {
    engine.value.updateNote(selectedNoteId.value, { accidental: newValue || undefined })
    renderScore()
  } else if (selectedTool.value === 'selection') {
    // Switch to entry mode when pressing accidental in selection mode with nothing selected
    selectedTool.value = 'entry'
    if (lastCanvasMousePosition) renderPreview(lastCanvasMousePosition)
  } else if (selectedTool.value === 'entry' && lastCanvasMousePosition) {
    // Re-render ghost note with new accidental
    renderPreview(lastCanvasMousePosition)
  }
}

function toggleDot() {
  // Toggle between 0 (no dot) and 1 (dotted)
  const newValue = selectedDots.value > 0 ? 0 : 1
  selectedDots.value = newValue
  // If a note is selected in selection mode, update its dots
  if (selectedNoteId.value && engine.value && selectedTool.value === 'selection') {
    engine.value.updateNote(selectedNoteId.value, { dots: newValue })
    renderScore()
  } else if (selectedTool.value === 'selection') {
    // Switch to entry mode when pressing dot in selection mode with nothing selected
    selectedTool.value = 'entry'
    if (lastCanvasMousePosition) renderPreview(lastCanvasMousePosition)
  } else if (selectedTool.value === 'entry' && lastCanvasMousePosition) {
    // Re-render ghost note with new dot
    renderPreview(lastCanvasMousePosition)
  }
}

function toggleTuplet() {
  // Toggle tuplet mode on/off
  tupletMode.value = !tupletMode.value
  // Disable dots when enabling tuplet mode (tuplets don't use dots)
  if (tupletMode.value) {
    selectedDots.value = 0
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

// Navigate selection left/right by direction (-1 for previous, 1 for next).
// Chords are treated as a single unit — horizontal navigation moves between
// beats, not between individual chord notes (use Alt+ArrowUp/Down for that).
// Landing on a chord always selects its lowest-pitch note.
function navigateSelection(direction: number) {
  if (selectedTool.value !== 'selection' || !selectedNoteId.value || !engine.value) return

  const score = engine.value.getScore()

  // Build one representative per beat: lowest non-rest note, or the rest itself.
  // This collapses chords into a single entry so horizontal nav skips them as a unit.
  const beatMap = new Map<string, typeof allFlat[0]>()
  const allFlat = score.measures
    .flatMap(m => m.notes.map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber
        ? a.measureNumber - b.measureNumber
        : a.beat - b.beat
    )

  for (const n of allFlat) {
    const key = `${n.measureNumber}:${n.beat}`
    const existing = beatMap.get(key)
    if (!existing) {
      beatMap.set(key, n)
    } else if (!n.isRest && (existing.isRest || n.pitch < existing.pitch)) {
      // Prefer non-rest; among non-rests prefer the lowest pitch
      beatMap.set(key, n)
    }
  }

  const beats = Array.from(beatMap.values())

  // Find the beat group the current selection belongs to
  const currentNote = allFlat.find(n => n.id === selectedNoteId.value)
  if (!currentNote) return
  const currentKey = `${currentNote.measureNumber}:${currentNote.beat}`
  const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat}` === currentKey)
  if (currentIndex === -1) return

  const newIndex = currentIndex + direction

  // Past boundaries → deselect
  if (newIndex < 0 || newIndex >= beats.length) {
    selectNote(null)
    renderScore()
    return
  }

  selectNote(beats[newIndex].id)
  renderScore()
  scrollSelectedNoteIntoView()
}

// Navigate within a chord by pitch (Shift+ArrowUp/Down).
// Moves selection to the next higher or lower note at the same beat.
// Clamped: stays on the top/bottom note instead of wrapping.
function navigateChord(direction: number) {
  if (selectedTool.value !== 'selection' || !selectedNoteId.value || !engine.value) return

  const note = engine.value.getNote(selectedNoteId.value)
  if (!note || note.isRest) return

  const score = engine.value.getScore()
  const measure = score.measures.find(m => m.number === note.measure)
  if (!measure) return

  // All non-rest notes at the same beat, sorted low → high
  const chordNotes = measure.notes
    .filter(n => !n.isRest && Math.abs(n.beat - note.beat) < 0.001)
    .sort((a, b) => a.pitch - b.pitch)

  if (chordNotes.length <= 1) return

  const currentIndex = chordNotes.findIndex(n => n.id === selectedNoteId.value)
  if (currentIndex === -1) return

  const newIndex = Math.max(0, Math.min(chordNotes.length - 1, currentIndex + direction))
  if (newIndex === currentIndex) return

  selectNote(chordNotes[newIndex].id)
  renderScore()
}

// Adjust pitch of selected note by diatonic steps (up/down on staff)
function adjustPitch(direction: number) {
  // Works in selection and entry mode with a note selected (not rests)
  if ((selectedTool.value !== 'selection' && selectedTool.value !== 'entry') || !selectedNoteId.value || !engine.value) {
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
  // Works in selection and entry mode with a note selected (not rests)
  if ((selectedTool.value !== 'selection' && selectedTool.value !== 'entry') || !selectedNoteId.value || !engine.value) {
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

// Get a reference pitch from neighboring notes for octave context.
// Returns the average pitch of the nearest prev/next non-rest notes,
// or just one neighbor if only one exists, or 60 (C4) if there are none.
function getContextPitch(): number {
  if (!engine.value || !selectedNoteId.value) return 60

  const score = engine.value.getScore()
  const allNotes = score.measures
    .flatMap(m => m.notes.map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber
        ? a.measureNumber - b.measureNumber
        : a.beat - b.beat
    )

  const currentIndex = allNotes.findIndex(n => n.id === selectedNoteId.value)
  if (currentIndex === -1) return 60

  let prevPitch: number | null = null
  let nextPitch: number | null = null

  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!allNotes[i].isRest) { prevPitch = allNotes[i].pitch; break }
  }
  for (let i = currentIndex + 1; i < allNotes.length; i++) {
    if (!allNotes[i].isRest) { nextPitch = allNotes[i].pitch; break }
  }

  if (prevPitch !== null && nextPitch !== null) return Math.round((prevPitch + nextPitch) / 2)
  if (prevPitch !== null) return prevPitch
  if (nextPitch !== null) return nextPitch
  return 60 // default: middle C octave
}

// Enter a note by letter key (a-g).
// In selection mode: edits the selected note in place and enters keyboard mode.
// In keyboard mode: overwrites the note at the cursor position and advances the cursor.
function enterNoteByLetter(letter: string) {
  if (!selectedNoteId.value || !engine.value) return
  if (selectedTool.value !== 'selection' && selectedTool.value !== 'entry') return

  const letterToPitchClass: Record<string, number> = {
    c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
  }
  const pitchClass = letterToPitchClass[letter]
  if (pitchClass === undefined) return

  if (selectedTool.value === 'entry') {
    enterNoteAtCursorPosition(pitchClass)
    return
  }

  // Selection mode: edit in place, then switch to keyboard mode
  const reference = getContextPitch()
  const k = Math.round((reference - pitchClass) / 12)
  const targetPitch = pitchClass + 12 * k

  engine.value.updateNote(selectedNoteId.value, {
    pitch: targetPitch,
    isRest: false,
    accidental: selectedAccidental.value || undefined,
  })

  selectedTool.value = 'entry'
  renderScore()
}

// Place a note at the cursor position (the beat after selectedNoteId) using the current palette.
// Overwrites whatever is there — notes or rests — filling leftover space with rests.
// Handles measure overflow the same way mouse entry does (tie splitting across barlines).
// Advances selectedNoteId to the newly placed note.
function enterNoteAtCursorPosition(pitchClass: number) {
  if (!selectedNoteId.value || !engine.value) return

  const score = engine.value.getScore()

  // Build sorted beat list (same logic as navigateSelection / applyKeyboardCursor)
  const allFlat = score.measures
    .flatMap(m => m.notes.map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber ? a.measureNumber - b.measureNumber : a.beat - b.beat
    )
  const beatMap = new Map<string, typeof allFlat[0]>()
  for (const n of allFlat) {
    const key = `${n.measureNumber}:${n.beat}`
    const existing = beatMap.get(key)
    if (!existing) {
      beatMap.set(key, n)
    } else if (!n.isRest && (existing.isRest || n.pitch < existing.pitch)) {
      beatMap.set(key, n)
    }
  }
  const beats = Array.from(beatMap.values())

  // Find the cursor position: the next beat after the currently selected note
  const currentNote = allFlat.find(n => n.id === selectedNoteId.value)
  if (!currentNote) {
    console.log('[Keyboard] enterNoteAtCursorPosition: currentNote not found for id', selectedNoteId.value)
    return
  }
  const currentKey = `${currentNote.measureNumber}:${currentNote.beat}`
  const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat}` === currentKey)
  if (currentIndex === -1) {
    console.log('[Keyboard] enterNoteAtCursorPosition: beat not found in beatMap for key', currentKey)
    return
  }

  const nextBeat = beats[currentIndex + 1]
  if (!nextBeat) {
    console.log('[Keyboard] enterNoteAtCursorPosition: cursor is at end of score, nowhere to place note')
    return
  }

  const targetMeasure = nextBeat.measureNumber
  const targetBeat = nextBeat.beat

  // Octave: choose the one closest to the note we just entered
  const reference = (!currentNote.isRest) ? currentNote.pitch : getContextPitch()
  const k = Math.round((reference - pitchClass) / 12)
  const targetPitch = pitchClass + 12 * k

  const newDurationBeats = durationToBeats(selectedDuration.value, selectedDots.value)

  console.log(`[Keyboard] Entering note: pitchClass=${pitchClass} pitch=${targetPitch} dur=${selectedDuration.value} dots=${selectedDots.value} (${newDurationBeats} beats) at measure=${targetMeasure} beat=${targetBeat}`)

  const measure = score.measures.find(m => m.number === targetMeasure)
  if (!measure) return

  // Place the new note — addNoteAtBeat handles overlap removal, overflow (tie split) and gap filling
  const newNote = engine.value.addNoteAtBeat({
    pitch: targetPitch,
    duration: selectedDuration.value,
    measure: targetMeasure,
    beat: targetBeat,
    accidental: selectedAccidental.value || undefined,
    dots: selectedDots.value || undefined,
    isRest: false,
  })

  if (!newNote) {
    console.log('[Keyboard] addNoteAtBeat returned null — placement failed')
    renderScore()
    return
  }

  console.log(`[Keyboard] Note placed: id=${newNote.id} pitch=${newNote.pitch} dur=${newNote.duration} measure=${newNote.measure} beat=${newNote.beat}`)

  // Follow the tie chain to the last note — the cursor must land after all tied continuations,
  // not just the first segment (e.g. half note split across barline → cursor after measure 3 note)
  let lastNote = newNote
  const scoreAfter = engine.value.getScore()
  let safetyLimit = 16
  while (lastNote.tiedTo && safetyLimit-- > 0) {
    const tied = scoreAfter.measures.flatMap(m => m.notes).find(n => n.id === lastNote.tiedTo)
    if (!tied) break
    lastNote = tied
  }
  if (lastNote.id !== newNote.id) {
    console.log(`[Keyboard] Tie chain: cursor advanced to last tied note id=${lastNote.id} measure=${lastNote.measure} beat=${lastNote.beat}`)
  }

  setSelectedNote(lastNote.id)
  // In keyboard mode, accidentals are one-shot — clear after each entry
  selectedAccidental.value = null
  renderScore()
}

// Enter a rest at the cursor position using the current palette duration.
// Only active in keyboard mode. Advances the cursor like note entry does.
function enterRestAtCursorPosition() {
  if (selectedTool.value !== 'entry' || !selectedNoteId.value || !engine.value) return

  const score = engine.value.getScore()
  const epsilon = 0.001

  const allFlat = score.measures
    .flatMap(m => m.notes.map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber ? a.measureNumber - b.measureNumber : a.beat - b.beat
    )
  const beatMap = new Map<string, typeof allFlat[0]>()
  for (const n of allFlat) {
    const key = `${n.measureNumber}:${n.beat}`
    const existing = beatMap.get(key)
    if (!existing) {
      beatMap.set(key, n)
    } else if (!n.isRest && (existing.isRest || n.pitch < existing.pitch)) {
      beatMap.set(key, n)
    }
  }
  const beats = Array.from(beatMap.values())

  const currentNote = allFlat.find(n => n.id === selectedNoteId.value)
  if (!currentNote) return
  const currentKey = `${currentNote.measureNumber}:${currentNote.beat}`
  const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat}` === currentKey)
  if (currentIndex === -1) return

  const nextBeat = beats[currentIndex + 1]
  if (!nextBeat) {
    console.log('[Keyboard] enterRestAtCursorPosition: cursor is at end of score')
    return
  }

  const targetMeasure = nextBeat.measureNumber
  const targetBeat = nextBeat.beat
  const newDurationBeats = durationToBeats(selectedDuration.value, selectedDots.value)

  // Rests don't tie across barlines — cap to available space in the measure
  const measureData = score.measures.find(m => m.number === targetMeasure)
  if (!measureData) return
  const measureTotalBeats = measureData.timeSignature.numerator * (4 / measureData.timeSignature.denominator)
  const availableBeats = measureTotalBeats - targetBeat
  const actualDurationBeats = Math.min(newDurationBeats, availableBeats)
  // Find the largest standard duration that fits
  const durations: Array<{ dur: typeof selectedDuration.value; beats: number }> = [
    { dur: 'w', beats: 4 }, { dur: 'h', beats: 2 }, { dur: 'q', beats: 1 },
    { dur: '8', beats: 0.5 }, { dur: '16', beats: 0.25 }, { dur: '32', beats: 0.125 },
  ]
  const fittingDur = durations.find(d => d.beats <= actualDurationBeats + 0.001) ?? { dur: selectedDuration.value, beats: newDurationBeats }

  console.log(`[Keyboard] Entering rest: dur=${fittingDur.dur} (${fittingDur.beats} beats) at measure=${targetMeasure} beat=${targetBeat}${fittingDur.dur !== selectedDuration.value ? ` (capped from ${selectedDuration.value})` : ''}`)

  // addNoteAtBeat handles overlap removal atomically
  const newRest = engine.value.addNoteAtBeat({
    pitch: 0,
    duration: fittingDur.dur,
    measure: targetMeasure,
    beat: targetBeat,
    isRest: true,
  })

  if (!newRest) {
    console.log('[Keyboard] addNoteAtBeat returned null for rest')
    renderScore()
    return
  }

  console.log(`[Keyboard] Rest placed: id=${newRest.id} dur=${newRest.duration} measure=${newRest.measure} beat=${newRest.beat}`)
  setSelectedNote(newRest.id)
  renderScore()
}

// Add a note to the chord at the selected note's position (Shift + letter key).
// The new note's pitch is >= the selected note's pitch (same octave or higher).
// If a rest is selected, falls back to enterNoteByLetter (single note replacement).
function addChordNoteByLetter(letter: string) {
  if (!selectedNoteId.value || !engine.value) return
  if (selectedTool.value !== 'selection' && selectedTool.value !== 'entry') return

  const letterToPitchClass: Record<string, number> = {
    c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
  }
  const pitchClass = letterToPitchClass[letter]
  if (pitchClass === undefined) return

  const note = engine.value.getNote(selectedNoteId.value)
  if (!note) return

  // If a rest is selected, just enter a single note as normal
  if (note.isRest) {
    enterNoteByLetter(letter)
    return
  }

  // Use the highest pitch already in the chord as the anchor, so each new
  // note lands above ALL existing chord notes, not just the selected one.
  const score = engine.value.getScore()
  const measure = score.measures.find(m => m.number === note.measure)
  const chordPitches = (measure?.notes ?? [])
    .filter(n => !n.isRest && Math.abs(n.beat - note.beat) < 0.001)
    .map(n => n.pitch)
  const basePitch = chordPitches.length > 0 ? Math.max(...chordPitches) : note.pitch

  const k = Math.ceil((basePitch - pitchClass) / 12)
  let targetPitch = pitchClass + 12 * k

  // If equal to basePitch it would be a duplicate — go up one octave
  if (targetPitch === basePitch) targetPitch += 12

  const newNote = engine.value.addChordNote({
    pitch: targetPitch,
    duration: note.duration,
    measure: note.measure,
    beat: note.beat,
    accidental: selectedAccidental.value || undefined,
    dots: note.dots,
    isRest: false,
    tupletId: note.tupletId,
  })
  setSelectedNote(newNote.id)
  renderScore()
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

function setSelectedNote(id: string | null) {
  selectedNoteId.value = id
  if (engine.value) engine.value.updateUndoNoteId(id)
}

function renderScore() {
  if (!engine.value) return
  isRendering = true
  engine.value.clearCanvas()
  engine.value.renderScore()
  isRendering = false
  lastRenderTime = Date.now()

  // Apply selection highlights
  applySelectionHighlight()
  applyTupletSelectionHighlight()
  applyKeyboardCursor()
}

function renderPreview(coords: { x: number; y: number }) {
  if (!engine.value) return
  engine.value.renderScoreWithPreview(
    coords,
    selectedDuration.value,
    selectedAccidental.value || undefined,
    selectedDots.value
  )
  applySelectionHighlight()
  applyTupletSelectionHighlight()
  applyKeyboardCursor()
}

// Draw a vertical cursor line on the staff AFTER the currently selected note,
// indicating where the next keyboard entry will land.
// The cursor signals that keyboard entry mode is active (like Sibelius's blue cursor).
function applyKeyboardCursor() {
  if (selectedTool.value !== 'entry' || !selectedNoteId.value || !engine.value || !scoreCanvas.value) return

  const svg = scoreCanvas.value.querySelector('svg')
  if (!svg) return

  const score = engine.value.getScore()
  const registry = engine.value.getElementRegistry()

  // Build a flat sorted list of one representative note per beat (same logic as navigateSelection)
  const beatMap = new Map<string, { id: string; measureNumber: number; beat: number }>()
  const allFlat = score.measures
    .flatMap(m => m.notes.map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber ? a.measureNumber - b.measureNumber : a.beat - b.beat
    )
  for (const n of allFlat) {
    const key = `${n.measureNumber}:${n.beat}`
    const existing = beatMap.get(key)
    if (!existing) {
      beatMap.set(key, n)
    } else if (!n.isRest && (existing.isRest || n.pitch < existing.pitch)) {
      beatMap.set(key, n)
    }
  }
  const beats = Array.from(beatMap.values())

  // Find the current note's position in the beat list
  const currentNote = allFlat.find(n => n.id === selectedNoteId.value)
  if (!currentNote) return
  const currentKey = `${currentNote.measureNumber}:${currentNote.beat}`
  const currentIndex = beats.findIndex(n => `${n.measureNumber}:${n.beat}` === currentKey)
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
        const elCenterX = elBBox.x + elBBox.width / 2
        const elCenterY = elBBox.y + elBBox.height / 2

        // Skip tuplet bracket elements (the "3" number) when selecting notes
        // For text elements in measures with tuplets, only include elements very close
        // to the notehead Y position. Noteheads are rendered at exactly targetY,
        // while tuplet numbers are always offset (above or below).
        // Use a tight threshold (~8px) to only include the notehead glyph itself.
        if (hasTupletsInMeasure && el.tagName === 'text' && targetY !== null) {
          const distanceFromNotehead = Math.abs(elCenterY - targetY)
          // Noteheads are rendered at exactly targetY (distance ~0)
          // Accidentals are also close (~5px horizontal offset, same Y)
          // Tuplet numbers are always offset vertically (14px+ when bracket above, 35px+ when below)
          if (distanceFromNotehead > 8) {
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

function applyTupletSelectionHighlight() {
  if (!engine.value || !scoreCanvas.value || !selectedTupletId.value) return

  // Get the tuplet element's info from ElementRegistry
  const elementInfo = engine.value.getTupletElementById(selectedTupletId.value)
  if (!elementInfo) {
    // Tuplet was deleted or no longer exists
    selectedTupletId.value = null
    return
  }

  // Get SVG element
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

    // Calculate element's center
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

  // Find closest note/rest element first
  const closestElement = registry.findClosestNoteOrRest(x, y, measureNum)

  // Check if clicking on a tuplet bracket (but prioritize notes over tuplets)
  const tupletAtClick = registry.getTupletAt(x, y, measureNum)

  // If click is inside a tuplet bbox, decide between selecting note or tuplet
  // based on VERTICAL distance to noteheads (not total distance, since notes spread horizontally)
  if (tupletAtClick && tupletAtClick.tupletId) {
    // Get Y positions of all notes in this tuplet
    const tupletNotes = registry.getNotesByTupletId(tupletAtClick.tupletId)
    let minVerticalDistance = Infinity
    const noteYPositions: number[] = []

    for (const note of tupletNotes) {
      if (note.pitch !== undefined) {
        const noteY = registry.pitchToPixelY(note.pitch, measureNum)
        if (noteY !== null) {
          noteYPositions.push(noteY)
          const verticalDistance = Math.abs(y - noteY)
          minVerticalDistance = Math.min(minVerticalDistance, verticalDistance)
        }
      }
    }

    // If click Y is far from all noteheads (>12px), select the tuplet
    // This means clicking on the bracket/number area (above or below notes)
    // 12px is roughly half a staff line spacing, covers the notehead height
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

  // Entry mode: add note or tuplet at position
  try {
    if (tupletMode.value) {
      // Tuplet mode: check if clicking inside an existing tuplet first
      // If so, add a note to that tuplet instead of creating a new one
      const score = engine.value.getScore()
      const measure = score.measures.find(m => m.number === measureNum)
      const beatsInMeasure = measure
        ? (4 / measure.timeSignature.denominator) * measure.timeSignature.numerator
        : 4
      const position = engine.value.pixelToPosition({ x, y }, beatsInMeasure)
      const existingTuplet = engine.value.getTupletAtBeat(measureNum, position.beat)

      if (existingTuplet) {
        // Clicking inside an existing tuplet - add a note instead of creating a new tuplet
        console.log(`Tuplet mode: clicking inside existing tuplet at beat ${position.beat.toFixed(3)}, adding note instead`)
        const note = engine.value.addNoteAtPosition(
          { x, y },
          selectedDuration.value,
          selectedAccidental.value || undefined,
          selectedDots.value || undefined
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
        // Get pitch from Y coordinate
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
        selectedDots.value || undefined
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

  applySelectionHighlight()
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
