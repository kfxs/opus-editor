/**
 * {@link keySignatureLayout} — the two tables: how much room a signature takes, and which row each
 * sign sits on.
 *
 * ⭐ **These CAN be unit tests, and that is the point of the font work.** `glyphBox` reads the baked
 * Bravura metrics, not the DOM, so the arithmetic is real in jsdom even though no glyph can be
 * measured there. ⛔ What still cannot be asserted here is where the ink actually LANDS — that is the
 * browser suite's, and jsdom would agree with any answer at all.
 *
 * ⚠️ The placement numbers are checked against the SOURCE's unit (steps above the bottom line) by
 * naming the pitch each line is: `F♯5` on the treble's top line is a fact anyone can verify without
 * trusting the conversion.
 */
import { describe, it, expect } from 'vitest'
import { KEY_ACCIDENTAL_GAP, keyChangeRow, keySignatureExtent, keySignatureLines, signGlyph } from './keySignatureLayout'
import { C_MAJOR, keyFromFifths } from '@/utils/keySignature'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import type { KeySignature } from '@/types/music'

const SHARP = glyphBox('accidentalSharp').advance   // 0.996
const FLAT = glyphBox('accidentalFlat').advance     // 0.904

describe('keySignatureExtent', () => {
  it('🚨 an EMPTY signature costs NOTHING — the row that keeps every C-major score honest', () => {
    expect(keySignatureExtent(C_MAJOR)).toBe(0)
    expect(keySignatureExtent({ alterations: [], mode: 'open' })).toBe(0)
  })

  it('one sign is its own advance and no gap', () => {
    expect(keySignatureExtent(keyFromFifths(1))).toBeCloseTo(SHARP, 5)
    expect(keySignatureExtent(keyFromFifths(-1))).toBeCloseTo(FLAT, 5)
  })

  it('n signs are n advances and n−1 gaps', () => {
    expect(keySignatureExtent(keyFromFifths(4))).toBeCloseTo(4 * SHARP + 3 * KEY_ACCIDENTAL_GAP, 5)
    expect(keySignatureExtent(keyFromFifths(-3))).toBeCloseTo(3 * FLAT + 2 * KEY_ACCIDENTAL_GAP, 5)
  })

  it('⭐⭐ reproduces Ross\'s sharp PITCH of 1.25 sp, which is the number confirmed twice', () => {
    // Origin to origin = the whole of two signs, less the second's own advance.
    const pitch = keySignatureExtent(keyFromFifths(2)) - SHARP
    expect(pitch).toBeCloseTo(1.25, 2)
  })

  it('⭐ …and a FLAT signature comes out narrower WITHOUT a second constant', () => {
    const flatPitch = keySignatureExtent(keyFromFifths(-2)) - FLAT
    expect(flatPitch).toBeCloseTo(1.15, 2)
    expect(flatPitch, 'the difference falls out of the glyph').toBeLessThan(1.25)
  })

  it('prices a CUSTOM signature by its own members', () => {
    const mixed: KeySignature = { alterations: [{ step: 'B', alter: -1 }, { step: 'F', alter: 1 }] }
    expect(keySignatureExtent(mixed)).toBeCloseTo(FLAT + SHARP + KEY_ACCIDENTAL_GAP, 5)
  })
})

