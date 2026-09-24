// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from '../PropertiesWidget'
import { bus } from '@/bus'
import type { CueSizeRequest } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'

/**
 * Subject: `./note` — the "cue size" checkbox (cue-size-plan P5, his ask 2026-09-24): on a note, a rest, a grace
 * and a bracketed grace; ticked when the report's note is cue; a change publishes on `bus.cueSize` and the
 * window never touches the engine.
 */
const inspected = (kind: 'note' | 'rest' | 'grace' | 'bracketed', cue?: true): InspectedElement[] => ([{
  kind,
  data: { id: 'n-1', step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, ...(kind === 'rest' && { isRest: true }), ...(cue && { cue }) },
  ...(kind === 'bracketed' && { derived: { side: 'before' } }),
} as unknown as InspectedElement])

describe('the cue size row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: CueSizeRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.cueSize.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    bus.inspection.set([])
  })

  const box = () => [...host.querySelectorAll('input[type="checkbox"]')]
    .find(i => i.parentElement?.textContent === 'cue size') as HTMLInputElement | undefined

  it('⭐ shows the note’s state, and a change publishes', () => {
    bus.inspection.set(inspected('note'))
    expect(box()!.checked).toBe(false)
    box()!.checked = true
    box()!.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ noteId: 'n-1', cue: true }])
    bus.inspection.set(inspected('note', true))
    expect(box()!.checked).toBe(true)
  })

  it('⭐ offered on a rest, a grace and a bracketed grace too', () => {
    for (const kind of ['rest', 'grace', 'bracketed'] as const) {
      bus.inspection.set(inspected(kind))
      expect(box(), kind).toBeDefined()
    }
  })
})
