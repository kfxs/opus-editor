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

type Case = { flat: boolean; staff2: boolean; hand?: 'A' | 'B'; solver?: string; rules?: Record<string, string> }

/** One of his cases, drawn and measured — every length in staff spaces. */
async function measureCase(score: import('@playwright/test').Page, opts: Case) {
  return score.evaluate(async (opts: Case) => {
    const h = window.__h
    // 🚨 FIRST — a render that beats the font measures the flat 0 wide and places it by the wrong note.
    await h.fontReady()
    // ⭐ Since P5 the default is `lilypond`: the baseline arms `house` itself, and its numbers stay pinned.
    const solver = opts.solver ?? 'house'
    if (!h.slurSolver(solver)) throw new Error(`no slur solver ${solver}`)
    for (const [row, choice] of Object.entries(opts.rules ?? {})) {
      if (!h.slurRule(row, choice)) throw new Error(`no slur rule ${row} ${choice}`)
    }
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

/**
 * ⭐ P6 — a BROKEN slur under `lilypond`: each system's piece searched on its own, with its line-break end.
 * Asserted: one piece per system, each a finite curve ABOVE its staff (the notes are high, stems down).
 * The shapes are LOGGED for his eye.
 */
test.describe('⭐ P6 — a slur broken across systems, under `lilypond`', () => {
  for (const [name, systems] of [['two pieces', 2], ['three pieces — a middle one', 3]] as const) {
    test(name, async ({ score }) => {
      const out = await score.evaluate(async (systems: number) => {
        const h = window.__h
        await h.fontReady()
        h.slurSolver('lilypond')
        const ids: string[] = []
        for (let m = 1; m <= 60; m++) {
          if (m > 1) h.engine.addMeasure()
          ids.push(h.engine.addNoteAtBeat({ step: m % 2 ? 'D' : 'F', octave: 5, duration: 'w', measure: m, beat: h.frac(0, 1) })!.id)
        }
        await h.render()
        // The first bar of each system — measures on one system share their stave's top y.
        const tops = h.staves().filter(st => st.staff === 0).map(st => st.top)
        const starts = [0]
        for (let i = 1; i < tops.length; i++) if (Math.abs(tops[i] - tops[i - 1]) > 1) starts.push(i)
        if (starts.length < systems + 1) return null
        // From the last bar of system 1 to the first bar of system `systems`.
        h.engine.slur.createSlur([ids[starts[1] - 1], ids[starts[systems - 1]]])
        await h.render()
        const sp = (tops.length ? h.staves()[0].bottom - h.staves()[0].top : 40) / 4
        // ⚠️ One piece is TWO paths — its outline (`fill="none"`) and its fill; count the outlines.
        const pieces = [...document.querySelectorAll('g.slur path[fill="none"]')].map(p => p.getAttribute('d') ?? '').map(d =>
          [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] })))
        const systemTops = starts.slice(0, systems).map(i => tops[i])
        return pieces.map(p => {
          const top = systemTops.reduce((a, t) => (Math.abs(t - p[0].y) < Math.abs(a - p[0].y) ? t : a))
          return {
            finite: p.every(q => Number.isFinite(q.x) && Number.isFinite(q.y)),
            aboveStaff: Math.min(...p.map(q => q.y)) < top,
            riseSp: +((p[0].y - p[3].y) / sp).toFixed(2),
            lengthSp: +((p[3].x - p[0].x) / sp).toFixed(2),
          }
        })
      }, systems)
      expect(out, 'the fixture breaks into enough systems').not.toBeNull()
      console.log(`[lilypond P6] ${name}`, JSON.stringify(out))
      expect(out!).toHaveLength(systems)
      for (const piece of out!) {
        expect(piece.finite).toBe(true)
        expect(piece.aboveStaff).toBe(true)
      }
    })
  }
})

/**
 * ⭐ P8 row A — an unbeamed end on the STEM side: his D → G (both stems up, the slur above). Under `lilypond`
 * the rule `stemSideEnd` picks head (LilyPond) or stem end (Gould p. 111); measured against the drawn stems.
 */
