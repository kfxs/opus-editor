import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import type { NoteDuration } from '../types/music'
import { resolveTupletInTimeOf, tupletPrintedCounts, type TupletResolution } from '../utils/musicUtils'
import { tupletSelection, type ArmedTuplet } from '../interactions/tupletSelection'
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
 * OK ARMS the tuplet for the next note — it does not apply one, because a tuplet is a group of notes
 * you are about to write and there is nothing to convert until they exist. Same contract as the
 * palette's presets, same route: {@link ../interactions/tupletSelection} → `keypadSync` →
 * `PaletteController.armTupletInTimeOf`.
 *
 * ⚠️ The *Format* box is still LOOK-ONLY, and OK deliberately drops it, because of what those
 * choices would have to be written INTO:
 *
 *   `Tuplet` (types/music.ts) carries `numNotes`, `notesOccupied` and `placement` — the ratio and the
 *   side. It has NO field for what the mark shows (number / ratio / ratio + note / nothing), none for
 *   the bracket (auto / always / never), and none for "full duration". Those are four new fields on
 *   the model plus four decisions in the renderer, and inventing them from a screenshot is exactly the
 *   move that lands a field nobody wanted. The picture comes first; the model follows it, once.
 *
 * So that half of the dialog is still the QUESTION — is this the dialog? — and not yet the answer.
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

/** The ratio's font size, in px — the dialog's answer, read at a glance from across the desk. Fits
 *  the two lines held for the readout, so it does not change the window's height. */
const RATIO_SIZE = 20

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

  /** What the six controls currently say, as the entry the palette's own boxes would send. Read at
   *  CLICK time, never captured: every control moves under it. */
  const entry = (): ArmedTuplet => ({
    numNotes: count.value,
    unit: unit.value as NoteDuration,
    unitDots: unitDotted.checked ? 1 : 0,
    normalCount: normalCount.value,
    normalUnit: normalUnit.value as NoteDuration,
    normalDots: normalDotted.checked ? 1 : 0,
  })

  /** Whether that entry is a tuplet at all — asked of the same rule the palette asks. */
  const resolve = (): TupletResolution => {
    const e = entry()
    return resolveTupletInTimeOf(e.numNotes, e.unit, e.normalCount, e.normalUnit, e.unitDots, e.normalDots)
  }

  /**
   * What those six controls come to — or WHY they come to nothing. A refusal states the VERDICT
   * first and the reason second, in two tones: the verdict is what you need at a glance, the reason
   * is what you need once you have stopped to read.
   *
   * The ratio is the one the MARK will print (`tupletPrintedCounts`), derived from the shape rather
   * than read off it, so the readout and the engraved number cannot disagree.
   */
  const verdict = (): { text: string; tone: 'value' | 'error' | 'warn'; newLine?: boolean; size?: number }[] => {
    const resolved = resolve()
    if (resolved.ok) {
      const printed = tupletPrintedCounts(resolved.shape)
      // The ANSWER, and printed like one: bigger than the prose around it and in the value blue,
      // because it is the one thing in this dialog you are here to read.
      return [{ text: `${printed.numNotes}:${printed.notesOccupied}`, tone: 'value', size: RATIO_SIZE }]
    }
    // The verdict on its own line, the reason under it: two statements, read in that order, and the
    // reason is then free to be as long as it needs without pushing the verdict out of the way. The
    // colon is what carries the first line into the second — a dash would read as a clause of a
    // sentence that has already ended.
    return [
      { text: "Can't build this tuplet:", tone: 'error' },
      { text: resolved.reason, tone: 'warn', newLine: true },
    ]
  }

  // TWO lines are held for the verdict from the start, whatever it currently says: a ratio is one
  // line and a refusal is two, and without the reservation the whole dialog would change size under
  // your hands as you type. Built with the CURRENT verdict rather than empty for the same reason —
  // the window measures itself as it opens, and a readout that fills in afterwards is measured blank.
  const readout = new Label(verdict().map((p) => p.text).join(''), { lines: 2 })

  /**
   * Commit: ARM the tuplet for the next note, and get out of the way.
   *
   * Arming and not applying, because a tuplet is a group of notes you are about to WRITE — there is
   * nothing to convert until they exist. That is the same contract the palette's presets have had all
   * along, and the routing is the palette's own `armTupletInTimeOf`, reached through
   * {@link tupletSelection}: the window publishes the sentence, `keypadSync` hands it to the
   * controller. The Format choices do NOT travel — the model has nowhere to put them yet (see above),
   * and a dialog that silently drops half of what you set would be worse than one that cannot set it.
   *
   * A refusal is refused HERE too, not only greyed on the button: Enter reaches this function without
   * touching the button at all.
   */
  const accept = (): void => {
    if (!resolve().ok) return
    tupletSelection.press(entry())
    win?.close()
  }

  // Held so the verdict can grey it: an OK that cannot work must not look like it can.
  const okButton = new Button('OK', accept, { variant: 'primary' })

  /**
   * Repaint the verdict, grey OK when there is nothing to arm, and re-fit the window in case it no
   * longer fits. With two lines reserved the refit is normally a no-op — it is the backstop for a
   * message longer than the reservation, since `fitContent` measures once at open and anything past
   * that height is CLIPPED, buttons first.
   */
  const refresh = (): void => {
    const resolved = resolve()
    readout.setParts(verdict())
    okButton.setDisabled(!resolved.ok)
    if (win) windows.refit(win)
  }

  const numberStyle = new RadioGroup(NUMBER_STYLES, { selected: 'number', direction: 'column' })
  const bracket = new RadioGroup(BRACKETS, { selected: 'auto', direction: 'column' })
  const fullDuration = new Checkbox('Full duration')

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
        new Row([new Button('Cancel', () => win?.close()), okButton], {
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
