import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_CHORD_DOT_RULE, CHORD_DOT_RULES, armedChordDots, centredChordSpaces, chordDotGeneration, chordDotSettings,
  lilypondChordSpaces, musescoreChordSpaces,
  resetChordDotRule, setChordDotRule,
} from './chordDots'

afterEach(() => resetChordDotRule())

describe('a colliding chord’s dots (docs/plans/multiple-dots-plan.md R5)', () => {
  it('✅ ships `gould`; every row names its source', () => {
    expect(ACTIVE_CHORD_DOT_RULE).toBe('gould')
    expect(armedChordDots().collisions).toBe('centre')
    for (const row of Object.values(CHORD_DOT_RULES)) expect(row.source.length).toBeGreaterThan(0)
  })

  it('⭐ Gould p. 56, her four-note cluster F4–B4: a space each, centred — one BELOW, ⛔ not all four upward', () => {
    // Treble lines: E4 = 1, so F4 1.5, G4 2, A4 2.5, B4 3.
    expect(centredChordSpaces([3, 2.5, 2, 1.5])).toEqual([3.5, 2.5, 1.5, 0.5])
  })

  it('⭐ Gould p. 56’s rule on a tall cluster: a dot TWO spaces out ⇒ only the spaces the chord covers', () => {
    // Eight heads stepwise E4..E5 (lines 1..4.5): eight dots would run to −0.5 and 6.5, so the chord keeps the
    // four spaces it covers. ⚠️ Her OWN figure is a taller chord (bottom line to above the top line) with FIVE
    // dots — the five spaces THAT one covers; this is the rule applied, ⛔ not her drawing.
    expect(centredChordSpaces([4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1])).toEqual([4.5, 3.5, 2.5, 1.5])
  })

  it('C5 D5 E5 F5 (lines 3.5–5): four spaces, one each side of the two it covers', () => {
    expect(centredChordSpaces([5, 4.5, 4, 3.5])).toEqual([5.5, 4.5, 3.5, 2.5])
  })

  it('arming bumps the generation; an unknown row is refused', () => {
    const before = chordDotGeneration()
    expect(setChordDotRule('verovio')).toBe(true)
    expect(chordDotGeneration()).toBeGreaterThan(before)
    expect(setChordDotRule('nope' as never)).toBe(false)
    expect(chordDotSettings().rule).toBe('verovio')
  })
})

// ⭐ The ENGINES' rules, ported (2026-09-25) — pinned to the worked examples of
//    `docs/research/multiple-dots-research.md` Part D (their Python transcriptions of the same code).
//    Treble lines: E4 = 1, F4 1.5, G4 2, A4 2.5, B4 3, C5 3.5, D5 4, E5 4.5, F5 5.
const sorted = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null).sort((a, b) => a - b)

describe('lilypondChordSpaces — `dot-column.cc` + `dot-configuration.cc`', () => {
  it('F4 G4 A4 B4 → 0.5 / 1.5 / 2.5 / 3.5 — exactly Gould’s figure', () => {
    expect(sorted(lilypondChordSpaces([1.5, 2, 2.5, 3]))).toEqual([0.5, 1.5, 2.5, 3.5])
  })
  it('C5 D5 E5 F5 → 2.5 / 3.5 / 4.5 / 5.5', () => {
    expect(sorted(lilypondChordSpaces([3.5, 4, 4.5, 5]))).toEqual([2.5, 3.5, 4.5, 5.5])
  })
  it('E4 … E5 (8 heads): `chord-dots-limit` 3 trims E4’s and E5’s dots — SIX, 0.5 … 5.5', () => {
    const out = lilypondChordSpaces([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5])
    expect(sorted(out)).toEqual([0.5, 1.5, 2.5, 3.5, 4.5, 5.5])
    expect(out[0], 'E4 dropped').toBeNull()
    expect(out[7], 'E5 dropped').toBeNull()
  })
  it('small cases: A4 B4 → 2.5 / 3.5; G4 B4 → 2.5 / 3.5; a lone B4 → 3.5 (up)', () => {
    expect(sorted(lilypondChordSpaces([2.5, 3]))).toEqual([2.5, 3.5])
    expect(sorted(lilypondChordSpaces([2, 3]))).toEqual([2.5, 3.5])
    expect(lilypondChordSpaces([3])).toEqual([3.5])
  })
})

describe('musescoreChordSpaces — `chordlayout.cpp`, one flip, never re-checked', () => {
  it('F4 G4 A4 B4 → G4’s dot lands in F4’s space (1.5, 1.5, 2.5, 3.5)', () => {
    expect(musescoreChordSpaces([1.5, 2, 2.5, 3])).toEqual([1.5, 1.5, 2.5, 3.5])
  })
  it('C5 D5 E5 F5 → D5 lands on C5 (3.5, 3.5, 4.5, 5.5)', () => {
    expect(musescoreChordSpaces([3.5, 4, 4.5, 5])).toEqual([3.5, 3.5, 4.5, 5.5])
  })
  it('E4 … E5 → eight dots in five spaces, nothing dropped', () => {
    expect(musescoreChordSpaces([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5])).toEqual([0.5, 1.5, 1.5, 2.5, 2.5, 3.5, 3.5, 4.5])
  })
  it('the clean small cases: A4 B4 → 2.5 / 3.5; G4 A4 B4 → 1.5 / 2.5 / 3.5; E4 F4 G4 → 0.5 / 1.5 / 2.5', () => {
    expect(musescoreChordSpaces([2.5, 3])).toEqual([2.5, 3.5])
    expect(musescoreChordSpaces([2, 2.5, 3])).toEqual([1.5, 2.5, 3.5])
    expect(musescoreChordSpaces([1, 1.5, 2])).toEqual([0.5, 1.5, 2.5])
  })
})

describe('⭐ the engines on an ORDINARY chord — they run on every chord, so they must leave a plain one alone', () => {
  // C4 E4 G4 (lines 0, 1, 2 — all on a line): every dot lifts into the space above, as VexFlow's walk does.
  it('a triad on lines: 0.5 / 1.5 / 2.5 in both', () => {
    expect(sorted(lilypondChordSpaces([0, 1, 2]))).toEqual([0.5, 1.5, 2.5])
    expect(musescoreChordSpaces([0, 1, 2])).toEqual([0.5, 1.5, 2.5])
  })
  it('a triad in spaces (F4 A4 C5): each dot in its own space', () => {
    expect(sorted(lilypondChordSpaces([1.5, 2.5, 3.5]))).toEqual([1.5, 2.5, 3.5])
    expect(musescoreChordSpaces([1.5, 2.5, 3.5])).toEqual([1.5, 2.5, 3.5])
  })
})
