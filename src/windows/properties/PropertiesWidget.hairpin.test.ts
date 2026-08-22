// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PropertiesWidget } from './PropertiesWidget'
import { bus } from '@/bus'
import type { HairpinEditRequest, HairpinGeometryRequest } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'

/**
 * ⭐ THE WEDGE'S TWO ENDS AS NUMBERS (his ask, 2026-08-17) — the typed twin of the arrows that
 * reshape a hairpin.
 *
 * Subject: {@link PropertiesWidget}, a chapter beside `.slur.test.ts` and `.fan.test.ts`. The window's
 * half only: which rows appear and what they publish. The apply is `HairpinGeometryController`'s.
 *
 * ⛔ The claim worth pinning hardest is a NEGATIVE: the panel offers no box for the wedge's EXTENT.
 * How many notes it covers is musical and measured in notes; a staff-space input would be a second,
 * lossy way to say it, and the two could then disagree.
 */
/** The mouth as the snapshot reports it for an un-authored wedge: what is DRAWN, plus its range. */
const AUTO_MOUTH = { value: 1.5, authored: false, min: 1, max: 2 }

const hairpinElement = (over: Partial<InspectedElement> = {}): InspectedElement[] => ([{
  kind: 'hairpin',
  data: { id: 'H1', type: 'cresc', beat: { num: 0, den: 1 }, length: { num: 2, den: 1 } },
  ...over,
} as unknown as InspectedElement])

describe('the hairpin end rows', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: HairpinGeometryRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.hairpinGeometry.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    bus.inspection.set([])
  })

  // ⚠️ `div, label` — the two-box rows are divs and the single-number one is a label (it wraps its
  // input, so a click on the caption focuses it). Searching only divs silently finds no mouth row.
  const row = (startsWith: string) => {
    const found = [...host.querySelectorAll('div, label')].find(d =>
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

  it('paints one row per end, each an x/y pair', () => {
    bus.inspection.set(hairpinElement())
    expect(row('start').inputs).toHaveLength(2)
    expect(row('end').inputs).toHaveLength(2)
  })

  it('⛔ offers NO box for the extent — that quantity is measured in notes, not in spaces', () => {
    bus.inspection.set(hairpinElement({ derived: { mouth: AUTO_MOUTH } }))
    // Four boxes for the two ends and one for the mouth, so a `length` input cannot creep in unnoticed.
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(5)
  })

  it('⭐⭐ the MOUTH shows the EFFECTIVE width even when it is the engraver\'s, so a step starts THERE', () => {
    // His correction: a blank box would make the first press of the spinner jump to the minimum,
    // which is the opposite of a nudge. The number on screen is what is on the page; `reset` is what
    // says "back to automatic".
    bus.inspection.set(hairpinElement({ derived: { mouth: AUTO_MOUTH } }))
    const { inputs } = row('mouth')
    expect(inputs).toHaveLength(1)
    expect(inputs[0].value).toBe('1.5')
  })

  it('⭐ takes its BOUNDS from the snapshot — length-dependent, not a constant in the panel', () => {
    // A 45-space wedge: the steepness cap has not bitten, so the range is the formula's own
    // 1.5…MAX, and on a shorter one both ends come down with the cap.
    bus.inspection.set(hairpinElement({ derived: { mouth: { ...AUTO_MOUTH, min: 1.11, max: 1.11 } } }))
    const { inputs } = row('mouth')
    expect([inputs[0].min, inputs[0].max]).toEqual(['1.11', '1.11'])
  })

  it('⛔ CLAMPS a typed value into those bounds rather than publishing one the engine would cap', () => {
    // `max` on a number input only constrains the spinner — a typed or pasted value still arrives.
    bus.inspection.set(hairpinElement({ derived: { mouth: { ...AUTO_MOUTH, min: 1, max: 1.61 } } }))
    const { inputs } = row('mouth')
    type(inputs[0], '9')
    expect(published).toEqual([{ hairpinId: 'H1', aperture: 1.61 }])
    expect(inputs[0].value).toBe('1.61')
    // …and the same at the bottom: a mouth narrower than the floor is a black bar, not a hairpin.
    type(inputs[0], '0.25')
    expect(published[1]).toEqual({ hairpinId: 'H1', aperture: 1 })
  })

  it('publishes the absolute value, and reset hands the mouth back to automatic', () => {
    bus.inspection.set(hairpinElement({
      derived: { mouth: { value: 1.75, authored: true, min: 1, max: 2 } },
      overrides: [{ kind: 'hairpinAperture', aperture: 1.75 }] as unknown as InspectedElement['overrides'],
    }))
    const { inputs, reset } = row('mouth')
    expect(inputs[0].value).toBe('1.75')
    type(inputs[0], '1.9')
    reset!.click()
    expect(published).toEqual([
      { hairpinId: 'H1', aperture: 1.9 },
      { hairpinId: 'H1', aperture: null },
    ])
  })

  it('no mouth row for a wedge the last render did not draw — nothing to step from', () => {
    bus.inspection.set(hairpinElement({ derived: { mouth: null } }))
    expect(row('mouth').inputs).toHaveLength(0)
  })

  it('shows an authored reshape, read from the overrides compartment', () => {
    bus.inspection.set(hairpinElement({
      overrides: [{ kind: 'hairpinEndpointOffset', end: { x: 1.5, y: -1 } }] as unknown as InspectedElement['overrides'],
    }))
    expect(row('end').inputs.map(i => i.value)).toEqual(['1.5', '-1'])
    // The other end was never nudged, so it stays the engraver's — blank, not 0.
    expect(row('start').inputs.map(i => i.value)).toEqual(['', ''])
  })

  it('publishes one axis at a time, so a row is usable from the engraver\'s position', () => {
    bus.inspection.set(hairpinElement())
    const { inputs } = row('start')
    type(inputs[1], '-0.75')
    expect(published).toEqual([{ hairpinId: 'H1', which: 'start', value: { y: -0.75 } }])
  })

  it('reset publishes null — back to where the engraver put that end', () => {
    bus.inspection.set(hairpinElement({
      overrides: [{ kind: 'hairpinEndpointOffset', start: { x: 1, y: 1 } }] as unknown as InspectedElement['overrides'],
    }))
    row('start').reset!.click()
    expect(published).toEqual([{ hairpinId: 'H1', which: 'start', value: null }])
  })

  it('no hairpin, no rows', () => {
    bus.inspection.set([{ kind: 'note', data: { id: 'n1', step: 'C' } } as unknown as InspectedElement])
    expect(host.querySelectorAll('input[type=number]')).toHaveLength(1) // the note offset's
  })
})

