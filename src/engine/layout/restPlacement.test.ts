import { describe, it, expect } from 'vitest'
import { restStaffLine } from './restPlacement'
import type { NoteDuration } from '@/types/music'

/**
 * Where a rest sits on the staff — the rule the model and the drawing both read.
 *
 * ⭐ The assertions are about the RELATION between the two lines, not about the numbers 1 and 2.
 * Restating the table would only pin the table to itself; what is worth defending is the fact the
 * app got wrong for as long as it drew rests: **a whole rest is a staff space HIGHER than the
 * others**, because it hangs from the fourth line while they are anchored to the middle.
 */

const SHORTER: NoteDuration[] = ['h', 'q', '8', '16', '32']

describe('which line a rest is drawn on', () => {
  it('⭐⭐ a WHOLE rest is one staff space HIGHER than every other rest', () => {
    // The bug this module was extracted for: every rest used to be given the middle line, which put
    // the semibreve rest a space below where it belongs. LilyPond `staff-position +2`, MuseScore
    // `line 1`, Verovio `loc 6` — three notations, one line, and one space above the rest of them.
    for (const duration of SHORTER) {
      expect(restStaffLine('w'), `a whole rest against a ${duration} rest`)
        .toBeCloseTo(restStaffLine(duration) - 1, 10)
    }
  })

  it('every rest shorter than a whole shares ONE line — the middle', () => {
    // ⚠️ The middle line of a five-line staff is 2 on this axis (spaces below the TOP line), which is
    //    the axis `kerning.ts` compares bands on. A number in another engine's units here would be
    //    the same class of mistake as the one above.
    for (const duration of SHORTER) {
      expect(restStaffLine(duration), duration).toBe(2)
    }
  })

  it('every rest is drawn inside the five lines', () => {
    for (const duration of [...SHORTER, 'w' as NoteDuration]) {
      expect(restStaffLine(duration), `${duration} is on the staff`).toBeGreaterThanOrEqual(0)
      expect(restStaffLine(duration)).toBeLessThanOrEqual(4)
    }
  })

  it('⛔ an unknown duration falls back to the MIDDLE line, never to the whole rest\'s', () => {
    // A fallback that guessed the whole rest's line would put a strange duration a space off the
    // staff's centre — wrong, and wrong in the direction nobody would look at.
    expect(restStaffLine('64' as NoteDuration)).toBe(2)
  })
})
