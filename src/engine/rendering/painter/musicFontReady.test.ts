import { describe, it, expect } from 'vitest'
import { musicFontReady } from './musicFontReady'

/**
 * ⚠️ There is nothing here about GLYPH WIDTHS, and there cannot be: jsdom measures every glyph 0×0
 * (`reference_jsdom_cannot_measure_glyphs`), so the thing this gate protects is invisible to a unit
 * test. What IS testable is the gate's own contract — that it waits for the right signal, waits
 * only once, and never hangs where the API is missing. The geometry it buys is asserted in the
 * browser (`e2e/notes.e2e.ts`, "a whole-bar rest is centred in its bar").
 */
describe('musicFontReady', () => {
  /**
   * ⚠️ THE REGRESSION this file caught on its first run: the engine's unit tests run in the **node**
   * environment, where `document` is an UNDECLARED identifier — so `document?.fonts` is a
   * `ReferenceError`, not `undefined`, and the gate took every engine test down with it. A caller
   * with no DOM must be waved straight through.
   */
  it('resolves where there is no font loading API at all', async () => {
    await expect(musicFontReady()).resolves.toBeUndefined()
  })

  /**
   * THE REGRESSION, stated as far as jsdom can state it: the app's boot render must be able to
   * wait, i.e. the gate hands back a promise rather than something already-settled by accident.
   */
  it('hands back a promise', () => {
    expect(musicFontReady()).toBeInstanceOf(Promise)
  })

  /**
   * Memoized on the FIRST settle. `document.fonts.ready` is replaced by a fresh pending promise
   * every time a new font load starts, so re-reading it would make a later caller wait on some
   * unrelated UI face — and, worse, make the answer depend on when you asked.
   */
  it('waits once and reuses that answer', async () => {
    const first = musicFontReady()
    expect(musicFontReady()).toBe(first)
    await first
    expect(musicFontReady()).toBe(first)
  })
})