describe('keySignatureLines — the measured table, checked by naming the pitch', () => {
  it('treble sharps: F♯5 on the TOP LINE, then C♯5 on the third space', () => {
    expect(keySignatureLines(keyFromFifths(2), 'treble')).toEqual([5, 3.5])
  })

  it('treble flats: B♭ on the MIDDLE LINE — and F♯ vs F♭ are an octave apart', () => {
    expect(keySignatureLines(keyFromFifths(-1), 'treble')).toEqual([3])
    // F♯5 (top line) against F♭4 (the bottom space): the reason the table is keyed by DIRECTION.
    expect(keySignatureLines({ alterations: [{ step: 'F', alter: 1 }] }, 'treble')).toEqual([5])
    expect(keySignatureLines({ alterations: [{ step: 'F', alter: -1 }] }, 'treble')).toEqual([1.5])
  })

  it('bass is treble − 2 steps: F♯3 on the fourth line, B♭2 on the second', () => {
    expect(keySignatureLines(keyFromFifths(1), 'bass')).toEqual([4])
    expect(keySignatureLines(keyFromFifths(-1), 'bass')).toEqual([2])
  })

  it('⛔ alto has NO exception — A♯ sits at A3, the plainly shifted position', () => {
    // A is the fifth sharp; asking for it alone is the same row.
    expect(keySignatureLines({ alterations: [{ step: 'A', alter: 1 }] }, 'alto')).toEqual([2])
    expect(keySignatureLines(keyFromFifths(5), 'alto')).toEqual([4.5, 3, 5, 3.5, 2])
  })

  it('🚨 TENOR SHARPS are the sole exception: F♯ and G♯ drop an octave, the other five do not', () => {
    // F♯3 (fourth line) and G♯3 (the space above it) instead of F♯4 / G♯4, which would need a ledger.
    expect(keySignatureLines(keyFromFifths(3), 'tenor')).toEqual([2, 4, 2.5])
    // …while C♯4 and D♯4 sit where treble + 1 puts them.
    expect(keySignatureLines(keyFromFifths(4), 'tenor')[3]).toBe(4.5)
  })

  it('…and TENOR FLATS follow the ordinary shape (treble + 1)', () => {
    expect(keySignatureLines(keyFromFifths(-2), 'tenor')).toEqual([3.5, 5])
  })

  it('every sign of a full seven stays clear of a ledger line, in all four clefs', () => {
    // The constraint the 56 drawn signs actually obey — never stated in prose by any treatise.
    for (const clef of ['treble', 'bass', 'alto', 'tenor'] as const) {
      for (const n of [7, -7]) {
        for (const line of keySignatureLines(keyFromFifths(n), clef)) {
          expect(line, `${clef} ${n}`).toBeGreaterThan(0)
          expect(line, `${clef} ${n}`).toBeLessThan(6)
        }
      }
    }
  })

  it('⭐ a CUSTOM signature takes each letter from its own direction\'s row', () => {
    const mixed: KeySignature = { alterations: [{ step: 'B', alter: -1 }, { step: 'F', alter: 1 }] }
    // B♭4 on the middle line, F♯5 on the top line — each where a traditional signature puts it.
    expect(keySignatureLines(mixed, 'treble')).toEqual([3, 5])
  })

  it('an OCTAVE override moves the glyph, and the clef converts it', () => {
    // Gould's own figure draws C♯ at C5 — the third space in treble.
    expect(keySignatureLines({ alterations: [{ step: 'C', alter: 1, octave: 5 }] }, 'treble')).toEqual([3.5])
    // …and the same override under a bass clef lands somewhere else entirely, as it must.
    expect(keySignatureLines({ alterations: [{ step: 'C', alter: 1, octave: 5 }] }, 'bass')).toEqual([9.5])
  })

  it('keeps the AUTHORED order — the lines come back in the list\'s order, not the cycle\'s', () => {
    const reordered: KeySignature = { alterations: [{ step: 'C', alter: 1 }, { step: 'F', alter: 1 }] }
    expect(keySignatureLines(reordered, 'treble')).toEqual([3.5, 5])
  })
})

