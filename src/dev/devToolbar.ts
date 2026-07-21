import type { EditorState } from '../interactions/EditorState'
import type { PaletteController } from '../interactions/PaletteController'
import type { MusicEngine } from '../engine/MusicEngine'
import type { BeamMode, NoteDuration } from '../types/music'
import { durationHighlight } from '../interactions/keypadSync'
import { DEV_SOUNDS } from '../engine/audio/WebAudioFontInstrument'

/**
 * The development toolbar — **scaffolding, deliberately kept**.
 *
 * What is inside the score viewport is the application; this strip of buttons around it is a tool for
 * building it. It is temporary in intent but permanent enough to be useful, so it lives here in
 * `dev/` rather than pretending to be a feature. See docs/remove-vue-plan.md.
 *
 * THE SEAM: this file reads {@link EditorState} and calls the palette. Nothing inside the viewport
 * knows it exists, which is what makes deleting it one day a single `rm` rather than an excavation.
 *
 * Reactivity needs no framework here. Everything a button highlights is an EditorState field, so the
 * whole toolbar is ONE subscriber to the state's own change-notification that re-applies classes —
 * the same shape `wireKeypadSync` has used all along, and the Keypad is the proof it is enough.
 *
 * ⚠️ Tailwind scans source text for class names, so every class name below appears as a whole
 * literal. Never build one from fragments (`bg-${c}-600`) — it compiles, and the style silently
 * never ships.
 */

/** The lit / unlit halves of a toggle button, kept whole for Tailwind's scanner. */
const ON = 'bg-cyan-600 text-white'
const OFF = 'bg-gray-600 hover:bg-gray-500'

export interface DevToolbarDeps {
  state: EditorState
  palette: PaletteController
  getEngine: () => MusicEngine | null
  /** The state's own change-notification (NOT a framework's). Returns an unsubscribe. */
  onStateChange: (fn: () => void) => () => void
  /** Play/stop lives with the engine wiring in the app, not in the scaffolding. */
  togglePlayback: () => void
}

