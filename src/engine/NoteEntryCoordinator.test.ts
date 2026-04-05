import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NoteEntryCoordinator } from './NoteEntryCoordinator'
import { ScoreModel } from './models/ScoreModel'
import { CollisionDetector } from './models/CollisionDetector'
import { CoordinateMapper } from './rendering/CoordinateMapper'
import { ElementRegistry } from './ElementRegistry'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

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

describe('NoteEntryCoordinator.splitExistingNoteWithTie', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test', 120)
    // Ensure we have 2 measures
    scoreModel.addMeasure()
    coordinator = makeCoordinator(scoreModel)
  })

  it('splits a note at beat 0 into the next measure (basic case)', () => {
    // Add a quarter note at beat 0 in measure 1
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    // Request a whole note (4 beats) — only 4 available but note is at beat 0, so no overflow...
    // Let's put it at beat 2 so 2 beats remain, then request a whole note (4 beats) → overflow 2 beats
    scoreModel.deleteNote(note.id)
    const note2 = scoreModel.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    coordinator.splitExistingNoteWithTie(note2, 'w', 2) // whole = 4b, available = 2b, overflow = 2b

    const m1Notes = scoreModel.getNotesInMeasure(1).filter(n => !n.isRest)
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)

    // Current measure: 2 beats remaining → half note
    expect(m1Notes).toHaveLength(1)
    expect(m1Notes[0].duration).toBe('h')
    expect(m1Notes[0].step).toBe('E')

    // Next measure: 2 beats → half note
    expect(m2Notes).toHaveLength(1)
    expect(m2Notes[0].duration).toBe('h')
    expect(m2Notes[0].step).toBe('E')

    // Tied together
    expect(m1Notes[0].tiedTo).toBe(m2Notes[0].id)
    expect(m2Notes[0].tiedFrom).toBe(m1Notes[0].id)
  })

  it('handles multi-duration split in the current measure (bug fix: 3 beats remaining)', () => {
    // Note at beat 1 in 4/4 → 3 beats remain. Request whole (4 beats) → overflow = 1 beat
    // currentMeasureDurations(3) = ['h', 'q'], nextMeasureDurations(1) = ['q']
    const note = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    coordinator.splitExistingNoteWithTie(note, 'w', 1) // overflow = 1 beat

    const m1Notes = scoreModel.getNotesInMeasure(1).filter(n => !n.isRest && n.step === 'G')
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest && n.step === 'G')

    // 3 beats in current measure: half (2b) + quarter (1b)
    expect(m1Notes).toHaveLength(2)
    expect(m1Notes[0].duration).toBe('h')
    expect(m1Notes[1].duration).toBe('q')

    // 1 beat in next measure: quarter
    expect(m2Notes).toHaveLength(1)
    expect(m2Notes[0].duration).toBe('q')

    // Full tie chain: half → quarter (same measure) → quarter (next measure)
    expect(m1Notes[0].tiedTo).toBe(m1Notes[1].id)
    expect(m1Notes[1].tiedFrom).toBe(m1Notes[0].id)
    expect(m1Notes[1].tiedTo).toBe(m2Notes[0].id)
    expect(m2Notes[0].tiedFrom).toBe(m1Notes[1].id)
  })

  it('creates the next measure automatically if it does not exist', () => {
    // ScoreModel starts with 1 measure; remove the extra one we added
    const freshModel = new ScoreModel('Test', 120)
    const freshCoord = makeCoordinator(freshModel)
    expect(freshModel.getScore().measures).toHaveLength(1)

    const note = freshModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    freshCoord.splitExistingNoteWithTie(note, 'w', 2)

    expect(freshModel.getScore().measures).toHaveLength(2)
    const m2Notes = freshModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2Notes).toHaveLength(1)
  })

  it('displaces existing content in the next measure (MuseScore-style)', () => {
    // Pre-fill measure 2 with a quarter note
    scoreModel.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })

    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    coordinator.splitExistingNoteWithTie(note, 'w', 2) // overflow 2 beats into m2

    // The D in measure 2 should be gone; the tied C continuation should be there instead
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2Notes.every(n => n.step !== 'D')).toBe(true)
    expect(m2Notes.some(n => n.step === 'C')).toBe(true)
  })
})
