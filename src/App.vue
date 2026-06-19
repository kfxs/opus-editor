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
              @click="palette.disarmPositionalTools(); state.selectedTool = 'selection'"
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

          <!-- Time Signature Tool -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Time:</span>
            <button
              v-for="ts in timeSignaturePresets"
              :key="`${ts.numerator}/${ts.denominator}`"
              @click="palette.setTimeSignature({ numerator: ts.numerator, denominator: ts.denominator })"
              :class="[
                'px-2 py-1 rounded text-sm font-bold leading-none tabular-nums',
                isTimeSignatureArmed(ts)
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              :title="`${ts.numerator}/${ts.denominator} — click a measure to set its time signature`"
            >{{ ts.numerator }}/{{ ts.denominator }}</button>
            <button
              @click="openTimeSignatureDialog"
              :class="[
                'px-2 py-1 rounded text-sm leading-none',
                isCustomTimeSignatureArmed
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Custom time signature (any dyadic meter + optional grouping)"
            >Custom…</button>
            <button
              @click="openPickupDialog"
              class="px-2 py-1 rounded text-sm leading-none bg-gray-600 hover:bg-gray-500"
              title="Pickup / anacrusis bar (set a measure's actual length shorter than its time signature)"
            >Pickup…</button>
          </div>

          <!-- Dynamics Tool -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Dyn:</span>
            <button
              v-for="d in dynamicLevels"
              :key="d"
              @click="palette.setDynamic(d)"
              :class="[
                'px-2 py-1 rounded text-sm italic font-bold leading-none',
                state.selectedDynamic === d
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              :title="`${d} — click a beat to place it (drives playback loudness)`"
            >{{ d }}</button>
            <button
              @click="palette.setDynamic('text')"
              :class="[
                'px-2 py-1 rounded text-sm leading-none',
                state.selectedDynamic === 'text'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Custom italic text dynamic (silent) — places editable “Text” placeholder"
            >Text</button>
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

        <!--
          Score area = fixed-size viewport (owns scroll) + inner content surface (holds the SVG).
          The OUTER div keeps the `scoreCanvas` ref: it owns scrolling (read by
          scrollSelectedNoteIntoView) and the svg is a descendant so `scoreCanvas.querySelector('svg')`
          still works. The INNER div is the engine container — VexFlow wipes it with innerHTML='' on
          every render, so it must NOT be the outer scroll box. Padding stays on the inner surface so
          bbox coords stay aligned with the viewport scroll. See docs/navigation-viewport-plan.md §4.
        -->
        <div
          ref="scoreCanvas"
          class="score-container bg-white rounded-lg overflow-auto"
          :class="state.isPanning ? 'cursor-none' : 'cursor-default'"
          :style="{ height: viewportHeight }"
          @click="(e) => mouse.handleClick(e)"
          @mousedown="(e) => mouse.handleMouseDown(e)"
          @mousemove="(e) => mouse.handleMouseMove(e)"
          @mouseup="(e) => mouse.handleMouseUp(e)"
          @mouseleave="mouse.handleMouseLeave()"
        >
          <div ref="scoreContent" class="p-4"></div>
        </div>

      </div>
    </div>

    <div class="bg-gray-800 p-4 rounded-lg text-left">
      <h3 class="text-xl mb-2">Score JSON:</h3>
      <pre class="bg-gray-900 p-4 rounded overflow-auto text-xs max-h-96">{{ scoreJSON }}</pre>
    </div>

    <!-- Custom time-signature dialog -->
    <div
      v-if="showTimeSignatureDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showTimeSignatureDialog = false"
    >
      <div class="bg-gray-800 rounded-lg p-6 w-80 text-left shadow-xl" @keydown.enter="applyCustomTimeSignature">
        <h3 class="text-lg font-semibold mb-4">Custom Time Signature</h3>

        <div class="flex items-center gap-3 mb-3">
          <label class="text-sm text-gray-300 w-24">Numerator</label>
          <input
            type="number" min="1" step="1" v-model.number="tsNumerator"
            class="flex-1 bg-gray-700 rounded px-2 py-1 text-white"
          />
        </div>

        <div class="flex items-center gap-3 mb-3">
          <label class="text-sm text-gray-300 w-24">Denominator</label>
          <select v-model.number="tsDenominator" class="flex-1 bg-gray-700 rounded px-2 py-1 text-white">
            <option v-for="d in tsDenominatorOptions" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>

        <div class="flex items-center gap-3 mb-1">
          <label class="text-sm text-gray-300 w-24">Grouping</label>
          <input
            type="text" v-model="tsGrouping" placeholder="optional, e.g. 2+2+3"
            class="flex-1 bg-gray-700 rounded px-2 py-1 text-white"
          />
        </div>
        <p class="text-xs text-gray-400 mb-3 ml-[6.75rem]">In denominator units; must sum to the numerator.</p>

        <p v-if="tsDialogError" class="text-sm text-red-400 mb-3">{{ tsDialogError }}</p>

        <div class="flex justify-end gap-2 mt-2">
          <button
            @click="showTimeSignatureDialog = false"
            class="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-sm"
          >Cancel</button>
          <button
            @click="applyCustomTimeSignature"
            :disabled="!!tsDialogError"
            class="px-3 py-1 rounded text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >Arm</button>
        </div>
      </div>
    </div>

    <!-- Pickup / anacrusis dialog -->
    <div
      v-if="showPickupDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showPickupDialog = false"
    >
      <div class="bg-gray-800 rounded-lg p-6 w-80 text-left shadow-xl" @keydown.enter="applyPickup">
        <h3 class="text-lg font-semibold mb-4">Pickup / Anacrusis Bar</h3>

        <div class="flex items-center gap-3 mb-3">
          <label class="text-sm text-gray-300 w-24">Measure</label>
          <input
            type="number" min="1" step="1" v-model.number="pickupMeasure"
            class="flex-1 bg-gray-700 rounded px-2 py-1 text-white"
          />
        </div>

        <div class="flex items-center gap-3 mb-1">
          <label class="text-sm text-gray-300 w-24">Pickup length</label>
          <input
            type="number" min="1" step="1" v-model.number="pickupNumerator"
            class="w-16 bg-gray-700 rounded px-2 py-1 text-white"
          />
          <span class="text-gray-400">/</span>
          <select v-model.number="pickupDenominator" class="flex-1 bg-gray-700 rounded px-2 py-1 text-white">
            <option v-for="d in tsDenominatorOptions" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
        <p class="text-xs text-gray-400 mb-3 ml-[6.75rem]">Actual bar length; must be shorter than the full bar (e.g. 1/4 = one beat).</p>

        <p v-if="pickupDialogError" class="text-sm text-red-400 mb-3">{{ pickupDialogError }}</p>

        <div class="flex justify-end gap-2 mt-2">
          <button
            @click="showPickupDialog = false"
            class="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-sm"
          >Cancel</button>
          <button
            @click="clearPickup"
            class="px-3 py-1 rounded text-sm bg-gray-600 hover:bg-gray-500"
            title="Remove the pickup, restoring the full bar"
          >Clear</button>
          <button
            @click="applyPickup"
            :disabled="!!pickupDialogError"
            class="px-3 py-1 rounded text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >Apply</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { MusicEngine } from './engine/MusicEngine'
