// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from '../PropertiesWidget'
import { bus } from '@/bus'
import type { TupletEditRequest } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'

/**
 * Subject: this kind's PANEL, driven through the mounted `PropertiesWidget` — the Tuplet window's *Format* box
 * for a tuplet that already stands (his ask, 2026-09-25). Three selects, each publishing only its own field.
 */
const tupletElement = (fields: Record<string, unknown> = {}): InspectedElement[] => ([{
  kind: 'tuplet',
  data: { id: 'T1', startBeat: { num: 0, den: 1 }, baseDuration: '8', numNotes: 3, notesOccupied: 2, ...fields },
} as unknown as InspectedElement])

describe('the tuplet format rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: TupletEditRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.tupletEdit.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (fields?: Record<string, unknown>) => {
    bus.inspection.set(tupletElement(fields))
    return [...host.querySelectorAll('select')] as HTMLSelectElement[]
  }
  const pick = (select: HTMLSelectElement, value: string) => {
    select.value = value
    select.dispatchEvent(new Event('change'))
  }

  it('⭐ offers THREE choices — the number, the bracket, the bracket end — and shows the stored ones', () => {
    const [number, bracket, end] = show({ bracket: 'never', bracketEnd: 'division' })
    expect(number.value, 'no style stored = auto').toBe('auto')
    expect(bracket.value).toBe('never')
    expect(end.value).toBe('division')
  })

  it('a tuplet with no format at all shows auto · auto · last note', () => {
    expect(show().map(s => s.value)).toEqual(['auto', 'auto', 'lastNote'])
  })

  it('⭐ each select publishes ITS field alone, naming the tuplet', () => {
    const [number, bracket, end] = show()
    pick(bracket, 'always')
    pick(number, 'ratio')
    pick(end, 'beforeNext')
    expect(published).toEqual([
      { tupletId: 'T1', bracket: 'always' },
      { tupletId: 'T1', numberStyle: 'ratio' },
      { tupletId: 'T1', bracketEnd: 'beforeNext' },
    ])
  })

  it('⛔ a stale selection (`missing`) gets no control', () => {
    bus.inspection.set([{ kind: 'tuplet', data: { id: 'gone', missing: true } } as unknown as InspectedElement])
    expect(host.querySelectorAll('select')).toHaveLength(0)
  })
})
