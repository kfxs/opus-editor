// @vitest-environment jsdom
/**
 * The keyboard half of note spacing (docs/note-spacing-plan.md §5, P1) — and above all the FLOOR.
 *
 * A leftward nudge must stop when the column reaches its left neighbour rather than walking
 * through it, and the amount of room left is not something we can compute: it is the formatter's
 * answer, read back off the last render. So the interesting cases here are the ones where the
 * engine has to say "I don't know" — an unrendered bar — and decline instead of inventing a floor.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate } from '@/utils/fraction'
import type { NoteParams } from '@/types/music'

const STEP = 0.25

describe('MusicEngine.nudgeNoteSpacing', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
  })

  const fourQuarters = () => {
    for (const beat of [0, 1, 2, 3]) {
      engine.addNoteAtBeat({
        step: 'C', octave: 4, duration: 'q', measure: 1, beat: fracCreate(beat, 1),
      } as NoteParams)
    }
    engine.renderScore()
  }

  /** One press, exactly as `shortcutWiring` does it: nudge, then repaint. The repaint is not
   *  cosmetic — the floor is measured off the last render, so it is part of the gesture. */
  const press = (beat: ReturnType<typeof fracCreate>, delta: number): number | null => {
    const stored = engine.nudgeNoteSpacing(1, beat, delta)
    engine.renderScore()
    return stored
  }

  it('accumulates: two nudges right are one step twice', () => {
    fourQuarters()
    const beat = fracCreate(2, 1)
    expect(press(beat, STEP)).toBe(STEP)
    expect(press(beat, STEP)).toBe(STEP * 2)
    expect(engine.getNoteSpacing(1, beat)).toBe(STEP * 2)
  })

  it('nudging back to zero clears the entry, not stores a 0', () => {
    fourQuarters()
    const beat = fracCreate(2, 1)
    press(beat, STEP)
    press(beat, -STEP)
    expect(engine.getNoteSpacing(1, beat)).toBe(0)
    expect(JSON.parse(engine.exportJSON()).engravingOverrides ?? {}).toEqual({})
  })

  it('stops at the floor: a column cannot be pulled left through its neighbour', () => {
    fourQuarters()
    const beat = fracCreate(2, 1)
    // Far more leftward pressure than any bar has room for. It must land somewhere finite and
    // stay there, rather than marching negative forever.
    let last = 0
    for (let i = 0; i < 200; i++) last = press(beat, -STEP)!
    const settled = last
    expect(press(beat, -STEP)).toBe(settled)
    expect(settled).toBeLessThan(0)
    expect(Number.isFinite(settled)).toBe(true)
  })

  it('the floor is re-measured, so widening then tightening returns to where it started', () => {
    fourQuarters()
    const beat = fracCreate(2, 1)
    press(beat, 4)
    expect(press(beat, -4)).toBeCloseTo(0, 6)
  })

  it('DECLINES when the room cannot be measured — an unrendered bar has no gaps to read', () => {
    // Notes exist in the model, but nothing has been drawn, so the registry is empty.
    for (const beat of [0, 1]) {
      engine.addNoteAtBeat({
        step: 'C', octave: 4, duration: 'q', measure: 1, beat: fracCreate(beat, 1),
      } as NoteParams)
    }
    expect(engine.nudgeNoteSpacing(1, fracCreate(1, 1), STEP)).toBeNull()
    expect(engine.getNoteSpacing(1, fracCreate(1, 1))).toBe(0)
  })

  it('declines an unknown measure rather than minting a key for it', () => {
    fourQuarters()
    expect(engine.nudgeNoteSpacing(99, fracCreate(0, 1), STEP)).toBeNull()
  })

  it('widening is never blocked — the floor only bounds the LEFT', () => {
    fourQuarters()
    const beat = fracCreate(1, 1)
    for (let i = 0; i < 20; i++) press(beat, STEP)
    expect(engine.getNoteSpacing(1, beat)).toBeCloseTo(STEP * 20, 6)
  })

  it('each press is its own undo step, and undo puts the space back', () => {
    fourQuarters()
    const beat = fracCreate(2, 1)
    press(beat, STEP)
    press(beat, STEP)
    expect(engine.getNoteSpacing(1, beat)).toBe(STEP * 2)
    engine.undo()
    expect(engine.getNoteSpacing(1, beat)).toBe(STEP)
    engine.undo()
    expect(engine.getNoteSpacing(1, beat)).toBe(0)
  })
})

describe('MusicEngine.resetNoteSpacing', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    for (const beat of [0, 1, 2, 3]) {
      engine.addNoteAtBeat({
        step: 'C', octave: 4, duration: 'q', measure: 1, beat: fracCreate(beat, 1),
      } as NoteParams)
    }
    engine.renderScore()
  })

  it('drops the space in one step, however many nudges made it', () => {
    const beat = fracCreate(2, 1)
    for (let i = 0; i < 6; i++) { engine.nudgeNoteSpacing(1, beat, STEP); engine.renderScore() }
    expect(engine.resetNoteSpacing(1, beat)).toBe(true)
    expect(engine.getNoteSpacing(1, beat)).toBe(0)
    engine.undo()
    expect(engine.getNoteSpacing(1, beat)).toBeCloseTo(STEP * 6, 6)
  })

  it('says false when there was nothing to reset, so the key can fall through', () => {
    expect(engine.resetNoteSpacing(1, fracCreate(2, 1))).toBe(false)
  })

  it('resets only the column asked for', () => {
    engine.nudgeNoteSpacing(1, fracCreate(1, 1), STEP); engine.renderScore()
    engine.nudgeNoteSpacing(1, fracCreate(2, 1), STEP); engine.renderScore()
    engine.resetNoteSpacing(1, fracCreate(2, 1))
    expect(engine.getNoteSpacing(1, fracCreate(1, 1))).toBe(STEP)
    expect(engine.getNoteSpacing(1, fracCreate(2, 1))).toBe(0)
  })
})
