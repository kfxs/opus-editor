/**
 * A stem of ours (S12i): the contract VexFlow's note still drives, and what our beam and fan call. ⚠️ That
 * it draws exactly as before was proved on the page: 40 broad random scores byte-identical, and in
 * Chromium a two-staff page, its note ghosts and the highlight's stem groups identical
 * (`docs/vexflow-removal-map.md` S12i). Its LENGTH is `engrave/notes/stemLength`'s, pinned there.
 */
import { describe, it, expect } from 'vitest'
import { EngravedNote, EngravedStem, stemOf } from './EngravedNote'

describe('EngravedStem', () => {
  it('files as "Stem" and draws ids from its own counter', () => {
    const stem = new EngravedStem()
    expect(stem.getCategory()).toBe('Stem')
    expect(stem.getAttribute('id')).toMatch(/^stem\d+$/)
  })

  it('carries VexFlow\'s `Stem` style — which the page was measured to ignore, and is kept anyway', () => {
    expect(new EngravedStem().getStyle()).toEqual({ strokeStyle: 'black' })
  })

  it('⭐ holds the extension the beam writes and reads back', () => {
    const stem = new EngravedStem()
    stem.setExtension(7)
    expect(stem.getExtension()).toBe(7)
  })

  it('⭐ its tip is the head\'s y plus 3½ spaces and the extension, on its side', () => {
    const stem = new EngravedStem()
    stem.setDirection(1)
    stem.setYBounds(100, 100)
    expect(stem.getExtents()).toEqual({ topY: 65, baseY: 100 })
    stem.setExtension(5)
    expect(stem.getExtents().topY).toBe(60)
  })

  it('⭐ every note builds one of OURS, and `stemOf` hands it back — a rest\'s is hidden', () => {
    const note = new EngravedNote({ keys: ['c/5'], duration: 'q' })
    expect(stemOf(note)).toBeInstanceOf(EngravedStem)
  })

  it('⛔ `stemOf` refuses a stem that is not ours, and answers none for a note without one', () => {
    expect(stemOf({ getStem: () => undefined })).toBeUndefined()
    expect(() => stemOf({ getStem: () => ({}) })).toThrow()
  })
})
