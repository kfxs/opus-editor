// @vitest-environment jsdom
/**
 * `dodgeDestinationAccidentals` — his bar (the Gymnopédie, 72): a treble C♮5 and, in the same
 * column, a bass-staff chord whose C♮4 + F♮4 are written on the treble.
 *
 * ⚠️ jsdom measures every glyph 0 wide, so each sign's width is stubbed; what is asserted is the
 * COLUMN each sign ends in (its x shift), never a drawn position.
 */
import { describe, it, expect, vi } from 'vitest'
import { dodgeDestinationAccidentals } from './crossStaffAccidentals'
import { EngravedNote } from '../engraved/EngravedNote'
import { EngravedAccidental, accidentalsOn } from '../engraved/EngravedAccidental'
import { attachModifier } from '../engraved/EngravedModifier'
import type { Chord, Measure, NotePitch } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

const SIGN_WIDTH = 8
const TREBLE = 'T'
const BASS = 'B'

/** A note with a natural on each of `signed` keys, every sign starting in column 1 (shift 3). */
function note(keys: string[], clef: string, signed: number[], crossings?: ({ clef: 'treble'; lift: number } | undefined)[]) {
  const n = new EngravedNote({ keys, duration: 'h', clef, autoStem: false, crossings })
  for (const index of signed) {
    const sign = new EngravedAccidental('n')
    vi.spyOn(sign, 'getWidth').mockReturnValue(SIGN_WIDTH)
    attachModifier(n, sign, index)
    sign.setXShift(3)
  }
  return n
}
const pitch = (id: string, displayStaffId?: string): NotePitch =>
  ({ id, step: 'C', alter: 0, octave: 4, ...(displayStaffId ? { displayStaffId } : {}) })
const chord = (id: string, notes: NotePitch[], staffId?: string, beat = 1): Chord =>
  ({ id, type: 'chord', beat: frac(beat, 1), duration: 'h', measure: 72, notes, ...(staffId ? { staffId } : {}) })

/** Where each of a note's signs stands, px LEFT of its head — low key first. */
const shifts = (n: EngravedNote) =>
  accidentalsOn(n).sort((a, b) => a.checkIndex() - b.checkIndex()).map(s => -s.getXShift())

describe('dodgeDestinationAccidentals', () => {
  /** His bar: treble C♮5; bass chord A3 · C♮4 · F♮4 with the upper two written on the treble. */
  function hisBar(topKey = 'c/5') {
    const treble = note([topKey], 'treble', [0])
    const lift = { clef: 'treble' as const, lift: 10.5 }
    const crossed = note(['a/3', 'c/4', 'f/4'], 'bass', [1, 2], [undefined, lift, lift])
    const trebleSlot = chord('t', [pitch('c5')])
    const bassSlot = chord('b', [pitch('a3'), pitch('c4', TREBLE), pitch('f4', TREBLE)], BASS)
    const measure = { number: 72, slots: [trebleSlot, bassSlot] } as unknown as Measure
    const built = (id: string) => (id === 'c5' ? treble : undefined)
    return { treble, crossed, bassSlot, measure, built }
  }

  it('🚨 his report: the crossed F♮4 no longer shares a column with the treble’s C♮5', () => {
    const { treble, crossed, bassSlot, measure, built } = hisBar()
    expect(shifts(crossed)[1], 'before: F♮4 sits where C♮5 sits').toBe(shifts(treble)[0])

    dodgeDestinationAccidentals([crossed], [bassSlot], measure, built)

    const [c4, f4] = shifts(crossed)
    expect(f4, 'F♮4 stepped out to the left').toBeGreaterThan(shifts(treble)[0])
    // ⭐ The ZIGZAG of his reference: C♮4 is an octave under C♮5, so it tucks back into the first
    //    column — ⛔ not a third column further out, which put it on the rest beside it.
    expect(c4).toBeLessThan(f4)
    expect(c4).toBe(shifts(treble)[0])
  })

  it('⛔ the destination’s own sign does not move — that bar is already drawn', () => {
    const { treble, crossed, bassSlot, measure, built } = hisBar()
    const before = shifts(treble)
    dodgeDestinationAccidentals([crossed], [bassSlot], measure, built)
    expect(shifts(treble)).toEqual(before)
  })

  it('signs far apart on the staff are left alone', () => {
    // A treble C♮6, two octaves over the crossed F♮4: nothing clashes.
    const { crossed, bassSlot, measure, built } = hisBar('c/6')
    const before = shifts(crossed)
    dodgeDestinationAccidentals([crossed], [bassSlot], measure, built)
    expect(shifts(crossed)).toEqual(before)
  })

  it('a note at ANOTHER beat is not in the column', () => {
    const { crossed, bassSlot, measure, built } = hisBar()
    ;(measure.slots[0] as Chord).beat = frac(2, 1)
    const before = shifts(crossed)
    dodgeDestinationAccidentals([crossed], [bassSlot], measure, built)
    expect(shifts(crossed)).toEqual(before)
  })

  it('a chord with no crossed head, and a destination bar not built yet, change nothing', () => {
    const { crossed, bassSlot, measure } = hisBar()
    const before = shifts(crossed)
    dodgeDestinationAccidentals([crossed], [bassSlot], measure, () => undefined)
    expect(shifts(crossed)).toEqual(before)

    const plain = note(['c/4', 'f/4'], 'treble', [0, 1])
    const plainBefore = shifts(plain)
    dodgeDestinationAccidentals([plain], [chord('p', [pitch('x'), pitch('y')])], measure, () => plain)
    expect(shifts(plain)).toEqual(plainBefore)
  })
})
