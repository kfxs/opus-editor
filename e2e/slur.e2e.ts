import { test, expect } from './fixtures'

/**
 * SLURS — WHICH SIDE, measured on drawn ink.
 *
 * ⚠️ **This has to be a browser suite and cannot be a unit test.** The rule
 * (`rendering/slurDirection.ts`) is pure and unit-tested there, but its INPUT is the stem direction
 * VexFlow actually resolved — which depends on beaming, on the clef, and on `NoteBuilder`'s
 * pitch-derived default for a note that draws no stem at all. jsdom answers none of that, and a
 * bare `new StaveNote(...)` reports stem direction `1` for every pitch, so a headless check of this
 * would agree with itself and prove nothing.
 *
 * The side is read from where the arc's ink landed relative to the staff, not from any internal.
 */

/** ABOVE / BELOW / inside, from the drawn slur's extremes against the staff's outer lines. */
const sideOf = (r: { top: number; bottom: number; minY: number; maxY: number }) =>
  r.minY < r.top ? 'ABOVE' : r.maxY > r.bottom ? 'BELOW' : 'inside'

/** Build a one-voice score from `notes`, slur the first to the last, and report the drawn side. */
async function drawSlur(
  score: import('@playwright/test').Page,
  notes: Array<{ step: string; octave: number; duration: string }>,
) {
  return score.evaluate(async (notes: Array<{ step: string; octave: number; duration: string }>) => {
    const h = window.__h
    // One note per bar keeps them unbeamed and independently stemmed, which is the point.
    const ids = notes.map((n, i) => {
      if (i > 0) h.engine.addMeasure()
      return h.engine.addNoteAtBeat({
        step: n.step, octave: n.octave, duration: n.duration as 'w' | 'q',
        measure: i + 1, beat: h.frac(0, 1),
      })!.id
    })
    h.engine.createSlur([ids[0], ids[ids.length - 1]])
    await h.render()
    const staff = window.__h.staves()[0]
    const d = [...document.querySelectorAll('g.vf-slur path')]
      .map(p => p.getAttribute('d') ?? '').join(' ')
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)?\s+(-?\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]))
    return { top: staff.top, bottom: staff.bottom, minY: Math.min(...ys), maxY: Math.max(...ys) }
  }, notes)
}

test('⭐ all stems UP → the slur goes BELOW, on the notehead side', async ({ score }) => {
  // Low notes take up stems, so the free side is below. Gould p.110: "When all stems within the
  // slur are in the same direction, the slur is usually placed between the outer noteheads."
  const r = await drawSlur(score, [
    { step: 'A', octave: 3, duration: 'q' },
    { step: 'C', octave: 4, duration: 'q' },
  ])
  expect(sideOf(r)).toBe('BELOW')
})

test('⭐⭐ MIXED stems → the slur goes ABOVE — and this is what the one-note rule got wrong', async ({ score }) => {
  // ⭐ THE REGRESSION THIS SUITE EXISTS FOR. The start note is LOW (stem up), so the rule we had
  // until 2026-08-15 — read the START note's stem and go opposite — answered BELOW, straight through
  // the down-stem of the high note. Gould p.110: "When groups of mixed stem direction are
  // encompassed by a slur, place the slur above the stave"; LilyPond, MuseScore and Verovio agree.
  const r = await drawSlur(score, [
    { step: 'A', octave: 3, duration: 'q' },   // stem up
    { step: 'F', octave: 5, duration: 'q' },   // stem down
  ])
  expect(sideOf(r)).toBe('ABOVE')
})

test('⭐ …and the mixture counts wherever it falls, not only at the ends', async ({ score }) => {
  // Both ENDS are low and stem-up; only the middle note is stem-down. Reading either end alone
  // gives BELOW — this is the case that needs the whole span scanned (Gould p.112: "Take all the
  // notes within the slur into account").
  const r = await drawSlur(score, [
    { step: 'A', octave: 3, duration: 'q' },
    { step: 'F', octave: 5, duration: 'q' },
    { step: 'C', octave: 4, duration: 'q' },
  ])
  expect(sideOf(r)).toBe('ABOVE')
})

