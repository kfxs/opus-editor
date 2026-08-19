import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { marksInBox, markItems, marksLabel } from './enclosedMarks'
import { buildClipboardFromSelection } from './clipboard'
import { fracCreate as frac } from '../utils/fraction'
import { levelToGlyphString } from '../utils/dynamics'

/**
 * WHAT A PASSAGE BOX DRAGS ALONG.
 *
 * Subject: {@link enclosedMarks}, sitting beside this file. Real engine, stubbed renderer/playback —
 * enclosure is a MODEL question, and the last case is the point of the module: what the box
 * highlights and what its COPY carries have to be the same marks.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('marksInBox', () => {
  let engine: MusicEngine
  let bar1: string[]
  let bar2: string[]

  /** The kinds pulled in, sorted — identity of the ids is checked case by case. */
  const kinds = (ids: string[]) => marksInBox(engine.getScore(), ids).map(i => i.kind).sort()

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    const fill = (measure: number) => (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure, beat: frac(i, 1) })!.id)
    bar1 = fill(1)
    bar2 = fill(2)
  })

  it('takes a dynamic sitting under the notes', () => {
    const id = engine.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('f'), voice: 0 })!.id
    expect(marksInBox(engine.getScore(), bar1)).toEqual([{ kind: 'dynamic', id }])
  })

  it('⭐ takes a HAIRPIN that starts and ends inside the box', () => {
    const id = engine.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(4, 1), voice: 0 })!.id
    expect(marksInBox(engine.getScore(), bar1)).toEqual([{ kind: 'hairpin', id }])
  })

  it('⛔ leaves a hairpin that reaches PAST the box — fully enclosed, never clipped', () => {
    // Five quarters from bar 1 beat 0 runs one beat into bar 2, which this box does not hold.
    engine.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(5, 1), voice: 0 })
    expect(marksInBox(engine.getScore(), bar1)).toEqual([])
  })

  it('⭐ takes a TRILL on its SIGN alone — its wavy line may run out of the box', () => {
    const id = engine.addTrill({ startNoteId: bar1[3], endNoteId: bar2[1] })!.id
    expect(marksInBox(engine.getScore(), bar1)).toEqual([{ kind: 'trill', id }])
  })

  it('leaves a trill whose sign is in the NEXT bar', () => {
    engine.addTrill({ startNoteId: bar2[0] })
    expect(marksInBox(engine.getScore(), bar1)).toEqual([])
  })

  it('takes the octave line and the pedal on the same rule', () => {
    engine.addOttava(1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })
    engine.addPedal(1, { beat: frac(0, 1), length: frac(2, 1) })
    expect(kinds(bar1)).toEqual(['ottava', 'pedal'])
  })

  it('answers nothing for an empty selection', () => {
    expect(marksInBox(engine.getScore(), [])).toEqual([])
  })

  it('⭐⭐ agrees with the COPY — the highlight is a promise about what travels', () => {
    engine.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p'), voice: 0 })
    engine.addHairpin(1, { type: 'dim', beat: frac(1, 1), length: frac(2, 1), voice: 0 })
    engine.addTrill({ startNoteId: bar1[2] })
    engine.addOttava(1, { beat: frac(0, 1), length: frac(4, 1), shift: -1 })
    // …and three that must be in NEITHER: past the box's end, in the next bar, out of its staff band.
    engine.addHairpin(1, { type: 'cresc', beat: frac(3, 1), length: frac(3, 1), voice: 0 })
    engine.addDynamic(2, { beat: frac(0, 1), text: levelToGlyphString('f'), voice: 0 })
    engine.addTrill({ startNoteId: bar2[2] })

    const clip = buildClipboardFromSelection(engine.getScore(), bar1)!
    const box = marksInBox(engine.getScore(), bar1)
    const count = (kind: string) => box.filter(i => i.kind === kind).length
    expect(count('dynamic')).toBe(clip.dynamics.length)
    expect(count('hairpin')).toBe(clip.hairpins.length)
    expect(count('trill')).toBe(clip.trills.length)
    expect(count('ottava')).toBe(clip.ottavas?.length ?? 0)
    // …and the fixture really does exercise both sides of the rule.
    expect(box.length).toBe(4)
  })
})

describe('markItems / marksLabel', () => {
  it('picks the marks out of a mixed selection and counts them by kind', () => {
    const marks = markItems([
      { kind: 'note', id: 'n1' },
      { kind: 'dynamic', id: 'd1' },
      { kind: 'hairpin', id: 'h1' },
      { kind: 'articulation', noteId: 'n1', type: 'accent' },
      { kind: 'trill', id: 't1' },
    ])
    expect(marks).toEqual([
      { kind: 'dynamic', id: 'd1' },
      { kind: 'hairpin', id: 'h1' },
      { kind: 'trill', id: 't1' },
    ])
    expect(marksLabel(marks)).toBe('1 dynamic(s) + 1 hairpin(s) + 1 trill(s)')
    expect(marksLabel([])).toBe('')
  })
})
