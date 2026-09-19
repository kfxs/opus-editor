/**
 * ⭐⭐ **WHERE A FLAG'S PLACEMENT NUMBER COMES FROM** — `docs/note-engraving-plan.md` §3.3, the
 * question P3b opened and deliberately did not answer.
 *
 * P3b took the flag's ink (`engine/engrave/notes/flag.ts`) and made its one font-dependent input a
 * NAMED ARGUMENT — `flagPlacement`'s `glyphReach` — instead of a `getTextMetrics()` call buried in a
 * draw method. What it did **not** do is change where that number comes from, because there are two
 * candidates and only a browser can tell them apart:
 *
 * | | what it is | measured how |
 * |---|---|---|
 * | **what we use** | `actualBoundingBoxAscent` / `…Descent` of the flag glyph | a **runtime `measureText`** on a canvas — 🚨 §3's bug class, and **0 in jsdom** |
 * | **what `fonts/` has** | `glyphBox(flagGlyph(…)).up` / `.down` | Bravura's own metrics, generated from the OTF we ship — a pure table |
 *
 * ## ⭐⭐ THE ANSWER (measured 2026-09-01): they agree, to the limit of what the canvas can say
 *
 * | | canvas | Bravura | Δ |
 * |---|---|---|---|
 * | up-stem, `flag8thUp` U+E240 | 1 px | 0.36 px | 0.64 px |
 * | down-stem, `flag8thDown` U+E241 | 1 px | 0.56 px | 0.44 px |
 *
 * 🚨 **Chromium reports `actualBoundingBox*` as whole device pixels** — every probe came back an
 * integer — so the canvas *cannot* say 0.36. Both its answers are the font's own number rounded up
 * to the next pixel, and the flag's anchor is a fraction of a pixel either way.
 * ⚠️ **"Rounded up" was a fact about VexFlow's embedded Bravura** (2026-09-14): with the `.otf` we
 * ship the canvas answers **0 px and 1 px** — the font's number rounded to the NEAREST pixel — and a
 * page with only VexFlow's faces left still answers 1 and 1. The agreement within a pixel holds either way. ⭐ So the placement
 * **can** stop depending on a runtime measurement: the table is not merely as good, it is finer.
 * ⛔ Not swapped here — it moves ink by ~0.6 px and moving ink is his call.
 *
 * ## ⚠️ Two wrong answers this spec gave before it gave the right one, both worth keeping
 *
 * 1. **It first inferred the reach from the DRAWN PICTURE** — the gap between the stem's drawn tip
 *    and the flag's baseline — and got a suspiciously round **−0.2 sp both ways up**. That is not
 *    the reach: `Stem.draw` ends its line at `stemY − height − renderHeightAdjustment × direction`,
 *    and `adjustHeightForFlag` writes that adjustment **from the flag's own height**, so the drawn
 *    tip and the tip the flag is placed against are ⛔ not the same y. The sources have to be asked
 *    directly.
 * 2. 🚨🚨 **It then measured the glyph in the WRONG FACE, and got a confident 0.66 sp
 *    disagreement.** It read `font-family` off the `<text>`, which has none — VexFlow's SVG context
 *    puts the font on the **GROUP** and the text inherits it (`reference: a glyph's font lives on
 *    its group`). `canvas.font = '30pt '` is invalid, so the canvas kept its default 10px
 *    sans-serif and measured the **tofu box** of a glyph that face does not have. ⭐⭐ That is §3's
 *    own bug — *beating the font bakes in a FALLBACK* — reproduced by accident inside the spec
 *    investigating it, which is why `bravuraLoaded` is now asserted rather than assumed.
 *
 * ⚠️ And it is also why `note-engraving-plan.md` §3.3's first draft was wrong to name
 * `flagDropFromTip` as the font's answer: that one takes the OPPOSITE side of the glyph
 * (`box.down` for an up-stem) because it answers *"how far does the flag hang back from the tip"*,
 * an ink EXTENT for `layout/measureColumns` to reserve room with. The placement needs the reach on
 * the side that MEETS the tip. ⛔ A plausible one-line change, and a wrong one.
 */
import { test, expect } from './fixtures'
import { glyphBox, flagGlyph } from '../src/engine/fonts/fontMetrics'

/**
 * One lone eighth, drawn — with its flag glyph measured in **the very face the page drew it in**.
 *
 * 🚨 `getComputedStyle`, ⛔ never the element's own attributes: the font lives on the group and the
 * `<text>` inherits it, so the attribute is empty and a font string built from it is invalid — which
 * leaves the canvas measuring its default face in silence. See the header.
 */
