import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import type { NoteDuration } from '../types/music'
import { resolveTupletInTimeOf, tupletPrintedCounts } from '../utils/musicUtils'
import { Column, Columns, GroupBox, Row } from './content/layout'
import { Button, Checkbox, GlyphSelect, Label, NumberInput, RadioGroup } from './content/widgets'

/**
 * The Tuplet window, opened from Insert ▸ Tuplet — Sibelius's Tuplet dialog with Finale's question
 * at the top of it: "**N** [note] in the time of **M** [note]", then a *Format* box of two
 * independent choices side by side (what the mark says, and what bracket it gets), and the reminder
 * that you never needed the dialog at all.
 *
 * The entry row is the palette sketch's, moved to where it belongs — and it is not a second copy of
 * anything: the arithmetic is `resolveTupletInTimeOf` in utils, the one both askers call. Sibelius
 * asks only for the NUMBER because it infers the rest from what you selected; we ask the whole
 * sentence, because a dialog you opened from a menu may have nothing selected to infer from.
 *
 * ⚠️ LOOK-ONLY, still — the same stage the Clef window opened at. Everything below is laid out and
 * nothing is wired: OK closes and writes no score (the readout is live, but it only READS). That is
 * deliberate and not an oversight, because of what the format options would have to be written INTO:
 *
 *   `Tuplet` (types/music.ts) carries `numNotes`, `notesOccupied` and `placement` — the ratio and the
 *   side. It has NO field for what the mark shows (number / ratio / ratio + note / nothing), none for
 *   the bracket (auto / always / never), and none for "full duration". Those are four new fields on
 *   the model plus four decisions in the renderer, and inventing them from a screenshot is exactly the
 *   move that lands a field nobody wanted. The picture comes first; the model follows it, once.
 *
 * So the controls below are the QUESTION — is this the dialog? — and not yet the answer.
 *
 * Two departures from the screenshot, both on purpose:
 *   • The advisory line is muted grey, not Sibelius's blue: that blue on our dark glass is a contrast
 *     failure, and a hint you have to squint at is not a hint.
 *   • No spinner-less field. `NumberInput` is what we have for a number, and its steppers are the
 *     browser's — cheaper than a second number field that only differs cosmetically.
 */

/**
 * The note values either side of "in the time of", DRAWN — a note value is a glyph, and the same
 * list (and the same font) the palette's sketch and the Keypad's duration keys show.
 *
 * `label` is not shown: it is the tooltip and the accessible name, so the control still says what it
 * is to a screen reader. Codepoints written out — Bravura's PUA is invisible in an editor.
 */
const TUPLET_UNITS = [
  { value: 'w', glyph: '\uE1D2', label: 'Whole' },
  { value: 'h', glyph: '\uE1D3', label: 'Half' },
  { value: 'q', glyph: '\uE1D5', label: 'Quarter' },
  { value: '8', glyph: '\uE1D7', label: 'Eighth' },
  { value: '16', glyph: '\uE1D9', label: 'Sixteenth' },
  { value: '32', glyph: '\uE1DB', label: 'Thirty-second' },
]

/** The caption column both entry rows open with, in px — wide enough for "in the time of" at the
 *  window's 14px face, with air after it. Stated once because BOTH rows must use the same number:
 *  that equality is the alignment. */
const PHRASE_WIDTH = 96

/** What the tuplet's mark SAYS. Sibelius's left column, in its order. */
const NUMBER_STYLES = [
  { value: 'number', label: 'Number' },
  { value: 'ratio', label: 'Ratio' },
  { value: 'ratio-note', label: 'Ratio + note' },
  { value: 'none', label: 'None' },
]

/** What the tuplet's BRACKET does. Sibelius's right column — auto = drawn only when unbeamed. */
const BRACKETS = [
  { value: 'auto', label: 'Auto-bracket' },
  { value: 'bracket', label: 'Bracket' },
  { value: 'none', label: 'No bracket' },
]

