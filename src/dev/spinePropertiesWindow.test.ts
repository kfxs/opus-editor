import { describe as describeSpec, it, expect } from 'vitest'
import { circleSpine } from '@/engine/engrave/staff/staffSpine'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { drawScoreOnSpine, type SpinePlacedReport } from '@/engine/rendering/eye/spineScore'
import { describe } from './spinePropertiesWindow'

/** Subject: `./spinePropertiesWindow` — what the read-only window REPORTS for the selection (plan §9). */

function setUp() {
  const m = new ScoreModel('spine')
  m.addMeasure()
  m.addNote({ step: 'E', alter: -1, octave: 5, duration: 'q', measure: 1, beat: { num: 2, den: 1 } })
  const placed: SpinePlacedReport = new Map()
  drawScoreOnSpine(new SceneRecorder(), m.getScore(), circleSpine(400, 400, 250), placed)
  const slot = m.getScore().measures[0].slots.find(s => s.type === 'chord')!
  const id = slot.type === 'chord' ? slot.notes[0].id : slot.id
  return { m, placed, id }
}
const rowsOf = (sections: ReturnType<typeof describe>) => Object.fromEntries(sections.flatMap(s => s.rows))

describeSpec('Spine Properties — the report', () => {
  it('a NOTE: what it is (pitch, length, bar, beat, voice, staff) and where it stands on the spine', () => {
    const { m, placed, id } = setUp()
    const sections = describe({ getScore: () => m.getScore(), selected: () => ({ ids: [id], barline: null }), placed: () => placed })
    expect(sections.map(s => s.title)).toEqual(['Note', 'On the spine'])
    const rows = rowsOf(sections)
    expect(rows.pitch).toBe('E♭5')
    expect(rows.bar).toBe('1')
    expect(rows.beat).toBe('3')
    expect(rows.voice).toBe('1')
    expect(rows['along the path']).toMatch(/sp$/)
    expect(rows['path turned']).toMatch(/°$/)
  })

  it('a BARLINE: the bar it ends, and its place on the spine', () => {
    const { m, placed } = setUp()
    const sections = describe({ getScore: () => m.getScore(), selected: () => ({ ids: [], barline: 1 }), placed: () => placed })
    expect(sections.map(s => s.title)).toEqual(['Barline', 'On the spine'])
    expect(rowsOf(sections)['ends bar']).toBe('1')
  })

  it('nothing selected — says so; the panel closed — says how to open it', () => {
    const { m, id } = setUp()
    expect(describe({ getScore: () => m.getScore(), selected: () => ({ ids: [], barline: null }), placed: () => new Map() })[0].title)
      .toBe('Nothing selected')
    const closed = describe({ getScore: () => m.getScore(), selected: () => ({ ids: [id], barline: null }), placed: () => new Map() })
    expect(Object.values(rowsOf(closed)).join(' ')).toMatch(/__spine\.show\(\)/)
  })
})
