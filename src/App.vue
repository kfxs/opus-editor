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
              @click="state.selectedTool = 'entry'; state.selectedNoteId = null"
              :class="[
                'px-3 py-1 rounded text-sm',
                state.selectedTool === 'entry'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Note Entry Tool"
            >
              Entry
            </button>
            <button
              @click="state.selectedTool = 'selection'"
              :class="[
                'px-3 py-1 rounded text-sm',
                state.selectedTool === 'selection'
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
              @click="palette.setDuration('w')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.selectedDuration === 'w'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Whole note (Redonda) - 4 beats"
            >
              𝅝
            </button>
            <button
              @click="palette.setDuration('h')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.selectedDuration === 'h'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Half note (Blanca) - 2 beats"
            >
              𝅗𝅥
            </button>
            <button
              @click="palette.setDuration('q')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.selectedDuration === 'q'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Quarter note (Negra) - 1 beat"
            >
              ♩
            </button>
            <button
              @click="palette.setDuration('8')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.selectedDuration === '8'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Eighth note (Corchea) - 0.5 beats"
            >
              ♪
            </button>
            <button
              @click="palette.setDuration('16')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.selectedDuration === '16'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Sixteenth note (Semicorchea) - 0.25 beats"
            >
              𝅘𝅥𝅯
            </button>
            <button
              @click="palette.setDuration('32')"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.selectedDuration === '32'
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
              @click="palette.setAccidental('#')"
              :class="[
                'px-3 py-1 rounded text-lg font-bold',
                state.selectedAccidental === '#'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Sharp (Sostenido)"
            >
              ♯
            </button>
            <button
              @click="palette.setAccidental('b')"
              :class="[
                'px-3 py-1 rounded text-lg font-bold',
                state.selectedAccidental === 'b'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Flat (Bemol)"
            >
              ♭
            </button>
            <button
              @click="palette.setAccidental('n')"
              :class="[
                'px-3 py-1 rounded text-lg font-bold',
                state.selectedAccidental === 'n'
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
              @click="palette.toggleAccent()"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                palette.noteHasAccent()
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Accent (Numpad /)"
            >
              &gt;
            </button>
            <button
              @click="palette.toggleStaccato()"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                palette.noteHasStaccato()
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Staccato (Numpad *)"
            >
              •
            </button>
            <button
              @click="palette.toggleTenuto()"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                palette.noteHasTenuto()
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
              @click="palette.toggleDot()"
              :class="[
                'px-3 py-1 rounded text-lg font-bold',
                state.selectedDots > 0
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
              @click="palette.toggleTuplet()"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.tupletMode
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Toggle triplet mode (T) - creates 3 notes in space of 2"
            >
              3
            </button>
          </div>

          <!-- Beam -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Beam:</span>
            <button
              v-for="b in (['auto', 'single', 'begin', 'continue', 'end'] as const)"
              :key="b"
              @click="palette.setBeam(b)"
              :class="[
                'px-2 py-1 rounded text-xs',
                state.selectedBeam === b
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              :title="`Beam: ${b}`"
            >{{ b }}</button>
          </div>

          <!-- Tie -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Tie:</span>
            <button
              @click="palette.toggleTie()"
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                palette.noteHasTie()
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Toggle tie to next note of same pitch (Numpad Enter)"
            >
              ⌒
            </button>
          </div>

          <!-- Clef Tool -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Clef:</span>
            <button
              v-for="c in (['treble', 'bass', 'alto'] as const)"
              :key="c"
              @click="palette.setClef(c)"
              :class="[
                'px-3 py-1 rounded text-lg font-bold leading-none',
                state.selectedClef === c
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              :title="`${c[0].toUpperCase()}${c.slice(1)} clef — click a measure to place it`"
            >{{ c === 'treble' ? '𝄞' : c === 'bass' ? '𝄢' : '𝄡' }}</button>
          </div>

          <div class="border-l border-gray-600 mx-2"></div>
          <button
            @click="togglePlayback"
            :class="[
              'px-4 py-2 rounded min-w-[80px]',
              state.playbackState === 'playing'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-purple-600 hover:bg-purple-700',
            ]"
          >
            {{ state.playbackState === 'playing' ? '⏹ Stop' : '▶ Play' }}
          </button>
        </div>

        <!-- VexFlow Rendering Area (Score Container/Canvas) -->
        <div
          ref="scoreCanvas"
          class="score-container bg-white rounded-lg p-4 min-h-[300px] overflow-auto cursor-default"
          @click="(e) => mouse.handleClick(e)"
          @mousedown="(e) => mouse.handleMouseDown(e)"
          @mousemove="(e) => mouse.handleMouseMove(e)"
          @mouseup="(e) => mouse.handleMouseUp(e)"
          @mouseleave="mouse.handleMouseLeave()"
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
import { ref, shallowRef, computed, reactive, onMounted, onUnmounted } from 'vue'
import { MusicEngine } from './engine/MusicEngine'
import { createEditorState } from './interactions/EditorState'
import { useHighlight } from './composables/useHighlight'
import { useRenderer } from './composables/useRenderer'
import { useSelection } from './composables/useSelection'
import { usePalette } from './composables/usePalette'
import { useKeyboardEntry } from './composables/useKeyboardEntry'
import { useMouseInteraction } from './composables/useMouseInteraction'
import { useShortcuts } from './composables/useShortcuts'

