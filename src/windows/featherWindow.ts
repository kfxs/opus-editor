import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import type { NoteDuration } from '../types/music'
import { bus } from '@/bus'
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
 * ⚠️ A different act from the Keypad's `accel.`/`rit.` keys, which MARK notes that already exist
 * (and collapse a selected passage into one gesture). Two ways in, deliberately: this one is for the
 * feather you have not typed yet.
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
    win?.close()
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
    onCancel: () => win?.close(),
    onAccept: accept,
    content: new Column(
      [
        // Both rows open with a caption column of the same fixed width: that is what puts the number
        // and the figure in one column, so the sentence is read straight down.
        new Row([new Label('Number of attacks', { width: PHRASE_WIDTH }), count], { gap: 6 }),
        new Row([new Label('in the time of', { width: PHRASE_WIDTH }), unit, unitDotted], { gap: 6 }),
        new GroupBox('Type', [type]),
        // Cancel then OK, left to right, OK primary — the platform order.
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', accept, { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      { gap: 12 },
    ),
  })

  // Opens ON the number, selected — the field the dialog exists to change. Typing 7 then Enter is
  // then the whole interaction.
  count.focus()
  return win
}
