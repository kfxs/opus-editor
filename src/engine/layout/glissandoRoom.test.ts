/**
 * {@link glissandoRoomIn} — what a glissando asks of its bar's spacing (docs/plans/glissando-plan.md P1b).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGlissando } from '@/engine/models/glissandoOps'
import { glissandoRoomIn, glissandoMinLengthSettings, resetGlissandoMinLengthRule, setGlissandoMinLengthRule } from './glissandoRoom'
import { armedGlissandoEndRule } from '@/engine/engrave/marks/glissandoLine'
import { fracCreate as frac } from '@/utils/fraction'

afterEach(() => resetGlissandoMinLengthRule())

function score() {
  const model = new ScoreModel()
  model.addMeasure()
  const c = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
  const last = model.addNote({ step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(3, 1) })
  model.addNote({ step: 'A', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
  return { model, c, last }
}

describe('glissandoRoomIn', () => {
  it('ships MuseScore\'s 1.2 sp, with the armed end rule\'s gaps', () => {
    expect(glissandoMinLengthSettings().rule).toBe('musescore')
    const { model, c } = score()
    addGlissando(model.getScore(), c.id)
    const [room, ...rest] = glissandoRoomIn(model.getScore(), model.getMeasure(1)!)
    expect(rest).toHaveLength(0)
    const armed = armedGlissandoEndRule()
    expect(room).toEqual({
      from: frac(0, 1), to: frac(1, 1),
      startGap: armed.startGap, endGap: armed.endGap, accidentalGap: armed.accidentalGap, length: 1.2,
    })
  })

  it('a target in the NEXT bar asks up to this bar\'s barline (`to` null) — and only of the bar it leaves', () => {
    const { model, last } = score()
    addGlissando(model.getScore(), last.id)
    expect(glissandoRoomIn(model.getScore(), model.getMeasure(1)!)[0].to).toBeNull()
    expect(glissandoRoomIn(model.getScore(), model.getMeasure(2)!)).toEqual([])
  })

  it('the `none` row asks nothing at all — not even a free end', () => {
    const { model, c, last } = score()
    const model2 = new ScoreModel()
    const lone = model2.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addGlissando(model2.getScore(), lone.id)
    addGlissando(model.getScore(), c.id)
    addGlissando(model.getScore(), last.id)
    setGlissandoMinLengthRule('none')
    expect(glissandoRoomIn(model.getScore(), model.getMeasure(1)!)).toEqual([])
    expect(glissandoRoomIn(model2.getScore(), model2.getMeasure(1)!)).toEqual([])
  })
})

describe('P3 — a free end asks for its own room', () => {
  it('after: from its note to the next column, the free row\'s length and clearance', () => {
    const model = new ScoreModel()
    const c = model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    addGlissando(model.getScore(), c.id) // a rest follows
    const [room] = glissandoRoomIn(model.getScore(), model.getMeasure(1)!)
    expect(room).toMatchObject({ from: frac(0, 1), to: frac(1, 1), length: 3.8, endGap: 0.6 })
  })

  it('before: from the previous column to its note', () => {
    const model = new ScoreModel()
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const g = addGlissando(model.getScore(), e.id)!
    g.side = 'before'
    const [room] = glissandoRoomIn(model.getScore(), model.getMeasure(1)!)
    expect(room).toMatchObject({ from: frac(0, 1), to: frac(1, 1), length: 3.8, startGap: 0.6 })
  })
})
