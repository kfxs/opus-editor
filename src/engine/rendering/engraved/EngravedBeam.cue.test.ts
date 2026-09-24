// @vitest-environment jsdom
/**
 * Subject: `./EngravedBeam` — a beam over CUE notes (docs/plans/cue-size-plan.md C7, P2): small only when
 * ALL its notes are cue (MuseScore and Verovio agree); a MIXED beam is full, lies where the pitches put it,
 * and every stem — the cue ones too — reaches it. Read off the SCENE.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { sceneGroups, type Scene } from '@/engine/scene/Scene'
import { setCue } from '../../models/cueOps'
import { crossSystemBeamWidth } from '../beams/beamInk'
import { fracCreate as frac } from '@/utils/fraction'

/** Two beamed E4 eighths per bar, the same pitch — so a beam over them lies FLAT. */
function render(cueOf: (bar: number, beat: number) => boolean): Scene {
  const model = new ScoreModel()
  for (let i = 1; i < 3; i++) model.addMeasure()
  const ids: string[] = []
  for (let bar = 1; bar <= 3; bar++) {
    for (const beat of [0, 1]) {
      const n = model.addNote({ step: 'E', alter: 0, octave: 4, duration: '8', measure: bar, beat: frac(beat, 2) })
      if (cueOf(bar, beat)) ids.push(n.id)
    }
  }
  setCue(model.getScore(), ids, true)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
}

/** Per beam: its line's thickness at the left end, its tilt, and each stem's tip and length. */
function beams(scene: Scene) {
  return sceneGroups(scene, 'beam').map(g => {
    const quad = g.children.find(c => c.kind === 'path')!
    const pts = quad.kind === 'path' ? quad.ops.filter(o => o.op !== 'closePath') as { x: number; y: number }[] : []
    const stems = sceneGroups(g, 'stem').flatMap(s => s.children).flatMap(p =>
      p.kind === 'path' && p.ops[0].op === 'moveTo' && p.ops[1].op === 'lineTo' ? [{ tip: p.ops[1].y, length: Math.abs(p.ops[1].y - p.ops[0].y) }] : [])
    return { thickness: Math.abs(pts[1].y - pts[0].y), tilt: pts[2].y - pts[1].y, stems }
  })
}

describe('EngravedBeam — cue notes', () => {
  // Bar 1 full, bar 2 ALL cue, bar 3 MIXED (the first note cue).
  const [full, allCue, mixed] = beams(render((bar, beat) => bar === 2 || (bar === 3 && beat === 0)))

  it('⭐ an ALL-cue beam is its notes’ size: ¾ the thickness, ¾ the stems', () => {
    expect(full.thickness).toBeCloseTo(crossSystemBeamWidth(), 6)
    expect(allCue.thickness).toBeCloseTo(crossSystemBeamWidth() * 0.75, 6)
    expect(allCue.stems[0].length / full.stems[0].length).toBeCloseTo(0.75, 1)
  })

  it('⭐ a MIXED beam is full — and lies FLAT over a repeated pitch (the cue stem does not tilt it)', () => {
    expect(mixed.thickness).toBeCloseTo(crossSystemBeamWidth(), 6)
    expect(mixed.tilt).toBeCloseTo(0, 6)
  })

  it('⭐ …and the cue note’s stem reaches the beam, as the full one does', () => {
    expect(mixed.stems[0].tip).toBeCloseTo(mixed.stems[1].tip, 6)
    expect(mixed.stems[0].length).toBeCloseTo(full.stems[0].length, 6)
  })
})
