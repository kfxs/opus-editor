// @vitest-environment jsdom
/**
 * Augmentation dots are hit-testable — the thing that makes them selectable at all.
 *
 * The shape to protect: `dots` is ONE value on the `Chord`/`Rest` slot (it modifies the duration),
 * unlike `alter`, which lives per `NotePitch`. But VexFlow draws a dot per notehead per dot, so a
 * double-dotted three-note chord emits SIX glyphs for that one value. Every glyph therefore
 * registers against the SAME anchor id, which is what makes clicking any one dot select them all —
 * "dot one head of a chord" has no representation in the model.
 *
 * These assert the COUNT and the ANCHOR, not geometry: jsdom has no font metrics, so a Dot's
 * bounding box comes back 0×0. Whether the boxes actually sit under the glyphs is a by-hand check.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'

type Params = Parameters<MusicEngine['addNoteAtBeat']>[0]
const at = (beat: number, extra: Record<string, unknown>) => ({
  octave: 4, measure: 1, beat: { num: beat, den: 1 }, ...extra,
} as unknown as Params)

describe('dot registration', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
  })

  const dots = () => engine.getElementRegistry().getByType('dot')
  const anchors = () => [...new Set(dots().map(d => d.noteId))]

  it('a dotted note registers one dot; an undotted one registers none', () => {
    const note = engine.addNoteAtBeat(at(0, { step: 'C', duration: 'h', dots: 1 }))
    engine.renderScore()
    expect(dots()).toHaveLength(1)
    expect(anchors()).toEqual([note!.id])

    engine.updateNote(note!.id, { dots: 0 })
    engine.renderScore()
    expect(dots()).toHaveLength(0)
  })

  it('a dotted CHORD registers one dot per head, ALL anchored to the lowest pitch', () => {
    // The load-bearing one: many glyphs, one anchor → clicking any dot selects the slot's dots.
    const c = engine.addNoteAtBeat(at(0, { step: 'C', duration: 'h', dots: 1 }))
    engine.addChordNote(at(0, { step: 'E', duration: 'h', dots: 1 }))
    engine.addChordNote(at(0, { step: 'G', duration: 'h', dots: 1 }))
    engine.renderScore()

    expect(dots()).toHaveLength(3)      // one per notehead
    expect(anchors()).toEqual([c!.id])  // ...and they all address the same slot
  })

  it('a double dot registers twice per head — both belong to the one slot', () => {
    const c = engine.addNoteAtBeat(at(0, { step: 'C', duration: 'h', dots: 2 }))
    engine.addChordNote(at(0, { step: 'E', duration: 'h', dots: 2 }))
    engine.renderScore()

    expect(dots()).toHaveLength(4)      // 2 heads × 2 dots
    expect(anchors()).toEqual([c!.id])
  })

  it('a dotted REST registers against its own id — a rest IS its slot', () => {
    // Dotting a rest is a real edit, not a quirk: the bar reflows around it (q@1 becomes q.@1, and
    // the remainder re-fills as q + 8). One glyph only — a rest has a single "notehead".
    engine.addNoteAtBeat(at(0, { step: 'C', duration: 'q' }))
    engine.renderScore()
    const rest = engine.getElementRegistry().getByType('rest')[0]
    expect(rest?.id, 'expected a rest after the quarter').toBeTruthy()

    expect(engine.updateNote(rest.id!, { dots: 1 })?.dots).toBe(1) // authored, and it sticks
    engine.renderScore()

    expect(dots()).toHaveLength(1)
    expect(anchors()).toEqual([rest.id])
  })

  it('registers the dotted rests restFill itself produces in compound meter', () => {
    // 6/8 is full of dotted rests — restFill picks a dotted quarter for a 3-eighth compound beat.
    // They are the dots most likely to be clicked, and the case 4/4 never surfaces: a bar of 4/4
    // splits into undotted shapes, so testing only there hides this entirely.
    engine.setTimeSignature(1, { numerator: 6, denominator: 8 })
    engine.addNoteAtBeat(at(0, { step: 'C', duration: '8' }))
    engine.renderScore()

    const restIds = engine.getElementRegistry().getByType('rest').map(r => r.id!)
    const dottedRestIds = restIds.filter(id => (engine.getNote(id)?.dots ?? 0) > 0)
    expect(dottedRestIds.length, 'expected restFill to pick a dotted rest in 6/8').toBeGreaterThan(0)
    expect(dots()).toHaveLength(dottedRestIds.length)
    expect(anchors().sort()).toEqual(dottedRestIds.sort())
  })
})
