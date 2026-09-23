// @vitest-environment jsdom
/**
 * ⭐ BRACKETED GRACES, drawn — through the SCENE (`ScoreRenderer.recordScene`), so where the head and
 * its brackets stand against the principal is arithmetic in jsdom. `docs/plans/bracketed-grace-plan.md` P1.
 *
 * ⚠️ Positions come from the metric TABLES (`fonts/bravuraMetrics`), not a measured glyph — the scene
 * records where a glyph is STAMPED, which is exactly what the layout decided.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { addBracketed } from '../models/bracketedGraceOps'
import { addGrace } from '../models/graceOps'
import { ScoreRenderer } from './ScoreRenderer'
import { BRACKETED_GROUP, BRACKETED_NOTE_GROUP } from './BracketedGracePass'
import { GRACE_GROUP } from './GracePass'
import { sceneGroups, scenePrimitives, type Scene, type SceneGroup } from '@/engine/scene/Scene'
import { bracketedLayout, bracketedScale, resetBracketed, setBracketForm } from '@/engine/layout/bracketedRoom'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { fracCreate as frac } from '@/utils/fraction'
import type { PitchSpelling } from '@/types/music'

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer
}

const Bb4: PitchSpelling = { step: 'B', alter: -1, octave: 4 }
const D5: PitchSpelling = { step: 'D', alter: 0, octave: 5 }
const char = (name: keyof typeof GLYPH_CODEPOINTS) => String.fromCodePoint(GLYPH_CODEPOINTS[name])

/** Bar 1: C5 then E5, quarters (or 16ths); the bracketed grace before the SECOND note. */
function build(opts: { bracketed?: PitchSpelling; grace?: PitchSpelling; sixteenths?: boolean } = {}) {
  const model = new ScoreModel()
  model.addMeasure()
  const duration = opts.sixteenths ? '16' : 'q'
  const step = opts.sixteenths ? frac(1, 4) : frac(1, 1)
  model.addNote({ step: 'C', octave: 5, duration, measure: 1, beat: frac(0, 1) })
  const host = model.addNote({ step: 'E', octave: 5, duration, measure: 1, beat: step })
  if (opts.grace) addGrace(model.getScore(), host.id, 'before', opts.grace, 'appoggiatura', { duration: '8' })
  const bracketed = opts.bracketed ? addBracketed(model.getScore(), host.id, 'before', opts.bracketed) : null
  return { model, host, bracketed }
}

function render(model: ScoreModel): { renderer: ScoreRenderer; scene: Scene } {
  const renderer = makeRenderer()
  const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
  return { renderer, scene }
}

/** The page x of every text primitive in `group` whose glyph is `text` — its placement applied. */
function xsOf(group: SceneGroup, text: string, scale = group.placement.a): number[] {
  return group.children.flatMap(c => (c.kind === 'text' && c.text === text ? [c.x * scale] : []))
}

/** The principal heads' x's — every notehead outside a grace or bracketed group. */
function mainHeadXs(scene: Scene): number[] {
  const inside = new Set([
    ...sceneGroups(scene, GRACE_GROUP).flatMap(g => sceneGroups(g, 'notehead')),
    ...sceneGroups(scene, BRACKETED_GROUP).flatMap(g => sceneGroups(g, 'notehead')),
  ])
  return sceneGroups(scene, 'notehead').filter(g => !inside.has(g))
    .flatMap(g => g.children.flatMap(c => (c.kind === 'text' ? [c.x] : [])))
}

/** The bracketed head's scaled group, and its head's page x. */
function bracketedHead(scene: Scene): { head: SceneGroup; headX: number } {
  const head = sceneGroups(scene, 'bracketedhead')[0]
  const x = sceneGroups(head, 'notehead')[0].children.flatMap(c => (c.kind === 'text' ? [c.x] : []))[0]
  return { head, headX: x * head.placement.a }
}

afterEach(() => resetBracketed())