test('⭐⭐ STEMLESS notes are placed by PITCH — as if they were stemmed', async ({ score }) => {
  // Whole notes draw no stem, but `NoteBuilder` still gives each one a stem DIRECTION from its
  // pitch, so the pitch decides and nothing special is needed. That is Verovio's `isAboveStaffCenter`
  // and Gould p.110 — "For stemless notes, place the slur as if the notes were stemmed" — arriving
  // through the ordinary path. ⛔ `slurSideFromStems`'s empty-list branch is NOT what answers here;
  // it is unreachable through this pipeline, and this test is the evidence.
  const high = await drawSlur(score, [
    { step: 'F', octave: 5, duration: 'w' },
    { step: 'F', octave: 5, duration: 'w' },
  ])
  expect(sideOf(high), 'high whole notes hang their stems down, so the slur goes above').toBe('ABOVE')
})

test('…and a LOW stemless pair goes the other way', async ({ score }) => {
  const low = await drawSlur(score, [
    { step: 'A', octave: 3, duration: 'w' },
    { step: 'A', octave: 3, duration: 'w' },
  ])
  expect(sideOf(low)).toBe('BELOW')
})

/**
 * ⭐⭐ THE TILT — Gould p. 111, and the two faults it was written for.
 *
 * The rule is `rendering/slurStemEndpoint.ts` and its arithmetic is unit-tested there. What only a
 * browser can say is that VexFlow really resolves these two notes to OPPOSITE stems, that the stem
 * tip it reports is the post-beaming one, and that the arc therefore leaves the page tilting the way
 * the melody does. The old attachment drew a rising step as a 3-space DESCENT.
 */
async function slurTilt(
  score: import('@playwright/test').Page,
  notes: Array<{ step: string; octave: number; duration?: string }>,
) {
  return score.evaluate(async (notes: Array<{ step: string; octave: number; duration?: string }>) => {
    const h = window.__h
    const ids = notes.map((n, i) => {
      if (i > 0) h.engine.addMeasure()
      return h.engine.addNoteAtBeat({
        step: n.step, octave: n.octave, duration: (n.duration ?? 'q') as 'w' | 'q',
        measure: i + 1, beat: h.frac(0, 1),
      })!.id
    })
    h.engine.createSlur([ids[0], ids[ids.length - 1]])
    await h.render()
    // `renderCurve` emits ONE closed path: `M p0 … C c0 c1 p1 …` — so the first coordinate pair is
    // the start endpoint and the fourth is the end endpoint (the return pass follows).
    const d = document.querySelector('g.vf-slur path')?.getAttribute('d') ?? ''
    const pairs = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
      .map(m => ({ x: parseFloat(m[1]), y: parseFloat(m[2]) }))
    const staffSpace = (window.__h.staves()[0].bottom - window.__h.staves()[0].top) / 4
    // Positive = the arc RISES from start to end, in staff spaces (y grows downward).
    return { rise: (pairs[0].y - pairs[3].y) / staffSpace, start: pairs[0], end: pairs[3] }
  }, notes)
}

test('⭐⭐ a rising STEP across the middle line tilts UP — it used to descend 3 spaces', async ({ score }) => {
  // A4 (stem up) → B4 (stem down): mixed stems, so the slur is above and A4's end is the stem-side
  // one. Gould p. 111 slides it down its stem until the slur tilts at HALF the melodic interval —
  // half a step is 0.25 sp. Before this, it sprang from the stem TIP and descended 3.0 sp under a
  // rising melody: Gedan p. 17's fault [b], drawn by ordinary music.
  const r = await slurTilt(score, [{ step: 'A', octave: 4 }, { step: 'B', octave: 4 }])
  expect(r.rise, 'the slur rises with the melody').toBeGreaterThan(0)
  expect(r.rise).toBeCloseTo(0.25, 1)
})

test('⭐ a rising TENTH rises 2.25 spaces, not 1', async ({ score }) => {
  // C4 (stem up) → E5 (stem down), 4.5 sp apart. Attaching at the stem tip left the arc nearly
  // horizontal under a wide leap — Gedan's fault [c].
  const r = await slurTilt(score, [{ step: 'C', octave: 4 }, { step: 'E', octave: 5 }])
  expect(r.rise).toBeCloseTo(2.25, 1)
})

