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
import { addBracketed, removeBracketed } from '../models/bracketedGraceOps'
import { addGrace } from '../models/graceOps'
import { ScoreRenderer } from './ScoreRenderer'
import { BRACKETED_GROUP, BRACKETED_NOTE_GROUP } from './BracketedGracePass'
import { GRACE_BEAM_GROUP, GRACE_GROUP } from './GracePass'
import { sceneGroups, scenePrimitives, type Scene, type SceneGroup } from '@/engine/scene/Scene'
import { bracketedAfterLayout, bracketedLayout, bracketedScale, resetBracketed, setBracketForm } from '@/engine/layout/bracketedRoom'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { INK } from '@/engine/layout/spacingPadding'
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

/** The bracketed grace's own (scaled) group, and its head's page x. */
function bracketedHead(scene: Scene): { head: SceneGroup; headX: number } {
  const head = sceneGroups(scene, BRACKETED_NOTE_GROUP)[0]
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

  it('⭐ B7 REVISED (his call): its HEAD is its written value\'s — a half\'s is HOLLOW, a quarter\'s black', () => {
    const { model, bracketed } = build({ bracketed: D5 })
    bracketed!.duration = 'h'
    const texts = scenePrimitives(sceneGroups(render(model).scene, BRACKETED_GROUP)[0]).flatMap(p => (p.kind === 'text' ? [p.text] : []))
    expect(texts).toContain(char('noteheadHalf'))
    expect(texts).not.toContain(char('noteheadBlack'))
  })

  it('⭐⭐ it stands LEFT of its principal, where the layout says: the head anchor at `headX`', () => {
    const { scene } = render(build({ bracketed: D5 }).model)
    const [, host] = mainHeadXs(scene)
    const { headX } = bracketedHead(scene)
    const expected = bracketedLayout([{ pitches: [{ id: 'x', ...D5 }], duration: 'q' }], () => null, 'treble', 0).places[0].headX
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

  it('⭐ B9: the ARMED `gould` form draws the ACCIDENTAL brackets at FULL size — stamped at 1 / k in the scaled group', () => {
    const { scene } = render(build({ bracketed: D5 }).model)
    const { head } = bracketedHead(scene)
    const parens = head.children.filter(c => c.kind === 'text' && c.text === char('accidentalParensLeft'))
    expect(parens).toHaveLength(1)
    const size = parens[0].kind === 'text' ? parseFloat(String(parens[0].font.size)) : 0
    expect(size * bracketedScale()).toBeCloseTo(30, 6) // MUSIC_FONT_SIZE_PT on the page
  })

  it('⭐ his report: EVERY piece of its ink is a DIRECT child of its group — what the selection highlight walks', () => {
    const { scene } = render(build({ bracketed: Bb4 }).model)
    const { head } = bracketedHead(scene)
    const direct = head.children.flatMap(c => (c.kind === 'text' ? [c.text] : []))
    expect(direct).toContain(char('accidentalFlat'))
    expect(direct).toContain(char('accidentalParensLeft'))
    expect(head.children.filter(c => c.kind === 'group').every(g => g.kind === 'group' && g.cls === 'notehead')).toBe(true)
  })

  it('⭐ with a GRACE group too, the before side reads [grace] (●) main — the grace clears the brackets', () => {
    const { scene } = render(build({ bracketed: D5, grace: { step: 'G', alter: 0, octave: 4 } }).model)
    const grace = sceneGroups(scene, GRACE_GROUP)[0]
    const graceX = sceneGroups(grace, 'notehead')[0].children.flatMap(c => (c.kind === 'text' ? [c.x * grace.placement.a] : []))[0]
    const note = sceneGroups(scene, BRACKETED_NOTE_GROUP)[0]
    const [left] = xsOf(note, char('accidentalParensLeft')) // the armed `gould` pair
    expect(graceX).toBeLessThan(left)
  })

  it('⭐ the bar makes ROOM for it — where the gap is tight, the principal stands further off', () => {
    const plain = mainHeadXs(render(build({ sixteenths: true }).model).scene)
    const withIt = mainHeadXs(render(build({ bracketed: D5, sixteenths: true }).model).scene)
    expect(withIt[1] - withIt[0]).toBeGreaterThan(plain[1] - plain[0])
  })

  it('⭐ B10 REVERSED: on a REST (an empty beat) it is drawn before the rest, as a grace there is', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    addBracketed(model.getScore(), rest.id, 'before', D5)
    const { scene } = render(model)
    expect(sceneGroups(scene, BRACKETED_GROUP)).toHaveLength(1)
    expect(sceneGroups(scene, BRACKETED_GROUP)[0].id).toBe(`${BRACKETED_GROUP}-${rest.id}`)
  })

  it('⭐ P2b: each head is a NOTE in the registry under its pitch id — WITHOUT a beat, the grace\'s reason', () => {
    const { model, bracketed } = build({ bracketed: D5 })
    const { renderer } = render(model)
    const entry = renderer.getElementRegistry().getByType('note').find(e => e.id === bracketed!.pitches[0].id)
    expect(entry).toBeDefined()
    expect(entry!.beat).toBeUndefined()
    expect(entry!.measure).toBe(1)
  })

describe('BracketedGracePass — P3: bent INTO a grace, the beam splits', () => {
  /** E5 with three beamed 8th graces before it — G4 A4 C5. */
  function graced() {
    const model = new ScoreModel()
    model.addMeasure()
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const graces = (['G', 'A', 'C'] as const).map((step, i) =>
      addGrace(model.getScore(), host.id, 'before', { step, alter: 0, octave: i === 2 ? 5 : 4 }, 'acciaccatura', { duration: '8' })!)
    return { model, host, graces }
  }
  const beams = (scene: Scene) => sceneGroups(sceneGroups(scene, GRACE_GROUP)[0], GRACE_BEAM_GROUP)

  it('⭐ one beam before; a bracket on the SECOND grace breaks it — [g1] (●) [g2 g3], the bracket between', () => {
    const { model, graces } = graced()
    expect(beams(render(model).scene)).toHaveLength(1)
    const made = addBracketed(model.getScore(), graces[1].pitches[0].id, 'before', D5)!
    const { scene } = render(model)
    expect(beams(scene)).toHaveLength(1) // g2 g3 beamed; g1 alone keeps its flag
    const grace = sceneGroups(scene, GRACE_GROUP)[0]
    const xs = sceneGroups(grace, 'notehead').map(g => g.children.flatMap(c => (c.kind === 'text' ? [c.x * grace.placement.a] : []))[0])
    const note = sceneGroups(scene, BRACKETED_NOTE_GROUP)[0]
    const [left] = xsOf(note, char('accidentalParensLeft'))
    expect(left).toBeGreaterThan(xs[0])
    expect(left).toBeLessThan(xs[1])
    expect(made.pitches[0].id).toBeTruthy()
  })

  it('⭐ B4: removing the bracket JOINS the beam again — nothing was stored but the bracket', () => {
    const { model, graces } = graced()
    const made = addBracketed(model.getScore(), graces[1].pitches[0].id, 'before', D5)!
    removeBracketed(model.getScore(), made.pitches[0].id)
    const { scene } = render(model)
    expect(beams(scene)).toHaveLength(1)
    expect(sceneGroups(beams(scene)[0], 'notehead')).toHaveLength(0)
    expect(sceneGroups(scene, BRACKETED_GROUP)).toHaveLength(0)
  })

  it('…and with four graces, [g1 g2] (●) [g3 g4]: TWO beams, each the group\'s own form', () => {
    const { model, host, graces } = graced()
    addGrace(model.getScore(), host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'acciaccatura', { duration: '8' })
    addBracketed(model.getScore(), graces[2].pitches[0].id, 'before', D5)
    expect(beams(render(model).scene)).toHaveLength(2)
  })
})

describe('BracketedGracePass — its hand OFFSET', () => {
  it('⭐ moves the bracketed grace ALONE, by that many staff spaces — its principal, the bar and the room stay', () => {
    const plain = build({ bracketed: D5 })
    const moved = build({ bracketed: D5 })
    moved.model.nudgeNoteOffset(moved.model.offsetTargetOf(moved.bracketed!.pitches[0].id)!.key, -1)
    const a = render(plain.model)
    const b = render(moved.model)
    expect(mainHeadXs(b.scene)).toEqual(mainHeadXs(a.scene))
    expect((bracketedHead(a.scene).headX - bracketedHead(b.scene).headX) / STAFF_SPACE_PX).toBeCloseTo(1, 6)
    // …and its HIT BOX with it, so a click lands where it is drawn.
    const hitX = (r: ReturnType<typeof render>, id: string) => r.renderer.getElementRegistry().getByType('note').find(e => e.id === id)!.bbox.x
    expect((hitX(a, plain.bracketed!.pitches[0].id) - hitX(b, moved.bracketed!.pitches[0].id)) / STAFF_SPACE_PX).toBeCloseTo(1, 6)
  })
})
})