test('⭐ P8 row A — `stemSideEnd` moves the ends from the heads to the stem ends', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    // Two low-ish notes: both stems UP; the slur forced ABOVE, onto the stem side.
    const a = e.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })!
    const b = e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', measure: 1, beat: h.frac(2, 1) })!
    e.getScore().slurs = [{ id: 'sl', startNoteId: a.id, endNoteId: b.id, voice: 0, placement: 'above' }]
    const ends = async (choice: string) => {
      h.slurRule('stemSideEnd', choice)
      await h.render()
      const d = document.querySelector('g.slur path[fill="none"]')?.getAttribute('d') ?? ''
      const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
      return [p[0].y, p[3].y]
    }
    const head = await ends('head')
    const stem = await ends('stem')
    // The LOWER of the two stem tips (the larger y) — both ends are compared with it.
    const tipY = Math.max(...h.stems().map(st => Math.min(st.y1, st.y2)))
    return { head, stem, tipY }
  })
  // `head`: both ends below the (lower) stem tip — at the heads. `stem`: both above it — past the tips.
  expect(Math.max(...out.head)).toBeGreaterThan(out.tipY)
  expect(Math.max(...out.stem)).toBeLessThan(out.tipY)
})

/**
 * ⭐ P8 row B — where an end stands in x. His D → G again (both stems up, slur above): LilyPond puts the END
 * beside its stem's left edge, over the head's right half; `house` keeps it at the head's centre.
 */
test('⭐ P8 row B — `endX: house` keeps the end over its head\'s centre', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    const a = e.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })!
    const b = e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', measure: 1, beat: h.frac(2, 1) })!
    e.getScore().slurs = [{ id: 'sl', startNoteId: a.id, endNoteId: b.id, voice: 0, placement: 'above' }]
    const endX = async (choice: string) => {
      h.slurRule('endX', choice)
      await h.render()
      const d = document.querySelector('g.slur path[fill="none"]')?.getAttribute('d') ?? ''
      const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
      return p[3].x
    }
    const lily = await endX('lilypond')
    const house = await endX('house')
    // The END note's head: the rightmost notehead; a head glyph is ~1.18 sp wide from its x.
    const head = h.noteheads().sort((p, q) => q.x - p.x)[0]
    const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
    return { lily, house, headCentre: head.x + 0.59 * sp, sp }
  })
  expect(Math.abs(out.house - out.headCentre)).toBeLessThan(0.15 * out.sp)
  // LilyPond's end stands right of the head's centre — beside the stem.
  expect(out.lily - out.headCentre).toBeGreaterThan(0.1 * out.sp)
})

/**
 * ⭐ P8 row C — how much the slur tilts with the melody: `e2e/slur.e2e.ts`'s tilt cases (opposite stems, one
 * note per bar) under `lilypond`, with `tilt` LilyPond's (the whole rise + 0.2) vs `house` (Gould p. 111: half).
 */
test('⭐ P8 row C — `tilt: house` holds a rise over opposite stems to about half the interval', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    const rise = async (a: [string, number], b: [string, number], tilt: string) => {
      e.loadJSON(JSON.stringify({ id: 's', title: '', measures: [{ id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], timeSignatureChange: true }] }))
      e.addMeasure()
      const x = e.addNoteAtBeat({ step: a[0] as never, octave: a[1], duration: 'q', measure: 1, beat: h.frac(0, 1) })!
      const y = e.addNoteAtBeat({ step: b[0] as never, octave: b[1], duration: 'q', measure: 2, beat: h.frac(0, 1) })!
      e.slur.createSlur([x.id, y.id])
      h.slurRule('tilt', tilt)
      await h.render()
      const d = document.querySelector('g.slur path[fill="none"]')?.getAttribute('d') ?? ''
      const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
      const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
      return +((p[0].y - p[3].y) / sp).toFixed(2)
    }
    return {
      step: { lilypond: await rise(['A', 4], ['B', 4], 'lilypond'), house: await rise(['A', 4], ['B', 4], 'house') },
      tenth: { lilypond: await rise(['C', 4], ['E', 5], 'lilypond'), house: await rise(['C', 4], ['E', 5], 'house') },
    }
  })
  console.log('[row C]', JSON.stringify(out))
  // The tenth is 4.5 sp: `house` at most half + LilyPond's own 0.2 slack; LilyPond's own rule rises further.
  expect(out.tenth.house).toBeLessThanOrEqual(2.25 + 0.2 + 0.05)
  expect(out.tenth.lilypond).toBeGreaterThan(out.tenth.house)
  // Both still rise WITH the melody.
  expect(out.step.house).toBeGreaterThan(0)
})

/**
 * ⭐ P8 row D — a broken slur's OPEN end: `e2e/slur.e2e.ts`'s "leans toward its own music" case with broken
 * slurs under `lilypond`. `openEnd: 'lilypond'` is level whatever follows the break; `'house'` leans (Gould p. 112).
 */