test('a FALLING step across the middle line tilts down', async ({ score }) => {
  const r = await slurTilt(score, [{ step: 'B', octave: 4 }, { step: 'A', octave: 4 }])
  expect(r.rise, 'the slur descends with the melody').toBeLessThan(0)
  expect(r.rise).toBeCloseTo(-0.25, 1)
})

test('⛔ SAME-direction stems are left alone — the tilt is the noteheads own', async ({ score }) => {
  // Two low notes: both stems up, slur BELOW on the notehead side, so nothing slides and the arc
  // simply follows the two heads. Gould's condition is opposite stems; this is the control.
  const r = await slurTilt(score, [{ step: 'A', octave: 3 }, { step: 'C', octave: 4 }])
  expect(r.rise).toBeCloseTo(1.0, 1)   // a third = 1.0 sp, followed exactly
})

test('🚨 two WHOLE notes attach at their noteheads — there is no stem to float up', async ({ score }) => {
  // E4 (stem direction UP) → C5 (DOWN) is a mixed pair, so the opposite-stems rule fires — but
  // NEITHER NOTE DRAWS A STEM. VexFlow still answers `getStemExtents()` for a whole note, so the
  // first version of this rule floated the E4 end 1.25 sp up a stem the reader cannot see, leaving
  // a visible gap of empty air above the notehead (his report). MuseScore skips its stem block when
  // there is no stem; Verovio treats `stemLen == 0` as "no stem side" outright.
  const r = await slurTilt(score, [
    { step: 'E', octave: 4, duration: 'w' },
    { step: 'C', octave: 5, duration: 'w' },
  ])
  // Both ends are noteheads, so the arc's rise IS the melodic interval — a sixth, 2.5 sp.
  expect(r.rise).toBeCloseTo(2.5, 1)
})

test('…and a stemless pair whose stems would AGREE is unchanged by that rule', async ({ score }) => {
  // B4 (middle line, stem down) → C5 (down): not a mixed pair, notehead side both ends. This is the
  // picture he compared against, and it must stay exactly as it was.
  const r = await slurTilt(score, [
    { step: 'B', octave: 4, duration: 'w' },
    { step: 'C', octave: 5, duration: 'w' },
  ])
  expect(r.rise).toBeCloseTo(0.5, 1)   // a second = 0.5 sp, followed exactly
})

test('⭐⭐ the arc leaves BEYOND the stem, not across it (§12.1)', async ({ score }) => {
  // His report on seeing Phase 1 draw: "maybe the problem is simply that the slur is touching the
  // stem". It was — our x is the note's tie edge, which for an up stem is where the stem is drawn.
  // LilyPond clears it by 0.3 sp, MuseScore by 0.35; we take 0.35. Measured against the drawn stem.
  const r = await score.evaluate(async () => {
    const h = window.__h
    const a = h.engine.addNoteAtBeat({ step: 'A', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1) })!
    const c = h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'h', measure: 1, beat: h.frac(2, 1) })!
    h.engine.createSlur([a.id, c.id])
    await h.render()
    const d = document.querySelector('g.vf-slur path')?.getAttribute('d') ?? ''
    const first = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)][0]
    const startX = parseFloat(first[1]), startY = parseFloat(first[2])
    const staff = h.staves()[0]
    const staffSpace = (staff.bottom - staff.top) / 4
    // The A4 stem: the leftmost drawn stem, and the one the arc springs beside.
    const stem = h.stems().filter(s => s.x1 < startX + 20)[0]
    return { gap: (startX - stem.x1) / staffSpace, startY, stemTop: Math.min(stem.y1, stem.y2), stemBottom: Math.max(stem.y1, stem.y2) }
  })
  // Clear of the stem, on the inward side — and not so far that it leaves the note behind.
  expect(r.gap).toBeGreaterThan(0.2)
  expect(r.gap).toBeLessThan(0.6)
  // …and this is the case the dodge exists for: the endpoint really is beside the stem, not above it.
  expect(r.startY).toBeGreaterThan(r.stemTop)
  expect(r.startY).toBeLessThan(r.stemBottom)
})

