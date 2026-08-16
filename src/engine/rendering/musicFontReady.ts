/**
 * ⭐⭐ **The music font must be LOADED before the first glyph is MEASURED.**
 *
 * Every music glyph is an SVG `<text>` in Bravura, and VexFlow does not carry a metrics table for
 * it: `Element.measureText()` asks a canvas 2D context for `measureText(glyph)` and engraves to
 * whatever comes back (`vexflow/src/element.ts`). VexFlow ships Bravura as a base64 woff2 and calls
 * `FontFace.load()` on import — so the face arrives **asynchronously**, and a render that beats it
 * measures the FALLBACK font and bakes those numbers into the picture.
 *
 * The ink then repairs itself and the geometry does not: once the face lands the browser repaints
 * every `<text>` in Bravura, so the glyphs LOOK right while sitting at coordinates computed from
 * somebody else's metrics.
 *
 * ## Measured, in Chromium (2026-08-16)
 *
 * The whole-rest glyph U+E4E3 at Bravura's own size:
 *
 * | | width |
 * |---|---|
 * | before the face loads (fallback `.notdef` box) | **30.3 px** |
 * | after `document.fonts.ready` | **11.0 px** |
 *
 * `VexFlowRenderer.centerMeasureRests` centres a whole-bar rest on `getAbsoluteX() +
 * getGlyphWidth() / 2`, so a first render that loses the race puts every empty bar's rest
 * `(11 − 30.3) / 2` ≈ **9.7 px LEFT of its bar's centre** — his report, and the reason it showed
 * "once in a while, particularly on first open": whether an early resize/scroll re-render happened
 * to land after the font decided it.
 *
 * ⚠️ **A second render does not fix it**, which is why this is a gate and not a repair. The renderer
 * reuses a measure group whose `MeasureRedrawKey` is unchanged (it moves it by transform instead of
 * re-engraving it), and the font is not in that key — nor could it be. Re-rendering after the font
 * lands therefore replays the wrong geometry.
 *
 * ⛔ **`document.fonts.check()` is not the test.** It answered `true` in both rows of the table
 * above — it reports that a matching face is *registered*, not that it is *loaded*.
 *
 * ## ⛔ The gate does NOT go on the app's boot render, and that was the first wrong answer
 *
 * `App.ts` calls `renderer.renderScore()` at the end of `createEditorApp`, so that looks like the
 * editor's first render. It is not. Traced: the first one comes from `ViewportHost`'s
 * MutationObserver noticing the SVG appear — `bindSvg → readNaturalSize → applyZoom →
 * applyScrollToElement → notify → onViewChange → renderScore` — at **t=312ms**, against the font's
 * **t=410ms**. Gating the boot call left that one untouched and the rests still off.
 *
 * So the app's gate sits on `RenderController.renderScore`, the ONE funnel every render in the
 * editor passes through. Along with the PDF/SVG export (`engine/export/scoreSvg.ts`) and the
 * browser geometry harness (`e2e/harness.ts`), that is every path that engraves. Two of the three
 * had written this requirement out separately; the one that had not was the app.
 */

/**
 * Memoized: `document.fonts.ready` is replaced by a fresh pending promise whenever a NEW load
 * starts, so a later web font (a UI face, say) would make a caller wait again for something that
 * has nothing to do with the score. The first settle is the one that matters — after it, Bravura is
 * there for the life of the document.
 */
let firstSettle: Promise<void> | undefined

/**
 * Resolves once the music font is loaded and its glyphs measure their real widths.
 *
 * Resolves immediately where there is no font loading API at all — jsdom, where a glyph measures
 * 0×0 whatever we do (`reference_jsdom_cannot_measure_glyphs`) and no unit test may assert a
 * coordinate anyway.
 *
 * ⚠️ `typeof document`, not `document?.` — the engine's own unit tests run in the **node**
 * environment, where `document` is not a defined-but-empty global but an undeclared identifier, and
 * touching it is a `ReferenceError` rather than `undefined`.
 */
export function musicFontReady(): Promise<void> {
  firstSettle ??= typeof document === 'undefined'
    ? Promise.resolve()
    : Promise.resolve(document.fonts?.ready).then(() => undefined)
  return firstSettle
}
