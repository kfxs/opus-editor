import { test, expect } from './fixtures'

/**
 * TIES — WHICH WAY THEY BOW, measured on drawn ink.
 *
 * ⚠️ **The browser half of `rendering/tieDirection.ts`.** The rule itself is pure and unit-tested
 * beside the module; what only a browser can answer is whether the two things it is handed are
 * real — the stems VexFlow actually RESOLVED (beaming forces a whole group, so a note's natural
 * direction and its drawn one differ) and the clef in force (a bare `new StaveNote(...)` reports
 * stem direction `1` for every pitch, so jsdom would agree with itself here whatever the rule said).
 *
 * Both tests below fail against the rule we had until 2026-08-15, which compared every note to
 * TREBLE's middle line and never looked at a stem at all.
 */

interface TieSpec {
  clef?: 'treble' | 'bass' | 'alto' | 'tenor'
  /** Notes into measure 1, in order; `beat` is [numerator, denominator]. */
  notes: { step: string; octave: number; duration: string; beat: [number, number] }[]
  /** Index into `notes` of the note the tie starts from (it ties to the next of that pitch). */
  tieFrom: number
}

/** Build one bar, tie one note, and report the drawn tie's ink against the notehead it springs from. */
async function drawTie(score: import('@playwright/test').Page, spec: TieSpec) {
  return score.evaluate(async (spec: TieSpec) => {
    const h = window.__h
    if (spec.clef) h.engine.setClef(1, spec.clef as 'bass')
    const ids = spec.notes.map(n => h.engine.addNoteAtBeat({
      step: n.step, octave: n.octave, duration: n.duration as 'q',
      measure: 1, beat: h.frac(n.beat[0], n.beat[1]),
    })!.id)
    h.engine.toggleTie(ids[spec.tieFrom])
    await h.render()

    const d = [...document.querySelectorAll('g.vf-tie path')]
      .map(p => p.getAttribute('d') ?? '').join(' ')
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)?\s+(-?\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]))
    const head = h.noteheads()[spec.tieFrom]
    const stem = h.stems()[spec.tieFrom]   // stems come back sorted by x, as the heads do
    return {
      headY: head.y,
      tieMinY: Math.min(...ys),
      tieMaxY: Math.max(...ys),
      // A stem that reaches ABOVE its notehead points up; one that hangs below points down.
      stemPointsDown: stem ? Math.max(stem.y1, stem.y2) > head.y : undefined,
    }
  }, spec)
}

/** UP = the arc bows over the notehead (all its ink above it), DOWN = under. */
const sideOf = (r: { headY: number; tieMinY: number; tieMaxY: number }) =>
  r.tieMaxY < r.headY ? 'UP' : r.tieMinY > r.headY ? 'DOWN' : 'across the notehead'

test('🚨 THE BUG: a tie on a BASS staff bows to the side its own stem left free', async ({ score }) => {
  // G3 sits above bass's middle line (D3), so its stem hangs down and the free side is above. The
  // rule we had measured every note against TREBLE's middle line (B4) — G3 is far below that, so it
  // curved DOWN, onto the same side as its own stem, which is the one thing Gould p.64 forbids ("a
  // tie curves away from the stems"). Every note from D3 to A4 on a bass staff was wrong this way.
  //
  // ⚠️ What ANSWERS here is the stem rule, not the clef constant — a drawn note nearly always has a
  // stem to read, so the clef's middle line now only decides when the two stems DISAGREE. That
  // branch is pinned headless in `tieDirection.test.ts`, where the stems can be withheld. Both
  // halves of the fix are needed to turn this test green, and it fails without either.
  const r = await drawTie(score, {
    clef: 'bass',
    notes: [
      { step: 'G', octave: 3, duration: 'q', beat: [0, 1] },
      { step: 'G', octave: 3, duration: 'q', beat: [1, 1] },
    ],
    tieFrom: 0,
  })
  expect(sideOf(r)).toBe('UP')
})

test('⭐⭐ a BEAM-FORCED stem flips the tie — the note\'s own pitch no longer decides', async ({ score }) => {
  // G4 is below treble's middle line, so on staff position alone its tie went DOWN. Beam it into a
  // group reaching high above the staff and the whole group takes DOWN stems; DOWN is now where its
  // own stem hangs, and the tie must take the other side. Only the *resolved* stem knows this — the
  // model's own per-note direction still says up.
  //
  // Sixteenths, so all four beam as ONE group on one beat (eighths would split 2+2 and the two G4s
  // would keep their own up-stems), and the tie joins the two ADJACENT G4s — `toggleTie` always
  // takes the next SLOT, preferring its same pitch.
  const r = await drawTie(score, {
    notes: [
      { step: 'G', octave: 4, duration: '16', beat: [0, 1] },
      { step: 'G', octave: 4, duration: '16', beat: [1, 4] },
      { step: 'A', octave: 5, duration: '16', beat: [1, 2] },
      { step: 'A', octave: 5, duration: '16', beat: [3, 4] },
    ],
    tieFrom: 0,
  })
  // Pinned first, so this can never pass for the wrong reason: the premise is that the beam really
  // did force the low note's stem down.
  expect(r.stemPointsDown, 'the beam group must have forced DOWN stems').toBe(true)
  expect(sideOf(r)).toBe('UP')
})

/**
 * ⭐⭐ §12 PHASE 3 + 3b — one primitive for every tie, and no staff line running along one.
 *
 * Only a browser can say these: the first needs the two halves of a broken tie to be OUR paths
 * rather than VexFlow's, the second needs the drawn ink measured against the drawn staff lines.
 */
