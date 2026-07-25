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

  it('holds at every stroke count', () => {
    for (const num of [1, 2, 3, 4, 5]) {
      const { box } = drawNoteWithModifier(new CenteredTremolo(num))
      expect(box.getX(), `${num} strokes`).toBeGreaterThan(0)
    }
  })
})
