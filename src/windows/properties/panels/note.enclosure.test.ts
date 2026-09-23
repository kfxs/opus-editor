// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from '../PropertiesWidget'
import { bus } from '@/bus'
import type { EnclosureSpanRequest } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'

/**
 * ⭐ A BRACKETED CHORD's one-pair switch (parenthesised-note-plan P5): shown only when the report says it may
 * be used (every head bracketed — his rule); the window publishes on `bus.enclosureSpan` and never touches the
 * engine.
 */
const note = (derived?: { enclosureSpan: 'chord' | null }): InspectedElement[] => ([{
  kind: 'note',
  data: { id: 'n-1', step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, enclosure: 'round' },
  ...(derived && { derived }),
} as unknown as InspectedElement])

describe('the chord brackets row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: EnclosureSpanRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.enclosureSpan.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    bus.inspection.set([])
  })

  const select = () => [...host.querySelectorAll('select')].find(s => s.parentElement?.textContent?.startsWith('brackets'))

  it('⭐ offered when every head is bracketed: each note by default, and a change publishes', () => {
    bus.inspection.set(note({ enclosureSpan: null }))
    expect(select()!.value).toBe('head')
    expect([...select()!.options].map(o => o.textContent)).toEqual(['each note', 'whole chord'])
    select()!.value = 'chord'
    select()!.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ pitchId: 'n-1', span: 'chord' }])
  })

  it('⛔ not offered when the report carries no switch (a head of the chord is bare, or a lone note)', () => {
    bus.inspection.set(note())
    expect(select()).toBeUndefined()
  })
})
