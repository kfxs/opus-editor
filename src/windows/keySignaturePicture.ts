import type { Clef, KeySignature, PitchStep } from '@/types/music'
import { CHROME } from '@/utils/chromeColors'
import { clefGlyph, glyphBox } from '@/engine/fonts/fontMetrics'
import { staffLineForSpelling } from '@/utils/clefUtils'
import {
  CLEF_TO_KEY_INK,
  KEY_ACCIDENTAL_GAP,
  keySignatureLines,
  signGlyph,
} from '@/engine/layout/keySignatureLayout'
import { SIGN_CHARS } from '@/engine/rendering/staff/KeySignaturePass'

/**
 * ⭐⭐ **THE SIGNATURE, DRAWN — a five-line staff with a clef and the signs where the score would put
 * them**, for the Key Signature window to show while you step (his ask, 2026-08-28: *"insert the
 * staff with a treble clef so the user can see the key while is adding the accidentals"*).
 *
 * ⭐⭐ **IT INVENTS NO PLACEMENT AND NO SPACE.** Every number below comes from the engine that
 * engraves the real thing:
 *
 *  - **which row each sign sits on** — {@link keySignatureLines}, the 56-sign table agreed by Gerou &
 *    Lusk, Gould p. 91 and MuseScore's `ClefInfo::m_lines`;
 *  - **clef ink → first sign ink** — {@link CLEF_TO_KEY_INK} (0.82 sp: LilyPond, MuseScore, Ross);
 *  - **sign to sign** — {@link KEY_ACCIDENTAL_GAP} (0.25 sp, plus each glyph's own advance, which is
 *    what makes sharps sit wider than flats);
 *  - **the glyphs** — {@link SIGN_CHARS} and {@link clefGlyph}, the very tables the pass draws from.
 *
 * ⛔ So a placement question asked of this picture is answered by changing the ENGINE, and the
 * dialog follows. The alternative — a second table, "just for the thumbnail" — is the two-sets-of-
 * numbers problem `keySignatureInkRight`'s header is about, in a window where nobody would look.
 *
 * ⚠️ What IS this picture's own, because a thumbnail has no score around it: the staff-space size,
 * the air left of the clef, and the reserved height. They are marked below; ⛔ do not quote them as
 * engraving.
 *
 * ⚠️ Text, not a `<canvas>`: the same shape `clefWindow.staffPicture` uses (an SVG string handed to a
 * `Picture` widget), so nothing here measures anything at runtime and it works in jsdom.
 */

/**
 * One staff space, in px — THE size knob. Every dimension below is quoted against it, so the picture
 * grows or shrinks in one edit.
 *
 * ⚠️ THE PICTURE'S OWN, not engraving. **7 is the Clef window's**, and it is his reference
 * (2026-08-28: *"take as reference the clef window that is smaller"*) — the two dialogs draw the same
 * kind of thing and should draw it at the same size, so a reader moving between them is not told the
 * staff changed. ⛔ It was the score's own 10 for one iteration; that made the picture the biggest
 * object in a small dialog.
 */
const SPACE = 7
/** SMuFL's em square IS the staff height — 4 spaces — so this draws every glyph at true scale. */
const GLYPH_SIZE = SPACE * 4
/** Staff line thickness — `clefWindow`'s reasoning verbatim: at picker size the glyphs are the
 *  subject and the staff is only there to say which row each one sits on. */
const LINE_WIDTH = 0.5

/**
 * Air above and below the staff, in SPACES — reserved for the WORST case in the whole domain, never
 * for the key being shown, so the picture keeps one height and the dialog does not resize itself
 * under the pointer while you step (`Label`'s `lines: 3` exists for the same reason).
 *
 * Derived from the font's own boxes, and both are the tallest thing that can appear:
 *  - **above**: G♯, the highest sign treble puts anywhere (½ space above the top line) plus
 *    `accidentalSharp.up` 1.4 = **1.9**; the gClef reaches 4.392 above its origin on a line 3 spaces
 *    under the top one = 1.392, so the sign wins.
 *  - **below**: the gClef's tail, `down` 2.632 from an origin one space above the bottom line =
 *    **1.632**; treble's lowest sign (F♭, ½ space above the bottom line, flat `down` 0.7) reaches
 *    only 0.2.
 */
const PAD_TOP = SPACE * 2.0
const PAD_BOTTOM = SPACE * 1.8

/**
 * The staff's own width, in px. ⚠️ THE PICTURE'S — and it is **as short as the music allows**, so the
 * ▲▼ buttons sit BESIDE the staff rather than above and below it (his call, 2026-08-28: *"the lenght
 * of the 5 lines can be smalers and we have space to place the buttons next to the staff"*).
 *
 * The floor is the widest signature: 0.8 inset + the gClef's 2.684 of ink + 0.82 to the first sign +
 * seven sharps (six advances of 0.996 with a 0.25 gap each, then the last sign's ink) = **12.8
 * spaces**. 14 leaves the line running on a little past the last sharp instead of stopping under it.
 */
