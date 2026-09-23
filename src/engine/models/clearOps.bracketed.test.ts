import { describe, it, expect, vi } from 'vitest'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

vi.mock('../rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./clearOps` — Delete on a selection holding a BRACKETED grace (bracketed-grace-plan P2b): it
 * takes no time, so it goes IN PLACE and leaves no hole — ⛔ it never silences the note it stood before.
 */
describe('clearNoteRange — a bracketed grace in the selection', () => {
  it('⭐ Delete with ONLY the bracketed grace selected removes it and keeps its note', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })!
    const made = engine.bracketed.add(note.id, 'before', { step: 'D', alter: 0, octave: 5 })!
    expect(engine.deleteNotes([made.pitches[0].id])).toBe(1)
    const chord = engine.getScore().measures[0].slots.find((s): s is Chord => s.type === 'chord')!
    expect(chord.notes[0].id).toBe(note.id)
    expect('bracketedBefore' in chord).toBe(false)
    engine.undo()
    expect(engine.getScore().measures[0].slots.find((s): s is Chord => s.type === 'chord')!.bracketedBefore).toHaveLength(1)
  })
})
