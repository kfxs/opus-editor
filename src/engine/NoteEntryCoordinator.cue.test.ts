import { describe, it, expect, vi } from 'vitest'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

vi.mock('./rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('./audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./NoteEntryCoordinator` — NOTE ENTRY with cue ARMED (cue-size-plan, his rule: *"for note entry what is
 * important is what is armed on the pallette"*): a new note, a new rest, a pitch into an existing chord (the SLOT
 * is cue, as an armed tremolo marks it), and every piece of a note split across the barline.
 */
describe('NoteEntryCoordinator — entry with cue armed', () => {
  const put = (engine: ReturnType<typeof makeEngine>, beat: number, extra: object = {}) =>
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(beat, 1), ...extra })!

  it('⭐ a new note entered with cue armed is cue; one entered without is not', () => {
    const engine = makeEngine()
    const cue = put(engine, 0, { cue: true })
    const full = put(engine, 1)
    expect(engine.getNote(cue.id)!.cue).toBe(true)
    expect(engine.getNote(full.id)!.cue).toBeUndefined()
  })

  it('⭐ a REST entered with cue armed is a cue rest', () => {
    const engine = makeEngine()
    const rest = engine.addNoteAtBeat({ duration: 'q', measure: 1, beat: frac(1, 1), isRest: true, cue: true })!
    expect(engine.getNote(rest.id)!.cue).toBe(true)
  })

  it('⭐ a pitch entered into an EXISTING chord with cue armed makes the chord cue; ⛔ entered without, it stays as it was', () => {
    const engine = makeEngine()
    const root = put(engine, 0)
    // A pitch joins a chord by `addChordNote` (Shift+letter) — `addNoteAtBeat` on a taken beat overwrites.
    const chordNote = (step: 'E' | 'G', extra: object = {}) =>
      engine.addChordNote({ step, alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), ...extra })
    chordNote('E', { cue: true })
    expect(engine.getNote(root.id)!.cue).toBe(true)
    chordNote('G')
    expect(engine.getNote(root.id)!.cue, 'only a delete takes cue off').toBe(true)
  })

  it('⭐ a note entered ACROSS the barline with cue armed: every piece is cue', () => {
    const engine = makeEngine()
    engine.addMeasure()
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(3, 1), cue: true })
    const pieces = engine.getScore().measures.flatMap(m => m.slots).filter((s): s is Chord => s.type === 'chord')
    expect(pieces.length).toBe(2)
    expect(pieces.every(c => c.cue)).toBe(true)
  })
})
