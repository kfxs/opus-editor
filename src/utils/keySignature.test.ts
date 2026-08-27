/**
 * {@link keySignature} — an ORDERED SET OF ALTERED LETTERS, and the three questions asked of it.
 *
 * ⭐ The point of these is the split the module's header argues: `keyAlterOf` answers *what a letter
 * is altered to* and is the reader everything else should use; `fifthsOf` answers *what the key is
 * called*, and is allowed to answer **nothing**. The tests that matter most are the ones where those
 * two come apart — a signature mixing a sharp and a flat has alterations and no name.
 *
 * ⛔ Nothing here writes `Measure.keys` through an API, because there is no writer yet (P2). The
 * fixtures set the field directly, which is honest for what P1 is: the model and the reads.
 */
import { describe, it, expect } from 'vitest'
import { C_MAJOR, fifthsOf, keyAlterOf, keyAt, keyFromFifths, type KeySignature } from './keySignature'
import { fracCreate as frac } from './fraction'
import { ScoreModel } from '@/engine/models/ScoreModel'
import type { Score } from '@/types/music'

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

/** A score of `n` bars with nothing in it. */
function scoreOf(n: number): ScoreModel {
  const model = new ScoreModel()
  while (model.getScore().measures.length < n) model.addMeasure()
  return model
}

/** Put a key change on a bar. Direct, because P1 has no writer — see the module note. */
function putKey(score: Score, measureNumber: number, key: KeySignature, staffId?: string): void {
  const measure = score.measures.find(m => m.number === measureNumber)!
  measure.keys ??= []
  measure.keys.push({ id: `k${measureNumber}`, beat: frac(0, 1), key, ...(staffId ? { staffId } : {}) })
}

describe('keyAlterOf', () => {
  it('alters nothing in C major', () => {
    for (const step of STEPS) expect(keyAlterOf(C_MAJOR, step)).toBe(0)
  })

  it('adds sharps in the order F C G D A E B', () => {
    expect(keyAlterOf(keyFromFifths(1), 'F')).toBe(1)   // G major
    expect(keyAlterOf(keyFromFifths(1), 'C')).toBe(0)
    expect(keyAlterOf(keyFromFifths(2), 'C')).toBe(1)   // D major: F♯ C♯
    expect(keyAlterOf(keyFromFifths(3), 'G')).toBe(1)   // A major: F♯ C♯ G♯
    expect(keyAlterOf(keyFromFifths(3), 'D')).toBe(0)
  })

  it('adds flats in the order B E A D G C F', () => {
    expect(keyAlterOf(keyFromFifths(-1), 'B')).toBe(-1) // F major
    expect(keyAlterOf(keyFromFifths(-1), 'E')).toBe(0)
    expect(keyAlterOf(keyFromFifths(-2), 'E')).toBe(-1) // B♭ major: B♭ E♭
    expect(keyAlterOf(keyFromFifths(-4), 'D')).toBe(-1) // A♭ major: B♭ E♭ A♭ D♭
    expect(keyAlterOf(keyFromFifths(-4), 'G')).toBe(0)
  })

  it('is INDEPENDENT OF OCTAVE — a sign drawn in one octave alters the letter in all of them', () => {
    // Gould pp. 93-94: her figure draws C♯ at C5 and it sharpens the C at C4. `octave` is PLACEMENT.
    const oddlyPlaced: KeySignature = { alterations: [{ step: 'C', alter: 1, octave: 5 }] }
    expect(keyAlterOf(oddlyPlaced, 'C')).toBe(1)
  })

  it('⭐ answers for a signature that mixes a sharp and a flat — the requirement the model exists for', () => {
    const bartok: KeySignature = { alterations: [{ step: 'B', alter: -1 }, { step: 'F', alter: 1 }] }
    expect(keyAlterOf(bartok, 'B')).toBe(-1)
    expect(keyAlterOf(bartok, 'F')).toBe(1)
    expect(keyAlterOf(bartok, 'E')).toBe(0)
  })
})

describe('keyFromFifths — the classical constructor', () => {
  it('builds the list in cycle order, which is what makes the printed order right by default', () => {
    expect(keyFromFifths(3).alterations.map(a => a.step)).toEqual(['F', 'C', 'G'])
    expect(keyFromFifths(-3).alterations.map(a => a.step)).toEqual(['B', 'E', 'A'])
    expect(keyFromFifths(2).alterations.every(a => a.alter === 1)).toBe(true)
    expect(keyFromFifths(-2).alterations.every(a => a.alter === -1)).toBe(true)
  })

  it('C major is an EMPTY list, not a special case', () => {
    expect(keyFromFifths(0)).toEqual({ alterations: [], mode: 'major' })
  })

  it('carries the mode, which changes the NAME and nothing else', () => {
    const gMajor = keyFromFifths(1)
    const eMinor = keyFromFifths(1, 'minor')
    expect(eMinor.alterations).toEqual(gMajor.alterations)
    expect(eMinor.mode).toBe('minor')
  })

  it('clamps at seven and does NOT wrap', () => {
    expect(keyFromFifths(7).alterations).toHaveLength(7)
    expect(keyFromFifths(99).alterations).toHaveLength(7)   // nonsense in, no crash out
    expect(keyFromFifths(-99).alterations).toHaveLength(7)
    expect(keyFromFifths(99).alterations.every(a => a.alter === 1)).toBe(true)
  })
})