async function tieInk(score: import('@playwright/test').Page, step: string, octave: number) {
  return score.evaluate(async ({ step, octave }: { step: string; octave: number }) => {
    const h = window.__h
    const a = h.engine.addNoteAtBeat({ step, octave, duration: 'h', measure: 1, beat: h.frac(0, 1) })!
    h.engine.addNoteAtBeat({ step, octave, duration: 'h', measure: 1, beat: h.frac(2, 1) })!
    h.engine.toggleTie(a.id)
    await h.render()

    // ⚠️ The path's own coordinates are ENDPOINTS and CONTROL POINTS — and a cubic's control sits a
    // THIRD above the ink it draws. Reading `min(y)` off the `d` measures a point the curve never
    // reaches, which is how the first version of this test "found" the apex on a staff line when it
    // was a quarter space clear. Sample the cubic at its midpoint instead: `drawCurveArc` emits one
    // closed lens — M P0, C c1 c2 P1 (the OUTER edge), C c3 c4 P0 (the return, the INNER edge).
    const d = document.querySelector('g.vf-tie path')?.getAttribute('d') ?? ''
    const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
    const midY = (a: number, b: number, c: number, dd: number) => 0.125 * a + 0.375 * b + 0.375 * c + 0.125 * dd
    const outer = midY(p[0].y, p[1].y, p[2].y, p[3].y)
    const inner = midY(p[3].y, p[4].y, p[5].y, p[6].y)

    const st = h.staves()[0]
    const spacing = (st.bottom - st.top) / 4
    const lineYs = [0, 1, 2, 3, 4].map(i => st.top + i * spacing)
    const lo = Math.min(outer, inner), hi = Math.max(outer, inner)
    // The gap from the ink to the nearest line on the NOTEHEAD's side — the one that runs parallel
    // to the tie's flat middle, and the only one this phase is about.
    const headY = h.noteheads()[0].y
    const inner_edge = Math.abs(hi - headY) < Math.abs(lo - headY) ? hi : lo
    const between = lineYs.filter(y => (y - inner_edge) * (headY - inner_edge) > 0)
    const gapInside = between.length
      ? Math.min(...between.map(y => Math.abs(y - inner_edge))) / spacing
      : Infinity
    return { gapInside, headOnLine: lineYs.some(y => Math.abs(y - headY) < 1) }
  }, { step, octave })
}

test('⭐⭐ a tie on a LINE note keeps that line out of its ink (Gould p. 61)', async ({ score }) => {
  // B4 is the middle line in treble. Untouched, our constant tie put the next line straight down
  // the middle of its arc — every time, since the shape never varies (§13.4).
  const r = await tieInk(score, 'B', 4)
  expect(r.headOnLine, 'the fixture is the case under test').toBe(true)
  // ⭐ Break-tested: with the repair removed this measures **0.15 sp** — a staff line running under
  // the arc's flat middle for the tie's whole length, exactly MuseScore's threshold for a bad
  // intersection. Rounding the arc out takes it past 0.3, and the TIPS never move.
  expect(r.gapInside).toBeGreaterThan(0.3)
})

test('a tie on a SPACE note is left alone — it already lies inside the space', async ({ score }) => {
  const r = await tieInk(score, 'C', 5)
  expect(r.headOnLine).toBe(false)
  // ⭐ Nothing lies between the arc and its notehead: the tie sits in the space above, and the only
  // line near it is on its FAR side (0.15 sp), where a nudge would make things worse. That is why
  // Phase 3 is one case and not two.
  // Measured 0.65 sp — the line under the arc is the one the tips already cleared, far below the
  // ink. The only line NEAR this tie is on its far side (0.15 sp), where a nudge would make things
  // worse; that is why Phase 3 is one case and not two.
  expect(r.gapInside).toBeGreaterThan(0.3)
})

test('⭐⭐ a tie ACROSS a system break is drawn by our own primitive, in two halves', async ({ score }) => {
  // Both halves used to be VexFlow `StaveTie`s — a quadratic with a 4px belly against our 2.7, and
  // a silent shape swap below a length cutoff. They are `drawCurveArc` paths now, so both halves
  // carry the same closed-lens shape as a same-line tie: one path each, four coordinate pairs out
  // and four back.
  const r = await score.evaluate(async () => {
    const h = window.__h
    // Fill systems until the two tied notes land on different lines.
    const ids: string[] = []
    for (let m = 1; m <= 40; m++) {
      if (m > 1) h.engine.addMeasure()
      ids.push(h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'w', measure: m, beat: h.frac(0, 1) })!.id)
    }
    await h.render()
    // Find a bar that OPENS a system — measures on one system share their stave's top y — and tie
    // the note before it to the one in it.
    const tops = h.staves().map(s => s.top)
    let broken = -1
    for (let i = 1; i < tops.length; i++) if (Math.abs(tops[i] - tops[i - 1]) > 1) { broken = i; break }
    if (broken < 1) return { halves: -1 }
    h.engine.toggleTie(ids[broken - 1])
    await h.render()
    return { halves: document.querySelectorAll('g.vf-tie path').length }
  })
  // ⚠️ TWO <path> per arc, not one: `renderCurve` strokes AND fills, and VexFlow's SVG context
  // emits an element for each. A same-line tie gives 2; two halves give 4.
  expect(r.halves, 'two halves, two paths each').toBe(4)
})
