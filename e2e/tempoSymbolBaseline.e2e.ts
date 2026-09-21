import { test, expect } from './fixtures'

/**
 * ⭐ **THE TEMPO'S NOTE STANDS ON ITS WORDS' BASELINE** — his rule, 2026-09-21
 * (`rendering/marks/tempo/tempoStyle.tempoSymbolRaisePx`). A music face cuts `metNote…` with the head
 * CENTRED on the baseline, so beside words it hung below the line; Sebastian's cut already stood on it.
 *
 * Measured the only honest way — the glyph's real ink, by canvas `measureText` in the face it was
 * drawn in (an SVG `<text>`'s box is the line box, not the ink): the note's ink BOTTOM must land on
 * the `y` the words are written at, in every music face.
 */
for (const face of ['bravura', 'leipzig', 'sebastian'] as const) {
  test(`the ♩ of a tempo mark stands on the words' baseline — ${face}`, async ({ score }) => {
    const out = await score.evaluate(async (id) => {
      const h = window.__h
      await h.setMusicFont(id)
      h.engine.tempo.addTempoMark(1, { beat: h.frac(0, 1), text: 'Allegro ♩ = 120' })
      await h.render()
      const texts = [...document.querySelectorAll('svg text')] as SVGTextElement[]
      const note = texts.find(t => (t.textContent ?? '').codePointAt(0) === 0xeca5)
      const words = texts.find(t => (t.textContent ?? '').includes('Allegro'))
      if (!note || !words) return null
      const style = getComputedStyle(note)
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `${style.fontSize} ${style.fontFamily}`
      const ink = ctx.measureText(note.textContent ?? '')
      const y = (t: SVGTextElement) => parseFloat(t.getAttribute('y') ?? 'NaN')
      return { family: style.fontFamily, inkBottom: y(note) + ink.actualBoundingBoxDescent, baseline: y(words) }
    }, face)

    expect(out, 'the mark drew a note and its words').not.toBeNull()
    // ⚠️ 0.6 px: Chrome reports ink in whole device pixels, and Sebastian's head sits a hair above.
    expect(Math.abs(out!.inkBottom - out!.baseline), `${out!.family}: note ink bottom vs words' baseline`).toBeLessThan(0.6)
  })
}
