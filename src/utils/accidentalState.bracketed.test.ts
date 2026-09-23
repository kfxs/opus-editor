import { describe, it, expect } from 'vitest'
import { displayedAccidentals } from './accidentalState'
import { fracCreate } from './fraction'
import { C_MAJOR } from './keySignature'
import type { Chord, NotePitch } from '@/types/music'

/**
 * Subject: `./accidentalState` — a BRACKETED pitch's sign (docs/plans/bracketed-grace-plan.md B6):
 * READ against what is in force where it stands, ⛔ and never put anything in force — it is
 * information, not an attack.
 */
const p = (id: string, step: NotePitch['step'], alter: NotePitch['alter'] = 0, octave = 4): NotePitch => ({ id, step, alter, octave })
const chord = (id: string, beat: number, notes: NotePitch[], over: Partial<Chord> = {}): Chord =>
  ({ id, type: 'chord', beat: fracCreate(beat, 1), duration: 'q', measure: 1, notes, ...over })

describe('displayedAccidentals — bracketed pitches', () => {
  it('⭐ it READS the bar: a bracketed F after an F♯ shows its ♮', () => {
    const signs = displayedAccidentals([
      chord('a', 0, [p('fs', 'F', 1)]),
      chord('b', 1, [p('g', 'G')], { bracketedBefore: [{ pitches: [p('bf', 'F')], duration: 'q' }] }),
    ], C_MAJOR)
    expect(signs.get('bf')).toBe('n')
  })

  it('⭐⛔ it WRITES nothing: after a bracketed B♭, the bar\'s next B♭ still shows its flat', () => {
    const signs = displayedAccidentals([
      chord('a', 0, [p('g', 'G')], { bracketedBefore: [{ pitches: [p('bb', 'B', -1)], duration: 'q' }] }),
      chord('b', 1, [p('main', 'B', -1)]),
    ], C_MAJOR)
    expect(signs.get('bb')).toBe('b')
    expect(signs.get('main')).toBe('b')
  })

  it('…and it writes nothing AFTER its note either — the trill note\'s side', () => {
    const signs = displayedAccidentals([
      chord('a', 0, [p('c', 'C')], { bracketedAfter: [{ pitches: [p('after', 'D', 1)], duration: 'q' }] }),
      chord('b', 1, [p('d', 'D', 1)]),
    ], C_MAJOR)
    expect(signs.get('after')).toBe('#')
    expect(signs.get('d')).toBe('#')
  })

  it('a bracketed grace bent into a GRACE is read before that grace', () => {
    const signs = displayedAccidentals([
      chord('a', 0, [p('c', 'C')], {
        graceBefore: { notes: [{ pitches: [p('g', 'E', -1)], duration: '8', bracketedBefore: [{ pitches: [p('bg', 'E')], duration: 'q' }] }] },
      }),
    ], C_MAJOR)
    // Read BEFORE the grace's E♭ is in force: a plain E in C major shows nothing.
    expect(signs.get('bg')).toBeNull()
    expect(signs.get('g')).toBe('b')
  })
})
