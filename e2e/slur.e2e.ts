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
