/**
 * ⭐⭐ **WHAT A TIME SIGNATURE DRAWS, AS OURS — its glyph rows, where each row stands, and how wide it is.**
 * S4b0 of `docs/history/vexflow-removal-map.md`.
 *
 * `rendering/engraved/EngravedTimeSignature` used to draw the rows VexFlow's `TimeSignature` had composed in
 * `makeTimeSignatureGlyph`: the numeral string of each row, the offsets that centre the rows on each
 * other, the half-line shift for a tall glyph, and the lines the rows name. All of that is decided
 * here now, from the MODEL's `TimeSignature`, with today's values — ⛔ no pixel moves.
 *
 * ## ⭐ The one thing it does not know: how wide a row is
 *
 * A row's width is a MEASUREMENT of its glyphs set in the music font, and ⛔ `engrave/` measures
 * nothing at run time. So it arrives as a named argument, {@link meterLayout}'s `widthOf` — the P3b
 * flag-reach playbook. The renderer measures it through `rendering/painter/glyphPainter`, the same canvas
 * `measureText` VexFlow used, so the answer is the one it has always been (and 0 in jsdom, as before).
 *
 * ## ⚠️ Rows of TODAY, and one of them is a known UNKNOWN
 *
 * The two numeral rows stand on lines 1 and 3, so they are 2 staff spaces apart. That gap is ⛔ UNKNOWN
 * in every book (`docs/research/header-spacing-research.md` §2.8, row H: the engines split 2.0 against 0.0), and
 * ⛔ this module must not become the place somebody quietly picks one — it keeps the lines VexFlow
 * drew, as rows (rule 13).
 */
import type { TimeSignature } from '@/types/music'
import { GLYPH_BOXES, GLYPH_CODEPOINTS, type GlyphName } from '@/engine/fonts/bravuraMetrics'
import { MUSIC_FONT_SIZE_PT } from '../inheritedFonts'

/** The staff line the UPPER numerals stand on — `TimeSignature.topLine` = 1 (`timesignature.js:31`). */
export const METER_TOP_LINE = 1
/** The staff line the LOWER numerals stand on — `TimeSignature.bottomLine` = 3 (`timesignature.js:32`). */
export const METER_BOTTOM_LINE = 3
/** The line a symbol meter (`C`, `C|`) stands on — `setTimeSig`'s `this.line = 2` (`timesignature.js:93`). */
export const METER_SYMBOL_LINE = 2
/**
 * A row taller than this, in px, is shifted half a line outward — `lineShift`, `makeTimeSignatureGlyph`
 * (`timesignature.js:82`). ⚠️ An unsourced compensation of VexFlow's, kept as today's row: no Bravura
 * numeral comes near it (they are ~20 px at 30 pt), so it is 0 for every meter drawn today.
 */
export const METER_TALL_ROW_PX = 30
/** How far a too-tall row is shifted, in staff lines — the same `lineShift`. */
export const METER_TALL_ROW_SHIFT_LINES = 0.5

/**
 * Where a row stands: ON a staff line (counted from the top, like `../staff/staffFrame`), or midway
 * BETWEEN two. ⚠️ Kept as the pair rather than averaged into one number: the midpoint of the two lines'
 * placements and the placement of the averaged line differ the moment a staff's lines are not evenly
 * spaced (`own-engraving-engine.md` §0.3 rule 5).
 */
export type MeterRowLine = number | readonly [number, number]

/** One row of a time signature, laid out. */
export interface MeterGlyphRow {
  /** The glyphs to stamp — a string, so a two-digit numeral is one run. */
  readonly glyph: string
  /** How far right of the sign's own x the row's origin stands — what centres it over the other row. */
  readonly dx: number
  /** The line the row's baseline stands on (see {@link MeterRowLine}). */
  readonly line: MeterRowLine
}

/** A whole time signature, laid out. */
export interface MeterLayout {
  /** False for a symbol meter (`C`, `C|`), which is one glyph rather than numerals. */
  readonly numeric: boolean
  /** Upper row first — `e2e/staffSize` reads a meter's x as the first row's. */
  readonly rows: readonly MeterGlyphRow[]
  /** The sign's width — the wider row's, in px. */
  readonly width: number
}

/**
 * ⭐ Lay out `meter`'s rows. `widthOf` answers how wide a string of glyphs is drawn, in px, at the
 * music font's size.
 */
export function meterLayout(meter: TimeSignature, widthOf: (glyphs: string) => number): MeterLayout {
  if (meter.symbol === 'common' || meter.symbol === 'cut') {
    const glyph = glyphOf(meter.symbol === 'common' ? 'timeSigCommon' : 'timeSigCutCommon')
    return { numeric: false, rows: [{ glyph, dx: 0, line: METER_SYMBOL_LINE }], width: widthOf(glyph) }
  }

  const top = numeralsOf(meter.numerator)
  const bottom = numeralsOf(meter.denominator)
  const topWidth = widthOf(glyphsOf(top))
  const bottomWidth = widthOf(glyphsOf(bottom))
  const width = Math.max(topWidth, bottomWidth)
  const shift = Math.max(rowHeightPx(top), rowHeightPx(bottom)) > METER_TALL_ROW_PX ? METER_TALL_ROW_SHIFT_LINES : 0

  return {
    numeric: true,
    rows: [
      {
        glyph: glyphsOf(top),
        dx: (width - topWidth) / 2,
        // A lone upper row (no lower numerals) is centred between the two lines, as VexFlow drew it.
        line: bottom.length > 0 ? METER_TOP_LINE - shift : [METER_TOP_LINE, METER_BOTTOM_LINE],
      },
      { glyph: glyphsOf(bottom), dx: (width - bottomWidth) / 2, line: METER_BOTTOM_LINE + shift },
    ],
    width,
  }
}

/** A number's numerals, one SMuFL `timeSig` glyph per digit (`getTimeSigCode`'s default branch). */
function numeralsOf(n: number): GlyphName[] {
  return String(n).split('').map(digit => `timeSig${digit}` as GlyphName)
}

function glyphOf(name: GlyphName): string {
  return String.fromCodePoint(GLYPH_CODEPOINTS[name])
}

function glyphsOf(names: readonly GlyphName[]): string {
  return names.map(glyphOf).join('')
}

/**
 * How tall a row's ink is, in px, at the music font's size — the tallest glyph's reach above and below
 * its baseline. ⚠️ VexFlow measured the same thing off a canvas (`actualBoundingBoxAscent + Descent`);
 * this reads it from the font's own table, which answers without a page. A SMuFL em is 4 staff spaces
 * and a bare size is POINTS at 4/3 px each, so one staff space is `size / 3` px.
 */
function rowHeightPx(names: readonly GlyphName[]): number {
  const pxPerSpace = MUSIC_FONT_SIZE_PT / 3
  return names.reduce((tallest, name) => Math.max(tallest, (GLYPH_BOXES[name].up + GLYPH_BOXES[name].down) * pxPerSpace), 0)
}