test('⭐⭐ the arc starts OVER the notehead, not past it (§12 Phase 2)', async ({ score }) => {
  // Ross p. 141: "long slurs always start and end over or under the centre of a notehead", and all
  // three engines anchor there by three different constructions. Ours used the tie EDGES, so the
  // arc spanned the GAP BETWEEN the heads — about 0.6 sp short at each end.
  const r = await score.evaluate(async () => {
    const h = window.__h
    // Two high notes: both stems DOWN, slur ABOVE on the notehead side, so neither end dodges and
    // what is measured is the anchor itself.
    const a = h.engine.addNoteAtBeat({ step: 'F', octave: 5, duration: 'h', measure: 1, beat: h.frac(0, 1) })!
    const b = h.engine.addNoteAtBeat({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: h.frac(2, 1) })!
    h.engine.createSlur([a.id, b.id])
    await h.render()
    const d = document.querySelector('g.vf-slur path')?.getAttribute('d') ?? ''
    const pts = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
      .map(m => ({ x: parseFloat(m[1]), y: parseFloat(m[2]) }))
    const heads = h.noteheads().sort((p, q) => p.x - q.x)
    return { startX: pts[0].x, endX: pts[3].x, firstHeadX: heads[0].x, lastHeadX: heads[heads.length - 1].x }
  })
  // A notehead glyph's `x` is its LEFT edge and it is ~1.18 sp wide, so a centre anchor lands within
  // a hair of half a space to its right — and, decisively, LEFT of where the tie edge used to be.
  expect(r.startX - r.firstHeadX).toBeGreaterThan(3)
  expect(r.startX - r.firstHeadX).toBeLessThan(9)
  expect(r.endX - r.lastHeadX).toBeGreaterThan(3)
  expect(r.endX - r.lastHeadX).toBeLessThan(9)
})

