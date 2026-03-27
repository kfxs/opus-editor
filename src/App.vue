<template>
  <div class="min-h-screen bg-gray-900 text-white p-8">
    <h1 class="text-4xl font-bold mb-8">Opus Score Editor</h1>

    <div class="mb-8">
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="mb-4 flex gap-2 flex-wrap">
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

          <!-- Articulations -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Articulation:</span>
            <button
              @click="toggleAccent"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedNoteHasAccent
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Accent (Numpad /)"
            >
              &gt;
            </button>
            <button
              @click="toggleStaccato"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedNoteHasStaccato
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Staccato (Numpad *)"
            >
              •
            </button>
            <button
              @click="toggleTenuto"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedNoteHasTenuto
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Tenuto (Numpad -)"
            >
              —
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

          <!-- Tie -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Tie:</span>
            <button
              @click="toggleTie"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                selectedNoteHasTie
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Toggle tie to next note of same pitch (Numpad Enter)"
            >
              ⌒
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
import { ref, shallowRef, computed, onMounted, onUnmounted } from 'vue'
import { MusicEngine } from './engine/MusicEngine'
import type { PlaybackPosition } from './engine/audio/PlaybackEngine'
import { usePalette } from './composables/usePalette'
import { useSelection } from './composables/useSelection'
import { useKeyboardEntry } from './composables/useKeyboardEntry'
import { useHighlight } from './composables/useHighlight'
import { useRenderer } from './composables/useRenderer'
import { useMouseInteraction } from './composables/useMouseInteraction'
import { useShortcuts } from './composables/useShortcuts'

// Create the music engine
const engine = shallowRef<MusicEngine | null>(null)
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

// Shared palette refs — declared here so both useSelection (writes) and usePalette (reads/actions) share the same instances
const selectedDuration = ref<'w' | 'h' | 'q' | '8' | '16' | '32'>('q')
const selectedAccidental = ref<'#' | 'b' | 'n' | null>(null)
const selectedDots = ref<number>(0)

// Mutable render functions — assigned by useRenderer once it runs.
// Early composables (useSelection, usePalette, useKeyboardEntry) receive closure wrappers
// so they always call the real implementation at event time, not the initial no-op.
let renderScore: () => void = () => {}
let renderPreview: (coords: { x: number; y: number }) => void = () => {}

// Stable wrapper for last mouse position — points to useMouseInteraction's getter once that composable runs.
// Declared here so usePalette (called before useMouseInteraction) can reference it via closure.
let _getLastMousePos: () => { x: number; y: number } | null = () => null

// Selection state and navigation (runs first — owns selectedArticulationNoteId/Type)
const {
  selectedArticulationNoteId,
  selectedArticulationType,
  selectedAccidentalNoteId,
  selectedAccidentalType,
  selectedTupletId,
  selectNote,
  setSelectedNote,
  navigateSelection,
  navigateChord,
  adjustPitch,
  adjustOctave,
  getContextPitch,
} = useSelection({
  selectedTool,
  selectedNoteId,
  engine,
  scoreCanvas,
  selectedDuration,
  selectedAccidental,
  selectedDots,
  renderScore: () => renderScore(),
})

// Palette state and actions (duration, accidental, dot, articulations, tie, tuplet)
const {
  pendingTieFromNoteId,
  tupletMode,
  pendingArticulations,
  setDuration,
  setAccidental,
  toggleAccent,
  toggleStaccato,
  toggleTenuto,
  toggleTie,
  toggleDot,
  toggleTuplet,
  resetPaletteToDefaults,
  selectedNoteHasAccent,
  selectedNoteHasStaccato,
  selectedNoteHasTenuto,
  selectedNoteHasTie,
} = usePalette({
  selectedTool,
  selectedNoteId,
  selectedArticulationNoteId,
  selectedArticulationType,
  selectedDuration,
  selectedAccidental,
  selectedDots,
  engine,
  renderScore: () => renderScore(),
  renderPreview: (c) => renderPreview(c),
  getLastMousePosition: () => _getLastMousePos(),
  selectNote: (id) => selectNote(id),
})

