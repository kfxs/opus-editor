// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { PedalGeometryRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ A SUSTAIN PEDAL'S INK AS NUMBERS (his ask, 2026-08-18) — the typed twin of the arrows on its two
 * squares.
 *
 * Subject: {@link PropertiesWidget}, a chapter beside `.ottava.test.ts`, whose claim it repeats for
 * the other span: **THREE rows, not two points.** Two height boxes would offer two answers to a
 * question the notation has one of — here because a pedal and its own release share a baseline
 * (Gould p. 333, the copy in `reference/`), where the bracket's reason is that a straight rule
 * cannot tilt. If this file ever goes green with four boxes, the wedge's structure has been copied
 * in and the two signs can drift apart vertically.
 */
const pedalElement = (overrides?: InspectedElement['overrides']): InspectedElement[] => ([{
  kind: 'pedal',
  data: { id: 'P1', beat: { num: 0, den: 1 }, length: { num: 4, den: 1 } },
  ...(overrides ? { overrides } : {}),
} as unknown as InspectedElement])

describe('the pedal offset rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: PedalGeometryRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.pedalGeometry.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (overrides?: InspectedElement['overrides']) => {
    bus.inspection.set(pedalElement(overrides))
    return [...host.querySelectorAll('input[type=number]')] as HTMLInputElement[]
  }

  it('⭐⭐ offers THREE boxes — two horizontals and ONE height', () => {
    expect(show()).toHaveLength(3)
    const captions = [...host.querySelectorAll('label > span')].map(s => s.textContent)
    expect(captions).toEqual(['start x (sp)', 'end x (sp)', 'vertical (sp)'])
  })

  it('shows the stored numbers, and 0 for each that is absent', () => {
    expect(show().map(i => i.value)).toEqual(['0', '0', '0'])
    expect(show([{ kind: 'pedalOffset', startX: 1.5, endX: -2 } as never]).map(i => i.value))
      .toEqual(['1.5', '-2', '0'])
  })

  it('⭐ each row publishes its OWN number — the signs by name, the vertical without one', () => {
    const [startX, endX] = show([{ kind: 'pedalOffset', startX: 1 } as never])

    startX.value = '2'
    startX.dispatchEvent(new Event('change'))
    endX.value = '-1'
    endX.dispatchEvent(new Event('change'))

    expect(published).toEqual([
      { pedalId: 'P1', which: 'start', x: 2 },
      { pedalId: 'P1', which: 'end', x: -1 },
    ])
  })

  it('⭐⭐ THE BOX SPEAKS SCREEN: + IS UP, where the model stores + DOWN', () => {
    // His standing rule for every offset box: *"increasing the number is go up and decreasing go
    // down always."* The pedal's model stores a screen `y` (+ down, since it has one side and no
    // flip to survive), so this row is a negation in both directions.
    //
    // ⭐⭐ THE BREAK-TEST: deleting the flip leaves every `0` case above green, and only these two
    // numbers change sign — which is exactly the shape of the bug his eye caught on the bracket.
    const [, , vertical] = show([{ kind: 'pedalOffset', y: 2 } as never])
    expect(vertical.value, 'stored 2 DOWN reads as 2 down on screen, i.e. −2').toBe('-2')

    vertical.value = '1'   // asking for 1 UP…
    vertical.dispatchEvent(new Event('change'))
    expect(published, '…stores −1, which is 1 up in the model\'s + down').toEqual([
      // ⭐⭐ No `which` — the vertical belongs to the pair, and the seam has no way to name a sign
      // for it. That absence IS the rule.
      { pedalId: 'P1', y: -1 },
    ])
  })

  it('⭐⭐ puts a box BACK after committing — nothing on screen the model has not taken', () => {
    // The page limit can refuse a write; a refused write repaints nothing, so a box left holding
    // what was typed is a spinner you must wind all the way back down.
    const [startX] = show([{ kind: 'pedalOffset', startX: 1 } as never])
    startX.value = '900'
    startX.dispatchEvent(new Event('change'))
    expect(published, 'the ask still went out — refusing is the ENGINE\'s call').toHaveLength(1)
    expect(startX.value, 'but the panel kept the truth').toBe('1')
  })

  it('⭐⭐ ONE CLICK IS ONE COMMIT — the spinner\'s auto-repeat writes nothing more', () => {
    const [startX] = show([{ kind: 'pedalOffset', startX: 1 } as never])
    startX.dispatchEvent(new Event('pointerdown'))
    startX.value = '1.25'
    startX.dispatchEvent(new Event('change'))
    for (const v of ['1.5', '1.75']) {
      startX.value = v
      startX.dispatchEvent(new Event('change'))
    }
    document.dispatchEvent(new Event('pointerup'))
    expect(published).toEqual([{ pedalId: 'P1', which: 'start', x: 1.25 }])
  })

  it('reset publishes 0 for that row alone, and zeroes it at once', () => {
    const [, , vertical] = show([{ kind: 'pedalOffset', startX: 1, y: -2 } as never])
    const resets = [...host.querySelectorAll('button')].filter(b => b.textContent === 'reset')
    resets[2].click()
    // ⭐ 0 is the one value the flip cannot get wrong — and it is a plain 0, not a `-0`.
    expect(published).toEqual([{ pedalId: 'P1', y: 0 }])
    expect(vertical.value).toBe('0')
  })

  it('refuses a non-numeric entry without publishing, and restores the box', () => {
    const [startX] = show([{ kind: 'pedalOffset', startX: 1 } as never])
    startX.value = ''
    startX.dispatchEvent(new Event('change'))
    expect(published).toHaveLength(0)
    expect(startX.value).toBe('1')
  })

  it('⛔ shows nothing for a pedal the score no longer has', () => {
    bus.inspection.set([{ kind: 'pedal', data: { id: 'P1', missing: true } } as never])
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(0)
  })
})
