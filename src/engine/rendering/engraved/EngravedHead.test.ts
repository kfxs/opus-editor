// @vitest-environment jsdom
/**
 * A notehead of ours (S12j-a). ⚠️ That the heads draw, displace and box exactly as before was proved on
 * the page: 40 broad random scores (3,310 notes, 659 chords with seconds, fan member chords, a second
 * voice resting) byte-identical against the previous commit, and in Chromium a two-staff page with its
 * note ghosts and a fan page identical (`docs/history/vexflow-removal-map.md` S12j-a). Pinned here is its contract.
 */
import { describe, it, expect } from 'vitest'
import { EngravedHead } from './EngravedHead'
import { EngravedNote } from './EngravedNote'
import { EngravedStave } from './EngravedStave'
import { standOn } from '../staff/staveFrame'
import { noteRuler } from './noteRuler'

const head = (over: Partial<ConstructorParameters<typeof EngravedHead>[0]> = {}) =>
  new EngravedHead({ line: 3, glyph: '', ...over })

describe('EngravedHead', () => {
  it('holds its line, its glyph and its own id', () => {
    const h = head({ line: 4.5 })
    expect(h.getLine()).toBe(4.5)
    expect(h.getText()).toBe('')
    expect(h.getAttribute('id')).toMatch(/^notehead\d+$/)
  })

  it('⭐ stands where its stave puts its line — `NoteHead.setStave`', () => {
    const h = head({ line: 5 }).setStave(new EngravedStave(10, 40, 300))
    expect(h.getY()).toBe(80) // F5, the top line
  })

  it('⭐ a DISPLACED head crosses the stem by its width less half a stem, on the stem\'s side', () => {
    // jsdom measures the glyph 0 wide, so the crossing is the half-stem alone.
    expect(head({ x: 100 }).getAbsoluteX()).toBe(100)
    expect(head({ x: 100, displaced: true, stemDirection: 1 }).getAbsoluteX()).toBe(100 - 0.75)
    expect(head({ x: 100, displaced: true, stemDirection: -1 }).getAbsoluteX()).toBe(100 + 0.75)
  })

  it('⭐ every note builds heads of OURS, in its own key order, standing where its stave says', () => {
    const note = standOn(new EngravedNote({ keys: ['e/5', 'c/5'], duration: 'q' }), new EngravedStave(10, 40, 300))
    const heads = (note as unknown as { _noteHeads: unknown[] })._noteHeads
    expect(heads.every(h => h instanceof EngravedHead)).toBe(true)
    expect(noteRuler(note).headYs).toEqual([85, 95])
  })
})
