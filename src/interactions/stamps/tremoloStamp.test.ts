import { describe, it, expect, vi } from 'vitest'
import { stampTremoloAtClick } from './tremoloStamp'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'

/**
 * Subject: `./tremoloStamp` — the tremolo stamp's click (moved out of `MouseController` unchanged,
 * 2026-09-23): a notehead OR its stem, a rest refused, the same mark again a no-op — each consuming the
 * click once the tool is armed.
 */
describe('stampTremoloAtClick', () => {
  const setup = (notes: Record<string, { isRest?: boolean; tremolo?: number }>) => {
    const registry = new ElementRegistry()
    registry.add({ type: 'note', id: 'N1', measure: 1, staff: 0, headX: 100, bbox: { x: 94, y: 95, width: 12, height: 10 } })
    registry.add({ type: 'stem', noteId: 'N1', measure: 1, staff: 0, bbox: { x: 105, y: 60, width: 2, height: 35 } })
    const setTremolo = vi.fn()
    const engine = {
      getNote: (id: string) => notes[id],
      setTremolo,
      runBatch: (_: string, fn: () => void) => { fn(); return true },
    } as unknown as MusicEngine
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'tremolo', tremolo: 3 }
    const render = vi.fn()
    const at = (x: number, y: number) => stampTremoloAtClick(state, engine, registry, x, y, render)
    return { at, setTremolo, render, state }
  }

  it('not armed: not its click', () => {
    const { at, state } = setup({ N1: {} })
    state.selectedMarkingTool = null
    expect(at(100, 100)).toBe(false)
  })

  it('⭐ on the HEAD or on the STEM, the armed mark goes on the note', () => {
    for (const [x, y] of [[100, 100], [106, 65]]) {
      const { at, setTremolo, render } = setup({ N1: {} })
      expect(at(x, y)).toBe(true)
      expect(setTremolo).toHaveBeenCalledWith('N1', 3)
      expect(render).toHaveBeenCalled()
    }
  })

  it('a rest, the same mark again, or empty paper: consumed, nothing written', () => {
    for (const note of [{ isRest: true }, { tremolo: 3 }]) {
      const { at, setTremolo } = setup({ N1: note })
      expect(at(100, 100)).toBe(true)
      expect(setTremolo).not.toHaveBeenCalled()
    }
    const { at, setTremolo } = setup({ N1: {} })
    expect(at(400, 300)).toBe(true)
    expect(setTremolo).not.toHaveBeenCalled()
  })
})
