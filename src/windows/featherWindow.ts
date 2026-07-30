import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import type { NoteDuration } from '../types/music'
import { bus } from '@/bus'
import type { FanStampContext } from '@/bus'
import { splitBeatsIntoLengths } from '@/utils/durations'
import { Column, GroupBox, Row } from './content/layout'
import { Button, Checkbox, GlyphSelect, Label, NumberInput, RadioGroup } from './content/widgets'

/**
 * The Feathered Beam window, opened from Insert ▸ Feathered Beam.
 *
 * It asks the feather's own sentence — **"N attacks in the time of [figure]"** — and which way the
 * ramp runs. That is the whole dialog: a feather is a number of attacks squeezed into a written
 * duration, so the two sides are a COUNT and a FIGURE, and unlike a tuplet there is no unit on the
 * left. The attacks have no written value of their own; the beam is what says how many there are.
 *
 * It began as the Tuplet window copied wholesale, and what has gone since is what a tuplet needed
 * and a feather does not: the ratio readout (a feather prints no figure, so there is nothing to
 * preview), the left-hand note value, and the whole *Format* box of number styles and brackets.
 *
 * **OK ARMS THE STAMP**, and does not apply one: a feather is a gesture you are about to WRITE, so
 * there is nothing to convert until the note exists. Same contract the Tuplet window's OK has, and
 * the same route — {@link bus.fanStamp} → `keypadSync` → `PaletteController.armFanStamp` — after
 * which the pointer carries a ghost NOTEHEAD of the value typed here, and one click writes the whole
 * gesture (`interactions/fanStamp`).
 *
 * ⭐ **AND WHAT OK DOES DEPENDS ON WHAT IS SELECTED** — one dialog, three acts, in his order:
 *
 *  - **a PASSAGE selected** → collapse it into one gesture. The notes ARE the attacks and their span
 *    IS the length, so those two fields are greyed and merely report ({@link applyContext}); only
 *    *Open* / *Close* is still a question. *"So the user just can select open or close."*
 *  - **ONE note selected** → the feather lands on it, keeping its pitch and its place.
 *  - **nothing selected** → the stamp arms, and the next click writes the gesture.
 *
 * The window does not decide which: it publishes the same sentence every time and
 * `PaletteController.armFanStamp` resolves it against the selection. That is what keeps the three
 * acts one behaviour rather than three code paths in a dialog that cannot see the score.
 */

/** The written duration the attacks are squeezed into, DRAWN — a note value is a glyph, the same
 *  list and font the Keypad's duration keys show. `label` is not shown: it is the tooltip and the
 *  accessible name. Codepoints written out — Bravura's PUA is invisible in an editor. */
const FEATHER_UNITS = [
  { value: 'w', glyph: '\uE1D2', label: 'Whole' },
  { value: 'h', glyph: '\uE1D3', label: 'Half' },
  { value: 'q', glyph: '\uE1D5', label: 'Quarter' },
  { value: '8', glyph: '\uE1D7', label: 'Eighth' },
  { value: '16', glyph: '\uE1D9', label: 'Sixteenth' },
  { value: '32', glyph: '\uE1DB', label: 'Thirty-second' },
]

/** The written duration the dialog OPENS on: the half note. A feather is a gesture you hear over
 *  some time, and a half is where one is long enough to be worth writing — the quarter's worth of
 *  attacks is the one you would have beamed by hand. */
const DEFAULT_UNIT = 'h'

/** The caption column both rows open with, in px — wide enough for "Number of attacks" at the
 *  window's 14px face, with air after it. Stated once because BOTH rows must use the same number:
 *  that equality is what puts the two controls in one column. */
const PHRASE_WIDTH = 124

/**
 * Which way the ramp runs — the ONE thing beyond the sentence this dialog asks.
 *
 * Named for what the beams DO, because that is what you are looking at when you pick: an OPEN
 * feather starts converged and spreads (more attacks as it goes — the accelerando), a CLOSE feather
 * starts spread and converges (the rallentando). The `value`s are the model's own
 * `FanMark.direction`, so the radio holds what the model stores and there is no label→field table
 * to get wrong.
 */
const TYPES = [
  { value: 'accel', label: 'Open feather (accel.)' },
  { value: 'rit', label: 'Close feather (rit.)' },
]

