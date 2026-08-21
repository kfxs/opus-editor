/**
 * {@link noteInkBox} — **the ink a note owns**, with the marks another lane will re-place left out.
 *
 * ⭐ The subject is structural, so this is a unit test and not a browser one: no glyph is measured
 * here (`reference_jsdom_cannot_measure_glyphs`). The claims are which modifiers are counted, that
 * VexFlow's own array comes back exactly as it was, and that a note it cannot answer for is not an
 * obstacle. What the fix LOOKS like is `e2e/slur.e2e.ts`'s, where the numbers are real.
 */
import { describe, it, expect } from 'vitest'
import { noteInkBox, type BoxedNote } from './noteInkBox'

/** A modifier of one category, standing for its own box — only the category is read here. */
const mod = (category: string) => ({ getCategory: () => category })

/** A note whose box depends on which modifiers are in its array — VexFlow's `getBoundingBox()` in
 *  miniature: it unions every one of them, which is the whole reason this module exists. */
function note(modifiers: { getCategory(): string }[], boxes: Record<string, number>): BoxedNote {
  const arr = [...modifiers]
  return {
    getModifiers: () => arr,
    getBoundingBox: () => ({
      x: 0,
      y: 0,
      w: 10,
      // The head alone is 10 tall; each modifier still in the array adds its own depth.
      h: 10 + arr.reduce((sum, m) => sum + (boxes[m.getCategory()] ?? 0), 0),
    }),
  }
}

describe('noteInkBox', () => {
  it('⭐⭐ leaves the DYNAMICS-LINE annotation out — a mark that will be moved is not the note', () => {
    // His report, 2026-08-21: a dynamic under a covered note changed the slur's arch, because a
    // dynamic is attached as an `Annotation` and VexFlow unions every modifier into the note's box.
    const n = note([mod('Annotation')], { Annotation: 40 })
    expect(noteInkBox(n)?.height).toBe(10)
  })

  it('⭐ …and keeps the ones that really ride with the note', () => {
    // An accidental, a dot and an articulation are drawn where they are drawn and stay there, so a
    // curve bowing over the note genuinely has to clear them.
    const n = note([mod('Accidental'), mod('Dot'), mod('Articulation')], {
      Accidental: 3, Dot: 1, Articulation: 4,
    })
    expect(noteInkBox(n)?.height).toBe(18)
  })

  it('🚨 puts VexFlow’s OWN array back, in its own order', () => {
    // ⚠️ The array is live and VexFlow draws it in order, so restoring the two halves separately
    // would be a silent picture change rather than an error.
    const before = [mod('Accidental'), mod('Annotation'), mod('Dot')]
    const n = note(before, { Annotation: 40 })
    noteInkBox(n)
    expect(n.getModifiers!()).toEqual(before)
  })

  it('⛔ …even when the box throws — the restore is in a `finally`', () => {
    const arr = [mod('Annotation')]
    const n: BoxedNote = {
      getModifiers: () => arr,
      getBoundingBox: () => { throw new Error('VexFlow cannot answer for this note') },
    }
    expect(noteInkBox(n)).toBeNull()
    expect(arr).toHaveLength(1)
  })

  it('⛔ null for a note with no box, a degenerate one, and one that never drew', () => {
    expect(noteInkBox({ getBoundingBox: () => undefined })).toBeNull()
    expect(noteInkBox({ getBoundingBox: () => ({ x: 0, y: 0, w: 0, h: 8 }) })).toBeNull()
    expect(noteInkBox({ getBoundingBox: () => ({ x: NaN, y: 0, w: 4, h: 8 }) })).toBeNull()
    expect(noteInkBox({})).toBeNull()
  })

  it('a note with no modifiers is VexFlow’s box unchanged', () => {
    expect(noteInkBox(note([], {}))).toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })
})
