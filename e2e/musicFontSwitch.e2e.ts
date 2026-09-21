import { test, expect } from './fixtures'

/**
 * 🚧 **THE MUSIC-FONT SWITCH** — Phase A of `docs/plans/music-font-switch-plan.md`.
 *
 * ⛔ Not a judgement of how Leipzig LOOKS — that is his eye, in the dev shell. What is held here is the
 * plumbing a switch stands on, each half of which fails SILENTLY without it:
 *  - the face really arrives and the noteheads are really set in it (not in the Bravura fallback);
 *  - the switch re-engraves (a font missing from the width key replays every bar's old `<g>`);
 *  - switching BACK restores Bravura's geometry exactly — nothing of the other face is left in a cache.
 */
test('⭐ a switch re-engraves in the chosen face, and switching back restores Bravura exactly', async ({ score }) => {
  const result = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.addNoteAtBeat({ step: 'E', alter: 1, octave: 4, duration: '8', measure: 1, beat: h.frac(1, 1) })
    await h.render()

    const snapshot = () => ({
      family: getComputedStyle(document.querySelector('g.notehead text')!).fontFamily,
      heads: h.noteheads().map(g => [g.x, g.y]),
    })
    const ctx = document.createElement('canvas').getContext('2d')!
    const headWidth = (family: string) => { ctx.font = `120px ${family}`; return ctx.measureText('').width }

    const before = snapshot()
    await h.setMusicFont('leipzig')
    await h.render()
    const leipzig = { ...snapshot(), loaded: document.fonts.check('30pt Leipzig', ''), width: headWidth('Leipzig') }
    await h.setMusicFont('bravura')
    await h.render()
    return { before, leipzig, after: snapshot(), bravuraWidth: headWidth('Bravura') }
  })

  expect(result.before.family).toMatch(/^Bravura/)
  expect(result.leipzig.loaded, 'the face arrived before the render').toBe(true)
  expect(result.leipzig.family, 'the noteheads were re-engraved, not replayed').toMatch(/^Leipzig, ?Bravura/)
  expect(Math.abs(result.leipzig.width - result.bravuraWidth), '⛔ Leipzig is not silently Bravura').toBeGreaterThan(0.5)
  expect(result.after).toEqual(result.before)
})
