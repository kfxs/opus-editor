/**
 * {@link glissandoOps} — what a glissando anchors to, where it GOES, and that it survives (or goes with
 * its note) through the edits that re-mint or remove heads. docs/plans/glissando-plan.md P0.
 *
 * A `ScoreModel` is the FIXTURE; what is under test is the free functions in `./glissandoOps`.
 * ⚠️ Nothing here asserts a coordinate — that is the renderer's (P1).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import {
  addGlissando, getGlissandi, getGlissandoById, glissandoDirection, glissandoOn, glissandoTarget, pruneGlissandi, removeGlissando,
  setGlissandoDirection, setGlissandoEnd, setGlissandoSide, setGlissandoText,
} from './glissandoOps'
import { deleteNoteWithRepair } from './deleteNoteOps'
import { convertSlotToRest } from './convertToRestOps'
import type { Chord, FanMark, Note, NoteParams } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

type Step = NoteParams['step']
const at = (model: ScoreModel, step: Step, octave: number, measure: number, beat: number): Note =>
  model.addNote({ step, alter: 0, octave, duration: 'q', measure, beat: frac(beat, 1) })

describe('glissandoOps — anchoring', () => {
  let model: ScoreModel
  let notes: Note[]

  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4
    notes = (['C', 'D', 'E', 'F'] as Step[]).map((step, i) => at(model, step, 4, 1, i))
  })

  it('adds one on a head and finds it back by head and by id', () => {
    const g = addGlissando(model.getScore(), notes[0].id)!
    expect(g.noteId).toBe(notes[0].id)
    expect(glissandoOn(model.getScore(), notes[0].id)).toBe(g)
    expect(getGlissandoById(model.getScore(), g.id)).toBe(g)
  })

  it('stores ONLY its anchor — no voice, no staff, no end (plan §1)', () => {
    const g = addGlissando(model.getScore(), notes[0].id)!
    expect(Object.keys(g).sort()).toEqual(['id', 'noteId'])
  })

  it('is IDEMPOTENT — a head carries at most one', () => {
    const first = addGlissando(model.getScore(), notes[0].id)
    expect(addGlissando(model.getScore(), notes[0].id)).toBe(first)
    expect(getGlissandi(model.getScore())).toHaveLength(1)
  })

  it('refuses an unknown id and a REST', () => {
    model.addMeasure()
    const rest = model.getNotesInMeasure(2).find(n => n.isRest)!
    expect(addGlissando(model.getScore(), 'ghost')).toBeNull()
    expect(addGlissando(model.getScore(), rest.id)).toBeNull()
    expect(model.getScore().glissandi).toBeUndefined()
  })

  it('refuses a FANNED MEMBER', () => {
    const fan: FanMark = { direction: 'accel', count: 3, beams: 2 }
    expect(model.setFan(notes[0].id, fan)).not.toBeNull()
    const slot = model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === 0) as Chord
    const memberId = slot.fan!.members![0].pitches[0].id
    expect(addGlissando(model.getScore(), memberId)).toBeNull()
  })

  it('remove takes it out, and an emptied list leaves no field behind', () => {
    const g = addGlissando(model.getScore(), notes[0].id)!
    expect(removeGlissando(model.getScore(), g.id)).toBe(true)
    expect(model.getScore().glissandi).toBeUndefined()
    expect(removeGlissando(model.getScore(), g.id)).toBe(false)
  })
})

describe('⭐⭐ glissandoTarget — the far end is ASKED, never stored (G4)', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel()
  })

  it('goes to the NEXT note of the lane', () => {
    const c = at(model, 'C', 4, 1, 0)
    const g = at(model, 'G', 4, 1, 1)
    expect(glissandoTarget(model.getScore(), addGlissando(model.getScore(), c.id)!)).toBe(g.id)
  })

  it('⭐ a REST next ⇒ null; the same slot filled LATER ⇒ the new note, with nothing re-written', () => {
    const c = at(model, 'C', 4, 1, 0)
    const g = addGlissando(model.getScore(), c.id)!
    const before = JSON.stringify(g)
    expect(glissandoTarget(model.getScore(), g)).toBeNull()

    const later = at(model, 'A', 4, 1, 1)
    expect(glissandoTarget(model.getScore(), g)).toBe(later.id)
    expect(JSON.stringify(g)).toBe(before)
  })

  it('crosses a BARLINE', () => {
    model.addMeasure()
    const last = at(model, 'C', 5, 1, 3)
    const next = at(model, 'C', 4, 2, 0)
    expect(glissandoTarget(model.getScore(), addGlissando(model.getScore(), last.id)!)).toBe(next.id)
  })

  it('the lane ends ⇒ null', () => {
    const last = at(model, 'C', 4, 1, 3)
    expect(glissandoTarget(model.getScore(), addGlissando(model.getScore(), last.id)!)).toBeNull()
  })

  it('stays in its VOICE — a note in another voice is not the next note', () => {
    const c = at(model, 'C', 5, 1, 0)
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    const g = addGlissando(model.getScore(), c.id)!
    expect(glissandoTarget(model.getScore(), g)).toBeNull() // voice 0's beat 1 is a rest
  })

  it('⭐ a CHORD pairs by index from the BOTTOM; a surplus head goes to the target\'s TOP (G9)', () => {
    const [c4, e4, g4] = (['C', 'E', 'G'] as Step[]).map(s => at(model, s, 4, 1, 0))
    const [d5, f5] = (['D', 'F'] as Step[]).map(s => at(model, s, 5, 1, 1))
    const score = model.getScore()
    expect(glissandoTarget(score, addGlissando(score, c4.id)!)).toBe(d5.id)
    expect(glissandoTarget(score, addGlissando(score, e4.id)!)).toBe(f5.id)
    expect(glissandoTarget(score, addGlissando(score, g4.id)!)).toBe(f5.id)
  })
})

describe('the anchor through edits', () => {
  let model: ScoreModel
  let notes: Note[]

  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    notes = []
    for (let m = 1; m <= 2; m++) {
      for (const [i, step] of (['C', 'D', 'E', 'F'] as Step[]).entries()) notes.push(at(model, step, 4 + m - 1, m, i))
    }
  })

  it('⭐ a RE-BAR re-finds the anchor: the SAME glissando, on the same music, a re-minted id', () => {
    const g = addGlissando(model.getScore(), notes[5].id)! // D5, bar 2 beat 1
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const all = getGlissandi(model.getScore())
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(g.id)
    expect(all[0].noteId).not.toBe(notes[5].id)
    const anchor = model.getNote(all[0].noteId)!
    expect([anchor.step, anchor.octave]).toEqual(['D', 5])
  })

  it('deleting the anchor takes the glissando', () => {
    addGlissando(model.getScore(), notes[0].id)
    expect(deleteNoteWithRepair(model, notes[0].id)).toBe(true)
    expect(model.getScore().glissandi).toBeUndefined()
  })

  it('deleting the TARGET leaves the glissando, now with a free end', () => {
    const g = addGlissando(model.getScore(), notes[0].id)!
    deleteNoteWithRepair(model, notes[1].id)
    expect(getGlissandi(model.getScore())).toEqual([g])
    expect(glissandoTarget(model.getScore(), g)).toBeNull()
  })

  it('silencing the anchor takes the glissando — it never stands on a rest', () => {
    addGlissando(model.getScore(), notes[2].id)
    expect(convertSlotToRest(model, notes[2].id)).not.toBeNull()
    expect(model.getScore().glissandi).toBeUndefined()
  })

  it('removing the anchor\'s MEASURE takes it; one elsewhere stays', () => {
    addGlissando(model.getScore(), notes[1].id)
    const kept = addGlissando(model.getScore(), notes[6].id)!
    model.removeMeasure(1)
    expect(getGlissandi(model.getScore())).toEqual([kept])
  })

  it('pruneGlissandi keeps every glissando whose anchor still stands', () => {
    const g = addGlissando(model.getScore(), notes[0].id)!
    pruneGlissandi(model.getScore())
    expect(getGlissandi(model.getScore())).toEqual([g])
  })
})

describe('P3 — the free ends: side, end, direction', () => {
  let model: ScoreModel
  let c: Note

  beforeEach(() => {
    model = new ScoreModel()
    c = at(model, 'C', 4, 1, 0)
    at(model, 'G', 4, 1, 1)
  })

  it('`end: none` frees the end even with a note next; `next` DELETES the field', () => {
    const g = addGlissando(model.getScore(), c.id)!
    expect(setGlissandoEnd(model.getScore(), g.id, 'none')).toBe(true)
    expect(glissandoTarget(model.getScore(), g)).toBeNull()
    expect(setGlissandoEnd(model.getScore(), g.id, 'next')).toBe(true)
    expect('end' in g).toBe(false)
    expect(glissandoTarget(model.getScore(), g)).not.toBeNull()
  })

  it('`side: before` has no target, clears `end`, and refuses one; `after` deletes the field', () => {
    const g = addGlissando(model.getScore(), c.id)!
    setGlissandoEnd(model.getScore(), g.id, 'none')
    expect(setGlissandoSide(model.getScore(), g.id, 'before')).toBe(true)
    expect('end' in g).toBe(false)
    expect(glissandoTarget(model.getScore(), g)).toBeNull()
    expect(setGlissandoEnd(model.getScore(), g.id, 'none')).toBe(false)
    expect(setGlissandoSide(model.getScore(), g.id, 'after')).toBe(true)
    expect('side' in g).toBe(false)
  })

  it('direction: absent = the side\'s usual (after falls, before rises); writing the usual deletes it', () => {
    const g = addGlissando(model.getScore(), c.id)!
    expect(glissandoDirection(g)).toBe('down')
    expect(setGlissandoDirection(model.getScore(), g.id, 'up')).toBe(true)
    expect(g.direction).toBe('up')
    expect(setGlissandoDirection(model.getScore(), g.id, 'down')).toBe(true)
    expect('direction' in g).toBe(false)
    setGlissandoSide(model.getScore(), g.id, 'before')
    expect(glissandoDirection(g)).toBe('up')
  })
})

describe('the word along the line', () => {
  it('set, trimmed; blank or null DELETES it; a re-set of the same is no change', () => {
    const model = new ScoreModel()
    const c = at(model, 'C', 4, 1, 0)
    const g = addGlissando(model.getScore(), c.id)!
    expect(setGlissandoText(model.getScore(), g.id, '  gliss. ')).toBe(true)
    expect(g.text).toBe('gliss.')
    expect(setGlissandoText(model.getScore(), g.id, 'gliss.')).toBe(false)
    expect(setGlissandoText(model.getScore(), g.id, '   ')).toBe(true)
    expect('text' in g).toBe(false)
  })
})
