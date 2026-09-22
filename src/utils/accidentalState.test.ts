import { describe, it, expect } from 'vitest'
import { prevailingAlterations, alterInForce, alterInForceAt, displayedAccidentals, type AccidentalNote } from './accidentalState'
import type { Chord, FanMark, NotePitch, PitchAlter, PitchStep } from '@/types/music'
import { fracCreate as frac } from './fraction'
import { spellingDiatonicPos } from './pitchSpelling'
import { C_MAJOR, keyFromFifths } from './keySignature'

// Pins the ONE running-accidental rule the three consumers share, so they can never drift:
// tied continuations excluded, beat-ordered (last wins), same diatonic position only, and
// strictly BEFORE the target beat (a chord never alters itself).
describe('accidentalState.prevailingAlterations', () => {
  const F4 = spellingDiatonicPos('F', 4)
  const G4 = spellingDiatonicPos('G', 4)

  const at = (beat: number, extra: Partial<AccidentalNote>): AccidentalNote =>
    ({ step: 'F', octave: 4, alter: 0, beat: frac(beat, 1), ...extra })

  it('keeps the LAST preceding alteration at a diatonic position (beat-ordered)', () => {
    const notes = [at(0, { alter: 1 }), at(1, { alter: -1 })]
    expect(alterInForceAt(notes, frac(2, 1), C_MAJOR, 'F', 4)).toBe(-1)
  })

  it('keys by diatonic position — a different position does not leak', () => {
    const notes = [at(0, { step: 'F', alter: 1 })]
    expect(alterInForceAt(notes, frac(2, 1), C_MAJOR, 'G', 4)).toBe(0) // G untouched by F#
  })

  it('excludes tied continuations (a tied note re-states nothing)', () => {
    const notes = [at(0, { alter: 1, tiedFrom: 'x' })]
    expect(alterInForceAt(notes, frac(2, 1), C_MAJOR, 'F', 4)).toBe(0)
  })

  it('excludes rests', () => {
    const notes: AccidentalNote[] = [{ isRest: true, beat: frac(0, 1) }, at(1, { alter: 1 })]
    expect(alterInForceAt(notes, frac(2, 1), C_MAJOR, 'F', 4)).toBe(1) // only the F# counts
  })

  it('is strictly before the target beat — a same-beat note does not count', () => {
    const notes = [at(1, { alter: 1 })]
    expect(alterInForceAt(notes, frac(1, 1), C_MAJOR, 'F', 4)).toBe(0)
  })

  it('a position never seen is absent from the map (undefined, not 0)', () => {
    const map = prevailingAlterations([at(0, { alter: 1 })], frac(2, 1))
    expect(map.get(F4)).toBe(1)
    expect(map.has(G4)).toBe(false)
  })
})

/**
 * The FORWARD walk — the sign each pitch actually displays. Extracted from `NoteBuilder` so a fanned
 * group's members obey the same rule as the notes around them (docs/plans/fanned-beam-pitches-plan.md §2).
 */
