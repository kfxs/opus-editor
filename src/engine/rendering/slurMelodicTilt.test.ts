import { describe, it, expect } from 'vitest'
import { tiltWithThePitches } from './slurMelodicTilt'
import type { SlurAttachment } from './slurStemEndpoint'

/**
 * {@link slurMelodicTilt} — a slur may not run downhill against a rising phrase (Gould p. 112).
 *
 * Numbers in, numbers out, so it belongs headless. y grows DOWN; a slur ABOVE is −1, and for it
 * "further out" is a SMALLER y. ⚠️ The melody is read off the two anchored NOTEHEADS while the tilt
 * is read off the ATTACHMENTS — the whole point is that those two can disagree, so every fixture
 * here states them independently.
 */
const ABOVE = -1
const BELOW = 1

const at = (headY: number): SlurAttachment =>
  ({ headYs: [headY], stemDirection: 1, stemTipY: headY - 35, headHalfWidth: 6 })

describe('tiltWithThePitches', () => {
  it('⭐ levels a slur that DESCENDS across a rising phrase — his case, 2026-08-17', () => {
    // E4 (head 100) → B4 (head 80): the music rises. The start attached at E4's stem tip (65) and
    // the end at B4's notehead (80), so the drawn slur falls 15px while the music climbs.
    const r = tiltWithThePitches(at(100), at(80), 65, 80, ABOVE)
    expect(r).toEqual({ fromY: 65, toY: 65 })
  })

  it('⭐ raises the LOWER end and never pulls the higher one down (Verovio\'s asymmetry)', () => {
    // Same fault mirrored left-to-right: now the START is the one lagging.
    const r = tiltWithThePitches(at(80), at(100), 80, 65, ABOVE)
    expect(r).toEqual({ fromY: 65, toY: 65 })
    // ⛔ The moved end went OUTWARD (80 → 65). Pulling the other end in to 80 would have levelled it
    // too, and would have walked the slur back toward the music it was climbing over.
  })

  it('leaves a slur that already agrees with its melody completely alone', () => {
    // Music rises 100 → 80; the slur rises too (70 → 60). Nothing to fix.
    expect(tiltWithThePitches(at(100), at(80), 70, 60, ABOVE)).toEqual({ fromY: 70, toY: 60 })
  })

  it('⛔ does not ADD tilt — a level slur under a rising phrase stays level', () => {
    // LilyPond states a BAND, `slur_dy ∈ [0, sign(dy)(|dy| + 0.2)]`, and 0 is inside it. Nothing in
    // the published rule demands that a rising phrase's slur rise; only that it not fall.
    expect(tiltWithThePitches(at(100), at(80), 70, 70, ABOVE)).toEqual({ fromY: 70, toY: 70 })
  })

  it('a LEVEL melody is left alone whichever way the slur leans', () => {
    // Two notes at the same pitch: `musical_dy` is 0, so there is no direction to contradict.
    // (LilyPond charges its separate `non-horizontal-penalty` here; we do not, deliberately.)
    expect(tiltWithThePitches(at(90), at(90), 60, 70, ABOVE)).toEqual({ fromY: 60, toY: 70 })
  })

  it('mirrors below the staff — "outward" is the LARGER y there', () => {
    // Music FALLS (head 80 → 100), slur below, and the drawn slur rises against it.
    const r = tiltWithThePitches(at(80), at(100), 120, 105, BELOW)
    expect(r).toEqual({ fromY: 120, toY: 120 })
  })

  it('⭐ reads the melody off the chord\'s OUTER head on the slur\'s side', () => {
    // A slur above springs from the TOP of each chord, so that is what its melody is measured on.
    // ⚠️ These two chords' BOTTOM notes fall (100 → 110) while their tops rise (70 → 60): read the
    // wrong head and the rule fires backwards.
    const from: SlurAttachment = { headYs: [100, 70], stemDirection: 1, stemTipY: 35, headHalfWidth: 6 }
    const to: SlurAttachment = { headYs: [110, 60], stemDirection: 1, stemTipY: 25, headHalfWidth: 6 }
    // Tops rise 70 → 60, so a slur drawn 40 → 50 (falling) contradicts and gets levelled.
    expect(tiltWithThePitches(from, to, 40, 50, ABOVE)).toEqual({ fromY: 40, toY: 40 })
  })
})
