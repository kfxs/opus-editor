import type { WindowLayer } from './WindowLayer'
import type { Window } from './Window'
import { Column, Row } from './content/layout'
import { Button, ChoiceList, Label } from './content/widgets'
import { CHROME } from '../utils/chromeColors'

/**
 * The Clef window, opened from Insert ▸ Clef (or Q) — modelled on Sibelius's Clef dialog: a labelled
 * box of staves you scroll, one of them lit, and Cancel / OK underneath.
 *
 * Still a LOOK and nothing more: picking a clef selects a row and does not touch the score, and OK
 * closes like Cancel. The second column of Sibelius's dialog (transposed clef, "draw on subsequent
 * staves") is deliberately absent — it is a decision about the transposing-instrument model, not
 * about this window.
 */

/**
 * SMuFL codepoints, as escapes — they live in the Private Use Area, where the literal characters are
 * invisible in an editor and survive nothing that touches the file (same rule as the Keypad's).
 */
const CLEF_GLYPH = {
  g: '\uE050', // gClef
  f: '\uE062', // fClef
  c: '\uE05C', // cClef
  percussion: '\uE069', // unpitchedPercussionClef1
}

/** Bravura first: these are glyphs, not text, so the music font MUST lead the stack. */
const MUSIC_FONT = "Bravura, Academico, 'Noto Music', serif"

/**
 * One staff space, in px — THE size knob for the whole list. Every other dimension below is quoted
 * against it, so a row shrinks or grows in one edit and nothing can clip: a G clef reaches some three
 * spaces above the top line, and padding that is a fixed pixel count stops covering it the moment
 * the staff gets smaller.
 *
 * Smaller than the score's own spacing (VexFlow's default 10), on purpose — these are thumbnails.
 */
const SPACE = 7
/** SMuFL's em square IS the staff height — 4 spaces — so this size draws a clef at true scale. */
const GLYPH_SIZE = SPACE * 4
/**
 * Staff line thickness. VexFlow strokes the score's stave lines at 1px; this picture goes finer
 * DELIBERATELY — half a pixel, centred inside one pixel row (see the offset below), so the line is a
 * single faint row rather than a solid one. At picker size the clef is the subject and the staff is
 * only there to say which line the glyph sits on.
 */
const LINE_WIDTH = 0.5
/** Air above and below the staff, in SPACES — a G clef reaches well past the lines it sits between. */
const PAD_Y = SPACE * 1.8
const ROW_WIDTH = 236
const ROW_HEIGHT = SPACE * 4 + PAD_Y * 2

/**
 * A clef's picture: five staff lines with the glyph on the line it names.
 *
 * `line` is the staff line the glyph's BASELINE sits on, counted 1 = top … 5 = bottom. That is the
 * whole of clef positioning — a G clef curls around the G line (4th from the top), an F clef's dots
 * straddle the F line, a C clef's centre marks middle C — and SMuFL draws each glyph so its origin
 * lands exactly there.
 */
function staffPicture(glyph: string, line: number): string {
  // The half-pixel is not a fudge: a 1px stroke is centred ON its coordinate, so at a whole number it
  // straddles two pixel rows and both get painted at half strength — a soft 2px band, which is why a
  // thin line can look FATTER than a thick one. Centred on a half, it lands inside one row and comes
  // out as the crisp single line the score draws.
  const lineY = (i: number): number => PAD_Y + i * SPACE + 0.5
  const lines = Array.from(
    { length: 5 },
    (_, i) =>
      `<line x1="10" x2="${ROW_WIDTH - 10}" y1="${lineY(i)}" y2="${lineY(i)}"
             stroke="${CHROME.ink}" stroke-width="${LINE_WIDTH}" />`,
  ).join('')
  const baseline = lineY(line - 1)
  return `<svg width="${ROW_WIDTH}" height="${ROW_HEIGHT}" viewBox="0 0 ${ROW_WIDTH} ${ROW_HEIGHT}">
    ${lines}
    <text x="${ROW_WIDTH / 2}" y="${baseline}" text-anchor="middle"
          font-family="${MUSIC_FONT}" font-size="${GLYPH_SIZE}" fill="${CHROME.ink}">${glyph}</text>
  </svg>`
}

/** The rows, in Sibelius's order. `value` is the clef's name, ready for the day OK does something. */
const CLEF_CHOICES = [
  { value: 'treble', picture: staffPicture(CLEF_GLYPH.g, 4) },
  { value: 'bass', picture: staffPicture(CLEF_GLYPH.f, 2) },
  { value: 'alto', picture: staffPicture(CLEF_GLYPH.c, 3) },
  { value: 'tenor', picture: staffPicture(CLEF_GLYPH.c, 2) },
  { value: 'percussion', picture: staffPicture(CLEF_GLYPH.percussion, 3) },
]

export function openClefWindow(windows: WindowLayer): Window {
  const list = new ChoiceList(CLEF_CHOICES, { selected: 'treble' })

  // Captured in a `let` because the buttons are built before `open()` returns but only run after.
  let win: Window | null = null
  win = windows.open({
    title: 'Clef',
    width: 300,
    // Taller than the list needs, on purpose: the box SCROLLS, and a picker that shows every row at
    // once teaches nothing about that. Sibelius's shows about four staves of the five.
    height: 400,
    // A dialog you summoned belongs where you are already looking, not on the cascade.
    center: true,
    resizable: false,
    content: new Column(
      [
        new Label('Sounding pitch clef:'),
        list,
        // Cancel then OK, left to right, with OK the primary — the platform order, and the one the
        // Sibelius dialog uses.
        new Row([new Button('Cancel', () => win?.close()), new Button('OK', () => win?.close(), { variant: 'primary' })], {
          gap: 8,
          align: 'end',
        }),
      ],
      // The LIST takes the slack: the label and the button row are as tall as they are, and every
      // extra pixel of window height is another staff you can see.
      { gap: 10, grow: 1 },
    ),
  })
  return win
}
