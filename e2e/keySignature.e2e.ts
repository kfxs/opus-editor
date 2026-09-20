import { test, expect } from './fixtures'

/**
 * The key signature, measured on the page (docs/plans/key-signature-plan.md P3).
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
const NATURAL = 'e261'

/** One staff space, in px (`STAFF_SPACE_PX`). */
const SPACE = 10

test('⭐ G major draws ONE sharp, and it is on the top line — F♯5', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setKeyAt(1, { alterations: [{ step: 'F', alter: 1 }], mode: 'major' })
    await h.render()
    const staves = h.staves()
    return { signs: h.glyphs('g.keysig text'), top: staves[0].top }
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
    return h.glyphs('g.keysig text')
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
    const sharps = h.glyphs('g.keysig text').map(g => g.x)
    h.engine.setKeyAt(1, {
      alterations: [{ step: 'B', alter: -1 }, { step: 'E', alter: -1 }], mode: 'major',
    })
    await h.render()
    const flats = h.glyphs('g.keysig text')
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
    return { before, after: h.noteheads()[0].x, signs: h.glyphs('g.keysig text').length }
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
    const signs = h.glyphs('g.keysig text')
    return {
      meterBefore,
      meterAfter: meterX(),
      lastSign: signs[signs.length - 1].x,
    }
  })

  // ⭐⭐ **The room the model RESERVED against the distance the meter actually MOVED.** The reservation
  //    is `headerKeyRoom` — clef→key 0.82 + the ink 2.242 + (key→meter 1.15 less the meter's own 0.6
  //    of left air) − **the clef→meter gap it DISPLACED**. The movement is decided independently, by
  //    placing the meter after the signature's ink. **They must agree**: this is the one assertion
  //    that catches the width model and the drawing drifting apart, which is the whole reason
  //    `headerInk.ts` exists.
  //
  // ⭐ **2.61 → 3.04 on 2026-09-12, and BOTH SIDES moved by the same 0.6**, which is why this test is
  //   worth having. The displaced term was a flat `BETWEEN_PARTS` of 1.0 and is now
  //   `clefToMeterGap()` = 0.4 (the armed 1.0 sp of clear white, less the meter's left air —
  //   `engine/layout/clefMeterGap`). So the no-key BASELINE this delta is measured from tightened by
  //   0.6, and `headerKeyRoom` grew by 0.6 to match. ⛔ The signature's own two gaps did not change.
  //
  // ⭐ **3.04 → 3.21 on 2026-09-13, and again only the BASELINE moved.** The no-key meter is placed
  //   from the clef's ink by the same conversion this arm uses, and that conversion's bearing had
  //   the wrong SIGN — it read as correct because the browser's ink reader under-reports a white gap
  //   by ~0.2 sp, more than the 0.16 the two signs differ by
  //   (`e2e/headerGap`'s `readerInflation` calibration — ⚠️ a bias of VexFlow's embedded Bravura
  //   build, found 2026-09-14; the fonts we ship read within half a pixel). ⇒ the no-key meter moved 1.6 px LEFT, onto
  //   the armed 1.0 of clear white it was always supposed to have, and this delta grew by exactly
  //   that. ⛔ The WITH-key placement did not move — the assertion below is unchanged, and that is
  //   the proof this was the baseline and not the signature.
  expect((moved.meterAfter - moved.meterBefore) / 10, 'reserved = drawn').toBeCloseTo(3.21, 1)
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
    const signs = h.glyphs('g.keysig text')
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
    return { signs: h.glyphs('g.keysig text'), bar3X: bars.length > 0 ? bars[0].x1 : 0 }
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

