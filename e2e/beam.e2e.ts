/**
 * ⭐⭐ **THE BEAM'S INK, MEASURED IN A REAL BROWSER** — the half `ScoreRenderer.scene.test.ts`
 * structurally cannot reach.
 *
 * ## 🚨 Why this file exists: a change moved 85% of beams and the browser suite stayed green
 *
 * P4b (`docs/beam-slope-research.md`) put five slope rules behind a console knob and measured that
 * the tradition's tables would flatten most beams by ~0.28 staff spaces. All **276** browser tests
 * passed either way — and the reason is precise, not an absence:
 *
 * `notes.e2e.ts` already pins two beam facts, and both survive any *flattening*. It asserts a beam
 * over rising pitches has `yRight < yLeft − 1` (it rises **at all**) and `slope < 1` — where the
 * engine's own cap is **0.25**. ⇒ **the bound is four times looser than the thing it bounds**, and
 * there is no lower bound beyond one pixel. Every slope this project could plausibly draw passes it.
 *
 * ⭐ So the gap was never "beams are untested". It was that the net pinned a COUNT, a FLATNESS and a
 * ceiling, and nothing about **how much ink a beam is or where its ends land**. That is what follows.
 *
 * ## ⚠️ What only a browser can say here
 *
 * A staff space is `(bottom − top) / 4` of REAL stave ink, so every number below is expressed in
 * spaces measured off the page rather than in pixels — which is also what makes these assertions
 * survive a staff-size change. ⛔ In jsdom the stave has no measurable ink at all.
 */
import { test, expect } from './fixtures'

/** Bravura's `beamThickness`, and VexFlow's default `beamWidth` — they agree (`engrave/beams/beamLines`). */
const BEAM_THICKNESS_SPACES = 0.5
/** `BEAM_LEVEL_STRIDE` — a beam of ink and half of one of air, which is also `beamSpacing`'s 0.25. */
const LEVEL_STRIDE = 1.5

test('a beamed pair draws ONE quad, half a staff space thick, spanning stem to stem', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (const eighth of [0, 1]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: 1, beat: h.frac(eighth, 2) })
    }
    await h.render()
    // ⚠️ The quad reader hands back the MIDDLE of each edge, so thickness needs the raw path — and
    // ⚠️ `g.vf-beam` holds the STEMS too, because `Beam.drawStems` draws them inside the beam's own
    // group (which is also why `stems()` finds them there). The beam is the CLOSED path.
    const raw = [...document.querySelectorAll('g.vf-beam path')]
      .map(p => p.getAttribute('d') ?? '')
      .filter(d => d.trim().endsWith('Z'))
    return { beams: h.quads('g.vf-beam path'), stems: h.stems(), staves: h.staves(), raw }
  })

  expect(drawn.beams).toHaveLength(1)
  const [beam] = drawn.beams
  const [stave] = drawn.staves
  const space = (stave.bottom - stave.top) / 4

  // ⭐ THICKNESS, from the path's own two left-edge y's — the number `beamLines` draws and the one
  //   the font agrees with. Never assertable in jsdom: it is 5 px only because a space is 10 px.
  const ys = (drawn.raw[0].match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 1)
  const thickness = Math.abs(ys[1] - ys[0])
  expect(thickness / space, 'a beam is half a staff space of ink').toBeCloseTo(BEAM_THICKNESS_SPACES, 2)

  // ⭐⭐ THE P3c/P4a SEAM — the two pieces of ink are drawn by different modules since P4a
  //    (`engrave/notes/stem` and `engrave/beams/beamLines`), and nothing else in the suite checks
  //    that they MEET. The honest test is containment, not equality: a stem's tip must lie INSIDE
  //    the beam's ink, or a hairline of white shows between them at some zoom.
  const [left, right] = drawn.stems
  const top = Math.min(ys[0], ys[1])
  const bottom = Math.max(ys[0], ys[1])
  for (const [stem, which] of [[left, 'first'], [right, 'last']] as const) {
    expect(stem.y2, `the ${which} stem’s tip ends inside the beam’s ink`).toBeGreaterThanOrEqual(top - 0.01)
    expect(stem.y2, `…and not through it`).toBeLessThanOrEqual(bottom + 0.01)
  }

  // ⭐ …and horizontally the beam OVERHANGS both stems — ⚠️ ASYMMETRICALLY, which is the measurement
  //   worth having. Both ends are computed from `getStemX() − Stem.WIDTH / 2`, and only the right one
  //   then gets VexFlow's `+1` seam-closer (`BEAM_END_OVERSHOOT`, read out of `beam.js` and recorded
  //   in `rendering/EngravedBeam`). So the left clears its stem by half a stem-width and the right by
  //   `1 − 0.75` = a quarter of a pixel. ⚠️ Pixels, not spaces: these are device fudges, not
  //   engraving numbers, and P4b's research expects them to die when the line's ends become ours.
  expect(left.x1 - beam.left, 'half a stem-width of overhang at the start').toBeCloseTo(0.75, 1)
  expect(beam.right - right.x1, '…and the +1 fudge less that half-width at the end').toBeCloseTo(0.25, 1)
})

