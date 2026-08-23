import { CHROME } from '../../utils/chromeColors'
import { MUSIC_FONT, escapeXml } from '../symbols/glyphSvg'
import { TRILL_SIGN_GLYPH, TRILL_WIGGLE_GLYPH } from '@/engine/rendering/trillStyle'
import { OTTAVA_NUMERAL_GLYPHS } from '@/engine/rendering/ottavaStyle'
import { PEDAL_DOWN_GLYPH, PEDAL_UP_GLYPH } from '@/engine/rendering/pedalStyle'

/**
 * The Lines picker's thumbnails — one SVG per row, drawn ONCE at import and held as strings.
 *
 * That is the whole of "prerendering" here: a picture is a string built by pure arithmetic, so it
 * costs nothing to hold, nothing to redraw, and can be asserted in a unit test. ⛔ Not files on disk:
 * an `.svg` per row would freeze the CHROME colours into an asset and make a colour change a rebuild
 * of seven pictures. (Same reason the clef picker draws its staves in code — `../clefWindow`.)
 *
 * ⭐⭐ **The glyphs are the ENGINE's, imported, never re-typed.** A picker that spells its own
 * codepoints is a second opinion about what the editor draws, and the day one of them changes the
 * dialog starts lying — which is exactly what the ottava's numeral did once already (`8va`/`8ba` was
 * a decision, taken in `ottavaStyle`). Here the row shows whatever that module says today.
 *
 * ⚠️ These are PICTURES, not a model. Nothing here is a `SelectedElement` kind, and the `value`s are
 * row ids — the window is not wired to anything yet (see ./index).
 */

/**
 * One staff space, in px — THE size knob, quoted by everything below. Matches the clef picker's, so
 * the two dialogs' rows are drawn at one scale.
 */
const SPACE = 7
/** SMuFL's em square IS four staff spaces, so this font-size draws a glyph at true staff scale. */
const GLYPH_SIZE = SPACE * 4

/**
 * ⭐ Narrow, and that is HIS CALL against the reference: Sibelius's *Staff lines* column is about
 * 150px of picture, not the 236 the clef picker uses. A line's row does not need the width — the
 * shape is the same at any length, and a wide row only spends screen on more of the same dashes.
 */
const ROW_WIDTH = 150
/**
 * Tight on purpose: seven rows plus a caption and a button row have to fit a viewport some 415px
 * tall, and a row taller than the ink it carries spends that budget on nothing. `Ped.` is the
 * tallest sign here at 2.22 spaces, so 4.6 leaves it air above and below.
 */
const ROW_HEIGHT = SPACE * 4.6

/** Where the ink starts and stops. Air either side, so no row touches the lit band's edge. */
const LEFT = 10
const RIGHT = ROW_WIDTH - 10

/**
 * The baseline every GLYPH row sits on. Low in the box, because these signs are drawn almost
 * entirely ABOVE their own baseline — `Ped.` reaches 2.22 spaces up, the ottava numerals 1.85, the
 * `tr` 1.56 (measured, `engine/fonts/bravuraMetrics`), and the tallest of them decides the headroom.
 */
const BASELINE = SPACE * 3.5
/** The line a HAIRPIN (or a slur's ends) is drawn about — the row's middle. */
const MIDDLE = ROW_HEIGHT / 2

/**
 * Advance widths, in staff spaces, MEASURED from `public/fonts/Bravura.otf` with the same reading
 * `scripts/generate-font-metrics.mjs` takes (`glyph.advanceWidth / (unitsPerEm / 4)`).
 *
 * ⚠️ Here rather than in `engine/fonts/bravuraMetrics` because that table is the ENGRAVER's — a row
 * in it is a promise the layout keeps, and these three numbers only place ink inside a thumbnail.
 * `wiggleTrill` is not in that table at all: the renderer measures the drawn glyph at render time
 * (`TrillRenderer.drawWiggle`), which a prerendered string cannot do.
 */
const ADVANCE = {
  trillSign: 2.084,
  wiggle: 0.948,
  ottavaNumeral: 3.54,
  pedalDown: 4.076,
  pedalUp: 1.8,
}

/** A stroke that reads as one crisp row of pixels — the clef picker's half-pixel rule. */
const HAIRLINE = 1
const crisp = (y: number): number => Math.round(y) + 0.5

function svg(body: string): string {
  return `<svg width="${ROW_WIDTH}" height="${ROW_HEIGHT}" viewBox="0 0 ${ROW_WIDTH} ${ROW_HEIGHT}">${body}</svg>`
}

function glyph(char: string, x: number, y = BASELINE): string {
  return `<text x="${x}" y="${y}" font-family="${MUSIC_FONT}" font-size="${GLYPH_SIZE}"
                fill="${CHROME.ink}">${escapeXml(char)}</text>`
}

