import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addBracketed } from './bracketedGraceOps'
import { addGrace } from './graceOps'
import { attackOf, findSlot } from './slotLookup'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Subject: `./slotLookup` — the `{ bracketed: true }` opt-in (bracketed-grace-plan P2b): a bracketed
 * pitch is found ONLY when asked for, and it is ⛔ never an attack.
 */
const Bb4 = { step: 'B' as const, alter: -1 as const, octave: 4 }

describe('findSlot — bracketed pitches', () => {
  const setup = () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    return { model, score: model.getScore(), note }
  }

  it('⭐ fails CLOSED without the opt-in — every mutator that does not ask refuses one', () => {
    const { score, note } = setup()
    const made = addBracketed(score, note.id, 'before', Bb4)!
    expect(findSlot(score, made.pitches[0].id, { fanMembers: true, graceNotes: true })).toBeUndefined()
  })

  it('with it: the chord, the pitch, and where it hangs — its side and place', () => {
    const { score, note } = setup()
    addBracketed(score, note.id, 'before', { step: 'D', alter: 0, octave: 5 })
    const made = addBracketed(score, note.id, 'before', Bb4)!
    const found = findSlot(score, made.pitches[0].id, { bracketed: true })
    expect(found?.type).toBe('chord')
    expect(found?.pitch).toBe(made.pitches[0])
    expect(found?.bracketed).toMatchObject({ note: made, side: 'before', index: 1 })
    expect(found?.bracketed?.onGrace).toBeUndefined()
  })

  it('on a GRACE, it names the grace; on a REST, the rest', () => {
    const { model, score, note } = setup()
    const grace = addGrace(score, note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
    const onGrace = addBracketed(score, grace.pitches[0].id, 'before', Bb4)!
    expect(findSlot(score, onGrace.pitches[0].id, { bracketed: true })?.bracketed?.onGrace).toBe(grace)
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    const onRest = addBracketed(score, rest.id, 'before', Bb4)!
    expect(findSlot(score, onRest.pitches[0].id, { bracketed: true })?.type).toBe('rest')
  })

  it('⛔ attackOf is NULL — no mark is struck with information (B6)', () => {
    const { score, note } = setup()
    const made = addBracketed(score, note.id, 'before', Bb4)!
    expect(attackOf(findSlot(score, made.pitches[0].id, { bracketed: true })!)).toBeNull()
  })
})
