import { test, expect } from './fixtures'

/**
 * The key signature, measured on the page (docs/key-signature-plan.md P3).
 *
 * ⚠️⚠️ **These assertions are a different kind from the rest of this suite, and the difference is
 * worth stating.** Everywhere else the browser RE-MEASURES a number we took off someone else's
 * drawing. Here the extent is **computed from the font** (`keySignatureExtent` sums Bravura's own
 * advances), so what the browser can catch is not a bad measurement — it is us drawing the signs
 * somewhere other than where we said they would be. The room and the ink are checked against each
 * other, which is the only failure this arrangement still allows.
 *
 * ⛔ None of this can be a unit test: jsdom measures every glyph as 0×0, so an assertion about where
 * a sharp landed would measure zeros and agree with itself.
 */

/** SMuFL, and the codepoints `KeySignaturePass` writes out. */
const SHARP = 'e262'
const FLAT = 'e260'

/** One staff space, in px (`STAFF_SPACE_PX`). */
const SPACE = 10

test('⭐ G major draws ONE sharp, and it is on the top line — F♯5', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setKeyAt(1, { alterations: [{ step: 'F', alter: 1 }], mode: 'major' })
    await h.render()
    const staves = h.staves()
    return { signs: h.glyphs('g.vf-keysig text'), top: staves[0].top }
  })

  expect(drawn.signs, 'one sign').toHaveLength(1)
  expect(drawn.signs[0].code).toBe(SHARP)
  // The top line of the staff IS F5 in treble, so the sign's anchor y sits on it.
  // ⚠️ Within a pixel, not to the pixel: the drawn `<text>` y is rounded, and the stave line is not.
  expect(Math.abs(drawn.signs[0].y - drawn.top), 'F♯ on the top line').toBeLessThanOrEqual(1)
})

test('⭐⭐ two sharps stand 1.25 spaces apart — Ross\'s number, stated and engraved', async ({ score }) => {
  const signs = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setKeyAt(1, {
      alterations: [{ step: 'F', alter: 1 }, { step: 'C', alter: 1 }], mode: 'major',
    })
    await h.render()
    return h.glyphs('g.vf-keysig text')
  })

  expect(signs).toHaveLength(2)
  // ⭐ The pitch our ONE gap of 0.25 predicts: 0.996 (Bravura's advance) + 0.25 = 1.246.
  expect((signs[1].x - signs[0].x) / 10, 'sharp → sharp').toBeCloseTo(1.25, 1)
  // …and C♯5 sits a FOURTH below F♯5 — three staff steps, one and a half spaces.
  expect(signs[1].y - signs[0].y, 'C♯ a fourth below F♯').toBeCloseTo(1.5 * SPACE, 0)
})

test('⭐ a FLAT signature is NARROWER than the same count of sharps, from the glyph alone', async ({ score }) => {
  const both = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setKeyAt(1, {
      alterations: [{ step: 'F', alter: 1 }, { step: 'C', alter: 1 }], mode: 'major',
    })
    await h.render()
    const sharps = h.glyphs('g.vf-keysig text').map(g => g.x)
    h.engine.setKeyAt(1, {
      alterations: [{ step: 'B', alter: -1 }, { step: 'E', alter: -1 }], mode: 'major',
    })
    await h.render()
    const flats = h.glyphs('g.vf-keysig text')
    return { sharpPitch: sharps[1] - sharps[0], flats }
  })

  expect(both.flats.map(g => g.code)).toEqual([FLAT, FLAT])
  const flatPitch = both.flats[1].x - both.flats[0].x
  // 1.15 against 1.25 — the difference falls out of the advance, with one gap for both.
  expect(flatPitch / 10, 'flat → flat').toBeCloseTo(1.15, 1)
  expect(flatPitch, 'and it is the narrower of the two').toBeLessThan(both.sharpPitch)
})

