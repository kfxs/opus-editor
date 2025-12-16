<template>
  <div class="min-h-screen bg-gray-900 text-white p-8">
    <h1 class="text-4xl font-bold mb-8">Score Editor - Phase 2 Demo</h1>

    <div class="mb-8">
      <h2 class="text-2xl mb-4">Developer A: Music Engine with Playback</h2>
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
          <button
            @click="renderScore"
            class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            Render Score
          </button>
          <div class="border-l border-gray-600 mx-2"></div>

          <!-- Note Duration Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Duration:</span>
            <button
              @click="selectedDuration = 'w'"
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
              @click="selectedDuration = 'h'"
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
              @click="selectedDuration = 'q'"
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
              @click="selectedDuration = '8'"
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
              @click="selectedDuration = '16'"
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
              @click="selectedAccidental = null"
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
              @click="selectedAccidental = '#'"
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
              @click="selectedAccidental = 'b'"
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
              @click="selectedAccidental = 'n'"
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

        <!-- VexFlow Rendering Area -->
        <div
          ref="scoreCanvas"
          class="bg-white rounded-lg p-4 min-h-[300px] cursor-crosshair"
          @click="handleCanvasClick"
          @mousemove="handleCanvasMouseMove"
          @mouseleave="handleCanvasMouseLeave"
        ></div>

        <div class="mt-4 text-sm">
          <p class="text-gray-400">Click anywhere on the staff to add notes. Create your own melody!</p>
          <p class="text-yellow-400 text-xs mt-1">
            <strong>Selected:</strong> {{ durationName }} ({{ durationBeats }} beat{{ durationBeats === 1 ? '' : 's' }}){{ accidentalText }}
            • Each measure can hold 4 beats (4/4 time)
          </p>
        </div>
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

// Note duration selection
const selectedDuration = ref<'w' | 'h' | 'q' | '8' | '16' | '32'>('q') // Default to quarter note

// Accidental selection
const selectedAccidental = ref<'#' | 'b' | 'n' | null>(null) // Default to no accidental

// Ghost note preview throttling
let lastPreviewRender = 0
const PREVIEW_THROTTLE_MS = 50 // Only update preview every 50ms

// Computed properties
const totalNotes = computed(() => engine.value?.getScore().measures.flatMap(m => m.notes).length || 0)
const scoreJSON = computed(() => engine.value?.exportJSON() || '{}')

// Duration name mapping for UI display
const durationName = computed(() => {
  const names: Record<string, string> = {
    'w': 'Whole note (Redonda)',
    'h': 'Half note (Blanca)',
    'q': 'Quarter note (Negra)',
    '8': 'Eighth note (Corchea)',
    '16': 'Sixteenth note (Semicorchea)',
    '32': 'Thirty-second note (Fusa)'
  }
  return names[selectedDuration.value] || 'Unknown'
})

// Duration beats mapping
const durationBeats = computed(() => {
  const beats: Record<string, number> = {
    'w': 4,
    'h': 2,
    'q': 1,
    '8': 0.5,
    '16': 0.25,
    '32': 0.125
  }
  return beats[selectedDuration.value] || 1
})

// Accidental text for display
const accidentalText = computed(() => {
  if (!selectedAccidental.value) return ''
  const names: Record<string, string> = {
    '#': ' with Sharp (♯)',
    'b': ' with Flat (♭)',
    'n': ' with Natural (♮)'
  }
  return names[selectedAccidental.value] || ''
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

    // Initialize with empty measures
    initializeEmptyScore()
    renderScore()
  }
})

onUnmounted(() => {
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
  renderScore()
}

function renderScore() {
  if (!engine.value) return
  engine.value.clearCanvas()
  engine.value.renderScore()
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
  if (!engine.value || !scoreCanvas.value) return

  const rect = scoreCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  try {
    // Add a note with the selected duration and accidental at clicked position
    const note = engine.value.addNoteAtPosition(
      { x, y },
      selectedDuration.value,
      selectedAccidental.value || undefined
    )

    if (note) {
      renderScore()
    } else {
      console.warn('Could not add note at this position (collision or invalid location)')
    }
  } catch (error) {
    console.error('Error adding note:', error)
    alert('Cannot add note: ' + (error as Error).message)
  }
}

function handleCanvasMouseMove(event: MouseEvent) {
  if (!engine.value || !scoreCanvas.value) return

  // Throttle preview updates for performance
  const now = Date.now()
  if (now - lastPreviewRender < PREVIEW_THROTTLE_MS) {
    return
  }
  lastPreviewRender = now

  const rect = scoreCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // Render score with ghost note preview using selected duration and accidental
  engine.value.renderScoreWithPreview(
    { x, y },
    selectedDuration.value,
    selectedAccidental.value || undefined
  )
}

function handleCanvasMouseLeave() {
  if (!engine.value) return

  // Clear preview and render normal score
  renderScore()
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
</style>
