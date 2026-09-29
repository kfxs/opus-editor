import { describe, it, expect, vi } from 'vitest'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

vi.mock('../rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./clearOps` — Delete on a selection holding a GRACE NOTE: it takes no time, so it goes IN
 * PLACE and leaves no hole. ⚠️ It used to be skipped outright — `findSlot` does not see a grace
 * without its opt-in — so Delete did nothing (his report, 2026-09-29).
 */
describe('clearNoteRange — a grace note in the selection', () => {
  it('⭐ Delete with ONLY the grace selected removes it and keeps its note', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })!
    const grace = engine.grace.addGrace(note.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'acciaccatura', { duration: '8' })!
    expect(engine.deleteNotes([grace.pitches[0].id])).toBe(1)
    const chord = engine.getScore().measures[0].slots.find((s): s is Chord => s.type === 'chord')!
    expect(chord.notes[0].id).toBe(note.id)
    expect(chord.graceBefore).toBeUndefined()
    engine.undo()
    expect(engine.getScore().measures[0].slots.find((s): s is Chord => s.type === 'chord')!.graceBefore?.notes).toHaveLength(1)
  })
})
