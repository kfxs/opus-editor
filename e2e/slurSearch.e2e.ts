import { test, expect } from './fixtures'

/**
 * SLURS BY SEARCH — P0: the net and the stopwatch (docs/plans/slur-search-plan.md §4). ⛔ No behaviour
 * change: everything here READS today's slur.
 *
 * 1. **The net.** His three examples of 2026-09-27 — B4 E(♭)5 | A4 D5 G5, slurred B4 → G5, one staff and
 *    then with eighths on a second — measured on drawn ink exactly as the plan's §1 table was, and
 *    pinned to 0.01 sp. They are TODAY's pipeline — the `house` preset once P1 names it — so P1 (the seam,
 *    "no pixel moves") must pass them unchanged. ⭐ Since P5 `lilypond` is the default, so these arm
 *    `house` themselves — ⛔ never re-pin these numbers to the new pictures.
 *    ⭐ His two HAND shapes (the `curveShape` + `endpointOffset` overrides he drew) are pinned too — they
 *    are the target: each clears the flat by 0.20 sp, raises the near end and leans the arch toward it.
 * 2. **The stopwatch.** What a slur costs today, per slur, from the render census's `curves` part: the
 *    number P4's search is judged against (under ~0.5 ms a slur). LOGGED, not asserted — it is this
 *    machine's.
 *    ⚠️ Read it from a run of THIS FILE ALONE (`-g stopwatch`): beside other spec files the workers share
 *    the CPU and it doubles (measured 2026-09-27: 0.20 → 0.42 ms), which reads as a regression that is not.
 */

type Case = { flat: boolean; staff2: boolean; hand?: 'A' | 'B'; solver?: string }

/** One of his cases, drawn and measured — every length in staff spaces. */
async function measureCase(score: import('@playwright/test').Page, opts: Case) {
  return score.evaluate(async (opts: Case) => {
    const h = window.__h
    // 🚨 FIRST — a render that beats the font measures the flat 0 wide and places it by the wrong note.
    await h.fontReady()
    // ⭐ Since P5 the default is `lilypond`: the baseline arms `house` itself, and its numbers stay pinned.
    const solver = opts.solver ?? 'house'
    if (!h.slurSolver(solver)) throw new Error(`no slur solver ${solver}`)
    const e = h.engine
    e.loadJSON(JSON.stringify({
      id: 's', title: '',
      measures: [{ id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], timeSignatureChange: true }],
    }))
    // His score had 64 bars; the casting-off (how much room bar 1 gets) is part of the picture.
    for (let i = 1; i < 64; i++) e.addMeasure()
    const q = (step: string, octave: number, measure: number, beat: number, alter = 0) =>
      e.addNoteAtBeat({ step: step as never, alter: alter as never, octave, duration: 'q', measure, beat: h.frac(beat, 1) })
    if (opts.staff2) {
      // The second staff changes nothing about the slur — its eighth at beat 2½ adds a COLUMN, which
      // widens B4 → E♭5 and carries the flat across the edge discount (§1).
      e.addStaffBelow(0)
      ;['C', 'D', 'E', 'F', 'G'].forEach((s, i) =>
        e.addNoteAtBeat({ step: s as never, octave: 4, duration: '8', measure: 1, beat: h.frac(i, 2), staff: 1 }))
    }
    const b = q('B', 4, 1, 2)!
    q('E', 5, 1, 3, opts.flat ? -1 : 0)
    q('A', 4, 2, 0); q('D', 5, 2, 1)
    const g = q('G', 5, 2, 2)!
    const sc = e.getScore()
    sc.slurs = [{ id: 'sl', startNoteId: b.id, endNoteId: g.id, voice: 0 }]
    // His hand shapes, as he left them (one staff: A; two staves: B).
    if (opts.hand === 'A') sc.engravingOverrides = { sl: [
      { kind: 'endpointOffset', start: { x: -0.25, y: -0.75 }, end: { x: 0, y: -0.5 } },
      { kind: 'curveShape', cps: [{ x: 0, y: 4.2023 }, { x: 0, y: 1.8163 }] }] } as never
    if (opts.hand === 'B') sc.engravingOverrides = { sl: [
      { kind: 'curveShape', cps: [{ x: 0, y: 3.726 }, { x: 0.5, y: 1.7929 }] },
      { kind: 'endpointOffset', start: { x: 0, y: -0.5 } }] } as never
    await h.render()

    const stave = h.staves().find(s => s.measure === 1 && s.staff === 0)!
    const sp = (stave.bottom - stave.top) / 4
    const r2 = (v: number) => Math.round(v * 100) / 100
    const curve = h.curveSamples('g.slur path', 200)
    const xs = curve.map(p => p.x)
    const left = curve[xs.indexOf(Math.min(...xs))]
    const right = curve[xs.indexOf(Math.max(...xs))]
    const top = curve.reduce((a, p) => (p.y < a.y ? p : a))
    const nearest = (x: number) => curve.reduce((a, c) => (Math.abs(c.x - x) < Math.abs(a.x - x) ? c : a))
    const chordAt = (x: number) => left.y + ((x - left.x) / (right.x - left.x)) * (right.y - left.y)
    const mid = nearest((left.x + right.x) / 2)
    // Bravura's accidentalFlat: 0.904 sp wide, its ascender 1.756 sp above its origin (the note's line).
    const f = h.placed('g.accidental text').find(a => a.x > left.x - 5 * sp && a.x < right.x)
    const flat = f && { x: f.x, top: f.y - 1.756 * sp }
    return {
      /** How high the arch stands over the chord of its ends, at the middle. */
      archAtMiddle: r2((chordAt(mid.x) - mid.y) / sp),
      /** The curve's highest point above the staff's top line. */
      peakAboveStaff: r2((stave.top - top.y) / sp),
      /** The flat's left edge, measured from the slur's start. */
      flatFromStart: flat ? r2((flat.x - left.x) / sp) : null,
      /** How far the curve passes above the flat's ascender, at its left edge — NEGATIVE = through it. */
      clearsFlat: flat ? r2((flat.top - nearest(flat.x).y) / sp) : null,
    }
  }, opts)
}