import { VIEWPORT_TWO_LINE_HEIGHT } from './engine/rendering/VexFlowRenderer'
import { createEditorState } from './interactions/EditorState'
import { useHighlight } from './composables/useHighlight'
import { useRenderer } from './composables/useRenderer'
import { useSelection } from './composables/useSelection'
import { usePalette } from './composables/usePalette'
import { useKeyboardEntry } from './composables/useKeyboardEntry'
import { useMouseInteraction } from './composables/useMouseInteraction'
import { useTextEditing } from './composables/useTextEditing'
import { useViewport } from './composables/useViewport'
import { useShortcuts } from './composables/useShortcuts'
import { ClipboardController } from './interactions/ClipboardController'
import { isValidTimeSignature } from './utils/meter'
import { getMeasureDurationFrac } from './utils/musicUtils'
import { fracCreate, fracGte, type Fraction } from './utils/fraction'
import type { TimeSignature } from './types/music'

// --- Engine and canvas ---
const engine = shallowRef<MusicEngine | null>(null)
// Outer viewport (fixed height, owns scroll). Controllers read this for scroll + querySelector.
const scoreCanvas = ref<HTMLElement | null>(null)
// Inner content surface — the engine's render target (VexFlow mounts/wipes its SVG here).
const scoreContent = ref<HTMLElement | null>(null)
// Fixed viewport height (≈ two staff lines) so the JSON panel below stays visible.
const viewportHeight = `${VIEWPORT_TWO_LINE_HEIGHT}px`

// --- All editor state in one reactive plain object ---
const state = reactive(createEditorState())

