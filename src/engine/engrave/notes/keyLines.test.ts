import { describe, it, expect } from 'vitest'
import { geoLine, keyRows, keyStaffLine, secondApartFlags, headGlyph, noteDurationOf } from './keyLines'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'

/**
 * ⚠️ **The agreement with VexFlow is not asserted here** — it was proved by a throwaway probe
 * (S6d: 5,040 single notes, 30 rests and 208 chords, every `keyProps` field, every head's line and
 * glyph, both `getLineNumber` answers, all identical to a plain `StaveNote`), and the one live
 * cross-check that remains is `NoteBuilder.test.ts`'s *"staffLineForSpelling matches VexFlow"*.
 * ⛔ A spec of ours may not import VexFlow to re-prove it: the census holds the specs' uses at a
 * ceiling too, and this module exists so that table stops running.
 */
describe('keyStaffLine', () => {
  it('puts each clef’s own middle-line pitch on line 3', () => {
    expect(keyStaffLine('b/4', 'treble')).toBe(3)
    expect(keyStaffLine('d/3', 'bass')).toBe(3)
    expect(keyStaffLine('c/4', 'alto')).toBe(3)
    expect(keyStaffLine('a/3', 'tenor')).toBe(3)
  })

  it('counts a step as half a line, and the bottom line as 1', () => {
    expect(keyStaffLine('e/4', 'treble')).toBe(1)
    expect(keyStaffLine('f/5', 'treble')).toBe(5)
    expect(keyStaffLine('f/4', 'treble')).toBe(1.5)
    // Ledger territory keeps counting: middle C is one line below the treble staff.
    expect(keyStaffLine('c/4', 'treble')).toBe(0)
    expect(keyStaffLine('a/5', 'treble')).toBe(6)
  })

  it('ignores the accidental — a line is the LETTER’s', () => {
    for (const key of ['c/4', 'c#/4', 'c##/4', 'cb/4', 'cbb/4', 'cn/4']) {
      expect(keyStaffLine(key, 'treble'), key).toBe(0)
    }
  })

  it('is the one rule staffLineForSpelling states', () => {
    for (const clef of ['treble', 'bass', 'alto', 'tenor'] as const) {
      for (const octave of [2, 3, 4, 5, 6]) {
        for (const [letter, step] of [['c', 'C'], ['e', 'E'], ['g', 'G'], ['b', 'B']] as const) {
          expect(keyStaffLine(`${letter}/${octave}`, clef), `${letter}${octave} ${clef}`)
            .toBe(staffLineForSpelling(step, octave, clef))
        }
      }
    }
  })

  it('reads an octave shift as written-away-from-sounding', () => {
    expect(keyStaffLine('c/5', 'treble', 1)).toBe(keyStaffLine('c/4', 'treble'))
  })

  it('refuses what this editor never writes, rather than placing it', () => {
    expect(() => keyStaffLine('h/4', 'treble')).toThrow(/not a key/)
    expect(() => keyStaffLine('c/4/D2', 'treble')).toThrow(/not a key/)
    expect(() => keyStaffLine('r/4', 'treble')).toThrow(/not a key/)
    expect(() => keyRows(['c/4'], 'percussion', 'q', false)).toThrow(/not a clef/)
    expect(() => noteDurationOf('1024')).toThrow(/not a duration/)
    expect(noteDurationOf('16')).toBe('16')
    // ⭐ the breve's and longa's tokens are the whole note's fraction, mapped back through the table
    expect(noteDurationOf('1/2')).toBe('breve')
    expect(noteDurationOf('1/4')).toBe('longa')
  })
})

describe('secondApartFlags', () => {
  it('flags BOTH members of a close pair, and nothing else', () => {
    expect(secondApartFlags([0, 0.5])).toEqual([true, true])
    expect(secondApartFlags([0, 1])).toEqual([false, false])
    expect(secondApartFlags([0, 0])).toEqual([true, true])       // a unison is close too
  })

  it('flags every member of a cluster', () => {
    expect(secondApartFlags([0, 0.5, 1])).toEqual([true, true, true])
  })

  it('lets a third break a run', () => {
    expect(secondApartFlags([0, 0.5, 1.5, 2])).toEqual([true, true, true, true])
    expect(secondApartFlags([0, 1, 1.5, 3])).toEqual([false, true, true, false])
  })

  it('says nothing about a single key', () => {
    expect(secondApartFlags([2])).toEqual([false])
    expect(secondApartFlags([])).toEqual([])
  })
})