// Keyboard note/rest entry
const {
  enterNoteByLetter,
  enterRestAtCursorPosition,
  addChordNoteByLetter,
} = useKeyboardEntry({
  selectedTool,
  selectedNoteId,
  engine,
  selectedDuration,
  selectedAccidental,
  selectedDots,
  pendingArticulations,
  tupletMode,
  pendingTieFromNoteId,
  setSelectedNote,
  getContextPitch,
  renderScore: () => renderScore(),
})

// SVG highlight functions
const {
  applySelectionHighlight,
  applyArticulationHighlight,
  applyAccidentalHighlight,
  applyTupletSelectionHighlight,
  applyKeyboardCursor,
} = useHighlight({
  engine,
  scoreCanvas,
  selectedTool,
  selectedNoteId,
  selectedArticulationNoteId,
  selectedArticulationType,
  selectedAccidentalNoteId,
  selectedAccidentalType,
  selectedTupletId,
})

// Rendering orchestration — owns renderScore and renderPreview
;({ renderScore, renderPreview } = useRenderer({
  engine,
  selectedDuration,
  selectedAccidental,
  selectedDots,
  pendingArticulations,
  pendingTieFromNoteId,
  applySelectionHighlight,
  applyArticulationHighlight,
  applyAccidentalHighlight,
  applyTupletSelectionHighlight,
  applyKeyboardCursor,
}))

// Cursor visibility (hide when ghost note renders, show when it doesn't)
const showCursor = ref(true)

// Mouse interaction handlers
const {
  handleCanvasMouseDown,
  handleCanvasMouseUp,
  handleCanvasClick,
  handleCanvasMouseMove,
  handleCanvasMouseLeave,
  getLastMousePosition,
} = useMouseInteraction({
  engine,
  scoreCanvas,
  selectedTool,
  selectedNoteId,
  selectedArticulationNoteId,
  selectedArticulationType,
  selectedAccidentalNoteId,
  selectedAccidentalType,
  selectedTupletId,
  selectedDuration,
  selectedAccidental,
  selectedDots,
  pendingArticulations,
  tupletMode,
  selectNote,
  setSelectedNote,
  renderScore,
  applySelectionHighlight,
  applyArticulationHighlight,
  applyAccidentalHighlight,
  applyTupletSelectionHighlight,
  applyKeyboardCursor,
  showCursor,
})

// Wire the stable wrappers to the real getters now that useMouseInteraction has run
_getLastMousePos = getLastMousePosition

// Computed properties
const scoreJSON = computed(() => engine.value?.exportJSON() || '{}')

// Keyboard shortcuts
const shortcuts = useShortcuts({
  engine,
  selectedTool,
  selectedNoteId,
  selectedArticulationNoteId,
  selectedArticulationType,
  selectedAccidentalNoteId,
  selectedAccidentalType,
  selectedTupletId,
  setDuration,
  setAccidental,
  toggleAccent,
  toggleStaccato,
  toggleTenuto,
  toggleTie,
  toggleDot,
  toggleTuplet,
  resetPaletteToDefaults,
  selectNote,
  navigateSelection,
  navigateChord,
  adjustPitch,
  adjustOctave,
  enterNoteByLetter,
  enterRestAtCursorPosition,
  addChordNoteByLetter,
  renderScore,
  getLastMousePosition,
  renderPreview,
})

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

    shortcuts.enable()

    // Initialize with empty measures
    initializeEmptyScore()
    renderScore()
  }
})

onUnmounted(() => {
  shortcuts.disable()
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

function clearNotes() {
  if (!engine.value) return
  engine.value.clearAllNotes()
  selectNote(null)
  renderScore()
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
