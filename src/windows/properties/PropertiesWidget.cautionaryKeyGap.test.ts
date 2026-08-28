// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { CautionaryKeyGapRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ **THE COURTESY TAIL AS A NUMBER** (his ask, 2026-08-28: *"lets make what we have now default but
 * give the user the freedom to change the number in properties"*) — the bare staff drawn after a
 * cautionary key signature at a system break.
 *
 * Subject: {@link PropertiesWidget}, a chapter beside `.hairpin.test.ts`, whose `mouth` row this one
 * copies: the window's half only — which row appears and what it publishes. The apply is
 * `CautionaryKeyGapController`'s.
 *
 * ⭐ **Why the control exists at all is worth keeping in view:** the sources disagree by almost a
 * space and a half (Gould's p. 93 figure measures 1.9 sp, all three engines state 0.5, ours is his
 * chosen 0.75), so this is a default that should not be the last word.
 */
const keySignatureElement = (
  gap: { value: number; authored: boolean } | null,
): InspectedElement[] => ([{
  kind: 'keySignature',
  data: { measure: 10, staff: 0 },
  derived: { cautionaryGap: gap },
} as unknown as InspectedElement])

describe('the courtesy tail row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: CautionaryKeyGapRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.cautionaryKeyGap.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    bus.inspection.set([])
  })

  // ⚠️ `div, label`: a single-number row is a LABEL (it wraps its input, so clicking the caption
  //    focuses it) — searching only divs silently finds nothing. The hairpin spec's own note.
  const row = (startsWith: string) => {
    const found = [...host.querySelectorAll('div, label')].find(d =>
      d.firstElementChild?.tagName === 'SPAN' && d.firstElementChild.textContent?.startsWith(startsWith))
    return {
      inputs: [...(found?.querySelectorAll('input[type=number]') ?? [])] as HTMLInputElement[],
      reset: found?.querySelector('button') as HTMLButtonElement | null,
    }
  }

  it('shows the EFFECTIVE gap, authored or not — a blank box would nudge from the minimum', () => {
    bus.inspection.set(keySignatureElement({ value: 0.75, authored: false }))
    const { inputs } = row('courtesy tail')
    expect(inputs, 'one box for one number').toHaveLength(1)
    expect(inputs[0].value, 'the default, shown rather than left blank').toBe('0.75')
  })

  it('publishes what was typed, with the CHANGE’s measure and staff', () => {
    bus.inspection.set(keySignatureElement({ value: 0.75, authored: false }))
    const input = row('courtesy tail').inputs[0]
    input.value = '1.5'
    input.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ measure: 10, staff: 0, gap: 1.5 }])
  })

  it('⭐ its RESET publishes NULL — "let the engraver decide", ⛔ never 0', () => {
    // 0 is a real answer a user may ask for (no tail at all), so the two must not be confused —
    // `keyOps.setCautionaryKeyGap` stores a 0 and treats only null as "clear the override".
    bus.inspection.set(keySignatureElement({ value: 2, authored: true }))
    row('courtesy tail').reset?.click()
    expect(published).toEqual([{ measure: 10, staff: 0, gap: null }])
  })

  it('⛔ offers NO row when the snapshot reports no gap — the panel invents nothing', () => {
    bus.inspection.set(keySignatureElement(null))
    expect(row('courtesy tail').inputs).toHaveLength(0)
  })
})
