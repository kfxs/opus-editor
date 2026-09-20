// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from '../PropertiesWidget'
import { bus } from '@/bus'
import type { ClefOffsetRequest } from '@/bus'
import type { InspectedElement } from '@/interactions/inspectedElement'

/**
 * ⭐⭐ **AN INLINE CLEF'S HORIZONTAL OFFSET** — his ask, 2026-08-28: *"when the clef is not in the
 * beguining of a line (i mean a header clef) i want to be able to offset it horizontally either by
 * keys in the keyboard **or be the property**"*.
 *
 * Subject: this kind's PANEL, driven through the mounted `PropertiesWidget`; a chapter beside `dynamic.test.ts`. The window's half
 * only — which control appears and what it publishes; the apply is `ClefOffsetController`'s.
 *
 * ⭐ **The claim this file exists for is the ABSENT ROW.** A clef standing at the head of a system is
 * laid out by the header and cannot be nudged, and a control whose write is always refused is a
 * control that lies — so the row appears only when the engine says this clef was drawn as its own
 * glyph (`offsettable`, a fact about the last RENDER, not about the score).
 */
const clefElement = (data: Record<string, unknown>): InspectedElement[] => ([{
  kind: 'clef',
  data: { measure: 2, beat: 0.5, staff: 0, offset: 0, offsettable: true, ...data },
} as unknown as InspectedElement])

describe('the clef offset row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: ClefOffsetRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.clefOffset.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (data: Record<string, unknown> = {}) => {
    bus.inspection.set(clefElement(data))
    return [...host.querySelectorAll('input[type=number]')] as HTMLInputElement[]
  }

  it('offers ONE box — a clef moves sideways only', () => {
    // ⚠️ Not two: a clef's vertical position is the staff it is on, which is content, not engraving.
    expect(show()).toHaveLength(1)
  })

  it('shows the stored offset, and 0 when there is none', () => {
    expect(show().map(i => i.value)).toEqual(['0'])
    expect(show({ offset: -1.25 }).map(i => i.value)).toEqual(['-1.25'])
  })

  it('publishes the clef’s POSITION, not an id — that is what a clef selection carries', () => {
    const [x] = show({ measure: 4, beat: 1.5, staff: 1 })
    x.value = '0.75'
    x.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ measure: 4, beat: 1.5, staff: 1, x: 0.75 }])
  })

  it('⭐⭐ shows NO row for a HEADER clef — the one he excluded', () => {
    // `offsettable` is the engine's reading of the drawn ink: a clef in a system's header is laid out
    // by the header, and a row that could only ever be refused would be a control that lies.
    expect(show({ offsettable: false })).toHaveLength(0)
  })

  it('resets to the engraver’s own position', () => {
    show({ offset: 2 })
    const reset = [...host.querySelectorAll('button')].find(b => b.textContent === 'reset')!
    reset.click()
    expect(published).toEqual([{ measure: 2, beat: 0.5, staff: 0, x: 0 }])
  })
})
