// @vitest-environment jsdom
/**
 * Subject: the user SYMBOL's panel (docs/plans/symbol-plan.md P4), driven through the mounted
 * `PropertiesWidget` — two offset boxes that show the stored override and publish BOTH axes on a commit.
 * The apply is `GlyphMarkController`'s.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from '../PropertiesWidget'
import { bus } from '@/bus'
import type { GlyphMarkOffsetRequest } from '@/bus'
import type { InspectedElement } from '@/interactions/state/inspectedElement'

const symbol = (overrides?: InspectedElement['overrides']): InspectedElement[] => ([{
  kind: 'glyphMark',
  data: { id: 'G1', glyph: 'fermataAbove', beat: { num: 0, den: 1 } },
  derived: { codepoint: 'U+E4C0' },
  ...(overrides ? { overrides } : {}),
} as unknown as InspectedElement])

describe('the symbol offset row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: GlyphMarkOffsetRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.glyphMarkOffset.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    bus.inspection.set([])
  })

  const show = (overrides?: InspectedElement['overrides']) => {
    bus.inspection.set(symbol(overrides))
    return [...host.querySelectorAll('input[type=number]')] as HTMLInputElement[]
  }

  it('shows the stored offset (0 when none) and publishes both axes on a commit', () => {
    expect(show().map(i => i.value)).toEqual(['0', '0'])
    const [x, y] = show([{ kind: 'glyphMarkOffset', x: 1, y: -0.5 } as never])
    expect([x.value, y.value]).toEqual(['1', '-0.5'])
    x.value = '2'
    x.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ id: 'G1', x: 2, y: -0.5 }])
  })
})