test('⭐⭐ a bar whose header ends in a SIGNATURE centres its rest in the room it may OCCUPY', async ({ score }) => {
  const bar = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 2; m <= 10; m++) h.engine.addMeasure()
    // A MID-LINE change, so the signature is the last thing in the bar's header (no meter after it).
    h.engine.setKeyAt(3, {
      alterations: [{ step: 'B', alter: -1 }, { step: 'E', alter: -1 }, { step: 'A', alter: -1 }],
      mode: 'major',
    })
    await h.render()
    const staves = h.staves()
    const s = staves.find(v => v.measure === 3)!
    const inBar = (g: { x: number; y: number }) =>
      Math.abs(g.y - s.top) < 60 && g.x >= s.x1 - 2 && g.x < s.x2
    const signs = h.glyphs('g.keysig text').filter(inBar)
    const rest = h.rests().filter(inBar)[0]
    return {
      // ⚠️ INK, both of them: the last flat's own right edge (`accidentalFlat.right` = 0.904 sp past
      //   its origin) and the whole rest's (`restWhole` runs 0 → 1.128 sp).
      signInkRight: Math.max(...signs.map(g => g.x)) + 9.04,
      restInkLeft: rest.x,
      restInkRight: rest.x + 11.28,
      barlineRight: s.x2,
      signs: signs.length,
    }
  })

  expect(bar.signs, 'three flats').toBe(3)
  // ⭐⭐ **The span is the room a REST may stand in, not the bare gap** — his report of 2026-08-28,
  //    *"the rest should be center in the empty space… i dont see the rest centered, is more to the
  //    right"*, and then the same correction placed BY HAND on two different bars (−0.5 and −0.75 sp).
  //
  // ⭐ Both bounds are `pairPadding` rows that predate this bar: a rest may come within **0.5** sp of
  //    an accidental and must stop **1.65** sp short of a barline (MuseScore `table[REST][BAR_LINE]`).
  //    ⛔ Nothing is added to the ANSWER — his rule: *"dont apply a magic number, cause with
  //    different keys will be different."* The left bound is measured ink, so another key moves it.
  const left = bar.signInkRight + 0.5 * SPACE
  const right = bar.barlineRight - 1.65 * SPACE
  const centre = left + (right - left) / 2
  const restCentre = (bar.restInkLeft + bar.restInkRight) / 2
  expect(Math.abs(restCentre - centre), 'centred in the occupiable span').toBeLessThan(1)
  // …and that is measurably NOT the bare-gap centre, which is where it sat before (about 0.57 sp right).
  const bareCentre = bar.signInkRight + (bar.barlineRight - bar.signInkRight) / 2
  expect(bareCentre - restCentre, 'and left of the bare-gap answer').toBeGreaterThan(0.4 * SPACE)
})

test('🚨🚨 the three HEADER HIT BOXES are each on their own glyph — clef, signature, meter', async ({ score }) => {
  const boxes = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.setKeyAt(1, {
      alterations: [{ step: 'F' as const, alter: 1 as const }, { step: 'C' as const, alter: 1 as const }],
      mode: 'major' as const,
    })
    await h.render()
    const reg = h.engine.getElementRegistry()
    const box = (t: 'clef' | 'keySignature' | 'timeSignature') => {
      const e = reg.getByType(t).find(el => el.measure === 1)!
      return { x: e.bbox.x, right: e.bbox.x + e.bbox.width }
    }
    return {
      clef: box('clef'), key: box('keySignature'), meter: box('timeSignature'),
      signs: h.glyphs('g.keysig text').map(g => g.x),
      // The meter's DIGITS as drawn — any of them names the column.
      digits: h.glyphs('text').filter(g => g.code >= 'e080' && g.code <= 'e089').map(g => g.x).sort((a, b) => a - b),
    }
  })

  // 🚨 **HIS TWO REPORTS, 2026-08-28:** *"here the key signature is not been selected or at least not
  //    highlited"* (every press on the sharps answered `timeSignature`), then *"here the time signature
  //    is not selected or highlited either"* (a press on the digits answered nothing). ONE bug: the
  //    meter's box was `bar left edge + a CONSTANT clef width`, written when nothing could stand
  //    between the clef and the meter. Measured then: meter 65→95, signs 60→82, digits from 93.
  //
  // ⭐ Now each box is its own INK, so the two claims below are what a press can rely on.
  // 1. The meter's box is ON its digits — the failure that made the meter unselectable.
  expect(boxes.meter.x, 'the meter box starts at its first digit').toBeGreaterThan(boxes.digits[0] - 2)
  expect(boxes.meter.x, '…and not before it').toBeLessThan(boxes.digits[0] + 3)
  // 2. It does NOT reach back over the signature — the failure that made the KEY unselectable.
  expect(boxes.meter.x, 'the meter box clears the signature').toBeGreaterThan(boxes.key.right)
  // …and the signature's own box covers every sign it drew.
  expect(boxes.key.x).toBeLessThanOrEqual(Math.min(...boxes.signs) + 0.01)
  expect(boxes.key.right, 'past the last sign').toBeGreaterThan(Math.max(...boxes.signs))
})

