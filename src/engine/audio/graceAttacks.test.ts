import { describe, it, expect } from 'vitest'
import type { GraceGroup, NoteDuration } from '@/types/music'
import { graceTiming, isCompoundMeter } from './graceAttacks'

/** P3 — MuseScore's grace playback (`gracechordcontext.cpp`), in beats. */
const group = (durations: NoteDuration[], slash = false): GraceGroup => ({
  notes: durations.map((duration, i) => ({ pitches: [{ id: `g${i}`, step: 'D', alter: 0, octave: 5 }], duration })),
  ...(slash && { slash: true as const }),
})
const at = (g: GraceGroup, side: 'before' | 'after', mainBeats = 1, compound = false) =>
  graceTiming({ group: g, side, mainStartBeats: 10, mainBeats, compound })

describe('graceTiming — MuseScore\'s preset', () => {
  it('⭐ a single APPOGGIATURA plays its written value, on the beat — the main note starts after it', () => {
    const t = at(group(['16']), 'before') // a 16th = 0.25 of a quarter main note
    expect(t.graces).toEqual([{ startBeats: 10, durationBeats: 0.25 }])
    expect(t.mainDelayBeats).toBe(0.25)
    expect(t.mainTrimBeats).toBe(0.25)
  })

  it('…capped at HALF its main note — ⅔ in a compound meter when the main note is longer than an 8th', () => {
    expect(at(group(['h']), 'before').graces[0].durationBeats).toBe(0.5)
    expect(at(group(['h']), 'before', 1.5, true).graces[0].durationBeats).toBe(1)
    expect(at(group(['h']), 'before', 0.5, true).graces[0].durationBeats).toBe(0.25) // an 8th main: ½
  })

  it('⭐ an ACCIACCATURA is crushed: one 64th (1/16 beat) per grace, on the beat', () => {
    const t = at(group(['8'], true), 'before')
    expect(t.graces).toEqual([{ startBeats: 10, durationBeats: 1 / 16 }])
    expect(t.mainDelayBeats).toBe(1 / 16)
  })

  it('a GROUP before (slashed or not) shares n × 64th, each scaled by ONE factor from its written value', () => {
    const t = at(group(['8', '16']), 'before') // written 0.5 + 0.25, cap 2/16
    const [a, b] = t.graces
    expect(a.durationBeats + b.durationBeats).toBeCloseTo(2 / 16, 12)
    expect(a.durationBeats / b.durationBeats).toBeCloseTo(2, 12) // the written ratio survives
    expect(b.startBeats).toBeCloseTo(10 + a.durationBeats, 12)
  })

  it('never more than half the main note', () => {
    expect(at(group(['32', '32', '32', '32', '32', '32', '32', '32', '32', '32'], true), 'before', 0.5).mainTrimBeats).toBe(0.25)
  })

  it('⭐ graces AFTER take the END of the main note — it keeps its start', () => {
    const t = at(group(['16', '16']), 'after', 2)
    expect(t.mainDelayBeats).toBe(0)
    expect(t.mainTrimBeats).toBe(0.5)
    expect(t.graces[0].startBeats).toBe(11.5)
    expect(t.graces[1].startBeats + t.graces[1].durationBeats).toBe(12)
  })

  it('isCompoundMeter is MuseScore\'s: 6, 9, 12 — ⛔ not 3', () => {
    expect([3, 6, 9, 12, 4].map(n => isCompoundMeter({ numerator: n }))).toEqual([false, true, true, true, false])
  })
})
