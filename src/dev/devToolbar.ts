import type { EditorState } from '../interactions/EditorState'
import { selectedOf } from '../interactions/EditorState'
import type { PaletteController } from '../interactions/PaletteController'
import type { MusicEngine } from '../engine/MusicEngine'
import type { NoteDuration } from '../types/music'
import { durationHighlight, fanHighlight } from '../interactions/keypadSync'
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
// (The `ON_DEFAULT` slate state — lit on a value nobody chose — went with the Beam row it served; the
// Keypad lights the beam cluster in one colour. Restore it here if another row ever needs the third state.)

// REMOVED: the tremolo palette (the six marks + the two-note pair). It went the way the Beam row
// went before it — every one of its actions now lives on the Keypad's Beams/Tremolos page, calling
// the SAME `PaletteController` methods (`pressTremolo`, `pressTremoloPair`), so nothing behind it
// changed. Two controls for one action from two different places is confusion, not convenience.
//
// ⭐ Unlike the beam removal, this one leaves NOTHING homeless: the beam row took `setBeam('auto')`
// with it (still a TODO for a Properties "reset beaming"), while every tremolo action has a key —
// `1`–`5` the stroke counts, `6` the Penderecki sign, `Enter` the two-note mark, and the pair's
// joined/open style on the beam keys.

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
  /**
   * No button here ever takes focus — the score's keyboard must survive a click on the toolbar, the
   * same rule the Keypad's keys follow (`KeypadWidget.baseButton`). One delegated listener rather
   * than a line per button, so a control added later cannot forget it. Inputs and selects are
   * untouched: they are things you type into, and they are not buttons.
   *
   * A focused button is not a cosmetic problem. style.css already hides the ring for a plain mouse
   * click (`:focus:not(:focus-visible)`), but the browser re-qualifies the focused element as
   * KEYBOARD-focused the moment you press a key — so clicking `continue`, then arrowing to another
   * note, drew a ring around a button that no longer says anything about the selected note. (It is
   * also why Esc blurs by hand in shortcutWiring.) And a focused button answers Enter, which is not
   * a thing a score editor should let a stray keypress do.
   */
  row.addEventListener('mousedown', (e) => {
    if ((e.target as Element | null)?.closest?.('button')) e.preventDefault()
  })
  /** Re-applied on every state change; each entry owns one button's appearance. */
  const syncers: Array<() => void> = []

  /**
   * A button whose lit/unlit state is a question about editor state. `isOn` is re-asked on every
   * change rather than the caller pushing an update — the same "state is the truth, the control
   * mirrors it" direction the Keypad's seams use.
   */
  function toggle(
    parent: HTMLElement, base: string, label: string, title: string,
    isOn: () => boolean, onClick: () => void, on: string | (() => string) = ON,
  ): HTMLButtonElement {
    const b = el('button', `${base} ${OFF}`, label)
    b.title = title
    b.addEventListener('click', onClick)
    // `on` may be a thunk: the Beam row's lit colour depends on WHICH of the two beam facts put the
    // button on (authored → cyan, the note's actual role → slate), which is only knowable per sync.
    syncers.push(() => {
      b.className = `${base} ${isOn() ? (typeof on === 'function' ? on() : on) : OFF}`
    })
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
  toggle(viewBox, TOOL_BTN, 'Justify last',
    'Stretch the LAST system to the page width (Finale/Sibelius). Off = ragged, the final system '
      + "keeps its natural width — LilyPond's ragged-last.",
    () => state.justifyLastLine, () => palette.setJustifyLastLine(!state.justifyLastLine))
  toggle(viewBox, TOOL_BTN, 'Use layout',
    'Draw the music on PAGES (A4 at 15mm margins) instead of the endless sketching canvas. '
      + 'Ignored in linear view, which has no systems to break between pages.',
    () => state.useLayout, () => palette.setUseLayout(!state.useLayout))
  row.appendChild(viewBox)
  row.appendChild(divider())

  // Voice selection graduated out of the dev shell to the Keypad's voice row (V1–4 + All), which
  // drives the same `voiceSelection` seam. The old toolbar buttons only covered V1/V2 and went dark
  // on V3/V4, so they were removed — Alt+1..4 and the Keypad are the surfaces now. `setActiveVoice`
  // stays on the palette (the seam + shortcuts use it).

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
  const BTN_BOLD = 'px-3 py-1 rounded text-sm font-bold'
  /** Tempo words engrave italic, so the buttons say them the way the score will. */
  const BTN_ITALIC = 'px-3 py-1 rounded text-sm italic'
  for (const { d, glyph, title } of DURATIONS) {
    // `durationHighlight` is THE rule (interactions/keypadSync), shared with the Keypad: a marking
    // tool arms into entry mode but enters no note, so the duration must go dark under an armed
    // clef — and stay lit under the armed REST, whose length these keys are.
    toggle(durBox, BTN_BOLD, glyph, title,
      () => durationHighlight(state) === d, () => palette.setDuration(d))
  }
  row.appendChild(durBox)

  // --- Beam ---
  // REMOVED: the beam palette (auto/single/begin/continue/end + subdivide + beam-rest) was a DEV tool,
  // and every one of its actions now lives on the Keypad's Beams/Tremolos page (docs/keypad.md) — the
  // same `PaletteController` methods, so nothing behind it changed. The one action with no Keypad key
  // is `setBeam('auto')` — reset a note's authored beam back to the meter's default — which is kept as
  // a method for a future Properties "reset beaming" control (see `PaletteController.setBeam`).

  // --- Tremolo: REMOVED, see the note at the top of this file (it lives on the Keypad now). ---

  /**
   * --- Effect: the FANNED (feathered) beam ---
   *
   * `accel.` and `rit.` turn the SELECTED note into a group that speeds up or slows down across
   * exactly that note's own duration — you enter the time first, then say how it is played, so
   * nothing else in the bar moves (docs/fanned-beams-plan.md §0). A re-press on the lit one clears
   * it, and the lit state is READ from the selection rather than pushed, like every other toggle
   * here. With nothing selected the press does nothing: a fan has nothing to apply to.
   *
   * ⚠️ **This is the DEV SHELL, and that is temporary** — the same status as everything in `dev/`.
   * The buttons live here *while the feature is being built and tuned* because the action has to be
   * reachable before its real home is chosen, and they call the same `PaletteController` method any
   * later surface would, so moving them costs one call site. (The Keypad's Beams/Tremolos page is
   * the obvious candidate — it is where the beam and tremolo clusters ended up, and where Sibelius
   * puts its feathered-beam buttons — but that is a decision for after the numbers settle.)
   */
  const effectBox = group('Effect:')
  for (const direction of ['accel', 'rit'] as const) {
    toggle(
      effectBox, BTN_ITALIC, `${direction}.`,
      `Fanned beam: play the selected note as several notes ${direction === 'accel' ? 'speeding up' : 'slowing down'} across its own duration`,
      () => fanHighlight(state, getEngine()) === direction,
      () => palette.pressFan(direction),
    )
  }
  row.appendChild(effectBox)
  row.appendChild(divider())

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

  const hasMeasureContext = () => selectedOf(state, 'measureRange')?.boxStyle === 'double'
  const hasStaffContext = () => selectedOf(state, 'measureRange')?.boxStyle === 'single'

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

  // (No model subscription. The toolbar's syncers all read `state` now — the only two that read the
  // ENGINE were the tremolo row's, and they went to the Keypad with it. `wireKeypadSync` carries that
  // two-source wiring instead, which is where the engine-read lights now live.)

  return {
    destroy(): void {
      unsubscribe()
      row.remove()
    },
  }
}