// ---------------------------------------------------------------------------
// P4 — the ACCIDENTAL RIPPLE (docs/plans/key-signature-plan.md §3). The signature stops being a picture at
// the head of the bar and starts deciding what every note under it draws.
// ---------------------------------------------------------------------------

// ⚠️ The selector and the codepoints are written out INSIDE each `evaluate` below: the closure is
// serialised into the page, so a module-level const here is not in scope there — a note's own
// accidental glyphs are `g.notehead text`, sharp `e262` and natural `e261`.

test('⭐⭐ an F♯ in G major draws NO sign, and an F♮ draws a natural — the whole of P4, on the page', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    const G_MAJOR = { alterations: [{ step: 'F' as const, alter: 1 as const }], mode: 'major' as const }
    // Two bars, each holding one F4: the first sharpened, the second natural.
    h.engine.addMeasure()
    h.engine.addNoteAtBeat({ step: 'F', alter: 1, octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'F', alter: 0, octave: 4, duration: 'w', measure: 2, beat: h.frac(0, 1) })

    await h.render()
    const signs = () => h.glyphs('g.notehead text')
      .filter(g => g.code === 'e262' || g.code === 'e261').map(g => g.code)
    const inC = signs()

    h.engine.setKeyAt(1, G_MAJOR)
    await h.render()
    return { inC, inG: signs() }
  })

  // In C major: the F♯ shows its sharp, the F♮ shows nothing.
  expect(drawn.inC, 'C major — one sharp, no natural').toEqual([SHARP])
  // In G major the two swap over: the sharp is what the signature says, the natural contradicts it.
  expect(drawn.inG, 'G major — the sharp goes, the natural arrives').toEqual([NATURAL])
})

test('🚨 setting the key at bar 1 REPAINTS a far bar — the governing-key row in the shape key', async ({ score }) => {
  // ⚠️ The bug this guards is invisible any other way: bar 12's own content never changes, so without
  // `ShapeKeyInputs.key` the incremental renderer replays its cached `<g>` and the old accidental
  // stands under the new signature forever. Twelve bars is enough to be well past the first system.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let i = 0; i < 12; i++) h.engine.addMeasure()
    h.engine.addNoteAtBeat({ step: 'F', alter: 0, octave: 4, duration: 'w', measure: 12, beat: h.frac(0, 1) })
    await h.render()
    const naturals = () => h.glyphs('g.notehead text').filter(g => g.code === 'e261').length
    const before = naturals()

    h.engine.setKeyAt(1, { alterations: [{ step: 'F' as const, alter: 1 as const }], mode: 'major' as const })
    await h.render()
    return { before, after: naturals() }
  })

  expect(drawn.before, 'in C major the F♮ at bar 12 needs no sign').toBe(0)
  expect(drawn.after, 'a key set eleven bars earlier put one there').toBe(1)
})

test('⭐⭐ a COURTESY survives the key agreeing with it — Gould p. 81, and his report', async ({ score }) => {
  // *"Suppose the F♯ I want to make it explicit, so I added ♯ to the F that is already ♯ — what I
  //  expect is to see the accidental written."* The forced sign is drawn although the signature
  //  already says it; the unforced one beside it is not.
  const signs = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setKeyAt(1, { alterations: [{ step: 'F' as const, alter: 1 as const }], mode: 'major' as const })
    h.engine.addNoteAtBeat({ step: 'F', alter: 1, octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1), forceAccidental: true })
    h.engine.addNoteAtBeat({ step: 'F', alter: 1, octave: 5, duration: 'h', measure: 1, beat: h.frac(2, 1) })
    await h.render()
    return h.glyphs('g.notehead text').filter(g => g.code === 'e262').length
  })

  expect(signs, 'the FORCED one only — the other is silent under the signature').toBe(1)
})

// ---------------------------------------------------------------------------
// P6 — CANCELLING NATURALS and the CAUTIONARY at a system break
// (docs/plans/key-signature-plan.md §4.2, and the measurements from Gould p. 93.)
// ---------------------------------------------------------------------------