test('🚨🚨 C MAJOR DRAWS NOTHING AND COSTS NOTHING — the bar is identical to one with no key at all', async ({ score }) => {
  const both = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    await h.render()
    const before = h.noteheads()[0].x
    // Setting C major at bar 1 stores nothing (it is already in force) — so also set it at bar 2,
    // where it IS a change, and check the bar in front of it is untouched.
    h.engine.setKeyAt(1, { alterations: [], mode: 'open' })
    await h.render()
    return { before, after: h.noteheads()[0].x, signs: h.glyphs('g.vf-keysig text').length }
  })

  expect(both.signs, 'an open key draws no glyph').toBe(0)
  // ⭐ The row that keeps every C-major score honest: an empty signature is not a header PART, so it
  // is charged neither its own extent nor a BETWEEN_PARTS, and the first note has not moved a pixel.
  expect(both.after, 'and the music did not move').toBeCloseTo(both.before, 1)
})

test('⭐⭐ the METER moved over for the signature — the room reserved is the room the signs take', async ({ score }) => {
  const moved = await score.evaluate(async () => {
    const h = window.__h
    await h.render()
    // The time signature's digits, before and after — `4/4` draws two glyphs, one over the other.
    // ⚠️ Selected by SMuFL range, not by group: a stave modifier is drawn into the stave's own
    // group with no class of its own, so there is no selector for "the meter" (timeSig0–9 are
    // U+E080–E089). The same trick the harness uses to tell a rest from a notehead.
    const meterX = () => Math.min(...h.glyphs('text')
      .filter(g => g.code >= 'e080' && g.code <= 'e089').map(g => g.x))
    const meterBefore = meterX()
    h.engine.setKeyAt(1, {
      alterations: [{ step: 'F', alter: 1 }, { step: 'C', alter: 1 }], mode: 'major',
    })
    await h.render()
    const signs = h.glyphs('g.vf-keysig text')
    return {
      meterBefore,
      meterAfter: meterX(),
      lastSign: signs[signs.length - 1].x,
    }
  })

  // ⭐⭐ **The room the model RESERVED against the distance the meter actually MOVED.** The reservation
  //    is `headerKeyRoom` — clef→key 0.82 + the ink 2.242 + (key→meter 1.15 less the meter's own 0.6
  //    of left air) − the 1.0 clef→meter padding it displaced = 2.61 spaces. The movement is decided
  //    independently, by placing the meter after the signature's ink. **They must agree**: this is
  //    the one assertion that catches the width model and the drawing drifting apart, which is the
  //    whole reason `headerInk.ts` exists.
  expect((moved.meterAfter - moved.meterBefore) / 10, 'reserved = drawn').toBeCloseTo(2.61, 1)
  // ⭐⭐ **The white a reader actually sees, INK TO INK** — the sharp's ink ends at its origin + its
  //   advance (0.996, and `left` is 0 so the origin IS its left edge), and the digit's ink begins
  //   0.08 sp PAST its own origin (`timeSig4.left` is −0.08).
  //
  // ⛔ Measuring to the meter's ORIGIN instead reads 1.49 and is a bbox number: it counts the
  //   digit's own left air as if it were the gap. His rule — every space is decided in ink.
  expect((moved.meterAfter + 0.8 - (moved.lastSign + 9.96)) / 10, 'white after the last sharp')
    .toBeCloseTo(1.15, 2)
})

