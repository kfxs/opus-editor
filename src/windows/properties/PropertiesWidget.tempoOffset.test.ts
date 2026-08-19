// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { TempoOffsetRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ A TEMPO MARK'S OFFSET AS TWO NUMBERS — his ask, 2026-08-19, the typed twin of the arrows.
 *
 * Subject: {@link PropertiesWidget}, a chapter beside `.dynamicOffset.test.ts`. The window's half
 * only — which boxes appear and what they publish; the apply is `TempoOffsetController`'s.
 *
 * ⭐⭐ The row itself is SHARED with the dynamic's (`buildMarkOffsetRow`), so what this file is really
 * for is the wiring: that a selected tempo mark gets one, reads its OWN override kind, and publishes
 * to its OWN seam. The stale-value and one-click-one-commit disciplines are proven next door and are
 * the same code here.
 */
const tempoElement = (overrides?: InspectedElement['overrides']): InspectedElement[] => ([{
  kind: 'tempo',
  data: { id: 'T1', text: 'Allegro', beat: { num: 0, den: 1 } },
  ...(overrides ? { overrides } : {}),
} as unknown as InspectedElement])

describe('the tempo offset row', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: TempoOffsetRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.tempoOffset.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
  })

  const show = (overrides?: InspectedElement['overrides']) => {
    bus.inspection.set(tempoElement(overrides))
    return [...host.querySelectorAll('input[type=number]')] as HTMLInputElement[]
  }

  it('⭐ offers TWO boxes — the mark rides the ladder\'s row and may be moved off it either way', () => {
    expect(show()).toHaveLength(2)
  })

  it('reads its OWN override kind — 0,0 when there is none', () => {
    // ⚠️ `tempoOffset`, ⛔ not `dynamicOffset`: one compartment, two kinds, and an element carrying
    // the wrong one must read as un-nudged rather than borrow the other mark's numbers.
    expect(show().map(i => i.value)).toEqual(['0', '0'])
    expect(show([{ kind: 'dynamicOffset', x: 9, y: 9 } as never]).map(i => i.value)).toEqual(['0', '0'])
    expect(show([{ kind: 'tempoOffset', x: 1.5, y: -2 } as never]).map(i => i.value))
      .toEqual(['1.5', '-2'])
  })

  it('⭐ publishes BOTH axes on either box\'s commit, to the TEMPO seam', () => {
    const [x, y] = show([{ kind: 'tempoOffset', x: 1, y: 1 } as never])
    x.value = '3'
    x.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ tempoId: 'T1', x: 3, y: 1 }])

    published.length = 0
    y.value = '-4'
    y.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ tempoId: 'T1', x: 1, y: -4 }])
  })

  it('⭐ the reset button zeroes both axes in one write', () => {
    show([{ kind: 'tempoOffset', x: 2, y: -3 } as never])
    const reset = [...host.querySelectorAll('button')].find(b => b.textContent === 'reset')!
    reset.click()
    expect(published).toEqual([{ tempoId: 'T1', x: 0, y: 0 }])
  })

  it('⛔ a mark the model no longer holds gets no boxes — nothing to write to', () => {
    bus.inspection.set([{ kind: 'tempo', data: { id: 'T1', missing: true } } as unknown as InspectedElement])
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(0)
  })
})