// --- Wire up controllers in dependency order ---
// HighlightController has no deps on other controllers
const highlight = useHighlight(state, engine, scoreCanvas)

// RenderController depends on HighlightController
const renderer = useRenderer(state, engine, highlight)

// ViewportModel ⇄ DOM scroll wiring (the only DOM-aware viewport piece). Keeps a pure
// ViewportModel in sync with the outer scroll box and inner content surface, and exposes
// ensureVisible for scroll-into-view. onMounted/onUnmounted run inside the composable.
const viewport = useViewport(scoreCanvas, scoreContent)

// SelectionController depends on renderer (for renderScore callback) and the viewport
// (scroll-into-view of the selected note now runs through ViewportModel.ensureVisible).
const selection = useSelection(
  state,
  engine,
  rect => viewport.ensureVisible(rect),
  () => renderer.renderScore(),
)

// ClipboardController (copy/paste) depends on selection + renderer.
const clipboard = new ClipboardController(() => engine.value, state, selection, renderer)

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

// TextEditController — the in-canvas text editor (seamless DOM overlay). Created
// before mouse so MouseController can open it on double-click / new placement.
const textEdit = useTextEditing(state)

// MouseController depends on selection, renderer, highlight, palette, textEdit.
// onMounted/onUnmounted are called internally by the composable.
mouse = useMouseInteraction(state, engine, scoreCanvas, selection, renderer, palette, textEdit, clipboard, (dx, dy) => viewport.scrollBy(dx, dy))

// ShortcutManager — wires keyboard shortcuts to controller actions
const shortcuts = useShortcuts(
  state, engine,
  selection, palette, keyboard, renderer, clipboard,
  () => mouse.getLastMousePosition(),
)

// While a hand/grab pan is active, hide the OS pointer everywhere — not just over the
// score — so it stays hidden when the drag crosses the viewport edge. (The score element
// also carries `cursor-none` for the common in-bounds case; this covers off-bounds.)
watch(() => state.isPanning, (panning) => {
  document.body.style.cursor = panning ? 'none' : ''
})

// --- Computed ---
const scoreJSON = computed(() => engine.value?.exportJSON() || '{}')

// --- Time signature palette ---
// Presets are shortcuts only; the engine supports any dyadic meter. Covers
// simple (4/4 3/4 2/4), compound (6/8 9/8), and irregular (5/8 7/8) for testing.
const timeSignaturePresets = [
  { numerator: 4, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 2, denominator: 4 },
  { numerator: 6, denominator: 8 },
  { numerator: 9, denominator: 8 },
  { numerator: 5, denominator: 8 },
  { numerator: 7, denominator: 8 },
] as const

function isTimeSignatureArmed(ts: { numerator: number; denominator: number }): boolean {
  const sel = state.selectedTimeSignature
  return !!sel && sel.numerator === ts.numerator && sel.denominator === ts.denominator
}

// --- Dynamics tool ---
// Interpreted levels drive playback loudness; the custom mark is silent italic text.
// The custom mark drops a "Text" placeholder; editing it in place is a later feature.
const dynamicLevels = ['p', 'mp', 'mf', 'f'] as const

// --- Custom time-signature dialog ---
// Exposes the engine's full generality: any dyadic meter + optional additive
// grouping (e.g. 2+2+3). Presets are just shortcuts onto the same setter.
const showTimeSignatureDialog = ref(false)
const tsNumerator = ref(7)
const tsDenominator = ref(8)
const tsGrouping = ref('') // e.g. "2+2+3"; empty = algorithmic default
const tsDenominatorOptions = [1, 2, 4, 8, 16, 32]

/** Parse the grouping field ("2+2+3", "2,2,3", "2 2 3") into a number[]. */
function parseGrouping(input: string): number[] | undefined {
  const parts = input.split(/[+,\s]+/).map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return undefined
  return parts.map(Number)
}

/** The candidate time signature from the dialog fields, or null if unparseable. */
const tsCandidate = computed<TimeSignature | null>(() => {
  const numerator = Math.floor(Number(tsNumerator.value))
  const denominator = Number(tsDenominator.value)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  const grouping = parseGrouping(tsGrouping.value)
  if (grouping && grouping.some(g => !Number.isFinite(g))) return null
  return grouping ? { numerator, denominator, grouping } : { numerator, denominator }
})

