import { test, expect } from './fixtures'
import type { Glyph, StaveBox } from './harness'

/**
 * ⭐ **WHERE A STAMPED FULL-BAR REST LANDS ON THE PAGE** — P3 of `docs/plans/voice-measure-rest-plan.md`.
 *
 * A stamped rest is an ordinary measure rest in a voice other than 1, drawn by the rules that already
 * existed (`NoteBuilder`'s centred whole rest, `centerMeasureRests`, `restVoicePlacement`). His eye
 * checked it on 2026-09-26; this pins it, so a later change to any of those rules cannot quietly move
 * it. ⛔ No new rule is asserted here — only that the stamp reaches the drawing the rules already make.
 *
 * ⚠️ The harness cannot tell WHICH voice drew a rest (both voices draw into `g.notehead`, uncoloured),
 * so every case pairs the stamped rest with something whose place is known: a voice-1 whole note on
 * the middle line, or the automatic rest drawn in the same bar before the stamp.
 */

const spaceOf = (stave: StaveBox): number => (stave.bottom - stave.top) / 4
/** Lines on `restVoicePlacement`'s axis: 5 = top, 3 = middle, 1 = bottom. */
const lineOf = (glyph: Glyph, stave: StaveBox): number => 5 - (glyph.y - stave.top) / spaceOf(stave)
const inBar = (glyphs: Glyph[], stave: StaveBox): Glyph[] => glyphs.filter(g => g.x >= stave.x1 && g.x < stave.x2)
/** SMuFL `restWhole` — a full-bar rest is drawn as one. */
const WHOLE_REST = 'e4e3'

test('voice 2 stamped under a voice-1 whole note: the rest is BELOW the note, centred in the bar', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 2, beat: h.frac(0, 1) })
    h.engine.silentBar.stamp(2, 0, 1)
    await h.render()
    return { stave: h.staves().find(s => s.measure === 2)!, rests: h.rests(), heads: h.noteheads() }
  })
  const rests = inBar(drawn.rests, drawn.stave)
  const heads = inBar(drawn.heads, drawn.stave)
  expect(rests.map(r => r.code), 'one whole rest in the bar — voice 2’s').toEqual([WHOLE_REST])
  expect(heads, 'and voice 1’s note').toHaveLength(1)
  expect(rests[0].y, 'voice 2 goes below').toBeGreaterThan(heads[0].y)
  expect(lineOf(rests[0], drawn.stave), 'below the middle line').toBeLessThan(3)
  // Centred like every measure rest: its anchor sits left of the bar's middle by about half a glyph.
  const mid = (drawn.stave.x1 + drawn.stave.x2) / 2
  expect(Math.abs(rests[0].x - mid), 'centred in the bar').toBeLessThan(2 * spaceOf(drawn.stave))
})

test('voice 1 empty + voice 2 stamped: TWO whole rests in one column, voice 1 above, clear of each other', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: h.frac(0, 1) }) // bar 1 not empty
    await h.render()
    const control = h.rests().filter(r => { const s = h.staves().find(x => x.measure === 2)!; return r.x >= s.x1 && r.x < s.x2 })
    h.engine.silentBar.stamp(2, 0, 1)
    await h.render()
    return { stave: h.staves().find(s => s.measure === 2)!, control, rests: h.rests() }
  })
  const [alone] = drawn.control
  const rests = inBar(drawn.rests, drawn.stave).sort((a, b) => a.y - b.y)
  expect(rests.map(r => r.code), 'two whole rests').toEqual([WHOLE_REST, WHOLE_REST])
  const space = spaceOf(drawn.stave)
  expect(Math.abs(rests[0].x - rests[1].x), 'in ONE column').toBeLessThan(0.5 * space)
  expect(rests[1].y - rests[0].y, 'clear of each other by more than a space').toBeGreaterThan(space)
  // Voice 1's rest LEFT the fourth line it hangs from alone: it went up to make room.
  expect(lineOf(rests[0], drawn.stave), 'voice 1 above where it hung alone')
    .toBeGreaterThan(lineOf(alone, drawn.stave))
  expect(lineOf(rests[1], drawn.stave), 'voice 2 below the middle line').toBeLessThan(3)
})

test('his lane order: a voice-3 stamp goes ABOVE the voice-1 note, a voice-4 stamp BELOW', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addMeasure()
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'B', octave: 4, duration: 'w', measure: 2, beat: h.frac(0, 1) })
    h.engine.silentBar.stamp(1, 0, 2) // voice 3
    h.engine.silentBar.stamp(2, 0, 3) // voice 4
    await h.render()
    const at = (m: number) => h.staves().find(s => s.measure === m)!
    return { bar1: at(1), bar2: at(2), rests: h.rests(), heads: h.noteheads() }
  })
  const [v3] = inBar(drawn.rests, drawn.bar1)
  const [note1] = inBar(drawn.heads, drawn.bar1)
  const [v4] = inBar(drawn.rests, drawn.bar2)
  const [note2] = inBar(drawn.heads, drawn.bar2)
  expect(v3.code).toBe(WHOLE_REST)
  expect(v3.y, 'voice 3 above voice 1').toBeLessThan(note1.y)
  expect(v4.code).toBe(WHOLE_REST)
  expect(v4.y, 'voice 4 below voice 1').toBeGreaterThan(note2.y)
})

test('a LINE-OPENING bar (clef + meter): the stamped rest stands in the automatic one’s column', async ({ score }) => {
  const drawn = await score.evaluate(async () => {
    const h = window.__h
    await h.render()
    const alone = h.rests()[0] // bar 1, the empty bar's automatic full-bar rest, after the header
    h.engine.silentBar.stamp(1, 0, 1)
    await h.render()
    return { stave: h.staves().find(s => s.measure === 1)!, alone, rests: h.rests() }
  })
  const rests = inBar(drawn.rests, drawn.stave)
  expect(rests).toHaveLength(2)
  for (const r of rests) {
    expect(Math.abs(r.x - drawn.alone.x), 'centred in the room after the header, as the automatic rest is')
      .toBeLessThan(0.5 * spaceOf(drawn.stave))
  }
})