test('⭐ P8 row D — `openEnd: house` leans the open end toward the music across the break', async ({ score }) => {
  const rise = async (endOctave: number, openEnd: string) => score.evaluate(async ({ endOctave, openEnd }) => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    h.slurRule('openEnd', openEnd)
    const e = h.engine
    e.loadJSON(JSON.stringify({ id: 's', title: '', measures: [{ id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], timeSignatureChange: true }] }))
    const ids: string[] = []
    for (let m = 1; m <= 40; m++) {
      if (m > 1) e.addMeasure()
      ids.push(e.addNoteAtBeat({ step: 'C', octave: 5, duration: 'w', measure: m, beat: h.frac(0, 1) })!.id)
    }
    await h.render()
    const tops = h.staves().map(st => st.top)
    let broken = -1
    for (let i = 1; i < tops.length; i++) if (Math.abs(tops[i] - tops[i - 1]) > 1) { broken = i; break }
    e.updateNote(ids[broken], { step: 'C', octave: endOctave })
    e.slur.createSlur([ids[broken - 1], ids[broken]])
    await h.render()
    const parsed = [...document.querySelectorAll('g.slur path[fill="none"]')]
      .map(p => [...(p.getAttribute('d') ?? '').matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] })))
    const begin = parsed.reduce((best, p) => (p[0].y < best[0].y ? p : best), parsed[0])
    const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
    return (begin[0].y - begin[3].y) / sp
  }, { endOctave, openEnd })
  const level = [await rise(6, 'lilypond'), await rise(4, 'lilypond')]
  const leaning = [await rise(6, 'house'), await rise(4, 'house')]
  console.log('[row D]', JSON.stringify({ level, leaning }))
  expect(level[0]).toBe(level[1])
  expect(leaning[0]).toBeGreaterThan(leaning[1])
})

/**
 * ⭐ P8 row E — an accidental under the slur: his E♭ examples under `lilypond`, the accidental priced at
 * LilyPond's 3 (it may graze) or at 50 like any object (`'clear'` — what his hand shapes did).
 */
test.describe('⭐ P8 row E — `accidental: clear` clears his flat', () => {
  for (const staff2 of [false, true]) {
    test(staff2 ? 'two staves' : 'one staff', async ({ score }) => {
      const m = await measureCase(score, { flat: true, staff2, solver: 'lilypond', rules: { accidental: 'clear' } })
      console.log(`[row E] ${staff2 ? '2 staves' : '1 staff'}`, JSON.stringify(m))
      expect(m.clearsFlat!).toBeGreaterThanOrEqual(0)
    })
  }
})

/**
 * ⭐ P8 row G — ties under the slur: a slur ABOVE over two tied notes that sit high enough for the tie to curve
 * up under it. `ties: 'on'` (LilyPond) must keep the slur clear of the tie's drawn ink.
 */
test('⭐ P8 row G — `ties: on` keeps the slur clear of a tie under it', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    e.addMeasure()
    // G5 (stem down) tied to G5, then A5: the tie curves ABOVE (away from the down stems), under the slur.
    const a = e.addNoteAtBeat({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: h.frac(0, 1) })!
    const b = e.addNoteAtBeat({ step: 'G', octave: 5, duration: 'q', measure: 1, beat: h.frac(1, 1) })!
    const c = e.addNoteAtBeat({ step: 'G', octave: 5, duration: 'q', measure: 1, beat: h.frac(2, 1) })!
    const d = e.addNoteAtBeat({ step: 'F', octave: 5, duration: 'q', measure: 1, beat: h.frac(3, 1) })!
    e.updateNote(b.id, { tiedTo: c.id } as never)
    e.updateNote(c.id, { tiedFrom: b.id } as never)
    e.getScore().slurs = [{ id: 'sl', startNoteId: a.id, endNoteId: d.id, voice: 0, placement: 'above' }]
    const gap = async (ties: string) => {
      h.slurRule('ties', ties)
      await h.render()
      const tie = h.curveSamples('g.tie path', 60)
      const slur = h.curveSamples('g.slur path', 200)
      if (!tie.length) return null
      // The slur's y just above each tie sample's x — the smallest vertical room between them.
      const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
      let min = Infinity
      for (const t of tie) {
        const s0 = slur.reduce((best, q) => (Math.abs(q.x - t.x) < Math.abs(best.x - t.x) ? q : best))
        min = Math.min(min, (t.y - s0.y) / sp)
      }
      return +min.toFixed(2)
    }
    return { off: await gap('off'), on: await gap('on') }
  })
  console.log('[row G ties]', JSON.stringify(out))
  expect(out.on, 'the fixture draws a tie').not.toBeNull()
  expect(out.on!).toBeGreaterThan(0)
  expect(out.on!).toBeGreaterThanOrEqual(out.off!)
})