/**
 * ⭐⭐ **WHICH WAY THE WEDGE OPENS** — his ask, 2026-08-22: *"be able in a dropdown in the property to
 * change the hairpin type"*.
 *
 * ⚠️ A different SEAM from the rows above, and that is the claim: the ends and the mouth are drawing
 * (`bus.hairpinGeometry`, the overrides compartment), while the type is MUSIC (`bus.hairpinEdit`, the
 * model and an undo entry). A panel that published both through one channel would have made a
 * content edit look like a nudge.
 */
describe('the hairpin type dropdown', () => {
  let host: HTMLElement
  let widget: PropertiesWidget
  let published: HairpinEditRequest[]
  let unsubscribe: () => void

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    widget = new PropertiesWidget()
    widget.mount(host)
    published = []
    unsubscribe = bus.hairpinEdit.onSet(req => published.push(req))
  })
  afterEach(() => {
    unsubscribe()
    widget.destroy()
    host.remove()
    bus.inspection.set([])
  })

  const select = () => host.querySelector('select') as HTMLSelectElement | null

  it('⭐ shows the wedge it is looking at, and offers the other one', () => {
    bus.inspection.set(hairpinElement())
    expect([...select()!.options].map(o => o.value)).toEqual(['cresc', 'dim'])
    expect(select()!.value, 'the selected wedge is a crescendo').toBe('cresc')
  })

  it('⭐ …and a `dim` wedge shows as one', () => {
    bus.inspection.set(hairpinElement({
      data: { id: 'H1', type: 'dim' } as unknown as InspectedElement['data'],
    }))
    expect(select()!.value).toBe('dim')
  })

  it('⭐⭐ picking one PUBLISHES it — and the window never touches the engine', () => {
    bus.inspection.set(hairpinElement())
    select()!.value = 'dim'
    select()!.dispatchEvent(new Event('change'))
    expect(published).toEqual([{ hairpinId: 'H1', type: 'dim' }])
  })

  it('⛔ no dropdown for a wedge the score no longer has', () => {
    bus.inspection.set(hairpinElement({
      data: { id: 'H1', missing: true } as unknown as InspectedElement['data'],
    }))
    expect(select(), 'a missing mark gets no controls at all').toBeNull()
  })
})
