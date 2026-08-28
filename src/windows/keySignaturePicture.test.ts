import { describe, it, expect } from 'vitest'
import { keySignaturePicture } from './keySignaturePicture'
import { keyFromFifths } from '@/utils/keySignature'

/**
 * The Key Signature window's staff.
 *
 * ⚠️ **This is arithmetic, not a drawn position** — the picture is a STRING built from the font's
 * measured advances and the engine's placement table, so it is fully determined in jsdom. ⛔ The rule
 * it must not break is the other one: nothing here may measure a glyph (jsdom reports 0×0 for every
 * one, and an assertion against that agrees with itself).
 *
 * ⭐ **Every position is asserted by NAMING THE PITCH its row is** — never against the module's own
 * arithmetic. `keySignatureLayout`'s header records why: its first draft had the staff-line
 * conversion mirrored through the middle line, which put treble's F♯ on the BOTTOM line and passed
 * every test written against its own numbers.
 */

/**
 * The staff rows, top line first, read off the drawing itself — so the tests below can say "the top
 * line" and "the middle line" without knowing the module's pixel constants.
 *
 * ⚠️ Less the HALF PIXEL the strokes are nudged by: a 1px line centred on a whole coordinate paints
 * two rows at half strength, so the picture draws each line at `y + 0.5` while the ROW itself — where
 * a glyph sits — is the whole number. ⛔ Without this the rows read half a pixel low and every
 * placement below would be asserted against a crispness trick.
 */
function staffLines(svg: string): number[] {
  return [...svg.matchAll(/<line [^>]*y1="([\d.]+)"/g)].map(m => Number(m[1]) - 0.5)
}

/** Every glyph drawn, as `{ char, x, y }`, in the order the picture places them. */
function glyphs(svg: string): { char: string; x: number; y: number }[] {
  return [...svg.matchAll(/<text x="([\d.]+)" y="([-\d.]+)"[^>]*>(.+?)<\/text>/g)]
    .map(m => ({ x: Number(m[1]), y: Number(m[2]), char: m[3] }))
}

const G_CLEF = '\uE050'
const SHARP = '\uE262'
const FLAT = '\uE260'

describe('keySignaturePicture', () => {
  it('draws five staff lines and a treble clef, and nothing else for C major', () => {
    const svg = keySignaturePicture(keyFromFifths(0))
    expect(staffLines(svg)).toHaveLength(5)
    expect(glyphs(svg).map(g => g.char)).toEqual([G_CLEF])
  })

  // The whole point of the picture: the signs appear as you step, in the order they are added.
  it('draws one sign per alteration, in the signature order', () => {
    const sharps = glyphs(keySignaturePicture(keyFromFifths(3))).slice(1)
    expect(sharps.map(g => g.char)).toEqual([SHARP, SHARP, SHARP])
    const flats = glyphs(keySignaturePicture(keyFromFifths(-2))).slice(1)
    expect(flats.map(g => g.char)).toEqual([FLAT, FLAT])
  })

  // ⭐ The rows, by the pitch each one is in treble: F♯ is on the TOP LINE, C♯ in the third space
  // (a space and a half below it), G♯ half a space ABOVE the staff — the placement every source in
  // `keySignatureLayout`'s table agrees on.
  it('puts the sharps on the rows a treble signature uses', () => {
    const svg = keySignaturePicture(keyFromFifths(4))
    const [topLine, , , , bottomLine] = staffLines(svg)
    const space = (bottomLine - topLine) / 4
    const [, fSharp, cSharp, gSharp, dSharp] = glyphs(svg)

    expect(fSharp.y).toBeCloseTo(topLine) // F5, the top line
    expect(cSharp.y).toBeCloseTo(topLine + 1.5 * space) // C5, the third space
    expect(gSharp.y).toBeCloseTo(topLine - 0.5 * space) // G5, just above the staff
    expect(dSharp.y).toBeCloseTo(topLine + space) // D5, the fourth line
  })

  // B♭ is the MIDDLE line, E♭ the fourth space — the flats run the other way down the staff.
  it('puts the flats on the rows a treble signature uses', () => {
    const svg = keySignaturePicture(keyFromFifths(-2))
    const [topLine, , , , bottomLine] = staffLines(svg)
    const space = (bottomLine - topLine) / 4
    const [, bFlat, eFlat] = glyphs(svg)

    expect(bFlat.y).toBeCloseTo(topLine + 2 * space) // B4, the middle line
    expect(eFlat.y).toBeCloseTo(topLine + 0.5 * space) // E5, the fourth space
  })

  /**
   * ⭐ The gap between two signs is the ENGINE's — each glyph's own advance plus `KEY_ACCIDENTAL_GAP`
   * — which is why a run of sharps is wider than a run of flats without either number being hand-set.
   * Asserted as the RATIO of the two pitches, so the test pins the rule and not the constants.
   */
  it('spaces sharps wider than flats, by the glyphs own advances', () => {
    const sharps = glyphs(keySignaturePicture(keyFromFifths(3))).slice(1)
    const flats = glyphs(keySignaturePicture(keyFromFifths(-3))).slice(1)
    const sharpPitch = sharps[1].x - sharps[0].x
    const flatPitch = flats[1].x - flats[0].x

    expect(sharpPitch).toBeGreaterThan(flatPitch)
    // Bravura: sharp advance 0.996, flat 0.904, one shared 0.25 gap → 1.246 / 1.154.
    expect(sharpPitch / flatPitch).toBeCloseTo(1.246 / 1.154, 3)
  })

  // An ATONAL key is an empty list, so it draws the bare staff — the same picture C major gets, which
  // is exactly what the staff has to say about it. (The dialog says the rest in words.)
  it('draws a bare staff for the atonal key', () => {
    const svg = keySignaturePicture({ alterations: [], mode: 'open' })
    expect(glyphs(svg).map(g => g.char)).toEqual([G_CLEF])
  })

  // The picture keeps ONE size whatever it holds: a dialog that resizes under the pointer as you
  // step is the thing `PAD_TOP`/`PAD_BOTTOM` are reserved for.
  it('is the same size empty as it is with seven sharps', () => {
    const size = (svg: string) => svg.match(/<svg width="(\d+)" height="([\d.]+)"/)?.slice(1)
    expect(size(keySignaturePicture(keyFromFifths(7)))).toEqual(size(keySignaturePicture(keyFromFifths(0))))
  })
})
