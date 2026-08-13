/**
 * {@link keySignature} — the circle of fifths as the ONE fact a key signature is.
 *
 * The point of these is that `keyAlterOf` is already the whole rule: one integer decides which
 * letters are altered and which way, so the day key signatures become a feature there is nothing
 * here to revisit. `keyAt` is pinned as the placeholder it is — the address exists, the lookup does
 * not (see the module note).
 */
import { describe, it, expect } from 'vitest'
import { C_MAJOR, keyAlterOf, keyAt, type KeySignature } from './keySignature'
import { ScoreModel } from '@/engine/models/ScoreModel'

const key = (fifths: number): KeySignature => ({ fifths })

describe('keyAlterOf', () => {
  it('alters nothing in C major', () => {
    for (const step of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
      expect(keyAlterOf(C_MAJOR, step)).toBe(0)
    }
  })

  it('adds sharps in the order F C G D A E B', () => {
    expect(keyAlterOf(key(1), 'F')).toBe(1)   // G major
    expect(keyAlterOf(key(1), 'C')).toBe(0)
    expect(keyAlterOf(key(2), 'C')).toBe(1)   // D major: F♯ C♯
    expect(keyAlterOf(key(3), 'G')).toBe(1)   // A major: F♯ C♯ G♯
    expect(keyAlterOf(key(3), 'D')).toBe(0)
  })

  it('adds flats in the order B E A D G C F', () => {
    expect(keyAlterOf(key(-1), 'B')).toBe(-1) // F major
    expect(keyAlterOf(key(-1), 'E')).toBe(0)
    expect(keyAlterOf(key(-2), 'E')).toBe(-1) // B♭ major: B♭ E♭
    expect(keyAlterOf(key(-4), 'D')).toBe(-1) // A♭ major: B♭ E♭ A♭ D♭
    expect(keyAlterOf(key(-4), 'G')).toBe(0)
  })

  it('saturates at seven — C♯ major alters every letter, and no more exist to alter', () => {
    for (const step of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
      expect(keyAlterOf(key(7), step)).toBe(1)
      expect(keyAlterOf(key(-7), step)).toBe(-1)
      expect(keyAlterOf(key(99), step)).toBe(1) // nonsense in, no crash out
    }
  })
})

describe('keyAt — the placeholder with a real address', () => {
  it('answers C major everywhere, on any staff', () => {
    const model = new ScoreModel()
    model.addMeasure()
    expect(keyAt(model.getScore(), 1)).toEqual(C_MAJOR)
    expect(keyAt(model.getScore(), 2, 'some-staff-id')).toEqual(C_MAJOR)
  })
})