export function openTupletWindow(windows: WindowLayer): Window {
  let win: Window | null = null

  // "N ♪ in the time of M ♪" — the palette's sketch, in the dialog it belongs in. The four boxes and
  // their two dots are all that is typed; what they COME TO is asked of the engine, never worked out
  // here (see `readout`).
  //
  // `count` is the N box — and is the field that used to sit centred and alone at the top. It is not
  // duplicated below it: N is ONE fact, and a dialog with two fields for it is a dialog that can be
  // made to contradict itself.
  const count = new NumberInput({ value: 3, min: 2, width: 56, onInput: () => refresh() })
  const unit = new GlyphSelect(TUPLET_UNITS, { selected: '8', width: 62, onChange: () => refresh() })
  const unitDotted = new Checkbox('dotted', { onChange: () => refresh() })
  const normalCount = new NumberInput({ value: 1, min: 1, width: 56, onInput: () => refresh() })
  const normalUnit = new GlyphSelect(TUPLET_UNITS, { selected: 'q', width: 62, onChange: () => refresh() })
  const normalDotted = new Checkbox('dotted', { onChange: () => refresh() })

  /**
   * What those six controls come to — or WHY they come to nothing. A refusal states the VERDICT
   * first and the reason second, in two tones: the verdict is what you need at a glance, the reason
   * is what you need once you have stopped to read.
   *
   * The ratio is the one the MARK will print (`tupletPrintedCounts`), derived from the shape rather
   * than read off it, so the readout and the engraved number cannot disagree.
   */
  const verdict = (): { text: string; tone: 'normal' | 'error' | 'warn' }[] => {
    const resolved = resolveTupletInTimeOf(
      count.value,
      unit.value as NoteDuration,
      normalCount.value,
      normalUnit.value as NoteDuration,
      unitDotted.checked ? 1 : 0,
      normalDotted.checked ? 1 : 0,
    )
    if (resolved.ok) {
      const printed = tupletPrintedCounts(resolved.shape)
      return [{ text: `${printed.numNotes}:${printed.notesOccupied}`, tone: 'normal' }]
    }
    return [
      { text: "Can't build this tuplet", tone: 'error' },
      { text: ` — ${resolved.reason}`, tone: 'warn' },
    ]
  }

  // Built with the CURRENT verdict, not empty: the window measures itself once as it opens, and a
  // readout that fills in afterwards would be measured as a blank line — which is exactly how the OK
  // button ended up below the window's bottom edge.
  const readout = new Label(verdict().map((p) => p.text).join(''))

  /**
   * Repaint the verdict and RE-FIT the window to it. The refit is not optional: `fitContent` measures
   * at open and the height it finds is then fixed, so a two-line refusal where a one-line ratio used
   * to be is simply clipped — and what gets clipped is the row of buttons at the bottom.
   */
  const refresh = (): void => {
    readout.setParts(verdict())
    if (win) windows.refit(win)
  }

  const numberStyle = new RadioGroup(NUMBER_STYLES, { selected: 'number', direction: 'column' })
  const bracket = new RadioGroup(BRACKETS, { selected: 'auto', direction: 'column' })
  const fullDuration = new Checkbox('Full duration')

  /**
   * Commit: closes, and nothing more — see the LOOK-ONLY note above. It is a named function and the
   * target of both OK and Enter so that the day it creates a tuplet, one function changes.
   */
  const accept = (): void => {
    win?.close()
  }

  win = windows.open({
    title: 'Tuplet',
    // Wide enough for the whole entry row — caption column, number, note value and its dot — on ONE
    // line. A row that wraps is a row whose columns no longer line up, which is the thing this
    // layout is for.
    width: 380,
    fitContent: true,
    // A dialog you summoned belongs where you are already looking, not on the cascade.
    center: true,
    resizable: false,
    onCancel: () => win?.close(),
    onAccept: accept,
    content: new Column(
      [
        // The sentence, in the order a player says it: what you PLAY, then what it REPLACES.
        //
        // Both rows open with a caption column of the same fixed width — the phrase on the second
        // row, and the SPACE held for it on the first. That is what puts the two numbers in one
        // column and the two note values in another: the pair you are comparing is read DOWN, and a
        // second row shifted right by the width of a phrase cannot be read that way.
        new Row([new Label('', { width: PHRASE_WIDTH }), count, unit, unitDotted], { gap: 6 }),
        new Row([new Label('in the time of', { muted: true, width: PHRASE_WIDTH }), normalCount, normalUnit, normalDotted], {
          gap: 6,
        }),
        // Under the boxes, where a verdict on what you just typed belongs.
        readout,
        new GroupBox('Format', [
          // TWO groups, not one two-column group: the mark and the bracket are independent choices
          // (a triplet can read "3" with no bracket, or nothing with one), and one RadioGroup of seven
          // options would let picking a bracket clear the number.
          new Columns([numberStyle, new Column([bracket, fullDuration], { gap: 8 })], {
            gap: 20,
            // A divider would say these are separate PANES; they are two halves of one Format box.
            divider: false,
          }),
        ]),
        // Sibelius's own advice, kept word for word: the dialog is the long way round, and the box
        // that says so is the box teaching you not to open it again.
        new Label('Instead of using this dialog you can just select a note and type Ctrl + a number.', {
          muted: true,
        }),
        // Cancel then OK, left to right, OK primary — the platform order, and the screenshot's.
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', accept, { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      { gap: 12 },
    ),
  })

  // AFTER open(): the widgets exist only once mounted, and the readout writes into one.
  refresh()

  // Opens ON the number, selected — the field the dialog exists to change, and the picture's own
  // state (its "3" is highlighted). Typing 5 then Enter is then the whole interaction.
  count.focus()
  return win
}
