/**
 * TIES — {@link tieTargetOf} (which note a tie joins to), {@link toggleTie}, and the selection pair
 * {@link planTieSelection} / {@link applyTiePairs}. The target rule is pure and asked of fabricated
 * notes; the writes go through a real `ScoreModel`, which is what answers `TieModel`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Note } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'
import { ScoreModel } from './ScoreModel'
import { applyTiePairs, planTieSelection, repairDanglingTies, tieTargetOf, toggleTie } from './tieOps'

const n = (id: string, beat: number, over: Partial<Note> = {}): Note =>
  ({ id, measure: 1, beat: frac(beat, 1), duration: 'q', step: 'C', alter: 0, octave: 4, ...over }) as Note

describe('tieTargetOf — which note a tie joins to', () => {
  it('the next slot STRICTLY after — never a sibling on the same beat', () => {
    const notes = [n('a', 0), n('sibling', 0, { step: 'E' }), n('b', 1)]
    expect(tieTargetOf(notes, notes[0])!.id).toBe('b')
  })

  it('⭐ in a chord it prefers the SAME PITCH, so chords tie like to like', () => {
    const notes = [n('src', 0, { step: 'G' }), n('c', 1), n('g', 1, { step: 'G' })]
    expect(tieTargetOf(notes, notes[0])!.id).toBe('g')
  })

  it('…and an accidental is part of the pitch: C♯ does not match C', () => {
    const notes = [n('src', 0, { alter: 1 }), n('plain', 1), n('sharp', 1, { alter: 1 })]
    expect(tieTargetOf(notes, notes[0])!.id).toBe('sharp')
  })

  it('failing that, whatever is there — a different pitch, or a rest (l.v.)', () => {
    const rest = n('r', 1, { isRest: true })
    expect(tieTargetOf([n('a', 0), rest], n('a', 0))!.id).toBe('r')
  })

  it('⭐⭐ stays in its own STAFF and VOICE — the same pitch next door is not a target', () => {
    // Without the scoping the tie grabbed whichever E the position-sorted search hit first.
    const src = n('s1a', 0, { staff: 1 })
    const notes = [src, n('s0b', 1, { staff: 0 }), n('v2', 1, { staff: 1, voice: 1 }), n('s1b', 1, { staff: 1 })]
    expect(tieTargetOf(notes, src)!.id).toBe('s1b')
  })

  it('null at the end of its stream', () => {
    expect(tieTargetOf([n('a', 0)], n('a', 0))).toBeNull()
  })
})

describe('toggleTie / planTieSelection — through a ScoreModel', () => {
  let model: ScoreModel
  let ids: string[]

  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4
    ids = [0, 1, 2].map(i =>
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) }).id)
  })

  it('adds the tie on BOTH notes, and a second press takes both halves off', () => {
    expect(toggleTie(model, ids[0])).toBe(true)
    expect(model.getNote(ids[0])!.tiedTo).toBe(ids[1])
    expect(model.getNote(ids[1])!.tiedFrom).toBe(ids[0])

    expect(toggleTie(model, ids[0])).toBe(false)
    expect(model.getNote(ids[0])!.tiedTo).toBeUndefined()
    expect(model.getNote(ids[1])!.tiedFrom).toBeUndefined()
  })

  it('null — and nothing written — for a rest or an id that is gone', () => {
    expect(toggleTie(model, 'gone')).toBeNull()
  })

  it('⭐ a selection ties every note but the LAST position’s, and says it would ADD', () => {
    const plan = planTieSelection(model, ids)
    expect(plan).toMatchObject({ allTied: false })
    if (!plan || 'single' in plan) throw new Error('expected pairs')
    expect(plan.pairs.map(p => [p.source.id, p.target.id])).toEqual([[ids[0], ids[1]], [ids[1], ids[2]]])

    applyTiePairs(model, plan.pairs, plan.allTied)
    expect(model.getNote(ids[1])!.tiedTo).toBe(ids[2])
    expect(model.getNote(ids[2])!.tiedTo).toBeUndefined()
  })

  it('…and once every pair is tied the same selection says REMOVE, and takes them off', () => {
    const first = planTieSelection(model, ids)
    if (!first || 'single' in first) throw new Error('expected pairs')
    applyTiePairs(model, first.pairs, first.allTied)

    const again = planTieSelection(model, ids)
    if (!again || 'single' in again) throw new Error('expected pairs')
    expect(again.allTied).toBe(true)
    applyTiePairs(model, again.pairs, again.allTied)
    expect(ids.map(id => model.getNote(id)!.tiedTo)).toEqual([undefined, undefined, undefined])
  })

  it('one usable note is not a selection — it routes to the single-note toggle; duplicates fold', () => {
    expect(planTieSelection(model, [ids[0], ids[0]])).toEqual({ single: ids[0] })
    expect(planTieSelection(model, [])).toBeNull()
  })
})

describe('repairDanglingTies — a tie is severed, never left pointing at nothing', () => {
  it('clears a pointer to an id that is gone, on either end, and leaves a whole tie alone', () => {
    const model = new ScoreModel()
    const [a, b, c] = [0, 1, 2].map(i =>
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) }))
    toggleTie(model, a.id) // a → b, whole
    // What a re-bar leaves when it re-mints ids: pointers at notes that no longer exist.
    model.updateNote(b.id, { tiedTo: 'gone' })
    model.updateNote(c.id, { tiedFrom: 'gone-too' })

    repairDanglingTies(model.getScore())

    expect(model.getNote(a.id)!.tiedTo).toBe(b.id)
    expect(model.getNote(b.id)!.tiedFrom).toBe(a.id)
    expect(model.getNote(b.id)!.tiedTo).toBeUndefined()
    expect(model.getNote(c.id)!.tiedFrom).toBeUndefined()
  })

  it('a REST holds only the arriving end, and that is cleared too', () => {
    const model = new ScoreModel()
    const rest = model.addNote({ duration: 'q', measure: 1, beat: frac(0, 1), isRest: true })
    model.updateNote(rest.id, { tiedFrom: 'gone' })
    repairDanglingTies(model.getScore())
    expect(model.getNote(rest.id)!.tiedFrom).toBeUndefined()
  })
})