/**
 * ⭐ P8 row G — a slur NESTED under another: C5 … G5 over a small D5 → E5 slur (the P4 gallery's case, where the
 * outer came down onto the inner). `nested: 'on'` (LilyPond) must keep the outer clear of the inner's ink.
 */
test('⭐ P8 row G — `nested: on` keeps the outer slur clear of the one inside it', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    e.addMeasure()
    const n = (step: string, octave: number, m: number, b: number) =>
      e.addNoteAtBeat({ step: step as never, octave, duration: 'q', measure: m, beat: h.frac(b, 1) })!.id
    const ids = [n('C', 5, 1, 0), n('D', 5, 1, 1), n('E', 5, 1, 2), n('F', 5, 1, 3), n('G', 5, 2, 0)]
    // ⚠️ The OUTER first in the score, so drawing innermost-first is the renderer's doing, not the order given.
    e.getScore().slurs = [
      { id: 'outer', startNoteId: ids[0], endNoteId: ids[4], voice: 0 },
      { id: 'inner', startNoteId: ids[1], endNoteId: ids[2], voice: 0 },
    ]
    const gap = async (nested: string) => {
      h.slurRule('nested', nested)
      await h.render()
      const inner = h.curveSamples('#slur-inner path', 60)
      const outer = h.curveSamples('#slur-outer path', 200)
      const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
      let min = Infinity
      for (const t of inner) {
        const o = outer.reduce((best, q) => (Math.abs(q.x - t.x) < Math.abs(best.x - t.x) ? q : best))
        min = Math.min(min, (t.y - o.y) / sp)
      }
      return +min.toFixed(2)
    }
    return { off: await gap('off'), on: await gap('on') }
  })
  console.log('[row G nested]', JSON.stringify(out))
  expect(out.on).toBeGreaterThan(0.3)
  expect(out.on).toBeGreaterThan(out.off)
})

/**
 * ⭐ P8 row G — an end note's FLAG: a flagged eighth (stem up) starting a slur ABOVE. `flags: 'on'` (LilyPond)
 * starts the slur past the flag; `'off'` beside the stem alone.
 */
test('⭐ P8 row G — `flags: on` starts the slur past the flag', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    e.addMeasure()
    const a = e.addNoteAtBeat({ step: 'E', octave: 4, duration: '8', measure: 1, beat: h.frac(0, 1) })!
    const b = e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', measure: 2, beat: h.frac(0, 1) })!
    e.getScore().slurs = [{ id: 'sl', startNoteId: a.id, endNoteId: b.id, voice: 0, placement: 'above' }]
    const startX = async (flags: string) => {
      h.slurRule('flags', flags)
      await h.render()
      const d = document.querySelector('g.slur path[fill="none"]')?.getAttribute('d') ?? ''
      return +(d.match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN)
    }
    const off = await startX('off')
    const on = await startX('on')
    const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
    return { off, on, sp }
  })
  console.log('[row G flags]', JSON.stringify({ shiftSp: +((out.on - out.off) / out.sp).toFixed(2) }))
  // Past the flag: about a flag's width further right.
  expect(out.on - out.off).toBeGreaterThan(0.5 * out.sp)
})

/**
 * ⭐ P8 row G — a TUPLET NUMBER under the slur: a slur ABOVE over an eighth triplet whose '3' stands above it.
 * `tupletNumbers: 'on'` (LilyPond) keeps the curve above the number.
 */