describe('displayedAccidentals', () => {
  const pitch = (id: string, step: PitchStep, alter: PitchAlter, extra: Partial<NotePitch> = {}): NotePitch =>
    ({ id, step, alter, octave: 4, ...extra })

  const chord = (id: string, notes: NotePitch[], beat: number, fan?: FanMark): Chord => ({
    id, type: 'chord', beat: frac(beat, 1), duration: 'q', measure: 1, notes, ...(fan ? { fan } : {}),
  })

  it('shows an alteration once and suppresses it while it is in force', () => {
    const signs = displayedAccidentals([
      chord('s1', [pitch('a', 'F', 1)], 0),
      chord('s2', [pitch('b', 'F', 1)], 1),
    ], C_MAJOR)
    expect(signs.get('a')).toBe('#')
    expect(signs.get('b')).toBeNull()
  })

  it('cancels it with a natural when the plain pitch returns', () => {
    const signs = displayedAccidentals([
      chord('s1', [pitch('a', 'F', 1)], 0),
      chord('s2', [pitch('b', 'F', 0)], 1),
    ], C_MAJOR)
    expect(signs.get('b')).toBe('n')
  })

  it('never re-states one on a tied continuation', () => {
    const signs = displayedAccidentals([chord('s1', [pitch('a', 'F', 1, { tiedFrom: 'x' })], 0)], C_MAJOR)
    expect(signs.get('a')).toBeNull()
  })

  it('⭐ decides a fanned MEMBER’s sign too — the drawing reads it, it does not invent one', () => {
    const fan: FanMark = {
      direction: 'accel', count: 3, beams: 3,
      members: [{ pitches: [pitch('m1', 'G', 1)] }, { pitches: [pitch('m2', 'G', 1)] }],
    }
    const signs = displayedAccidentals([chord('s1', [pitch('a', 'C', 0)], 0, fan)], C_MAJOR)
    expect(signs.get('m1')).toBe('#') // the first G♯ of the bar shows its sign
    expect(signs.get('m2')).toBeNull() // the second is already in force
  })

  it('⭐ a member’s accidental HOLDS FOR THE REST OF THE BAR', () => {
    // His decision, and the ordinary common-practice rule: a member is a note in the bar. Left out,
    // the plain G after the fan would draw no natural at all.
    const fan: FanMark = {
      direction: 'accel', count: 2, beams: 3, members: [{ pitches: [pitch('m1', 'G', 1)] }],
    }
    const signs = displayedAccidentals([
      chord('s1', [pitch('a', 'C', 0)], 0, fan),
      chord('s2', [pitch('b', 'G', 0)], 1),
    ], C_MAJOR)
    expect(signs.get('b')).toBe('n')
  })

  it('the DEFAULT fan (every member the note you typed) shows exactly one sign', () => {
    const fan: FanMark = {
      direction: 'accel', count: 3, beams: 3,
      members: [{ pitches: [pitch('m1', 'F', 1)] }, { pitches: [pitch('m2', 'F', 1)] }],
    }
    const signs = displayedAccidentals([chord('s1', [pitch('a', 'F', 1)], 0, fan)], C_MAJOR)
    expect([signs.get('a'), signs.get('m1'), signs.get('m2')]).toEqual(['#', null, null])
  })

  it('⭐ a GRACE before is walked BEFORE its chord, a grace after AFTER it — its sign holds on (MuseScore\'s order)', () => {
    const graced: Chord = {
      ...chord('s1', [pitch('a', 'F', 1)], 0),
      graceBefore: { notes: [{ pitches: [pitch('g1', 'F', 1)], duration: '8' }] },
      graceAfter: { notes: [{ pitches: [pitch('g2', 'F', 0)], duration: '16' }] },
    }
    const signs = displayedAccidentals([graced, chord('s2', [pitch('b', 'F', 0)], 1)], C_MAJOR)
    expect(signs.get('g1'), 'the grace states the sharp').toBe('#')
    expect(signs.get('a'), '…so the main note does not repeat it').toBeNull()
    expect(signs.get('g2'), 'the grace after cancels it').toBe('n')
    expect(signs.get('b'), '…and the natural holds on').toBeNull()
  })

  /**
   * ⭐⭐ THE KEY SIGNATURE'S HALF of the rule (docs/plans/key-signature-plan.md §3). The key is the
   * FALLBACK consulted where the bar has said nothing at a position — never a pre-fill of the map,
   * because the map is octave-specific and a signature governs a letter in every octave.
   */
  describe('…under a key signature', () => {
    const G_MAJOR = keyFromFifths(1) // one sharp: F♯
    const E_FLAT = keyFromFifths(-3) // B♭ E♭ A♭

    it('⭐ an F♯ in G major draws NO sign — the signature already said it', () => {
      const signs = displayedAccidentals([chord('s1', [pitch('a', 'F', 1)], 0)], G_MAJOR)
      expect(signs.get('a')).toBeNull()
    })

    it('⭐ …and an F♮ in G major DRAWS a natural it would not draw in C major', () => {
      const slots = [chord('s1', [pitch('a', 'F', 0)], 0)]
      expect(displayedAccidentals(slots, G_MAJOR).get('a')).toBe('n')
      expect(displayedAccidentals(slots, C_MAJOR).get('a')).toBeNull()
    })

    it('governs the letter in EVERY OCTAVE, not just the one the sign is drawn on', () => {
      const high = { ...pitch('a', 'F', 1), octave: 6 }
      expect(displayedAccidentals([chord('s1', [high], 0)], G_MAJOR).get('a')).toBeNull()
    })

    it('a letter the key is silent about is untouched — G in G major still shows its own sharp', () => {
      const signs = displayedAccidentals([chord('s1', [pitch('a', 'G', 1)], 0)], G_MAJOR)
      expect(signs.get('a')).toBe('#')
    })

    it('🚨 an explicit natural earlier in the bar BEATS the key at that position', () => {
      // `?? ` not `||`: the bar said 0, and 0 must win over the signature's sharp. A later F is then
      // an F♮ that re-states nothing — ⛔ it must NOT go back to drawing the key's F♯ as a sign.
      const signs = displayedAccidentals([
        chord('s1', [pitch('a', 'F', 0)], 0),
        chord('s2', [pitch('b', 'F', 0)], 1),
      ], G_MAJOR)
      expect([signs.get('a'), signs.get('b')]).toEqual(['n', null])
    })

    it('a sharp written after that natural shows its sign again', () => {
      const signs = displayedAccidentals([
        chord('s1', [pitch('a', 'F', 0)], 0),
        chord('s2', [pitch('b', 'F', 1)], 1),
      ], G_MAJOR)
      expect(signs.get('b')).toBe('#')
    })

    it('🚨🚨 a COURTESY survives the key agreeing with it — Gould p. 81', () => {
      // *"This practice holds good even when a key signature corrects the accidental"* — her figure
      // is in E♭ major and still writes an explicit ♭ in bar 2. ⛔ The obvious simplification ("the
      // key already says B♭, drop the sign") is wrong, and it would look right.
      const signs = displayedAccidentals(
        [chord('s1', [pitch('a', 'B', -1, { forceAccidental: true })], 0)], E_FLAT,
      )
      expect(signs.get('a')).toBe('b')
    })

    it('an OPEN key alters nothing — its list is empty, like C major’s', () => {
      const signs = displayedAccidentals([chord('s1', [pitch('a', 'F', 0)], 0)], { alterations: [], mode: 'open' })
      expect(signs.get('a')).toBeNull()
    })

    it('a fanned MEMBER reads the same signature as the notes around it', () => {
      const fan: FanMark = {
        direction: 'accel', count: 2, beams: 3, members: [{ pitches: [pitch('m1', 'F', 1)] }],
      }
      const signs = displayedAccidentals([chord('s1', [pitch('a', 'C', 0)], 0, fan)], G_MAJOR)
      expect(signs.get('m1')).toBeNull()
    })
  })
})

