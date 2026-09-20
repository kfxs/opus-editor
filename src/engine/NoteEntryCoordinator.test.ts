import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NoteEntryCoordinator } from './NoteEntryCoordinator'
import { ScoreModel } from './models/ScoreModel'
import { CollisionDetector } from './models/CollisionDetector'
import { CoordinateMapper } from './rendering/CoordinateMapper'
import { ElementRegistry } from './ElementRegistry'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { durationToFraction, slotLength } from '@/utils/durations'
import { staffIndexOfId } from './models/staffContent'
import type { NoteDuration } from '@/types/music'
import { tupletSpan, tupletSlotDuration } from '@/utils/musicUtils'

function makeCoordinator(scoreModel: ScoreModel) {
  const coordinateMapper = new CoordinateMapper({
    measureWidth: 240, staffHeight: 150, startX: 20, startY: 20,
    measuresPerLine: 4, lineSpacing: 10, measureLeftMargin: 100,
  })
  const collisionDetector = new CollisionDetector()
  const elementRegistry = new ElementRegistry()
  const onCommit = vi.fn()
  return new NoteEntryCoordinator(
    () => scoreModel,
    coordinateMapper,
    collisionDetector,
    elementRegistry,
    onCommit,
  )
}

/** The chain and the erosion are `models/spanningNoteOps`; this pins that ENTRY reaches them. */
describe('NoteEntryCoordinator.addNoteAtBeat — an overflowing note is split and the next bar eroded', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    scoreModel.addMeasure()
    coordinator = makeCoordinator(scoreModel)
  })

  it('erodes via addNoteAtBeat (addSplitNoteWithTie path)', () => {
    // Same headline scenario but triggered via addNoteAtBeat (new note entry)
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(2, 1) })

    // Fill M1 so beat 2 is a rest: add notes at 0 and 1
    scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    // Enter E4 dotted-half (3 beats) at beat 2 — overflow 1 beat, should erode G4h → G4q
    coordinator.addNoteAtBeat({
      step: 'E', alter: 0, octave: 4, duration: 'h', dots: 1, measure: 1, beat: frac(2, 1),
    })

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    const g4 = m2NonRest.find(n => n.step === 'G')
    expect(g4).toBeDefined()
    expect(g4!.duration).toBe('q')
    expect(fracToNumber(g4!.beat)).toBeCloseTo(1)
  })
})

describe('NoteEntryCoordinator — tuplet in a secondary voice', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
  })

  const voiceSlots = (model: ScoreModel, measure: number, voice: number) =>
    model.getNotesInMeasure(measure).filter(n => (n.voice ?? 0) === voice)

  it('applies a tuplet to a voice-2 note without touching voice 1', () => {
    // Voice 0 (UI voice 1) gets a quarter at beat 0, then a voice-1 quarter at beat 0.
    coordinator.addNoteAtBeat({ step: 'B', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const v2Note = coordinator.addNoteAtBeat({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!

    const v0Before = voiceSlots(scoreModel, 1, 0).length
    const result = coordinator.applyTupletToNote(v2Note.id)
    expect(result).not.toBeNull()

    // Every slot in the new tuplet is voice 1.
    const tupletSlots = scoreModel.getNotesInTuplet(result!.tuplet.id)
    expect(tupletSlots.length).toBeGreaterThan(0)
    expect(tupletSlots.every(n => (n.voice ?? 0) === 1)).toBe(true)

    // Voice 0 is untouched by the voice-1 tuplet.
    expect(voiceSlots(scoreModel, 1, 0).length).toBe(v0Before)
    expect(voiceSlots(scoreModel, 1, 0).some(n => !n.isRest && n.step === 'B')).toBe(true)
  })

  it('keeps every slot of a voice-2 tuplet in voice 2 after adding a note inside it', () => {
    // A voice-1 (UI voice 2) triplet, then add a second note inside it.
    const tuplet = scoreModel.createTuplet(1, frac(0, 1), '8', 3, 2, 1)
    scoreModel.refillTupletRemainder(1, tuplet, 1)
    coordinator.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 3), voice: 1 })

    // No slot of this tuplet may leak into voice 0 — a mixed-voice tuplet is what
    // scattered the bracket across both voices and made VexFlow throw on a
    // negative bracket width.
    const tupletSlots = scoreModel.getNotesInTuplet(tuplet.id)
    expect(tupletSlots.length).toBeGreaterThan(0)
    expect(tupletSlots.every(n => (n.voice ?? 0) === 1)).toBe(true)
  })

  it('refuses to create a tuplet whose span overlaps an existing same-voice tuplet', () => {
    // First triplet spans beats 0–1.
    const first = coordinator.createTupletAtBeat(1, 0, '8', { step: 'C', alter: 0, octave: 5 })
    expect(first).not.toBeNull()

    // A second triplet starting at beat 0.5 would span 0.5–1.5 and collide with
    // the first — even though beat 0.5 isn't the first tuplet's start beat.
    const second = coordinator.createTupletAtBeat(1, 0.5, '8', { step: 'A', alter: 0, octave: 4 })
    expect(second).toBeNull()

    // Only the original tuplet survives.
    expect(scoreModel.getMeasure(1)!.tuplets!.length).toBe(1)
  })
})

