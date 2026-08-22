/**
 * Subject: {@link renderCensus}, sitting beside this file — specifically **its arithmetic**.
 *
 * ⭐ Every bug this instrument has had lived in the arithmetic, not in the timing, and every one of
 * them was found by reading a dump rather than by a test, because there was no way to read a number
 * out of it except with your eyes. Two shipped and were quoted back at us as findings:
 *
 *  - `reset()` cleared the per-cause buckets but **not** the part accumulators, so a second
 *    `enable()` in one page life divided a cumulative numerator by a fresh denominator and printed
 *    a part at **259%** of the total it was supposedly a share of.
 *  - the layout total was rebuilt as `round(layout / n) × n` per cause, so it disagreed with the
 *    sum it claimed to be.
 *
 * ⚠️ The CLOCK is mocked here on purpose. `total` and `layout` are `performance.now()` deltas, and a
 * test that lets them float can only assert `≥ 0` — which is exactly the assertion that would have
 * passed while the reconstruction above was drifting. With a scripted clock the sums are exact, so
 * "the total is the sum of its parts" becomes a real claim.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderCensus } from './renderCensus'

/** The `performance.now()` readings the census will take, in order. */
let clock: number[] = []

beforeEach(() => {
  clock = []
  vi.spyOn(performance, 'now').mockImplementation(() => clock.shift() ?? 0)
  // `enable()` and `dump()` narrate; keep the suite's output about the suite.
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'table').mockImplementation(() => {})
})

afterEach(() => {
  renderCensus.disable()
  vi.restoreAllMocks()
})

/**
 * One render, with an exact layout term and an exact total.
 *
 * The census reads the clock four times per render — `beginRender`, `beginLayout`, `endLayout`,
 * `endRender` — so four scripted readings is one render.
 */
function render(cause: string, opts: { layoutMs?: number; totalMs?: number; parts?: Array<[Parameters<typeof renderCensus.layoutSub>[0], number]>; redrawn?: [number, number] } = {}): void {
  const layout = opts.layoutMs ?? 0
  const total = opts.totalMs ?? layout
  clock.push(0, 0, layout, total)
  renderCensus.setCause(cause)
  renderCensus.beginRender()
  renderCensus.beginLayout()
  for (const [part, ms] of opts.parts ?? []) renderCensus.layoutSub(part, ms)
  renderCensus.endLayout()
  if (opts.redrawn) renderCensus.measuresRedrawn(opts.redrawn[0], opts.redrawn[1])
  renderCensus.endRender()
}

describe('the part accumulators live exactly as long as the total they are a share of', () => {
  it('🚨 reset() clears the parts, so a second enable() does not carry the first run in', () => {
    renderCensus.enable()
    render('firstRun', { layoutMs: 10, totalMs: 20, parts: [['columns', 8]] })
    expect(renderCensus.report().parts.columns).toBe(8)

    // The exact gesture that produced the 259%: dump, keep editing, enable again.
    renderCensus.dump()
    renderCensus.enable()

    // ⭐ Named, not counted: the failure message says WHICH part survived the reset.
    const survived = Object.entries(renderCensus.report().parts).filter(([, ms]) => ms !== 0)
    expect(survived).toEqual([])
  })

  it('🚨 …and so a part can never exceed the render time it is reported against', () => {
    renderCensus.enable()
    render('firstRun', { layoutMs: 10, totalMs: 20, parts: [['columns', 19]] })
    renderCensus.dump()

    renderCensus.enable()
    render('secondRun', { layoutMs: 1, totalMs: 4, parts: [['columns', 3]] })

    const r = renderCensus.report()
    // Before the fix this was 22 against a total of 4 — the printed 259%.
    expect(r.parts.columns).toBe(3)
    expect(r.parts.columns).toBeLessThanOrEqual(r.totalMs)
  })

  it('records nothing at all once disabled', () => {
    renderCensus.enable()
    renderCensus.disable()
    render('ignored', { layoutMs: 5, totalMs: 5, parts: [['laneView', 5]] })

    const r = renderCensus.report()
    expect(r.renders).toBe(0)
    expect(r.parts.laneView).toBe(0)
  })
})

