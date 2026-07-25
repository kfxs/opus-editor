// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow'
import type { Modifier } from 'vexflow'
import { CenteredTremolo } from './CenteredTremolo'

/**
 * The tremolo modifier's own BOUNDING BOX — not where its strokes land.
 *
 * Stroke placement is unpinnable here (jsdom cannot measure glyphs, so every geometry assertion
 * would pass vacuously — `reference_jsdom_cannot_measure_glyphs`). The box is different: it is plain
 * arithmetic over `this.x` / `this.y`, and it broke something real.
 *
 * ⚠️ `StaveNote.getBoundingBox()` MERGES EVERY MODIFIER'S BOX (`stavenote.js`), and
 * `Element.getBoundingBox()` is built from `this.x`/`this.y`. VexFlow's own `Tremolo` calls
 * `renderText(ctx, x, y)` and never sets either — unlike `Articulation`/`Accidental`/`Dot`, which all
 * set them and render at the origin. A modifier left at the origin drags its NOTE's box out to
 * x = 0, the registry stores that, and every hit-test reading `bbox.x + bbox.width / 2` measures to a
 * point halfway across the system: Ctrl/Shift-click on a tremolo note silently did nothing.
 */
describe('CenteredTremolo bounding box', () => {
  /** Draw one quarter note carrying `modifier` at a known x, and return the note's merged box. */
  const drawNoteWithModifier = (modifier?: Modifier) => {
    const div = document.createElement('div')
    const ctx = new Renderer(div, Renderer.Backends.SVG).getContext()
    const stave = new Stave(10, 40, 400).setContext(ctx)

    const note = new StaveNote({ keys: ['b/4'], duration: 'q' })
    if (modifier) note.addModifier(modifier, 0)
    note.setStave(stave)

    const voice = new Voice({ numBeats: 1, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables([note])
    new Formatter().joinVoices([voice]).format([voice], 300)
    note.setStave(stave)

    voice.draw(ctx, stave)
    return { box: note.getBoundingBox(), noteX: note.getAbsoluteX() }
  }

  it('leaves the note box AT the note, not dragged back to x = 0', () => {
    const { box, noteX } = drawNoteWithModifier(new CenteredTremolo(3))
    expect(box.getX()).toBeGreaterThan(0)
    // Within a notehead's width of the note itself — the strokes ride its stem.
    expect(Math.abs(box.getX() - noteX)).toBeLessThan(20)
  })

  it('barely moves the note box — the same note without a tremolo starts within a pixel', () => {
    const withMark = drawNoteWithModifier(new CenteredTremolo(2))
    const bare = drawNoteWithModifier()
    // Not exactly equal, and correctly so: `b/4` takes a DOWN stem, whose x is the notehead's LEFT
    // edge — half a stem-width outside the notehead's own ink. A sub-pixel difference is the strokes
    // being where the stem is. The bug this pins produced a difference of ~26px (the box reached back
    // to x = 0), so the threshold has three orders of magnitude of daylight.
    expect(Math.abs(withMark.box.getX() - bare.box.getX())).toBeLessThan(2)
  })

  it('holds for every mark — the five stroke counts AND the Penderecki sign', () => {
    for (const mark of [1, 2, 3, 4, 5, 'penderecki'] as const) {
      const { box } = drawNoteWithModifier(new CenteredTremolo(mark))
      expect(box.getX(), `mark ${mark}`).toBeGreaterThan(0)
    }
  })

  /**
   * The ink rect the SELECTION hit-test is built on (`ElementRegistry` type `'tremolo'`, registered
   * by `VexFlowRenderer.registerTremolo`).
   *
   * What can honestly be pinned here is the part that is arithmetic rather than glyph measurement:
   * it only exists once the mark has drawn, it is anchored ON the stem, and it grows with the stack.
   * The glyph's own ink either side of the anchor is zero under jsdom, so the WIDTH is vacuous here
   * — the reason the horizontal rule (measured extents, not the advance width) is written down in
   * `inkRect` rather than asserted.
   */
  describe('ink rect', () => {
    /** Draw a note carrying `mark` and hand back the mark's rect plus the note's stem geometry. */
    const drawMark = (mark: 1 | 2 | 3 | 4 | 5 | 'penderecki') => {
      const modifier = new CenteredTremolo(mark)
      const div = document.createElement('div')
      const ctx = new Renderer(div, Renderer.Backends.SVG).getContext()
      const stave = new Stave(10, 40, 400).setContext(ctx)
      const note = new StaveNote({ keys: ['c/5'], duration: 'q' })
      note.addModifier(modifier, 0)
      note.setStave(stave)
      const voice = new Voice({ numBeats: 1, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables([note])
      new Formatter().joinVoices([voice]).format([voice], 300)
      note.setStave(stave)
      voice.draw(ctx, stave)
      return { rect: modifier.inkRect(), stem: note.getStemExtents(), stemX: note.getStemX() }
    }

    it('is null until it has drawn — every input is settled at draw time, not before', () => {
      expect(new CenteredTremolo(3).inkRect()).toBeNull()
    })

    it('sits ON the stem and inside it, lengthwise', () => {
      const { rect, stem, stemX } = drawMark(3)
      expect(rect).not.toBeNull()
      expect(Math.abs(rect!.x - stemX)).toBeLessThan(20) // straddling the stem, not a system away
      const top = Math.min(stem.topY, stem.baseY)
      const bottom = Math.max(stem.topY, stem.baseY)
      const centre = rect!.y + rect!.height / 2
      expect(centre).toBeGreaterThan(top)
      expect(centre).toBeLessThan(bottom)
    })

    it('covers the whole STACK, so more strokes claim more stem', () => {
      const two = drawMark(2)!.rect!.height
      const five = drawMark(5)!.rect!.height
      expect(five).toBeGreaterThan(two)
    })
  })

  it('draws E22B for the Penderecki mark, and E220 for a stroke count', () => {
    // Written-out codepoints, because VexFlow's `Glyphs` map is not re-exported and resolves to
    // `undefined` in the browser — silently. Pinning them here is what makes owning them safe.
    expect(new CenteredTremolo('penderecki').text).toBe('\uE22B')
    expect(new CenteredTremolo(3).text).toBe('\uE220')
  })
})