/**
 * A tuplet whose UNIT is dotted — three DOTTED quarters in the time of two of them.
 *
 * The dot has to reach the span, and the span is what every other decision is made against: the
 * bar-fit check, the overlap check, the rebar event, the filler rests. Drop it at one site and the
 * group is computed a third short, which surfaces as a rebar or overflow bug three layers away and
 * never as "the dot went missing".
 */
describe('NoteEntryCoordinator — dotted tuplet unit', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
  })

  it('spans two DOTTED quarters (= 3 beats), not two plain ones', () => {
    const result = coordinator.createTupletAtBeat(1, 0, 'q', { step: 'C', alter: 0, octave: 5 }, 3, 2, 0, 0, 1)
    expect(result).not.toBeNull()
    expect(result!.tuplet.baseDots).toBe(1)

    // 2 × dotted quarter = 3 quarter-beats. Undotted, this would have been 2 — the silent failure.
    const span = tupletSpan(result!.tuplet)
    expect(fracToNumber(span)).toBe(3)

    // Each written note is a DOTTED quarter sounding × 2/3 — one plain quarter.
    const notes = scoreModel.getNotesInTuplet(result!.tuplet.id)
    expect(notes.length).toBe(3)
    expect(notes.every(n => n.duration === 'q' && n.dots === 1)).toBe(true)
    expect(notes.map(n => fracToNumber(n.beat))).toEqual([0, 1, 2])
  })

  it('refuses one that no longer fits the bar once the dot is counted', () => {
    // 3 dotted HALVES in the time of 2 = 6 quarter-beats, past the end of a 4/4 bar. Without the dot
    // the span reads as 4 and it would have been accepted, overfilling the measure.
    const tooBig = coordinator.createTupletAtBeat(1, 0, 'h', { step: 'C', alter: 0, octave: 5 }, 3, 2, 0, 0, 1)
    expect(tooBig).toBeNull()
    expect(scoreModel.getMeasure(1)!.tuplets ?? []).toHaveLength(0)
  })

  it('takes the dots off the NOTE when a dotted note is turned into a tuplet', () => {
    const dotted = coordinator.addNoteAtBeat({ step: 'B', alter: 0, octave: 4, duration: 'q', dots: 1, measure: 1, beat: frac(0, 1) })!
    const result = coordinator.applyTupletToNote(dotted.id)
    expect(result).not.toBeNull()
    expect(result!.tuplet.baseDots).toBe(1)
  })

  it('leaves baseDots absent when there is no dot, so old scores serialize unchanged', () => {
    const plain = coordinator.createTupletAtBeat(1, 0, '8', { step: 'C', alter: 0, octave: 5 })
    expect('baseDots' in plain!.tuplet).toBe(false)
  })
})

/**
 * REMEMBERING what the user typed — "5 sixteenths in the time of ONE QUARTER".
 *
 * The ratio is unchanged and stays in the ACTUAL value (5:4 — four sixteenths). `normalDuration` is
 * a record of the other half of the sentence, which the ratio cannot say and a mark that prints the
 * note value needs. It is NOT arithmetic.
 */
