import { test, expect } from './fixtures'

/**
 * ⭐ **A BEAM'S CLICKABLE INK, CHECKED AGAINST THE PAGE** (his ask, 2026-09-28: a beam selectable on its own).
 *
 * `engine/rendering/beams/beamHitInk` files each drawn beam LINE as a `'beamGroup'` band. The band must be the
 * line that was FILLED — each `g.beam > path` is one quad — so a press lands on what the eye sees. A path's
 * `getBBox()` is its geometry (unlike a `<text>`'s line box), so here the two can be compared closely.
 */
async function beamed(score: import('@playwright/test').Page, duration: '8' | '16', octave: number) {
  return score.evaluate(async ({ duration, octave }) => {
    const h = window.__h
    const per = duration === '8' ? 2 : 4
    const ids: string[] = []
    for (let i = 0; i < per; i++) {
      ids.push(h.engine.addNoteAtBeat({ step: 'G', octave, duration, measure: 1, beat: h.frac(i, per) } as never)!.id)
    }
    await h.render()
    const entries = h.engine.getElementRegistry().getByType('beamGroup')
    const drawn = [...document.querySelectorAll<SVGPathElement>('svg g.beam > path')].map(p => {
      const b = p.getBBox()
      return { x: b.x, y: b.y, width: b.width, height: b.height }
    })
    return { ids, entries: entries.map(e => ({ noteId: e.noteId, bbox: e.bbox })), drawn }
  }, { duration, octave })
}

for (const [label, octave] of [['stem UP', 4], ['stem DOWN', 5]] as const) {
  test(`⭐ ${label}: one band per drawn line, each ON its line, anchored on the first note`, async ({ score }) => {
    const { ids, entries, drawn } = await beamed(score, '16', octave)
    expect(drawn.length, 'sixteenths: a primary and a secondary line').toBe(2)
    expect(entries).toHaveLength(drawn.length)
    for (const entry of entries) expect(entry.noteId).toBe(ids[0])
    for (const line of drawn) {
      const match = entries.find(e => Math.abs(e.bbox.y - line.y) < 1.5)
      expect(match, `a band for the line at y=${line.y}`).toBeDefined()
      expect(Math.abs(match!.bbox.x - line.x)).toBeLessThan(1.5)
      expect(Math.abs(match!.bbox.width - line.width)).toBeLessThan(1.5)
      expect(Math.abs(match!.bbox.height - line.height)).toBeLessThan(1.5)
    }
    // 🚨 The break-test: bands of nothing would match nothing above.
    expect(entries[0].bbox.width).toBeGreaterThan(10)
  })
}

test('an unbeamed eighth files no beam band', async ({ score }) => {
  const count = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'G', octave: 4, duration: '8', measure: 1, beat: h.frac(0, 1) } as never)
    await h.render()
    return h.engine.getElementRegistry().getByType('beamGroup').length
  })
  expect(count).toBe(0)
})

/**
 * ⭐ **THE HAND'S NUDGE MOVES THE BEAM AND ITS STEMS FOLLOW** (his ask, 2026-09-28) — and it is RELATIVE to the
 * stems (his report the same day): pushed "longer", a group keeps its longer stems when it is flipped.
 */
test('⭐ pushed one space AWAY: the line moves a space, every stem a space longer — and a FLIP keeps them longer', async ({ score }) => {
  const read = () => score.evaluate(() => {
    const g = document.querySelector('svg g.beam')!
    const line = (g.querySelector(':scope > path') as SVGGraphicsElement).getBBox()
    return { lineY: line.y, stems: [...g.querySelectorAll('g.stem')].map(s => (s as SVGGraphicsElement).getBBox().height) }
  })
  const anchor = await score.evaluate(async () => {
    const h = window.__h
    const ids: string[] = []
    for (let i = 0; i < 4; i++) ids.push(h.engine.addNoteAtBeat({ step: 'G', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) } as never)!.id)
    await h.render()
    return ids[0]
  })
  const before = await read()
  const space = await score.evaluate(async (anchor) => {
    const h = window.__h
    if (!h.engine.beam.nudgeBeam(anchor, -1)) throw new Error('refused')
    await h.render()
    return h.engine.getElementRegistry().getStaffGeometry(1, 0)!.lineSpacing
  }, anchor)
  const after = await read()
  expect(before.lineY - after.lineY).toBeCloseTo(space, 0)
  after.stems.forEach((len, i) => expect(len - before.stems[i]).toBeCloseTo(space, 0))

  await score.evaluate(async (anchor) => {
    const h = window.__h
    h.engine.flipStemDirection(anchor)
    await h.render()
  }, anchor)
  const flipped = await read()
  // Stems down now — and still a space LONGER than the engraver's own (the stored offset is relative).
  const longest = Math.max(...flipped.stems)
  expect(longest).toBeGreaterThan(Math.max(...before.stems) + space * 0.5)
})

/**
 * ⭐ **ONE END MOVED TILTS THE BEAM** (his ask, 2026-09-28: squares at the beam's ends to control its angle) — the
 * other end's stem keeps its length, the moved end's changes by the offset, the stems between in proportion.
 */
test('⭐ one END moved a space AWAY: its stem a space longer, the other end\'s untouched, the middle in between', async ({ score }) => {
  const stems = () => score.evaluate(() =>
    [...document.querySelector('svg g.beam')!.querySelectorAll('g.stem')].map(s => (s as SVGGraphicsElement).getBBox().height))
  const anchor = await score.evaluate(async () => {
    const h = window.__h
    const ids: string[] = []
    for (let i = 0; i < 4; i++) ids.push(h.engine.addNoteAtBeat({ step: 'G', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) } as never)!.id)
    await h.render()
    return ids[0]
  })
  const before = await stems()
  const space = await score.evaluate(async (anchor) => {
    const h = window.__h
    h.engine.beam.previewBeamEnd(anchor, 'end', 1)
    h.engine.beam.commitBeamEndDrag()
    await h.render()
    return h.engine.getElementRegistry().getStaffGeometry(1, 0)!.lineSpacing
  }, anchor)
  const after = await stems()
  const grew = after.map((len, i) => len - before[i])
  expect(grew[0]).toBeCloseTo(0, 0)
  expect(grew[grew.length - 1]).toBeCloseTo(space, 0)
  expect(grew[1]).toBeGreaterThan(0)
  expect(grew[1]).toBeLessThan(grew[grew.length - 1])
})
