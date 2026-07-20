// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { ChoiceList, NumberInput, Select } from './widgets'

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

/**
 * The two spinners beside "Other:" in the Time Signature window are written from OUTSIDE every time
 * a preset is picked, so that 7/8 is reached by clicking 6/8 and adding one. Both halves of that
 * matter: the write LANDS, and it stays SILENT — a write that called back would re-enter the
 * "you are editing Other" handler and drag the dot off the preset that was just clicked.
 */
describe('setValue', () => {
  const mount = (widget: NumberInput | Select) => {
    const host = document.createElement('div')
    widget.mount(host)
    return widget
  }

  it('writes a number field without reporting the write as an edit', () => {
    const onInput = vi.fn()
    const input = mount(new NumberInput({ value: 4, onInput })) as NumberInput
    input.setValue(6)
    expect(input.value).toBe(6)
    expect(onInput).not.toHaveBeenCalled()
  })

  it('writes a drop-down without reporting the write as a change', () => {
    const onChange = vi.fn()
    const select = mount(
      new Select([{ value: '4', label: '4' }, { value: '8', label: '8' }], { selected: '4', onChange }),
    ) as Select
    select.setValue('8')
    expect(select.value).toBe('8')
    expect(onChange).not.toHaveBeenCalled()
  })

  // A `<select>` handed a value it has no row for goes BLANK — the control would then report '' for
  // a denominator, which is not an answer. Ignoring the write keeps the last real one standing.
  it('ignores a drop-down value that is not on the list', () => {
    const select = mount(new Select([{ value: '4', label: '4' }], { selected: '4' })) as Select
    select.setValue('5')
    expect(select.value).toBe('4')
  })
})
