import { test, expect } from './fixtures'

/**
 * ⭐⭐ **A CHORD CONTAINING A SECOND** — the head VexFlow displaces to the other side of the stem,
 * and whether its HIT BOX went with it.
 *
 * 🚨 **His report, 2026-09-14, with a picture**: a chord C♯4+E4+G4+A♭4+C♯5 (the A♭4 a second above
 * the G4). *"i'm clicking on A that is a second and to the right of the stem but is not selecting
 * it… it selects the whole measure instead"*. The registry filed ONE head centre — the note's
 * UNDISPLACED column — against every pitch of the chord, so the displaced head's box sat a
 * notehead-width from its own ink and `hitsNoteOrRestBody` said no.
 *
 * ⚠️ **Here and not in jsdom, and that is the point**: the displacement is `notehead width − stem
 * adjustment`, and a glyph's WIDTH needs a font. In jsdom every head measures 0 wide, so the
 * displacement collapses to a fraction of a pixel and the bug is invisible.
 */

/** The chord he built, in bar 1: C♯4 E4 G4 A♭4 C♯5 — the A♭4 a SECOND above the G4. */
async function hisChord(score: import('@playwright/test').Page) {
  return score.evaluate(async () => {
    const h = window.__h
    const beat = h.frac(0, 1)
    const add = (step: string, octave: number, alter: number) =>
      h.engine.addChordNote({ step, octave, alter, duration: 'q', measure: 1, beat } as never)

    h.engine.addNoteAtBeat({ step: 'C', octave: 4, alter: 1, duration: 'q', measure: 1, beat } as never)
    add('E', 4, 0)
    add('G', 4, 0)
    add('A', 4, -1)
    add('C', 5, 1)
    await h.render()

    // Each pitch's registered hit-box x, lowest pitch first.
    const headX = h.engine.getElementRegistry().getByType('note')
      .filter(el => el.measure === 1)
      .sort((a, b) => (a.pitch ?? 0) - (b.pitch ?? 0))
      .map(el => el.headX!)

    // The drawn heads' own anchors. ⚠️ `noteheads()` filters by SMuFL range, so the accidentals
    // and the augmentation dots are not in this list.
    const drawn = h.noteheads().map(g => g.x).sort((a, b) => a - b)
    const stave = h.staves()[0]
    return { headX, drawn, staffSpace: (stave.bottom - stave.top) / 4 }
  })
}

test('⭐⭐ every head of a chord gets its OWN hit-box x — the displaced second included', async ({ score }) => {
  const { headX, drawn, staffSpace } = await hisChord(score)
  expect(headX, 'five pitches registered').toHaveLength(5)
  expect(drawn, 'five heads drawn').toHaveLength(5)

  // ⭐ THE ASSERTION: pair each registered x with a drawn head, and the offsets must all AGREE —
  // a hit box stands the same half-notehead from its own glyph's anchor whichever column it is in.
  // ⛔ Before the fix four of the five shared one x, so these offsets differed by a whole notehead.
  const offsets = [...headX].sort((a, b) => a - b).map((x, i) => x - drawn[i])
  const spread = Math.max(...offsets) - Math.min(...offsets)
  expect(spread, 'every hit box sits on its own head, by the same offset').toBeLessThan(staffSpace * 0.25)
})

test('🚨 …and the SECOND really is displaced — otherwise the test above proves nothing', async ({ score }) => {
  const { headX, staffSpace } = await hisChord(score)
  const columns = Math.max(...headX) - Math.min(...headX)
  // ⭐ The break-test: a chord with no second draws ONE column, and then the assertion above would
  // hold vacuously. A displaced head stands about a notehead's width away — a little over a space.
  expect(columns, 'two columns, a notehead apart').toBeGreaterThan(staffSpace * 0.8)
})
