// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { buildOtherDurationsPanel, OTHER_DURATIONS } from './otherDurationsPanel'
import { createObservableEditorState } from '../interactions/state/EditorState'
import type { NoteDuration } from '../types/music'

function mount() {
  const { state, subscribe } = createObservableEditorState()
  const setDuration = vi.fn((d: NoteDuration) => { state.selectedDuration = d })
  const panel = buildOtherDurationsPanel({ state, onStateChange: subscribe, setDuration })
  const button = (d: NoteDuration) => panel.element.querySelector<HTMLButtonElement>(`button[data-duration="${d}"]`)!
  return { state, setDuration, panel, button }
}

describe('otherDurationsPanel — the six values the Duration group has no room for', () => {
  it('offers the longa, the breve and the 64th … 512th, longest first', () => {
    expect(OTHER_DURATIONS.map(o => o.duration)).toEqual(['longa', 'breve', '64', '128', '256', '512'])
    const { panel } = mount()
    expect(panel.element.querySelectorAll('button')).toHaveLength(6)
  })

  it('a press is exactly `setDuration` — the Duration group\'s own door', () => {
    const { setDuration, button } = mount()
    button('128').click()
    expect(setDuration).toHaveBeenCalledWith('128')
  })

  it('lights by `durationHighlight` — the chosen value, and nothing under an armed marking tool', () => {
    const { state, button } = mount()
    state.selectedTool = 'entry'
    state.selectedDuration = 'breve'
    expect(button('breve').className).toContain('bg-cyan-600')
    expect(button('64').className).not.toContain('bg-cyan-600')
    state.selectedMarkingTool = { kind: 'accidental', sign: '#' }
    expect(button('breve').className).not.toContain('bg-cyan-600')
  })

  it('labels a value with its metronome glyph — and the longa, which has none anywhere, with its name', () => {
    const { button } = mount()
    expect(button('64').textContent).toBe('')
    expect(button('longa').textContent).toBe('longa')
  })

  it('destroy stops listening and removes the group', () => {
    const { state, panel, button } = mount()
    const host = document.createElement('div')
    host.appendChild(panel.element)
    const b = button('256')
    panel.destroy()
    state.selectedDuration = '256'
    expect(b.className).not.toContain('bg-cyan-600')
    expect(host.children).toHaveLength(0)
  })
})