describe('NoteEntryCoordinator — the typed normal side is remembered', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
  })

  const normalOf = (duration: NoteDuration, dots?: number) => ({ duration, dots })

  it('keeps the quarter the user named, without touching the ratio', () => {
    // 5 sixteenths in the time of one quarter — which IS 5:4, and must stay 5:4.
    const result = coordinator.createTupletAtBeat(
      1, 0, '16', { step: 'C', alter: 0, octave: 5 }, 5, 4, 0, 0, 0, normalOf('q'),
    )
    expect(result).not.toBeNull()
    const t = result!.tuplet
    expect(t.numNotes).toBe(5)
    expect(t.notesOccupied).toBe(4)      // ← unchanged: four SIXTEENTHS
    expect(t.normalDuration).toBe('q')   // ← the sentence the user typed
    expect(fracToNumber(tupletSpan(t))).toBe(1)
    expect(fracToNumber(tupletSlotDuration(t))).toBeCloseTo(0.2)
  })

  it('keeps ALL SIX typed values beside the ratio, so the sentence can be rebuilt', () => {
    // Typed: "5 quarters in the time of 8 eighths". Eight eighths is four quarters, so the RATIO is
    // 5:4 — and 5:4 cannot say whether the user said "4 quarters" or "8 eighths".
    const result = coordinator.createTupletAtBeat(
      1, 0, 'q', { step: 'C', alter: 0, octave: 5 }, 5, 4, 0, 0, 0, { duration: '8', count: 8 },
    )
    const t = result!.tuplet

    // The ratio: unchanged, in the tuplet's own value.
    expect([t.numNotes, t.notesOccupied]).toEqual([5, 4])
    // The entry: N, its value, its dots | M, its value, its dots — all six readable back.
    expect([t.numNotes, t.baseDuration, t.baseDots]).toEqual([5, 'q', undefined])
    expect([t.normalCount, t.normalDuration, t.normalDots]).toEqual([8, '8', undefined])
  })

  it('changes no arithmetic — the same tuplet with and without the record spans the same', () => {
    const withRecord = coordinator.createTupletAtBeat(
      1, 0, '16', { step: 'C', alter: 0, octave: 5 }, 5, 4, 0, 0, 0, normalOf('q'),
    )!.tuplet
    const bare = { numNotes: 5, notesOccupied: 4, baseDuration: '16' as NoteDuration }
    expect(tupletSpan(withRecord)).toEqual(tupletSpan(bare))
    expect(tupletSlotDuration(withRecord)).toEqual(tupletSlotDuration(bare))
  })

  // The clamp asks "how much can still be WRITTEN in here", which is the remaining span ÷ the
  // tuplet's ratio. N/M is the same number only while both sides share a note value: here the
  // sentence is "2 quarters in the time of 3 eighths", N/M = 1 and the real scale is 3/4, so a clamp
  // by N/M would allow a quarter less than the group actually has room for.
  it('clamps by the tuplet RATIO, not by N/M, when the two sides differ', () => {
    const t = coordinator.createTupletAtBeat(
      1, 0, 'q', { step: 'C', alter: 0, octave: 5 }, 2, 2, 0, 0, 0, { duration: '8', count: 3 },
    )!.tuplet
    // One and a half quarters of span, one quarter written and sounding 3/4 — so 3/4 of a quarter of
    // span is left, and what still FITS written is a quarter (3/4 ÷ 3/4). A half would not.
    const second = coordinator.addNoteAtBeat({
      step: 'D', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(3, 4), tupletId: t.id,
    })
    expect(second).not.toBeNull()
    expect(second!.duration).toBe('q')
  })

  it('leaves normalDuration absent when both sides agree, so old tuplets are unchanged', () => {
    const plain = coordinator.createTupletAtBeat(1, 0, '8', { step: 'C', alter: 0, octave: 5 })
    expect('normalDuration' in plain!.tuplet).toBe(false)
    // …and absent still MEANS "the same value": a plain triplet of eighths spans two eighths.
    expect(fracToNumber(tupletSpan(plain!.tuplet))).toBe(1)
  })
})

/**
 * The rest stamp's click. It is NOTE ENTRY with `isRest`, and the point of these tests is that it
 * behaves like it: a click anywhere in the bar places a rest at that beat, replacing what it covers.
 * The first build hit-tested the glyph instead (`findClosestNoteOrRest`), so every click in open
 * space did nothing and you had to land on the default rest — the bug that produced this shape.
 */