describe('BracketedGracePass — P5: AFTER its note (the trill note, a bend\'s target)', () => {
  /** C5 then E5 (quarters, or 16ths), a bracketed grace AFTER the FIRST note. */
  function after(opts: { sixteenths?: boolean; dots?: number } = {}) {
    const model = new ScoreModel()
    model.addMeasure()
    const duration = opts.sixteenths ? '16' : 'q'
    const first = model.addNote({ step: 'C', octave: 5, duration, measure: 1, beat: frac(0, 1), ...(opts.dots && { dots: opts.dots }) })
    model.addNote({ step: 'E', octave: 5, duration, measure: 1, beat: opts.sixteenths ? frac(1, 4) : frac(opts.dots ? 3 : 2, 2) })
    const made = addBracketed(model.getScore(), first.id, 'after', D5)!
    return { model, first, made }
  }

  it('⭐ stands RIGHT of its note and LEFT of the next — where the layout says', () => {
    const { model } = after()
    const { scene } = render(model)
    const [host, next] = mainHeadXs(scene)
    const { headX } = bracketedHead(scene)
    expect(headX).toBeGreaterThan(host)
    expect(headX).toBeLessThan(next)
    const expected = bracketedAfterLayout([{ pitches: [{ id: 'x', ...D5 }], duration: 'q' }], () => null, 'treble', { reach: INK.notehead, dotted: false })
    expect((headX - host) / STAFF_SPACE_PX).toBeCloseTo(expected.places[0].headX, 6)
  })

  it('⭐ the bar makes ROOM for it — where the gap is tight, the next note stands further off', () => {
    const plain = new ScoreModel()
    plain.addMeasure()
    plain.addNote({ step: 'C', octave: 5, duration: '16', measure: 1, beat: frac(0, 1) })
    plain.addNote({ step: 'E', octave: 5, duration: '16', measure: 1, beat: frac(1, 4) })
    const a = mainHeadXs(render(plain).scene)
    const b = mainHeadXs(render(after({ sixteenths: true }).model).scene)
    expect(b[1] - b[0]).toBeGreaterThan(a[1] - a[0])
  })

  it('it is a NOTE in the registry and is lit like one — its offset moves it alone', () => {
    const { model, made } = after()
    const { renderer } = render(model)
    expect(renderer.getElementRegistry().getByType('note').some(e => e.id === made.pitches[0].id)).toBe(true)
    const moved = after()
    moved.model.nudgeNoteOffset(moved.model.offsetTargetOf(moved.made.pitches[0].id)!.key, 1)
    const x0 = bracketedHead(render(model).scene).headX
    const x1 = bracketedHead(render(moved.model).scene).headX
    expect((x1 - x0) / STAFF_SPACE_PX).toBeCloseTo(1, 6)
  })
})
