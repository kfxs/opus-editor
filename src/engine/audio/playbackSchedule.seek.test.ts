import { describe, it, expect } from 'vitest'
import { playableFrom, type ScheduledNote } from './playbackSchedule'
import { DEFAULT_TEMPO, type TempoSegment } from '@/utils/tempoMap'
import { midiToSpelling, pitchToMidi } from '@/utils/pitchSpelling'

/**
 * PLAYING FROM A BAR — the origin shift, on its own.
 *
 * This exists because the bug it prevents was invisible: `seekToMeasure` set a field, `play()` never
 * read it, and every play began at bar 1 however the caller had seeked. Nothing failed, no test went
 * red, and the only symptom was a person saying *"I select bar 3 and it starts from the beginning"*.
 * `play()` cannot be unit-tested (it needs an AudioContext), so the decision it was missing lives
 * here instead.
 */

/** One tempo for the whole score: at 120qpm a quarter is half a second. */
const STEADY: TempoSegment[] = [{ startBeats: 0, qpm: DEFAULT_TEMPO, startSeconds: 0 }]

/** A quarter note per beat, `count` of them from beat 0. */
const quarters = (count: number): ScheduledNote[] =>
  Array.from({ length: count }, (_, i) => ({
    pitch: midiToSpelling(60 + i), startBeats: i, durationBeats: 1, velocity: 0.8,
  }))

describe('playableFrom', () => {
  it('from the top, plays everything at its own time', () => {
    const out = playableFrom(quarters(4), STEADY, 0)
    expect(out.map(n => pitchToMidi(n.pitch))).toEqual([60, 61, 62, 63])
    expect(out.map(n => n.atSeconds)).toEqual([0, 0.5, 1, 1.5])
  })

  it('⭐ from bar 3 (beat 8 of 4/4), drops what came before and re-zeroes the rest', () => {
    const out = playableFrom(quarters(12), STEADY, 8)
    expect(out.map(n => pitchToMidi(n.pitch)), 'the first eight beats are not this play').toEqual([68, 69, 70, 71])
    expect(out[0].atSeconds, 'and the bar we asked for sounds IMMEDIATELY').toBe(0)
    expect(out.map(n => n.atSeconds)).toEqual([0, 0.5, 1, 1.5])
  })

  it('sounds a note landing exactly on the start beat — floats must not eat the downbeat', () => {
    // A start built by summing bar capacities lands a hair off; the downbeat still belongs to us.
    const out = playableFrom(quarters(12), STEADY, 8 + 1e-9)
    expect(pitchToMidi(out[0].pitch)).toBe(68)
    expect(out[0].atSeconds).toBeCloseTo(0, 6)
  })

  it('⚠️ drops a note still SOUNDING across the start rather than re-striking it', () => {
    // A whole note attacked at beat 4 is still ringing at beat 8 — but its onset is in a bar we are
    // not playing, and putting an attack on beat 8 would invent one the score does not have.
    const held: ScheduledNote = { pitch: midiToSpelling(50), startBeats: 4, durationBeats: 8, velocity: 0.8 }
    const out = playableFrom([held, ...quarters(12)], STEADY, 8)
    expect(out.some(n => pitchToMidi(n.pitch) === 50)).toBe(false)
  })

  it('keeps a duration as the difference of two lookups, so it survives a tempo change', () => {
    // 120qpm until beat 10, then 60qpm: a quarter is 0.5s before and 1.0s after.
    const map: TempoSegment[] = [
      { startBeats: 0, qpm: 120, startSeconds: 0 },
      { startBeats: 10, qpm: 60, startSeconds: 5 },
    ]
    const straddling: ScheduledNote = { pitch: midiToSpelling(60), startBeats: 9, durationBeats: 2, velocity: 1 }
    const [note] = playableFrom([straddling], map, 8)
    // Onset: beat 9 is 4.5s in, we started at beat 8 = 4.0s → 0.5s from the top of this play.
    expect(note.atSeconds).toBeCloseTo(0.5, 6)
    // Length: one beat at 120 (0.5s) plus one at 60 (1.0s) — NOT two beats at either rate.
    expect(note.durationSeconds).toBeCloseTo(1.5, 6)
  })

  it('carries pitch and velocity through untouched', () => {
    const out = playableFrom(
      [{ pitch: midiToSpelling(72), startBeats: 4, durationBeats: 2, velocity: 0.42 }], STEADY, 4)
    expect(out).toEqual(
      [{ pitch: midiToSpelling(72), atSeconds: 0, durationSeconds: 1, velocity: 0.42 }])
  })

  it('a start past the end of the music plays nothing at all', () => {
    expect(playableFrom(quarters(4), STEADY, 99)).toEqual([])
  })
})
