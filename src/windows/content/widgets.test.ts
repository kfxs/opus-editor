// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { ChoiceList } from './widgets'

/**
 * `ChoiceList` is the "pick one picture" box behind the Clef window (and, in time, the key- and
 * time-signature ones). Its two jobs are worth pinning: which row is CHOSEN, and the double-click
 * that commits — the path that arms a clef without going near the OK button.
 */
describe('ChoiceList', () => {
  const CHOICES = [
    { value: 'treble', picture: '<svg></svg>' },
    { value: 'bass', picture: '<svg></svg>' },
  ]

  const mount = (opts = {}) => {
    const host = document.createElement('div')
    const list = new ChoiceList(CHOICES, opts)
    list.mount(host)
    // host ▸ the box ▸ one row per choice.
    const rows = [...(host.firstElementChild?.children ?? [])] as HTMLElement[]
    return { list, rows }
  }

  it('opens on the requested choice, not merely the first row', () => {
    const { list } = mount({ selected: 'bass' })
    expect(list.value).toBe('bass')
  })

  it('moves the choice on click, and reports it once', () => {
    const onChange = vi.fn()
    const { list, rows } = mount({ selected: 'treble', onChange })

    rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(list.value).toBe('bass')
    expect(onChange).toHaveBeenCalledWith('bass')

    // Re-clicking the chosen row is not a change: a picker has no "off".
    rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('commits the row that was double-clicked — not whatever was selected before it', () => {
    const onActivate = vi.fn()
    const { rows } = mount({ selected: 'treble', onActivate })

    // Straight to dblclick, with no preceding click applied: the row must still speak for itself,
    // or a fast double-click on an unselected row would commit the OLD choice.
    rows[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(onActivate).toHaveBeenCalledWith('bass')
  })
})
