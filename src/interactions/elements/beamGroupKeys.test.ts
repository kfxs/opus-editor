/** Subject: `./beamGroupKeys` — the arrows on a selected beam: the whole beam, or a PICKED end (2026-09-28). */
import { describe, expect, it, vi } from 'vitest'
import { BEAM_GROUP_KEYS } from './beamGroupKeys'

function ctx() {
  const beam = { nudgeBeam: vi.fn(() => true), nudgeBeamEnd: vi.fn(() => true), resetBeamOffset: vi.fn(() => false) }
  return { beam, keys: { engine: { beam }, render: vi.fn() } as never }
}

describe('BEAM_GROUP_KEYS', () => {
  it('no end picked: ↑/↓ move the WHOLE beam', () => {
    const { beam, keys } = ctx()
    expect(BEAM_GROUP_KEYS.nudge!(keys, { kind: 'beamGroup', noteId: 'n1' }, 0, -1)).toBe(true)
    expect(beam.nudgeBeam).toHaveBeenCalledWith('n1', -1)
    expect(beam.nudgeBeamEnd).not.toHaveBeenCalled()
  })

  it('⭐ a PICKED square: ↑/↓ move that END only — the angle (his ask)', () => {
    const { beam, keys } = ctx()
    BEAM_GROUP_KEYS.nudge!(keys, { kind: 'beamGroup', noteId: 'n1', endpoint: 'start' }, 0, 0.25)
    expect(beam.nudgeBeamEnd).toHaveBeenCalledWith('n1', 'start', 0.25)
    expect(beam.nudgeBeam).not.toHaveBeenCalled()
  })

  it('a horizontal press declines; reset declines when nothing was moved', () => {
    const { keys } = ctx()
    expect(BEAM_GROUP_KEYS.nudge!(keys, { kind: 'beamGroup', noteId: 'n1' }, 1, 0)).toBe(false)
    expect(BEAM_GROUP_KEYS.reset!(keys, { kind: 'beamGroup', noteId: 'n1' })).toBe(false)
  })
})

describe('BEAM_GROUP_KEYS.cycle — Tab walks the two ends (his ask, 2026-09-28: like the slur)', () => {
  function tabCtx(squaresDrawn = true) {
    const state = { selectedElement: null as unknown }
    const render = vi.fn()
    const registry = { getByType: () => (squaresDrawn ? [{ noteId: 'n1' }, { noteId: 'n1' }] : []) }
    return { state, render, keys: { engine: { getElementRegistry: () => registry }, state, render } as never }
  }

  it('⭐ none picked: Tab picks the START, Shift+Tab the END; then they wrap', () => {
    const { state, keys } = tabCtx()
    expect(BEAM_GROUP_KEYS.cycle!(keys, { kind: 'beamGroup', noteId: 'n1' }, 1)).toBe(true)
    expect(state.selectedElement).toEqual({ kind: 'beamGroup', noteId: 'n1', endpoint: 'start' })
    BEAM_GROUP_KEYS.cycle!(keys, { kind: 'beamGroup', noteId: 'n1', endpoint: 'start' }, 1)
    expect(state.selectedElement).toEqual({ kind: 'beamGroup', noteId: 'n1', endpoint: 'end' })
    BEAM_GROUP_KEYS.cycle!(keys, { kind: 'beamGroup', noteId: 'n1', endpoint: 'end' }, 1)
    expect(state.selectedElement).toEqual({ kind: 'beamGroup', noteId: 'n1', endpoint: 'start' })
    BEAM_GROUP_KEYS.cycle!(keys, { kind: 'beamGroup', noteId: 'n1' }, -1)
    expect(state.selectedElement).toEqual({ kind: 'beamGroup', noteId: 'n1', endpoint: 'end' })
  })

  it('declines where the squares are not drawn', () => {
    const { state, keys } = tabCtx(false)
    expect(BEAM_GROUP_KEYS.cycle!(keys, { kind: 'beamGroup', noteId: 'n1' }, 1)).toBe(false)
    expect(state.selectedElement).toBeNull()
  })
})
