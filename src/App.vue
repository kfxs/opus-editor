<template>
  <div class="min-h-screen bg-gray-900 text-white p-8">
    <div class="mb-8">
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="mb-4 flex gap-2 flex-wrap">
          <button
            class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            @click="openTestWindow"
          >
            Lorem Window
          </button>
          <div class="border-l border-gray-600 mx-2" />

          <!-- Tool Mode Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Tool:</span>
            <button
              :class="[
                'px-3 py-1 rounded text-sm',
                state.selectedTool === 'entry'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Note Entry Tool"
              @click="state.selectedTool = 'entry'; state.selectedNoteId = null"
            >
              Entry
            </button>
            <button
              :class="[
                'px-3 py-1 rounded text-sm',
                state.selectedTool === 'selection'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Selection Tool"
              @click="palette.disarmPositionalTools(); state.selectedTool = 'selection'"
            >
              Select
            </button>
          </div>

          <div class="border-l border-gray-600 mx-2" />

          <!-- View mode: wrapped systems vs one endless system (docs/linear-view-plan.md) -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">View:</span>
            <button
              :class="[
                'px-3 py-1 rounded text-sm',
                state.viewMode === 'wrapped'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Wrapped view — music broken into stacked systems (Ctrl+Shift+L toggles)"
              @click="palette.setViewMode('wrapped')"
            >
              Wrapped
            </button>
            <button
              :class="[
                'px-3 py-1 rounded text-sm',
                state.viewMode === 'linear'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Linear view — one endless system, scroll left to right (Ctrl+Shift+L toggles)"
              @click="palette.setViewMode('linear')"
            >
              Linear
            </button>
          </div>

          <div class="border-l border-gray-600 mx-2" />

          <!-- Voice Selector (Sibelius-style: V1 blue, V2 green) -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Voice:</span>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.activeVoice === 1
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Voice 1 (Alt+1) — primary stream"
              @click="palette.setActiveVoice(1)"
            >
              1
            </button>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.activeVoice === 2
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Voice 2 (Alt+2) — second stream"
              @click="palette.setActiveVoice(2)"
            >
              2
            </button>
          </div>

          <div class="border-l border-gray-600 mx-2" />

          <!-- Note Duration Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Duration:</span>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                highlightedDuration === 'w'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Whole note (Redonda) - 4 beats"
              @click="palette.setDuration('w')"
            >
              𝅝
            </button>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                highlightedDuration === 'h'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Half note (Blanca) - 2 beats"
              @click="palette.setDuration('h')"
            >
              𝅗𝅥
            </button>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                highlightedDuration === 'q'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Quarter note (Negra) - 1 beat"
              @click="palette.setDuration('q')"
            >
              ♩
            </button>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                highlightedDuration === '8'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Eighth note (Corchea) - 0.5 beats"
              @click="palette.setDuration('8')"
            >
              ♪
            </button>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                highlightedDuration === '16'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Sixteenth note (Semicorchea) - 0.25 beats"
              @click="palette.setDuration('16')"
            >
              𝅘𝅥𝅯
            </button>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                highlightedDuration === '32'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Thirty-second note (Fusa) - 0.125 beats"
              @click="palette.setDuration('32')"
            >
              𝅘𝅥𝅰
            </button>
          </div>


          <!-- Tuplet Selector -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Tuplet:</span>
            <button
              :class="[
                'px-3 py-1 rounded text-sm font-bold',
                state.tupletMode
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Toggle triplet mode (T) - creates 3 notes in space of 2"
              @click="palette.toggleTuplet()"
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
              :class="[
                'px-2 py-1 rounded text-xs',
                state.selectedBeam === b
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              :title="`Beam: ${b}`"
              @click="palette.setBeam(b)"
            >
              {{ b }}
            </button>
          </div>

          <!-- Time Signature Tool -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Time:</span>
            <button
              v-for="ts in timeSignaturePresets"
              :key="`${ts.numerator}/${ts.denominator}`"
              :class="[
                'px-2 py-1 rounded text-sm font-bold leading-none tabular-nums',
                isTimeSignatureArmed(ts)
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              :title="`${ts.numerator}/${ts.denominator} — click a measure to set its time signature`"
              @click="palette.setTimeSignature({ numerator: ts.numerator, denominator: ts.denominator })"
            >
              {{ ts.numerator }}/{{ ts.denominator }}
            </button>
            <button
              :class="[
                'px-2 py-1 rounded text-sm leading-none',
                isCustomTimeSignatureArmed
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Custom time signature (any dyadic meter + optional grouping)"
              @click="openTimeSignatureDialog"
            >
              Custom…
            </button>
            <button
              class="px-2 py-1 rounded text-sm leading-none bg-gray-600 hover:bg-gray-500"
              title="Pickup / anacrusis bar (set a measure's actual length shorter than its time signature)"
              @click="openPickupDialog"
            >
              Pickup…
            </button>
          </div>

          <!-- Tempo Tool — a word, a metronome mark, or both. System-level: one mark
               governs the whole score, whichever staff you click. -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span
              class="text-sm"
              :class="state.selectedTempoId ? 'text-amber-400 font-semibold' : 'text-gray-300'"
            >
              {{ state.selectedTempoId ? 'Tempo ✎:' : 'Tempo:' }}
            </span>
            <button
              v-for="w in tempoWords"
              :key="w.text"
              :class="[
                'px-2 py-1 rounded text-sm italic leading-none',
                isTempoArmed({ text: w.text, bpm: w.bpm, unit: 'q', showMetronome: tempoShowMetronome })
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              :title="state.selectedTempoId
                ? `Change the selected mark to ${w.text} (♩ = ${w.bpm})`
                : `${w.text} (♩ = ${w.bpm}) — click a beat to place it. The word sounds even when the number is hidden.`"
              @click="palette.setTempo({ text: w.text, bpm: w.bpm, unit: 'q', showMetronome: tempoShowMetronome })"
            >
              {{ w.text }}
            </button>

            <span class="w-px h-5 bg-gray-600" />

            <!-- Metronome-only: unit + dots + bpm, no word. -->
            <select
              v-model="tempoUnit"
              class="bg-gray-600 rounded text-sm px-1 py-1 leading-none"
              title="Metronome beat unit — ♩ = 60 and 𝅗𝅥 = 60 are different speeds"
            >
              <option
                v-for="u in tempoUnits"
                :key="u.value"
                :value="u.value"
              >
                {{ u.glyph }}
              </option>
            </select>
            <button
              :class="[
                'px-2 py-1 rounded text-sm leading-none',
                tempoDots === 1 ? 'bg-cyan-600 text-white' : 'bg-gray-600 hover:bg-gray-500'
              ]"
              title="Dotted beat unit (♩. = 60 is 90 quarter-notes per minute, not 60)"
              @click="tempoDots = tempoDots === 1 ? 0 : 1"
            >
              .
            </button>
            <input
              v-model.number="tempoBpm"
              type="number"
              min="20"
              max="300"
              class="w-16 bg-gray-600 rounded text-sm px-2 py-1 leading-none"
              title="Beats per minute — of the chosen unit, not of a quarter"
            >
            <button
              :class="[
                'px-2 py-1 rounded text-sm leading-none',
                isTempoArmed({ unit: tempoUnit, dots: tempoDots, bpm: tempoBpm, showMetronome: true })
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500'
              ]"
              :title="state.selectedTempoId
                ? `Set the selected mark's metronome to ${metronomePreview} (its word is kept)`
                : `Place ${metronomePreview} on its own (no word) — click a beat`"
              @click="palette.setTempo({ unit: tempoUnit, dots: tempoDots, bpm: tempoBpm, showMetronome: true })"
            >
              {{ metronomePreview }}
            </button>

            <label
              class="flex items-center gap-1 text-xs text-gray-300"
              title="Print the ♩ = N next to the word? The word sounds either way."
            >
              <input
                v-model="tempoShowMetronome"
                type="checkbox"
              >
              show ♩=
            </label>
          </div>

          <!-- Add Measure (relative to the box-selected measure span; Ctrl+Shift+click a bar) -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Measure:</span>
            <button
              :disabled="!hasMeasureContext"
              class="px-2 py-1 rounded text-sm leading-none bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Insert an empty measure before the selected bar — Ctrl+Shift+click a measure to select it first"
              @click="palette.addMeasureBefore()"
            >
              + Before
            </button>
            <button
              :disabled="!hasMeasureContext"
              class="px-2 py-1 rounded text-sm leading-none bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Insert an empty measure after the selected bar — Ctrl+Shift+click a measure to select it first"
              @click="palette.addMeasureAfter()"
            >
              + After
            </button>
          </div>

          <!-- Add Staff (relative to the plain-click-selected bar's staff; click empty space in a bar) -->
          <div class="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded">
            <span class="text-sm text-gray-300">Staff:</span>
            <button
              :disabled="!hasStaffContext"
              class="px-2 py-1 rounded text-sm leading-none bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Add a staff above the selected bar's staff — click empty space in a measure to select it first"
              @click="palette.addStaffAbove()"
            >
              + Above
            </button>
            <button
              :disabled="!hasStaffContext"
              class="px-2 py-1 rounded text-sm leading-none bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Add a staff below the selected bar's staff — click empty space in a measure to select it first"
              @click="palette.addStaffBelow()"
            >
              + Below
            </button>
          </div>

          <div class="border-l border-gray-600 mx-2" />
          <button
            :class="[
              'px-4 py-2 rounded min-w-[80px]',
              state.playbackState === 'playing'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-purple-600 hover:bg-purple-700',
            ]"
            @click="togglePlayback"
          >
            {{ state.playbackState === 'playing' ? '⏹ Stop' : '▶ Play' }}
          </button>

          <!--
            ⚠️ TEMPORARY dev-only sound picker — NOT a final editor feature. Lets us audition
            GM timbres during development; the choice is not persisted (not in score/JSON) and
            takes effect on the next Play. Deliberately styled as scaffolding (dashed amber,
            🔧 DEV). Remove this block + onDevSoundChange + DEV_SOUNDS when a real per-staff
            instrument model is designed.
          -->
          <label
            class="flex items-center gap-1 ml-2 px-2 py-1 rounded border border-dashed border-amber-500/70 text-amber-300 text-xs"
            title="Temporary dev-only sound picker — not a final editor feature. Applies on next Play."
          >
            🔧 DEV sound:
            <select
              v-model.number="devSoundProgram"
              class="bg-gray-700 rounded px-1 py-0.5 text-white text-xs"
              @change="onDevSoundChange"
            >
              <option
                v-for="s in DEV_SOUNDS"
                :key="s.program"
                :value="s.program"
              >{{ s.label }}</option>
            </select>
          </label>
        </div>

        <!--
          Score area = fixed-size viewport (owns scroll) + inner content surface (holds the SVG).
          The OUTER div keeps the `scoreCanvas` ref: it owns scrolling (read by
          scrollSelectedNoteIntoView) and the svg is a descendant so `scoreCanvas.querySelector('svg')`
          still works. The INNER div is the engine container — VexFlow wipes it with innerHTML='' on
          every render, so it must NOT be the outer scroll box. Padding stays on the inner surface so
          bbox coords stay aligned with the viewport scroll. See docs/navigation-viewport-plan.md §4.
        -->
        <!-- Positioning context for the linear-view gutter, which is pinned OUTSIDE the scroll
             box (a child of it would scroll away with the music — the one thing it must not do).
             overflow-hidden clips it: the gutter tracks the score SVG's vertical bounds, so when
             the music is scrolled it hangs past the top/bottom of the window. -->
        <div
          ref="scoreViewport"
          class="relative overflow-hidden rounded-lg"
        >
          <div
            ref="scoreCanvas"
            class="score-container bg-slate-200 rounded-lg overflow-auto"
            :class="scoreCursorClass(state)"
            :style="{ height: viewportHeight }"
            @click="(e) => mouse.handleClick(e)"
            @mousedown="(e) => mouse.handleMouseDown(e)"
            @mousemove="(e) => mouse.handleMouseMove(e)"
            @mouseup="(e) => mouse.handleMouseUp(e)"
            @mouseleave="mouse.handleMouseLeave()"
          >
            <!--
            Zoom DOM (docs/zoom-plan.md §3): the `sizer` takes an explicit size = naturalSvgSize ×
            zoom so the scroll bars get their range; the `zoomLayer` carries transform: scale(zoom)
            so the visuals scale without a re-render. useViewport writes both from the same scalar.
          -->
            <div
              ref="scoreSizer"
              class="score-sizer"
            >
              <div
                ref="scoreZoomLayer"
                class="score-zoom-layer"
              >
                <div
                  ref="scoreContent"
                  class="p-4"
                />
                <!--
                Playback cursor — a green vertical bar at the start of the playing measure.
                Sibling of scoreContent INSIDE the zoomLayer (NOT a child of scoreContent, which
                VexFlow wipes with innerHTML='' every render). Living in the scaled layer, it scales
                and scrolls with the music for free, so its translate stays pure layout coords.
              -->
                <div
                  v-show="playCursor.visible"
                  class="play-cursor"
                  :style="{ transform: `translate(${playCursor.x}px, ${playCursor.y}px)`, height: `${playCursor.height}px` }"
                />
              </div>
            </div>
          </div>

          <!--
            The frozen left gutter (docs/linear-view-plan.md §P3) — the clef and meter in force at
            the current scroll-x, so they stay readable at bar 400. A SEPARATE, DOM-pinned SVG:
            drawing it into the score SVG at scrollX would re-render the whole score on every
            scroll event. It also sits outside the zoom layer, so useGutter applies the zoom
            scalar (and the content padding) by hand. Linear view only.
          -->
          <div
            v-if="state.viewMode === 'linear'"
            ref="scoreGutter"
            class="score-gutter bg-slate-200"
          />
        </div>
      </div>
    </div>

    <div class="bg-gray-800 p-4 rounded-lg text-left">
      <h3 class="text-xl mb-2">
        Score JSON:
      </h3>
      <pre class="bg-gray-900 p-4 rounded overflow-auto text-xs max-h-96">{{ scoreJSON }}</pre>
    </div>

    <!-- Custom time-signature dialog -->
    <div
      v-if="showTimeSignatureDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showTimeSignatureDialog = false"
    >
      <div
        class="bg-gray-800 rounded-lg p-6 w-80 text-left shadow-xl"
        @keydown.enter="applyCustomTimeSignature"
      >
        <h3 class="text-lg font-semibold mb-4">
          Custom Time Signature
        </h3>

        <div class="flex items-center gap-3 mb-3">
          <label class="text-sm text-gray-300 w-24">Numerator</label>
          <input
            v-model.number="tsNumerator"
            type="number"
            min="1"
            step="1"
            class="flex-1 bg-gray-700 rounded px-2 py-1 text-white"
          >
        </div>

        <div class="flex items-center gap-3 mb-3">
          <label class="text-sm text-gray-300 w-24">Denominator</label>
          <select
            v-model.number="tsDenominator"
            class="flex-1 bg-gray-700 rounded px-2 py-1 text-white"
          >
            <option
              v-for="d in tsDenominatorOptions"
              :key="d"
              :value="d"
            >
              {{ d }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-3 mb-1">
          <label class="text-sm text-gray-300 w-24">Grouping</label>
          <input
            v-model="tsGrouping"
            type="text"
            placeholder="optional, e.g. 2+2+3"
            class="flex-1 bg-gray-700 rounded px-2 py-1 text-white"
          >
        </div>
        <p class="text-xs text-gray-400 mb-3 ml-[6.75rem]">
          In denominator units; must sum to the numerator.
        </p>

        <p
          v-if="tsDialogError"
          class="text-sm text-red-400 mb-3"
        >
          {{ tsDialogError }}
        </p>

        <div class="flex justify-end gap-2 mt-2">
          <button
            class="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-sm"
            @click="showTimeSignatureDialog = false"
          >
            Cancel
          </button>
          <button
            :disabled="!!tsDialogError"
            class="px-3 py-1 rounded text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
            @click="applyCustomTimeSignature"
          >
            Arm
          </button>
        </div>
      </div>
    </div>

    <!-- Pickup / anacrusis dialog -->
    <div
      v-if="showPickupDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showPickupDialog = false"
    >
      <div
        class="bg-gray-800 rounded-lg p-6 w-80 text-left shadow-xl"
        @keydown.enter="applyPickup"
      >
        <h3 class="text-lg font-semibold mb-4">
          Pickup / Anacrusis Bar
        </h3>

        <div class="flex items-center gap-3 mb-3">
          <label class="text-sm text-gray-300 w-24">Measure</label>
          <input
            v-model.number="pickupMeasure"
            type="number"
            min="1"
            step="1"
            class="flex-1 bg-gray-700 rounded px-2 py-1 text-white"
          >
        </div>

        <div class="flex items-center gap-3 mb-1">
          <label class="text-sm text-gray-300 w-24">Pickup length</label>
          <input
            v-model.number="pickupNumerator"
            type="number"
            min="1"
            step="1"
            class="w-16 bg-gray-700 rounded px-2 py-1 text-white"
          >
          <span class="text-gray-400">/</span>
          <select
            v-model.number="pickupDenominator"
            class="flex-1 bg-gray-700 rounded px-2 py-1 text-white"
          >
            <option
              v-for="d in tsDenominatorOptions"
              :key="d"
              :value="d"
            >
              {{ d }}
            </option>
          </select>
        </div>
        <p class="text-xs text-gray-400 mb-3 ml-[6.75rem]">
          Actual bar length; must be shorter than the full bar (e.g. 1/4 = one beat).
        </p>

        <p
          v-if="pickupDialogError"
          class="text-sm text-red-400 mb-3"
        >
          {{ pickupDialogError }}
        </p>

        <div class="flex justify-end gap-2 mt-2">
          <button
            class="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-sm"
            @click="showPickupDialog = false"
          >
            Cancel
          </button>
          <button
            class="px-3 py-1 rounded text-sm bg-gray-600 hover:bg-gray-500"
            title="Remove the pickup, restoring the full bar"
            @click="clearPickup"
          >
            Clear
          </button>
          <button
            :disabled="!!pickupDialogError"
            class="px-3 py-1 rounded text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
            @click="applyPickup"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { dbg } from '@/utils/debug'
import { ref, shallowRef, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { MusicEngine } from './engine/MusicEngine'
// ⚠️ TEMPORARY dev-only sound picker — remove when a real instrument model lands.
import { DEV_SOUNDS } from './engine/audio/WebAudioFontInstrument'
import { VIEWPORT_HEIGHT } from './engine/rendering/VexFlowRenderer'
import { createObservableEditorState, armedTool, scoreCursorClass } from './interactions/EditorState'
import type { TempoTool } from './interactions/EditorState'
import type { NoteDuration } from './types/music'
import { useHighlight } from './composables/useHighlight'
import { useRenderer } from './composables/useRenderer'
import { useSelection } from './composables/useSelection'
import { usePalette } from './composables/usePalette'
import { useKeyboardEntry } from './composables/useKeyboardEntry'
import { useMouseInteraction } from './composables/useMouseInteraction'
import { useTextEditing } from './composables/useTextEditing'
import { useViewport } from './composables/useViewport'
import { useGutter } from './composables/useGutter'
import { useShortcuts } from './composables/useShortcuts'
import { renderCensus, buildSyntheticScore } from './dev/renderCensus' // P0 instrument — temporary
import { ClipboardController } from './interactions/ClipboardController'
import { windows } from './windows'
import { menuActions } from './menus'
import { wireKeypadSync, noNoteInSelection } from './interactions/keypadSync'
import { openLoremWindow } from './windows/demo/loremWindows'
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
// Zoom DOM (docs/zoom-plan.md §3): sizer gives the scroll range (naturalSvgSize × zoom),
// zoomLayer carries transform: scale(zoom). Both written by useViewport from one scalar.
const scoreSizer = ref<HTMLElement | null>(null)
const scoreZoomLayer = ref<HTMLElement | null>(null)
// Linear view's frozen gutter — pinned OUTSIDE the scroll box and outside the zoom layer.
const scoreGutter = ref<HTMLElement | null>(null)
// The viewport wrapper: the score's positioning context, and the world the windows live in.
const scoreViewport = ref<HTMLElement | null>(null)
// Fixed viewport height (≈ two staff lines) so the JSON panel below stays visible.
const viewportHeight = `${VIEWPORT_HEIGHT}px`

// --- All editor state in one reactive plain object ---
// The editor state carries its OWN change-notification (an emitting Proxy, framework-agnostic —
// see docs/observable-editorstate-plan.md). Vue wraps that Proxy: one assignment fires BOTH Vue's
// dependents and the plain-TS `onStateChange` subscribers. ⚠️ One-write-path rule during the Vue
// transition: every writer holds the Vue-wrapped `state`; `bareState` never escapes to anything
// that writes, or that write goes invisible to Vue's templates.
const { state: bareState, subscribe: onStateChange } = createObservableEditorState()
const state = reactive(bareState)

// Playback cursor: a green vertical bar pinned to the start of the playing measure.
// Pure view state (pixel position in content coords) — the engine stays the source of
// truth via getMeasureRect, so a non-Vue port just re-draws the same rect its own way.
const playCursor = reactive({ visible: false, x: 0, y: 0, height: 0 })
// scoreContent's own padding (Tailwind p-4 = 1rem). The cursor is a child of scoreCanvas
// (the scroll box) while measure bounds are in the SVG's space, which starts inside this
// padding — so we shift the cursor by it to line up with the staves.
const CONTENT_PADDING = 16

// Ctrl+wheel (and trackpad pinch) zoom sensitivity: factor = exp(-deltaY · k), so zoom is
// continuous and multiplicative. Tuned so one mouse notch (~100px deltaY) ≈ a ~15% step while a
// trackpad pinch stays smooth. See docs/zoom-plan.md §7 Phase 3.
const ZOOM_WHEEL_K = 0.0015

// --- Wire up controllers in dependency order ---
// HighlightController has no deps on other controllers
const highlight = useHighlight(state, engine, scoreCanvas)

// RenderController depends on HighlightController
// A render can move the music under a fixed scroll-x, so the gutter refreshes after each one.
const renderer = useRenderer(state, engine, highlight, () => gutter.refresh())

// ViewportModel ⇄ DOM scroll wiring (the only DOM-aware viewport piece). Keeps a pure
// ViewportModel in sync with the outer scroll box and inner content surface, and exposes
// ensureVisible for scroll-into-view. onMounted/onUnmounted run inside the composable.
const viewport = useViewport(
  scoreCanvas, scoreContent, scoreSizer, scoreZoomLayer,
  () => onViewChange(),
)

/**
 * Scroll / zoom / resize settled. Two things hang off it.
 *
 * The gutter, because it is the one thing on screen that a scroll changes without the score
 * re-rendering — and, since P6, the **virtualization window**: the engine is told where the user is
 * looking, and re-engraves only if the viewport has escaped the strip of music it already drew
 * (`setVisibleRect` answers that; it is false for almost every scroll event, so this stays the free
 * CSS scroll it was). The render goes through `renderer.renderScore()` rather than the engine
 * directly, so a note scrolling back into view is repainted *with its highlight*.
 */
function onViewChange(): void {
  const e = engine.value
  if (e) {
    const v = viewport.model.getVisibleRect()
    // The viewport rect is measured from the zoom layer's origin, which sits CONTENT_PADDING inside
    // the SVG's; measure boxes are in the SVG's own space. Shift to match.
    const needsRender = e.setVisibleRect({
      x: v.x - CONTENT_PADDING,
      y: v.y - CONTENT_PADDING,
      width: v.width,
      height: v.height,
    })
    if (needsRender) renderer.renderScore()
  }
  gutter.refresh()
}

// Linear view's frozen left gutter (clef + meter in force at the current scroll-x).
const gutter = useGutter(engine, scoreGutter, scoreContent, viewport)

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
  (c) => renderer.renderToolGhost(c),
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
mouse = useMouseInteraction(state, engine, scoreCanvas, selection, renderer, palette, textEdit, clipboard, (dx, dy) => viewport.scrollBy(dx, dy), () => viewport.model.getZoom())

// Hand the Insert menu its command callbacks. The menu itself lives in plain TS (src/menus); this is
// the one glue line that lends it a controller — Insert ▸ Text ▸ Expression runs the same action as Ctrl+E.
menuActions.insertExpression = () => mouse.insertExpression()
menuActions.insertTempo = () => mouse.insertTempo()

// ShortcutManager — wires keyboard shortcuts to controller actions
const shortcuts = useShortcuts(
  state, engine,
  selection, palette, keyboard, renderer, clipboard,
  viewport,
  () => mouse.getLastMousePosition(),
  () => mouse.insertExpression(),
  () => mouse.insertTempo(),
  () => mouse.editSelectedDynamic(),
)

// While a hand/grab pan is active, hide the OS pointer everywhere — not just over the
// score — so it stays hidden when the drag crosses the viewport edge. (The score element
// also carries `cursor-none` for the common in-bounds case; this covers off-bounds.)
watch(() => state.isPanning, (panning) => {
  document.body.style.cursor = panning ? 'none' : ''
})

// The duration/accidental to HIGHLIGHT — the rule, in one place. A value is shown only when it means
// something: in entry mode (the armed value), or in selection mode with a note selected (the note's,
// kept in sync by SelectionController). Select a non-note or clear the canvas and there is no note to
// reflect, so nothing is highlighted — in the Vue palette AND the Keypad.
// These two computeds highlight the VUE palette's own buttons (the template binds them). The
// shared `noNoteInSelection` rule and the Keypad's read-sync now live in interactions/keypadSync;
// these are just Vue rendering itself — one subscriber among many.
const highlightedDuration = computed<NoteDuration | null>(() =>
  noNoteInSelection(state) ? null : state.selectedDuration,
)

// The cord-cut: the Keypad's five wired controls (duration, accidental, articulation, dot, tie) sync
// through the state's OWN change-notification (`onStateChange`), NOT through Vue watches. All the
// highlight rules and press routes moved into interactions/keypadSync — no Vue in the Keypad's loop.
// When the Vue palette goes, this one call stays; only its `subscribe` argument loses the Vue wrapper.
const stopKeypadSync = wireKeypadSync(state, palette, onStateChange)

// --- Computed ---
// Dev-only Score JSON viewer. The engine's ScoreModel isn't a Vue reactive object, so a
// `computed` never sees edits — just poll it into a ref. Cheap and easy to rip out later.
const scoreJSON = ref('{}')
let scoreJSONTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  scoreJSONTimer = setInterval(() => {
    scoreJSON.value = engine.value?.exportJSON() || '{}'
  }, 400)
})
onUnmounted(() => {
  if (scoreJSONTimer) clearInterval(scoreJSONTimer)
})

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
  const sel = armedTool(state, 'timeSignature')?.timeSignature
  return !!sel && sel.numerator === ts.numerator && sel.denominator === ts.denominator
}

