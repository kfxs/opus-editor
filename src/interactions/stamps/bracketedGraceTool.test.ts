import { describe, it, expect, vi } from 'vitest'
import { bracketedToolLit, pressBracketedTool } from './bracketedGraceTool'
import { createEditorState } from '../state/EditorState'
import type { SpanToolHost } from './spanToolPress'

/** Subject: `./bracketedGraceTool` — the `bracket.` button's press and light (bracketed-grace-plan P2). */
function host() {
  const state = createEditorState()
  const h: SpanToolHost = {
    state,
    getEngine: () => null,
    arm: vi.fn(tool => { state.selectedMarkingTool = tool }),
    disarm: vi.fn(() => { state.selectedMarkingTool = null }),
    disarmToEntry: vi.fn(() => { state.selectedMarkingTool = null }),
    render: vi.fn(),
  }
  return h
}

describe('pressBracketedTool', () => {
  it('a press ARMS the stamp and lights the button; ⭐ a stale accidental is cleared first', () => {
    const h = host()
    h.state.selectedAccidental = '#'
    pressBracketedTool(h, 'before')
    expect(h.state.selectedMarkingTool).toEqual({ kind: 'bracketedGrace', side: 'before' })
    expect(h.state.selectedAccidental).toBeNull()
    expect(bracketedToolLit(h.state, 'before')).toBe(true)
  })

  it('a re-press DISARMS it back to note entry — ⛔ not selection', () => {
    const h = host()
    pressBracketedTool(h, 'before')
    pressBracketedTool(h, 'before')
    expect(h.disarmToEntry).toHaveBeenCalledTimes(1)
    expect(h.disarm).not.toHaveBeenCalled()
    expect(bracketedToolLit(h.state, 'before')).toBe(false)
  })

  it('an accidental armed WITH the stamp is kept on a re-arm of another side — it is a choice made for it', () => {
    const h = host()
    pressBracketedTool(h, 'before')
    h.state.selectedAccidental = 'b'
    pressBracketedTool(h, 'after')
    expect(h.state.selectedAccidental).toBe('b')
  })
})
