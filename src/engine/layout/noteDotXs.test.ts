import { describe, it, expect } from 'vitest'
import { noteDotXs } from './noteDotXs'
import { graceDotXs } from './graceRoom'

/** Subject: `./noteDotXs` — where a note's dots stand; lifted out of `graceRoom.graceDotXs` unchanged. */
describe('noteDotXs', () => {
  it('⭐ a stem-UP flag pushes the dots past it; each further dot one step on', () => {
    const [plain] = noteDotXs({ duration: '8', dots: 1 }, false)
    const [flagged, second] = noteDotXs({ duration: '8', dots: 2 }, true)
    expect(flagged).toBeGreaterThan(plain)
    expect(second).toBeGreaterThan(flagged)
    expect(noteDotXs({ duration: '8' }, true)).toEqual([])
  })

  it("the grace's rule IS this one — flagged unless beamed or stem-down", () => {
    const note = { duration: '16' as const, dots: 1 }
    expect(graceDotXs(note)).toEqual(noteDotXs(note, true))
    expect(graceDotXs(note, true)).toEqual(noteDotXs(note, false))
    expect(graceDotXs(note, false, true)).toEqual(noteDotXs(note, false))
  })
})
