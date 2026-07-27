import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import { Column, Row } from './content/layout'
import { Button, Label, TextInput } from './content/widgets'
import { groupingError, parseGrouping } from '../utils/groupingInput'

/**
 * Beam and Rest Groups — opened from the Time Signature window's button.
 *
 * ONE control for now: the beat grouping, in denominator units, judged as you type. It is the same
 * field (and literally the same rule — utils/groupingInput) that the old custom-meter dialog had;
 * this is where it went when that dialog was retired.
 *
 * ⚠️ It is NOT the whole of Sibelius's dialog, and two things are missing on purpose:
 *
 *   • REST grouping — how rests coalesce within a beat group — is not modelled at all. Nothing here
 *     stands in for it; a control that did nothing would be worse than its absence.
 *   • Per-note-value grouping. `TimeSignature.grouping` is ONE array, so it can say "3+3+2" and it
 *     cannot say "eighths as 3+3+2 but sixteenths as 4+4+4". That second level is a model change,
 *     not a field on this window.
 *
 * Both are written up in docs/time-signature-window-plan.md §2. The window is named for what it will
 * be rather than what it is, because renaming it later would break the one thing a user remembers.
 */
export interface BeamGroupsOptions {
  /** The meter being grouped — the grouping must sum to its numerator, so it is judged against it. */
  numerator: number
  denominator: number
  /** The grouping as it stands, in the field's own text form (`3+3+1`). Empty = algorithmic default. */
  grouping: string
  /** Handed the accepted text — the caller keeps the value, this window only edits it. */
  onAccept: (grouping: string) => void
}

export function openBeamGroupsWindow(windows: WindowLayer, opts: BeamGroupsOptions): Window {
  const error = new Label('', { tone: 'error' })
  const field = new TextInput({
    value: opts.grouping,
    placeholder: 'optional, e.g. 2+2+3',
    // No `onEnter` here: the WINDOW owns Enter (`onAccept` below), so a field-level handler would
    // be a second implementation of the same act — and would fire twice the day they disagree.
    onInput: () => validate(),
  })

  let ok: Button | null = null
  let win: Window | null = null

  /** Judged on every keystroke: the message names the problem, and OK will not commit a wrong one. */
  const validate = (): boolean => {
    const message = groupingError(field.value, opts.numerator, opts.denominator)
    error.setText(message ?? '')
    ok?.setDisabled(message !== null)
    return message === null
  }

  const accept = (): void => {
    if (!validate()) return
    // Normalized on the way out, so `3 3 1` and `3+3+1` are stored as the same thing and the field
    // does not preserve whichever separator happened to be typed.
    const parsed = parseGrouping(field.value)
    opts.onAccept(parsed ? parsed.join('+') : '')
    win?.close()
  }

  ok = new Button('OK', accept, { variant: 'primary' })

  win = windows.open({
    title: 'Beam and Rest Groups',
    width: 360,
    center: true,
    resizable: false,
    fitContent: true,
    onCancel: () => win?.close(),
    onAccept: accept,
    content: new Column(
      [
        new Row([new Label(`Grouping for ${opts.numerator}/${opts.denominator}`)], { gap: 8 }),
        field,
        new Label('In denominator units; must sum to the numerator.', { muted: true }),
        error,
        new Row([new Button('Cancel', () => win?.close()), ok], { gap: 8, align: 'end' }),
      ],
      { gap: 8 },
    ),
  })

  validate() // an invalid value handed in must not open behind a live OK
  return win
}
