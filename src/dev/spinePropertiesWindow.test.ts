// @vitest-environment jsdom
import { describe as describeSpec, it, expect } from 'vitest'
import { circleSpine } from '@/engine/engrave/staff/staffSpine'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { drawScoreOnSpine, type SpinePlacedReport } from '@/engine/rendering/eye/spineScore'
import { describe, SpinePropertiesWidget } from './spinePropertiesWindow'

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
const report = (r: ReturnType<typeof describe>) => {
  if (typeof r === 'string') throw new Error(`expected a report, got: ${r}`)
  return r
}

describeSpec('Spine Properties — the report, as JSON like the Properties window (his ask, 2026-09-28)', () => {
  it('a NOTE: what it is (pitch, length, bar, beat, voice, staff) and where it stands on the spine', () => {
    const { m, placed, id } = setUp()
    const r = report(describe({ getScore: () => m.getScore(), selected: () => ({ ids: [id], barline: null }), placed: () => placed }))
    expect(r.kind).toBe('note')
    expect(r.data).toMatchObject({ pitch: ['E♭5'], duration: 'q', quarters: 1, bar: 1, beat: 3, voice: 1, staff: 1 })
    expect(r.spine).toMatchObject({ staff: 1 })
    expect(typeof (r.spine as Record<string, unknown>).alongPathSp).toBe('number')
    expect(typeof (r.spine as Record<string, unknown>).pathTurnedDeg).toBe('number')
  })

  it('a BARLINE: the bar it ends, its place on the spine, and its stretch', () => {
    const { m, placed } = setUp()
    const r = report(describe({
      getScore: () => m.getScore(), selected: () => ({ ids: [], barline: 1 }), placed: () => placed, stretch: { of: () => 1.5 },
    }))
    expect(r.kind).toBe('barline')
    expect(r.barline).toBe(1)
    expect(r.data).toEqual({ endsBar: 1 })
    expect(r.spine).toMatchObject({ staff: 1, stretch: 1.5 })
  })

  it('nothing selected — says so; the panel closed — says how to open it', () => {
    const { m, id } = setUp()
    expect(describe({ getScore: () => m.getScore(), selected: () => ({ ids: [], barline: null }), placed: () => new Map() }))
      .toMatch(/^Nothing selected/)
    const closed = report(describe({ getScore: () => m.getScore(), selected: () => ({ ids: [id], barline: null }), placed: () => new Map() }))
    expect(closed.spine).toMatch(/__spine\.show\(\)/)
  })

  it('⭐ a BARLINE gets the STRETCH knob (his ask, 2026-09-28): the Properties number row sets the bar it ENDS, reset = ×1; a note does not', () => {
    const { m, placed, id } = setUp()
    let barline: number | null = 1
    let value = 1
    const calls: [number, number][] = []
    const deps = {
      windows: undefined as never,
      getScore: () => m.getScore(),
      selected: () => ({ ids: barline === null ? [id] : [], barline }),
      onSelectionChange: () => () => {},
      placed: () => placed,
      onRedraw: () => () => {},
      stretch: { of: () => value, set: (measure: number, v: number) => { calls.push([measure, v]); value = v } },
    }
    const host = document.createElement('div')
    new SpinePropertiesWidget(deps).mount(host)
    // ⭐ At the TOP (his ask): the kind's label, then the control, then the JSON.
    expect(host.querySelector('.spine-properties')!.children[1].classList.contains('spine-properties-stretch')).toBe(true)
    const input = host.querySelector<HTMLInputElement>('.spine-properties-stretch input')!
    expect(input.value).toBe('1')
    input.value = '1.5'
    input.dispatchEvent(new Event('change'))
    expect(calls[0]).toEqual([1, 1.5])
    const reset = host.querySelector<HTMLButtonElement>('.spine-properties-stretch button')!
    expect(reset.textContent).toBe('reset')
    reset.click()
    expect(calls[1]).toEqual([1, 1])

    barline = null
    const noteHost = document.createElement('div')
    new SpinePropertiesWidget(deps).mount(noteHost)
    expect(noteHost.querySelector('.spine-properties-stretch')).toBeNull()
  })
})