export interface DevToolbarHandle {
  destroy(): void
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** A labelled cluster of buttons — the `Tool:` / `Voice:` / `Duration:` groups. */
function group(label: string): HTMLDivElement {
  const box = el('div', 'flex items-center gap-2 bg-gray-700 px-3 py-1 rounded')
  box.appendChild(el('span', 'text-sm text-gray-300', label))
  return box
}

function divider(): HTMLDivElement {
  return el('div', 'border-l border-gray-600 mx-2')
}

export function mountDevToolbar(host: HTMLElement, deps: DevToolbarDeps): DevToolbarHandle {
  const { state, palette, getEngine, onStateChange, togglePlayback } = deps

  const row = el('div', 'mb-4 flex gap-2 flex-wrap')
  /** Re-applied on every state change; each entry owns one button's appearance. */
  const syncers: Array<() => void> = []

  /**
   * A button whose lit/unlit state is a question about editor state. `isOn` is re-asked on every
   * change rather than the caller pushing an update — the same "state is the truth, the control
   * mirrors it" direction the Keypad's seams use.
   */
  function toggle(
    parent: HTMLElement, base: string, label: string, title: string,
    isOn: () => boolean, onClick: () => void,
  ): HTMLButtonElement {
    const b = el('button', `${base} ${OFF}`, label)
    b.title = title
    b.addEventListener('click', onClick)
    syncers.push(() => { b.className = `${base} ${isOn() ? ON : OFF}` })
    parent.appendChild(b)
    return b
  }

  // --- Export PDF (took the seat of the Lorem window, the window-system demo the real windows
  //     have long since replaced). Async and slow-ish — a whole second engraving of the score —
  //     so the button says so and refuses to start twice. ---
  const exportPdf = el('button', 'bg-red-600 hover:bg-red-700 px-4 py-2 rounded', 'Export PDF')
  exportPdf.title = 'Export the whole score as a vector PDF'
  exportPdf.addEventListener('click', async () => {
    const engine = getEngine()
    if (!engine || exportPdf.disabled) return
    exportPdf.disabled = true
    exportPdf.textContent = 'Exporting…'
    try {
      // Imported on demand: the PDF writer and the outliner are ~600kB of machinery nobody who
      // never exports should download. The button is the only door to them.
      const { exportScorePdf } = await import('../engine/export/pdfExport')
      await exportScorePdf(engine.getScore())
    } catch (error) {
      console.error('PDF export failed:', error)
      window.alert(`PDF export failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      exportPdf.disabled = false
      exportPdf.textContent = 'Export PDF'
    }
  })
  row.appendChild(exportPdf)
  row.appendChild(divider())

  // --- Tool mode ---
  const toolBox = group('Tool:')
  const TOOL_BTN = 'px-3 py-1 rounded text-sm'
  toggle(toolBox, TOOL_BTN, 'Entry', 'Note Entry Tool',
    () => state.selectedTool === 'entry',
    () => { state.selectedTool = 'entry'; state.selectedNoteId = null })
  toggle(toolBox, TOOL_BTN, 'Select', 'Selection Tool',
    () => state.selectedTool === 'selection',
    () => { palette.disarmPositionalTools(); state.selectedTool = 'selection' })
  row.appendChild(toolBox)
  row.appendChild(divider())

  // --- View mode (docs/linear-view-plan.md) ---
  const viewBox = group('View:')
  toggle(viewBox, TOOL_BTN, 'Wrapped',
    'Wrapped view — music broken into stacked systems (Ctrl+Shift+L toggles)',
    () => state.viewMode === 'wrapped', () => palette.setViewMode('wrapped'))
  toggle(viewBox, TOOL_BTN, 'Linear',
    'Linear view — one endless system, scroll left to right (Ctrl+Shift+L toggles)',
    () => state.viewMode === 'linear', () => palette.setViewMode('linear'))
  row.appendChild(viewBox)
  row.appendChild(divider())

  // --- Voice (Sibelius-style: V1 blue, V2 green) ---
  const voiceBox = group('Voice:')
  const VOICE_BTN = 'px-3 py-1 rounded text-sm font-bold'
  const v1 = el('button', `${VOICE_BTN} ${OFF}`, '1')
  v1.title = 'Voice 1 (Alt+1) — primary stream'
  v1.addEventListener('click', () => palette.setActiveVoice(1))
  const v2 = el('button', `${VOICE_BTN} ${OFF}`, '2')
  v2.title = 'Voice 2 (Alt+2) — second stream'
  v2.addEventListener('click', () => palette.setActiveVoice(2))
  // The voice buttons light in their OWN colour, not the shared cyan — the blue/green pair is the
  // same code the noteheads carry, so the toolbar and the music agree at a glance.
  syncers.push(() => {
    v1.className = `${VOICE_BTN} ${state.activeVoice === 1 ? 'bg-blue-500 text-white' : OFF}`
    v2.className = `${VOICE_BTN} ${state.activeVoice === 2 ? 'bg-emerald-500 text-white' : OFF}`
  })
  voiceBox.append(v1, v2)
  row.appendChild(voiceBox)
  row.appendChild(divider())

  // --- Duration ---
  const DURATIONS: ReadonlyArray<{ d: NoteDuration; glyph: string; title: string }> = [
    { d: 'w', glyph: '𝅝', title: 'Whole note (Redonda) - 4 beats' },
    { d: 'h', glyph: '𝅗𝅥', title: 'Half note (Blanca) - 2 beats' },
    { d: 'q', glyph: '♩', title: 'Quarter note (Negra) - 1 beat' },
    { d: '8', glyph: '♪', title: 'Eighth note (Corchea) - 0.5 beats' },
    { d: '16', glyph: '𝅘𝅥𝅯', title: 'Sixteenth note (Semicorchea) - 0.25 beats' },
    { d: '32', glyph: '𝅘𝅥𝅰', title: 'Thirty-second note (Fusa) - 0.125 beats' },
  ]
  const durBox = group('Duration:')
  for (const { d, glyph, title } of DURATIONS) {
    // `durationHighlight` is THE rule (interactions/keypadSync), shared with the Keypad: a marking
    // tool arms into entry mode but enters no note, so the duration must go dark under an armed
    // clef — and stay lit under the armed REST, whose length these keys are.
    toggle(durBox, VOICE_BTN, glyph, title,
      () => durationHighlight(state) === d, () => palette.setDuration(d))
  }
  row.appendChild(durBox)

  // --- Beam ---
  const BEAMS: readonly BeamMode[] = ['auto', 'single', 'begin', 'continue', 'end']
  const beamBox = group('Beam:')
  for (const b of BEAMS) {
    toggle(beamBox, 'px-2 py-1 rounded text-xs', b, `Beam: ${b}`,
      () => state.selectedBeam === b, () => palette.setBeam(b))
  }
  row.appendChild(beamBox)

  /**
   * The two structure groups below are driven by DIFFERENT measure-selection gestures, because they
   * are different concerns: "Measure" works on a Ctrl+Shift+click span (the DOUBLE box) — a
   * measure-structure edit — while "Staff" works on a plain-clicked bar (the SINGLE box) — a
   * staff-structure edit relative to the clicked staff.
   */
  const ACTION_BTN = 'px-2 py-1 rounded text-sm leading-none bg-gray-600 hover:bg-gray-500 '
    + 'disabled:opacity-40 disabled:cursor-not-allowed'
  function action(
    parent: HTMLElement, label: string, title: string,
    isEnabled: () => boolean, onClick: () => void,
  ): void {
    const b = el('button', ACTION_BTN, label)
    b.title = title
    b.addEventListener('click', onClick)
    syncers.push(() => { b.disabled = !isEnabled() })
    parent.appendChild(b)
  }

  const hasMeasureContext = () =>
    state.selectedMeasureRange !== null && state.selectedMeasureBoxStyle === 'double'
  const hasStaffContext = () =>
    state.selectedMeasureRange !== null && state.selectedMeasureBoxStyle === 'single'

  const measureBox = group('Measure:')
  action(measureBox, '+ Before',
    'Insert an empty measure before the selected bar — Ctrl+Shift+click a measure to select it first',
    hasMeasureContext, () => palette.addMeasureBefore())
  action(measureBox, '+ After',
    'Insert an empty measure after the selected bar — Ctrl+Shift+click a measure to select it first',
    hasMeasureContext, () => palette.addMeasureAfter())
  row.appendChild(measureBox)

  const staffBox = group('Staff:')
  action(staffBox, '+ Above',
    "Add a staff above the selected bar's staff — click empty space in a measure to select it first",
    hasStaffContext, () => palette.addStaffAbove())
  action(staffBox, '+ Below',
    "Add a staff below the selected bar's staff — click empty space in a measure to select it first",
    hasStaffContext, () => palette.addStaffBelow())
  row.appendChild(staffBox)
  row.appendChild(divider())

  // --- Playback ---
  const play = el('button', '', '▶ Play')
  play.addEventListener('click', () => togglePlayback())
  syncers.push(() => {
    const playing = state.playbackState === 'playing'
    play.className = 'px-4 py-2 rounded min-w-[80px] '
      + (playing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700')
    play.textContent = playing ? '⏹ Stop' : '▶ Play'
  })
  row.appendChild(play)

  /*
   * ⚠️ TEMPORARY dev-only sound picker — NOT a final editor feature. Lets us audition GM timbres
   * while building; the choice is not persisted (not in the score, not in JSON) and takes effect on
   * the next Play. Deliberately styled as scaffolding (dashed amber, 🔧 DEV). Remove this block and
   * DEV_SOUNDS when a real per-staff instrument model is designed.
   */
  const soundLabel = el('label',
    'flex items-center gap-1 ml-2 px-2 py-1 rounded border border-dashed border-amber-500/70 '
    + 'text-amber-300 text-xs', '🔧 DEV sound: ')
  soundLabel.title = 'Temporary dev-only sound picker — not a final editor feature. Applies on next Play.'
  const sound = el('select', 'bg-gray-700 rounded px-1 py-0.5 text-white text-xs')
  for (const s of DEV_SOUNDS) {
    const opt = document.createElement('option')
    opt.value = String(s.program)
    opt.textContent = s.label
    sound.appendChild(opt)
  }
  sound.value = String(DEV_SOUNDS[0].program)
  sound.addEventListener('change', () => getEngine()?.setInstrumentProgram(Number(sound.value)))
  soundLabel.appendChild(sound)
  row.appendChild(soundLabel)

  host.appendChild(row)

  const sync = () => { for (const s of syncers) s() }
  sync()
  const unsubscribe = onStateChange(sync)

  return {
    destroy(): void {
      unsubscribe()
      row.remove()
    },
  }
}