const WIDTH = SPACE * 14
/** Air between the staff's left end and the clef's origin. ⚠️ THE PICTURE'S, standing in for the
 *  system's opening barline, which a thumbnail has none of. */
const CLEF_INSET = SPACE * 0.8

const HEIGHT = PAD_TOP + SPACE * 4 + PAD_BOTTOM

/**
 * y of a staff row, in px, from the line number {@link keySignatureLines} speaks: **1 is the bottom
 * line, 5 the top**, and a half is the space between two lines.
 *
 * 🚨 The two counts run OPPOSITE WAYS — that convention rises, SVG's y falls — and the layout
 * module's own header records that getting this backwards agrees with itself everywhere (a mirrored
 * table puts treble's F♯ on the bottom line and every test written against it passes). The picture's
 * test names the PITCH each row is for that reason.
 */
function yOfLine(line: number): number {
  return PAD_TOP + (5 - line) * SPACE
}

/**
 * The signature on a staff, as an SVG string.
 *
 * `clef` decides both the clef glyph and where each sign sits — one argument, because those are the
 * same question (the table is keyed by clef). Today the window only asks for treble.
 */
export function keySignaturePicture(key: KeySignature, clef: Clef = 'treble'): string {
  // The half-pixel is not a fudge: a 1px stroke centred ON a whole coordinate straddles two pixel
  // rows and paints both at half strength — a soft 2px band. Centred on a half it lands inside one
  // row and comes out crisp. (`clefWindow` carries the same note.)
  const lines = Array.from({ length: 5 }, (_, i) =>
    `<line x1="0" x2="${WIDTH}" y1="${yOfLine(5 - i) + 0.5}" y2="${yOfLine(5 - i) + 0.5}"
           stroke="${CHROME.ink}" stroke-width="${LINE_WIDTH}" />`).join('')

  const glyph = (char: string, x: number, y: number): string =>
    `<text x="${x}" y="${y}" font-family="${MUSIC_FONT}" font-size="${GLYPH_SIZE}"
           fill="${CHROME.ink}">${char}</text>`

  // ⭐ The clef's origin sits ON the line it NAMES — a G clef curls around G4, an F clef's dots
  // straddle F3, a C clef's centre marks middle C — and SMuFL draws each glyph so its origin lands
  // exactly there. ⛔ Which line that is, is not written down here: `staffLineForSpelling` answers it
  // from the clef's own middle line, so this holds the PITCH each clef is named for (which is what a
  // clef IS) and no second table of line numbers to drift from `clefUtils`.
  const named = CLEF_NAMES[clef]
  const marks = [glyph(CLEF_CHARS[clef], CLEF_INSET, yOfLine(staffLineForSpelling(named.step, named.octave, clef)))]

  // ⭐ From the clef's INK, not from its advance or from a box: `CLEF_TO_KEY_INK` is measured ink to
  // ink, and `glyphBox(...).right` is where the ink stops. (The pass's `firstSignX` does exactly
  // this against the drawn modifier; here the clef's origin is ours, so it is one addition.)
  let x = CLEF_INSET + glyphBox(clefGlyph(clef)).right * SPACE + CLEF_TO_KEY_INK * SPACE
  const rows = keySignatureLines(key, clef)
  key.alterations.forEach((alteration, i) => {
    const name = signGlyph(alteration.alter)
    const char = name ? SIGN_CHARS[name] : undefined
    if (!name || !char) return
    marks.push(glyph(char, x, yOfLine(rows[i])))
    // Each sign steps by its OWN advance plus the one gap — which is what makes a run of sharps
    // wider than a run of flats without either number being hand-set (KEY_ACCIDENTAL_GAP's header).
    x += (glyphBox(name).advance + KEY_ACCIDENTAL_GAP) * SPACE
  })

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${lines}${marks.join('')}</svg>`
}

/** Bravura first: these are glyphs, not text, so the music font MUST lead the stack
 *  (`reference_vexflow_music_font_first_in_stack`). */
const MUSIC_FONT = "Bravura, Academico, 'Noto Music', serif"

/**
 * The clef codepoints. ⚠️ Written out for `SIGN_CHARS`' reason — VexFlow's `Glyphs` map is CJS-only
 * and is `undefined` in the browser build — and keyed by our own `Clef` so the glyph drawn and the
 * box measured (`clefGlyph`) cannot drift apart.
 */
const CLEF_CHARS: Record<Clef, string> = {
  treble: '\uE050', // gClef
  bass: '\uE062', // fClef
  alto: '\uE05C', // cClef
  tenor: '\uE05C', // cClef, a row lower
}

/**
 * The pitch each clef is NAMED for — a G clef says where G4 is, an F clef where F3 is, a C clef
 * where middle C is. ⭐ That, not a row number, is the fact a clef states; the row follows from it
 * through `staffLineForSpelling`, which is also what makes alto and tenor differ by one line here
 * without either being written down.
 */
const CLEF_NAMES: Record<Clef, { step: PitchStep; octave: number }> = {
  treble: { step: 'G', octave: 4 },
  bass: { step: 'F', octave: 3 },
  alto: { step: 'C', octave: 4 },
  tenor: { step: 'C', octave: 4 },
}
