import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import { Column, GroupBox, Row } from './content/layout'
import { Button, Checkbox, NumberInput, RadioGroup, Select } from './content/widgets'
import { CHROME } from '../utils/chromeColors'

/**
 * The Time Signature window, opened from Insert ▸ Time Signature (or T) — modelled on Sibelius's
 * dialog: a row of meters to pick from, the rewrite/cautionary options, a pickup frame, and
 * Cancel / OK.
 *
 * LOOK ONLY. Nothing here reads or writes the score: the radios and checkboxes hold their own state,
 * OK closes like Cancel, and "Beam and Rest Groups…" does nothing. The point of building it this way
 * round is that the SHAPE of the dialog is itself a decision — which options exist, and which are
 * grouped — and it is cheaper to argue with a picture than with a wired feature.
 */

/**
 * SMuFL codepoints, as escapes — PUA characters are invisible in an editor and survive nothing that
 * touches the file. `timeSig0` is U+E080, so a digit is `TIME_SIG_ZERO + n`.
 */
const TIME_SIG_ZERO = 0xe080
const COMMON = '\uE08A' // timeSigCommon
const CUT_COMMON = '\uE08B' // timeSigCutCommon

/** Bravura first: these are glyphs, not text, so the music font MUST lead the stack. */
const MUSIC_FONT = "Bravura, Academico, 'Noto Music', serif"

/** One staff space, in px — the meters are drawn at the same scale the Clef window uses. */
const SPACE = 8
/** SMuFL's em square IS the staff height (4 spaces), and a time-signature digit is 2 spaces tall,
 *  centred on its own baseline. Both facts are what the stacking below is built from. */
const GLYPH_SIZE = SPACE * 4
const DIGIT_HALF = SPACE // half a digit's height: one space
const BOX_WIDTH = SPACE * 3
const BOX_HEIGHT = SPACE * 5

/** `<text>` at a given baseline, centred in the box. */
function glyph(text: string, baselineY: number): string {
  return `<text x="${BOX_WIDTH / 2}" y="${baselineY}" text-anchor="middle"
       font-family="${MUSIC_FONT}" font-size="${GLYPH_SIZE}" fill="${CHROME.ink}">${text}</text>`
}

const digits = (n: number): string =>
  String(n)
    .split('')
    .map((d) => String.fromCharCode(TIME_SIG_ZERO + Number(d)))
    .join('')

/**
 * A meter, stacked the way it is engraved: numerator over denominator, both centred on the middle
 * line. A time-signature digit straddles its baseline (one space above, one below), so the two
 * baselines sit one space either side of centre and the pair comes out symmetric.
 */
function meterPicture(numerator: number, denominator: number): string {
  const middle = BOX_HEIGHT / 2
  return `<svg width="${BOX_WIDTH}" height="${BOX_HEIGHT}" viewBox="0 0 ${BOX_WIDTH} ${BOX_HEIGHT}">
    ${glyph(digits(numerator), middle - DIGIT_HALF)}
    ${glyph(digits(denominator), middle + DIGIT_HALF)}
  </svg>`
}

/**
 * C and ¢ — ONE glyph where a meter has two, and its baseline is the middle itself.
 *
 * Not `middle + DIGIT_HALF`, which is where a denominator goes: these straddle their baseline the
 * same two spaces a digit does, so putting them on a digit's baseline drops them half a glyph below
 * where the stacked pairs are centred. The pair spans middle−2…middle+2 and this spans
 * middle−1…middle+1 — concentric, which is what makes the row sit on one line.
 */
function symbolPicture(symbol: string): string {
  return `<svg width="${BOX_WIDTH}" height="${BOX_HEIGHT}" viewBox="0 0 ${BOX_WIDTH} ${BOX_HEIGHT}">
    ${glyph(symbol, BOX_HEIGHT / 2)}
  </svg>`
}

/** Sibelius's row, in Sibelius's order. `value` is what OK will one day read. */
const METERS = [
  { value: '2/2', picture: meterPicture(2, 2) },
  { value: '2/4', picture: meterPicture(2, 4) },
  { value: '3/4', picture: meterPicture(3, 4) },
  { value: '4/4', picture: meterPicture(4, 4) },
  { value: '6/8', picture: meterPicture(6, 8) },
  { value: 'common', picture: symbolPicture(COMMON) },
  { value: 'cut', picture: symbolPicture(CUT_COMMON) },
]

/** The pickup bar's length, as note values. Words, not glyphs, until the Select can hold markup. */
const PICKUP_LENGTHS = [
  { value: 'q', label: 'Quarter' },
  { value: 'h', label: 'Half' },
  { value: '8', label: 'Eighth' },
  { value: '16', label: 'Sixteenth' },
]

export function openTimeSignatureWindow(windows: WindowLayer): Window {
  // The two spinners beside "Other:" — beats over unit, the custom meter. Mounted as the radio's
  // trailing widget so they sit with the option they belong to.
  const otherBeats = new NumberInput({ value: 4, min: 1, max: 64, width: 54 })
  const otherUnit = new NumberInput({ value: 4, min: 1, max: 64, width: 54 })

  const meters = new RadioGroup(
    [
      ...METERS.map((m) => ({ value: m.value, picture: m.picture })),
      {
        value: 'other',
        label: 'Other:',
        // A Column, because the two spinners stack: beats above unit, reading like the meter itself.
        trailing: new Column([otherBeats, otherUnit], { gap: 4 }),
      },
    ],
    { selected: '4/4' },
  )

  // Captured in a `let` because the buttons are built before `open()` returns but only run after.
  let win: Window | null = null
  win = windows.open({
    title: 'Time Signature',
    // Wide enough for seven meters and "Other:" on ONE line — the row wraps if it has to, but the
    // dialog is meant to be read at a glance, and a wrapped row of radios is a list.
    width: 560,
    center: true,
    resizable: false,
    fitContent: true,
    // Escape is Cancel — the same act, so the same call. Nothing is armed, nothing committed.
    onCancel: () => win?.close(),
    content: new Column(
      [
        meters,
        new Row(
          [
            new Checkbox('Rewrite bars up to next time signature', { checked: true }),
            new Checkbox('Allow cautionary', { checked: true }),
          ],
          { gap: 24 },
        ),
        new Row(
          [
            new GroupBox('Pickup (Upbeat)', [
              new Row([new Checkbox('Start with bar of length:'), new Select(PICKUP_LENGTHS, { width: 110 })], { gap: 10 }),
            ]),
            new Button('Beam and Rest Groups…', () => {}),
          ],
          // The FRAME takes the slack (child 0), which pushes the button to the far right — the
          // two are not a pair, they are the left thing and the right thing.
          { gap: 20, grow: 0 },
        ),
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', () => win?.close(), { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      { gap: 14 },
    ),
  })
  return win
}