export function openFeatherWindow(windows: WindowLayer): Window {
  let win: Window | null = null

  // The sentence, in the order a player says it: how many attacks, then how long you have for them.
  // SIX is where the dialog opens: at three the ramp has barely started, and six over a half note is
  // the feather you would actually stop to write.
  const count = new NumberInput({ value: 6, min: 2, width: 56 })
  const unit = new GlyphSelect(FEATHER_UNITS, { selected: DEFAULT_UNIT, width: 62 })
  const unitDotted = new Checkbox('dotted')
  const type = new RadioGroup(TYPES, { selected: 'accel', direction: 'column' })

  /**
   * ⭐ SHOW WHAT THE SELECTION ANSWERS, AND REFUSE TO LET IT BE EDITED.
   *
   * With a passage selected the gesture is already decided: one attack per note, lasting exactly as
   * long as they last. So the two fields report it and grey — *"number of notes and durations are
   * forbidden, but somehow reflect the selection"* — and the direction is all that is left to choose.
   *
   * ⚠️ The length is an APPROXIMATION on purpose, and the field says so by being dead: seven
   * sixteenths last 7/4 quarters and no single notehead spells that. `splitBeatsIntoLengths` is
   * greedy longest-first, so its first piece is the nearest value this dialog can draw — *"just in
   * case there is no duration in the menu to cover [it]"*. What the music gets is the passage's real
   * span, which the collapse takes from the notes themselves, never from this field.
   */
  const applyContext = (context: FanStampContext): void => {
    const passage = context.notes > 1
    if (passage) {
      count.setValue(context.notes)
      const [nearest] = splitBeatsIntoLengths(context.quarters)
      if (nearest) {
        unit.setValue(nearest.duration)
        unitDotted.setChecked(nearest.dots > 0)
      }
    }
    count.setDisabled(passage)
    unit.setDisabled(passage)
    unitDotted.setDisabled(passage)
  }

  const stopContext = bus.fanStamp.onContext(applyContext)
  /** Close, and stop listening — a window layer has no close hook, so the two go together here. The
   *  selection can change while the dialog is up (a click behind it), and a stale subscription would
   *  keep greying fields in a window that is gone. */
  const dismiss = (): void => {
    stopContext()
    win?.close()
  }

  /**
   * Commit: ARM the feather for the next click, and get out of the way.
   *
   * The controls are read HERE, at click time, never captured — every one of them moves under this
   * function. Enter reaches it without touching the button, which is why the arming lives here and
   * not in OK's handler.
   */
  const accept = (): void => {
    bus.fanStamp.press({
      attacks: count.value,
      unit: unit.value as NoteDuration,
      dots: unitDotted.checked ? 1 : 0,
      direction: type.value as 'accel' | 'rit',
    })
    dismiss()
  }

  win = windows.open({
    title: 'Feathered Beam',
    // Wide enough for the whole entry row — caption column, figure and its dot — on ONE line. A row
    // that wraps is a row whose columns no longer line up, which is the thing this layout is for.
    width: 360,
    fitContent: true,
    // A dialog you summoned belongs where you are already looking, not on the cascade.
    center: true,
    resizable: false,
    onCancel: dismiss,
    onAccept: accept,
    content: new Column(
      [
        // Both rows open with a caption column of the same fixed width: that is what puts the number
        // and the figure in one column, so the sentence is read straight down.
        new Row([new Label('Number of attacks', { width: PHRASE_WIDTH }), count], { gap: 6 }),
        new Row([new Label('in the time of', { width: PHRASE_WIDTH }), unit, unitDotted], { gap: 6 }),
        new GroupBox('Type', [type]),
        // Cancel then OK, left to right, OK primary — the platform order.
        new Row([new Button('Cancel', dismiss), new Button('OK', accept, { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      { gap: 12 },
    ),
  })

  // AFTER open(): the widgets exist only once mounted, and greying one writes into its element.
  // Read rather than awaited — a dialog is built after the selection was made, so the first context
  // it needs has already been pushed.
  applyContext(bus.fanStamp.getContext())

  // Opens ON the number, selected — the field the dialog exists to change. Typing 7 then Enter is
  // then the whole interaction. ⛔ Not when the selection has answered it: focusing a dead field is
  // an invitation to type into something that refuses, so the direction gets the keyboard instead.
  if (bus.fanStamp.getContext().notes <= 1) count.focus()
  return win
}
