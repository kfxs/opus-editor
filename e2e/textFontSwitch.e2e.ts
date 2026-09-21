import { test, expect } from './fixtures'

/**
 * 🚧 **THE TEXT-FONT SWITCH** — `docs/plans/text-font-switch-plan.md`. ⛔ Not a judgement of how Edwin
 * LOOKS (his eye, in the dev shell) — the plumbing: the italic FILE really arrives and expression words
 * are really set in it, the bar is re-engraved rather than replayed, the music glyphs of the same mark
 * stay in the MUSIC face, and switching back restores Academico's picture exactly.
 */
test('⭐ expression words go to the chosen face’s real italic, and back', async ({ score }) => {
  const result = await score.evaluate(async () => {
    const h = window.__h
    h.engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: h.frac(0, 1) })
    h.engine.dynamic.addDynamic(1, { beat: h.frac(0, 1), text: String.fromCharCode(0xe520) + ' dolce' })
    await h.render()

    const snapshot = () => [...document.querySelectorAll('tspan')].map(t => ({
      text: t.textContent, family: getComputedStyle(t).fontFamily, style: getComputedStyle(t).fontStyle,
      x: Math.round(t.getBoundingClientRect().x * 100) / 100,
    }))
    const before = snapshot()
    await h.setTextFont('edwin')
    await h.render()
    const edwin = { runs: snapshot(), italicLoaded: document.fonts.check('italic 16px Edwin', 'dolce') }
    await h.setTextFont('academico')
    await h.render()
    return { before, edwin, after: snapshot() }
  })

  const words = (runs: typeof result.before) => runs.find(run => run.text?.includes('dolce'))!
  const glyph = (runs: typeof result.before) => runs.find(run => !run.text?.includes('dolce'))!
  expect(words(result.before).family).toMatch(/^Georgia/)
  expect(result.edwin.italicLoaded, 'Edwin’s italic file arrived before the render').toBe(true)
  expect(words(result.edwin.runs).family, 're-engraved in the face’s italic').toMatch(/^Edwin/)
  expect(words(result.edwin.runs).style).toBe('italic')
  expect(glyph(result.edwin.runs).family, 'the dynamic’s letters stay the MUSIC face’s').toMatch(/^Bravura/)
  expect(result.after).toEqual(result.before)
})
