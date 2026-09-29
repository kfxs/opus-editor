import { test, expect } from './fixtures'

/**
 * **Which side a tuplet's number goes on — decided AFTER the beams** (docs/research/tuplet-side-research.md).
 *
 * 🚨 His report, 2026-09-29 (Syrinx bar 5): a triplet of rest + A♭4 + C♭5, beamed with the next triplet
 * so the beam turned every stem DOWN, drew its "3" ABOVE — on the notehead side. The side was counted
 * from each note's OWN stem (A up, C down, the rest not voting: a tie → above) before the beam existed.
 * Here because a side is a POSITION: the beam that decides it is only real once drawn.
 */
test('🚨 a beam that turns the stems DOWN puts the number BELOW — the side is counted after the beams', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    const e = h.engine
    // Triplet 1: rest + A4 + C5 (A up, C down on their own); triplet 2: D5 F5 A5 — one beat, one beam, stems down.
    const first = e.createTupletAtBeat(1, 0, '16', { step: 'A', alter: 0, octave: 4 })!
    const id = first.tuplet.id
    e.addNoteAtBeat({ step: 'A', alter: 0, octave: 4, duration: '16', measure: 1, beat: h.frac(1, 6), tupletId: id, actualDuration: h.frac(1, 6) } as never)
    e.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: '16', measure: 1, beat: h.frac(1, 3), tupletId: id, actualDuration: h.frac(1, 6) } as never)
    e.convertToRest(first.firstNote.id)
    const second = e.createTupletAtBeat(1, 0.5, '16', { step: 'D', alter: 0, octave: 5 })!
    const id2 = second.tuplet.id
    e.addNoteAtBeat({ step: 'F', alter: 0, octave: 5, duration: '16', measure: 1, beat: h.frac(2, 3), tupletId: id2, actualDuration: h.frac(1, 6) } as never)
    e.addNoteAtBeat({ step: 'A', alter: 0, octave: 5, duration: '16', measure: 1, beat: h.frac(5, 6), tupletId: id2, actualDuration: h.frac(1, 6) } as never)
    await h.render()
    const staff = h.staves().find(s => s.measure === 1)!
    const digits = h.placed('g.tuplet text').sort((a, b) => a.x - b.x)
    return { middle: (staff.top + staff.bottom) / 2, digits: digits.map(d => d.y) }
  })
  expect(out.digits, 'two triplets, two numbers').toHaveLength(2)
  for (const [i, y] of out.digits.entries()) {
    expect(y, `triplet ${i + 1}'s number is BELOW the staff's middle — the beam's side`).toBeGreaterThan(out.middle)
  }
})