test('⭐ a slur from a CHORD springs from its outer note, not the one you clicked (§12 Phase 7)', async ({ score }) => {
  // All three engines take the top note for an up-slur and the bottom for a down-slur (§11.2b) —
  // in LilyPond it changes `musical_dy_`, the slur's own idea of the interval. Ours used the head
  // the user anchored to, so a slur from a chord's middle note sprang from INSIDE the chord and the
  // arc crossed the notes above it.
  const r = await score.evaluate(async () => {
    const h = window.__h
    // A high chord, so its stems point down and the slur goes above.
    const top = h.engine.addNoteAtBeat({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: h.frac(0, 1) })!
    h.engine.addChordNote({ step: 'E', octave: 5, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    const middle = h.engine.addChordNote({ step: 'C', octave: 5, duration: 'h', measure: 1, beat: h.frac(0, 1) })
    const next = h.engine.addNoteAtBeat({ step: 'G', octave: 5, duration: 'h', measure: 1, beat: h.frac(2, 1) })!
    // Anchor the slur to the chord's MIDDLE note — the case that used to spring from inside it.
    h.engine.createSlur([middle?.id ?? top.id, next.id])
    await h.render()
    const d = document.querySelector('g.vf-slur path')?.getAttribute('d') ?? ''
    const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
    const heads = h.noteheads().filter(n => n.x < p[3].x - 5).map(n => n.y).sort((a, b) => a - b)
    return { startY: p[0].y, topHeadY: heads[0], bottomHeadY: heads[heads.length - 1] }
  })
  // The arc starts ABOVE the chord's top head — it would start below it if the middle note decided.
  expect(r.startY).toBeLessThan(r.topHeadY)
})

test('⭐⭐ a slur over a rising RUN clears the notes it covers (§12 Phase 8, first pass)', async ({ score }) => {
  // His case, 2026-08-16: twelve sixteenths climbing from C5 to G6, slurred from the first of them
  // to a note in the bar after. Both ends are LOW and the middle of the run is an octave above, so
  // an arc that knows only its endpoints passes straight through its own music — Gould p. 322,
  // "all notes must appear to be included in a slur".
  const r = await score.evaluate(async () => {
    const h = window.__h
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
    const ids = steps.map((step, i) => h.engine.addNoteAtBeat({
      step, octave: i < 7 ? 5 : 6, duration: '16', measure: 1, beat: h.frac(i, 4),
    })!.id)
    h.engine.addMeasure()
    const last = h.engine.addNoteAtBeat({ step: 'G', octave: 5, duration: 'q', measure: 2, beat: h.frac(0, 1) })!
    h.engine.createSlur([ids[0], last.id])
    await h.render()

    const d = document.querySelector('g.vf-slur path')?.getAttribute('d') ?? ''
    const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
    const at = (t: number) => {
      const mt = 1 - t
      return {
        x: mt ** 3 * p[0].x + 3 * mt * mt * t * p[1].x + 3 * mt * t * t * p[2].x + t ** 3 * p[3].x,
        y: mt ** 3 * p[0].y + 3 * mt * mt * t * p[1].y + 3 * mt * t * t * p[2].y + t ** 3 * p[3].y,
      }
    }
    // The highest notehead the slur covers, and where the curve runs above it.
    const covered = h.noteheads().filter(n => n.x > p[0].x && n.x < p[3].x)
    const peak = covered.reduce((best, n) => (n.y < best.y ? n : best), covered[0])
    let over = Infinity
    for (let i = 0; i <= 100; i++) {
      const s = at(i / 100)
      if (Math.abs(s.x - peak.x) < 8) over = Math.min(over, s.y)
    }
    const staff = h.staves()[0]
    return { clearance: (peak.y - over) / ((staff.bottom - staff.top) / 4), covered: covered.length }
  })
  expect(r.covered, 'the run is under the slur').toBeGreaterThan(8)
  // Break-tested: without the clearance pass the curve runs 1.94 sp BELOW the peak notehead.
  // ⭐ And the margin has to actually arrive: his second look — *"the top note is slightly too near
  // the edge"* — was the solve evaluating a SYMMETRIC cubic where the drawn arch LEANS, plus reading
  // `t` off an obstacle's x as though x ran linearly with it. Both are sampled now, so the air over
  // the peak is the margin we asked for rather than whatever those two errors left.
  expect(r.clearance).toBeGreaterThan(0.2)
})

test('⭐ …and a run that ENDS in a rest keeps the same air over its peak', async ({ score }) => {
  // His second figure, 2026-08-16: the same climb with a REST in the twelfth slot, so the peak (F6)
  // sits at about four fifths of the span — the region where the arch's lean is strongest and where
  // solving against a symmetric cubic under-lifted it.
  const r = await score.evaluate(async () => {
    const h = window.__h
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F']
    const ids = steps.map((step, i) => h.engine.addNoteAtBeat({
      step, octave: i < 7 ? 5 : 6, duration: '16', measure: 1, beat: h.frac(i, 4),
    })!.id)
    h.engine.addMeasure()
    const last = h.engine.addNoteAtBeat({ step: 'G', octave: 5, duration: 'q', measure: 2, beat: h.frac(0, 1) })!
    h.engine.createSlur([ids[0], last.id])
    await h.render()
    const d = document.querySelector('g.vf-slur path')?.getAttribute('d') ?? ''
    const p = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] }))
    const at = (t: number) => {
      const mt = 1 - t
      return {
        x: mt ** 3 * p[0].x + 3 * mt * mt * t * p[1].x + 3 * mt * t * t * p[2].x + t ** 3 * p[3].x,
        y: mt ** 3 * p[0].y + 3 * mt * mt * t * p[1].y + 3 * mt * t * t * p[2].y + t ** 3 * p[3].y,
      }
    }
    const covered = h.noteheads().filter(n => n.x > p[0].x && n.x < p[3].x)
    const peak = covered.reduce((best, n) => (n.y < best.y ? n : best), covered[0])
    let over = Infinity
    for (let i = 0; i <= 200; i++) {
      const s = at(i / 200)
      if (Math.abs(s.x - peak.x) < 8) over = Math.min(over, s.y)
    }
    const staff = h.staves()[0]
    return { clearance: (peak.y - over) / ((staff.bottom - staff.top) / 4) }
  })
  expect(r.clearance).toBeGreaterThan(0.2)
})