describe('BracketedGracePass — one bracketed grace before a note', () => {
  it('⭐ draws ONE group with ONE bracketed note, its head scaled by the armed size (B7)', () => {
    const { scene } = render(build({ bracketed: Bb4 }).model)
    const groups = sceneGroups(scene, BRACKETED_GROUP)
    expect(groups).toHaveLength(1)
    expect(sceneGroups(groups[0], BRACKETED_NOTE_GROUP)).toHaveLength(1)
    expect(bracketedHead(scene).head.placement.a).toBeCloseTo(bracketedScale(), 9)
  })

  it('⭐ a BLACK head — a quarter\'s glyph — with ⛔ no stem and no flag', () => {
    setBracketForm('notehead')
    const { scene } = render(build({ bracketed: D5 }).model)
    const group = sceneGroups(scene, BRACKETED_GROUP)[0]
    const texts = scenePrimitives(group).flatMap(p => (p.kind === 'text' ? [p.text] : []))
    expect(texts).toContain(char('noteheadBlack'))
    // D5 sits in the staff — no ledger — so every mark it makes is a GLYPH: a stem would be a stroke.
    expect(scenePrimitives(group).every(p => p.kind === 'text')).toBe(true)
    expect(texts.sort()).toEqual([char('noteheadBlack'), char('noteheadParenthesisLeft'), char('noteheadParenthesisRight')].sort())
    expect(texts.some(t => t.codePointAt(0)! >= 0xe240 && t.codePointAt(0)! <= 0xe25f)).toBe(false) // SMuFL flags
  })

  it('⭐⭐ it stands LEFT of its principal, where the layout says: the head anchor at `headX`', () => {
    const { scene } = render(build({ bracketed: D5 }).model)
    const [, host] = mainHeadXs(scene)
    const { headX } = bracketedHead(scene)
    const expected = bracketedLayout([{ pitches: [{ id: 'x', ...D5 }] }], () => null, 'treble', 0).places[0].headX
    expect((headX - host) / STAFF_SPACE_PX).toBeCloseTo(expected, 6)
    expect(headX).toBeLessThan(host)
  })

  it('⭐ B8: the ACCIDENTAL stands INSIDE the brackets — ( ♭● )', () => {
    setBracketForm('notehead')
    const { scene } = render(build({ bracketed: Bb4 }).model)
    const { head, headX } = bracketedHead(scene)
    const [left] = xsOf(head, char('noteheadParenthesisLeft'))
    const [right] = xsOf(head, char('noteheadParenthesisRight'))
    const [flat] = xsOf(head, char('accidentalFlat'))
    expect(left).toBeLessThan(flat)
    expect(flat).toBeLessThan(headX)
    expect(headX).toBeLessThan(right)
  })

  it('⭐ B9: the ARMED `gould` form draws the ACCIDENTAL brackets at FULL size, outside the head\'s scale', () => {
    const { scene } = render(build({ bracketed: D5 }).model)
    const note = sceneGroups(scene, BRACKETED_NOTE_GROUP)[0]
    const { head } = bracketedHead(scene)
    expect(xsOf(head, char('accidentalParensLeft'))).toHaveLength(0)
    expect(xsOf(note, char('accidentalParensLeft'), 1)).toHaveLength(1)
    expect(xsOf(note, char('accidentalParensRight'), 1)).toHaveLength(1)
  })

  it('⭐ with a GRACE group too, the before side reads [grace] (●) main — the grace clears the brackets', () => {
    const { scene } = render(build({ bracketed: D5, grace: { step: 'G', alter: 0, octave: 4 } }).model)
    const grace = sceneGroups(scene, GRACE_GROUP)[0]
    const graceX = sceneGroups(grace, 'notehead')[0].children.flatMap(c => (c.kind === 'text' ? [c.x * grace.placement.a] : []))[0]
    const note = sceneGroups(scene, BRACKETED_NOTE_GROUP)[0]
    const [left] = xsOf(note, char('accidentalParensLeft'), 1) // the armed `gould` pair, full size
    expect(graceX).toBeLessThan(left)
  })

  it('⭐ the bar makes ROOM for it — where the gap is tight, the principal stands further off', () => {
    const plain = mainHeadXs(render(build({ sixteenths: true }).model).scene)
    const withIt = mainHeadXs(render(build({ bracketed: D5, sixteenths: true }).model).scene)
    expect(withIt[1] - withIt[0]).toBeGreaterThan(plain[1] - plain[0])
  })

  it('⛔ until P2 it registers NO hit box — a click cannot select an id the lookups do not know', () => {
    const { model, bracketed } = build({ bracketed: D5 })
    const { renderer } = render(model)
    expect(renderer.getElementRegistry().getByType('note').some(e => e.id === bracketed!.pitches[0].id)).toBe(false)
  })
})
