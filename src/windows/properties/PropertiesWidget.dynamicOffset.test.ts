// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { DynamicOffsetRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ A DYNAMIC'S (or expression's) OFFSET AS TWO NUMBERS — his ask, 2026-08-17: *"we also should be
 * able to control the offset of expression (dynamics) on the properties."*
 *
 * Subject: {@link PropertiesWidget}, a chapter beside `.hairpin.test.ts`. The window's half only —
 * which boxes appear and what they publish; the apply is `DynamicOffsetController`'s.
 *
 * ⭐⭐ **The claim this file exists for is the STALE VALUE**, his report an hour later: *"the number
 * doesn't stop but keeps on changing after the limit, so to go back we have to do the whole path."*
 * A typed value can be refused by the page limit, a refused write repaints nothing, and a box left
 * holding what was typed is a spinner you must wind all the way back down before anything moves. So
 * the box is put back to the last KNOWN value on every commit, and a write that landed repaints the
 * row over the top of it.
 */
const dynamicElement = (overrides?: InspectedElement['overrides']): InspectedElement[] => ([{
  kind: 'dynamic',
  data: { id: 'D1', text: 'f', beat: { num: 0, den: 1 } },
  ...(overrides ? { overrides } : {}),
} as unknown as InspectedElement])

describe('the dynamic offset row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: DynamicOffsetRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.dynamicOffset.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (overrides?: InspectedElement['overrides']) => {
    bus.inspection.set(dynamicElement(overrides))
    return [...host.querySelectorAll('input[type=number]')] as HTMLInputElement[]
  }

  it('⭐ offers TWO boxes — a dynamic rides the line and may be lifted off it', () => {
    // ⚠️ Where the note's offset above is horizontal ALONE: a note's vertical is its PITCH, which is
    // content, not engraving. If this ever becomes one box the two marks have been conflated.
    expect(show()).toHaveLength(2)
  })

  it('shows the stored offset, and 0 when there is none', () => {
    expect(show().map(i => i.value)).toEqual(['0', '0'])
    expect(show([{ kind: 'dynamicOffset', x: 1.5, y: -2 } as never]).map(i => i.value))
      .toEqual(['1.5', '-2'])
  })

  it('⭐ publishes BOTH axes on either box\'s commit — one write, one undo entry', () => {
    // ⚠️ Not one publish per axis: two nudges would be two undo steps for one commit, and the page
    // limit would judge the halves separately — a diagonal that must be refused whole could then get
    // its x through.
    const [x, y] = show([{ kind: 'dynamicOffset', x: 1, y: 1 } as never])
    x.value = '3'
    x.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ dynamicId: 'D1', x: 3, y: 1 }])

    published.length = 0
    y.value = '-4'
    y.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ dynamicId: 'D1', x: 1, y: -4 }])
  })

  it('⭐⭐ puts the boxes BACK after committing — nothing on screen the model has not taken', () => {
    // The panel repaints from `bus.inspection` when the write lands. Nothing repaints here, which is
    // exactly the refused case: the boxes must show the score's numbers, not the typed ones.
    const [x, y] = show([{ kind: 'dynamicOffset', x: 1, y: 2 } as never])
    x.value = '900'
    x.dispatchEvent(new Event('change'))
    expect(published, 'the ask still went out — refusing is the ENGINE\'s call').toHaveLength(1)
    expect([x.value, y.value], 'but the panel kept the truth').toEqual(['1', '2'])
  })

  it('⭐⭐ ONE CLICK IS ONE COMMIT — the spinner\'s auto-repeat writes nothing more', () => {
    // His rule, 2026-08-17: *"committing on mouse down, and release makes no action."* A number input
    // steps on mouse-down and then repeats while held, firing `change` each time; left alone that
    // ramps the value and fires a write per step, and past the page limit every one is refused — so
    // the number runs away from the score.
    const [x] = show([{ kind: 'dynamicOffset', x: 1, y: 2 } as never])
    x.dispatchEvent(new Event('pointerdown'))
    x.value = '1.25'
    x.dispatchEvent(new Event('change'))
    expect(published, 'the first step commits').toEqual([{ dynamicId: 'D1', x: 1.25, y: 2 }])

    for (const v of ['1.5', '1.75', '2']) {
      x.value = v
      x.dispatchEvent(new Event('change'))
    }
    expect(published, 'and the ramp adds nothing').toHaveLength(1)

    // ⛔ The release writes nothing — committing there was the first attempt and he rejected it:
    // holding then ramps the number silently, with no render to judge it by.
    document.dispatchEvent(new Event('pointerup'))
    expect(published).toHaveLength(1)
  })

  it('⭐ …and the NEXT click commits again — one step, one render, repeatable', () => {
    const [x] = show([{ kind: 'dynamicOffset', x: 1, y: 2 } as never])
    for (const v of ['1.25', '1.5']) {
      x.dispatchEvent(new Event('pointerdown'))
      x.value = v
      x.dispatchEvent(new Event('change'))
      document.dispatchEvent(new Event('pointerup'))
    }
    expect(published).toEqual([
      { dynamicId: 'D1', x: 1.25, y: 2 },
      { dynamicId: 'D1', x: 1.5, y: 2 },
    ])
  })

  it('⭐ TYPING is untouched — no pointer is down, so the commit lands as it always did', () => {
    const [x] = show([{ kind: 'dynamicOffset', x: 1, y: 2 } as never])
    x.value = '5'
    x.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ dynamicId: 'D1', x: 5, y: 2 }])
  })

  it('refuses a non-numeric entry without publishing, and restores the box', () => {
    const [x] = show([{ kind: 'dynamicOffset', x: 1, y: 2 } as never])
    x.value = ''
    x.dispatchEvent(new Event('change'))
    expect(published).toHaveLength(0)
    expect(x.value).toBe('1')
  })

  it('reset publishes (0, 0) and zeroes the boxes at once — a reset can never be refused', () => {
    // ⭐ Unlike the typed commit: a reset only ever REDUCES an offset, so the page limit has nothing
    // to say about it and the immediate feedback is honest.
    const [x, y] = show([{ kind: 'dynamicOffset', x: 1, y: 2 } as never])
    const reset = [...host.querySelectorAll('button')].find(b => b.textContent === 'reset')!
    reset.click()
    expect(published).toEqual([{ dynamicId: 'D1', x: 0, y: 0 }])
    expect([x.value, y.value]).toEqual(['0', '0'])
  })

  it('⛔ shows nothing for a dynamic the score no longer has', () => {
    bus.inspection.set([{ kind: 'dynamic', data: { id: 'D1', missing: true } } as never])
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(0)
  })
})
