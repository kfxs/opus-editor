// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from '../PropertiesWidget'
import { bus } from '@/bus'
import type { GlissandoEditRequest } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'

/**
 * Subject: the GLISSANDO panel, driven through the mounted `PropertiesWidget`. Side and goes-to always (goes-to
 * not for a line into the note); DIRECTION only when an end is free — his ask, 2026-09-25.
 */
const report = (glissando: Record<string, unknown>, targetNoteId: string | null): InspectedElement[] => ([{
  kind: 'glissandoLine',
  data: { glissando: { id: 'G1', noteId: 'N1', ...glissando }, anchor: undefined },
  derived: { targetNoteId },
} as unknown as InspectedElement])

describe('the glissando rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: GlissandoEditRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.glissandoEdit.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (glissando: Record<string, unknown>, target: string | null) => {
    bus.inspection.set(report(glissando, target))
    return [...host.querySelectorAll('select')] as HTMLSelectElement[]
  }

  it('to a note: side + goes-to, ⛔ no direction (nothing is free)', () => {
    const selects = show({}, 'N2')
    expect(selects.map(s => s.value)).toEqual(['after', 'next'])
  })

  it('⭐ a free end after the note: direction too, showing the usual one (down)', () => {
    const selects = show({ end: 'none' }, null)
    expect(selects.map(s => s.value)).toEqual(['after', 'none', 'down'])
  })

  it('⭐ into the note: side + direction (usual up), ⛔ no goes-to', () => {
    const selects = show({ side: 'before' }, null)
    expect(selects.map(s => s.value)).toEqual(['before', 'up'])
  })

  it('each control publishes only its own field', () => {
    const [side, , direction] = show({ end: 'none' }, null)
    direction.value = 'up'
    direction.dispatchEvent(new Event('change'))
    side.value = 'before'
    side.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ glissandoId: 'G1', direction: 'up' }, { glissandoId: 'G1', side: 'before' }])
  })

  it('⭐ the TEXT field: empty = none; a typed word is published on change', () => {
    show({}, 'N2')
    const input = host.querySelector('input[type="text"]') as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toBe('none')
    input.value = 'port.'
    input.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ glissandoId: 'G1', text: 'port.' }])
  })
})
