/**
 * PLACING A SLOT — {@link evictRestsOverlapping} / {@link replaceRestsWithChord} /
 * {@link evictRestsOverlappingChord}, the sounding length they measure with
 * ({@link computeActualDurationForSlot}), and {@link insertPitch}. Asked DIRECTLY of a real score's
 * measure; `ScoreModel.addNote`'s own spec still covers the same rules from the outside, and
 * `voiceOps.test.ts` covers `insertPitch` through a voice move. (Code-shape plan, Phase 4.3c.)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Chord, Measure, Rest } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { ScoreModel } from './ScoreModel'
import { restHiddenOf, restPositionKey } from './engravingOverrides'
import {
  computeActualDurationForSlot, evictRestsOverlapping, evictRestsOverlappingChord, insertPitch,
  replaceRestsWithChord,
} from './slotPlacementOps'

describe('slotPlacementOps', () => {
  let model: ScoreModel
  let bar: Measure
  beforeEach(() => {
    model = new ScoreModel('Place') // 4/4: one whole measure rest
    bar = model.getMeasure(1)!
  })

  const shape = (pred: (s: Measure['slots'][number]) => boolean = () => true) =>
    [...bar.slots].filter(pred).sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
      .map(s => `${s.type === 'rest' ? 'r' : 'n'}${s.duration}@${fracToNumber(s.beat)}`)
  const chordAt = (beat: number, duration: Chord['duration'], over: Partial<Chord> = {}): Chord => ({
    id: `chord-${beat}`, type: 'chord', beat: frac(beat, 1), duration, measure: 1,
    notes: [{ id: `p-${beat}`, step: 'C', alter: 0, octave: 4 }], ...over,
  })

  describe('computeActualDurationForSlot', () => {
    it('a MEASURE REST is as long as its bar, whatever its glyph says', () => {
      const bar34 = { ...bar, timeSignature: { numerator: 3, denominator: 4 } } as Measure
      expect(fracToNumber(computeActualDurationForSlot({ duration: 'w', isMeasureRest: true }, bar34))).toBe(3)
    })

    it('a tuplet member sounds its written length × the tuplet\'s scale; anything else, as written', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      expect(computeActualDurationForSlot({ duration: '8', tupletId: tuplet.id }, bar)).toEqual(frac(1, 3))
      expect(fracToNumber(computeActualDurationForSlot({ duration: 'q', dots: 1 }, bar))).toBe(1.5)
    })
  })

  describe('evictRestsOverlapping — evicts, and deliberately does NOT fill', () => {
    it('takes the same-voice rests the span covers and leaves the hole for the caller', () => {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) }) // nq@0 rq@1 rh@2
      evictRestsOverlapping(model.getScore(), bar, chordAt(1, 'h'))
      expect(shape()).toEqual(['nq@0']) // rq@1 and rh@2 both overlapped [1,3); nothing refilled
    })

    it('never another voice\'s or another staff\'s rests', () => {
      model.addStaffBelow(0)
      model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
      const others = shape(s => s.type === 'rest' && (s.voice === 1 || s.staffId !== undefined))
      evictRestsOverlapping(model.getScore(), bar, chordAt(0, 'w'))
      expect(shape(s => s.type === 'rest' && (s.voice === 1 || s.staffId !== undefined))).toEqual(others)
    })

    it('a tie that pointed AT an evicted rest moves onto what replaces it', () => {
      const src = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const rest = bar.slots.find((s): s is Rest => s.type === 'rest' && fracToNumber(s.beat) === 1)!
      model.updateNote(src.id, { tiedTo: rest.id })
      rest.tiedFrom = src.id

      const incoming = chordAt(1, 'q')
      evictRestsOverlapping(model.getScore(), bar, incoming)

      expect(model.getNote(src.id)!.tiedTo).toBe(incoming.notes[0].id)
      expect(incoming.notes[0].tiedFrom).toBe(src.id)
    })

    it('answers the tupletId of a replaced tuplet rest', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      model.refillTupletRemainder(1, tuplet)
      expect(evictRestsOverlapping(model.getScore(), bar, chordAt(0, '8'))).toBe(tuplet.id)
    })

    it('⭐ a NOTE takes the rest\'s HIDDEN flag with it; a rest replacing a rest does not', () => {
      const key = () => restPositionKey(bar.id, 0, frac(0, 1), undefined)
      const hide = () => model.setEngravingOverride(key(), { kind: 'restHidden' })

      hide()
      evictRestsOverlapping(model.getScore(), bar, { id: 'r', type: 'rest', beat: frac(0, 1), duration: 'q', measure: 1 })
      expect(restHiddenOf(model.getScore(), key())).toBe(true)

      model.fillMeasureGaps(1)
      evictRestsOverlapping(model.getScore(), bar, chordAt(0, 'q'))
      expect(restHiddenOf(model.getScore(), key())).toBe(false)
    })
  })

  it('replaceRestsWithChord places the chord, refills around it, and leaves the bar in beat order', () => {
    replaceRestsWithChord(model.getScore(), bar, chordAt(1, 'q'))
    expect(shape()).toEqual(['rq@0', 'nq@1', 'rh@2'])
    expect(bar.slots.map(s => fracToNumber(s.beat))).toEqual([0, 1, 2])
  })

  it('evictRestsOverlappingChord: a chord that GREW in place takes the rests it now covers', () => {
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const chord = bar.slots.find((s): s is Chord => s.type === 'chord')!
    chord.duration = 'h'
    chord.actualDuration = computeActualDurationForSlot(chord, bar)
    evictRestsOverlappingChord(model.getScore(), bar, chord)
    expect(shape()).toEqual(['nh@0', 'rh@2'])
    expect(model.getNote(note.id)).toBeTruthy()
  })

  describe('insertPitch — the supplied pitch id is KEPT', () => {
    const payload = (over = {}) => ({
      id: 'kept-id', step: 'G' as const, alter: 0 as const, octave: 4, duration: 'q' as const,
      beat: frac(0, 1), voice: 0, ...over,
    })

    it('into an empty lane: a new chord, rests replaced, the bar full', () => {
      insertPitch(model.getScore(), bar, payload())
      expect(model.getNote('kept-id')).toMatchObject({ step: 'G' })
      expect(shape()).toEqual(['nq@0', 'rq@1', 'rh@2'])
    })

    it('onto a chord at that beat and lane: merged, and the SHORTER duration wins', () => {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
      insertPitch(model.getScore(), bar, payload({ duration: 'q' }))
      const chord = bar.slots.find((s): s is Chord => s.type === 'chord')!
      expect(chord.notes.map(n => n.id)).toContain('kept-id')
      expect(chord.duration).toBe('q')
      model.repairAllMeasureGaps() // the freed beat was reclaimed as a rest
    })
  })
})
