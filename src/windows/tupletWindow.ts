import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import { Column, Columns, GroupBox, Row } from './content/layout'
import { Button, Checkbox, Label, NumberInput, RadioGroup } from './content/widgets'

/**
 * The Tuplet window, opened from Insert ▸ Tuplet — modelled on Sibelius's Tuplet dialog: the tuplet's
 * NUMBER in a field at the top, then a *Format* box of two independent choices side by side (what the
 * mark says, and what bracket it gets), and the reminder that you never needed the dialog at all.
 *
 * ⚠️ LOOK-ONLY, still — the same stage the Clef window opened at. Everything below is laid out and
 * nothing is wired: OK closes and writes no score. That is deliberate and not an oversight, because
 * of what the format options would have to be written INTO:
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

  // Captured so the accept path can read them once they mean something; today it reads nothing.
  const count = new NumberInput({ value: 3, min: 2, width: 64 })
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
    width: 340,
    fitContent: true,
    // A dialog you summoned belongs where you are already looking, not on the cascade.
    center: true,
    resizable: false,
    onCancel: () => win?.close(),
    onAccept: accept,
    content: new Column(
      [
        // Centred and unlabelled, as in Sibelius: the window is titled Tuplet and the field is the
        // only number in it — a "Number of notes:" caption would name what the title already said.
        new Row([count], { align: 'center' }),
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

  // Opens ON the number, selected — the field the dialog exists to change, and the picture's own
  // state (its "3" is highlighted). Typing 5 then Enter is then the whole interaction.
  count.focus()
  return win
}