test('⭐ P8 row G — `tupletNumbers: on` keeps the slur above a triplet\'s number', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    const a = e.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })!
    const t = e.createTupletAtBeat(1, 1, '8', { step: 'C', alter: 0, octave: 5 })!
    e.addNoteAtBeat({ step: 'D', octave: 5, duration: '8', measure: 1, beat: h.frac(4, 3), tupletId: t.tuplet.id, actualDuration: h.frac(1, 3) } as never)
    e.addNoteAtBeat({ step: 'E', octave: 5, duration: '8', measure: 1, beat: h.frac(5, 3), tupletId: t.tuplet.id, actualDuration: h.frac(1, 3) } as never)
    const b = e.addNoteAtBeat({ step: 'F', octave: 5, duration: 'q', measure: 1, beat: h.frac(2, 1) })!
    e.getScore().slurs = [{ id: 'sl', startNoteId: a.id, endNoteId: b.id, voice: 0, placement: 'above' }]
    const sp = () => (h.staves()[0].bottom - h.staves()[0].top) / 4
    const at = async (rule: string) => {
      h.slurRule('tupletNumbers', rule)
      await h.render()
      const digit = h.placed('g.tuplet text')[0]
      const slur = h.curveSamples('g.slur path', 200)
      if (!digit || !slur.length) return null
      const over = slur.reduce((best, q) => (Math.abs(q.x - digit.x) < Math.abs(best.x - digit.x) ? q : best))
      // How far the slur passes above the number's BASELINE, in staff spaces.
      return +((digit.y - over.y) / sp()).toFixed(2)
    }
    return { off: await at('off'), on: await at('on') }
  })
  console.log('[row G tuplet numbers]', JSON.stringify(out))
  expect(out.on, 'the fixture draws a number and a slur').not.toBeNull()
  expect(out.on!).toBeGreaterThanOrEqual(out.off!)
  // A tuplet digit stands about a space tall: the slur must pass above that.
  expect(out.on!).toBeGreaterThan(1)
})

/**
 * ⭐ P8 row G — a METER CHANGE inside the slur: G4 → A4 across a 3/4, the slur forced above with its ends inside
 * the staff, so its arch meets the meter's digits. `headerSigns: 'on'` (LilyPond) arches over them.
 */
test('⭐ P8 row G — `headerSigns: on` arches the slur over a meter change inside it', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    e.addMeasure()
    const a = e.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: h.frac(3, 1) })!
    e.setTimeSignature(2, { numerator: 3, denominator: 4 })
    const b = e.addNoteAtBeat({ step: 'A', octave: 4, duration: 'q', measure: 2, beat: h.frac(0, 1) })!
    e.getScore().slurs = [{ id: 'sl', startNoteId: a.id, endNoteId: b.id, voice: 0, placement: 'above' }]
    const gap = async (rule: string) => {
      h.slurRule('headerSigns', rule)
      await h.render()
      const meter = e.getElementRegistry().getByType('timeSignature').find(el => el.measure === 2)
      const slur = h.curveSamples('g.slur path', 200)
      if (!meter || !slur.length) return null
      const cx = meter.bbox.x + meter.bbox.width / 2
      const over = slur.reduce((best, q) => (Math.abs(q.x - cx) < Math.abs(best.x - cx) ? q : best))
      const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
      // How far above the meter's TOP the slur passes (negative = through it).
      return +((meter.bbox.y - over.y) / sp).toFixed(2)
    }
    return { off: await gap('off'), on: await gap('on') }
  })
  console.log('[row G header signs]', JSON.stringify(out))
  expect(out.on, 'the fixture draws a meter change and a slur').not.toBeNull()
  expect(out.on!).toBeGreaterThan(out.off!)
  expect(out.on!).toBeGreaterThanOrEqual(0)
})

/**
 * ⭐ `midAccent` — his T1 rule: A4 C5 [accented note] E5 under a slur, the middle note swept high (C6 → E7), where
 * LilyPond's `around` let the slur slip UNDER the accent (measured 2026-09-27). The default `'inside'` must keep the
 * slur over the accent's top at every pitch.
 */
test('⭐ `midAccent: inside` (default) keeps the slur OVER a high middle note\'s accent', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    const rows: Record<string, Record<string, boolean>> = {}
    for (const choice of ['lilypond', 'inside']) {
      h.slurRule('midAccent', choice)
      rows[choice] = {}
      for (const [step, octave] of [['C', 6], ['F', 6], ['B', 6], ['E', 7]] as const) {
        e.loadJSON(JSON.stringify({ id: 's', title: '', measures: [{ id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], timeSignatureChange: true }] }))
        const n = (st: string, oc: number, b: number) => e.addNoteAtBeat({ step: st as never, octave: oc, duration: 'q', measure: 1, beat: h.frac(b, 1) })!.id
        const a = n('A', 4, 0); n('C', 5, 1); const mid = n(step, octave, 2); const z = n('E', 5, 3)
        e.toggleArticulation(mid, 'accent')
        e.slur.createSlur([a, z])
        await h.render()
        const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
        const g = h.placed('text').find(t => t.code === 'e4a0')!
        const accTop = g.y - 0.72 * sp
        const near = h.curveSamples('g.slur path', 300).filter(q => Math.abs(q.x - (g.x + 0.68 * sp)) < 0.3 * sp).map(q => q.y)
        rows[choice][`${step}${octave}`] = Math.max(...near) < accTop
      }
    }
    return rows
  })
  console.log('[midAccent] slur over the accent?', JSON.stringify(out))
  for (const over of Object.values(out.inside)) expect(over).toBe(true)
  // …where LilyPond's own `around` let it slip under at least one of these pitches.
  expect(Object.values(out.lilypond).some(over => !over)).toBe(true)
})

