/**
 * 🔧 **DEV "Other durations" panel — SCAFFOLDING**, beside the dev toolbar's `Duration:` group
 * (docs/plans/other-durations-plan.md P2).
 *
 * The six values the Keypad's Grace page draws and the Duration group has no room for — the breve,
 * the longa and the 64th … 512th. Each button is EXACTLY a Duration button: a press is
 * `palette.setDuration(d)` and its light is `durationHighlight(state) === d`, the one rule the Keypad
 * and the Duration group already share (`interactions/controllers/keypadSync`). ⛔ Nothing here decides
 * what a duration does; this is a row of doors into what already exists.
 *
 * A label is the value's own METRONOME glyph (`utils/tempoText.MET_NOTE_GLYPH`) in the music font — the
 * text-sized cut, so it sits in a button. The longa has none anywhere (SMuFL cuts no longa for text),
 * so its button says its name.
 */
import type { EditorState } from '../interactions/state/EditorState'
import type { NoteDuration } from '../types/music'
import { durationHighlight } from '../interactions/controllers/keypadSync'
import { MET_NOTE_GLYPH } from '../utils/tempoText'
import { MUSIC_FONT } from '../windows/symbols/glyphSvg'

/** What the panel offers, in the order it shows them — longest first, the Duration group's order. */
export const OTHER_DURATIONS: ReadonlyArray<{ duration: NoteDuration; name: string }> = [
  { duration: 'longa', name: 'Longa (quadruple whole) — 16 beats' },
  { duration: 'breve', name: 'Breve (double whole) — 8 beats' },
  { duration: '64', name: 'Sixty-fourth note — 1/16 beat' },
  { duration: '128', name: 'Hundred-twenty-eighth note — 1/32 beat' },
  { duration: '256', name: 'Two-hundred-fifty-sixth note — 1/64 beat' },
  { duration: '512', name: 'Five-hundred-twelfth note — 1/128 beat' },
]

const BUTTON = 'px-2 py-1 rounded text-sm'
const ON = 'bg-cyan-600 text-white'
const OFF = 'bg-gray-600 hover:bg-gray-500'

export interface OtherDurationsDeps {
  state: EditorState
  onStateChange: (fn: () => void) => () => void
  /** `PaletteController.setDuration` — what choosing a duration DOES. */
  setDuration: (d: NoteDuration) => void
}

/** Build the `Other:` group; `destroy` stops its subscription and removes it. */
export function buildOtherDurationsPanel(deps: OtherDurationsDeps): { element: HTMLElement; destroy(): void } {
  const box = document.createElement('div')
  box.className = 'flex items-center gap-2 bg-gray-700 px-3 py-1 rounded'
  const label = document.createElement('span')
  label.className = 'text-sm text-gray-300'
  label.textContent = 'Other:'
  box.appendChild(label)

  const buttons = OTHER_DURATIONS.map(({ duration, name }) => {
    const b = document.createElement('button')
    const glyph = MET_NOTE_GLYPH[duration]
    b.textContent = glyph ?? duration
    if (glyph !== null) b.style.fontFamily = MUSIC_FONT
    b.title = name
    b.dataset.duration = duration
    b.addEventListener('click', () => deps.setDuration(duration))
    box.appendChild(b)
    return { b, duration }
  })

  const sync = () => {
    const lit = durationHighlight(deps.state)
    for (const { b, duration } of buttons) b.className = `${BUTTON} ${lit === duration ? ON : OFF}`
  }
  sync()
  const unsubscribe = deps.onStateChange(sync)

  return {
    element: box,
    destroy() {
      unsubscribe()
      box.remove()
    },
  }
}
