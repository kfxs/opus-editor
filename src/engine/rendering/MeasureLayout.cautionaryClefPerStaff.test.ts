import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG } from './layoutConfig'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import { fracCreate } from '@/utils/fraction'
import type { Score } from '@/types/music'

/**
 * A courtesy clef is PER STAFF, because a clef is: a piano score whose left hand changes to treble
 * across a system break must warn on the lower staff and stay silent on the upper. It used to be
 * one clef per measure drawn only on staff 0, so a change on any other staff warned nowhere.
 */
function clefsByStaff(score: Score): Map<string | undefined, StaffClefs> {
  const map = new Map<string | undefined, StaffClefs>()
  for (const staff of score.staves ?? []) map.set(staff.id, resolveStaffClefs(score, staff.id))
  return map
}

/** Enough measures to guarantee a line break somewhere in the middle. */
function twoStaffScore(measureCount: number): ScoreModel {
  const model = new ScoreModel()
  model.addStaffBelow(0)
  while (model.getScore().measures.length < measureCount) model.addMeasure()
  return model
}

describe('cautionary clef, per staff', () => {
  it('warns on the staff whose clef changes, and not on the other', () => {
    const model = twoStaffScore(24)
    const score = model.getScore()
    const staffTwo = score.staves![1].id

    // Find where the layout breaks lines, then change staff 2's clef at the measure that OPENS the
    // next line — that is the only position a courtesy has anything to say about.
    const before = calculateMeasureWidths(score, clefsByStaff(score))
    const opener = [...before.values()].find((info) => info.lineNumber === 1)!
    const openerMeasure = score.measures.find((m) => m.number === opener.measureNumber)!
    const lastOfPrevLine = [...before.values()]
      .filter((info) => info.lineNumber === 0)
      .sort((a, b) => b.measureNumber - a.measureNumber)[0]!

    model.setClefAt(opener.measureNumber, fracCreate(0, 1), 'bass', staffTwo)
    model.setCautionaryClefAllowed(openerMeasure.id, staffTwo, true)

    const after = calculateMeasureWidths(model.getScore(), clefsByStaff(model.getScore()))
    const warned = after.get(lastOfPrevLine.measureNumber)!

    expect(warned.cautionaryEndClefs?.[1]).toBe('bass') // the staff that changed
    expect(warned.cautionaryEndClefs?.[0]).toBeUndefined() // the one that did not
  })

  it('says nothing when the change does not allow a courtesy', () => {
    const model = twoStaffScore(24)
    const score = model.getScore()
    const staffTwo = score.staves![1].id

    const before = calculateMeasureWidths(score, clefsByStaff(score))
    const opener = [...before.values()].find((info) => info.lineNumber === 1)!
    const lastOfPrevLine = [...before.values()]
      .filter((info) => info.lineNumber === 0)
      .sort((a, b) => b.measureNumber - a.measureNumber)[0]!

    // Clef changes, flag absent — the courtesy is never produced.
    model.setClefAt(opener.measureNumber, fracCreate(0, 1), 'bass', staffTwo)

    const after = calculateMeasureWidths(model.getScore(), clefsByStaff(model.getScore()))
    expect(after.get(lastOfPrevLine.measureNumber)!.cautionaryEndClefs).toBeUndefined()
  })

  // The courtesies sit at the same x on different staves, so however many staves warn, the bar
  // gives up ONE clef's worth of note area — not one per staff.
  it('charges the width once, however many staves warn', () => {
    const model = twoStaffScore(24)
    const score = model.getScore()
    const [staffOne, staffTwo] = score.staves!.map((s) => s.id)

    const before = calculateMeasureWidths(score, clefsByStaff(score))
    const opener = [...before.values()].find((info) => info.lineNumber === 1)!
    const openerMeasure = score.measures.find((m) => m.number === opener.measureNumber)!
    const lastOfPrevLine = [...before.values()]
      .filter((info) => info.lineNumber === 0)
      .sort((a, b) => b.measureNumber - a.measureNumber)[0]!
    const widthBefore = lastOfPrevLine.minWidth

    // Both staves open in treble, so both changes are real ones.
    model.setClefAt(opener.measureNumber, fracCreate(0, 1), 'bass', staffOne)
    model.setClefAt(opener.measureNumber, fracCreate(0, 1), 'alto', staffTwo)
    // The first staff is ABSENT from the key — naming it writes somewhere nobody reads.
    model.setCautionaryClefAllowed(openerMeasure.id, undefined, true)
    model.setCautionaryClefAllowed(openerMeasure.id, staffTwo, true)

    const after = calculateMeasureWidths(model.getScore(), clefsByStaff(model.getScore()))
    const warned = after.get(lastOfPrevLine.measureNumber)!

    expect(warned.cautionaryEndClefs?.[0]).toBe('bass')
    expect(warned.cautionaryEndClefs?.[1]).toBe('alto')
    expect(warned.minWidth).toBe(widthBefore + LAYOUT_CONFIG.CLEF_CHANGE_WIDTH)
  })
})
