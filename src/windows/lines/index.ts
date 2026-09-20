import type { WindowLayer } from '../WindowLayer'
import type { Window } from '../Window'
import { Column, Row } from '../content/layout'
import { Button, ChoiceList, Label } from '../content/widgets'
import { bus } from '@/bus'
import type { LineToolKind } from '@/bus/lineSelection'
import { shortcutLabel } from '@/shortcuts/shortcutLabel'
import { LINE_CHOICES } from './linePictures'

/**
 * The Lines window, opened from Insert ▸ Lines (or L) — modelled on Sibelius's Lines dialog: a box
 * of pictures you scroll, one of them lit, and Cancel / OK underneath.
 *
 * ⭐⭐ **OK IS THE LINES PALETTE'S BUTTON.** Committing presses `bus.line`, which
 * `interactions/stamps/lineTools` routes to the very `PaletteController` method the dev shell's *Lines:*
 * row calls — so with notes selected the mark is made, with nothing selected the STAMP is armed (the
 * blue pointer; the next click places it), and pressing the armed one again turns it off. The dialog
 * adds a door, never a second behaviour: that is why it knows no palette, no engine and no model,
 * and why the routing lives in one table rather than in this file.
 *
 * ⏭️ **ONE COLUMN, where Sibelius has two.** Its *System lines* column — repeat brackets (`1.`,
 * `1.2.`), the rit./accel. dashes, the arrow — is a different kind of object: it belongs to the
 * SYSTEM rather than to a staff, and half of it does not exist here yet. The window is a `Columns`
 * away from carrying it (`content/layout`), and the caption above the list already tells the two
 * apart.
 */

/**
 * Which shortcut ACTION a row also answers to, for the hint at its right edge. Three of the seven
 * have a key; the rest deliberately have none (his call — Sibelius has no key for its trill or its
 * octave lines either, and `P` is taken here by PLAY).
 *
 * ⚠️ Action NAMES, not keys: the key itself is read from `SHORTCUTS` at build time
 * (`shortcutLabel`), so rebinding one updates the dialog and nobody has to remember this file
 * exists. `shortcutLabel.test.ts` holds the guard that these three names still resolve.
 */
const ROW_SHORTCUT: Partial<Record<LineToolKind, string>> = {
  slur: 'createSlur',
  cresc: 'createCrescendo',
  dim: 'createDiminuendo',
}

export function openLinesWindow(windows: WindowLayer): Window {
  // Captured in a `let` because the buttons are built before `open()` returns but only run after —
  // the clef window's pattern, and the reason a window definition needs no forward declaration.
  let win: Window | null = null

  /**
   * Commit: press the line and get out of the way — the clef window's shape exactly. What the press
   * MEANS is the palette's business (apply / arm / disarm), which is why this closes unconditionally:
   * the score is where the rest of the gesture happens, whichever of the three it turned out to be.
   */
  const accept = (): void => {
    bus.line.press(list.value as LineToolKind)
    win?.close()
  }

  const list = new ChoiceList(
    LINE_CHOICES.map((choice) => {
      const action = ROW_SHORTCUT[choice.value]
      const hint = action === undefined ? null : shortcutLabel(action)
      return hint === null ? choice : { ...choice, hint }
    }),
    {
      // Opens on whatever line tool is ARMED, so re-opening reflects the editor rather than resetting
      // to the top row — `bus.line`'s highlight channel, mirrored in by `keypadSync`. Nothing armed →
      // the slur, the one this family starts with.
      selected: bus.line.get() ?? LINE_CHOICES[0].value,
      onActivate: accept,
    },
  )

  win = windows.open({
    title: 'Lines',
    // As narrow as the pictures need (190, the drawing plus the hint's gutter) and the window's own
    // padding — the reference dialog's column is about this wide, because a line reads the same at
    // any length and a wider row only buys more of the same dashes.
    width: 240,
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