// --- Dynamics tool ---
// Interpreted levels drive playback loudness; the custom mark is silent italic text.
// The custom mark drops a "Text" placeholder; editing it in place is a later feature.
// --- Tempo tool ---
// A tempo mark is ONE object with three display settings: a word, a metronome mark, or
// both ("Allegro (♩ = 120)"). The word ALWAYS sounds — `showMetronome` decides only
// whether the number is printed (decision D1). The words below are PRESETS that pre-fill
// free text + a conventional bpm, not an enum of legal values (D2): both stay editable,
// and renaming the word never moves the tempo.
const tempoWords = [
  { text: 'Grave', bpm: 35 },
  { text: 'Largo', bpm: 50 },
  { text: 'Adagio', bpm: 65 },
  { text: 'Andante', bpm: 90 },
  { text: 'Moderato', bpm: 112 },
  { text: 'Allegro', bpm: 144 },
  { text: 'Presto', bpm: 185 },
] as const

// The beat unit is half the meaning: ♩ = 60, ♩. = 60 and 𝅗𝅥 = 60 are three different speeds.
const tempoUnits = [
  { value: 'h', glyph: '𝅗𝅥' },
  { value: 'q', glyph: '♩' },
  { value: '8', glyph: '♪' },
] as const

const tempoUnit = ref<NoteDuration>('q')
const tempoDots = ref(0)
const tempoBpm = ref(120)
const tempoShowMetronome = ref(true)