describe('fifthsOf — the NAME, which is allowed to be absent', () => {
  it('names the traditional keys, both directions', () => {
    for (let n = -7; n <= 7; n++) expect(fifthsOf(keyFromFifths(n))).toBe(n)
  })

  it('⭐⭐ answers NULL for a mixed signature — there is no such position on the circle', () => {
    const bartok: KeySignature = { alterations: [{ step: 'B', alter: -1 }, { step: 'F', alter: 1 }] }
    expect(fifthsOf(bartok)).toBeNull()
  })

  it('answers NULL for a set that is not a cycle-of-fifths PREFIX', () => {
    // One sharp, but the wrong one: C♯ alone is nobody's key signature.
    expect(fifthsOf({ alterations: [{ step: 'C', alter: 1 }] })).toBeNull()
    // F♯ and G♯ skips C♯.
    expect(fifthsOf({ alterations: [{ step: 'F', alter: 1 }, { step: 'G', alter: 1 }] })).toBeNull()
  })

  it('names by CONTENT, so an authored order still has its traditional name', () => {
    expect(fifthsOf({ alterations: [{ step: 'C', alter: 1 }, { step: 'F', alter: 1 }] })).toBe(2)
  })

  it('⭐⭐ OPEN/ATONAL IS NOT C MAJOR, and this is the line that keeps them apart', () => {
    expect(fifthsOf({ alterations: [], mode: 'major' })).toBe(0)
    expect(fifthsOf({ alterations: [], mode: 'open' })).toBeNull()
  })

  it('ignores a placement override — the octave is where the sign is drawn, not what it means', () => {
    expect(fifthsOf({ alterations: [{ step: 'F', alter: 1, octave: 5 }] })).toBe(1)
  })

  it('answers NULL for a double accidental, which no traditional signature carries', () => {
    expect(fifthsOf({ alterations: [{ step: 'B', alter: -2 }] })).toBeNull()
  })
})

describe('keyAt — the walk', () => {
  it('is C major where nothing has said otherwise', () => {
    const score = scoreOf(2).getScore()
    expect(keyAt(score, 1)).toEqual(C_MAJOR)
    expect(keyAt(score, 2)).toEqual(C_MAJOR)
  })

  it('carries a signature FORWARD until the next change', () => {
    const score = scoreOf(5).getScore()
    putKey(score, 2, keyFromFifths(1))   // G major from bar 2
    putKey(score, 4, keyFromFifths(-2))  // B♭ major from bar 4

    expect(fifthsOf(keyAt(score, 1))).toBe(0)
    expect(fifthsOf(keyAt(score, 2))).toBe(1)
    expect(fifthsOf(keyAt(score, 3))).toBe(1)  // inherited, with nothing stored in bar 3
    expect(fifthsOf(keyAt(score, 4))).toBe(-2)
    expect(fifthsOf(keyAt(score, 5))).toBe(-2)
  })

  it('⚠️ STAVES DO NOT INHERIT EACH OTHER\'S KEYS — Bartók writes four sharps against four flats', () => {
    const model = scoreOf(3)
    const staff1 = model.addStaffBelow(0)
    const score = model.getScore()
    const staff0 = score.staves![0].id
    putKey(score, 2, keyFromFifths(4), staff0)   // E major, upper staff
    putKey(score, 2, keyFromFifths(-4), staff1)  // A♭ major, lower staff

    expect(fifthsOf(keyAt(score, 2, staff0))).toBe(4)
    expect(fifthsOf(keyAt(score, 2, staff1))).toBe(-4)
    expect(fifthsOf(keyAt(score, 3, staff0))).toBe(4)
    expect(fifthsOf(keyAt(score, 3, staff1))).toBe(-4)
  })

  it('resolves an absent staffId to the first staff, both sides', () => {
    const model = scoreOf(2)
    const staff1 = model.addStaffBelow(0)
    const score = model.getScore()
    putKey(score, 1, keyFromFifths(2))            // stored with no staffId

    expect(fifthsOf(keyAt(score, 1))).toBe(2)                       // asked with none
    expect(fifthsOf(keyAt(score, 1, score.staves![0].id))).toBe(2)  // asked by name
    expect(fifthsOf(keyAt(score, 1, staff1))).toBe(0)               // …and not the other staff
  })

  it('a mid-bar change is NOT in force at the bar\'s start, and IS at its own beat', () => {
    const score = scoreOf(2).getScore()
    const measure = score.measures[0]
    measure.keys = [{ id: 'k-mid', beat: frac(2, 1), key: keyFromFifths(3) }]

    expect(fifthsOf(keyAt(score, 1))).toBe(0)                  // the bar opens in C
    expect(fifthsOf(keyAt(score, 1, undefined, frac(1, 1)))).toBe(0)
    expect(fifthsOf(keyAt(score, 1, undefined, frac(2, 1)))).toBe(3)  // …and changes here
    expect(fifthsOf(keyAt(score, 2))).toBe(3)                  // the next bar inherits it
  })

  it('takes the LAST change in a bar when several share it', () => {
    const score = scoreOf(2).getScore()
    score.measures[0].keys = [
      { id: 'a', beat: frac(3, 1), key: keyFromFifths(-1) },
      { id: 'b', beat: frac(1, 1), key: keyFromFifths(1) },  // stored out of order on purpose
    ]
    expect(fifthsOf(keyAt(score, 1, undefined, frac(4, 1)))).toBe(-1)
    expect(fifthsOf(keyAt(score, 2))).toBe(-1)
  })
})