test('⭐⭐ a change to C MAJOR draws cancelling naturals, where the old signs stood', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 2; m <= 8; m++) h.engine.addMeasure()
    const E_FLAT = {
      alterations: [
        { step: 'B' as const, alter: -1 as const },
        { step: 'E' as const, alter: -1 as const },
        { step: 'A' as const, alter: -1 as const },
      ],
      mode: 'major' as const,
    }
    h.engine.setKeyAt(3, E_FLAT)
    h.engine.setKeyAt(6, { alterations: [], mode: 'major' })
    await h.render()
    const at = (m: number) => {
      const s = h.staves().find(v => v.measure === m)!
      return h.glyphs('g.keysig text')
        .filter(g => g.x >= s.x1 - 2 && g.x < s.x2 && Math.abs(g.y - s.top) < 60)
        .map(g => ({ code: g.code, y: Math.round(g.y) }))
    }
    const geom = h.engine.getElementRegistry().getStaffGeometry(6, 0)
    return { flats: at(3), naturals: at(6), inherited: at(7), noteStartX: geom?.noteStartX ?? 0 }
  })

  // ⭐ **Gerou & Lusk p. 79:** *"Cancellations are no longer considered necessary, unless the new key
  //   is C major or A minor."* Bar 6 is that exception — without the naturals the change would draw
  //   nothing at all and the reader would never learn of it.
  expect(drawn.naturals.map(n => n.code), 'three naturals').toEqual([NATURAL, NATURAL, NATURAL])
  // 🚨 **Each stands where the sign it cancels stood** — the same three y's as the flats in bar 3. A
  //   natural is `alter: 0`, and the placement table reads `alter >= 0` as the SHARP row, so this is
  //   the assertion that the cancellation carries the cancelled sign's own position.
  expect(drawn.naturals.map(n => n.y)).toEqual(drawn.flats.map(f => f.y))
  expect(drawn.flats.map(f => f.code), 'and bar 3 is flats').toEqual([FLAT, FLAT, FLAT])
  // ⭐ Bar 7 inherits C major and restates nothing — a cancellation is a CHANGE's ink, not a state's.
  expect(drawn.inherited, 'nothing at bar 7').toEqual([])
  // …and the room was really reserved: the notes start past the naturals.
  expect(drawn.noteStartX).toBeGreaterThan(0)
})