/**
 * ⭐⭐ {@link alterInForce} — the ONE fallback the drawing, note entry, "remove accidental" and the
 * trill's auxiliary all read. Its whole content is *the bar first, the key underneath it*.
 */
describe('alterInForce', () => {
  const G_MAJOR = keyFromFifths(1)

  it('answers the KEY where the bar has said nothing at that position', () => {
    expect(alterInForce(new Map(), G_MAJOR, 'F', 4)).toBe(1)
    expect(alterInForce(new Map(), G_MAJOR, 'G', 4)).toBe(0)
  })

  it('answers the BAR where it has', () => {
    const bar = new Map([[spellingDiatonicPos('F', 4), -1 as PitchAlter]])
    expect(alterInForce(bar, G_MAJOR, 'F', 4)).toBe(-1)
  })

  it('🚨 an explicit natural (0) in the bar is an ANSWER, not an absence', () => {
    const bar = new Map([[spellingDiatonicPos('F', 4), 0 as PitchAlter]])
    expect(alterInForce(bar, G_MAJOR, 'F', 4)).toBe(0) // `??`, never `||`
  })

  it('the bar is OCTAVE-specific while the key is not — F♮4 leaves F5 at the key’s sharp', () => {
    const bar = new Map([[spellingDiatonicPos('F', 4), 0 as PitchAlter]])
    expect(alterInForce(bar, G_MAJOR, 'F', 5)).toBe(1)
  })
})
