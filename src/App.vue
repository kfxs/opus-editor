<template>
  <div class="min-h-screen bg-gray-900 text-white p-8">
    <h1 class="text-4xl font-bold mb-8">Score Editor - Phase 2 Demo</h1>

    <div class="mb-8">
      <h2 class="text-2xl mb-4">Developer A: Music Engine with Playback</h2>
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="mb-4 flex gap-2">
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
          <button
            @click="handlePlay"
            :disabled="playbackState === 'playing'"
            :class="[
              'px-4 py-2 rounded',
              playbackState === 'playing'
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700',
            ]"
          >
            ▶ Play
          </button>
          <button
            @click="handlePause"
            :disabled="playbackState !== 'playing'"
            :class="[
              'px-4 py-2 rounded',
              playbackState !== 'playing'
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-yellow-600 hover:bg-yellow-700',
            ]"
          >
            ⏸ Pause
          </button>
          <button
            @click="handleStop"
            :disabled="playbackState === 'stopped'"
            :class="[
              'px-4 py-2 rounded',
              playbackState === 'stopped'
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700',
            ]"
          >
            ⏹ Stop
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
        ></div>

        <div class="mt-4 text-sm text-gray-400">
          Click on the score to add notes at that position!
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="bg-gray-800 p-4 rounded-lg text-left">
        <h3 class="text-xl mb-2">Score JSON:</h3>
        <pre class="bg-gray-900 p-4 rounded overflow-auto text-xs max-h-96">{{ scoreJSON }}</pre>
      </div>

      <div class="bg-gray-800 p-4 rounded-lg text-left">
        <h3 class="text-xl mb-2">Phase 2 Features:</h3>
        <ul class="list-disc list-inside space-y-2 text-sm">
          <li>✅ Note-to-pixel coordinate mapping</li>
          <li>✅ Pixel-to-note position resolver</li>
          <li>✅ Click canvas to add notes</li>
          <li>✅ Note collision detection</li>
          <li>✅ Measure overflow handling</li>
          <li>✅ Tone.js audio playback</li>
          <li>✅ Playback cursor tracking</li>
          <li>✅ Rest support</li>
          <li>✅ 116 unit tests passing</li>
        </ul>
      </div>
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

// Computed properties
const totalNotes = computed(() => engine.value?.getScore().measures.flatMap(m => m.notes).length || 0)
const scoreJSON = computed(() => engine.value?.exportJSON() || '{}')

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

    // Add initial sample notes and render
    addSampleNotes()
    renderScore()
  }
})

onUnmounted(() => {
  if (engine.value) {
    engine.value.dispose()
  }
})

function addSampleNotes() {
  if (!engine.value) return

  // Clear existing notes first
  engine.value.clearAllNotes()

  // Add some sample notes to measure 1 - C major scale
  engine.value.addNote({ pitch: 60, duration: 'q', measure: 1, beat: 0 }) // C4
  engine.value.addNote({ pitch: 62, duration: 'q', measure: 1, beat: 1 }) // D4
  engine.value.addNote({ pitch: 64, duration: 'q', measure: 1, beat: 2 }) // E4
  engine.value.addNote({ pitch: 65, duration: 'q', measure: 1, beat: 3 }) // F4

  // Add measure 2 and more notes
  engine.value.addMeasure()
  engine.value.addNote({ pitch: 67, duration: 'q', measure: 2, beat: 0 }) // G4
  engine.value.addNote({ pitch: 69, duration: 'q', measure: 2, beat: 1 }) // A4
  engine.value.addNote({ pitch: 71, duration: 'q', measure: 2, beat: 2 }) // B4
  engine.value.addNote({ pitch: 72, duration: 'q', measure: 2, beat: 3 }) // C5
}

function clearNotes() {
  if (!engine.value) return
  engine.value.clearAllNotes()
  renderScore()
}

function renderScore() {
  if (!engine.value) return
  engine.value.clearCanvas()
  engine.value.resizeCanvas(1000, 400)
}

async function handlePlay() {
  if (!engine.value) return
  try {
    await engine.value.play()
  } catch (error) {
    console.error('Playback error:', error)
  }
}

function handlePause() {
  if (!engine.value) return
  engine.value.pause()
}

function handleStop() {
  if (!engine.value) return
  engine.value.stop()
}

function handleCanvasClick(event: MouseEvent) {
  if (!engine.value || !scoreCanvas.value) return

  const rect = scoreCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // Add a quarter note at clicked position
  const note = engine.value.addNoteAtPosition({ x, y }, 'q')

  if (note) {
    console.log('Added note:', note)
    renderScore()
  } else {
    console.warn('Could not add note at this position (collision or invalid location)')
  }
}
</script>