describe('NoteEntryCoordinator.addRestAtPosition', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
  })

  // The harness's CoordinateMapper: measure 1 starts at x=20 with a 100px left margin, 240 wide.
  // A click in the middle of the bar is open space — no glyph under it, which is the whole point.
  const clickInBar1 = (x: number) => ({ x, y: 60 })

  it('places a rest from a click in OPEN SPACE — no glyph needed', () => {
    const rest = coordinator.addRestAtPosition(clickInBar1(200), 'q', 0)
    expect(rest).not.toBeNull()
    expect(rest!.isRest).toBe(true)
    expect(rest!.duration).toBe('q')
    expect(rest!.measure).toBe(1)
  })

  it('places the ARMED length, not the length of what it lands on', () => {
    const rest = coordinator.addRestAtPosition(clickInBar1(140), 'h', 0)
    expect(rest!.duration).toBe('h') // the empty bar held a WHOLE measure rest
  })

  it('carries the armed DOTS', () => {
    const rest = coordinator.addRestAtPosition(clickInBar1(140), 'q', 1)
    expect(rest!.duration).toBe('q')
    expect(rest!.dots).toBe(1)
  })

  it('leaves the bar exactly full — the rest it lands on is replaced, not stacked on', () => {
    coordinator.addRestAtPosition(clickInBar1(140), 'q', 0)
    // The rest branch of addNote does not fill gaps (it is often the FILLER's own caller — see
    // evictRestsOverlapping); the render's repair closes them, so do what the render does. The
    // integrity check inside it THROWS under Vitest, so an overfull bar fails here regardless.
    scoreModel.repairAllMeasureGaps()
    const m1 = scoreModel.getMeasure(1)!
    const total = m1.slots.reduce(
      (acc, s) => acc + fracToNumber(s.actualDuration ?? durationToFraction(s.duration, s.dots ?? 0)), 0)
    expect(total).toBe(4) // 4/4 — not 5, which is what stacking would give
  })

  it('replaces the NOTE it lands on', () => {
    const note = coordinator.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    coordinator.addRestAtPosition(clickInBar1(125), 'q', 0)
    expect(scoreModel.getNote(note.id)).toBeFalsy()
  })
})

/**
 * A tuplet cannot cross a barline. The trap is that the SPAN, not the written duration, is what must
 * fit: a triplet of halves is three notes in the time of two halves = four quarter-beats.
 */
/**
 * 🐛 `docs/history/vexflow-removal-map.md` §9.4 #7 — a note entered on one staff JOINED a tuplet on ANOTHER
 * staff at that beat: the tuplet lookup was scoped to the entry VOICE and never to its STAFF, so a
 * top-staff triplet claimed a bottom-staff quarter, which then sounded ⅔ of a beat and left its bar
 * short. Found by S13a's random-score probe (all 18 of its integrity failures were this).
 */
describe('NoteEntryCoordinator — a tuplet governs only its own STAFF', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    scoreModel.addStaff(0, 'below')
    const tuplet = scoreModel.createTuplet(1, frac(0, 1), '8', 3, 2, 0, 0)!
    scoreModel.refillTupletRemainder(1, tuplet)
    coordinator = makeCoordinator(scoreModel)
  })

  const bottomStaffNotes = () => scoreModel.getNotesInMeasure(1).filter(n => (n.staff ?? 0) === 1)

  it('⭐ a quarter entered on the BOTTOM staff under a top-staff triplet is a plain quarter', () => {
    const note = coordinator.addNoteAtBeat({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })
    expect(note, 'the entry was placed').not.toBeNull()
    expect(note!.tupletId, 'it must not join the other staff’s triplet').toBeUndefined()
    // ⚠️ Summed by hand, SOUNDING lengths (`slotLength` — a tuplet member's `actualDuration`):
    // `validateMeasure` predates staves and lumps both staves' voice 0 together.
    const score = scoreModel.getScore()
    const bottomSlots = scoreModel.getMeasure(1)!.slots.filter(sl => staffIndexOfId(score, sl.staffId) === 1)
    const beats = bottomSlots.reduce((sum, sl) => sum + fracToNumber(slotLength(sl)), 0)
    expect(beats, 'the bottom staff still fills its bar — before the fix it came ⅔ of a beat short').toBe(4)
  })

  it('🚨 …while the TOP staff’s own entry still joins its triplet — the scoping, not the feature, changed', () => {
    const note = coordinator.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1), staff: 0 })
    expect(note!.tupletId, 'an entry inside its own staff’s tuplet joins it').toBeDefined()
    expect(bottomStaffNotes().every(n => n.tupletId === undefined)).toBe(true)
  })
})
