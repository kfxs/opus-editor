/**
 * ⭐⭐ **AN OCTAVE LINE SOUNDS** (docs/ottava-plan.md §6, P2) — the notehead stays where it is and
 * the ear hears it an octave away.
 *
 * The RESOLUTION rules (half-open span, per staff, which of two overlapping lines wins) are
 * `utils/soundingShift.test.ts`'s. What is asked here is the thing that plan calls the trap:
 * `playbackSchedule` derives a MIDI number on **three independent emit paths**, and shifting some
 * of them is a silent octave bug in the others. So every path gets its own test —
 *
 * ⚠️ **and each one is written to fail if only the plain-chord path were shifted**, because that is
 * the bug this chapter exists to catch. A trill under an 8va alternating between a shifted main and
 * an unshifted auxiliary is the worst of them: it would still trill, still fill the note, still
 * sound *musical*, and be a tenth wide.
 */
import { describe, it, expect } from 'vitest'
import type { Score } from '@/types/music'
import { ScoreModel } from '../models/ScoreModel'
import { addOttava } from '../models/ottavaOps'
import { collectScheduledNotes } from './playbackSchedule'
import { fracCreate as frac } from '@/utils/fraction'

const C4 = 60, C5 = 72, C6 = 84, C3 = 48, D5 = 74, E5 = 76, G5 = 79

/** Wire a same-pitch tie `fromId`→`toId` directly on the score (`playbackSchedule.test.ts`'s helper —
 *  a tie is two pointers on the pitches, and there is no single model call for it). */
function tie(score: Score, fromId: string, toId: string): void {
  for (const m of score.measures) {
    for (const s of m.slots) {
      if (s.type !== 'chord') continue
      for (const n of s.notes) {
        if (n.id === fromId) n.tiedTo = toId
        if (n.id === toId) n.tiedFrom = fromId
      }
    }
  }
}

/** The distinct midis sounded, in first-onset order. */
const midis = (score: Score) =>
  [...new Set(collectScheduledNotes(score).sort((a, b) => a.startBeats - b.startBeats).map(e => e.midi))]

describe('a passage under an octave line plays an octave away', () => {
  it('⭐ an 8va sounds C4 as C5 — the stored pitch never moved', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    addOttava(model.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })

    expect(midis(model.getScore())).toEqual([C5])
    // ⭐ The written pitch is untouched — that is the whole design (docs/ottava-plan.md §2).
    expect(model.getNote(note.id)!.octave).toBe(4)
  })

  it('an 8vb sounds it as C3, and a 15ma as C6', () => {
    for (const [shift, expected] of [[-1, C3], [2, C6]] as const) {
      const model = new ScoreModel()
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
      addOttava(model.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1), shift })
      expect(midis(model.getScore())).toEqual([expected])
    }
  })

  it('shifts only the notes it COVERS — the bar goes back to normal after it', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    addOttava(model.getScore(), 1, { beat: frac(0, 1), length: frac(2, 1), shift: 1 })

    expect(midis(model.getScore())).toEqual([C5, C4])
  })

  it('leaves a score with no octave line exactly as it was', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    expect(midis(model.getScore())).toEqual([C4])
  })
})

/**
 * The three emit paths. ⚠️ Each of these would pass with the shift applied to the plain-chord path
 * alone if it asserted only "something sounded" — so each asserts the SET of pitches, which is the
 * only thing that can tell a shifted attack from an unshifted one.
 */
describe('every re-attack pattern is shifted too — the three emit paths', () => {
  it('⭐⭐ a TRILL inside an 8va trills in the new octave — BOTH notes, not just the main one', () => {
    // docs/ottava-plan.md §6 names `auxiliaryMidiFor` as the site that fails silently. Unshifted, the
    // auxiliary would be D4 (62) against a main of C5 (72) — a ninth, and still audibly "a trill".
    const model = new ScoreModel()
    const note = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.addTrill({ startNoteId: note.id })
    addOttava(model.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })

    // C5 written → C6/D6 sounding. The auxiliary is derived from the WRITTEN neighbour (D5) and
    // shifted after, so the alternation stays a whole tone.
    expect(new Set(midis(model.getScore()))).toEqual(new Set([C6, 86]))
  })

  it('a TREMOLO inside an 8va re-attacks the shifted pitch', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.setTremolo(note.id, 3)
    addOttava(model.getScore(), 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })

    const played = collectScheduledNotes(model.getScore())
    expect(played.length, 'a tremolo is many attacks').toBeGreaterThan(2)
    expect(new Set(played.map(e => e.midi))).toEqual(new Set([C5]))
  })

  it('⭐ a FANNED BEAM inside an 8va — every member, not just the slot\'s own pitch', () => {
    // The fan emits from `collectFanAttacks`, a path of its own that never touches the chord loop.
    const model = new ScoreModel()
    const note = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, { direction: 'accel', count: 3, beams: 2 })
    addOttava(model.getScore(), 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })

    const played = collectScheduledNotes(model.getScore())
    expect(played.length, 'three members sound').toBe(3)
    expect(new Set(played.map(e => e.midi))).toEqual(new Set([C6]))
  })

  it('⭐ a TWO-NOTE TREMOLO takes EACH SIDE\'s own shift — a line may start between the pair', () => {
    // The pair path resolves two slots, so it takes the MAP rather than one number. Here the 8va
    // starts on the second note: the first must sound written, the second an octave up.
    const model = new ScoreModel()
    const a = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.setTremolo(a.id, 3)
    model.setTremoloPair(a.id, true)
    addOttava(model.getScore(), 1, { beat: frac(2, 1), length: frac(2, 1), shift: 1 })

    const sounded = new Set(collectScheduledNotes(model.getScore()).map(e => e.midi))
    expect(sounded.has(C5), 'the first note is outside the line').toBe(true)
    expect(sounded.has(G5 + 12), 'the second note is inside it').toBe(true)
    expect(sounded.has(G5), 'and must NOT sound unshifted').toBe(false)
  })
})

describe('what the octave line must NOT change', () => {
  it('⛔ a TIE across the line\'s start is still one held note — the comparison is un-shifted', () => {
    // `sameMidi` compares WRITTEN pitches, deliberately. Shifting only the side that falls under the
    // bracket would break the chain here and re-attack where the notation says one held note.
    const model = new ScoreModel()
    model.addMeasure()
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })
    tie(model.getScore(), a.id, b.id)
    addOttava(model.getScore(), 1, { beat: frac(4, 1), length: frac(4, 1), shift: 1 })

    const played = collectScheduledNotes(model.getScore())
    expect(played, 'ONE attack, not two').toHaveLength(1)
    expect(played[0].durationBeats, 'and it holds through both bars').toBeCloseTo(8, 6)
  })

  it('shifts the SOUND only — nothing in the model moved', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    addOttava(model.getScore(), 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })

    const stored = model.getNote(note.id)!
    expect([stored.step, stored.octave, stored.alter]).toEqual(['E', 5, 0])
    expect(midis(model.getScore())).toEqual([E5 + 12])
  })

  it('governs the staff it is ON — the other staff plays as written', () => {
    const model = new ScoreModel()
    const lower = model.addStaffBelow(0)
    model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'w', measure: 1, beat: frac(0, 1), staff: 0 })
    model.addNote({ step: 'D', alter: 0, octave: 5, duration: 'w', measure: 1, beat: frac(0, 1), staff: 1 })
    addOttava(model.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1, staffId: lower })

    const sounded = new Set(collectScheduledNotes(model.getScore()).map(e => e.midi))
    expect(sounded).toEqual(new Set([C5, D5 + 12]))
  })
})
