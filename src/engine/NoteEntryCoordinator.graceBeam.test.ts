import { describe, it, expect, vi } from 'vitest'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'

vi.mock('./rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('./audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./NoteEntryCoordinator` — `updateNote(graceId, { beam })`, the path the beam keys take
 * (`PaletteController.setBeam`): it writes the GRACE's beam, one undo entry, ⛔ never its main note's.
 */
describe('NoteEntryCoordinator.updateNote — a grace\'s beam', () => {
  it('⭐ the beam key lands on the grace; the main note is untouched; undo takes it back', () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1) })!
    const g = engine.grace.addGrace(note.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    engine.updateNote(g.pitches[0].id, { beam: 'single' })
    expect(g.beam).toBe('single')
    expect(engine.getNote(note.id)?.beam).toBeUndefined()
    engine.undo()
    const chord = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    expect(chord.type === 'chord' && 'beam' in chord.graceBefore!.notes[0]).toBe(false)
  })
})
