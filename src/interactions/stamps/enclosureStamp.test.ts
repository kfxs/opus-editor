import { describe, it, expect, vi } from 'vitest'
import { stampEnclosureAtClick } from './enclosureStamp'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'

/**
 * Subject: `./enclosureStamp` — the brackets stamp's click (parenthesised-note-plan P4b): a head gets the
 * armed brackets; ⛔ one already in them is left as it is (his word: a sharp on a sharp); a rest, a
 * bracketed grace or empty paper consume the click and write nothing.
 */
describe('stampEnclosureAtClick', () => {
  const setup = (note: { isRest?: boolean; enclosure?: 'round' } | undefined, bracketedGrace = false) => {
    const registry = new ElementRegistry()
    registry.add({ type: 'note', id: 'N1', measure: 1, staff: 0, headX: 100, bbox: { x: 94, y: 95, width: 12, height: 10 } })
    const set = vi.fn()
    const engine = {
      getNote: () => note,
      enclosure: { set },
      bracketed: { isBracketed: () => bracketedGrace },
    } as unknown as MusicEngine
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'headEnclosure', shape: 'round' }
    const render = vi.fn()
    return { at: (x: number, y: number) => stampEnclosureAtClick(state, engine, registry, x, y, render), set, render, state }
  }

  it('not armed: not its click', () => {
    const { at, state } = setup({})
    state.selectedMarkingTool = null
    expect(at(100, 100)).toBe(false)
  })

  it('⭐ a click on a head brackets it — one call, then a render', () => {
    const { at, set, render } = setup({})
    expect(at(100, 100)).toBe(true)
    expect(set).toHaveBeenCalledWith(['N1'], 'round')
    expect(render).toHaveBeenCalled()
  })

  it('⛔ a head already in brackets is left as it is — ADDITIVE ONLY', () => {
    const { at, set } = setup({ enclosure: 'round' })
    expect(at(100, 100)).toBe(true)
    expect(set).not.toHaveBeenCalled()
  })

  it('a rest, a bracketed grace, empty paper: consumed, nothing written', () => {
    for (const [note, bracketed] of [[{ isRest: true }, false], [{}, true]] as const) {
      const { at, set } = setup(note, bracketed)
      expect(at(100, 100)).toBe(true)
      expect(set).not.toHaveBeenCalled()
    }
    const { at, set } = setup({})
    expect(at(400, 300)).toBe(true)
    expect(set).not.toHaveBeenCalled()
  })
})