// --- Engine and canvas ---
const engine = shallowRef<MusicEngine | null>(null)
const scoreCanvas = ref<HTMLElement | null>(null)

// --- All editor state in one reactive plain object ---
const state = reactive(createEditorState())

// --- Wire up controllers in dependency order ---
// HighlightController has no deps on other controllers
const highlight = useHighlight(state, engine, scoreCanvas)

// RenderController depends on HighlightController
const renderer = useRenderer(state, engine, highlight)

// SelectionController depends on renderer (for renderScore callback)
const selection = useSelection(state, engine, scoreCanvas, () => renderer.renderScore())

// PaletteController needs selection.selectNote and mouse.getLastMousePosition.
// Mouse is created below — the closure resolves lazily at call time.
let mouse: ReturnType<typeof useMouseInteraction>
const palette = usePalette(
  state, engine,
  () => renderer.renderScore(),
  (c) => renderer.renderPreview(c),
  () => mouse?.getLastMousePosition() ?? null,
  selection,
)

// KeyboardController depends on selection and palette
const keyboard = useKeyboardEntry(state, engine, palette, () => renderer.renderScore(), selection)

// MouseController depends on selection, renderer, highlight, palette.
// onMounted/onUnmounted are called internally by the composable.
mouse = useMouseInteraction(state, engine, scoreCanvas, selection, renderer, palette)

// ShortcutManager — wires keyboard shortcuts to controller actions
const shortcuts = useShortcuts(
  state, engine,
  selection, palette, keyboard, renderer,
  () => mouse.getLastMousePosition(),
)

// --- Computed ---
const scoreJSON = computed(() => engine.value?.exportJSON() || '{}')

// --- Lifecycle ---
onMounted(() => {
  if (scoreCanvas.value) {
    engine.value = new MusicEngine({
      container: scoreCanvas.value,
      width: 1000,
      height: 400,
    })

    engine.value.setPlaybackCallbacks({
      onStateChange: s => { state.playbackState = s },
      onPositionChange: _pos => { /* future: update state.playbackPosition */ },
      onPlaybackComplete: () => { state.playbackState = 'stopped' },
    })

    shortcuts.enable()
    initializeEmptyScore()
    renderer.renderScore()
  }
})

onUnmounted(() => {
  shortcuts.disable()
  if (engine.value) {
    engine.value.dispose()
  }
})

// --- App-level actions ---

function initializeEmptyScore() {
  if (!engine.value) return
  engine.value.clearAllNotes()
  for (let i = 0; i < 7; i++) {
    engine.value.addMeasure()
  }
}

function clearNotes() {
  if (!engine.value) return
  engine.value.clearAllNotes()
  selection.selectNote(null)
  renderer.renderScore()
}

async function togglePlayback() {
  if (!engine.value) return
  if (state.playbackState === 'playing') {
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

/* Free-floating translucent ghost clef that follows the cursor (matches ghost note) */
.ghost-clef-group {
  opacity: 0.7;
  pointer-events: none;
}
.ghost-clef-group path,
.ghost-clef-group ellipse,
.ghost-clef-group circle {
  fill: #3B82F6 !important;
  stroke: #2563EB !important;
}
.ghost-clef-group text {
  fill: #3B82F6 !important;
}
.ghost-clef-group line {
  stroke: #2563EB !important;
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
  scrollbar-gutter: stable;
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