const tsDialogError = computed<string | null>(() => {
  const ts = tsCandidate.value
  if (!ts) return 'Enter whole numbers.'
  if (!Number.isInteger(ts.numerator) || ts.numerator < 1) return 'Numerator must be a positive whole number.'
  if (!tsDenominatorOptions.includes(ts.denominator)) return 'Denominator must be a power of two (1–32).'
  if (ts.grouping && ts.grouping.reduce((a, b) => a + b, 0) !== ts.numerator) {
    return `Grouping must sum to ${ts.numerator} (got ${ts.grouping.reduce((a, b) => a + b, 0)}).`
  }
  return isValidTimeSignature(ts) ? null : 'Not a representable time signature.'
})

function openTimeSignatureDialog(): void {
  showTimeSignatureDialog.value = true
}

/** Arm the custom time signature (then the user clicks a measure to apply it). */
function applyCustomTimeSignature(): void {
  const ts = tsCandidate.value
  if (!ts || tsDialogError.value) return
  palette.setTimeSignature(ts)
  showTimeSignatureDialog.value = false
}

/** True when a custom (non-preset) meter is currently armed. */
const isCustomTimeSignatureArmed = computed(() => {
  const sel = state.selectedTimeSignature
  if (!sel) return false
  return !timeSignaturePresets.some(p => p.numerator === sel.numerator && p.denominator === sel.denominator && !sel.grouping)
})

// --- Pickup / anacrusis dialog ---
// Sets a measure's actual playable length shorter than its time signature. The
// length is entered as numerator/denominator (1/4 = one quarter beat); applied
// directly to the chosen measure (not an arm/click tool).
const showPickupDialog = ref(false)
const pickupMeasure = ref(1)
const pickupNumerator = ref(1)
const pickupDenominator = ref(4)

/** Pickup length in quarter beats (numerator × 4/denominator), or null if invalid. */
const pickupActual = computed<Fraction | null>(() => {
  const num = Math.floor(Number(pickupNumerator.value))
  const den = Number(pickupDenominator.value)
  if (!Number.isInteger(num) || num < 1 || !tsDenominatorOptions.includes(den)) return null
  return fracCreate(num * 4, den)
})

/** Nominal length of the target measure, or null if it doesn't exist. */
const pickupNominal = computed<Fraction | null>(() => {
  const m = engine.value?.getScore().measures.find(mm => mm.number === Math.floor(Number(pickupMeasure.value)))
  return m ? getMeasureDurationFrac(m.timeSignature) : null
})

const pickupDialogError = computed<string | null>(() => {
  if (!pickupNominal.value) return 'No such measure.'
  const actual = pickupActual.value
  if (!actual) return 'Enter a valid pickup length.'
  if (fracGte(actual, pickupNominal.value)) return 'Pickup must be shorter than the full bar.'
  return null
})

function openPickupDialog(): void {
  showPickupDialog.value = true
}

function applyPickup(): void {
  if (pickupDialogError.value || !engine.value || !pickupActual.value) return
  engine.value.setMeasureActualDuration(Math.floor(Number(pickupMeasure.value)), pickupActual.value)
  renderer.renderScore()
  showPickupDialog.value = false
}

function clearPickup(): void {
  if (!engine.value) return
  engine.value.setMeasureActualDuration(Math.floor(Number(pickupMeasure.value)), null)
  renderer.renderScore()
  showPickupDialog.value = false
}

// --- Lifecycle ---
onMounted(() => {
  if (scoreCanvas.value && scoreContent.value) {
    engine.value = new MusicEngine({
      container: scoreContent.value,
      width: 1000,
      height: 400,
    })

    // Playback-follow: keep the playing measure inside the viewport. We react only when the
    // measure number changes (not every position tick), and viewport.ensureVisible self-gates —
    // it scrolls only when the measure nears the window edge — so this pages along by ~a line
    // without continuous jitter. Reset on (re)start so playback re-follows from the top.
    let lastFollowedMeasure = -1
    engine.value.setPlaybackCallbacks({
      onStateChange: s => {
        state.playbackState = s
        if (s === 'playing') lastFollowedMeasure = -1
      },
      onPositionChange: pos => {
        if (pos.measure === lastFollowedMeasure) return
        lastFollowedMeasure = pos.measure
        const rect = engine.value?.getMeasureRect(pos.measure)
        if (rect) viewport.ensureVisible(rect)
      },
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
/*
 * Notation rendering styles (cursor ghosts, selection highlight) now live with
 * the engine in src/engine/rendering/notation.css, imported by VexFlowRenderer.
 * Keep only app-layout styles here.
 */

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
