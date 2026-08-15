/**
 * {@link tieSide} — which way a tie bows, and the two rules the old renderer-local version was
 * missing: it never looked at a stem, and it asked for a middle line that was always treble's.
 *
 * ⭐ Headless on purpose, and the reason is sharper here than usual: a bare `new StaveNote(...)`
 * reports stem direction `1` for EVERY pitch, so a spec that built live notes in jsdom would agree
 * with itself no matter what the rule said. The stems arrive as plain numbers; that they are the
 * ones VexFlow actually drew is `TieRenderer`'s job.
 */
import { describe, it, expect } from 'vitest'
import { tieSide } from './tieDirection'
import type { Chord, Measure, NotePitch } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

const ZERO = frac(0, 1)

const UP = -1     // the arc bows over the note
const DOWN = 1    // …and under it
const STEM_UP = 1
const STEM_DOWN = -1

const pitch = (id: string, step: NotePitch['step'], octave: number, extra: Partial<NotePitch> = {}): NotePitch =>
  ({ id, step, alter: 0, octave, ...extra })

/** One measure of single-note chords, one per (beat, voice) pair given. */
const measureOf = (chords: { notes: NotePitch[]; voice?: 0 | 1 | 2 | 3; beat?: number }[]): Measure => ({
  id: 'm1',
  number: 1,
  timeSignature: { numerator: 4, denominator: 4 },
  tuplets: [],
  slots: chords.map((c, i): Chord => ({
    id: `c${i}`,
    type: 'chord',
    beat: c.beat === undefined ? ZERO : frac(c.beat, 1),
    duration: 'q',
    measure: 1,
    notes: c.notes,
    ...(c.voice === undefined ? {} : { voice: c.voice }),
  })),
})

describe('tieSide — away from the stems (Gould p. 64)', () => {
  it('⭐ both stems UP → the tie bows DOWN, into the free side', () => {
    const p = pitch('n1', 'G', 4)
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'treble', [STEM_UP, STEM_UP])).toBe(DOWN)
  })

  it('⭐ both stems DOWN → the tie bows UP, the same rule mirrored', () => {
    const p = pitch('n1', 'C', 5)
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'treble', [STEM_DOWN, STEM_DOWN])).toBe(UP)
  })

  it('⭐⭐ a BEAM-FORCED stem beats the note\'s staff position — the old rule could not see this', () => {
    // G4 sits below treble's middle line, so on pitch alone the tie went DOWN. Beam the note into a
    // stems-down group and DOWN is where its own stem now hangs. Nothing about the pitch changed;
    // everything about the free side did.
    const p = pitch('n1', 'G', 4)
    const m = measureOf([{ notes: [p] }])
    expect(tieSide(p, ZERO, m, 'treble', [STEM_DOWN, STEM_DOWN])).toBe(UP)
    expect(tieSide(p, ZERO, m, 'treble', [])).toBe(DOWN) // …and with no stem to read, the old answer
  })

  it('⭐ reads BOTH ends: opposite stems fall through to the middle-line rule (p. 64)', () => {
    // "Ties curve away from the middle stave-line" is stated for exactly this case, and it is the
    // one a single-ended rule cannot even ask. C5 is above treble's middle line → UP.
    const p = pitch('n1', 'C', 5)
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'treble', [STEM_UP, STEM_DOWN])).toBe(UP)
    // …and the same disagreement below the line goes the other way.
    const low = pitch('n2', 'D', 4)
    expect(tieSide(low, ZERO, measureOf([{ notes: [low] }]), 'treble', [STEM_DOWN, STEM_UP])).toBe(DOWN)
  })

  it('one stem (a PENDING tie has only its own end) is enough to answer', () => {
    const p = pitch('n1', 'G', 4)
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'treble', [STEM_DOWN])).toBe(UP)
  })
})

describe('tieSide — the middle line belongs to THE CLEF', () => {
  it('🚨 THE BUG: G3 on a BASS staff is ABOVE its middle line, so its tie bows UP', () => {
    // The old rule compared every note to treble's B4 (diatonic 34). G3 is 25 — below 34, so it
    // curved DOWN — but bass's middle line is D3 (22), and above that line the stem hangs down and
    // DOWN is the one side that is not free. Every note from D3 to A4 on a bass staff was wrong.
    const p = pitch('n1', 'G', 3)
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'bass', [])).toBe(UP)
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'treble', [])).toBe(DOWN)
  })

  it('alto and tenor each get their own line, not a shared default', () => {
    const p = pitch('n1', 'C', 4)  // diatonic 28 — alto's middle line exactly, one above tenor's 26
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'alto', [])).toBe(UP)
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'tenor', [])).toBe(UP)
    const low = pitch('n2', 'A', 3) // 26 — tenor's line, below alto's
    expect(tieSide(low, ZERO, measureOf([{ notes: [low] }]), 'alto', [])).toBe(DOWN)
    expect(tieSide(low, ZERO, measureOf([{ notes: [low] }]), 'tenor', [])).toBe(UP)
  })
})

describe('tieSide — the rules that outrank the stems', () => {
  it('an explicit flip (`x`) wins over everything, stems included', () => {
    const p = pitch('n1', 'G', 4, { tieDirection: UP })
    expect(tieSide(p, ZERO, measureOf([{ notes: [p] }]), 'treble', [STEM_UP, STEM_UP])).toBe(UP)
  })

  it('⭐ a MULTI-VOICE bar takes the voice\'s outer side, whatever the stems say', () => {
    // Both voices are beamed stems-up here; the rule still spreads them apart, because two ties
    // meeting in the middle of a bar is the failure it exists to prevent.
    const v1 = pitch('a', 'G', 4)
    const v2 = pitch('b', 'D', 4)
    const m = measureOf([{ notes: [v1], voice: 0 }, { notes: [v2], voice: 1 }])
    expect(tieSide(v1, ZERO, m, 'treble', [STEM_UP, STEM_UP])).toBe(UP)
    expect(tieSide(v2, ZERO, m, 'treble', [STEM_UP, STEM_UP])).toBe(DOWN)
  })

  it('⭐ inside a CHORD the tie goes outward — one stem cannot answer for several pitches', () => {
    const low = pitch('a', 'C', 4)
    const mid = pitch('b', 'E', 4)
    const top = pitch('c', 'G', 4)
    const m = measureOf([{ notes: [low, mid, top] }])
    expect(tieSide(top, ZERO, m, 'treble', [STEM_UP, STEM_UP])).toBe(UP)
    expect(tieSide(low, ZERO, m, 'treble', [STEM_UP, STEM_UP])).toBe(DOWN)
    // A middle pitch follows its nearer outer neighbour (E4 is a third from each, tie broken upward).
    expect(tieSide(mid, ZERO, m, 'treble', [STEM_UP, STEM_UP])).toBe(UP)
  })
})
