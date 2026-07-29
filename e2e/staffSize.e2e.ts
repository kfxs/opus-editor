import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * **A staff drawn small** (docs/staff-size-plan.md P4) — the phase where the picture, and not just
 * the layout, changes.
 *
 * This one cannot be a unit test even in principle. jsdom has no fonts, so a notehead measures 0×0
 * and "is this glyph smaller?" agrees with itself whatever the answer; and the mechanism is an SVG
 * `transform` on the bar's own group, which only a real browser composes. The readers here go
 * through each element's CTM, so what they report is where the ink actually lands.
 *
 * The four things that would each be silently wrong on their own:
 *  - the staff's LINES are closer together (the scale reached the ink at all);
 *  - the bar still spans the SAME width (the stave was built at `x/k, width/k`, so the scale is a
 *    pure multiplication — get this wrong and a 0.7 staff's bar is 43% too long, past the margin);
 *  - the noteheads scaled WITH it (they are glyphs, not lines — a per-stave line spacing would move
 *    the lines and leave full-size glyphs sitting on them, which is why that is not the mechanism);
 *  - the other staff is untouched apart from moving up into the room the small one gave back.
 */
async function twoStaves(score: Page): Promise<void> {
  await score.evaluate(async () => {
    const h = window.__h
    h.engine.addStaffBelow(0)
    // Four different pitches: the VERTICAL distance between two noteheads is pure staff-space
    // arithmetic (half a space per diatonic step), so it scales exactly with the staff — no font
    // metric involved, which is what makes it a sound thing to assert on.
    const tune = [
      { step: 'C' as const, octave: 4 },
      { step: 'E' as const, octave: 4 },
      { step: 'G' as const, octave: 4 },
      { step: 'C' as const, octave: 5 },
    ]
    for (const staff of [0, 1]) {
      for (const [beat, pitch] of tune.entries()) {
        h.engine.addNoteAtBeat({ ...pitch, duration: 'q', measure: 1, beat: h.frac(beat, 1), staff })
      }
    }
    await h.render()
  })
}

/** Shrink the top staff and re-engrave; returns the drawing before and after. */
async function shrinkTopStaff(score: Page) {
  return score.evaluate(async () => {
    const h = window.__h
    const read = () => ({
      staves: h.staves(),
      heads: h.placed('g.vf-measure[id="vf-m1-s0"] .vf-notehead text'),
      lowerHeads: h.placed('g.vf-measure[id="vf-m1-s1"] .vf-notehead text'),
      stems: h.inkSizes('g.vf-measure[id="vf-m1-s0"] .vf-stem'),
    })
    const before = read()
    h.engine.setStaffSize(0, 0.7)
    await h.render()
    return { before, after: read() }
  })
}

test('a staff drawn at 0.7 has 0.7 of the ink, in the same bar', async ({ score }) => {
  await twoStaves(score)
  const { before, after } = await shrinkTopStaff(score)

  const top = (r: typeof before) => r.staves.find(s => s.staff === 0)!
  const bottom = (r: typeof before) => r.staves.find(s => s.staff === 1)!

  // The lines: four staff-spaces of real ink, 0.7 of what they were.
  const linesBefore = top(before).bottom - top(before).top
  const linesAfter = top(after).bottom - top(after).top
  expect(linesBefore, 'the staff was full size to begin with').toBeCloseTo(40, 0)
  expect(linesAfter, 'and 0.7 of that after').toBeCloseTo(linesBefore * 0.7, 1)

  // The bar: same left edge, same right edge. The scale is about the SVG origin and the stave was
  // built divided by it, so the music inside shrinks while the bar keeps its place on the line.
  expect(top(after).x1, 'the bar starts where it did').toBeCloseTo(top(before).x1, 1)
  expect(top(after).x2, 'and ends where it did — the small staff is not a longer bar')
    .toBeCloseTo(top(before).x2, 1)
  // And it still spans exactly what the full-size staff below it spans: barlines align.
  expect(top(after).x2 - top(after).x1).toBeCloseTo(bottom(after).x2 - bottom(after).x1, 1)

  // The staff below it moved UP into the room the small staff gave back, and did not change size.
  expect(bottom(after).top, 'the staff below rose').toBeLessThan(bottom(before).top - 10)
  expect(bottom(after).bottom - bottom(after).top, 'and is still full size')
    .toBeCloseTo(bottom(before).bottom - bottom(before).top, 1)
})

test('the GLYPHS scale with the staff, not just the lines', async ({ score }) => {
  await twoStaves(score)
  const { before, after } = await shrinkTopStaff(score)

  expect(before.heads.length, 'four noteheads on the small staff').toBe(4)
  expect(after.heads.length).toBe(4)

  // ⭐ The assertion the whole phase exists for, and the one a per-stave LINE SPACING could never
  // satisfy: VexFlow sizes glyphs from a GLOBAL font metric, so moving the lines closer together
  // leaves full-size noteheads sitting on a squashed staff. One transform over the group is what
  // makes the ink shrink with the staff — so the pitches stay where they belong ON that staff.
  const pitchSpan = (heads: { y: number }[]) => Math.max(...heads.map(h => h.y)) - Math.min(...heads.map(h => h.y))
  expect(pitchSpan(before.heads), 'C4 to C5 is 3.5 staff-spaces').toBeCloseTo(35, 1)
  expect(pitchSpan(after.heads), 'and 0.7 of that on a 0.7 staff').toBeCloseTo(35 * 0.7, 1)

  // The stems are the same story from the other side — VexFlow draws them from a global
  // `Tables.STEM_HEIGHT`, in pixels, and they scale here because the transform does not care.
  expect(after.stems.length).toBe(before.stems.length)
  for (const [i, stem] of after.stems.entries()) {
    expect(stem.height, `stem ${i} is 0.7 as long`).toBeCloseTo(before.stems[i].height * 0.7, 1)
  }

  // The staff below is untouched: same pitches, same span.
  expect(pitchSpan(after.lowerHeads)).toBeCloseTo(pitchSpan(before.lowerHeads), 1)
})

/**
 * ⚠️ NOT asserted here, because it is not true yet: the small staff's music is still SPACED for a
 * full-size staff. Its lane is formatted into a bar whose width was decided without knowing its
 * size, so inside the scaled group it gets `1/k` more room than it asked for and reads as a small
 * staff that has been stretched. That is §6 of the plan — P3, the horizontal room — and it is
 * deliberately open. Pinning today's spread here would only have to be un-pinned then.
 */

test('and back to full size, on the same drawing — the transform is not one-way', async ({ score }) => {
  await twoStaves(score)
  await shrinkTopStaff(score)

  const restored = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setStaffSize(0, 1)
    await h.render()
    return h.staves()
  })

  // ⚠️ The trap this pins: a REUSED bar's group is moved by overwriting its `transform`, and put
  // back by REMOVING it. Both have to carry the scale, or a small staff snaps to full size the
  // first time one of its bars moves — and here, a full-size one has to actually let go of it.
  const top = restored.find(s => s.staff === 0)!
  expect(top.bottom - top.top, 'full size again').toBeCloseTo(40, 0)
})