describe('headGlyph', () => {
  it('gives a duration its notehead, and everything short the black one', () => {
    expect(headGlyph('w', false)).toBe(String.fromCodePoint(GLYPH_CODEPOINTS.noteheadWhole))
    expect(headGlyph('h', false)).toBe(String.fromCodePoint(GLYPH_CODEPOINTS.noteheadHalf))
    for (const d of ['q', '8', '16', '32'] as const) {
      expect(headGlyph(d, false), d).toBe(String.fromCodePoint(GLYPH_CODEPOINTS.noteheadBlack))
    }
  })

  it('gives a rest its own glyph, one per duration', () => {
    const rests = (['w', 'h', 'q', '8', '16', '32'] as const).map(d => headGlyph(d, true))
    expect(new Set(rests).size).toBe(rests.length)
    expect(rests[0]).toBe(String.fromCodePoint(GLYPH_CODEPOINTS.restWhole))
  })
})

describe('keyRows', () => {
  it('keeps the chord’s own order, whatever the lines do', () => {
    const rows = keyRows(['g/4', 'c/4', 'e/4'], 'treble', 'q', false)
    expect(rows.map(r => r.key)).toEqual(['G', 'C', 'E'])
    expect(rows.map(r => r.line)).toEqual([2, 0, 1])
  })

  it('names a key with its accidental, upper-cased', () => {
    expect(keyRows(['c#/4', 'ab/3', 'dbb/5'], 'treble', 'q', false).map(r => r.key))
      .toEqual(['C#', 'AB', 'DBB'])
  })

  it('marks a second on both rows and gives every head one glyph', () => {
    const rows = keyRows(['c/4', 'd/4', 'a/4'], 'treble', 'h', false)
    expect(rows.map(r => r.displaced)).toEqual([true, true, false])
    expect(new Set(rows.map(r => r.code)).size).toBe(1)
  })

  it('carries VexFlow’s chromatic column, flat-side wrap and all', () => {
    // ⚠️ Cb4 is B's value in its OWN octave, and B#4 runs past 11 — the asymmetry is the table's.
    expect(keyRows(['cb/4'], 'treble', 'q', false)[0].intValue).toBe(4 * 12 + 11)
    expect(keyRows(['b#/4'], 'treble', 'q', false)[0].intValue).toBe(4 * 12 + 12)
    expect(keyRows(['c/4'], 'treble', 'q', false)[0].intValue).toBe(48)
  })
})

describe('keyRows — CROSS-STAFF (docs/plans/cross-staff-plan.md)', () => {
  it('an ordinary chord has lift 0 on every key', () => {
    expect(keyRows(['c/4', 'e/4'], 'treble', 'q', false).map(r => r.lift)).toEqual([0, 0])
  })

  it('⭐ a crossed key keeps its TRUE line in the other clef, and carries that staff’s lift', () => {
    // B2 at home on a bass staff; D4 written on the treble staff 10.5 lines above.
    const [b2, d4] = keyRows(['b/2', 'd/4'], 'bass', 'h', false, 0, [undefined, { clef: 'treble', lift: 10.5 }])
    expect(b2.line).toBe(keyStaffLine('b/2', 'bass'))
    expect(d4.line).toBe(keyStaffLine('d/4', 'treble')) // ⛔ not its bass-clef line
    expect(geoLine(b2)).toBe(b2.line)
    expect(geoLine(d4)).toBe(d4.line + 10.5)
  })

  it('heads on different staves are never a SECOND, whatever their lines say', () => {
    // F2 under a bass staff and D4 under a treble one hang from the SAME line number.
    const home = keyStaffLine('f/2', 'bass')
    const away = keyStaffLine('d/4', 'treble')
    expect(Math.abs(home - away)).toBeLessThan(1) // the trap the lift defuses
    const rows = keyRows(['f/2', 'd/4'], 'bass', 'h', false, 0, [undefined, { clef: 'treble', lift: 10.5 }])
    expect(rows.map(r => r.displaced)).toEqual([false, false])
  })
})

