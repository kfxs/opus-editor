import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate as frac } from '@/utils/fraction'
import { collectScheduledNotes } from './audio/playbackSchedule'
import { pitchToMidi } from './audio/equalTemperament'

/**
 * ⭐ K1 (docs/plans/alteration-signs-plan.md §4): the editor's accidental is ANY sign of the table, so
 * the DOUBLES go through the very command ♯ and ♭ always did — `setNoteAccidental` / the display
 * check — with no line naming them (rule 1). And they SOUND right (decision D): two semitones.
 */
vi.mock('./rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('./audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('MusicEngine — a double is an accidental like any other (K1)', () => {
  let engine: MusicEngine
  let id: string

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    id = engine.addNoteAtBeat({ step: 'F', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
  })

  it('⭐ sets a double sharp, then a double flat — the same command', () => {
    expect(engine.setNoteAccidental(id, 'doubleSharp')!.alteration).toEqual(['doubleSharp'])
    expect(engine.noteDisplaysAccidental(id, 'doubleSharp')).toBe(true)
    expect(engine.setNoteAccidental(id, 'doubleFlat')!.alteration).toEqual(['doubleFlat'])
    expect(engine.noteDisplaysAccidental(id, 'doubleSharp')).toBe(false)
  })

  it('⭐ sounds TWO semitones from the plain note, either way', () => {
    const key = () => pitchToMidi(collectScheduledNotes(engine.getScore(), undefined, () => 0.5)[0].pitch)
    const plain = key()
    engine.setNoteAccidental(id, 'doubleSharp')
    expect(key()).toBe(plain + 2)
    engine.setNoteAccidental(id, 'doubleFlat')
    expect(key()).toBe(plain - 2)
  })
})

/**
 * ⭐ K5 (his rule, 2026-10-10: `4` and `1` *"should behave like normal accidental"*): ♮♯ / ♮♭ go through the SAME
 * command as ♯ and ♭. The pitch stores the plain sign and `naturalBefore`; ♯ and ♮♯ are told apart by that alone.
 */
describe('MusicEngine — ♮♯ / ♮♭ are accidentals like any other (K5)', () => {
  let engine: MusicEngine
  let id: string

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    id = engine.addNoteAtBeat({ step: 'F', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
  })

  it('⭐ ♮♯ stores a SHARP and the natural before it; it shows as ♮♯, not as ♯', () => {
    const note = engine.setNoteAccidental(id, 'naturalSharp')!
    expect([note.alteration, note.naturalBefore]).toEqual([['sharp'], true])
    expect(engine.noteDisplaysAccidental(id, 'naturalSharp')).toBe(true)
    expect(engine.noteDisplaysAccidental(id, 'sharp')).toBe(false)
  })

  it('⭐ a ♯ pressed on a ♮♯ is a plain ♯ — the natural comes off', () => {
    engine.setNoteAccidental(id, 'naturalSharp')
    const note = engine.setNoteAccidental(id, 'sharp')!
    expect([note.alteration, note.naturalBefore]).toEqual([['sharp'], undefined])
  })

  it('⭐ ♮♭ the same, on the flat side; it SOUNDS as the flat', () => {
    const key = () => pitchToMidi(collectScheduledNotes(engine.getScore(), undefined, () => 0.5)[0].pitch)
    const plain = key()
    const note = engine.setNoteAccidental(id, 'naturalFlat')!
    expect([note.alteration, note.naturalBefore]).toEqual([['flat'], true])
    expect(key()).toBe(plain - 1)
  })

  it('⭐ entered ARMED, the note is born ♮♯', () => {
    const n = engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), alteration: ['sharp'], naturalBefore: true })!
    expect(engine.getNote(n.id)!.naturalBefore).toBe(true)
  })
})
