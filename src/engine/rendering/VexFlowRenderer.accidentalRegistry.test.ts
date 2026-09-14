// @vitest-environment jsdom
/**
 * ⭐⭐ **WHICH PITCH AN ACCIDENTAL BELONGS TO** — the registry entry that every click, and every
 * selection highlight, resolves through.
 *
 * 🚨 **His report, 2026-09-14, with a picture**: a five-note chord carrying a natural on G4 and a
 * sharp on C5 — *"i selected C and the natural is highlighted, but C is not the owner of the
 * natural"*. The registration loop asked the modifier for its index, then for a field VexFlow does
 * not have, and then **guessed**: *the Nth accidental belongs to the Nth pitch*. In a chord with
 * more notes than accidentals that is simply false, and because the guess sat in an `||` chain it
 * only ever ran when the true answer had already said NO — so the guess always won.
 *
 * ⭐ These assert the ANCHOR, ⛔ not geometry: in jsdom an `Accidental`'s box comes back 0×0
 * (`reference: jsdom cannot measure glyphs`), and whether the box sits under the glyph is the
 * browser suite's question. WHO it belongs to is arithmetic, and that is what broke.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'

type Params = Parameters<MusicEngine['addNoteAtBeat']>[0]
const at = (extra: Record<string, unknown>) => ({
  octave: 4, measure: 1, beat: { num: 0, den: 1 }, duration: 'q', ...extra,
} as unknown as Params)

describe('accidental registration', () => {
  let engine: MusicEngine

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 800, height: 400 })
  })

  const accidentals = () => engine.getElementRegistry().getByType('accidental')

  /** His chord: C4 E4 G4 A4 C5, with a forced natural on G4 and a sharp on C5. */
  function hisChord() {
    const c4 = engine.addNoteAtBeat(at({ step: 'C' }))!
    const e4 = engine.addChordNote(at({ step: 'E' }))
    const g4 = engine.addChordNote(at({ step: 'G' }))
    const a4 = engine.addChordNote(at({ step: 'A' }))
    const c5 = engine.addChordNote(at({ step: 'C', octave: 5 }))
    engine.updateNote(g4.id, { alter: 0, forceAccidental: true })
    engine.updateNote(c5.id, { alter: 1 })
    engine.renderScore()
    return { c4, e4, g4, a4, c5 }
  }

  it('🚨 an accidental is filed under ITS OWN pitch — ⛔ not the Nth note of the chord', () => {
    const { g4, c5 } = hisChord()
    const owners = accidentals().map(a => a.noteId).sort()
    expect(owners, 'the natural’s pitch and the sharp’s, and no others').toEqual([g4.id, c5.id].sort())
  })

  it('🚨 …so a pitch with NO accidental owns none — the exact shape of his report', () => {
    const { c4, e4, a4 } = hisChord()
    for (const note of [c4, e4, a4]) {
      expect(accidentals().filter(a => a.noteId === note.id), `${note.step}${note.octave}`).toHaveLength(0)
    }
  })

  it('⭐ the SIGN registered is the pitch’s own — a natural for the natural, a sharp for the sharp', () => {
    const { g4, c5 } = hisChord()
    const signOf = (id: string) => accidentals().find(a => a.noteId === id)?.accidentalType
    expect(signOf(g4.id)).toBe('n')
    expect(signOf(c5.id)).toBe('#')
  })

  // 🚨 The break-test: every assertion above would pass on a registry that registered NOTHING.
  it('🚨 the break-test — the chord really does register two accidentals', () => {
    hisChord()
    expect(accidentals()).toHaveLength(2)
  })

  it('⭐ a plain single note with one accidental still registers it against itself', () => {
    const f = engine.addNoteAtBeat(at({ step: 'F', alter: 1 }))!
    engine.renderScore()
    expect(accidentals().map(a => a.noteId)).toEqual([f.id])
  })
})
