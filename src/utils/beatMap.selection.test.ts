import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { buildSelectionBeatMap, notesInBox } from './beatMap'
import { measureFanMemberNotes, getMeasureNotes } from './musicUtils'
import { fracCreate as frac } from './fraction'
import { DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from './fannedBeam'
import type { FanMark, Score } from '@/types/music'

/**
 * Subject: {@link buildSelectionBeatMap} + {@link notesInBox} in `./beatMap` — the box Shift-click
 * builds, and specifically that a FANNED MEMBER is in it.
 *
 * REGRESSION. Ctrl-click could always pick a member (it puts an id in a set and asks the beat map
 * nothing), but Shift-click goes through `notesInBox`, which was built on `buildBeatMap` —
 * `getMeasureNotes` alone, and that deliberately does not emit members. So a member was invisible to
 * the box in two different ways, one of them destructive:
 *
 *   - anchor on an ordinary note, Shift-click a member → the member is not an endpoint, the box
 *     stays on the anchor, nothing appears to happen;
 *   - anchor on a member, Shift-click another member → NO endpoint resolves, and the empty-endpoint
 *     fallback returns `[]`, so the selection is CLEARED.
 *
 * A `ScoreModel` is the fixture, not the subject (test-layout plan decision 4).
 */

const FAN: FanMark = { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }

/** One half note in bar 1 turned into a 6-note accel fan, plus the ids that came out of it.
 *  `setFan` normalises, which is what materialises the 5 members and gives each its own id. */
function fannedScore(): { score: Score; baseId: string; memberIds: string[] } {
  const model = new ScoreModel('Fan selection')
  const base = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
  expect(model.setFan(base.id, FAN), 'fixture: the fan was refused').not.toBeNull()
  const score = model.getScore()
  const memberIds = measureFanMemberNotes(score.measures[0], score).map(n => n.id)
  expect(memberIds, 'fixture: a 6-note fan has 5 members of its own').toHaveLength(DEFAULT_FAN_COUNT - 1)
  return { score, baseId: base.id, memberIds }
}

describe('buildSelectionBeatMap', () => {
  it('sees the fanned members that getMeasureNotes leaves out', () => {
    const { score, baseId, memberIds } = fannedScore()

    const plain = getMeasureNotes(score.measures[0], score).map(n => n.id)
    expect(plain, 'getMeasureNotes still excludes members — that contract is unchanged')
      .not.toContain(memberIds[0])

    const ids = buildSelectionBeatMap(score).allFlat.map(n => n.id)
    expect(ids).toContain(baseId)
    for (const id of memberIds) expect(ids).toContain(id)
  })

  it('keeps every member as its own position — they do not collapse onto the slot', () => {
    const { score, memberIds } = fannedScore()
    const { beats } = buildSelectionBeatMap(score)
    // A member's beat is an arbitrary rational (8/15 of a beat and the like), so each lands on a
    // position of its own rather than folding into the slot's.
    const beatIds = new Set(beats.map(n => n.id))
    for (const id of memberIds) expect(beatIds.has(id), `member ${id} lost its position`).toBe(true)
  })
})

describe('notesInBox reaches into a fan', () => {
  it('extends from an ordinary note onto a member — the box grows to include it', () => {
    const { score, baseId, memberIds } = fannedScore()
    const box = notesInBox(score, [baseId], memberIds[2])

    expect(box, 'the shift-clicked member must be selected').toContain(memberIds[2])
    expect(box, 'and the anchor stays in').toContain(baseId)
    // Everything in between comes too — a range is a range, not two endpoints.
    expect(box).toContain(memberIds[0])
    expect(box).toContain(memberIds[1])
    expect(box, 'but nothing past the target').not.toContain(memberIds[3])
  })

  it('extends member → member, instead of clearing the selection', () => {
    const { score, memberIds } = fannedScore()
    const box = notesInBox(score, [memberIds[0]], memberIds[3])

    // The bug: with neither endpoint resolvable this returned [] and the selection vanished.
    expect(box.length, 'the selection was emptied').toBeGreaterThan(0)
    expect(box).toEqual(expect.arrayContaining(memberIds.slice(0, 4)))
    expect(box, 'the member past the target stays out').not.toContain(memberIds[4])
  })

  it('a range that crosses the whole fan takes the members with it', () => {
    const model = new ScoreModel('Fan selection')
    const base = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const after = model.addNote({ step: 'G', octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.setFan(base.id, FAN)
    const score = model.getScore()
    const memberIds = measureFanMemberNotes(score.measures[0], score).map(n => n.id)

    const box = notesInBox(score, [base.id], after.id)
    expect(box).toContain(after.id)
    for (const id of memberIds) {
      expect(box, `member ${id} was skipped by a range drawn straight over it`).toContain(id)
    }
  })
})