test('⭐⭐ a key change ON a system break is engraved at the END of the previous line — Gould p. 93', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 2; m <= 30; m++) h.engine.addMeasure()
    await h.render()
    // Which bar ends line 1 is the casting-off's answer, so ask it rather than assuming.
    const top0 = Math.round(h.staves()[0].top)
    const line1 = h.staves().filter(s => Math.round(s.top) === top0)
    const last = line1[line1.length - 1]
    h.engine.setKeyAt(last.measure + 1, {
      alterations: [{ step: 'F' as const, alter: 1 as const }, { step: 'C' as const, alter: 1 as const }],
      mode: 'major' as const,
    })
    await h.render()
    const endsLine = h.staves().find(v => v.measure === last.measure)!
    const opensNext = h.staves().find(v => v.measure === last.measure + 1)!
    // ⚠️ x-restricted as well as banded: the LINE's own head signature shares the y band, so a
    //    y-only filter would pick it up too (it did, first time round).
    const band = (s: { top: number; x1: number }) => (g: { y: number; x: number }) =>
      Math.abs(g.y - s.top) < 60 && g.x > s.x1
    return {
      endsLine: {
        measure: last.measure,
        barlineX: endsLine.x2,
        signs: h.glyphs('g.keysig text').filter(band(endsLine)).map(g => g.x),
        // The OPEN STAFF the courtesy stands on — five rects drawn by the pass that owns the tail.
        tail: [...document.querySelectorAll('[id^="keysig-caution"] rect')].map(r => ({
          x: +(r.getAttribute('x') ?? 0),
          right: +(r.getAttribute('x') ?? 0) + +(r.getAttribute('width') ?? 0),
        })),
        // Every barline drawn on that line, to prove none follows the courtesy.
        barlines: h.barlines().filter(b => Math.abs(b.y - endsLine.top) < 60).map(b => b.x),
      },
      opensNext: {
        measure: opensNext.measure,
        signs: h.glyphs('g.keysig text').filter(band(opensNext)).filter(g => g.x < opensNext.x2).length,
      },
    }
  })

  // ⭐⭐ **Gould, printed p. 93:** *"When a key change coincides with a system break, the cancelling
  //    naturals and the new key signature go at the end of the first system. The new system takes
  //    only the new key signature."* No option to omit is offered — MOLA requires it, Dorico cannot
  //    switch it off — so ⛔ there is no override to set for this test.
  expect(drawn.endsLine.signs, 'two sharps at the end of line 1').toHaveLength(2)
  // ⭐ **AFTER the barline, 0.75 sp** — measured off that very figure at 450 dpi. G&L p. 52 states
  //   the asymmetry: a courtesy CLEF goes before the last barline, a key signature and meter after it.
  const firstSign = Math.min(...drawn.endsLine.signs)
  expect((firstSign - drawn.endsLine.barlineX) / SPACE, 'barline → first sign').toBeCloseTo(0.75, 1)
  // ⭐ **And the staff is LEFT OPEN** — no barline after the courtesy (Ross p. 148: *"the staff
  //   remains open"*; G&L p. 28: *"leave open"*).
  expect(Math.max(...drawn.endsLine.barlines), 'the last line drawn is the bar’s own')
    .toBeCloseTo(drawn.endsLine.barlineX, 0)
  // ⭐ The new system then takes ONLY the new signature — the naturals stay behind on the break.
  expect(drawn.opensNext.signs, 'two sharps and nothing else').toBe(2)
  // 🚨🚨 **AND IT STANDS ON A STAFF — his report, 2026-08-28:** *"look, the key cautionary is there,
  //    but where is the pentagram?"* The room is taken off the LINE, not out of the bar, so the last
  //    bar's own staff lines stop at its barline: the tail belongs to the SYSTEM and is drawn by the
  //    pass that puts the courtesy there (`KeySignaturePass.drawOpenStaffTail`).
  expect(drawn.endsLine.tail, 'five staff lines under the courtesy').toHaveLength(5)
  expect(drawn.endsLine.tail[0].x, 'starting at the barline').toBeCloseTo(drawn.endsLine.barlineX, 0)
  expect(drawn.endsLine.tail[0].right, '…and reaching past the last sign')
    .toBeGreaterThan(Math.max(...drawn.endsLine.signs))
})

test('⭐ …and when the break lands on a change to C major, the NATURALS are what the courtesy carries', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    for (let m = 2; m <= 30; m++) h.engine.addMeasure()
    h.engine.setKeyAt(3, {
      alterations: [
        { step: 'B' as const, alter: -1 as const },
        { step: 'E' as const, alter: -1 as const },
        { step: 'A' as const, alter: -1 as const },
      ],
      mode: 'major' as const,
    })
    await h.render()
    const top0 = Math.round(h.staves()[0].top)
    const line1 = h.staves().filter(s => Math.round(s.top) === top0)
    const last = line1[line1.length - 1]
    h.engine.setKeyAt(last.measure + 1, { alterations: [], mode: 'major' })
    await h.render()
    const endsLine = h.staves().find(v => v.measure === last.measure)!
    const opensNext = h.staves().find(v => v.measure === last.measure + 1)!
    // ⚠️ Past the last bar's left edge, so the LINE's own head signature (E♭, reprinted at every
    //    system head) is not counted as part of the courtesy.
    const band = (s: { top: number; x1: number }) => (g: { y: number; x: number }) =>
      Math.abs(g.y - s.top) < 60 && g.x > s.x1
    return {
      courtesy: h.glyphs('g.keysig text').filter(band(endsLine)).map(g => g.code),
      newLine: h.glyphs('g.keysig text').filter(band(opensNext)).filter(g => g.x < opensNext.x2).length,
    }
  })

  // ⭐ The one case where the courtesy is the ONLY ink the change ever gets: the new line's signature
  //   is empty, so if the naturals did not go at the break, nothing on the page would say the key
  //   changed at all.
  expect(drawn.courtesy, 'three naturals at the break').toEqual([NATURAL, NATURAL, NATURAL])
  expect(drawn.newLine, 'and C major draws nothing on the new line').toBe(0)
})
