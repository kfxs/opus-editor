import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { findSlot, attackOf, writeAttackMarks, projectAttackMarks } from './slotLookup'
import { fracCreate as frac } from '@/utils/fraction'
import { DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from '@/utils/fannedBeam'
import type { Attack, FanMark, Note } from '@/types/music'

/**
 * Subject: the ATTACK seam in `./slotLookup` — `attackOf`, `writeAttackMarks`, `projectAttackMarks`.
 *
 * The seam exists because marks on a fanned member were being re-solved one field at a time, each
 * landing as a `found.member ? … : …` fork whose two arms were the same code on two objects. What it
 * has to guarantee is the thing those forks kept getting wrong: **an id resolves to the attack that
 * OWNS its marks**, which is the member inside a fan and the chord everywhere else — never the slot
 * standing in for a member, and never a member standing in for the slot.
 */

const FAN: FanMark = { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }

/** A fanned half note in bar 1, with the owner's id and its first member's. */
function fanned() {
  const model = new ScoreModel('Attack seam')
  const owner = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
  model.setFan(owner.id, FAN)
  const score = model.getScore()
  const slot = score.measures[0].slots.find(s => s.type === 'chord')!
  if (slot.type !== 'chord') throw new Error('expected a chord')
  return { model, score, slot, ownerId: owner.id, memberId: slot.fan!.members![0].pitches[0].id }
}

describe('attackOf', () => {
  it('resolves a MEMBER id to the member, and the owner id to the chord', () => {
    const { score, slot, ownerId, memberId } = fanned()

    expect(attackOf(findSlot(score, ownerId, { fanMembers: true })!)).toBe(slot)
    expect(attackOf(findSlot(score, memberId, { fanMembers: true })!)).toBe(slot.fan!.members![0])
  })

  it('an ordinary note resolves to its own chord', () => {
    const model = new ScoreModel('Attack seam')
    const note = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const found = findSlot(model.getScore(), note.id, { fanMembers: true })!
    expect(attackOf(found)).toBe(found.type === 'chord' ? found.chord : null)
  })

  it('a REST has no attack — silence is not struck', () => {
    const model = new ScoreModel('Attack seam')
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = model.getScore().measures[0].slots.find(s => s.type === 'rest')!
    expect(attackOf(findSlot(model.getScore(), rest.id, { fanMembers: true })!)).toBeNull()
  })

  /**
   * The property the whole seam is for: writing through it touches ONE attack. Before it existed,
   * the owner's flip was stored where the members read their side from, so one `x` moved six marks.
   */
  it('⭐ writing through a member does not touch the owner, and vice versa', () => {
    const { score, slot, ownerId, memberId } = fanned()

    writeAttackMarks(attackOf(findSlot(score, memberId, { fanMembers: true })!)!, {
      articulations: ['accent'], articulationPlacement: 'above',
    })
    expect(slot.fan!.members![0].articulations).toEqual(['accent'])
    expect(slot.articulations, 'the owner was not touched').toBeUndefined()
    expect(slot.articulationPlacement).toBeUndefined()

    writeAttackMarks(attackOf(findSlot(score, ownerId, { fanMembers: true })!)!, {
      articulations: ['staccato'],
    })
    expect(slot.articulations).toEqual(['staccato'])
    expect(slot.fan!.members![0].articulations, 'and the member still has its own').toEqual(['accent'])
  })
})

describe('writeAttackMarks', () => {
  it('spells "none" as ABSENT, never as an empty array', () => {
    // `laneFingerprint` stringifies the whole slot for the width-cache key, so `[]` and absent would
    // be two keys for one piece of music.
    const attack: Attack = { articulations: ['accent'], articulationPlacement: 'below' }
    writeAttackMarks(attack, { articulations: [], articulationPlacement: undefined })
    expect('articulations' in attack).toBe(false)
    expect('articulationPlacement' in attack).toBe(false)
  })

  it('touches only the fields the caller actually passed', () => {
    const attack: Attack = { articulations: ['accent'], articulationPlacement: 'below' }
    writeAttackMarks(attack, { articulations: ['tenuto'] })
    expect(attack.articulations).toEqual(['tenuto'])
    expect(attack.articulationPlacement, 'the side was not in the update').toBe('below')
  })

  it('copies the array rather than aliasing the caller’s', () => {
    const mine: Array<'accent'> = ['accent']
    const attack: Attack = {}
    writeAttackMarks(attack, { articulations: mine })
    mine.push('accent')
    expect(attack.articulations).toEqual(['accent'])
  })
})

describe('projectAttackMarks', () => {
  it('replaces whatever the flat note arrived carrying', () => {
    // The case it is for: a member's projection comes through the OWNER's chord, so the slot's marks
    // are already on it and have to be overwritten — not merged, and not left when the attack has none.
    const note = { articulations: ['staccato'], articulationPlacement: 'below' } as unknown as Note
    projectAttackMarks(note, { articulations: ['accent'] })
    expect(note.articulations).toEqual(['accent'])
    expect(note.articulationPlacement, 'an attack with no side reports none').toBeUndefined()
  })

  it('an unmarked attack clears the projection entirely', () => {
    const note = { articulations: ['staccato'], articulationPlacement: 'above' } as unknown as Note
    projectAttackMarks(note, {})
    expect(note.articulations).toBeUndefined()
    expect(note.articulationPlacement).toBeUndefined()
  })
})
