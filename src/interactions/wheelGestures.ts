/**
 * ⭐⭐ **WHAT A WHEEL MEANS ON THE SCORE** — the table of modifier + wheel gestures, and the one place
 * a new one is added.
 *
 * His ask, 2026-08-20: *"if the endpoint that controls the mouth of the hairpin is selected, when i
 * shift scroll i want to be able to control the mouth"*. That is the first row; the point of the
 * table is that the second one is a ROW rather than another `if` in the app shell (CLAUDE.md: a new
 * feature adds a MODULE, and `App.ts` is the app, not a place for per-mark rules).
 *
 * ⭐ **A gesture DECLINES when it does not apply**, and the wheel then does what the browser and the
 * viewport would have done — scroll. So a row can safely claim a chord without stealing it: the
 * hairpin's mouth answers only while the wedge's mouth-bearing square is ARMED, which is a state the
 * user put the editor in deliberately.
 *
 * ⛔ **`Ctrl`+wheel is NOT here.** Zoom is the app's own, always score zoom whether or not the pointer
 * is over the music (docs/zoom-plan.md §7), and it is handled before this is consulted.
 *
 * ⚠️ The caller owns `preventDefault()` and the repaint — this module answers *"did anything take
 * it?"* and nothing else, so it can be tested without a DOM.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { hairpinMouthEnd, nudgeArmedHairpinMouth } from './elements/hairpinHandles'
import { selectedOf } from './EditorState'
import { dbg } from '../utils/debug'

/** What the table needs of a wheel event — a Pick, so a spec needs no `WheelEvent`. */
export interface WheelIntent {
  /** Screen-down positive, as the DOM reports it. */
  deltaY: number
  /** 🚨 **And the HORIZONTAL, which a `Shift`+wheel usually arrives as.** Browsers translate a
   *  shifted wheel into `deltaX` — that is where "shift-scroll scrolls sideways" comes from — so a
   *  gesture that reads only `deltaY` sees nothing, declines, and the page scrolls under the user's
   *  hand instead (his report, 2026-08-20). */
  deltaX: number
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

/** One row: the chord it answers to, and what it does with a notch of wheel. */
interface WheelGesture {
  name: string
  /** Does this chord match? ⛔ Modifiers only — what the gesture needs SELECTED is `applies`. */
  chord: (intent: WheelIntent) => boolean
  /**
   * ⭐⭐ **Is this gesture the one in charge right now?** — ⛔ a different question from whether a
   * notch CHANGES anything, and keeping them apart is the whole of his 2026-08-20 report: at the
   * mouth's upper bound the wheel stopped being the mouth's and the page began scrolling sideways
   * under his hand. A gesture that applies OWNS the wheel, at its bounds too.
   */
  applies: (state: EditorState, engine: MusicEngine) => boolean
  /** `step` is +1 for a notch UP (away from the user) and −1 for one DOWN. False = nothing moved
   *  (a bound), which is NOT a decline — see {@link WheelGesture.applies}. */
  run: (state: EditorState, engine: MusicEngine, step: 1 | -1) => boolean
}

/**
 * ⭐ **HOW MUCH ONE NOTCH IS WORTH** — the mouth's own keyboard step (`Shift+↑/↓`), so the wheel and
 * the arrows cannot drift apart. ⛔ Not scaled by `deltaY`: a trackpad reports fractions of a notch
 * and a mouse reports 100 at a time, so anything proportional makes the same gesture mean two
 * different things on two devices.
 */
const MOUTH_STEP_SS = 0.05

const WHEEL_GESTURES: WheelGesture[] = [
  {
    // ⭐ The wedge's MOUTH — `Shift`+wheel while its own square is armed. `nudgeArmedHairpinMouth`
    // already owns every rule that makes this hard (which square HAS the mouth, stepping from what
    // is DRAWN, clamping into the authored range), and declines when none of it holds.
    name: 'hairpin mouth',
    chord: (intent) => intent.shiftKey && !intent.ctrlKey && !intent.metaKey && !intent.altKey,
    // ⭐ The wedge's own rule for WHICH square has the mouth — the open end, which is the wedge's
    // TYPE rather than a side of the score (`hairpinMouthEnd`).
    applies: (state, engine) => {
      const selected = selectedOf(state, 'hairpin')
      const hairpin = selected?.endpoint ? engine.getHairpinById(selected.id) : null
      return !!hairpin && selected!.endpoint === hairpinMouthEnd(hairpin.type)
    },
    run: (state, engine, step) => nudgeArmedHairpinMouth(state, engine, step * MOUTH_STEP_SS),
  },
]

/**
 * Offer a wheel notch to the table. ⭐ Returns true when a row took it — the caller then kills the
 * scroll and repaints; false means nobody wanted it and the wheel is the viewport's.
 *
 * ⚠️ A zero `deltaY` is not a notch (some devices send them while a modifier is merely held).
 */
export function runWheelGesture(
  state: EditorState,
  engine: MusicEngine | null,
  intent: WheelIntent,
): { consumed: boolean; changed: boolean } {
  const nothing = { consumed: false, changed: false }
  // ⭐ The dominant delta, ⛔ not `deltaY`: a shifted wheel usually arrives as `deltaX` (see
  // {@link WheelIntent.deltaX}), and some devices send a zero one while the modifier is merely held.
  const delta = intent.deltaY || intent.deltaX
  if (!engine || delta === 0) return nothing

  const step: 1 | -1 = delta < 0 ? 1 : -1
  for (const gesture of WHEEL_GESTURES) {
    if (!gesture.chord(intent) || !gesture.applies(state, engine)) continue
    const changed = gesture.run(state, engine, step)
    dbg(`Wheel gesture: ${gesture.name} ${step > 0 ? 'up' : 'down'}${changed ? '' : ' (at its bound)'}`)
    return { consumed: true, changed }
  }
  return nothing
}
