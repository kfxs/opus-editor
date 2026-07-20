import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import { Column, GroupBox, Row } from './content/layout'
import { Button, Checkbox, GlyphSelect, NumberInput, RadioGroup, Select } from './content/widgets'
import { CHROME } from '../utils/chromeColors'
import { openBeamGroupsWindow } from './beamGroupsWindow'
import { DENOMINATORS, parseGrouping } from '../utils/groupingInput'
import { timeSignatureSelection } from '../interactions/timeSignatureSelection'

/**
 * The Time Signature window, opened from Insert ▸ Time Signature (or T) — modelled on Sibelius's
 * dialog: a row of meters to pick from, the rewrite/cautionary options, a pickup frame, and
 * Cancel / OK.
 *
 * OK ARMS the meter — it does not place it. A meter change belongs to a BAR and the dialog does not
 * know which one, so the next click on the score says where, through the placement path the palette
 * has always used. The Clef window makes the same bargain. Cancel arms nothing.
 *
 * What travels with the meter: its GROUPING (a 7/8 grouped 3+2+2 arrives as one `TimeSignature`) and
 * the CAUTIONARY decision, which is a property of the change about to be made and has nowhere else
 * to wait until the target bar is known.
 *
 * Still unwired, and written up in docs/time-signature-window-plan.md: the pickup checkbox, and
 * "Beam and Rest Groups…" beyond the grouping field it already edits (rest grouping is not modelled
 * at all). `common`/`cut` arm as 4/4 and 2/2 — right meters, wrong glyph, because `TimeSignature`
 * cannot yet say "print this as C".
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

/**
 * The pickup bar's length, DRAWN. A note value is a glyph — "Quarter" describes a crotchet, ♩ is
 * one — and this is the same list the Keypad's duration keys show, in the same font.
 *
 * `label` is not shown: it is the accessible name and the tooltip, so the control still says what
 * it is to a screen reader (and to anyone who does not read the glyph at a glance).
 */
const PICKUP_LENGTHS = [
  { value: 'h', glyph: '\uE1D3', label: 'Half' },
  { value: 'q', glyph: '\uE1D5', label: 'Quarter' },
  { value: '8', glyph: '\uE1D7', label: 'Eighth' },
  { value: '16', glyph: '\uE1D9', label: 'Sixteenth' },
]

/**
 * The meter a PRESET radio stands for. `common`/`cut` are 4/4 and 2/2 — which is what they MEAN, but
 * not how they are drawn, and `TimeSignature` has no way to say "print this as C" yet. Nothing here
 * commits, so the gap is harmless today; it is the first thing to fix when OK does something. See
 * docs/time-signature-window-plan.md.
 *
 * `other` is NOT here: it has no meter of its own — its meter is whatever the two spinners say, and
 * only the window holds those. Returning null rather than a fallback is the point: a fallback is
 * what made this silently answer 4/4 for a 5/4 the user had typed, and be believed.
 */
function presetMeter(value: string): [number, number] | null {
  if (value === 'common') return [4, 4]
  if (value === 'cut') return [2, 2]
  const [numerator, denominator] = value.split('/').map(Number)
  return Number.isFinite(numerator) && Number.isFinite(denominator) ? [numerator, denominator] : null
}

export function openTimeSignatureWindow(windows: WindowLayer): Window {
  // The grouping the Beam and Rest Groups window edits. It lives HERE, not in that window: this is
  // the dialog that will one day commit it, and the other is only an editor for the value.
  let grouping = ''

  // The two spinners beside "Other:" — beats over unit, the custom meter. Mounted as the radio's
  // trailing widget so they sit with the option they belong to.
  // Typing in either one CHOOSES Other — a value you are editing is the value you mean, and the dot
  // sitting on 4/4 while you type a 5 says the dialog is not listening. `meters` is assigned below
  // and only read when the callback fires, long after.
  const chooseOther = (): void => meters.select('other')
  const otherBeats = new NumberInput({ value: 4, min: 1, max: 64, width: 54, onInput: chooseOther })
  // The denominator is a NOTE VALUE, not a count — 1, 2, 4, 8, 16, 32 and nothing between. A spinner
  // that steps by one offers 5 and 6, which are not note values and cannot be engraved or played;
  // the meter would then be caught by validation, having been offered by the dialog in the first
  // place. A list of the legal values makes the illegal ones unreachable instead of rejected.
  const otherUnit = new Select(
    DENOMINATORS.map((d) => ({ value: String(d), label: String(d) })),
    { selected: '4', width: 54, onChange: chooseOther },
  )

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

  const cautionary = new Checkbox('Allow cautionary', { checked: true })

  /** The meter the dialog is currently showing — a preset, or the spinners when Other is chosen.
   *  Read at CLICK time, never captured: the radios and the spinners both move under it. */
  const currentMeter = (): [number, number] => presetMeter(meters.value) ?? [otherBeats.value, Number(otherUnit.value)]

  /**
   * OK: ARM the meter and get out of the way — the Clef window's bargain, and for the same reason.
   * A meter change belongs to a BAR, and the dialog does not know which one; the next click on the
   * score says where, through the placement path the palette has always used.
   *
   * The cautionary rides along, because it is a property of the change that is about to be made and
   * has nowhere else to wait. The grouping does too — the whole `TimeSignature`, grouping included,
   * is what gets armed, so a `7/8` grouped `3+2+2` arrives as one thing.
   */
  const accept = (): void => {
    const [numerator, denominator] = currentMeter()
    const grouped = parseGrouping(grouping)
    timeSignatureSelection.press({
      timeSignature: grouped ? { numerator, denominator, grouping: grouped } : { numerator, denominator },
      cautionary: cautionary.checked,
    })
    win?.close()
  }

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
        // Sibelius's "Rewrite bars up to next time signature" is NOT here, and its absence is a
        // decision rather than an omission. Unchecked, that box changes only the meter's LABEL and
        // leaves the notes in their bars — so the bars stop adding up, which Sibelius permits and we
        // do not: a bar's capacity is a fact here, relied on by rest-fill, playback and coordinate
        // mapping. A checkbox with one reachable state teaches a choice that does not exist. It
        // returns the day bars are allowed not to add up, which is a model decision (and the same
        // one freely-notated music needs), not a checkbox.
        new Row([cautionary], { gap: 24 }),
        new Row(
          [
            new GroupBox('Pickup (Upbeat)', [
              new Row(
                [
                  new Checkbox('Start with bar of length:'),
                  new GlyphSelect(PICKUP_LENGTHS, { selected: 'q', width: 76 }),
                ],
                { gap: 10 },
              ),
            ]),
            // Opens the grouping editor, judged against the meter selected ABOVE — which is why it
            // reads `meters.value` at click time rather than capturing a meter at build time.
            // (Rest grouping and per-note-value grouping are still missing from the MODEL, not just
            // from that window — see docs/time-signature-window-plan.md §2.)
            new Button('Beam and Rest Groups…', () => {
              const [numerator, denominator] = currentMeter()
              openBeamGroupsWindow(windows, {
                numerator,
                denominator,
                grouping,
                onAccept: (value) => {
                  grouping = value
                },
              })
            }),
          ],
          // The FRAME takes the slack (child 0), which pushes the button to the far right — the
          // two are not a pair, they are the left thing and the right thing.
          { gap: 20, grow: 0 },
        ),
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', accept, { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      { gap: 14 },
    ),
  })
  return win
}
