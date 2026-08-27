import { windows } from '@/windows'
import type { Window } from '@/windows/Window'
import { Column, Row } from '@/windows/content/layout'
import { Button, Label, RadioGroup } from '@/windows/content/widgets'
import { dbg } from '@/utils/debug'

/**
 * 🚧 **A SKETCH OF A KEY PICKER — it edits NOTHING, and it is not the design.**
 *
 * His idea, 2026-08-27: *"I don't like the list in Sibelius' key menu because it is redundant. But I
 * remember that in Finale we used to have an arrow that we can increase in the sharp or go down in
 * the flat, and we can select key like this... I think it is a better method."* This is that gesture,
 * standing up, so it can be looked at instead of imagined — built while five research agents are out
 * and explicitly **to be thrown away**.
 *
 * ⛔ **DO NOT GROW IT, and do not promote it.** The real key-signature UI is an open design question
 * (`docs/key-signature-plan.md` §7): an agent is surveying Finale's stepper, Sibelius's enumerated
 * list, Dorico's `Shift+K` popover and MuseScore's palette, and that research has not landed. Nothing
 * here is a decision — it is a probe. It lives in `dev/` for the reason the whole shell does: so
 * removing it is a deletion and not an excavation.
 *
 * ## ⭐ What the sketch is actually ARGUING
 *
 * A key signature has **one degree of freedom** — a position on the circle of fifths — plus a name
 * for it. Sibelius spends a scrolling gallery on that: fifteen signatures × major and minor is
 * thirty rows, in which **each signature appears twice** and every row must be read to be told apart
 * from its neighbour. The stepper says the same thing as an AXIS: one control, ▲ sharpwards,
 * ▼ flatwards, and the mode is the separate question it actually is. Which is his point, and the
 * dialog exists to let him see whether it survives contact.
 *
 * ⚠️ It shows the signature as LETTERS (`F♯ C♯`), not as glyphs on a staff, and that is deliberate:
 * where each accidental sits per clef is a TABLE the research is fetching right now (Gould, Ross,
 * and the three engines), and drawing one from memory today would be inventing a rule with a source
 * that does not exist yet. The letters are the part we can state.
 *
 * ⛔ It also imports the `windows` singleton directly, where a real window definition takes a
 * `WindowLayer` parameter (`openClefWindow(windows)`). That convention exists so a menu or a
 * shortcut can host a window; a dev-shell button has no host to be handed one by, and threading a
 * new dependency through `App.ts` for something with a deletion date is the excavation the dev shell
 * exists to avoid.
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

/** `G major` / `E minor` — the key's traditional NAME, which only a circle-of-fifths key has. */
function keyName(fifths: number, mode: 'major' | 'minor'): string {
  const names = mode === 'major' ? MAJOR_NAMES : MINOR_NAMES
  return `${names[fifths - MIN_FIFTHS]} ${mode}`
}

/** `F♯ C♯` — the altered letters, in signature order. The list that will BE the model. */
function alterationLetters(fifths: number): string {
  if (fifths === 0) return ''
  const order = fifths > 0 ? SHARP_ORDER : FLAT_ORDER
  const sign = fifths > 0 ? '♯' : '♭'
  return order.slice(0, Math.abs(fifths)).map(step => step + sign).join(' ')
}

/** `2 sharps` / `1 flat` / `no sharps or flats` — the count, said in words. */
function countPhrase(fifths: number): string {
  if (fifths === 0) return 'no sharps or flats'
  const n = Math.abs(fifths)
  return `${n} ${fifths > 0 ? 'sharp' : 'flat'}${n === 1 ? '' : 's'}`
}

export function openKeySignatureSketch(): Window {
  // A `let`, because the buttons are built before `open()` returns and only run afterwards — the
  // same shape `openClefWindow` uses.
  let win: Window | null = null

  let fifths = 0
  let mode: 'major' | 'minor' = 'major'

  /**
   * ⭐ The readout is ONE Label in three runs, not three stacked Labels — the name, the count and
   * the letters are one statement that must change together, and `lines: 3` reserves the height so
   * a fit-to-content dialog does not resize itself under the pointer as you step. (Both rules are
   * the widget's own, see `Label`.)
   */
  const readout = new Label('', { lines: 3 })

  // ▲ is sharpwards and ▼ is flatwards, which is the direction his memory of Finale describes: up
  // the circle of fifths adds a sharp, down it adds a flat. They disable at the ends rather than
  // wrapping — C♯ major stepping round to C♭ major would be a 14-semitone jump dressed as one click.
  const up = new Button('▲', () => step(+1), {})
  const down = new Button('▼', () => step(-1), {})

  const refresh = (): void => {
    const letters = alterationLetters(fifths)
    readout.setParts([
      { text: keyName(fifths, mode), tone: 'value', size: 20 },
      { text: countPhrase(fifths), tone: 'muted', newLine: true },
      // ⭐ The empty-signature row still says something. C major is the case a picker usually gets
      // wrong: it prints nothing where it is in force, and cancelling naturals where you change TO
      // it — so the dialog states the first half rather than showing a blank line.
      { text: letters || '(the staff shows nothing)', newLine: true },
    ])
    up.setDisabled(fifths >= MAX_FIFTHS)
    down.setDisabled(fifths <= MIN_FIFTHS)
  }

  const step = (delta: number): void => {
    fifths = Math.max(MIN_FIFTHS, Math.min(MAX_FIFTHS, fifths + delta))
    refresh()
    dbg(`🚧 key sketch | step ${delta > 0 ? '▲ sharpwards' : '▼ flatwards'} `
      + `| ${keyName(fifths, mode)} | fifths:${fifths} | ${alterationLetters(fifths) || '—'}`)
  }

  const modeChoice = new RadioGroup(
    [{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }],
    {
      selected: mode,
      // ⭐ THE POINT OF THE SKETCH, in one line: mode changes the NAME and nothing else. The
      // signature is identical for G major and E minor, which is exactly the duplication an
      // enumerated list is forced to spell out twice.
      onChange: (value) => { mode = value as 'major' | 'minor'; refresh() },
    },
  )

  /** 🚧 Commit: logs what it WOULD arm, and closes. There is no model to write to yet (P1–P5). */
  const accept = (): void => {
    dbg(`🚧 key sketch | OK | ${keyName(fifths, mode)} | fifths:${fifths} `
      + `| ${alterationLetters(fifths) || 'empty'} — SKETCH: arms nothing, see docs/key-signature-plan.md`)
    win?.close()
  }

  win = windows.open({
    title: 'Key Signature 🚧 sketch',
    width: 280,
    fitContent: true,
    center: true,
    resizable: false,
    onCancel: () => win?.close(),
    onAccept: accept,
    content: new Column(
      [
        new Label('Step ▲ for sharps, ▼ for flats.', { muted: true }),
        // The two arrows stack VERTICALLY around the readout, so up and down mean up and down —
        // a horizontal pair would make "up the circle of fifths" a left/right gesture.
        new Row([up], { align: 'center' }),
        readout,
        new Row([down], { align: 'center' }),
        modeChoice,
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', accept, { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      { gap: 10, grow: 0 },
    ),
  })
  refresh()
  return win
}