test.describe('⭐ his three examples — today\'s slur, pinned (the `house` baseline)', () => {
  test('one staff, E♮ — nothing to clear', async ({ score }) => {
    expect(await measureCase(score, { flat: false, staff2: false }))
      .toEqual({ archAtMiddle: 1.78, peakAboveStaff: 2.25, flatFromStart: null, clearsFlat: null })
  })

  test('🚨 one staff, E♭ — the flat sits inside the edge discount and the slur runs 1.1 sp INTO it', async ({ score }) => {
    // 1.81 sp from the start is inside `SLUR_EDGE_DISCOUNT_SPACES` (2.5): the flat is IGNORED, so the
    // arch is exactly the ♮ one's.
    expect(await measureCase(score, { flat: true, staff2: false }))
      .toEqual({ archAtMiddle: 1.78, peakAboveStaff: 2.25, flatFromStart: 1.81, clearsFlat: -1.12 })
  })

  test('⭐ one staff, E♭, HIS hand shape — raises the near end, leans the arch, clears by 0.20', async ({ score }) => {
    expect(await measureCase(score, { flat: true, staff2: false, hand: 'A' }))
      .toEqual({ archAtMiddle: 2.24, peakAboveStaff: 3.32, flatFromStart: 2.06, clearsFlat: 0.2 })
  })

  test('two staves, E♮ — nothing to clear', async ({ score }) => {
    expect(await measureCase(score, { flat: false, staff2: true }))
      .toEqual({ archAtMiddle: 1.45, peakAboveStaff: 2.02, flatFromStart: null, clearsFlat: null })
  })

  test('🚨 two staves, E♭ — the flat is counted and ONE factor blows up the whole arch', async ({ score }) => {
    // 3.63 sp is past the discount, so `slurArchFit` clears it — with one factor over a cubic pinned at
    // its ends: ×2.6, an arch of 3.74 sp to clear something by 1.15.
    expect(await measureCase(score, { flat: true, staff2: true }))
      .toEqual({ archAtMiddle: 3.74, peakAboveStaff: 4.02, flatFromStart: 3.63, clearsFlat: 1.15 })
  })

  test('⭐ two staves, E♭, HIS hand shape — clears by the same 0.20, with an arch of 2.05', async ({ score }) => {
    expect(await measureCase(score, { flat: true, staff2: true, hand: 'B' }))
      .toEqual({ archAtMiddle: 2.05, peakAboveStaff: 2.76, flatFromStart: 3.63, clearsFlat: 0.2 })
  })
})

/**
 * ⭐ P3 — the SAME examples under `__slur.solver('lilypond')`. ⚠️ P4 is where the pictures are judged, side by
 * side with `house` (plan §4): these LOG what the search drew and assert only what must hold of any answer —
 * a finite curve that arches ABOVE, as the notes ask.
 */