test('⭐⭐ a slur broken by a system break leans toward its own music (§12 Phase 5, Gould p. 112)', async ({ score }) => {
  // "A slur starting on the last note of a system … must be angled in the direction of the final
  // pitch on the new system, so as to look clearly open-ended." Ours was a flat rise on both halves
  // with no pitch input at all — the only one of the three engines with no opinion.
  const half = async (endOctave: number) => score.evaluate(async (endOctave: number) => {
    const h = window.__h
    const ids: string[] = []
    for (let m = 1; m <= 40; m++) {
      if (m > 1) h.engine.addMeasure()
      ids.push(h.engine.addNoteAtBeat({ step: 'C', octave: m === 1 ? 5 : 5, duration: 'w', measure: m, beat: h.frac(0, 1) })!.id)
    }
    await h.render()
    // The first bar that opens a system — measures on one system share their stave's top y.
    const tops = h.staves().map(s => s.top)
    let broken = -1
    for (let i = 1; i < tops.length; i++) if (Math.abs(tops[i] - tops[i - 1]) > 1) { broken = i; break }
    if (broken < 1) return { rise: NaN }
    // Re-pitch the note that OPENS the new system, so the interval across the break is the variable.
    h.engine.updateNote(ids[broken], { step: 'C', octave: endOctave })
    h.engine.createSlur([ids[broken - 1], ids[broken]])
    await h.render()
    // The BEGIN half is the one whose path starts on the earlier system (smaller y overall).
    const paths = [...document.querySelectorAll('g.vf-slur path')].map(p => p.getAttribute('d') ?? '')
    const parsed = paths.map(d => [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] })))
    const begin = parsed.reduce((best, p) => (p[0].y < best[0].y ? p : best), parsed[0])
    const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
    // How far the OPEN (right) end sits above the anchored (left) one.
    return { rise: (begin[0].y - begin[3].y) / sp }
  }, endOctave)

  const higher = await half(6)   // the music resumes an octave UP
  const lower = await half(4)    // …and an octave DOWN
  expect(higher.rise).toBeGreaterThan(lower.rise)
  // Break-tested: with the flat `slurArc` both measure the SAME, so this pair is the rule itself.
  // ⚠️ The spread is bounded by the two clamps his eye asked for — a 1.0 sp floor (never a tie) and
  // a 2.0 sp ceiling (never a hole at the margin) — so an octave either way differs by 1.0, not by
  // the 3.5 the raw per-step lean would give.
  expect(higher.rise - lower.rise).toBeGreaterThan(0.5)
})

test('⭐⭐ a continuation starts AFTER the clef, key and meter (Gould p. 112, verbatim)', async ({ score }) => {
  // ⭐⭐ "At the beginning of the new system, the slur starts after the clef, key signature and time
  // signature, but before any accidental" — Gould p. 112, found only after I had told him twice that
  // no book stated it. `noteStartX` IS that boundary, so this pins the sourced rule.
  // ⛔ NOT the bar's left edge: that version drew the arc through the clef, and no engine does it —
  // Verovio's `GetLeftBarLineXRel` only sounds like the barline, its alignment enum putting the
  // score-def clef first.
  // ⭐⭐ **AFTER THE CLEF MEANS AFTER THE GLYPH.** `noteStartX` is that boundary PADDED, and it
  // measured EQUAL to the first notehead's own x (his figure, 2026-08-16) — a fragment 0.6 sp long,
  // *"almost over the note"*. `lineLeftCurveX` starts it at the header's ink instead, which is where
  // LilyPond attaches a broken bound (`breakable_bound_extent` → `ext[RIGHT]`, no margin) and 1.0 sp
  // inside where MuseScore does (`firstNoteRestSegmentX` + `headerToLineStartDistance`).
  // ⏭️ Still open, and sourced: BUY room. Gerou & Lusk — "be sure the first note is far enough to the
  // right so that it is very clear that the slur does not begin on the note" — and a notat.io
  // engraver, "when the situation is too tight, I expand the space before first note".
  const r = await score.evaluate(async () => {
    const h = window.__h
    const ids: string[] = []
    for (let m = 1; m <= 40; m++) {
      if (m > 1) h.engine.addMeasure()
      // ⭐ LOW notes, so the slur hangs BELOW and the clef's TAIL is what it would cross — his
      // figure. A slur above clears the clef by accident; this one does not.
      ids.push(h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: m, beat: h.frac(0, 1) })!.id)
    }
    await h.render()
    const tops = h.staves().map(s => s.top)
    let broken = -1
    for (let i = 1; i < tops.length; i++) if (Math.abs(tops[i] - tops[i - 1]) > 1) { broken = i; break }
    if (broken < 1) return { startsAfterClefInk: false, clefCount: 0, lengthSp: NaN, clearOfNoteSp: NaN }
    h.engine.updateNote(ids[broken], { step: 'G', octave: 4 })
    h.engine.createSlur([ids[broken - 1], ids[broken]])
    await h.render()
    const parsed = [...document.querySelectorAll('g.vf-slur path')]
      .map(p => [...(p.getAttribute('d') ?? '').matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: +m[1], y: +m[2] })))
    // The END half is the one on the LOWER system — compare by the ANCHORED end, which sits on its
    // own note (the open end is the one that moves).
    const end = parsed.reduce((best, p) => (p[3].y > best[3].y ? p : best), parsed[0])
    const onLine = (y: number) => y > tops[broken] - 40 && y < tops[broken] + 60
    // ⭐ The clef's INK, not its box: `inkSizes` reads the drawn `<g>`, whose width is the glyph's
    // own advance — the number `noteStartX` pads and this rule does not.
    const clefs = h.inkSizes('g.vf-clef').filter(b => onLine(b.y + b.height / 2))
    const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
    // The note the fragment runs TO — the first on the new system.
    const head = h.noteheads().filter(g => onLine(g.y)).sort((a, b) => a.x - b.x)[0]
    return {
      // Flush at the ink, so allow the tip to sit ON the clef's right edge but never left of it.
      startsAfterClefInk: clefs.every(c => end[0].x >= c.x + c.width - 1.5),
      clefCount: clefs.length,
      lengthSp: (end[3].x - end[0].x) / sp,
      clearOfNoteSp: head ? (head.x - end[0].x) / sp : NaN,
    }
  })
  expect(r.clefCount, 'the fixture has a clef at the system start').toBeGreaterThan(0)
  // The fragment begins at the header's ink — never inside the clef.
  expect(r.startsAfterClefInk).toBe(true)
  // ⭐⭐ THE REGRESSION THIS EXISTS FOR: at `noteStartX` this was 0.6 sp, because that boundary IS
  // the notehead's x. Anything under ~2 sp means the padded box is back.
  expect(r.lengthSp).toBeGreaterThan(2)
  // …and it visibly does not begin on the note (Gerou & Lusk's own test of the figure).
  expect(r.clearOfNoteSp).toBeGreaterThan(1.5)
})

