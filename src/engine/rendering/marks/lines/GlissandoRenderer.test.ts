// @vitest-environment jsdom
/**
 * {@link renderGlissandi} through a recorded SCENE — a real render of a real score, the stroke read back
 * as numbers (docs/plans/glissando-plan.md P1). ⚠️ jsdom measures glyphs as 0×0, so these assert the
 * stroke's SHAPE and its presence, ⛔ never where it lands against a head's ink — that is the browser's.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGlissando } from '@/engine/models/glissandoOps'
import { ScoreRenderer } from '../../ScoreRenderer'
import { sceneGroups, scenePrimitives, type ScenePrimitive } from '@/engine/scene/Scene'
import { resetGlissandoRules, setGlissandoEndRule, setGlissandoThicknessRule, glissandoThicknessSpaces } from '@/engine/engrave/marks/glissandoLine'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCreate as frac } from '@/utils/fraction'
import type { NoteParams } from '@/types/music'

afterEach(() => resetGlissandoRules())

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer
}

const note = (model: ScoreModel, step: NoteParams['step'], octave: number, beat: number) =>
  model.addNote({ step, alter: 0, octave, duration: 'q', measure: 1, beat: frac(beat, 1) })

/** The glissando groups one render drew, each as its one stroked path. */
function strokes(model: ScoreModel) {
  const renderer = makeRenderer()
  const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
  return sceneGroups(scene, 'glissando').map(g => {
    const path = scenePrimitives(g).find((p): p is Extract<ScenePrimitive, { kind: 'path' }> => p.kind === 'path')!
    const [a, b] = path.ops as Array<{ op: string; x: number; y: number }>
    return { id: g.id, a, b, painted: path.painted, width: path.style.lineWidth }
  })
}

describe('renderGlissandi', () => {
  it('draws ONE straight stroke from the anchor toward the next note — rising means UP the page', () => {
    const model = new ScoreModel()
    const c = note(model, 'C', 4, 0)
    note(model, 'G', 4, 1)
    const g = addGlissando(model.getScore(), c.id)!
    const [s, ...rest] = strokes(model)
    expect(rest).toHaveLength(0)
    expect(s.id).toBe(`glissando-${g.id}`)
    expect([s.a.op, s.b.op, s.painted]).toEqual(['moveTo', 'lineTo', 'stroke'])
    expect(s.b.x).toBeGreaterThan(s.a.x)
    expect(s.b.y).toBeLessThan(s.a.y)
  })

  it('at the armed weight — a staff line\'s under Gould, the row\'s number otherwise', () => {
    const model = new ScoreModel()
    const c = note(model, 'C', 4, 0)
    note(model, 'G', 4, 1)
    addGlissando(model.getScore(), c.id)
    expect(strokes(model)[0].width).toBeCloseTo(glissandoThicknessSpaces() * STAFF_SPACE_PX)
    setGlissandoThicknessRule('musescore')
    expect(strokes(model)[0].width).toBeCloseTo(0.15 * STAFF_SPACE_PX)
  })

  it('⭐ Gould\'s ends lean inward: her stroke rises LESS than the head-centre row\'s', () => {
    const model = new ScoreModel()
    const c = note(model, 'C', 4, 0)
    note(model, 'C', 5, 1)
    addGlissando(model.getScore(), c.id)
    const gould = strokes(model)[0]
    setGlissandoEndRule('musescore')
    const centres = strokes(model)[0]
    expect(gould.a.y - gould.b.y).toBeLessThan(centres.a.y - centres.b.y)
    expect(centres.a.y - centres.b.y).toBeCloseTo(3.5 * STAFF_SPACE_PX) // an octave = 3½ spaces
  })

  it('⭐ nothing drawn while the next slot is a REST — and drawn once a note fills it', () => {
    const model = new ScoreModel()
    const c = note(model, 'C', 4, 0)
    addGlissando(model.getScore(), c.id)
    expect(strokes(model)).toHaveLength(0)
    note(model, 'E', 4, 1)
    expect(strokes(model)).toHaveLength(1)
  })

  it('a chord: one stroke per head', () => {
    const model = new ScoreModel()
    const heads = [note(model, 'C', 4, 0), note(model, 'E', 4, 0)]
    note(model, 'D', 5, 1)
    note(model, 'F', 5, 1)
    for (const h of heads) addGlissando(model.getScore(), h.id)
    const drawn = strokes(model)
    expect(drawn).toHaveLength(2)
    expect(drawn[0].a.y).not.toBeCloseTo(drawn[1].a.y)
  })
})
