import { test, expect } from './fixtures'

/**
 * ⭐ **A BEAMED GROUP ON THE BENT STAFF IS ONE RIGID BLOCK** — `docs/plans/bent-staff-plan.md` §6,
 * `rendering/eye/spineStaff.drawBeamedBlock`. What is held here is the STRUCTURE, which is what can be
 * wrong silently: the group's notes share ONE placed group with a beam in it and no flag; a lone
 * eighth keeps its flag; and the beam is the page's own (the same count of beam lines as on the page).
 */
test('four eighths on a circle: one block per beam group, no flags — the lone eighth keeps its flag', async ({ score }) => {
  const out = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 4; i++) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: '8', measure: 1, beat: h.frac(i, 2) })
    }
    // A lone eighth: an eighth REST in front of it leaves it nobody to beam with.
    h.engine.addNoteAtBeat({ step: 'E', octave: 5, duration: '8', measure: 1, beat: h.frac(7, 2) })
    await h.render()
    const pageBeams = document.querySelectorAll('svg g.beam').length
    h.drawSpine(220)
    const spine = document.querySelector('#spine svg')!
    const blocks = [...spine.querySelectorAll('g.spine-block')]
    const withBeam = blocks.filter(g => g.querySelector('g.beam'))
    return {
      pageBeams,
      spineBeams: spine.querySelectorAll('g.beam').length,
      beamedBlocks: withBeam.length,
      headsInBeamedBlocks: withBeam.reduce((n, g) => n + g.querySelectorAll('g.notehead').length, 0),
      flagsInBeamedBlocks: withBeam.reduce((n, g) => n + g.querySelectorAll('g.flag').length, 0),
      flagsOnSpine: spine.querySelectorAll('g.flag').length,
      placed: withBeam[0]?.getAttribute('transform') ?? '',
    }
  })

  expect(out.pageBeams, 'the page beams the four eighths').toBeGreaterThan(0)
  expect(out.spineBeams, 'the spine draws the SAME beams the page does').toBe(out.pageBeams)
  // ⚠️ HOW MANY groups four eighths make is the grouper's answer for the meter (two beats of two in
  //    4/4 here) — the claim is that each of the PAGE's groups is ONE block, whole.
  expect(out.beamedBlocks, 'one block per beam group').toBe(out.pageBeams)
  expect(out.headsInBeamedBlocks, 'every beamed note is inside its group’s block').toBe(4)
  expect(out.flagsInBeamedBlocks, 'a beamed note draws no flag').toBe(0)
  expect(out.flagsOnSpine, 'the lone eighth keeps its flag').toBe(1)
  expect(out.placed, 'the block is placed by ONE affine').toMatch(/matrix|rotate/)
})
