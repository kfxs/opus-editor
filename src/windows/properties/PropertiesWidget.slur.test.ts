// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { SlurGeometryRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ THE SLUR'S FOUR HANDLES AS NUMBERS (his ask, 2026-08-17) — the typed twin of the drag and the
 * arrow nudge.
 *
 * Subject: {@link PropertiesWidget}, sitting beside this file. What is asked here is the WINDOW's
 * half only: which rows appear, what they show, and what they publish. The apply is
 * `SlurGeometryController`'s and has its own spec — the window holds no engine, which is the boundary
 * this panel exists to keep.
 *
 * ⚠️ **Blank is not zero.** An unedited handle has no entry in the overrides compartment, and the
 * distinction is the whole reason the inputs are nullable: `0` is a hand-authored position that
 * happens to be at the anchor, `auto` is no authorship at all.
 */
const slurElement = (over: Partial<InspectedElement> = {}): InspectedElement[] => ([{
  kind: 'slur',
  data: { id: 'slur-1', startNoteId: 'n-a', endNoteId: 'n-b' },
  ...over,
} as unknown as InspectedElement])

describe('the slur handle rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: SlurGeometryRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.slurGeometry.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    // The channel de-dups on the serialized snapshot, so the next test must not look like this one.
    bus.inspection.set([])
  })

  /** One row by its caption, with its two boxes and its reset. ⚠️ Matched on the caption SPAN, not on
   *  the div's text: the four rows sit in a wrapper whose own text also starts with the first
   *  caption, so a looser match returns all eight boxes and every assertion here reads the wrong row. */
  const row = (startsWith: string) => {
    const found = [...host.querySelectorAll('div')].find(d =>
      d.firstElementChild?.tagName === 'SPAN' && d.firstElementChild.textContent?.startsWith(startsWith))
    return {
      inputs: [...(found?.querySelectorAll('input[type=number]') ?? [])] as HTMLInputElement[],
      reset: found?.querySelector('button') as HTMLButtonElement | null,
    }
  }
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value
    input.dispatchEvent(new Event('change'))
  }

  it('paints one row per handle — both ends, then both arc points', () => {
    bus.inspection.set(slurElement())
    for (const caption of ['start end', 'end end', 'arc 1', 'arc 2']) {
      expect(row(caption).inputs).toHaveLength(2)
    }
  })

  it('⭐ shows AUTO as blank, not as 0 — an unedited handle has no authored position', () => {
    bus.inspection.set(slurElement())
    const { inputs } = row('start end')
    expect(inputs.map(i => i.value)).toEqual(['', ''])
    expect(inputs[0].placeholder).toBe('auto')
  })

  it('shows an authored endpoint offset, read from the overrides compartment', () => {
    bus.inspection.set(slurElement({
      overrides: [{ kind: 'endpointOffset', start: { x: 0.5, y: -1 } }] as unknown as InspectedElement['overrides'],
    }))
    expect(row('start end').inputs.map(i => i.value)).toEqual(['0.5', '-1'])
    // The other end is untouched, so it stays automatic.
    expect(row('end end').inputs.map(i => i.value)).toEqual(['', ''])
  })

  it('shows the arc through the RESOLVED value the snapshot picked, not the raw compartment', () => {
    bus.inspection.set(slurElement({
      derived: { arc: { cps: [{ x: 0, y: 2.5 }, { x: -0.25, y: 2 }], segment: null, armed: 0 } },
    }))
    expect(row('arc 1').inputs.map(i => i.value)).toEqual(['0', '2.5'])
    expect(row('arc 2').inputs.map(i => i.value)).toEqual(['-0.25', '2'])
  })

  it('⭐ publishes ONE AXIS at a time, so a row is usable from `auto`', () => {
    // The half-filled row is the case that matters: with both boxes blank, insisting on a pair would
    // mean the first commit had to invent the second number.
    bus.inspection.set(slurElement())
    const { inputs } = row('end end')
    type(inputs[0], '1.25')
    type(inputs[1], '-0.5')
    expect(published).toEqual([
      { slurId: 'slur-1', target: { kind: 'endpoint', which: 'end' }, value: { x: 1.25 } },
      { slurId: 'slur-1', target: { kind: 'endpoint', which: 'end' }, value: { y: -0.5 } },
    ])
  })

  it('a number that is not one puts the model\'s value back rather than guessing', () => {
    bus.inspection.set(slurElement({
      overrides: [{ kind: 'endpointOffset', start: { x: 0.5, y: -1 } }] as unknown as InspectedElement['overrides'],
    }))
    const { inputs } = row('start end')
    type(inputs[0], 'banana')
    expect(inputs.map(i => i.value)).toEqual(['0.5', '-1'])
    expect(published).toEqual([])
  })

  it('reset publishes null — back to the automatic engraving — and blanks the row', () => {
    bus.inspection.set(slurElement({
      derived: { arc: { cps: [{ x: 0, y: 2.5 }, { x: 0, y: 2 }], segment: null, armed: 1 } },
    }))
    const { inputs, reset } = row('arc 2')
    reset!.click()
    expect(published).toEqual([
      { slurId: 'slur-1', target: { kind: 'controlPoint', cpIndex: 1 }, value: null },
    ])
    expect(inputs.map(i => i.value)).toEqual(['', ''])
  })

  it('⚠️ a split slur with no dot armed shows WHICH SYSTEM is missing, and offers no guess', () => {
    bus.inspection.set(slurElement({
      derived: { arc: { cps: null, segment: 'middle 2', armed: null } },
    }))
    const { inputs, reset } = row('arc 1')
    expect(inputs.every(i => i.disabled)).toBe(true)
    expect(reset!.disabled).toBe(true)
    // The ends belong to the whole slur, so they stay live.
    expect(row('start end').inputs.some(i => i.disabled)).toBe(false)
  })

  it('names the segment its arc rows write to, so the number has an address', () => {
    bus.inspection.set(slurElement({
      derived: { arc: { cps: null, segment: 'begin', armed: 0 } },
    }))
    expect(row('arc 1 (begin)').inputs).toHaveLength(2)
  })

  it('no slur, no rows — this edits a slur, it never makes one', () => {
    bus.inspection.set([{ kind: 'note', data: { id: 'note-1', step: 'C' } } as unknown as InspectedElement])
    // The note-offset input is always there; the slur's eight are not.
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(1)
  })
})
