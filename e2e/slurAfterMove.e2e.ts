import { test, expect } from './fixtures'

/**
 * 🚨 **A slur keeps its arch when its SYSTEM moves** — his report, 2026-09-21, on the Gymnopédie:
 * dragging a system down (the staff's "space above") turned a flat slur into a huge arch.
 *
 * A slur's arch is solved over the ink of every note UNDER it (`curves/slurObstacles`). A bar that
 * is merely TRANSLATED keeps notes reporting where they were drawn, so a covered bar that did not
 * re-engrave left its obstacles at the old y and the slur arched over the place they used to be.
 * `ScoreRenderer.spanAnchors` now pins every bar a slur covers.
 *
 * ⚠️ A BROWSER test because the arch needs real ink boxes, and an incremental one because a fresh
 * engrave was never wrong: the fault only exists across two renders of one engine.
 */
test('a slur over several bars is the SAME arch after its system moves down', async ({ score }) => {
  const heights = await score.evaluate(async () => {
    await window.__h.fontReady()
    const e = window.__h.engine
    const f = (n: number, d = 1) => ({ num: n, den: d })
    // Three bars of quarters; the MIDDLE bar holds the tall notes the arch has to clear, and no
    // span ends in it — so nothing but the slur's own cover can make it re-engrave.
    while (e.getScore().measures.length < 3) e.addMeasure()
    const ids: string[] = []
    for (let bar = 1; bar <= 3; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        const high = bar === 2
        ids.push(e.addNoteAtBeat({
          step: high ? 'A' : 'D', alter: 0, octave: 5, duration: 'q', measure: bar, beat: f(beat), staff: 0, voice: 0,
        })!.id)
      }
    }
    const slur = e.slur.createSlur([ids[0], ids[ids.length - 1]])!
    e.renderScore()
    const height = () => (e.getSlurSVGGroup(slur.id) as SVGGElement).getBBox().height
    const top = () => (e.getSlurSVGGroup(slur.id) as SVGGElement).getBBox().y

    const before = { h: height(), y: top() }
    e.nudgeStaffSpacing(0, 1, 10) // the whole system, ten spaces down
    e.renderScore()
    const after = { h: height(), y: top() }
    return { before, after }
  })

  expect(heights.after.y - heights.before.y, 'the slur went down with its system').toBeGreaterThan(50)
  expect(heights.after.h, 'and its arch did not change').toBeCloseTo(heights.before.h, 0)
})