/** What the metronome-only button will place, e.g. "♩. = 120" — so the button shows the mark
 *  rather than a bare "=". A metronome mark with no word prints exactly this (VexFlow only
 *  adds the parentheses when a word is present). */
const metronomePreview = computed(() => {
  const glyph = tempoUnits.find(u => u.value === tempoUnit.value)?.glyph ?? '♩'
  return `${glyph}${tempoDots.value === 1 ? '.' : ''} = ${tempoBpm.value}`
})

/** Is this exact preset the one currently armed? (Mirrors PaletteController.sameTempoTool.) */
function isTempoArmed(tool: TempoTool): boolean {
  const armed = armedTool(state, 'tempo')?.tempo
  if (!armed) return false
  return armed.text === tool.text && armed.unit === tool.unit && armed.dots === tool.dots
    && armed.bpm === tool.bpm && armed.showMetronome === tool.showMetronome
}

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
  const sel = armedTool(state, 'timeSignature')?.timeSignature
  if (!sel) return false
  return !timeSignaturePresets.some(p => p.numerator === sel.numerator && p.denominator === sel.denominator && !sel.grouping)
})

// The two toolbar groups are driven by DIFFERENT measure-selection gestures (they're
// different concerns): the "Add Measure" buttons work on a Ctrl+Shift+click span (the DOUBLE
// box) — a measure-structure edit — while the "Staff:" add-above/below buttons work on a
// plain-click bar (the SINGLE box) — a staff-structure edit relative to the clicked staff.
const hasMeasureContext = computed(() =>
  state.selectedMeasureRange !== null && state.selectedMeasureBoxStyle === 'double')