test('sixteenths draw TWO beam lines, one stride apart, in real staff spaces', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (const i of [0, 1]) {
      h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '16', measure: 1, beat: h.frac(i, 4) })
    }
    await h.render()
    return { beams: h.quads('g.vf-beam path'), staves: h.staves() }
  })

  expect(drawn.beams, 'a primary beam and a secondary').toHaveLength(2)
  const space = (drawn.staves[0].bottom - drawn.staves[0].top) / 4
  const gap = Math.abs(drawn.beams[1].yLeft - drawn.beams[0].yLeft) / space
  // ⭐ 1.5 × the thickness — the one two-sources number in this migration where VexFlow and Bravura
  //   AGREE (`beamLines`' header). Asserted here against ink rather than against a constant.
  expect(gap, 'one level stride').toBeCloseTo(BEAM_THICKNESS_SPACES * LEVEL_STRIDE, 2)
  // Both levels start over the same stem.
  expect(drawn.beams[1].left).toBeCloseTo(drawn.beams[0].left, 0)
})

/**
 * 🚨🚨 **THE ONE THAT WOULD HAVE CAUGHT P4b**, and the reason the file exists: it pins the drawn
 * RISE, in staff spaces, both above and below.
 *
 * ⚠️ It is deliberately a RANGE and not a golden. The armed rule is `vexflow` (his call, 2026-09-01)
 * and the alternatives on the shelf would draw this same octave at anything from 0.25 to 1.0 spaces
 * (`engine/engrave/beams/beamSlope.ts`). ⇒ this asserts *which house is armed*, which is exactly the
 * fact a silent change would break. ⛔ If the default is ever deliberately changed, this number moves
 * with it — that is the point, not a maintenance cost.
 */
test('an octave leap rises the amount the ARMED slope rule allows — not more, not less', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: '8', measure: 1, beat: h.frac(1, 2) })
    await h.render()
    return { beams: h.quads('g.vf-beam path'), staves: h.staves() }
  })

  expect(drawn.beams).toHaveLength(1)
  const [beam] = drawn.beams
  const space = (drawn.staves[0].bottom - drawn.staves[0].top) / 4
  const riseSpaces = (beam.yLeft - beam.yRight) / space   // SVG y grows downward ⇒ up is positive
  const runSpaces = (beam.right - beam.left) / space

  expect(riseSpaces, 'it rises with the music').toBeGreaterThan(0)
  // ⭐ `vexflow` caps the ANGLE at 0.25 — so over this run the climb is 0.25 × run, and the measured
  //   0.60 of the research doc's table is that same number at a 2.5-space run.
  expect(riseSpaces / runSpaces, 'the armed rule’s angle cap').toBeCloseTo(0.25, 1)
  expect(riseSpaces, '…which at our quaver spacing is about 0.6 spaces').toBeCloseTo(0.6, 1)
  // 🚨 The lower bound the old test lacked: the tradition's tables would draw 0.25 here, and that
  //   would pass `slope < 1` silently. This fails on it.
  expect(riseSpaces, 'a flattened beam is a DIFFERENT armed rule, and must be seen').toBeGreaterThan(0.4)
})
