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
