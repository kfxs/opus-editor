import { describe, it, expect, vi } from 'vitest'
import { silentBarCommands } from './silentBarCommands'
import { fakeCommandContext } from './fakeCommandContext'
import type { ChordRest, Rest } from '@/types/music'
import { fracCreate } from '@/utils/fraction'
import { makeEngine } from '@/testing/makeEngine'
import { ScoreModel } from '../models/ScoreModel'

vi.mock('../rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./silentBarCommands` — ONE undo entry per stamp, ⛔ none when nothing changed; and, through
 * the facade, that the stamped rest outlives the edits that collapse an ordinary voice
 * (docs/plans/voice-measure-rest-plan.md R4/R5).
 */
describe('silentBarCommands', () => {
  it('stamp: ONE entry; the same stamp again is no edit', () => {
    const ctx = fakeCommandContext()
    ctx.score.addMeasure()
    const cmds = silentBarCommands(ctx)
    expect(cmds.stamp(1, 0, 1)).toBeTruthy()
    expect(ctx.log).toEqual(['mutate:Full-bar rest (voice 2) at measure 1'])
    expect(cmds.at(1, 0, 1)).toBeTruthy()
    expect(cmds.stamp(1, 0, 1)).toBeNull()
    expect(ctx.undoEntries()).toBe(1)
  })

  describe('through the facade (`engine.silentBar`)', () => {
    const setup = () => {
      const engine = makeEngine()
      const a = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: fracCreate(0, 1) })!
      const b = engine.addNoteAtBeat({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: fracCreate(1, 1) })!
      const restId = engine.silentBar.stamp(1, 0, 1)!
      const v2 = () => engine.getScore().measures[0].slots.filter((s: ChordRest) => (s.voice ?? 0) === 1)
      return { engine, a, b, restId, v2 }
    }

    it('the flat note says so', () => {
      const { engine, restId } = setup()
      const n = engine.getNote(restId)!
      expect(n.isMeasureRest).toBe(true)
      expect(n.stamped).toBe(true)
      expect(n.voice).toBe(1)
    })

    it('deleting a voice-1 note leaves it standing', () => {
      const { engine, a, restId, v2 } = setup()
      engine.deleteNote(a.id)
      expect(v2().map(s => s.id)).toEqual([restId])
    })

    it('a voice-1 note turned into a rest leaves it standing', () => {
      const { engine, a, restId, v2 } = setup()
      engine.convertToRest(a.id)
      expect(v2().map(s => s.id)).toEqual([restId])
    })

    it('clearing voice-1 notes leaves it standing', () => {
      const { engine, a, b, restId, v2 } = setup()
      engine.deleteNotes([a.id, b.id])
      expect(v2().map(s => s.id)).toEqual([restId])
    })

    it('Delete on it: voice 2 leaves the bar', () => {
      const { engine, restId, v2 } = setup()
      engine.deleteNote(restId)
      expect(v2()).toHaveLength(0)
    })

    it('undo takes the stamp back, redo returns it', () => {
      const { engine, v2 } = setup()
      engine.undo()
      expect(v2()).toHaveLength(0)
      engine.redo()
      expect((v2()[0] as Rest).stamped).toBe(true)
    })

    it('export → import keeps it', () => {
      const { engine } = setup()
      const back = ScoreModel.fromJSON(engine.exportJSON())
      const v2 = back.getMeasure(1)!.slots.filter(s => (s.voice ?? 0) === 1)
      expect(v2).toHaveLength(1)
      expect((v2[0] as Rest).stamped).toBe(true)
    })

    it('the keyboard edit-in-place (a letter on the selected rest): it becomes the note, no flag left', () => {
      const { engine, restId, v2 } = setup()
      engine.updateNote(restId, { step: 'G', octave: 4, isRest: false, duration: 'q', dots: 0 })
      expect(v2().some(s => s.type === 'chord')).toBe(true)
      expect(v2().some(s => (s as Rest).stamped)).toBe(false)
    })

    it('a clear that covers it (box select + Delete): voice 2 leaves the bar', () => {
      const { engine, a, b, restId, v2 } = setup()
      engine.deleteNotes([a.id, b.id, restId])
      expect(v2()).toHaveLength(0)
    })

    it('a meter change with the barlines KEPT (`rewrite: none`): still stamped, at the new length', () => {
      const { engine, v2 } = setup()
      engine.setTimeSignature(1, { numerator: 3, denominator: 4 }, { rewrite: 'none' })
      expect(v2()).toHaveLength(1)
      const r = v2()[0] as Rest
      expect(r.stamped).toBe(true)
      expect(r.actualDuration).toEqual(fracCreate(3, 1))
    })

    it('the bar made a PICKUP: still stamped, at the pickup length', () => {
      const { engine, v2 } = setup()
      engine.setMeasureActualDuration(1, fracCreate(2, 1))
      const r = v2()[0] as Rest
      expect(r.stamped).toBe(true)
      expect(r.actualDuration).toEqual(fracCreate(2, 1))
    })

    it('a note typed into its lane replaces it; deleting that note collapses voice 2 (R4)', () => {
      const { engine, v2 } = setup()
      const n = engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1), voice: 1 })!
      expect(v2().some(s => s.type === 'rest' && s.stamped)).toBe(false)
      engine.deleteNote(n.id)
      expect(v2()).toHaveLength(0)
    })
  })
})