test('⭐⭐ the WHOLE curve moves RIGIDLY — its shape is not re-solved (his ask, 2026-08-18)', async ({ score }) => {
  // *"the slur selected but no control point or endpoints so with arrow/ctr arrow we offset it (and
  // the arc conserve the same shape, so we dont recalculate)"*. The fixture is the rising run,
  // deliberately: its arch carries an OBSTACLE LIFT (§12 Phase 8), which is the only thing that can
  // tell a rigid translate apart from two endpoint offsets — an equal pair of those feeds
  // `slurArchClearance` moved endpoints, and the lift is re-solved from where they now are.
  const r = await score.evaluate(async () => {
    const h = window.__h
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
    const ids = steps.map((step, i) => h.engine.addNoteAtBeat({
      step, octave: i < 7 ? 5 : 6, duration: '16', measure: 1, beat: h.frac(i, 4),
    })!.id)
    h.engine.addMeasure()
    const last = h.engine.addNoteAtBeat({ step: 'G', octave: 5, duration: 'q', measure: 2, beat: h.frac(0, 1) })!
    const slur = h.engine.createSlur([ids[0], last.id])!
    await h.render()

    const sp = (h.staves()[0].bottom - h.staves()[0].top) / 4
    const sample = () => h.curveSamples('g.vf-slur path', 60)
    const before = sample()
    // How far the samples deviate from a pure translation by (dx, dy) staff-spaces.
    const deviation = (after: { x: number; y: number }[], dx: number, dy: number) =>
      Math.max(...after.map((p, i) => Math.max(
        Math.abs(p.x - before[i].x - dx * sp), Math.abs(p.y - before[i].y - dy * sp))))

    h.engine.nudgeSlur(slur.id, 1.5, -2)
    await h.render()
    const rigid = deviation(sample(), 1.5, -2)

    // ⭐ The same delta the other way — as two endpoint offsets — for the comparison the feature
    // exists to make. Reset first, so the two are measured from the same drawing.
    h.engine.resetSlurOffset(slur.id)
    h.engine.nudgeSlurEndpoint(slur.id, 'start', 1.5, -2)
    h.engine.nudgeSlurEndpoint(slur.id, 'end', 1.5, -2)
    await h.render()
    const asEndpoints = deviation(sample(), 1.5, -2)
    return { rigid, asEndpoints, sp, samples: before.length }
  })
  expect(r.samples, 'the arc was sampled').toBeGreaterThan(50)
  // ⭐ THE CLAIM: every sample landed exactly where the old one was, plus the offset. A tenth of a
  // staff-space of slack covers the sampler walking a marginally longer curve, nothing more.
  expect(r.rigid).toBeLessThan(r.sp * 0.1)
  // ⭐⭐ **…and the two roads now AGREE, which is the fix of 2026-08-21 and ⛔ not a weakening.**
  //
  // This line used to demand the opposite — that moving both ENDPOINTS by the same vector changed the
  // arch, because the obstacle lift was solved again from the moved ends — and it was kept as the
  // break-test for the rigid claim above. His report killed the premise: *"the problem is the arch,
  // and not that the endpoint of the slur is in a wrong position"*. Solving the shape from the ends
  // the ENGRAVER chose (`SlurRenderer`, and it is the same sentence the whole-curve move obeys) means
  // an endpoint nudge translates its half instead of re-arching, so two endpoints moved alike now
  // translate the whole curve — exactly like the whole-curve offset.
  //
  // ⚠️ So the rigid claim above is now tested by the ARCH ITSELF rather than by a contrast: the
  // chapter below pins that a dragged end cannot invert the curve, which is the failure this
  // divergence used to stand in for.
  expect(r.asEndpoints, 'the same delta, the same drawing').toBeLessThan(r.sp * 0.1)
})