describe('the totals are sums, not reconstructions', () => {
  it('🚨 layoutMs is the raw sum — not round(avg) × n, which drifts', () => {
    renderCensus.enable()
    // 0.44 ms of layout, three times: the true sum is 1.32. The old reconstruction rounded the
    // average to 0.4 and multiplied back to 1.2 — a 9% error invented by the reporting.
    for (let i = 0; i < 3; i++) render('drifty', { layoutMs: 0.44, totalMs: 1 })

    const r = renderCensus.report()
    expect(r.layoutMs).toBeCloseTo(1.32, 10)
    expect(r.causes[0]['layout ms (avg)']).toBe(0.4) // the DISPLAY still rounds; the sum does not
  })

  it('totals and render counts add up across causes', () => {
    renderCensus.enable()
    render('a', { layoutMs: 2, totalMs: 10 })
    render('a', { layoutMs: 2, totalMs: 20 })
    render('b', { layoutMs: 1, totalMs: 5 })

    const r = renderCensus.report()
    expect(r.renders).toBe(3)
    expect(r.totalMs).toBe(35)
    expect(r.layoutMs).toBe(5)
    // Sorted by total time spent, so the heaviest cause is the one you read first.
    expect(r.causes.map(c => c.cause)).toEqual(['a', 'b'])
    expect(r.causes[0]).toMatchObject({ renders: 2, 'total ms': 30, 'avg ms': 15, 'worst ms': 20 })
  })

  it('the draw term is what the layout term is not', () => {
    renderCensus.enable()
    render('c', { layoutMs: 3, totalMs: 11 })

    expect(renderCensus.report().causes[0]['draw ms (avg)']).toBe(8)
  })
})

describe('the redraw rate — the number that says whether P5 works', () => {
  it('is redrawn over owned, per cause', () => {
    renderCensus.enable()
    render('drag', { totalMs: 1, redrawn: [0, 128] })
    render('drag', { totalMs: 1, redrawn: [16, 128] })

    // 16 of 256 measure-staves across the two frames.
    expect(renderCensus.report().causes[0]['redrawn %']).toBe(6.3)
  })

  it('⚠️ reads 0, not NaN, when a render owned no measures at all', () => {
    renderCensus.enable()
    render('empty', { totalMs: 1 })

    expect(renderCensus.report().causes[0]['redrawn %']).toBe(0)
  })
})

describe('the residual — the seven regions must TILE the render, never overlap it', () => {
  it('⭐ unaccounted is the render minus the layout bracket minus every region', () => {
    renderCensus.enable()
    render('r', {
      layoutMs: 2,
      totalMs: 20,
      parts: [['tier1', 3], ['plan', 1], ['shapeKey', 4], ['groups', 2], ['curves', 1], ['ladder', 5], ['hint', 1]],
    })

    const r = renderCensus.report()
    // 20 total − 2 layout − 17 regions = 1 ms nobody claimed (the header).
    expect(r.unaccountedMs).toBeCloseTo(1, 10)
  })

  it('🚨 a part INSIDE another is never subtracted twice — that is the 259% bug in another hat', () => {
    renderCensus.enable()
    // `fingerprint` is spent inside `shapeKey`; counting it again would drive the remainder to -3.
    render('r', { layoutMs: 0, totalMs: 10, parts: [['shapeKey', 8], ['fingerprint', 5]] })

    expect(renderCensus.report().unaccountedMs, 'only shapeKey is a region').toBeCloseTo(2, 10)
  })

  it('⚠️ …and it never goes negative, however the clocks land', () => {
    renderCensus.enable()
    render('r', { layoutMs: 0, totalMs: 1, parts: [['ladder', 99]] })

    expect(renderCensus.report().unaccountedMs).toBe(0)
  })
})
