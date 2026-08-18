// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { TrillGeometryRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ A TRILL'S INK AS NUMBERS (his ask, 2026-08-18) — the typed twin of the arrows on its two
 * squares.
 *
 * Subject: {@link PropertiesWidget}, a chapter beside `.ottava.test.ts` and `.pedal.test.ts`, whose
 * claim it repeats for the fifth span: **THREE rows, not two points.** The `tr` and its wavy line are
 * drawn on one baseline, so two height boxes would offer two answers to a question the notation has
 * one of.
 *
 * ⭐⭐ **And the case that separates this panel from the pedal's**: the store is `outward` — a
 * distance FROM THE STAFF — because `x` flips a trill's side, so the box has to convert. Every case
 * below that uses an `above` trill would pass with the conversion deleted; the `below` one is the
 * test.
 */
const trillElement = (
  overrides?: InspectedElement['overrides'],
  placement: 'above' | 'below' = 'above',
): InspectedElement[] => ([{
  kind: 'trill',
  data: { id: 'T1', startNoteId: 'n1', placement },
  ...(overrides ? { overrides } : {}),
} as unknown as InspectedElement])

describe('the trill offset rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: TrillGeometryRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.trillGeometry.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (overrides?: InspectedElement['overrides'], placement: 'above' | 'below' = 'above') => {
    bus.inspection.set(trillElement(overrides, placement))
    return [...host.querySelectorAll('input[type=number]')] as HTMLInputElement[]
  }

  it('⭐⭐ offers THREE boxes — two horizontals and ONE height', () => {
    expect(show()).toHaveLength(3)
    // ⚠️ Scoped to the rows that HOLD a number box: a trill's panel also carries the continuation
    // label ("on a new system"), which is a different control and not part of this claim.
    const captions = show().map(i => i.closest('label')?.querySelector('span')?.textContent)
    expect(captions).toEqual(['start x (sp)', 'end x (sp)', 'vertical (sp)'])
  })

  it('shows the stored numbers, and 0 for each that is absent', () => {
    expect(show().map(i => i.value)).toEqual(['0', '0', '0'])
    expect(show([{ kind: 'trillOffset', startX: 1.5, endX: -2 } as never]).map(i => i.value))
      .toEqual(['1.5', '-2', '0'])
  })

  it('⭐ each row publishes its OWN number — the ends by name, the vertical without one', () => {
    const [startX, endX] = show([{ kind: 'trillOffset', startX: 1 } as never])

    startX.value = '2'
    startX.dispatchEvent(new Event('change'))
    endX.value = '-1'
    endX.dispatchEvent(new Event('change'))

    expect(published).toEqual([
      { trillId: 'T1', which: 'start', x: 2 },
      { trillId: 'T1', which: 'end', x: -1 },
    ])
  })

  it('⭐⭐ THE BOX SPEAKS SCREEN: + IS UP, on BOTH sides of the staff', () => {
    // ⚠️ Every other case in this file drives an `above` trill, where the model's own `outward` (a
    // distance FROM the staff) and "up" happen to agree — so all of them would pass with the
    // conversion DELETED. This is the case that does not, and it is the ottava's recorded 8vb trap
    // arriving for the ornament.
    const stored = [{ kind: 'trillOffset', outward: 2 } as never]

    // Above the staff: 2 further OUT is 2 UP.
    expect(show(stored, 'above')[2].value).toBe('2')
    // Below it: 2 further out is 2 DOWN, so the box says −2.
    const [, , down] = show(stored, 'below')
    expect(down.value, 'the same ink, shown as the screen sees it').toBe('-2')

    // …and typing "up" on a `below` trill stores a SMALLER outward — the ink really does rise.
    down.value = '-1'
    down.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ trillId: 'T1', outward: 1 }])
  })

  it('⭐⭐ puts a box BACK after committing — nothing on screen the model has not taken', () => {
    const [startX] = show([{ kind: 'trillOffset', startX: 1 } as never])
    startX.value = '900'
    startX.dispatchEvent(new Event('change'))
    expect(published, 'the ask still went out — refusing is the ENGINE\'s call').toHaveLength(1)
    expect(startX.value, 'but the panel kept the truth').toBe('1')
  })

  it('reset publishes 0 for that row alone, and zeroes it at once', () => {
    const [, , vertical] = show([{ kind: 'trillOffset', startX: 1, outward: -2 } as never])
    const resets = [...host.querySelectorAll('button')].filter(b => b.textContent === 'reset')
    resets[2].click()
    expect(published).toEqual([{ trillId: 'T1', outward: 0 }])
    expect(vertical.value).toBe('0')
  })

  it('refuses a non-numeric entry without publishing, and restores the box', () => {
    const [startX] = show([{ kind: 'trillOffset', startX: 1 } as never])
    startX.value = ''
    startX.dispatchEvent(new Event('change'))
    expect(published).toHaveLength(0)
    expect(startX.value).toBe('1')
  })

  it('⛔ shows nothing for a trill the score no longer has', () => {
    bus.inspection.set([{ kind: 'trill', data: { id: 'T1', missing: true } } as never])
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(0)
  })
})
