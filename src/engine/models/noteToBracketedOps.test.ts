import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { bracketedToGrace, bracketedToNote, convertNoteToBracketed, graceToBracketed } from './noteToBracketedOps'
import { graceBeamRuns } from '@/engine/engrave/notes/graceBeam'
import { addBracketed } from './bracketedGraceOps'
import { addGrace } from './graceOps'
import { findSlot } from './slotLookup'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { Rest } from '@/types/music'

/**
 * Subject: `./noteToBracketedOps` — a selected note pressed with `bracket.` (his rule, 2026-09-23):
 * *"this note becomes a bracket and we fill the note slot with a rest of it duration, similar to grace"*.
 */
describe('convertNoteToBracketed', () => {
  const setup = () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'D', octave: 5, duration: 'h', measure: 1, beat: frac(1, 1) })
    const rhythm = () => model.getMeasure(1)!.slots.map(s => `${s.type}@${fracToNumber(s.beat)}:${s.duration}`)
    return { model, score: model.getScore(), note, rhythm }
  }
  const restAt = (model: ScoreModel, beat: number): Rest =>
    model.getMeasure(1)!.slots.find((s): s is Rest => s.type === 'rest' && fracToNumber(s.beat) === beat)!

  it('⭐ the slot becomes a rest of the note\'s OWN length; the note a bracketed grace before it — nothing moves', () => {
    const { model, score, note, rhythm } = setup()
    const before = rhythm().map(r => r.replace('chord', 'rest'))
    const made = convertNoteToBracketed(score, note.id)!
    expect(rhythm()).toEqual(before)
    const rest = restAt(model, 1)
    expect(rest.id).toBe(made.restId)
    expect(rest.duration).toBe('h')
    expect(rest.bracketedBefore).toEqual([{ pitches: [expect.objectContaining({ id: note.id, step: 'D', octave: 5 })], duration: 'h' }])
  })

  it('⭐ a CHORD becomes a bracketed CHORD — every pitch, its id kept', () => {
    const { model, score, note } = setup()
    model.addNote({ step: 'F', octave: 5, duration: 'h', measure: 1, beat: frac(1, 1) }) // joins the chord
    const chord = findSlot(score, note.id)
    const ids = chord?.type === 'chord' ? chord.chord.notes.map(p => p.id).sort() : []
    expect(ids).toHaveLength(2)
    convertNoteToBracketed(score, note.id)
    expect(restAt(model, 1).bracketedBefore![0].pitches.map(p => p.id).sort()).toEqual(ids)
  })

  it('what stood before the note stays in front of the new one — its grace and its own bracketed grace', () => {
    const { model, score, note } = setup()
    addGrace(score, note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })
    const earlier = addBracketed(score, note.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    convertNoteToBracketed(score, note.id)
    const rest = restAt(model, 1)
    expect(rest.graceBefore?.notes).toHaveLength(1)
    expect(rest.bracketedBefore![0]).toBe(earlier)
    expect(rest.bracketedBefore![1].pitches[0].id).toBe(note.id)
  })

  it('⛔ refuses a rest, a grace, a bracketed grace, an id that is gone', () => {
    const { model, score, note } = setup()
    const grace = addGrace(score, note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
    const bracketed = addBracketed(score, note.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    for (const id of [restAt(model, 0).id, grace.pitches[0].id, bracketed.pitches[0].id, 'nobody']) {
      expect(convertNoteToBracketed(score, id)).toBeNull()
    }
    expect(findSlot(score, note.id)?.type).toBe('chord')
  })
})

