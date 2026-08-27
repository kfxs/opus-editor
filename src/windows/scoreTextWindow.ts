import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import type { ScoreTextField } from '@/engine/models/scoreTextOps'
import { bus } from '@/bus'
import { Column, Row } from './content/layout'
import { Button, Label, TextInput } from './content/widgets'

/**
 * 🚧 The **Add Title / Add Composer** dialog — one text box and two buttons (his ask, 2026-08-27:
 * *"it should open a dialog for entry a text"*).
 *
 * ⭐ **ONE window for BOTH rows**, parameterised by {@link ScoreTextField}. They differ in the word
 * on the title bar and the caption beside the box, so two modules would be a copy with one string
 * changed — the thing `engine/models/scoreTextOps`' table exists to prevent, and the same call the
 * selection kind, the hit-test and the drawn row each made.
 *
 * ⭐ **It OPENS ON WHAT IS THERE**, so the row is *edit* as much as *add*: a score already titled
 * shows its title, selected, and typing replaces it. That is why the caller passes `current` — the
 * window is a dumb publisher and may not read the score (`bus/scoreTextSelection`).
 *
 * ⭐ **Emptying the box and pressing OK DELETES the field.** No Clear button and — his call,
 * 2026-08-27 — no line of text saying so either: a one-box dialog does not need a caption explaining
 * that an empty box means empty. The rule lives in one place (`scoreTextOps.setScoreText`), not in a
 * second control and not in prose.
 *
 * ⛔ Scaffolding: read `engine/rendering/ScoreHeaderPass`'s note before treating this as the
 * score-text feature. The real thing edits a text ITEM in place on the page, not in a dialog.
 */

/** What each field calls itself, where the user can see it. ⭐ A row, not a `field === 'title' ?`. */
const FIELD_LABELS: Record<ScoreTextField, { title: string; caption: string; placeholder: string }> = {
  title: { title: 'Title', caption: 'Title', placeholder: 'Untitled' },
  composer: { title: 'Composer', caption: 'Composer', placeholder: 'Anonymous' },
}

/** The caption column's width in px — wide enough for the longer of the two words at the window's
 *  14 px face. Stated once so the two dialogs' boxes start at the same place. */
const CAPTION_WIDTH = 72

export function openScoreTextWindow(
  windows: WindowLayer,
  field: ScoreTextField,
  /** What the score says NOW, so the dialog opens on it. Blank/absent for a field with nothing. */
  current?: string,
): Window {
  let win: Window | null = null
  const labels = FIELD_LABELS[field]

  const input = new TextInput({
    value: current ?? '',
    placeholder: labels.placeholder,
    onEnter: () => accept(),
  })

  /** Commit: publish what was typed and get out of the way. ⭐ Blank is published too — it is the
   *  DELETE, and refusing it here would make an emptied box silently do nothing. */
  const accept = (): void => {
    bus.scoreText.set({ field, text: input.value })
    win?.close()
  }

  win = windows.open({
    title: labels.title,
    // One row of caption + box. Wide enough for a real title to be read back at a glance, which is
    // the point of opening on the current value.
    width: 360,
    fitContent: true,
    // A dialog you summoned belongs where you are already looking, not on the cascade.
    center: true,
    resizable: false,
    onCancel: () => win?.close(),
    onAccept: accept,
    content: new Column(
      [
        // `grow: 1` — the BOX takes the leftover width, so the field is as wide as the dialog and a
        // real title is readable in it. The caption keeps its fixed column.
        new Row([new Label(labels.caption, { muted: true, width: CAPTION_WIDTH }), input], { gap: 6, grow: 1 }),
        // Cancel then OK, left to right, OK primary — the platform order, and every other dialog's.
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', accept, { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      { gap: 12 },
    ),
  })

  // AFTER open(): the widget exists only once mounted. Opens ON the box with its text selected, so
  // typing replaces what is there and Enter alone accepts it.
  input.focus()
  return win
}
