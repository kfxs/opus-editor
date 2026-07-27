import { test, expect } from './fixtures'

/**
 * The staple of every render: noteheads, stems, beams — measured in a real browser.
 *
 * This is the floor of the net. Nothing here is subtle; the point is that a code-motion refactor of
 * `VexFlowRenderer` (docs/refactor-plan-2026-07-27.md Phase 6) cannot quietly move the ink. Every
 * assertion below is either a COUNT, a RELATION between two drawn things, or an absolute number with
 * a tolerance — never a bare pixel golden, which would be a diff to re-bless on every VexFlow bump.
 */

/** A stem's plain length — what it is for any note near the staff. Not a universal: the last test
 *  in this file is about the case where engraving makes it longer. */
const STEM_LENGTH = 35

test('four quarter notes: evenly spaced, on one line, each with an up-stem on the head’s right', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (const beat of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(beat, 1) })
    }
    await h.render()
    return { heads: h.noteheads(), stems: h.stems() }
  })

  expect(drawn.heads).toHaveLength(4)
  expect(drawn.stems).toHaveLength(4)

  // Same pitch, so the same line — the y a notehead is drawn at IS its staff position.
  const ys = new Set(drawn.heads.map(head => head.y))
  expect([...ys], 'four C4s sit on one line').toHaveLength(1)

  // Four events in a 4/4 bar are spaced evenly. Not a golden gap: whatever the spacing rule
  // produces, the four must be equal to each other.
  const gaps = drawn.heads.slice(1).map((head, i) => head.x - drawn.heads[i].x)
  for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 1)
  expect(gaps[0], 'and the bar is not collapsed').toBeGreaterThan(10)

  // C4 is below the middle line in treble, so every stem goes UP: it starts at the notehead's own
  // y, on the head's right-hand side, and ends STEM_LENGTH above.
  for (const [i, stem] of drawn.stems.entries()) {
    const head = drawn.heads[i]
    expect(stem.y1, 'the stem starts at the notehead').toBeCloseTo(head.y, 1)
    expect(head.y - stem.y2, 'and is a stem long').toBeCloseTo(STEM_LENGTH, 1)
    expect(stem.x1 - head.x, 'an up-stem hangs off the head’s right').toBeGreaterThan(8)
    expect(stem.x1 - head.x).toBeLessThan(16)
  }
})

test('a note above the middle line stems DOWN, off the head’s left', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()
    return { heads: h.noteheads(), rests: h.rests(), stems: h.stems() }
  })

  const [head] = drawn.heads
  const [stem] = drawn.stems
  expect(drawn.heads, 'one note').toHaveLength(1)
  expect(drawn.rests.length, 'and the empty beats after it are filled with rests').toBeGreaterThan(0)
  expect(stem.y2 - head.y, 'the stem goes DOWN from the head').toBeCloseTo(STEM_LENGTH, 1)
  expect(stem.x1 - head.x, 'a down-stem hangs off the head’s left').toBeLessThan(2)
})

test('a note high above the staff gets a longer stem, reaching back to the middle line', async ({ score }) => {
  // The stem is NOT a fixed 35 out there — engraving pulls it back to the staff, and that longer
  // stem is arithmetic the renderer does off measured positions. C6 sits two ledger lines up.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 6, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()
    return { heads: h.noteheads(), stems: h.stems(), staves: h.staves() }
  })

  const [head] = drawn.heads
  const [stem] = drawn.stems
  const [stave] = drawn.staves
  // Five lines, ten pixels apart: the middle one is two spaces below the top. A stave line is
  // DRAWN at a half-pixel offset (that is what keeps a hairline from straddling two pixel rows),
  // so the line the music is placed against is the whole number under it.
  const middleLine = Math.floor(stave.top) + 20
  expect(head.y, 'the head is above the staff').toBeLessThan(stave.top)
  expect(stem.y2, 'and its stem reaches the middle line').toBeCloseTo(middleLine, 1)
  expect(stem.y2 - head.y, 'which is longer than a plain stem').toBeGreaterThan(STEM_LENGTH)
})

test('two beamed pairs: one beam each, flat over a repeated pitch', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (const eighth of [0, 1, 2, 3]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: 1, beat: h.frac(eighth, 2) })
    }
    await h.render()
    return { beams: h.quads('g.vf-beam path'), heads: h.noteheads() }
  })

  expect(drawn.beams, 'four eighths beam as 2 + 2').toHaveLength(2)
  for (const beam of drawn.beams) {
    expect(beam.yLeft, 'a beam over one repeated pitch is flat').toBeCloseTo(beam.yRight, 1)
    expect(beam.right - beam.left, 'and it spans its two stems').toBeGreaterThan(20)
  }
  // Each beam covers exactly its own pair: the first beam ends before the third notehead.
  expect(drawn.beams[0].right).toBeLessThan(drawn.heads[2].x)
})

test('a beam over rising pitches slopes up, and never past VexFlow’s cap', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: '8', measure: 1, beat: h.frac(1, 2) })
    await h.render()
    return h.quads('g.vf-beam path')
  })

  expect(drawn).toHaveLength(1)
  const [beam] = drawn
  // SVG y grows downward, so "up" is a smaller y on the right.
  expect(beam.yRight, 'the beam rises with the music').toBeLessThan(beam.yLeft - 1)
  const slope = (beam.yLeft - beam.yRight) / (beam.right - beam.left)
  expect(slope, 'but engraving caps a beam’s slope — it never follows the interval').toBeLessThan(1)
})