test.describe('⭐ his three examples under the `lilypond` preset (logged for P4)', () => {
  for (const c of [
    { name: '1 staff ♮', flat: false, staff2: false },
    { name: '1 staff ♭', flat: true, staff2: false },
    { name: '2 staves ♮', flat: false, staff2: true },
    { name: '2 staves ♭', flat: true, staff2: true },
  ]) {
    test(c.name, async ({ score }) => {
      const m = await measureCase(score, { flat: c.flat, staff2: c.staff2, solver: 'lilypond' })
      console.log(`[lilypond] ${c.name}`, JSON.stringify(m))
      expect(Number.isFinite(m.archAtMiddle)).toBe(true)
      expect(m.archAtMiddle).toBeGreaterThan(0)
      expect(m.peakAboveStaff).toBeGreaterThan(0)
    })
  }
})

test('⭐ the search is DETERMINISTIC — a saved and reloaded score draws the same slur, to the byte', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    const q = (step: string, octave: number, measure: number, beat: number, alter = 0) =>
      e.addNoteAtBeat({ step: step as never, alter: alter as never, octave, duration: 'q', measure, beat: h.frac(beat, 1) })
    e.addMeasure()
    const b = q('B', 4, 1, 2)!
    q('E', 5, 1, 3, -1); q('A', 4, 2, 0); q('D', 5, 2, 1)
    const g = q('G', 5, 2, 2)!
    e.slur.createSlur([b.id, g.id])
    await h.render()
    const before = h.paths('g.slur path')
    e.loadJSON(e.exportJSON())
    await h.render()
    return { before, after: h.paths('g.slur path') }
  })
  expect(out.before.length).toBeGreaterThan(0)
  expect(out.after).toEqual(out.before)
})

/**
 * ⏱ What today's slurs cost, per slur: the census's `curves` part (ties + slurs) with the slurs, minus
 * the same score without them, over the slurs actually drawn (the cull window may skip some).
 */
async function slurCost(score: import('@playwright/test').Page, json: string, solver = 'house') {
  return score.evaluate(async ({ json, solver }) => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver(solver)
    const RENDERS = 21
    const withSlurs = JSON.parse(json)
    h.engine.loadJSON(JSON.stringify({ ...withSlurs, slurs: [] }))
    const without = await h.timePart('curves', RENDERS)
    h.engine.loadJSON(JSON.stringify(withSlurs))
    const withMs = await h.timePart('curves', RENDERS)
    const drawn = document.querySelectorAll('g.slur').length
    return { slurs: withSlurs.slurs?.length ?? 0, drawn, curvesMs: withMs, withoutMs: without,
      perSlurMs: drawn ? (withMs - without) / drawn : NaN }
  }, { json, solver })
}

test('⏱ the stopwatch — his heaviest real score, the 1ère Gymnopédie', async ({ score }) => {
  const file = await score.evaluate(async () => (await fetch('/opus-editor/examples/gymnopedie.json')).json())
  for (const solver of ['house', 'lilypond']) {
    const cost = await slurCost(score, JSON.stringify(file.score), solver)
    console.log(`[slur cost] gymnopédie ${solver}`, JSON.stringify(cost))
    expect(cost.drawn).toBeGreaterThan(0)
    expect(cost.curvesMs).toBeGreaterThan(0)
  }
})

test('⏱ the stopwatch — a synthetic page of 50 slurs', async ({ score }) => {
  const json = await score.evaluate(async () => {
    const h = window.__h
    const e = h.engine
    e.loadJSON(JSON.stringify({
      id: 's', title: '',
      measures: [{ id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], timeSignatureChange: true }],
    }))
    // 50 bars of four quarters, a slur over each bar — a mixed contour, an accidental in every other bar.
    for (let i = 1; i < 50; i++) e.addMeasure()
    const steps = ['C', 'G', 'E', 'A', 'D', 'B', 'F']
    const slurs = []
    for (let m = 1; m <= 50; m++) {
      const ids = [0, 1, 2, 3].map(b => e.addNoteAtBeat({
        step: steps[(m + b * 3) % 7] as never, alter: (b === 1 && m % 2 ? 1 : 0) as never,
        octave: 4 + ((m + b) % 2), duration: 'q', measure: m, beat: h.frac(b, 1),
      })!.id)
      slurs.push({ id: `sl${m}`, startNoteId: ids[0], endNoteId: ids[3], voice: 0 })
    }
    return JSON.stringify({ ...e.getScore(), slurs })
  })
  for (const solver of ['house', 'lilypond']) {
    const cost = await slurCost(score, json, solver)
    console.log(`[slur cost] 50 slurs ${solver}`, JSON.stringify(cost))
    expect(cost.drawn).toBeGreaterThan(0)
    expect(cost.curvesMs).toBeGreaterThan(0)
  }
})