describe('bracketedToNote — the lit button toggled OFF (his rule: "the target maintain the duration but repitch it")', () => {
  const setup = () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'D', octave: 5, duration: 'h', measure: 1, beat: frac(1, 1) })
    return { model, score: model.getScore(), note }
  }
  const chordOf = (model: ScoreModel, id: string) => {
    const f = findSlot(model.getScore(), id)
    if (f?.type !== 'chord') throw new Error('expected a chord')
    return f.chord
  }

  it('⭐ on a NOTE: it keeps its duration and marks, takes the pitch — and the bracketed grace is gone', () => {
    const { model, score, note } = setup()
    model.updateNote(note.id, { articulations: ['staccato'] })
    const made = addBracketed(score, note.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    const id = bracketedToNote(score, made.pitches[0].id)!
    const chord = chordOf(model, id)
    expect(chord.notes.map(p => [p.id, p.step, p.alter, p.octave])).toEqual([[made.pitches[0].id, 'B', -1, 4]])
    expect(chord.duration).toBe('h')
    expect(chord.articulations).toEqual(['staccato'])
    expect('bracketedBefore' in chord).toBe(false)
    expect(findSlot(score, note.id)).toBeUndefined() // the old pitch went
  })

  it('⭐ the ROUND TRIP: a note made bracketed and toggled off is the note again, at its length, its id kept', () => {
    const { model, score, note } = setup()
    convertNoteToBracketed(score, note.id)
    const id = bracketedToNote(score, note.id)!
    expect(id).toBe(note.id)
    const chord = chordOf(model, note.id)
    expect(chord.beat).toEqual(frac(1, 1))
    expect(chord.duration).toBe('h')
    expect(chord.notes[0]).toMatchObject({ step: 'D', octave: 5 })
    expect(model.getMeasure(1)!.slots.some(s => s.bracketedBefore)).toBe(false)
  })

  it('on a GRACE: the grace takes the pitch and keeps its written value', () => {
    const { score, note } = setup()
    const grace = addGrace(score, note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '16' })!
    const made = addBracketed(score, grace.pitches[0].id, 'before', { step: 'F', alter: 1, octave: 4 })!
    bracketedToNote(score, made.pitches[0].id)
    expect(grace.pitches.map(p => [p.step, p.alter])).toEqual([['F', 1]])
    expect(grace.duration).toBe('16')
    expect('bracketedBefore' in grace).toBe(false)
  })

  it('the OTHER bracketed graces on the same target stay', () => {
    const { model, score, note } = setup()
    const keep = addBracketed(score, note.id, 'before', { step: 'C', alter: 0, octave: 5 })!
    const go = addBracketed(score, note.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    const id = bracketedToNote(score, go.pitches[0].id)!
    expect(chordOf(model, id).bracketedBefore).toEqual([keep])
  })

  it('⛔ not a bracketed pitch → null, nothing changed', () => {
    const { score, note } = setup()
    expect(bracketedToNote(score, note.id)).toBeNull()
  })
})

describe('graceToBracketed — a selected GRACE pressed (his rule: "the target is what we have to the right")', () => {
  const setup = () => {
    const model = new ScoreModel()
    const score = model.getScore()
    const note = model.addNote({ step: 'D', octave: 5, duration: 'h', measure: 1, beat: frac(1, 1) })
    const graces = (['G', 'A', 'B'] as const).map(step =>
      addGrace(score, note.id, 'before', { step, alter: 0, octave: 4 }, 'acciaccatura', { duration: '8' })!)
    const chord = () => {
      const f = findSlot(score, note.id)
      if (f?.type !== 'chord') throw new Error('expected a chord')
      return f.chord
    }
    return { model, score, note, graces, chord }
  }

  it('⭐ a MIDDLE grace → a bracketed grace before the NEXT grace; the others stay — and the beam splits there', () => {
    const { score, graces, chord } = setup()
    const id = graceToBracketed(score, graces[1].pitches[0].id)!
    expect(id).toBe(graces[1].pitches[0].id)
    expect(chord().graceBefore!.notes).toEqual([graces[0], graces[2]])
    expect(graces[2].bracketedBefore).toEqual([{ pitches: [expect.objectContaining({ step: 'A', octave: 4 })], duration: '8' }])
    expect(graceBeamRuns(chord().graceBefore!.notes)).toEqual([]) // [g1] (●) [g3]: two singles, no beam
    expect(chord().graceBefore!.slash).toBe(true)
  })

  it('⭐ the LAST grace → before the NOTE itself; with brackets already there it stands FIRST, where it stood', () => {
    const { score, note, graces, chord } = setup()
    const existing = addBracketed(score, note.id, 'before', { step: 'C', alter: 0, octave: 5 })!
    graceToBracketed(score, graces[2].pitches[0].id)
    expect(chord().bracketedBefore!.map(b => b.pitches[0].step)).toEqual(['B', 'C'])
    expect(chord().bracketedBefore![1]).toBe(existing)
    expect(chord().graceBefore!.notes).toHaveLength(2)
  })

  it('the brackets bent INTO the grace keep standing in front of it', () => {
    const { score, graces } = setup()
    const into = addBracketed(score, graces[1].pitches[0].id, 'before', { step: 'F', alter: 1, octave: 4 })!
    graceToBracketed(score, graces[1].pitches[0].id)
    expect(graces[2].bracketedBefore![0]).toBe(into)
    expect(graces[2].bracketedBefore![1].pitches[0].step).toBe('A')
  })

  it('a lone grace → the group is gone, the bracketed grace before its note', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const g = addGrace(model.getScore(), note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '16' })!
    graceToBracketed(model.getScore(), g.pitches[0].id)
    const f = findSlot(model.getScore(), note.id)
    expect(f?.type === 'chord' && 'graceBefore' in f.chord).toBe(false)
    expect(f?.type === 'chord' && f.chord.bracketedBefore![0].duration).toBe('16')
  })

  it('⛔ not a grace → null', () => {
    const { score, note } = setup()
    expect(graceToBracketed(score, note.id)).toBeNull()
  })
})

