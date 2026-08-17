// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { HairpinGeometryRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ THE WEDGE'S TWO ENDS AS NUMBERS (his ask, 2026-08-17) — the typed twin of the arrows that
 * reshape a hairpin.
 *
 * Subject: {@link PropertiesWidget}, a chapter beside `.slur.test.ts` and `.fan.test.ts`. The window's
 * half only: which rows appear and what they publish. The apply is `HairpinGeometryController`'s.
 *
 * ⛔ The claim worth pinning hardest is a NEGATIVE: the panel offers no box for the wedge's EXTENT.
 * How many notes it covers is musical and measured in notes; a staff-space input would be a second,
 * lossy way to say it, and the two could then disagree.
 */
const hairpinElement = (over: Partial<InspectedElement> = {}): InspectedElement[] => ([{
  kind: 'hairpin',
  data: { id: 'H1', type: 'cresc', beat: { num: 0, den: 1 }, length: { num: 2, den: 1 } },
  ...over,
} as unknown as InspectedElement])

describe('the hairpin end rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: HairpinGeometryRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.hairpinGeometry.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    bus.inspection.set([])
  })

  const row = (startsWith: string) => {
    const found = [...host.querySelectorAll('div')].find(d =>
      d.firstElementChild?.tagName === 'SPAN' && d.firstElementChild.textContent?.startsWith(startsWith))
    return {
      inputs: [...(found?.querySelectorAll('input[type=number]') ?? [])] as HTMLInputElement[],
      reset: found?.querySelector('button') as HTMLButtonElement | null,
    }
  }
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value
    input.dispatchEvent(new Event('change'))
  }

  it('paints one row per end, each an x/y pair', () => {
    bus.inspection.set(hairpinElement())
    expect(row('start').inputs).toHaveLength(2)
    expect(row('end').inputs).toHaveLength(2)
  })

  it('⛔ offers NO box for the extent — that quantity is measured in notes, not in spaces', () => {
    bus.inspection.set(hairpinElement())
    // Exactly the four reshape boxes, so a `length` input cannot creep in unnoticed.
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(4)
  })

  it('shows an authored reshape, read from the overrides compartment', () => {
    bus.inspection.set(hairpinElement({
      overrides: [{ kind: 'hairpinEndpointOffset', end: { x: 1.5, y: -1 } }] as unknown as InspectedElement['overrides'],
    }))
    expect(row('end').inputs.map(i => i.value)).toEqual(['1.5', '-1'])
    // The other end was never nudged, so it stays the engraver's — blank, not 0.
    expect(row('start').inputs.map(i => i.value)).toEqual(['', ''])
  })

  it('publishes one axis at a time, so a row is usable from the engraver\'s position', () => {
    bus.inspection.set(hairpinElement())
    const { inputs } = row('start')
    type(inputs[1], '-0.75')
    expect(published).toEqual([{ hairpinId: 'H1', which: 'start', value: { y: -0.75 } }])
  })

  it('reset publishes null — back to where the engraver put that end', () => {
    bus.inspection.set(hairpinElement({
      overrides: [{ kind: 'hairpinEndpointOffset', start: { x: 1, y: 1 } }] as unknown as InspectedElement['overrides'],
    }))
    row('start').reset!.click()
    expect(published).toEqual([{ hairpinId: 'H1', which: 'start', value: null }])
  })

  it('no hairpin, no rows', () => {
    bus.inspection.set([{ kind: 'note', data: { id: 'n1', step: 'C' } } as unknown as InspectedElement])
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(1) // the note offset's
  })
})
