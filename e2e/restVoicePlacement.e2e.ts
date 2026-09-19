import { test, expect } from './fixtures'
import type { Glyph, StaveBox } from './harness'

/**
 * ⭐⭐ **WHERE A MULTI-VOICE REST ACTUALLY LANDS ON THE PAGE** — the geometry net the rest work had
 * never had (`docs/multi-voice-rest-position-plan.md` P2).
 *
 * `engine/layout/restVoicePlacement.test.ts` proves the RULE computes the right line. This proves
 * the line **reaches the drawing** — a different failure, and one ⛔ nothing in jsdom can see, since
 * every glyph measures 0×0 there and an assertion about where the ink landed agrees with itself.
 *
 * ⚠️ **What it does NOT cover, stated so nobody trusts it for this**: the `intendedRestLine`
 * re-assertion after `format()` (`ScoreRenderer`, the guard against VexFlow's own ±1 same-tick
 * nudge). Disabling that line leaves both cases below GREEN — checked, 2026-08-31 — because
 * VexFlow's nudge does not fire on this texture and is one line even where it does, which is inside
 * the tolerances here. A fixture that pins it would need two voices RESTING at one tick, and the
 * lane order now separates those by several spaces. ⛔ So this file is not that test, and claiming
 * it were would be worse than not having one.
 *
 * ⚠️ **It cannot load the prelude.** `harness.ts` has no `loadJSON` and no fixture loader, and the
 * example lives in `public/`; what the harness exposes is the ENGINE. So the texture is built by
 * hand — which is the honest version anyway: the fault has to be reproducible from three
 * `addNoteAtBeat` calls, or it was never about the file.
 *
 * ⚠️ The `rests()` reader tells rests from noteheads by **SMuFL range**, not by the DOM: VexFlow
 * draws both into `g.notehead` groups, so without that filter "the noteheads" would silently
 * include every rest the model fills the rest of the bar with.
 */

/** A staff space, measured from the drawn stave — ⛔ never a constant: a small staff must measure small. */
const spaceOf = (stave: StaveBox): number => (stave.bottom - stave.top) / 4

/**
 * The drawn line of a glyph on {@link restVoicePlacement}'s own axis — **VexFlow lines, 5 = top,
 * 3 = the middle, 1 = the bottom**, one per staff space, continuing off the staff.
 *
 * ⚠️ `(y − top) / space` is spaces BELOW the top line, which is `restPlacement`/`spacingPadding`'s
 * axis; the `5 −` is the same flip the module makes at `restNeutralLine`. Done here so the numbers
 * this spec asserts are the numbers the module's own spec asserts.
 */
const lineOf = (glyph: Glyph, stave: StaveBox): number =>
  5 - (glyph.y - stave.top) / spaceOf(stave)

test('⭐⭐ the prelude’s bar: an upper voice’s 16th rest is drawn ABOVE the held note under it', async ({ score }) => {
  // The fault this whole feature exists for, in its original shape (his report, 2026-08-31): in a
  // two-voice bass staff the upper voice's rest landed under the lower voice's held note and had to
  // be dragged clear by hand — 67 times in one file.
  //
  //   voice 1:  𝄾(16th)   E4(8th)   E4(quarter)
  //   voice 2:  C4 held through the first half
  //
  // Bass clef, so both parts sit on LEDGER LINES ABOVE the staff — the prelude's own register, and
  // what made the hand-placed shifts so large.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setClef(1, 'bass')
    // The lower voice FIRST, so the upper voice's 16th rest is a gap-fill over a note already there
    // — which is also the one thing VexFlow structurally cannot see (its collision is same-tick).
    h.engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: h.frac(0, 1), voice: 1 })
    h.engine.addNoteAtBeat({ step: 'E', octave: 4, duration: '8', measure: 1, beat: h.frac(1, 4), voice: 0 })
    h.engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: h.frac(1, 2), voice: 0 })
    await h.render()
    // Raw readings only — the arithmetic is done in the spec, where it can be read.
    return { stave: h.staves()[0], rests: h.rests(), heads: h.noteheads() }
  })

  const space = spaceOf(drawn.stave)
  // Beat 0 is the leftmost column, and it holds exactly two things: the rest and the held note.
  const rest = drawn.rests[0]
  const held = drawn.heads[0]

  // ⚠️ The pair really is the one at beat 0 — same column, so the rest IS written over the held
  //    note. Without this the test could pass by comparing the rest with some later notehead.
  expect(Math.abs(rest.x - held.x), 'the rest and the held note share beat 0’s column')
    .toBeLessThan(space)
  expect(rest.code, 'a 16th rest').toBe('e4e7')

  // ⭐⭐ THE ASSERTION. SVG y grows DOWNWARD, so "above" is a SMALLER y.
  expect(rest.y, 'the rest is drawn above the held notehead').toBeLessThan(held.y)

  // …and CLEAR of it, not merely past its centre: the rule puts the rest's near ink edge a gap
  // beyond the notehead, so the two anchors end up more than a staff space apart. ⛔ Not a golden —
  // `GAP` is an engine constant and tunable by eye; what may never come back is the overlap.
  expect(held.y - rest.y, 'and clear of it by more than one staff space').toBeGreaterThan(space)

  // The held C4 is itself above the staff in bass clef, which is the register that made this bar
  // hard: the rest has to clear ink that is already outside the staff (Gould p. 37 says so too —
  // "when a note is on a ledger line, place the rests above the top stave-space").
  expect(lineOf(held, drawn.stave), 'C4 sits above the top line in bass clef').toBeGreaterThan(5)
  expect(lineOf(rest, drawn.stave), 'and the rest above that')
    .toBeGreaterThan(lineOf(held, drawn.stave))
})

test('⭐ the CONTROL: the same bar with ONE voice keeps its rest centred', async ({ score }) => {
  // ⭐⭐ This is what makes the case above mean anything: it says the displacement is caused by THE
  // OTHER VOICE, and not by the rule having quietly moved every rest in the app. Gould p. 34 owns
  // the single-voice position — "rests remain centred within the stave regardless of the pitches of
  // surrounding notes" — and ⛔ nothing in this feature was allowed to touch it.
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.setClef(1, 'bass')
    // The identical upper voice, with nothing underneath it.
    h.engine.addNoteAtBeat({ step: 'E', octave: 4, duration: '8', measure: 1, beat: h.frac(1, 4), voice: 0 })
    h.engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: h.frac(1, 2), voice: 0 })
    await h.render()
    return { stave: h.staves()[0], rests: h.rests() }
  })

  expect(drawn.rests[0].code, 'the same 16th rest as above').toBe('e4e7')
  // ⚠️ An explicit tolerance rather than `toBeCloseTo`: `stave.top` is a hairline nudged onto the
  //    device pixel grid, which at 10px per staff space is already 0.05 of a line.
  expect(Math.abs(lineOf(drawn.rests[0], drawn.stave) - 3),
    'anchored to the middle line, exactly as one voice always was').toBeLessThan(0.1)
})
