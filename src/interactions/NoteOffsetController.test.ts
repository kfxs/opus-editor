import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NoteOffsetController } from './NoteOffsetController'
import { bus } from '@/bus'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * The controller is the one place the Properties note-offset input reaches the engine: it turns the
 * absolute value the window publishes into the facade's relative nudge, and repaints. The engine is
 * a stub — what is under test is the absolute→relative arithmetic and the wiring, not the facade.
 */
describe('NoteOffsetController', () => {
  let offsets: Record<string, number>
  let nudges: { id: string; dx: number }[]
  let renders: number
  let controller: NoteOffsetController

  const engine = () =>
    ({
      getNoteOffset: (id: string) => offsets[id] ?? 0,
      nudgeNoteOffset: (id: string, dx: number) => { nudges.push({ id, dx }); offsets[id] = (offsets[id] ?? 0) + dx; return true },
    }) as unknown as MusicEngine

  beforeEach(() => {
    offsets = {}
    nudges = []
    renders = 0
    controller = new NoteOffsetController(() => engine(), () => { renders++ })
  })

  // The channel is a module singleton, so an undisposed controller would keep firing into the next
  // test. Dispose after each (idempotent — the destroy test also disposes mid-run).
  afterEach(() => controller.destroy())

  it('turns an absolute value into the delta from the current offset', () => {
    offsets['n1'] = 1
    bus.noteOffset.set('n1', 2.5)
    expect(nudges).toEqual([{ id: 'n1', dx: 1.5 }])
    expect(renders).toBe(1)
  })

  it('is a no-op when the value is unchanged (no empty nudge, no repaint)', () => {
    offsets['n1'] = 0.75
    bus.noteOffset.set('n1', 0.75)
    expect(nudges).toEqual([])
    expect(renders).toBe(0)
  })

  it('a negative target walks the offset back the other way', () => {
    offsets['n1'] = 0.5
    bus.noteOffset.set('n1', -0.5)
    expect(nudges).toEqual([{ id: 'n1', dx: -1 }])
  })

  it('stops applying once destroyed', () => {
    controller.destroy()
    bus.noteOffset.set('n1', 3)
    expect(nudges).toEqual([])
    expect(renders).toBe(0)
  })
})