/**
 * 🚨🚨 **A DRAGGED ENDPOINT MAY NOT INVERT THE ARCH** — his report, 2026-08-21, with a picture of a
 * slur whose curve left the top of the sheet while both its ends sat on the staff: *"the arc go out
 * of the page… completely wrong"*, and then the correction that found it: *"the problem is the arch,
 * and no that the endpoint of the slur is in a wrong position"*.
 *
 * ⭐ The cause was the obstacle lift (`slurObstacles.slurArchClearance`) being solved from the
 * HAND-MOVED end: the curve dives away from the notes it covers, the solver reads the whole staff as
 * an intrusion, and answers with `deficit × up to 4` — hundreds of pixels of lift, upward, while the
 * ends go down. ⚠️ No limit could catch it: they predict ink moving RIGIDLY with the nudge.
 *
 * ⭐⭐ The numbers below are the ones that named it. Before the fix the arc's TOP went 41 → −14 → −68
 * as the end was pushed down 10 / 30 / 50 staff-spaces — i.e. it climbed OFF the paper as the end
 * descended. After: 68 → 69 → 70, and only the moved end's control point travels.
 */
test('🚨 pushing one end DOWN must not send the arc UP off the sheet', async ({ score }) => {
  const r = await score.evaluate(async () => {
    const h = window.__h
    const ids = [0, 1, 2, 3].map(beat => h.engine.addNoteAtBeat({
      step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1),
    })!.id)
    const slur = h.engine.createSlur([ids[0], ids[3]])!
    await h.render()
    const top = () => Math.round(h.inkSizes('g.vf-slur path')[0].y)
    const before = top()
    const tops: number[] = []
    for (const steps of [10, 20, 20]) {
      for (let i = 0; i < steps; i++) {
        h.engine.nudgeSlurEndpoint(slur.id, 'end', 0, 1)
        await h.render()
      }
      tops.push(top())
    }
    return { before, tops, staffTop: Math.round(h.staves()[0].top) }
  })
  // ⭐ THE CLAIM: as the end goes DOWN, the arch's top never CLIMBS. It settles a little lower with
  // its own half of the curve (measured: 58 → 68 → 69 → 70), which is the ink following the hand —
  // ⛔ what it must never do is go the other way.
  for (const t of r.tops) expect(t).toBeGreaterThanOrEqual(r.before)
  // ⭐⭐ …and it never leaves the paper. THE BREAK-TEST, in one line: before the fix these three
  // numbers were 41, −14 and −68 — climbing as the end descended, and off the top of the sheet.
  for (const t of r.tops) expect(t).toBeGreaterThan(0)
  // ⚠️ …and it is still ABOVE its own staff, so this does not pass by the curve collapsing flat.
  expect(r.tops[0]).toBeLessThan(r.staffTop + 20)
})
