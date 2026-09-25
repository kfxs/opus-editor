import { describe, it, expect, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import { buildClipboardFromSelection } from './clipboard'
import { glissandiInWindow } from './glissandoClip'
import { getMeasureNotes } from '../../utils/musicUtils'
import { fracCreate as frac } from '../../utils/fraction'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./glissandoClip` — a copied passage carries the glissandi of the notes it copies, and a paste puts
 * them back on the pasted notes, with their side / end / direction (docs/plans/glissando-plan.md; his call,
 * 2026-09-25: *"of course yes"*).
 */
describe('glissandi travel with their notes', () => {
  const setup = () => {
    const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    const ids = (['C', 'G', 'E', 'A'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    return { engine, ids }
  }

  it('⭐ copied with its ANCHOR — and pasted back on the note now standing there, with its free end', () => {
    const { engine, ids } = setup()
    engine.glissando.add([ids[0], ids[2]])
    const second = engine.getScore().glissandi![1]
    second.end = 'none'
    second.direction = 'up'
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.glissandi).toHaveLength(2)
    engine.pasteEvents(payload, { measure: 2, beat: frac(0, 1), voice: 0 })
    const bar2 = new Set(getMeasureNotes(engine.getScore().measures[1], engine.getScore()).map(n => n.id))
    const pasted = (engine.getScore().glissandi ?? []).filter(g => bar2.has(g.noteId))
    expect(pasted).toHaveLength(2)
    expect(pasted.some(g => g.end === 'none' && g.direction === 'up')).toBe(true)
  })

  it('a glissando whose anchor is OUTSIDE the window does not travel', () => {
    const { engine, ids } = setup()
    engine.glissando.add([ids[0]])
    expect(glissandiInWindow(engine.getScore(), 0, 0, frac(1, 1), frac(4, 1))).toEqual([])
  })
})