const hasStaffContext = computed(() =>
  state.selectedMeasureRange !== null && state.selectedMeasureBoxStyle === 'single')

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
// Ctrl+wheel zoom toward the cursor. A window-level listener registered { passive: false } so
// preventDefault() actually kills the browser's page-zoom — done whenever Ctrl is held, regardless
// of whether the pointer is over the score ("zoom is always score zoom", docs/zoom-plan.md §7).
function handleZoomWheel(e: WheelEvent) {
  if (!e.ctrlKey) return
  e.preventDefault()
  const el = scoreCanvas.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  // Focal = cursor relative to the viewport, clamped inside it so an out-of-bounds pointer still
  // zooms toward the nearest edge rather than off-screen.
  const focal = {
    x: Math.min(Math.max(e.clientX - rect.left, 0), el.clientWidth),
    y: Math.min(Math.max(e.clientY - rect.top, 0), el.clientHeight),
  }
  viewport.zoomAt(Math.exp(-e.deltaY * ZOOM_WHEEL_K), focal)
}

onMounted(() => {
  window.addEventListener('wheel', handleZoomWheel, { passive: false })
  // Mounted INSIDE the viewport wrapper but OUTSIDE the scroll box (a sibling of it), so a window
  // lives in the score area — clipped to it, and clamped to it when dragged — while sitting outside
  // the transform: scale(zoom) layer: it neither scrolls away with the music nor zooms with it.
  if (scoreViewport.value) windows.mount(scoreViewport.value)
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
        // Hide the cursor whenever we're not actively playing (stop/pause).
        else playCursor.visible = false
      },
      onPositionChange: pos => {
        if (pos.measure === lastFollowedMeasure) return
        lastFollowedMeasure = pos.measure
        const rect = engine.value?.getMeasureRect(pos.measure)
        if (rect) {
          viewport.ensureVisible(rect)
          // Pin the green bar to the measure's left edge (start). Per-measure granularity
          // for now; beat-level gliding would interpolate within rect using pos.beat.
          playCursor.x = rect.x + CONTENT_PADDING
          playCursor.y = rect.y + CONTENT_PADDING
          playCursor.height = rect.height
          playCursor.visible = true
        }
      },
      onPlaybackComplete: () => { state.playbackState = 'stopped'; playCursor.visible = false },
    })

    shortcuts.enable()
    initializeEmptyScore()
    renderer.renderScore()
    // Now that the engine exists, hand it the window (P6). The first render above drew the whole
    // score, because until this moment nothing had told the engine where the viewport is. Doing it
    // explicitly rather than waiting for the next scroll/resize observer to fire keeps the moment
    // culling switches on deterministic.
    onViewChange()
    installPerfInstruments()
  }
})

