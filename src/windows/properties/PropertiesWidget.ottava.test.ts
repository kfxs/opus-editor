// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { OttavaGeometryRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ AN OCTAVE BRACKET'S INK AS NUMBERS (his ask, 2026-08-17) — the typed twin of the arrows on its
 * two endpoint squares.
 *
 * Subject: {@link PropertiesWidget}, a chapter beside `.hairpin.test.ts` and `.dynamicOffset.test.ts`.
 * The window's half only: which rows appear and what they publish. The apply is
 * `OttavaGeometryController`'s.
 *
 * ⭐⭐ **The claim worth pinning hardest is a shape: THREE rows, not two points.** The obvious layout
 * — copy the wedge's `start (x, y)` / `end (x, y)` — would offer two heights for a mark that has one,
 * and the two boxes could then disagree. An octave bracket is a straight horizontal rule, so the model
 * carries `startX`, `endX` and a single `y`; the panel showing exactly that is how a reader learns the
 * rule. If this file ever goes green with four boxes, the wedge's structure has been copied here and
 * the bracket can tilt.
 */
const ottavaElement = (
  overrides?: InspectedElement['overrides'],
  shift = 1,
): InspectedElement[] => ([{
  kind: 'ottava',
  data: { id: 'O1', shift, beat: { num: 0, den: 1 }, length: { num: 4, den: 1 } },
  ...(overrides ? { overrides } : {}),
} as unknown as InspectedElement])

describe('the ottava offset rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: OttavaGeometryRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.ottavaGeometry.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (overrides?: InspectedElement['overrides'], shift = 1) => {
    bus.inspection.set(ottavaElement(overrides, shift))
    return [...host.querySelectorAll('input[type=number]')] as HTMLInputElement[]
  }

  it('⭐⭐ offers THREE boxes — two horizontals and ONE height', () => {
    expect(show()).toHaveLength(3)
  })

  it('⭐⭐ …and the VERTICAL row is the last of them, not a second y on an end', () => {
    // The captions carry the rule: two `x` rows and one `height`. Four boxes here would mean a per-end
    // vertical had been introduced, which the model has nowhere to store.
    const captions = [...host.querySelectorAll('label > span')].map(s => s.textContent)
    expect(captions).toEqual(['start x (sp)', 'end x (sp)', 'vertical (sp)'])
  })

  it('shows the stored numbers, and 0 for each that is absent', () => {
    // ⭐ 0 IS the automatic position here — unlike the wedge's mouth, whose automatic is a computed
    // width no number stands for, so that one shows a blank "auto" and this one must not.
    expect(show().map(i => i.value)).toEqual(['0', '0', '0'])
    expect(show([{ kind: 'ottavaOffset', startX: 1.5, outward: -2 } as never]).map(i => i.value))
      .toEqual(['1.5', '0', '-2'])
  })

  it('⭐ each row publishes its OWN number — the ends by name, the vertical without one', () => {
    const [startX, endX, outward] = show([{ kind: 'ottavaOffset', startX: 1 } as never])

    startX.value = '2'
    startX.dispatchEvent(new Event('change'))
    endX.value = '-1'
    endX.dispatchEvent(new Event('change'))
    outward.value = '-3'
    outward.dispatchEvent(new Event('change'))

    expect(published).toEqual([
      { ottavaId: 'O1', which: 'start', x: 2 },
      { ottavaId: 'O1', which: 'end', x: -1 },
      // ⭐⭐ No `which` — the vertical belongs to the whole bracket, and the seam has no way to name
      // an end for it. That absence IS the rule.
      { ottavaId: 'O1', outward: -3 },
    ])
  })

  it('⭐⭐ THE BOX SPEAKS SCREEN: + IS UP, on BOTH sides of the staff', () => {
    // His rule, 2026-08-17, after trying both: *"for me, increasing the number is go up and decreasing
    // go down always… the arrow of the properties should reflect the movement on screen."*
    //
    // ⚠️ Every other case in this file drives an 8va, where the model's own `outward` (a distance FROM
    // the staff) and "up" happen to agree — so all of them would pass with the conversion DELETED.
    // This is the case that does not.
    const stored = [{ kind: 'ottavaOffset', outward: 2 } as never]

    // An 8va: 2 further OUT is 2 UP.
    expect(show(stored, 1)[2].value).toBe('2')
    // An 8vb: 2 further out is 2 DOWN, so the box says −2.
    const [, , down] = show(stored, -1)
    expect(down.value, 'the same ink, shown as the screen sees it').toBe('-2')

    // …and typing "up" on an 8vb stores a SMALLER outward — the ink really does rise.
    down.value = '-1'
    down.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ ottavaId: 'O1', outward: 1 }])
  })

  it('⭐⭐ puts a box BACK after committing — nothing on screen the model has not taken', () => {
    // The page limit can refuse a write; a refused write repaints nothing, so a box left holding what
    // was typed is a spinner you must wind all the way back down (docs/engraving-overrides-plan.md
    // §8.6, his report).
    const [startX] = show([{ kind: 'ottavaOffset', startX: 1 } as never])
    startX.value = '900'
    startX.dispatchEvent(new Event('change'))
    expect(published, 'the ask still went out — refusing is the ENGINE\'s call').toHaveLength(1)
    expect(startX.value, 'but the panel kept the truth').toBe('1')
  })

  it('⭐⭐ ONE CLICK IS ONE COMMIT — the spinner\'s auto-repeat writes nothing more', () => {
    const [startX] = show([{ kind: 'ottavaOffset', startX: 1 } as never])
    startX.dispatchEvent(new Event('pointerdown'))
    startX.value = '1.25'
    startX.dispatchEvent(new Event('change'))
    for (const v of ['1.5', '1.75']) {
      startX.value = v
      startX.dispatchEvent(new Event('change'))
    }
    document.dispatchEvent(new Event('pointerup'))
    expect(published).toEqual([{ ottavaId: 'O1', which: 'start', x: 1.25 }])
  })

  it('reset publishes 0 for that row alone, and zeroes it at once', () => {
    // ⭐ 0 is the reset, because 0 is the automatic — there is no `null` case on this seam. And a
    // reset only reduces an offset, so the limit cannot refuse it: the box may zero immediately.
    const [, , outward] = show([{ kind: 'ottavaOffset', startX: 1, outward: -2 } as never])
    const resets = [...host.querySelectorAll('button')].filter(b => b.textContent === 'reset')
    resets[2].click()
    expect(published).toEqual([{ ottavaId: 'O1', outward: 0 }])
    expect(outward.value).toBe('0')
  })

  it('refuses a non-numeric entry without publishing, and restores the box', () => {
    const [startX] = show([{ kind: 'ottavaOffset', startX: 1 } as never])
    startX.value = ''
    startX.dispatchEvent(new Event('change'))
    expect(published).toHaveLength(0)
    expect(startX.value).toBe('1')
  })

  it('⛔ shows nothing for an ottava the score no longer has', () => {
    bus.inspection.set([{ kind: 'ottava', data: { id: 'O1', missing: true } } as never])
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(0)
  })
})
