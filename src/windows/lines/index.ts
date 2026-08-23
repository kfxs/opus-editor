import type { WindowLayer } from '../WindowLayer'
import type { Window } from '../Window'
import { Column, Row } from '../content/layout'
import { Button, ChoiceList, Label } from '../content/widgets'
import { LINE_CHOICES } from './linePictures'

/**
 * The Lines window, opened from Insert ▸ Lines (or L) — modelled on Sibelius's Lines dialog: a box
 * of pictures you scroll, one of them lit, and Cancel / OK underneath.
 *
 * ⚠️ **NOTHING IS WIRED, deliberately and for now.** OK closes the window and places nothing. This
 * is the SHAPE of the dialog being settled first — which rows there are, how a line is drawn small
 * enough to pick from a list — and what each row will eventually arm is a separate decision, one per
 * row, with the mark's own module behind it (`slurOps`, the hairpin, `TrillRenderer`, the ottava,
 * the pedal). Building the picture and the wiring in one go would decide both at once, and only one
 * of them is being asked about.
 *
 * ⏭️ **ONE COLUMN, where Sibelius has two.** Its *System lines* column — repeat brackets (`1.`,
 * `1.2.`), the rit./accel. dashes, the arrow — is a different kind of object: it belongs to the
 * SYSTEM rather than to a staff, and half of it does not exist here yet. The window is a `Columns`
 * away from carrying it (`content/layout`), and the caption above the list is already the one that
 * tells the two apart.
 */

export function openLinesWindow(windows: WindowLayer): Window {
  // Captured in a `let` because the buttons are built before `open()` returns but only run after —
  // the clef window's pattern, and the reason a window definition needs no forward declaration.
  let win: Window | null = null

  /**
   * Commit. It closes, and that is all it does today — see the header. The path exists (OK, Enter
   * and a double-click all arrive here) so that wiring it later is ONE function body, not a hunt
   * through three call sites.
   */
  const accept = (): void => {
    win?.close()
  }

  const list = new ChoiceList([...LINE_CHOICES], {
    // Opens on the first row, lit, so the list never looks like it has nothing chosen. Re-opening
    // will one day reflect what is armed, the way the clef window does — when there is something to
    // arm.
    selected: LINE_CHOICES[0].value,
    onActivate: accept,
  })

  win = windows.open({
    title: 'Lines',
    // As narrow as the pictures need (150) plus the window's own padding, and no wider — the
    // reference dialog's column is this narrow because a line reads the same at any length.
    width: 200,
    // As tall as the rows need, clamped by the layer to the viewport — seven pictures fit, and the
    // box keeps its scroll for the day there are more.
    fitContent: true,
    // A dialog you summoned belongs where you are already looking, not on the cascade.
    center: true,
    resizable: false,
    // Escape is Cancel and Enter is OK — wired to the very functions the buttons call, so there is
    // one path per act and no second implementation.
    onCancel: () => win?.close(),
    onAccept: accept,
    content: new Column(
      [
        // The caption the clef window does without: there, the window is titled Clef and the rows ARE
        // clefs. Here the title cannot say which KIND of line the column holds, and Sibelius's own
        // dialog needs the same two words for the same reason.
        new Label('Staff lines:'),
        list,
        // Cancel then OK, left to right, with OK the primary — the platform order, and Sibelius's.
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', accept, { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      // The LIST (child 1) takes the slack: the caption and the button row are as tall as they are,
      // and every extra pixel of window height is another line you can see.
      { gap: 10, grow: 1 },
    ),
  })
  return win
}
