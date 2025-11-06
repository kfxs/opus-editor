<template>
  <div class="min-h-screen bg-gray-900 text-white p-8">
    <h1 class="text-4xl font-bold mb-8">Score Editor - Phase 1 Demo</h1>

    <div class="mb-8">
      <h2 class="text-2xl mb-4">Developer A: Music Engine Test</h2>
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="mb-4">
          <button
            @click="addSampleNotes"
            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-2"
          >
            Add Sample Notes
          </button>
          <button
            @click="clearNotes"
            class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded mr-2"
          >
            Clear Notes
          </button>
          <button
            @click="renderScore"
            class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            Render Score
          </button>
        </div>

        <div class="text-left mb-4">
          <p class="text-sm text-gray-400 mb-2">Score Info:</p>
          <p>Title: {{ scoreModel.getScore().title }}</p>
          <p>Tempo: {{ scoreModel.getScore().tempo }} BPM</p>
          <p>Measures: {{ scoreModel.getScore().measures.length }}</p>
          <p>Total Notes: {{ scoreModel.getAllNotes().length }}</p>
        </div>

        <!-- VexFlow Rendering Area -->
        <div
          ref="scoreCanvas"
          class="bg-white rounded-lg p-4 min-h-[300px]"
        ></div>
      </div>
    </div>

    <div class="bg-gray-800 p-4 rounded-lg text-left">
      <h3 class="text-xl mb-2">Score JSON:</h3>
      <pre class="bg-gray-900 p-4 rounded overflow-auto text-xs">{{ scoreJSON }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ScoreModel } from './engine/models/ScoreModel'
import { VexFlowRenderer } from './engine/rendering/VexFlowRenderer'

// Create a score model
const scoreModel = new ScoreModel('Test Score', 120)

// VexFlow renderer
let renderer: VexFlowRenderer | null = null
const scoreCanvas = ref<HTMLElement | null>(null)

// Computed property for JSON display
const scoreJSON = computed(() => scoreModel.toJSON())

onMounted(() => {
  if (scoreCanvas.value) {
    renderer = new VexFlowRenderer(scoreCanvas.value)
    renderer.initialize(1000, 400)

    // Add initial sample notes
    addSampleNotes()
    renderScore()
  }
})

function addSampleNotes() {
  // Clear existing notes first
  scoreModel.clearAllNotes()

  // Add some sample notes to measure 1
  // C4, E4, G4, C5 (C major chord arpeggio)
  scoreModel.addNote({ pitch: 60, duration: 'q', measure: 1, beat: 0 }) // C4
  scoreModel.addNote({ pitch: 64, duration: 'q', measure: 1, beat: 1 }) // E4
  scoreModel.addNote({ pitch: 67, duration: 'q', measure: 1, beat: 2 }) // G4
  scoreModel.addNote({ pitch: 72, duration: 'q', measure: 1, beat: 3 }) // C5

  // Add measure 2 and more notes
  scoreModel.addMeasure()
  scoreModel.addNote({ pitch: 71, duration: 'h', measure: 2, beat: 0 }) // B4
  scoreModel.addNote({ pitch: 69, duration: 'h', measure: 2, beat: 2 }) // A4
}

function clearNotes() {
  scoreModel.clearAllNotes()
  renderScore()
}

function renderScore() {
  if (renderer && scoreCanvas.value) {
    renderer.clear()
    renderer.initialize(1000, 400)
    renderer.renderScore(scoreModel.getScore())
  }
}
</script>
