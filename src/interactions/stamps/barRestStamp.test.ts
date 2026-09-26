import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState } from '../state/EditorState'
import { stampBarRestAtClick } from './barRestStamp'

/**
 * Subject: `./barRestStamp` — the armed click (docs/plans/voice-measure-rest-plan.md P2): the bar
 * clicked, the staff under the pointer, the ACTIVE voice read at the click.
 */
describe('stampBarRestAtClick', () => {
  let state: EditorState
  const stamp = vi.fn((_m: number, _s: number, _v: number): string | null => 'r1')
  const staffIndexAtY = vi.fn((_m: number, _y: number) => 1)
  const engine = { silentBar: { stamp, at: () => null }, getElementRegistry: () => ({ staffIndexAtY }) } as never
  const render = vi.fn()
  beforeEach(() => {
    state = createEditorState()
    stamp.mockClear(); render.mockClear(); staffIndexAtY.mockClear()
  })

  it('not armed: not consumed, nothing written', () => {
    expect(stampBarRestAtClick(state, engine, 50, 2, render)).toBe(false)
    expect(stamp).not.toHaveBeenCalled()
  })

  it('armed: the bar, the staff under the pointer, the active voice (model = UI − 1)', () => {
    state.selectedMarkingTool = { kind: 'barRest' }
    state.activeVoice = 2
    expect(stampBarRestAtClick(state, engine, 50, 3, render)).toBe(true)
    expect(staffIndexAtY).toHaveBeenCalledWith(3, 50)
    expect(stamp).toHaveBeenCalledWith(3, 1, 1)
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('voice 1 too, and the voice is read at the CLICK', () => {
    state.selectedMarkingTool = { kind: 'barRest' }
    state.activeVoice = 1
    stampBarRestAtClick(state, engine, 50, 1, render)
    state.selectedMarkingTool = { kind: 'barRest' }
    state.activeVoice = 4
    stampBarRestAtClick(state, engine, 50, 1, render)
    expect(stamp.mock.calls.map(c => c[2])).toEqual([0, 3])
  })

  it('⭐ ONE click: then disarmed, back in selection mode (his call)', () => {
    state.selectedMarkingTool = { kind: 'barRest' }
    state.selectedTool = 'entry'
    stampBarRestAtClick(state, engine, 50, 1, render)
    expect(state.selectedMarkingTool).toBeNull()
    expect(state.selectedTool).toBe('selection')
  })
})
