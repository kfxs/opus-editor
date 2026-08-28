import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import { Column, Row } from './content/layout'
import { Button, Label, Picture, RadioGroup } from './content/widgets'
import { keySignaturePicture } from './keySignaturePicture'
import { bus } from '@/bus'
import { keyFromFifths, fifthsOf } from '@/utils/keySignature'
import type { KeySignature } from '@/types/music'

/**
 * **The Key Signature window** — a STEPPER along the circle of fifths, not a list of keys.
 *
 * His idea, 2026-08-27: *"I don't like the list in Sibelius' key menu because it is redundant. But I
 * remember that in Finale we used to have an arrow that we can increase in the sharp or go down in
 * the flat, and we can select key like this... I think it is a better method."* It stood up in `dev/`
 * as a sketch first, so the gesture could be looked at rather than imagined; it is the real dialog
 * now, and this is where it is iterated.
 *
 * ## ⭐ What the stepper is ARGUING
 *
 * A traditional key signature has **one degree of freedom** — a position on the circle of fifths —
 * plus a name for it. Sibelius spends a scrolling gallery on that: fifteen signatures × major and
 * minor is thirty-one cells for fifteen distinct pictures, in which each signature appears twice and
 * every row must be read to be told apart from its neighbour. The stepper says the same thing as an
 * AXIS: one control, ▲ sharpwards, ▼ flatwards, and the mode is the separate question it actually
 * is. ⭐ The survey (plan §7) found this is Finale's gesture verbatim, and that Dorico ships one too.
 *
 * ⛔ **The stepper is NOT the whole family.** It reaches the fifteen circle-of-fifths signatures and
 * nothing else, because that is all an axis CAN reach — a mixed Bartók-style signature (one flat plus
 * one sharp) has no position on the circle, and `utils/keySignature.ts` exists so the model can hold
 * one anyway. Its editor is a separate room (plan §7, "the custom/mixed signature editor"); ⛔ do not
 * grow it out of this axis.
 *
 * ⚠️ It shows the signature as LETTERS (`F♯ C♯`), not as glyphs on a staff. That was true of the
 * sketch because the placement table did not exist yet; it is now a TASTE call still owed his eye —
 * the Clef window draws its four thumbnails and this may want the same.
 *
 * Committing (OK, or Enter) ARMS the signature and closes: the next click on the score says WHICH
 * BAR, which is the palette bargain every stamp in this editor shares (`bus.keySignature` →
 * `PaletteController.pressKeySignature`, so a press from here and a press from the dev palette are
 * one action). Cancel arms nothing.
 */

/** The circle of fifths, −7 … +7 — the whole domain of a traditional signature. */
const MIN_FIFTHS = -7
const MAX_FIFTHS = 7

/**
 * Major key names by `fifths`, from C♭ major (7 flats) to C♯ major (7 sharps), and the relative
 * minors beneath them.
 *
 * ⚠️ **Names, not model.** This is the third of `fifths`'s three jobs and the only one it wins —
 * `utils/keySignature.ts` sets out why the other two belong to the alteration list. A name table
 * here is a LABEL for a dialog; ⛔ it is not permission to store a key as an integer.
 */
const MAJOR_NAMES = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯']
const MINOR_NAMES = ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯']

/** The order sharps are added in, and flats — the same list backwards (`utils/keySignature.ts`). */
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/**
 * The three modes the dialog offers, which are `KeySignature.mode`'s own three values — ⛔ not a
 * vocabulary of this window's: a fourth would be the model's to add, and the radio would follow.
 *
 * ⭐ **`'open'` is the atonal key, and it is NOT C major** (his ask, 2026-08-28). Both have an empty
 * alteration list and they are different statements: they differ in transposition and in what a
 * change *to* them means, which is why the model keeps `mode` three-valued and `keysEqual` compares
 * it (`types/music.ts`, `engine/models/keyOps.ts` — setting an open key at bar 1 stores a real
 * change where C major stores nothing).
 */
type KeyMode = 'major' | 'minor' | 'open'

/** `G major` / `E minor` / `Atonal` — the key's NAME. Only a circle-of-fifths key has a traditional
 *  one; the open key's name is the word for having none. */
function keyName(fifths: number, mode: KeyMode): string {
  if (mode === 'open') return 'Atonal'
  const names = mode === 'major' ? MAJOR_NAMES : MINOR_NAMES
  return `${names[fifths - MIN_FIFTHS]} ${mode}`
}

/** `F♯ C♯` — the altered letters, in signature order. The list that IS the model. */
function alterationLetters(fifths: number): string {
  if (fifths === 0) return ''
  const order = fifths > 0 ? SHARP_ORDER : FLAT_ORDER
  const sign = fifths > 0 ? '♯' : '♭'
  return order.slice(0, Math.abs(fifths)).map(step => step + sign).join(' ')
}

