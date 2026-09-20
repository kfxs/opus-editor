/**
 * {@link slurSideFromStems} + {@link coveredChordIds} — which side a slur sits on, and which notes
 * get a vote.
 *
 * ⭐ Headless on purpose: the rule is a fact about a list of stem directions, with no stave, no font
 * and no SVG in it. What a browser would have to answer is the *other* half — that the directions
 * handed in are the ones VexFlow actually drew, which is `SlurRenderer`'s job and is covered by the
 * geometry suite.
 */
import { describe, it, expect } from 'vitest'
import { slurSideFromStems, coveredChordIds } from './slurDirection'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { fracCreate as frac } from '@/utils/fraction'

const ABOVE = -1
const BELOW = 1

describe('slurSideFromStems', () => {
  it('⭐ all stems UP → the slur goes BELOW, on the notehead side (Gould)', () => {
    expect(slurSideFromStems([1, 1, 1])).toBe(BELOW)
  })

  it('⭐ all stems DOWN → the slur goes ABOVE, the same rule mirrored', () => {
    expect(slurSideFromStems([-1, -1, -1])).toBe(ABOVE)
  })

  it('⭐⭐ MIXED stems → ABOVE, whichever end the mixture is at', () => {
    // The case the whole module exists for, and the only one where scanning changes the answer:
    // with uniform stems the first note already knew. Three engines fold "all down" and "mixed"
    // together this way — LilyPond `calc_direction`, MuseScore `isDirectionMixture`, Verovio
    // `HasMixedDrawingStemDir` — and so does Gould, p. 110: "When groups of mixed stem direction
    // are encompassed by a slur, place the slur above the stave".
    expect(slurSideFromStems([1, 1, -1])).toBe(ABOVE)
    expect(slurSideFromStems([-1, 1, 1])).toBe(ABOVE)
    expect(slurSideFromStems([1, -1, 1])).toBe(ABOVE)
  })

  it('⭐ THE BUG IT FIXES: the answer no longer depends on which end you sampled', () => {
    // Our old rule read the START note's stem only, so these two spans — the same notes, read from
    // opposite ends — disagreed. A slur's side is not a property of one of its ends.
    const span = [1, 1, -1]
    expect(slurSideFromStems(span)).toBe(slurSideFromStems([...span].reverse()))
  })

  it('skips notes with no stem, rather than counting them as a direction', () => {
    // Whole notes and rests have no stem to be opposite of. LilyPond says so explicitly:
    // `!Note_column::has_rests(col)`.
    expect(slurSideFromStems([0, 1, 0, 1])).toBe(BELOW)
    expect(slurSideFromStems([0, -1])).toBe(ABOVE)
  })

  it('⚠️ no opinion at all → ABOVE — a defence, and unreachable in the real pipeline', () => {
    // ⛔ Do not read this as "our answer for stemless notes". A whole note has no stem DRAWN but
    // still carries a stem DIRECTION, assigned from its pitch by `NoteBuilder`, so the pitch rule
    // (Verovio's `isAboveStaffCenter`, Gould p.110's "as if the notes were stemmed") applies to it
    // for free — `e2e/slur.e2e.ts` measures exactly that. This branch fires only when a covered
    // chord is missing from `staveNoteMap`, i.e. was not rendered at all.
    expect(slurSideFromStems([])).toBe(ABOVE)
    expect(slurSideFromStems([0, 0])).toBe(ABOVE)
  })
})

describe('coveredChordIds', () => {
  /** Four quarter notes in one bar; returns the model and the four chord-head ids in order. */
  const fourNotes = () => {
    const model = new ScoreModel()
    const ids = [0, 1, 2, 3].map(beat =>
      model.addNote({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1) }).id)
    return { model, ids }
  }

  it('⭐ returns every chord the slur arcs over, not just its two ends', () => {
    const { model, ids } = fourNotes()
    const covered = coveredChordIds(model.getScore(), ids[0], ids[3])
    expect(covered).toHaveLength(4)
    expect(covered[0]).toBe(ids[0])
    expect(covered[3]).toBe(ids[3])
  })

  it('…and stops at the slur\'s own ends, not the bar\'s', () => {
    const { model, ids } = fourNotes()
    expect(coveredChordIds(model.getScore(), ids[1], ids[2])).toEqual([ids[1], ids[2]])
  })

  it('⭐ spans a barline, in order', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const first = model.addNote({ step: 'B', octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) }).id
    const second = model.addNote({ step: 'C', octave: 5, duration: 'w', measure: 2, beat: frac(0, 1) }).id
    expect(coveredChordIds(model.getScore(), first, second)).toEqual([first, second])
  })

  it('⛔ ignores the OTHER voice — a slur must not read stems it does not own', () => {
    // Without this a multi-voice bar would look "mixed" to every slur in it. MuseScore scopes the
    // same scan by `c1->track()`.
    const model = new ScoreModel()
    const v0 = [0, 1].map(beat =>
      model.addNote({ step: 'B', octave: 4, duration: 'q', measure: 1, beat: frac(beat, 1), voice: 0 }).id)
    model.addNote({ step: 'D', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const covered = coveredChordIds(model.getScore(), v0[0], v0[1])
    expect(covered).toEqual(v0)
  })

  it('answers nothing — not a side — when an endpoint cannot be found', () => {
    // The caller must treat this as "no opinion" and fall back; returning a side here would be a
    // guess dressed as an answer.
    const { model, ids } = fourNotes()
    expect(coveredChordIds(model.getScore(), ids[0], 'no-such-note')).toEqual([])
  })
})