describe('bracketedToGrace — a grace button with a bracketed grace selected (his rule: "maintaining it targets")', () => {
  const setup = () => {
    const model = new ScoreModel()
    const score = model.getScore()
    const note = model.addNote({ step: 'D', octave: 5, duration: 'h', measure: 1, beat: frac(1, 1) })
    const chord = () => {
      const f = findSlot(score, note.id)
      if (f?.type !== 'chord') throw new Error('expected a chord')
      return f.chord
    }
    return { model, score, note, chord }
  }

  it('⭐ its target a GRACE → it joins that grace\'s group just BEFORE it — and RETYPES the group (his rule)', () => {
    const { score, note, chord } = setup()
    const g1 = addGrace(score, note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'acciaccatura', { duration: '8' })!
    const g2 = addGrace(score, note.id, 'before', { step: 'B', alter: 0, octave: 4 }, 'acciaccatura', { duration: '8' })!
    const made = addBracketed(score, g2.pitches[0].id, 'before', { step: 'A', alter: 0, octave: 4 }, undefined, '16')!
    const id = bracketedToGrace(score, made.pitches[0].id, 'appoggiatura')!
    expect(chord().graceBefore!.notes.map(n => n.pitches[0].id)).toEqual([g1.pitches[0].id, id, g2.pitches[0].id])
    expect(chord().graceBefore!.notes[1].duration).toBe('16')
    // The group was an acciaccatura; appoggiatura was pressed — "when the bracket joins the group also
    // transform its type".
    expect('slash' in chord().graceBefore!).toBe(false)
    expect('bracketedBefore' in g2).toBe(false)
  })

  it('⭐ its target the NOTE → the note\'s group, LAST (where it stood); no group yet → a new one of the pressed form', () => {
    const { score, note, chord } = setup()
    const made = addBracketed(score, note.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    const id = bracketedToGrace(score, made.pitches[0].id, 'acciaccatura')!
    expect(chord().graceBefore).toEqual({ notes: [{ pitches: [expect.objectContaining({ id, step: 'B', alter: -1 })], duration: 'q' }], slash: true })
    expect('bracketedBefore' in chord()).toBe(false)
    const g = addGrace(score, note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'acciaccatura', { duration: '8' })!
    const second = addBracketed(score, note.id, 'before', { step: 'C', alter: 0, octave: 5 })!
    const id2 = bracketedToGrace(score, second.pitches[0].id, 'appoggiatura')!
    expect(chord().graceBefore!.notes.map(n => n.pitches[0].id)).toEqual([id, g.pitches[0].id, id2])
    expect('slash' in chord().graceBefore!).toBe(false) // joining an existing group retypes it too
  })

  it('⭐ the picture keeps its ORDER: brackets LEFT of it bend into the new grace, those RIGHT of it stay on the target', () => {
    const { score, note, chord } = setup()
    const left = addBracketed(score, note.id, 'before', { step: 'F', alter: 0, octave: 4 })!
    const it = addBracketed(score, note.id, 'before', { step: 'A', alter: 0, octave: 4 })!
    const right = addBracketed(score, note.id, 'before', { step: 'C', alter: 0, octave: 5 })!
    bracketedToGrace(score, it.pitches[0].id, 'appoggiatura')
    expect(chord().graceBefore!.notes[0].bracketedBefore).toEqual([left])
    expect(chord().bracketedBefore).toEqual([right])
  })

  it('on a REST it joins the rest\'s group — the grace a note taking the rest\'s place will take over', () => {
    const { model, score } = setup()
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    const made = addBracketed(score, rest.id, 'before', { step: 'E', alter: 0, octave: 5 })!
    bracketedToGrace(score, made.pitches[0].id, 'appoggiatura')
    expect(rest.graceBefore?.notes).toHaveLength(1)
    expect('bracketedBefore' in rest).toBe(false)
  })

  it('⛔ not a bracketed pitch → null', () => {
    const { score, note } = setup()
    expect(bracketedToGrace(score, note.id, 'appoggiatura')).toBeNull()
  })
})
