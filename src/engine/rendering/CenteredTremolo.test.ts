// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Renderer } from 'vexflow'
import { EngravedNote, drawNoteInkThrough } from './EngravedNote'
import { EngravedStave } from './EngravedStave'
import { formatLoneNote } from './loneNote'
import { CenteredTremolo } from './CenteredTremolo'
import { attachModifier } from './EngravedModifier'

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
/** Format and draw one note, alone in a bar of 1/4, by the score's own pipeline. */
function drawLoneNote(note: EngravedNote): void {
  const div = document.createElement('div')
  const ctx = new Renderer(div, Renderer.Backends.SVG).getContext()
  const stave = new EngravedStave(10, 40, 400)
  formatLoneNote(note, stave, { numerator: 1, denominator: 4 }, 300)
  drawNoteInkThrough([note], ctx)
  note.setContext(ctx).draw()
}

describe('CenteredTremolo bounding box', () => {
  /** Draw one quarter note carrying `modifier` at a known x, and return the note's merged box. */
  const drawNoteWithModifier = (modifier?: CenteredTremolo) => {
    const note = new EngravedNote({ keys: ['b/4'], duration: 'q' })
    if (modifier) attachModifier(note, modifier, 0)
    drawLoneNote(note)
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
      const note = new EngravedNote({ keys: ['c/5'], duration: 'q' })
      attachModifier(note, modifier, 0)
      drawLoneNote(note)
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
    expect(new CenteredTremolo('penderecki').getGlyph()).toBe('\uE22B')
    expect(new CenteredTremolo(3).getGlyph()).toBe('\uE220')
  })
})

/**
 * ⭐ S8b — the mark is a plain `Modifier` now, so the two things it used to inherit from VexFlow's
 * `Tremolo` are its own and are pinned here.
 *
 * ⚠️ The agreement with what `Tremolo` built was proved by a throwaway probe (every field of the base
 * state — text, position, category, width, textLine, font, style — identical for 1–5 strokes). ⛔ A
 * spec of ours does not import `Tremolo` to re-prove it: the census holds the specs' uses at a
 * ceiling, and the point of the step is that the class is gone.
 */
describe('CenteredTremolo is its own modifier', () => {
  const textOf = (m: CenteredTremolo) => m.getGlyph()

  it('draws strokes with SMuFL tremolo1, the codepoint VexFlow used', () => {
    expect(textOf(new CenteredTremolo(3)).codePointAt(0)).toBe(0xe220)
    expect(textOf(new CenteredTremolo(3))).toHaveLength(1)
  })

  it('draws the Penderecki sign with its own codepoint — ⛔ not the buzz roll (E22A) or E22C', () => {
    expect(textOf(new CenteredTremolo('penderecki')).codePointAt(0)).toBe(0xe22b)
  })

  it('⚠️ keeps the category string "Tremolo" — `noteInkBox` filters the dynamics lane by it', () => {
    // ⚠️ The STATIC is ours; `Element.getCategory()` just reads it off the constructor.
    expect(CenteredTremolo.CATEGORY).toBe('Tremolo')
    expect(new CenteredTremolo(3).getCategory()).toBe('Tremolo')
  })

  it('sits CENTER on the note, so it can ride the stem', () => {
    expect((new CenteredTremolo(2) as unknown as { position: number }).position).toBe(0)
  })
})
