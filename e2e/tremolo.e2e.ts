import { test, expect } from './fixtures'

/**
 * Tremolos (docs/tremolo-plan.md, docs/two-note-tremolo-plan.md), measured for real.
 *
 * Both kinds are placed against things only a real browser knows: a single-note tremolo centres its
 * strokes on the STEM and lengthens that stem when the strokes need the room (Gould: "extend the
 * stem if necessary"), and a two-note tremolo spans from one stem to the other. In jsdom every one
 * of those inputs is zero.
 */

/** The SMuFL stroke glyph a tremolo is built from — one per stroke, stacked up the stem. */
const STROKE = 'e220'

test('a single-note tremolo stacks its strokes on the stem, one per stroke asked for', async ({ score }) => {
  for (const strokes of [1, 3] as const) {
    const drawn = await score.evaluate(async (strokes) => {
      const h = window.__h
      const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
      h.engine.setTremolo(note!.id, strokes)
      await h.render()
      const marks = h.glyphs().filter(g => g.code === 'e220')
      const [stem] = h.stems()
      return { marks, stem }
    }, strokes)

    expect(drawn.marks, `${strokes} stroke(s) drawn`).toHaveLength(strokes)
    for (const mark of drawn.marks) {
      expect(mark.code).toBe(STROKE)
      expect(mark.x, 'centred on the stem').toBeCloseTo(drawn.stem.x1, 1)
      expect(Math.min(drawn.stem.y1, drawn.stem.y2), 'and inside its span').toBeLessThan(mark.y)
    }
    if (drawn.marks.length > 1) {
      const gaps = drawn.marks.slice(1).map((mark, i) => mark.y - drawn.marks[i].y)
      for (const gap of gaps) expect(gap, 'evenly stacked').toBeCloseTo(gaps[0], 1)
    }
    // The page keeps one score, so undo the mark before the next round rather than reloading.
    await score.evaluate(async () => {
      const h = window.__h
      h.engine.undo()
      await h.render()
    })
  }
})

test('five strokes lengthen the stem — the strokes get their room', async ({ score }) => {
  const tips = await score.evaluate(async () => {
    const h = window.__h
    const note = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.setTremolo(note!.id, 1)
    await h.render()
    const short = h.stems()[0]
    h.engine.setTremolo(note!.id, 5)
    await h.render()
    const long = h.stems()[0]
    return { short, long, marks: h.glyphs().filter(g => g.code === 'e220').length }
  })

  expect(tips.marks).toBe(5)
  // The stem points up, so a LONGER stem has a SMALLER tip y.
  expect(tips.long.y2, 'the stem grew to hold five strokes').toBeLessThan(tips.short.y2 - 5)
})

test('a two-note tremolo draws three strokes between the stems, sloping with the two pitches', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const first = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: h.frac(1, 1) })
    h.engine.setTremoloPair(first!.id, true)
    await h.render()
    return { strokes: h.quads('g.vf-tremolo-pair path'), stems: h.stems() }
  })

  // A pair of quarters draws as two blancas with no beam, so all three lines are strokes
  // (utils/tremoloPair: the count is the TOTAL number of lines between the two notes).
  expect(drawn.strokes, 'three strokes').toHaveLength(3)
  const [left, right] = drawn.stems
  for (const stroke of drawn.strokes) {
    // Absent style is `'open'`: the strokes float BETWEEN the stems rather than touching them.
    expect(stroke.left, 'clear of the first stem').toBeGreaterThan(left.x1 + 1)
    expect(stroke.right, 'and of the second').toBeLessThan(right.x1 - 1)
    expect(stroke.yRight, 'rising to the higher note').toBeLessThan(stroke.yLeft)
  }
  const gaps = drawn.strokes.slice(1).map((stroke, i) => stroke.yLeft - drawn.strokes[i].yLeft)
  for (const gap of gaps) expect(gap, 'evenly stacked').toBeCloseTo(gaps[0], 1)
})

test('the JOINED style takes the strokes out to both stem tips', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const first = h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: h.frac(1, 1) })
    h.engine.setTremoloPair(first!.id, true)
    await h.render()
    const open = h.quads('g.vf-tremolo-pair path')
    h.engine.setTremoloPairStyle(first!.id, 'joined')
    await h.render()
    return { open, joined: h.quads('g.vf-tremolo-pair path'), stems: h.stems() }
  })

  expect(drawn.joined, 'still three strokes').toHaveLength(3)
  const [left, right] = drawn.stems
  for (const [i, stroke] of drawn.joined.entries()) {
    expect(stroke.left, 'joined reaches the first stem').toBeCloseTo(left.x1, 1)
    expect(stroke.right, 'and the second').toBeCloseTo(right.x1, 1)
    expect(stroke.left, 'which is wider than open').toBeLessThan(drawn.open[i].left - 1)
    expect(stroke.right).toBeGreaterThan(drawn.open[i].right + 1)
  }
})
