// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from '../PropertiesWidget'
import { bus } from '@/bus'
import type { BeamOffsetRequest } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'

/**
 * Subject: the BEAM's panel, driven through the mounted `PropertiesWidget` (his ask, 2026-09-28): the whole beam's
 * offset and each end's, in staff spaces away from the heads, each publishing only its own request.
 */
const beamElement = (offset?: { start: number; end: number }): InspectedElement[] => ([{
  kind: 'beamGroup',
  data: { noteId: 'n1', note: undefined },
  overrides: offset ? [{ kind: 'beamOffset', ...offset }] : undefined,
} as unknown as InspectedElement])

describe('the beam rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: BeamOffsetRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.beamOffset.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (offset?: { start: number; end: number }) => {
    bus.inspection.set(beamElement(offset))
    return [...host.querySelectorAll('input')] as HTMLInputElement[]
  }

  it('three boxes — offset (the MIDDLE of the two ends), start, end — reading the stored override', () => {
    const [middle, start, end] = show({ start: 1, end: 2 })
    expect([middle.value, start.value, end.value]).toEqual(['1.5', '1', '2'])
    const [m0, s0, e0] = show()
    expect([m0.value, s0.value, e0.value]).toEqual(['0', '0', '0'])
  })

  it('⭐ each box publishes ONLY its own request', () => {
    const [middle, start, end] = show({ start: 1, end: 2 })
    for (const [input, value] of [[middle, '2'], [start, '0.5'], [end, '3']] as const) {
      input.value = value
      input.dispatchEvent(new Event('change'))
    }
    expect(published).toEqual([
      { anchorNoteId: 'n1', middle: 2 },
      { anchorNoteId: 'n1', start: 0.5 },
      { anchorNoteId: 'n1', end: 3 },
    ])
  })
})