test('⭐⭐ BOTH GAPS around the signature are the ENGINES\' numbers, measured in INK', async ({ score }) => {
  const gaps = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setKeyAt(1, {
      alterations: [{ step: 'F', alter: 1 }, { step: 'C', alter: 1 }], mode: 'major',
    })
    await h.render()
    const signs = h.glyphs('g.vf-keysig text')
    const clef = h.glyphs('text').find(g => g.code === 'e050')!
    const meter = Math.min(...h.glyphs('text')
      .filter(g => g.code >= 'e080' && g.code <= 'e089').map(g => g.x))
    return {
      // gClef ink runs to 2.684 sp past its origin; a sharp's ink starts AT its origin (left = 0);
      // a time-signature digit's ink starts 0.08 sp past its origin (left = −0.08).
      beforeKey: (signs[0].x - (clef.x + 26.84)) / 10,
      afterKey: ((meter + 0.8) - (signs[1].x + 9.96)) / 10,
    }
  })

  // ⭐⭐ **The two engines' own numbers, drawn.** LilyPond `Clef.space-alist (key-signature . 0.82)`
  //    and `KeySignature.space-alist (time-signature . 1.15)`; MuseScore `clefKeyDistance 0.75` /
  //    `keyTimesigDistance 1.0`. Ross's engraved clef → 1st sharp (3½ sp origin-to-origin) restates
  //    to 0.82 against Bravura's gClef.
  //
  // 🚨 Both were wrong once and BOTH were caught by eye. 1.02 and 1.52 first — two different rules,
  //    one of them VexFlow's leftover padding. Then 1.5 and 1.6, from Gould's label plus an ink
  //    correction — *"isn't the first accidental too far from the clef?"*, *"isn't the last
  //    accidental too far from the time signature?"* Both times the engines had the number outright.
  expect(gaps.beforeKey, 'clef ink → first sign').toBeCloseTo(0.82, 1)
  expect(gaps.afterKey, 'last sign → meter ink').toBeCloseTo(1.15, 1)
})

test('⭐ a mid-score key change draws its signature at THAT bar, and nowhere before it', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 3; i++) h.engine.addMeasure()
    h.engine.setKeyAt(3, { alterations: [{ step: 'B', alter: -1 }], mode: 'major' })
    await h.render()
    const bars = h.staves()
    return { signs: h.glyphs('g.vf-keysig text'), bar3X: bars.length > 0 ? bars[0].x1 : 0 }
  })

  // ⭐ ONE signature: bar 3's. Bars 1 and 2 are in C and draw nothing, and bar 4 INHERITS B♭ major —
  //   an inherited signature is not restated mid-line, which is the clef's rule exactly.
  expect(drawn.signs).toHaveLength(1)
  expect(drawn.signs[0].code).toBe(FLAT)
  expect(drawn.signs[0].x, 'and it is not at the head of the system').toBeGreaterThan(drawn.bar3X + SPACE)
})

test('⭐⭐ EVERY bar centres its whole-bar rest in its own FREE SPACE — one rule, headed or not', async ({ score }) => {
  const bars = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 5; i++) h.engine.addMeasure()
    h.engine.setKeyAt(1, {
      alterations: [{ step: 'F', alter: 1 }, { step: 'C', alter: 1 }], mode: 'major',
    })
    await h.render()
    const staves = h.staves()
    const rests = h.rests()
    const meterInkRight = Math.max(...h.glyphs('text')
      .filter(g => g.code >= 'e080' && g.code <= 'e089').map(g => g.x)) + 18
    return staves.slice(0, 6).map((stave, i) => ({
      measure: stave.measure,
      // ⚠️ The rest's INK centre: `restWhole` runs 0 → 1.128 sp from its origin.
      restCentre: rests[i].x + 5.64,
      // The free space: after the header on bar 1, the whole bar on every other.
      freeLeft: stave.measure === 1 ? meterInkRight : stave.x1,
      right: stave.x2,
    }))
  })

  // ⭐⭐ **MuseScore's rule, from its own source** (`measurelayout.cpp`): a full-measure rest *"has to
  //    be centered in free space — x1 [the] left measure position of free space"*, where x1 is the
  //    header's right edge. So a line-opening bar centres in what the clef, key and meter leave, and
  //    every other bar centres between its barlines. ONE rule; the geometry differs.
  //
  // 🚨 And the centre is **half of the measured span**, never a nudge: *"the center should be a
  //    proportion based on the length of the geometry"*. Before that, the left bound was
  //    `getNoteStartX()` — the header's ink PLUS the 2.0 sp the music needs — and every line-opening
  //    rest sat half a staff space right of where it belonged. Reported by eye.
  for (const bar of bars) {
    const freeCentre = bar.freeLeft + (bar.right - bar.freeLeft) / 2
    expect(Math.abs(bar.restCentre - freeCentre), `bar ${bar.measure}`).toBeLessThan(1)
  }
})