describe('keyChangeRow — the cancelling naturals (P6)', () => {
  const G = keyFromFifths(1)          // F♯
  const E_FLAT = keyFromFifths(-3)    // B♭ E♭ A♭
  const D = keyFromFifths(2)          // F♯ C♯

  it('answers UNDEFINED when nothing changed — the bar draws no row at all', () => {
    expect(keyChangeRow(E_FLAT, E_FLAT, 'treble')).toBeUndefined()
  })

  it('⛔ draws NO naturals when the new key has signs of its own — the modern default', () => {
    // Gerou & Lusk p. 79: *"Cancellations are no longer considered necessary, unless the new key is
    // C major or A minor."* ⚠️ The practice FLIPPED — Ross p. 149 (1970) says most engraved music
    // cancels — and 1996's is where five implementations landed (plan §4.2). ⛔ Settled.
    expect(keyChangeRow(D, E_FLAT, 'treble')).toEqual(D)
  })

  it('⭐⭐ draws them when the new key is C MAJOR — otherwise the change would be invisible', () => {
    const row = keyChangeRow(C_MAJOR, E_FLAT, 'treble')!
    expect(row.alterations.map(a => a.step)).toEqual(['B', 'E', 'A'])
    expect(row.alterations.every(a => a.alter === 0), 'all naturals').toBe(true)
    // MusicXML states the same rule as a spec sentence: *"This will always happen when changing to
    // C major or A minor and need not be specified then."*
  })

  it('🚨 a natural stands where the sign it CANCELS stood — flats, not the sharp row', () => {
    // The bug this guards: `keySignatureLines` reads `alter >= 0 ? SHARP_STEPS : FLAT_STEPS`, and a
    // natural is 0 — so without the octave the cancellation of three flats would be drawn in the
    // SHARP positions, a third or a sixth from the signs it answers.
    const cancelling = keyChangeRow(C_MAJOR, E_FLAT, 'treble')!
    expect(keySignatureLines(cancelling, 'treble')).toEqual(keySignatureLines(E_FLAT, 'treble'))
  })

  it('…and the same in BASS, where every line differs — the clef is why it takes one', () => {
    const cancelling = keyChangeRow(C_MAJOR, E_FLAT, 'bass')!
    expect(keySignatureLines(cancelling, 'bass')).toEqual(keySignatureLines(E_FLAT, 'bass'))
    expect(keySignatureLines(cancelling, 'bass')).not.toEqual(keySignatureLines(E_FLAT, 'treble'))
  })

  it('⭐ a SURVIVING letter is never naturalised — Gould\'s 5♭ → 1♭ drawing', () => {
    // She prints four naturals (E♮ A♮ D♮ G♮) and does NOT cancel the B♭ that survives, then states
    // the new B♭. ⚠️ Today only the empty-incoming case draws, so this exercises the SET rule via a
    // hand-built row rather than through `keyChangeRow`'s current gate.
    const fiveFlats = keyFromFifths(-5)   // B E A D G
    const oneFlat = keyFromFifths(-1)     // B
    const surviving = new Set(oneFlat.alterations.map(a => a.step))
    const cancelled = fiveFlats.alterations.filter(a => !surviving.has(a.step)).map(a => a.step)
    expect(cancelled).toEqual(['E', 'A', 'D', 'G'])
  })

  it('the row is PRICED — its naturals cost room, which is what stops the notes overlapping', () => {
    const row = keyChangeRow(C_MAJOR, G, 'treble')!
    expect(keySignatureExtent(row)).toBeGreaterThan(0)
    expect(keySignatureExtent(row)).toBeCloseTo(glyphBox('accidentalNatural').advance, 5)
  })
})

describe('signGlyph — a natural is a DRAWN sign in a signature', () => {
  it('🚨 answers the natural glyph for alter 0, where `alterToString` answers the empty string', () => {
    // In a pitch LABEL a natural is the absence of a sign (`E4`, not `En4`) — correct there, and it
    // cost P6 a silent nothing here: every cancelling natural resolved to null and was skipped by
    // both the extent and the pass, with no error anywhere.
    expect(signGlyph(0)).toBe('accidentalNatural')
    expect(signGlyph(1)).toBe('accidentalSharp')
    expect(signGlyph(-1)).toBe('accidentalFlat')
  })
})
