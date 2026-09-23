import { describe, it, expect, vi } from 'vitest'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

vi.mock('./rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('./audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./NoteEntryCoordinator` — `updateNote` handed a BRACKETED pitch (bracketed-grace-plan P2b):
 * ⛔ none of the bar's machinery sees it — a duration is what its HEAD is drawn as (B7), never counted.
 */
describe('NoteEntryCoordinator.updateNote — a bracketed pitch', () => {
  it('⭐ a duration key changes its HEAD, not the bar — one undo entry', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })!
    const made = engine.bracketed.add(note.id, 'before', { step: 'D', alter: 0, octave: 5 })!
    const bar = JSON.stringify(engine.getScore().measures[0].slots.map(s => [s.type, s.beat, s.duration]))
    engine.updateNote(made.pitches[0].id, { duration: 'h' })
    expect(made.duration).toBe('h')
    expect(JSON.stringify(engine.getScore().measures[0].slots.map(s => [s.type, s.beat, s.duration]))).toBe(bar)
    engine.undo()
    const chord = engine.getScore().measures[0].slots.find((s): s is Chord => s.type === 'chord')!
    expect(chord.bracketedBefore![0].duration).toBe('q')
  })

  it('⭐ a pitch (the arrows) re-spells it in place — the id stays', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })!
    const made = engine.bracketed.add(note.id, 'before', { step: 'D', alter: 0, octave: 5 })!
    const id = made.pitches[0].id
    engine.updateNote(id, { step: 'F', alter: 1, octave: 5 })
    expect(engine.getNote(id)).toMatchObject({ id, step: 'F', alter: 1, octave: 5 })
  })
})
