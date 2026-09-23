// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from '../PropertiesWidget'
import { bus } from '@/bus'
import type { BracketedSideRequest } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'

/**
 * ⭐ THE BRACKETED GRACE'S before/after switch (bracketed-grace-plan P6, his proposal): a selected bracketed
 * grace shows it; the window publishes on `bus.bracketedSide` and never touches the engine.
 */
const bracketed = (side: 'before' | 'after', canBeAfter: boolean): InspectedElement[] => ([{
  kind: 'bracketed',
  data: { id: 'b-1', step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1 },
  derived: { side, canBeAfter },
} as unknown as InspectedElement])

describe('the bracketed side row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: BracketedSideRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.bracketedSide.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    bus.inspection.set([])
  })

  const select = () => [...host.querySelectorAll('select')].find(s => s.parentElement?.textContent?.startsWith('position'))!

  it('⭐ shows its side — in the simple words, left / right (his call) — and publishes a change', () => {
    bus.inspection.set(bracketed('before', true))
    expect(select().value).toBe('before')
    expect([...select().options].map(o => o.textContent)).toEqual(['left', 'right'])
    select().value = 'after'
    select().dispatchEvent(new Event('change'))
    expect(published).toEqual([{ pitchId: 'b-1', side: 'after' }])
  })

  it('⛔ AFTER is disabled where the target has no after side (a grace, a rest)', () => {
    bus.inspection.set(bracketed('before', false))
    expect([...select().options].find(o => o.value === 'after')!.disabled).toBe(true)
  })
})
