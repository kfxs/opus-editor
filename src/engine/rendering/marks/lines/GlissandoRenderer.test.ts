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

  it('⭐ the armed ends (house = Gould\'s angle) are STEEPER than MuseScore\'s head-centre aim', () => {
    const model = new ScoreModel()
    const c = note(model, 'C', 4, 0)
    note(model, 'C', 5, 1)
    addGlissando(model.getScore(), c.id)
    const slope = (s: ReturnType<typeof strokes>[number]) => Math.abs((s.b.y - s.a.y) / (s.b.x - s.a.x))
    const house = strokes(model)[0]
    setGlissandoEndRule('musescore')
    const centres = strokes(model)[0]
    expect(slope(house)).toBeGreaterThan(slope(centres))
  })

  it('⭐ a REST next: a FREE end (P3), falling — and once a note fills the slot, the line goes to it', () => {
    const model = new ScoreModel()
    const c = note(model, 'C', 4, 0)
    addGlissando(model.getScore(), c.id)
    const free = strokes(model)
    expect(free).toHaveLength(1)
    expect(free[0].b.y).toBeGreaterThan(free[0].a.y) // a fall
    note(model, 'E', 4, 1)
    const joined = strokes(model)
    expect(joined).toHaveLength(1)
    expect(joined[0].b.y).toBeLessThan(joined[0].a.y) // up to the E4
  })

  it('P3: a line INTO the note (`side: before`) ends at the note, coming from its left', () => {
    const model = new ScoreModel()
    note(model, 'C', 4, 0)
    const e = note(model, 'E', 4, 1)
    const g = addGlissando(model.getScore(), e.id)!
    g.side = 'before'
    const [s] = strokes(model)
    expect(s.b.x).toBeGreaterThan(s.a.x)
    expect(s.a.y).toBeGreaterThan(s.b.y) // rising into it: a scoop
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

  it('⭐ ACROSS A SYSTEM BREAK: ONE group, TWO strokes (P2)', () => {
    // Enough bars to break: a whole note in each, a glissando on every one.
    const model = new ScoreModel()
    for (let m = 2; m <= 24; m++) model.addMeasure()
    const heads = Array.from({ length: 24 }, (_, i) =>
      model.addNote({ step: i % 2 ? 'C' : 'G', alter: 0, octave: 4, duration: 'w', measure: i + 1, beat: frac(0, 1) }))
    for (const h of heads.slice(0, -1)) addGlissando(model.getScore(), h.id)

    const renderer = makeRenderer()
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    const lines = renderer.getMeasureLayoutInfo()
    const gl = sceneGroups(scene, 'glissando')
    expect(gl).toHaveLength(23)
    // Every glissando whose target opens the NEXT system draws two strokes; every other, one.
    const breaks = heads.slice(0, -1).map((_, i) => lines.get(i + 1)!.lineNumber !== lines.get(i + 2)!.lineNumber)
    expect(breaks.some(Boolean), 'the fixture must break a system').toBe(true)
    const byAnchor = new Map(model.getScore().glissandi!.map(g => [`glissando-${g.id}`, g.noteId]))
    for (const group of gl) {
      const i = heads.findIndex(h => h.id === byAnchor.get(group.id!))
      expect(scenePrimitives(group).filter(p => p.kind === 'path'), `bar ${i + 1}`).toHaveLength(breaks[i] ? 2 : 1)
    }
  })
})