/** `2 sharps` / `1 flat` / `no sharps or flats` — the count, said in words. */
function countPhrase(fifths: number, mode: KeyMode): string {
  // ⭐ The one line that keeps the two empty signatures apart on screen. An atonal key prints nothing
  // for the same reason C major does, and means something else by it — a reader who is told only
  // "no sharps or flats" has been shown the picture and denied the statement.
  if (mode === 'open') return 'no key signature — not C major'
  if (fifths === 0) return 'no sharps or flats'
  const n = Math.abs(fifths)
  return `${n} ${fifths > 0 ? 'sharp' : 'flat'}${n === 1 ? '' : 's'}`
}

export function openKeySignatureWindow(windows: WindowLayer): Window {
  // A `let`, because the buttons are built before `open()` returns and only run afterwards — the
  // same shape `openClefWindow` uses.
  let win: Window | null = null

  // Opens on whatever is already armed, so re-opening reflects the editor rather than resetting to C
  // — the Clef window's rule. ⚠️ `fifthsOf` returns null for a signature with no place on the circle
  // (a mixed one, or an OPEN key): there is no step to start from, so the axis starts at its origin.
  const armed = bus.keySignature.get()
  const armedFifths = armed ? fifthsOf(armed) : null
  let fifths = armedFifths ?? 0
  let mode: KeyMode = armed?.mode === 'minor' ? 'minor' : armed?.mode === 'open' ? 'open' : 'major'

  /**
   * ⭐ **The signature the dialog is currently saying** — ONE function, because the picture and the
   * OK button must not build it apart: a staff that draws from one construction and a press that
   * arms another is the two-sets-of-numbers problem inside a single window.
   *
   * ⭐ `keyFromFifths` is the CLASSICAL CONSTRUCTOR (the same call the dev palette's buttons make);
   * the atonal key is the one signature it cannot build, and correctly so — its argument is a
   * position on the circle and an open key has none (`fifthsOf` answers `null` for it). An empty list
   * with `mode: 'open'` IS the whole statement.
   */
  const currentKey = (): KeySignature =>
    mode === 'open' ? { alterations: [], mode: 'open' } : keyFromFifths(fifths, mode)

  /**
   * ⭐ The readout is ONE Label in three runs, not three stacked Labels — the name, the count and
   * the letters are one statement that must change together, and `lines: 3` reserves the height so
   * a fit-to-content dialog does not resize itself under the pointer as you step. (Both rules are
   * the widget's own, see `Label`.)
   */
  const readout = new Label('', { lines: 3 })

  /**
   * ⭐ **THE SIGNATURE ITSELF, on a treble staff** — his ask, 2026-08-28: *"insert the staff with a
   * treble clef so the user can see the key while is adding the accidentals"*. It is redrawn on every
   * step, and it is drawn from the ENGINE's placement and spacing tables (`./keySignaturePicture`),
   * so what the dialog shows and what the click engraves cannot say different things.
   *
   * ⏭️ Treble is fixed here on purpose: the signs sit differently under each clef, and WHICH clef a
   * picker should show — the one at the bar you are about to click, or one you choose — is a question
   * of its own. The picture already takes the argument.
   */
  const staff = new Picture(keySignaturePicture(currentKey()))

  // ▲ is sharpwards and ▼ is flatwards, which is the direction Finale's stepper describes: up the
  // circle of fifths adds a sharp, down it adds a flat. They disable at the ends rather than
  // wrapping — C♯ major stepping round to C♭ major would be a 14-semitone jump dressed as one click.
  // `compact`: tighter padding, same type (his call, 2026-08-28 — *"the buttons can be also a litle
  // bit smoler (but he size of the label of the buttons are ok)"*). A one-glyph button is nearly all
  // air, and beside a staff four spaces tall the default box reads as the bigger object.
  const up = new Button('▲', () => step(+1), { compact: true })
  const down = new Button('▼', () => step(-1), { compact: true })

  const refresh = (): void => {
    const letters = alterationLetters(fifths)
    staff.setPicture(keySignaturePicture(currentKey()))
    readout.setParts([
      { text: keyName(fifths, mode), tone: 'value', size: 20 },
      { text: countPhrase(fifths, mode), tone: 'muted', newLine: true },
      // ⭐ An empty signature leaves this line BLANK (his call, 2026-08-28) — it read "(the staff
      // shows nothing)", which was written when the staff was not drawn and the reader had only
      // words to go on. The staff now shows nothing, in front of him; saying so as well is a caption
      // on an empty picture. ⚠️ The row stays RESERVED (`lines: 3`), so the dialog does not resize.
      { text: letters, newLine: true },
    ])
    up.setDisabled(fifths >= MAX_FIFTHS)
    down.setDisabled(fifths <= MIN_FIFTHS)
    // ⭐⭐ **ATONAL IS OFFERED ONLY WHERE IT CAN BE TRUE** — his rule, 2026-08-28: *"this should be
    // choisable just in the case of no alteration in the key"*. An open key is the absence of a
    // signature; "atonal with two sharps" is not a state the model can hold (`keyFromFifths` would
    // have to build a list the mode denies), so the row greys the moment the axis leaves 0 rather
    // than accepting a press it would have to reinterpret.
    modeChoice.setOptionDisabled('open', fifths !== 0)
  }

  const step = (delta: number): void => {
    fifths = Math.max(MIN_FIFTHS, Math.min(MAX_FIFTHS, fifths + delta))
    // Stepping off zero is asking for accidentals, which is asking for a tonal key: the mode falls
    // back to Major and the dot MOVES so the dialog never shows a selected option it has just
    // disabled. ⛔ The alternative — freezing the arrows while Atonal is chosen — makes the axis a
    // dead end you have to know the way out of.
    if (mode === 'open' && fifths !== 0) {
      mode = 'major'
      modeChoice.select('major')
    }
    refresh()
  }

  const modeChoice = new RadioGroup(
    [
      { value: 'major', label: 'Major' },
      { value: 'minor', label: 'Minor' },
      // Last, and shown even where it is unavailable (the widget greys it): it is the row that says
      // "a key signature is optional", and a row that disappears takes that with it.
      { value: 'open', label: 'Atonal' },
    ],
    {
      selected: mode,
      // ⭐ THE POINT OF THE STEPPER, in one line: for the two tonal modes, mode changes the NAME and
      // nothing else. The signature is identical for G major and E minor, which is exactly the
      // duplication an enumerated list is forced to spell out twice. ⚠️ Atonal is the exception and
      // the reason `mode` reaches the model at all: it changes the STATEMENT, not the name.
      onChange: (value) => { mode = value as KeyMode; refresh() },
    },
  )

  /**
   * Commit: ARM the stepped signature for the next click on the score, and close.
   *
   * ⭐ `keyFromFifths(fifths, mode)` — the CLASSICAL CONSTRUCTOR, the same call the dev palette's
   * buttons make. The stepper's whole argument is that this dialog has ONE degree of freedom plus a
   * mode toggle, and this is where that pays: one integer and one enum become the signature.
   *
   * ⭐ The atonal key is the one signature `keyFromFifths` cannot build, and correctly so: its
   * argument is a position on the circle, and an open key has none (`fifthsOf` answers `null` for
   * it). An empty list with `mode: 'open'` IS the whole statement — there is no constructor to add.
   */
  const accept = (): void => {
    bus.keySignature.press(currentKey())
    win?.close()
  }

  win = windows.open({
    title: 'Key Signature',
    width: 280,
    fitContent: true,
    // A dialog you summoned belongs where you are already looking, not on the cascade.
    center: true,
    resizable: false,
    // Escape is Cancel and Enter is OK, wired to the very functions the buttons call — one path per
    // act, no second implementation.
    onCancel: () => win?.close(),
    onAccept: accept,
    // TWO stacks, not one list of six — and the nesting IS the air (his ask, 2026-08-28: *"give more
    // air before the cancel ok buttons"*). A flat column has one gap, so widening the space before
    // the buttons would widen every space in the dialog; the body keeps its own tight rhythm and the
    // OUTER gap is the rule between "the question" and "your answer to it".
    content: new Column(
      [
        new Column(
          [
            // ⛔ NO CAPTION over the arrows. It said "Step ▲ for sharps, ▼ for flats." and went the
            // day the staff arrived (his call, 2026-08-28): the picture now SHOWS a sharp appearing
            // when you press ▲, which is the sentence, demonstrated. A line of prose explaining a
            // control that demonstrates itself is a line that gets read once and then read past.
            //
            // ⭐ The arrows sit BESIDE the staff, stacked (his call, same day) — the staff is only as
            // long as the widest signature needs, which left the room. ⚠️ What may not change is that
            // they stack VERTICALLY: ▲ over ▼ is what makes "up the circle of fifths" an upward
            // gesture, and a left/right pair would say something else. They bracket the PICTURE
            // because the picture is what they change; the words underneath name what it shows.
            new Row([staff, new Column([up, down], { gap: 6 })], { gap: 14, align: 'center' }),
            readout,
            modeChoice,
          ],
          { gap: 10, grow: 0 },
        ),
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', accept, { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      { gap: 22, grow: 0 },
    ),
  })
  refresh()
  return win
}