async function flagMetrics(score: Parameters<Parameters<typeof test>[1]>[0]['score'], step: string, octave: number) {
  return score.evaluate(async ({ step, octave }) => {
    const h = window.__h
    for (const slot of [...h.engine.getScore().measures[0].slots]) {
      for (const note of (slot as { notes?: { id: string }[] }).notes ?? []) h.engine.deleteNote(note.id)
    }
    // ⚠️ `beam: 'single'` — a lone eighth has nothing to beam with anyway, but saying so keeps the
    // fixture honest if the bar ever gains a second note.
    h.engine.addNoteAtBeat({
      step, octave, duration: '8', measure: 1, beat: h.frac(0, 1), beam: 'single' as const,
    })
    await h.render()

    const text = document.querySelector('g.flag text')
    if (!text) return null
    const style = getComputedStyle(text)
    const font = `${style.fontSize} ${style.fontFamily}`
    const canvas = document.createElement('canvas').getContext('2d')
    if (!canvas) return null
    canvas.font = font
    const measured = canvas.measureText(text.textContent ?? '')
    const stave = h.staves()[0]
    return {
      glyph: (text.textContent ?? '').codePointAt(0)?.toString(16) ?? '',
      font,
      /** ⭐ The guard the header exists for: was the music font actually available to measure? */
      bravuraLoaded: document.fonts.check(font),
      ascent: measured.actualBoundingBoxAscent,
      descent: measured.actualBoundingBoxDescent,
      /** The drawn staff space, so a px answer can be stated in staff spaces too. */
      space: (stave.bottom - stave.top) / 4,
    }
  }, { step, octave })
}

test('⭐⭐ §3.3 — Bravura’s own table and the canvas agree about the flag’s reach', async ({ score }) => {
  // C4 in treble is below the middle line ⇒ stem UP, flag hanging DOWN from the tip. A5 is above it
  // ⇒ stem DOWN, flag rising from the tip. The two use opposite sides of their own glyph.
  const up = await flagMetrics(score, 'C', 4)
  const down = await flagMetrics(score, 'A', 5)
  expect(up, 'an eighth wears a flag, and it is a `<text>` in a `flag` group').not.toBeNull()
  expect(down).not.toBeNull()

  // 🚨 Without this the whole spec is measuring a fallback face and agreeing with itself — which is
  // exactly what it did on its second run. See the header.
  expect(up!.bravuraLoaded, `the music font is loaded and measurable: ${up!.font}`).toBe(true)
  expect(up!.glyph, 'flag8thUp').toBe('e240')
  expect(down!.glyph, 'flag8thDown').toBe('e241')

  // The side of each glyph that MEETS the tip: an up-stem's flag is anchored at its top, so the
  // reach is what its ink rises ABOVE the baseline; a down-stem's is what it drops below.
  const canvasUp = up!.ascent
  const canvasDown = down!.descent
  const fontUp = glyphBox(flagGlyph('8', true)!).up * up!.space
  const fontDown = glyphBox(flagGlyph('8', false)!).down * down!.space

  console.log(
    `[flag §3.3] ${up!.font}\n` +
    `[flag §3.3] up-stem   U+${up!.glyph}   canvas ${canvasUp.toFixed(2)} px · ` +
    `Bravura ${fontUp.toFixed(2)} px · Δ ${(canvasUp - fontUp).toFixed(2)}\n` +
    `[flag §3.3] down-stem U+${down!.glyph}   canvas ${canvasDown.toFixed(2)} px · ` +
    `Bravura ${fontDown.toFixed(2)} px · Δ ${(canvasDown - fontDown).toFixed(2)}`)

  // ⭐⭐ THE ANSWER. Chromium reports these metrics as whole device pixels — the probes come back
  // integers — so the canvas cannot resolve a third of a pixel and the font can. Agreement therefore
  // means "within one device pixel", and it is the canvas that is the coarse instrument here.
  // ⚠️ `+ 0` because a zero ascent comes back as −0, which is a whole pixel but not `Object.is` 0.
  const px = (v: number) => v + 0
  expect(Number.isInteger(px(canvasUp)), 'the canvas answers in whole pixels — the reason for the tolerance').toBe(true)
  expect(Number.isInteger(px(canvasDown))).toBe(true)
  expect(Math.abs(canvasUp - fontUp), 'up-stem: one glyph, two rulers, under a pixel apart').toBeLessThan(1)
  expect(Math.abs(canvasDown - fontDown), 'down-stem: the same, on the other side').toBeLessThan(1)

  // ⭐ …and the canvas's answer is the font's rounded to the NEAREST whole pixel (0.36 → 0, 0.56 → 1).
  // ⚠️ Measured 2026-09-14 with the faces we ship. VexFlow's embedded Bravura rounded BOTH up (1, 1),
  // which is what this test pinned until S1 of docs/vexflow-removal-map.md — a fact about that font
  // build, not about the canvas: the same page with only VexFlow's faces left still answers 1 and 1.
  expect(px(canvasUp), 'the coarse ruler rounds the fine one to the nearest pixel').toBe(Math.round(fontUp))
  expect(px(canvasDown)).toBe(Math.round(fontDown))
})
