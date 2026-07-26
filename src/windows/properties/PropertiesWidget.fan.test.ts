// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { selectionInspection } from '../../interactions/selectionInspection'
import { fanEditSelection, type FanEditRequest } from '../../interactions/fanEditSelection'
import type { SelectedElement } from '../../interactions/selectionSnapshot'
import type { FanMark } from '../../types/music'

/**
 * ⭐ THE FAN ROW'S 1-BASED SEAM (docs/fan-ramp-range-plan.md P2). The window shows "note 1" for the
 * note he typed, because that is how a musician counts a group; the model and the seam stay 0-based
 * like everything else in the editor, and the conversion happens here and nowhere deeper.
 *
 * Worth its own spec because an off-by-one across this boundary is SILENT: the wedge simply starts
 * on the wrong note, and there is nothing to throw.
 */
const FAN: FanMark = { direction: 'accel', count: 6, beams: 3 }

const noteElement = (fan: FanMark): SelectedElement[] => ([{
  kind: 'note',
  data: { id: 'note-1', step: 'C', octave: 4, duration: 'h', fan },
} as unknown as SelectedElement])

describe('the fan row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: FanEditRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = fanEditSelection.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    // The channel de-dups on the serialized snapshot, so the next test must not look like this one.
    selectionInspection.set([])
  })

  /**
   * The FAN row's four number inputs, in order: notes, beams, from, to.
   *
   * ⚠️ Found by its own label, not by index into the panel: the note-offset control is a number
   * input too and it is painted first, so `querySelectorAll` over the body counts it as well.
   */
  const inputs = (fan: FanMark): HTMLInputElement[] => {
    selectionInspection.set(noteElement(fan))
    const row = [...host.querySelectorAll('div')].find(d => d.firstChild?.textContent?.startsWith('fan ('))
    return [...(row?.querySelectorAll('input[type=number]') ?? [])] as HTMLInputElement[]
  }

  const type = (input: HTMLInputElement, value: string) => {
    input.value = value
    input.dispatchEvent(new Event('change'))
  }

  it('shows the count, the beams and the wedge’s two ends', () => {
    const [notes, beams, from, to] = inputs(FAN)
    expect([notes.value, beams.value]).toEqual(['6', '3'])
    // ⭐ 1-BASED: a fan with no range covers notes 1…6, not members 0…5.
    expect([from.value, to.value]).toEqual(['1', '6'])
  })

  it('⭐ reads an inset range through the same resolver the drawing uses, and shows it 1-based', () => {
    const [, , from, to] = inputs({ ...FAN, rampFrom: 1, rampTo: 3 })
    expect([from.value, to.value]).toEqual(['2', '4'])
  })

  it('⭐ publishes 0-BASED — the conversion stops at this widget', () => {
    const [, , from, to] = inputs(FAN)
    type(from, '2')
    type(to, '4')
    expect(published).toEqual([
      { noteId: 'note-1', rampFrom: 1 },
      { noteId: 'note-1', rampTo: 3 },
    ])
  })

  it('bounds the two ends by the member count, not by MAX_FAN_COUNT', () => {
    const [, , from, to] = inputs({ ...FAN, count: 4 })
    expect([from.min, from.max]).toEqual(['1', '4'])
    expect([to.min, to.max]).toEqual(['1', '4'])
  })

  it('a number that is not one puts the real value back rather than guessing', () => {
    const [, , from] = inputs({ ...FAN, rampFrom: 2 })
    type(from, 'banana')
    expect(from.value).toBe('3')
    expect(published).toEqual([])
  })

  it('publishes one end at a time — the other is left alone by the controller', () => {
    const [, , , to] = inputs({ ...FAN, rampFrom: 1, rampTo: 3 })
    type(to, '5')
    expect(published).toEqual([{ noteId: 'note-1', rampTo: 4 }])
  })

  it('no fan, no row — this changes a fan, it never makes one', () => {
    selectionInspection.set([{ kind: 'note', data: { id: 'note-1', step: 'C' } } as unknown as SelectedElement])
    // The offset input is always there; the fan's four are not.
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(1)
  })

  it('Enter commits by blurring, so a press is not counted twice', () => {
    const [, , from] = inputs(FAN)
    const blur = vi.spyOn(from, 'blur')
    from.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(blur).toHaveBeenCalled()
  })
})
