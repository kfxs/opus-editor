import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BeamOffsetController } from './BeamOffsetController'
import { bus } from '@/bus'
import type { MusicEngine } from '../../engine/MusicEngine'

/**
 * {@link BeamOffsetController} — the apply half of the Properties beam boxes (his ask, 2026-09-28). What it owns is
 * one conversion: the window writes an ABSOLUTE value, the beam commands take a RELATIVE step — which is what puts a
 * typed value behind the same band limit and stem floor as the arrows.
 */
describe('BeamOffsetController', () => {
  let controller: BeamOffsetController
  let render: ReturnType<typeof vi.fn<() => void>>
  const beam = {
    offsetOf: vi.fn(() => ({ start: 1, end: 3 })),
    shiftBeam: vi.fn(() => true),
    shiftBeamEnd: vi.fn(() => true),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    render = vi.fn<() => void>()
    controller = new BeamOffsetController(() => ({ beam }) as unknown as MusicEngine, render)
  })
  afterEach(() => { controller.destroy() })

  it('⭐ `middle`: both ends move by the difference from their current middle — the angle kept', () => {
    bus.beamOffset.set({ anchorNoteId: 'n1', middle: 2.5 }) // the middle of 1 and 3 is 2
    expect(beam.shiftBeam).toHaveBeenCalledWith('n1', 0.5)
    expect(render).toHaveBeenCalled()
  })

  it('⭐ `start` / `end`: ONE end, by the difference from what it is — the angle', () => {
    bus.beamOffset.set({ anchorNoteId: 'n1', start: 0 })
    expect(beam.shiftBeamEnd).toHaveBeenCalledWith('n1', 'start', -1)
    bus.beamOffset.set({ anchorNoteId: 'n1', end: 4 })
    expect(beam.shiftBeamEnd).toHaveBeenCalledWith('n1', 'end', 1)
  })

  it('a REFUSED step (band, floor) repaints nothing — the box comes back to the stored value', () => {
    beam.shiftBeamEnd.mockReturnValueOnce(false)
    bus.beamOffset.set({ anchorNoteId: 'n1', end: -9 })
    expect(render).not.toHaveBeenCalled()
  })
})
