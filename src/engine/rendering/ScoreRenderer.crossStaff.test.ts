// @vitest-environment jsdom
/**
 * ⭐ CROSS-STAFF, drawn (docs/plans/cross-staff-plan.md Phase 2) — a scene test: a real render, read
 * back as numbers. The fixture is the Satie chord: B2 on the bass staff, D4 + F4 written on the
 * treble, one stem.
 *
 * ⭐ The assertion that carries the feature is RELATIVE, so it needs no staff arithmetic of its own:
 * *a crossed D4 stands at the y the treble staff's OWN D4 stands at.*
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { crossPitches } from '../models/crossStaffOps'
import { sceneGroups, scenePrimitives } from '@/engine/scene/Scene'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCreate as frac } from '@/utils/fraction'

function renderModel(model: ScoreModel) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
}

type Scene = ReturnType<typeof renderModel>

/** SMuFL `noteheadHalf` — ⚠️ a REST is drawn in a `notehead` group too, and the treble's half rest
 *  shares the chord's column, so the glyph is what tells them apart. */
const HALF_HEAD = 0xe0a3

const heads = (scene: Scene) => sceneGroups(scene, 'notehead')
  .flatMap(g => g.children.flatMap(c =>
    (c.kind === 'text' && c.text.codePointAt(0) === HALF_HEAD ? [{ x: c.x, y: c.y }] : [])))

const stems = (scene: Scene) => sceneGroups(scene, 'stem')
  .flatMap(g => g.children)
  .flatMap(p => (p.kind === 'path' && p.ops[0].op === 'moveTo' && p.ops[1]?.op === 'lineTo'
    ? [{ x: p.ops[0].x, top: Math.min(p.ops[0].y, p.ops[1].y), bottom: Math.max(p.ops[0].y, p.ops[1].y) }]
    : []))

/** Every ledger line: a stroked two-point horizontal path outside the stave's own group. */
const ledgers = (scene: Scene) => {
  const staveInk = new Set(sceneGroups(scene, 'stave').flatMap(g => scenePrimitives(g)))
  return scenePrimitives(scene).filter(p =>
    !staveInk.has(p)
    && p.kind === 'path' && p.painted === 'stroke' && p.ops.length === 2
    && p.ops[0].op === 'moveTo' && p.ops[1].op === 'lineTo' && p.ops[0].y === p.ops[1].y)
}

/** Treble + bass. Beat 0 of the bass holds B2·D4·F4; beat 2 of the TREBLE holds the staff's own D4. */
function satie(cross: boolean) {
  const model = new ScoreModel()
  model.addStaffBelow(0)
  // ⚠️ A new staff opens in TREBLE — without this the 'bass' staff reads B2 five ledger lines down.
  model.setClef(1, 'bass', model.getScore().staves![1].id)
  const add = (step: 'B' | 'D' | 'F', octave: number, staff: number, beat: number) =>
    model.addNote({ step, alter: 0, octave, duration: 'h', measure: 1, beat: frac(beat, 1), staff })
  const b = add('B', 2, 1, 0)
  const d = add('D', 4, 1, 0)
  const f = add('F', 4, 1, 0)
  const reference = add('D', 4, 0, 2)
  if (cross) crossPitches(model.getScore(), [d.id, f.id], -1)
  return { model, b, d, f, reference }
}

describe('a head written on the other staff', () => {
  it('⭐⭐ the crossed D4 stands exactly where the treble staff’s own D4 stands', () => {
    const drawn = heads(renderModel(satie(true).model))
    // B2 · D4 · F4 (one chord, one x) + the treble's reference D4 at a later x.
    expect(drawn).toHaveLength(4)
    const chordX = Math.min(...drawn.map(h => h.x))
    const chord = drawn.filter(h => h.x === chordX).sort((a, b) => b.y - a.y) // low → high on the page
    const reference = drawn.find(h => h.x !== chordX)!
    expect(chord).toHaveLength(3)

    const [b2, d4, f4] = chord
    expect(d4.y).toBeCloseTo(reference.y, 6)
    // F4 is a third above D4 — one staff space — on the same staff.
    expect(d4.y - f4.y).toBeCloseTo(STAFF_SPACE_PX, 6)
    // …and B2 stayed on the bass staff, far below both.
    expect(b2.y - d4.y).toBeGreaterThan(4 * STAFF_SPACE_PX)
  })

  it('⛔ without the crossing the same chord is written on the bass staff — the control', () => {
    const drawn = heads(renderModel(satie(false).model))
    const chordX = Math.min(...drawn.map(h => h.x))
    const chord = drawn.filter(h => h.x === chordX).sort((a, b) => b.y - a.y)
    const reference = drawn.find(h => h.x !== chordX)!
    // D4 above the bass staff is nowhere near the treble's D4.
    expect(Math.abs(chord[1].y - reference.y)).toBeGreaterThan(2 * STAFF_SPACE_PX)
  })

  it('⭐ ONE stem joins them — from the bass head up past the top crossed head', () => {
    const scene = renderModel(satie(true).model)
    const drawn = heads(scene)
    const chordX = Math.min(...drawn.map(h => h.x))
    const chord = drawn.filter(h => h.x === chordX).sort((a, b) => b.y - a.y)
    const [b2, , f4] = chord

    // Two stemmed events in the score (the chord, the reference half note) ⇒ two stems, not four.
    const all = stems(scene)
    expect(all).toHaveLength(2)
    const stem = all.sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top))[0]
    expect(stem.bottom).toBeCloseTo(b2.y, 0)
    expect(stem.top).toBeLessThan(f4.y) // it runs on past the top head, as any up-stem does
    expect(stem.bottom - stem.top).toBeGreaterThan(b2.y - f4.y)
  })

  it('⭐ ledger lines belong to the staff a head is WRITTEN on', () => {
    // On the bass staff D4 and F4 stand above it, on ledger lines 6 and 7. Written on the treble
    // they are inside or beside it (D4 hangs under the bottom line) and owe none.
    expect(ledgers(renderModel(satie(false).model))).toHaveLength(2)
    expect(ledgers(renderModel(satie(true).model))).toHaveLength(0)
  })
})