/**
 * TEMPORARY — the P0 render-performance instrument (docs/render-performance-plan.md §8).
 * Dev builds only; delete when P0 closes. From the DevTools console:
 *
 *   __perf.load(200)      // a synthetic 200-bar score (4 quarters/bar), same density as the bench
 *   __census.enable()     // start recording renders, tagged by what caused them
 *   …edit, click, hover…
 *   __census.dump()       // a table: renders per cause, and the layout:draw split per render
 */
function installPerfInstruments() {
  // Cast: this project has no vite/client types, and a temporary instrument shouldn't add one.
  if (!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return
  const w = window as unknown as Record<string, unknown>
  w.__census = renderCensus
  // Hit-box VISUALIZER (dev tool). Draws every registered hit-box as a coloured SVG rectangle right
  // on the score, so you can SEE which click-boxes are inflated or mis-placed — reads the registry,
  // which always holds the CURRENT boxes (no re-render needed). Born from docs/tight-bbox-plan.md §7
  // (it made the fat rest-carrying-a-dynamic box visible) and kept as a general debugging aid.
  // __bbox.show() draws all (labelled `type W×H`); __bbox.show('rest') filters to one type; __bbox.hide() clears.
  w.__bbox = {
    show: (only?: string) => {
      if (!engine.value) return
      const svg = document.querySelector('.score-container svg') as SVGSVGElement | null
      if (!svg) { console.warn('[bbox] no score <svg> found'); return }
      const NS = 'http://www.w3.org/2000/svg'
      svg.querySelector('#bbox-overlay')?.remove()
      const overlay = document.createElementNS(NS, 'g')
      overlay.setAttribute('id', 'bbox-overlay')
      const color: Record<string, string> = {
        rest: '#e11d48', note: '#2563eb', dynamic: '#16a34a', accidental: '#d97706',
        articulation: '#9333ea', dot: '#0891b2', clef: '#7c3aed', timeSignature: '#be185d',
      }
      let n = 0
      for (const el of engine.value.getElementRegistry().getAll()) {
        if (only && el.type !== only) continue
        const b = el.bbox
        if (!b || b.width <= 0 || b.height <= 0) continue
        const c = color[el.type] ?? '#64748b'
        const rect = document.createElementNS(NS, 'rect')
        rect.setAttribute('x', String(b.x)); rect.setAttribute('y', String(b.y))
        rect.setAttribute('width', String(b.width)); rect.setAttribute('height', String(b.height))
        rect.setAttribute('fill', c); rect.setAttribute('fill-opacity', '0.1')
        rect.setAttribute('stroke', c); rect.setAttribute('stroke-width', el.type === 'rest' ? '1.5' : '0.75')
        overlay.appendChild(rect)
        const label = document.createElementNS(NS, 'text')
        label.setAttribute('x', String(b.x)); label.setAttribute('y', String(b.y - 1))
        label.setAttribute('fill', c); label.setAttribute('font-size', '6')
        label.textContent = `${el.type} ${Math.round(b.width)}×${Math.round(b.height)}`
        overlay.appendChild(label)
        n++
      }
      svg.appendChild(overlay)
      console.log(`[bbox] drew ${n} hit-box(es)${only ? ` type=${only}` : ''}. Rest boxes are red. __bbox.hide() to clear.`)
    },
    hide: () => {
      document.querySelector('#bbox-overlay')?.remove()
      console.log('[bbox] overlay cleared')
    },
  }
  w.__perf = {
    load: (bars: number, staves = 1) => {
      if (!engine.value) return
      selection.selectNote(null)
      engine.value.loadJSON(buildSyntheticScore(bars, staves))
      renderer.renderScore()
      dbg(`[perf] loaded ${bars} bars × ${staves} staves`)
    },
  }
  dbg('[perf] P0 instruments: __perf.load(200), __census.enable(), __census.dump()')
  dbg('[bbox] hit-box visualizer: __bbox.show() / __bbox.show(\'rest\') / __bbox.hide()')
}

onUnmounted(() => {
  window.removeEventListener('wheel', handleZoomWheel)
  shortcuts.disable()
  stopKeypadSync()
  windows.destroy()
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

/**
 * What a window CONTAINS is plain TS (src/windows/demo/loremWindows.ts) — composing widgets has
 * nothing to do with Vue. App.vue's entire share of the window system is two lines — mount the layer
 * and destroy it — because Vue owns the DOM node and the lifecycle, and nothing more. The layer
 * itself lives in src/windows/index.ts, so a window can be opened from anywhere without touching
 * this file at all. See docs/windows-design.md.
 */
function openTestWindow(): void {
  openLoremWindow(windows)
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

// ⚠️ TEMPORARY dev-only sound picker. Which GM program the whole score plays as, for
// auditioning timbres during development. NOT persisted (not in score/JSON/undo) and NOT a
// final editor feature — delete this + the markup + DEV_SOUNDS when the real instrument
// model is designed. Change takes effect on the next Play (current playback keeps running).
const devSoundProgram = ref(DEV_SOUNDS[0].program)
function onDevSoundChange() {
  engine.value?.setInstrumentProgram(devSoundProgram.value)
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
  /* position: relative makes this the containing block for the playback cursor, so the
     cursor's content-space coords resolve here and it scrolls together with the music. */
  position: relative;
  scrollbar-gutter: stable;
  user-select: none;
  -webkit-user-select: none;
}

/* Zoom DOM (docs/zoom-plan.md §3). The sizer's explicit width/height (set by useViewport =
   naturalSvgSize × zoom) is what the scroll box measures for its scroll range. The zoomLayer
   sits at the sizer's top-left and carries transform: scale(zoom) (origin 0 0, set in JS); it is
   also the containing block for the play-cursor, which therefore stays in pure layout coords. */
.score-sizer {
  position: relative;
}
.score-zoom-layer {
  position: absolute;
  top: 0;
  left: 0;
}

/* The score "paper": the SVG is transparent by default, so the gray container would show
   through it. Paint it white here (a stylesheet rule, since VexFlow rebuilds the SVG via
   innerHTML on every render and would drop an inline style). The SVG bounds match the sizer
   exactly (= natural SVG size × zoom), so white = the page and the surrounding gray = empty
   space — giving a visible boundary between the score and the viewport. */
.score-zoom-layer svg {
  background-color: #ffffff;
}

/* Linear view's frozen gutter (docs/linear-view-plan.md §P3): the clef in force at the current
   scroll-x, pinned to the left edge so it stays readable at bar 400. Absolutely positioned OVER
   the scroll box (a child of it would scroll away with the music) and outside the zoom layer — so
   GutterController applies the zoom scalar itself, and writes `top`/`height` to track the score
   SVG's own vertical bounds (the two whites must read as one sheet of paper).

   The divider is WHITE, not a rule: a dark line would read as a barline — an engraved mark in
   music that has none there. It exists only to stop the music's noteheads touching the frozen
   clef, so it should separate without drawing the eye. pointer-events:none keeps the music
   underneath clickable. */
.score-gutter {
  position: absolute;
  left: 0;
  pointer-events: none;
  overflow: hidden;
  border-right: 2px solid #ffffff;
}
.score-gutter svg {
  background-color: #ffffff;
}

/* Playback cursor: thin green bar at the start of the playing measure. Positioned via
   transform (left/top stay 0); pointer-events:none so it never blocks score clicks. */
.play-cursor {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background-color: #22c55e; /* green-500 */
  pointer-events: none;
  z-index: 5;
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