function line(x1: number, y1: number, x2: number, y2: number, dashed = false): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${CHROME.ink}"
                stroke-width="${HAIRLINE}" ${dashed ? 'stroke-dasharray="5 4"' : ''} />`
}

/**
 * A SLUR, arching UP.
 *
 * ⛔ The down slur is deliberately absent — his call: it is the same object flipped, and `x` already
 * flips a placed one. A picker row per direction would be two ways to say one thing.
 *
 * The lens shape comes from two quadratics sharing their ends: the outer curve out, the inner curve
 * back, filled between. A quadratic's apex is a quarter of the way from the control point to the
 * chord, hence the doubled depth — the arc must be told to overshoot to arrive where we want it.
 */
function slurPicture(): string {
  const y = ROW_HEIGHT - SPACE * 0.8
  const depth = SPACE * 1.7
  /** Thickness at the apex. A slur is thin at its tips and thickest in the middle, like the real one. */
  const waist = SPACE * 0.44
  const mid = (LEFT + RIGHT) / 2
  const outer = y - depth * 2
  const inner = outer + waist * 2
  return svg(
    `<path d="M ${LEFT} ${y} Q ${mid} ${outer} ${RIGHT} ${y} Q ${mid} ${inner} ${LEFT} ${y} Z"
           fill="${CHROME.ink}" />`,
  )
}

/**
 * A HAIRPIN. `open` is which END is open — the whole difference between the two rows, and the reason
 * this is one function: a diminuendo is a crescendo read backwards, not a second drawing.
 */
function hairpinPicture(open: 'right' | 'left'): string {
  /** The mouth, in spaces — VexFlow's own default aperture, and near enough Gould's 1.5. */
  const aperture = SPACE * 1.5
  const tipX = open === 'right' ? LEFT : RIGHT
  const mouthX = open === 'right' ? RIGHT : LEFT
  const y = crisp(MIDDLE)
  return svg(
    line(tipX, y, mouthX, y - aperture / 2) + line(tipX, y, mouthX, y + aperture / 2),
  )
}

/**
 * A TRILL — the `tr` and its wave.
 *
 * The wave is TILED, never stretched: repeating the glyph is what keeps one trill's wave the same
 * coarseness as another's, and it is what the renderer does. The count is whatever fits, so the wave
 * ends a little short of the right edge rather than being squeezed to reach it.
 */
function trillPicture(): string {
  const signWidth = ADVANCE.trillSign * SPACE
  // The gap has to swallow the wave's own overhang as well: `wiggleTrill` starts 0.144 spaces LEFT
  // of its origin, so a nominal gap that size is no gap at all and the first crest sits on the
  // sign's tail.
  const start = LEFT + signWidth + SPACE * 0.6
  const unit = ADVANCE.wiggle * SPACE
  const count = Math.max(1, Math.floor((RIGHT - start) / unit))
  return svg(glyph(TRILL_SIGN_GLYPH, LEFT) + glyph(TRILL_WIGGLE_GLYPH.repeat(count), start))
}

/**
 * An OTTAVA — the numeral and its dashed bracket.
 *
 * The hook turns TOWARDS the staff the passage belongs to: down from an `8va` (which rides above the
 * music) and up from the lower one (which runs below it). That is the one thing the two rows say
 * differently, and it is why the picture is worth having at all.
 *
 * ⚠️ The lower numeral is whatever `OTTAVA_NUMERAL_GLYPHS` holds — today `8ba`, a recorded decision
 * of his, not `8vb`. The picker follows the score; changing the sign is one edit, over there.
 */
function ottavaPicture(direction: 1 | -1): string {
  const numeral = OTTAVA_NUMERAL_GLYPHS[direction]
  const start = LEFT + ADVANCE.ottavaNumeral * SPACE + SPACE * 0.3
  // Level with the numeral's waist, so the bracket reads as leaving the sign rather than as a
  // separate rule floating over it.
  const y = crisp(BASELINE - SPACE * 1.15)
  const hook = SPACE * 0.9 * (direction === 1 ? 1 : -1)
  return svg(
    glyph(numeral, LEFT) +
      line(start, y, RIGHT, y, true) +
      line(crisp(RIGHT), y, crisp(RIGHT), y + hook),
  )
}

/**
 * The SUSTAIN PEDAL — `Ped.` where the foot goes down, `✻` where it comes up.
 *
 * ⚠️ **Two glyphs with nothing between them, because that is what the editor draws today**
 * (`engine/rendering/pedalStyle`: the bracket, the hook and the retake notch are a later dress for
 * the same statement). A picture with a bracket in it would be a promise this editor does not keep.
 */
function pedalPicture(): string {
  return svg(glyph(PEDAL_DOWN_GLYPH, LEFT) + glyph(PEDAL_UP_GLYPH, RIGHT - ADVANCE.pedalUp * SPACE))
}

/** A row id. ⚠️ Not a model kind — see the header: nothing here is wired to the score yet. */
export type LineKind = 'slur' | 'crescendo' | 'diminuendo' | 'trill' | 'ottavaUp' | 'ottavaDown' | 'pedal'

/**
 * The rows, in the order Sibelius's *Staff lines* column takes them: the curve, the two hairpins,
 * then the signs that carry a line behind them.
 */
export const LINE_CHOICES: readonly { value: LineKind; picture: string }[] = [
  { value: 'slur', picture: slurPicture() },
  { value: 'crescendo', picture: hairpinPicture('right') },
  { value: 'diminuendo', picture: hairpinPicture('left') },
  { value: 'trill', picture: trillPicture() },
  { value: 'ottavaUp', picture: ottavaPicture(1) },
  { value: 'ottavaDown', picture: ottavaPicture(-1) },
  { value: 'pedal', picture: pedalPicture() },
]