/**
 * ⭐ `endHead` — a slur ending on a chord with a displaced SECOND (G5 + A5, the slur below): `'own'` (LilyPond)
 * reads the bottom head's own glyph, `'chord'` the chord's whole span. Logged; asserted only that both draw.
 */
test('⭐ `endHead: own` reads the end chord\'s own head, not its whole span', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    const a = e.addNoteAtBeat({ step: 'C', octave: 5, duration: 'h', measure: 1, beat: h.frac(0, 1) })!
    const b = e.addNoteAtBeat({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: h.frac(2, 1) })!
    e.addChordNote({ step: 'A', octave: 5, duration: 'h', measure: 1, beat: h.frac(2, 1) } as never)
    // ⚠️ BELOW, the heads' side: the chord's stem points up, so a slur ABOVE ends beside the stem and never reads
    //   a head's extent at all.
    e.getScore().slurs = [{ id: 'sl', startNoteId: a.id, endNoteId: b.id, voice: 0, placement: 'below' }]
    const end = async (rule: string) => {
      h.slurRule('endHead', rule)
      await h.render()
      const d = document.querySelector('g.slur path[fill="none"]')?.getAttribute('d') ?? ''
      const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
      return p[3]
    }
    const chord = await end('chord')
    const own = await end('own')
    const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
    return { dx: +((own.x - chord.x) / sp).toFixed(2), dy: +((own.y - chord.y) / sp).toFixed(2) }
  })
  console.log('[endHead] own − chord, sp', JSON.stringify(out))
  // ⚠️ Measured: the same here — the slur below reads the UNDISPLACED lower head, and the ruler's span is already
  //   the main column. The row only moves an end that falls back to a DISPLACED head's centre (a short or steep slur
  //   on the stem side); asserted here that both choices draw.
  expect(Number.isFinite(out.dx) && Number.isFinite(out.dy)).toBe(true)
})

/**
 * ⭐ `rests` — a slur ENDING on a quarter rest, above: `'lilypond'` reads the rest glyph as the end's head, so the end
 * stands over the rest's centre, clear of its top (Bravura's quarter rest reaches 1.49 sp above its origin).
 */
test('⭐ `rests: lilypond` ends a slur over a rest\'s centre, clear of its top', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    await h.fontReady()
    h.slurSolver('lilypond')
    const e = h.engine
    const a = e.addNoteAtBeat({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: h.frac(0, 1) })!
    e.addNoteAtBeat({ step: 'F', octave: 5, duration: 'q', measure: 1, beat: h.frac(1, 1) })
    e.addNoteAtBeat({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: h.frac(3, 1) })
    const sc = e.getScore()
    const rest = sc.measures[0].slots.find(s => s.type === 'rest' && s.beat.num / s.beat.den === 2)!
    sc.slurs = [{ id: 'sl', startNoteId: a.id, endNoteId: rest.id, voice: 0, placement: 'above' }]
    const end = async (rule: string) => {
      h.slurRule('rests', rule)
      await h.render()
      const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
      const d = document.querySelector('g.slur path[fill="none"]')?.getAttribute('d') ?? ''
      const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
      const r = h.rests().find(g => g.code === 'e4e5')!
      return { overTopSp: +((r.y - 1.49 * sp - p[3].y) / sp).toFixed(2), fromCentreSp: +((p[3].x - (r.x + 0.54 * sp)) / sp).toFixed(2) }
    }
    return { asNote: await end('asNote'), lilypond: await end('lilypond') }
  })
  console.log('[rests]', JSON.stringify(out))
  expect(out.lilypond.overTopSp).toBeGreaterThan(0)
  expect(Math.abs(out.lilypond.fromCentreSp)).toBeLessThan(0.2)
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
