import { describe, expect, it } from 'vitest'
import { circleSpine } from '@/engine/engrave/staff/staffSpine'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { drawScoreOnSpine, type SpinePlacedReport } from './spineScore'
import { spaceBarsOnSpine } from './spineSpacing'
import { sameSpineSign, spineSignFromTag, spineSignSpaceKey, spineSignTag } from './spineSignSpace'

/** Subject: `./spineSignSpace` — a header clef or meter picked on the spine, and MOVED (his ask, 2026-09-28). */
function score() {
  const m = new ScoreModel('signs')
  m.addMeasure()
  for (let bar = 1; bar <= 2; bar++) {
    for (let i = 0; i < 4; i++) m.addNote({ step: 'G', octave: 4, duration: 'q', measure: bar, beat: { num: i, den: 1 }, staff: 0 })
  }
  return m.getScore()
}
const SP = 10

describe('spineSignSpace', () => {
  it('a sign and its tag go both ways; anything else is not a sign', () => {
    for (const sign of [{ kind: 'clef', measure: 3, staff: 1 }, { kind: 'timeSignature', measure: 2 }] as const) {
      expect(spineSignFromTag(spineSignTag(sign))).toEqual(sign)
    }
    expect(spineSignFromTag('barline:1')).toBeUndefined()
    expect(spineSignFromTag(null)).toBeUndefined()
    expect(sameSpineSign({ kind: 'timeSignature', measure: 1 }, { kind: 'timeSignature', measure: 1 })).toBe(true)
    expect(sameSpineSign({ kind: 'clef', measure: 1, staff: 0 }, { kind: 'clef', measure: 1, staff: 1 })).toBe(false)
  })

  it('the drawing reports where bar 1\'s clef and meter stand — the meter after the clef', () => {
    const placed: SpinePlacedReport = new Map()
    drawScoreOnSpine(new SceneRecorder(), score(), circleSpine(400, 400, 250), placed)
    const clef = placed.get(spineSignTag({ kind: 'clef', measure: 1, staff: 0 }))!
    const meter = placed.get(spineSignTag({ kind: 'timeSignature', measure: 1 }))!
    expect(meter.s).toBeGreaterThan(clef.s)
  })

  it('⭐ a CLEF\'s space MOVES it and everything after it — the meter and the music', () => {
    const s = score()
    const clefKey = spineSignSpaceKey(s, { kind: 'clef', measure: 1, staff: 0 })!
    const open = spaceBarsOnSpine(s, 0, 0, false)[0]
    const shifted = spaceBarsOnSpine(s, 0, 0, false, 1, { signSpace: new Map([[clefKey, 2]]) })[0]
    expect(shifted.musicStart - open.musicStart).toBeCloseTo(2 * SP, 6)
  })

  it('a METER\'s space moves the music too; ⛔ tighter never takes it into the clef (the gap stops at 0)', () => {
    const s = score()
    const meterKey = spineSignSpaceKey(s, { kind: 'timeSignature', measure: 1 })!
    const open = spaceBarsOnSpine(s, 0, 0, false)[0]
    const wider = spaceBarsOnSpine(s, 0, 0, false, 1, { signSpace: new Map([[meterKey, 1]]) })[0]
    expect(wider.musicStart - open.musicStart).toBeCloseTo(1 * SP, 6)
    const far = spaceBarsOnSpine(s, 0, 0, false, 1, { signSpace: new Map([[meterKey, -50]]) })[0]
    const further = spaceBarsOnSpine(s, 0, 0, false, 1, { signSpace: new Map([[meterKey, -100]]) })[0]
    expect(far.musicStart).toBeLessThan(open.musicStart)
    expect(further.musicStart).toBeCloseTo(far.musicStart, 6)
  })
})
