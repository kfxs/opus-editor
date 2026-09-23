// @vitest-environment jsdom
/**
 * ⭐ GRACE NOTES, drawn — through the SCENE (`ScoreRenderer.recordScene`), so where the grace stands
 * against its principal is arithmetic in jsdom. `docs/plans/grace-notes-plan.md` §5, P1.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { addGrace, type GraceForm } from '../models/graceOps'
import { beatRestAt } from '../models/restGraceOps'
import { setEnclosure } from '../models/enclosureOps'
import { ENCLOSURE_GLYPHS } from '@/engine/layout/headEnclosure'
import { ScoreRenderer } from './ScoreRenderer'
import { GRACE_BEAM_GROUP, GRACE_GROUP, GRACE_NOTE_GROUP } from './GracePass'
import { sceneGroups, scenePrimitives, type SceneGroup } from '@/engine/scene/Scene'
import { graceScale } from '@/engine/layout/graceRoom'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { fracCreate as frac } from '@/utils/fraction'
import type { NoteDuration, PitchSpelling } from '@/types/music'

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer
}

/** Bar 1: C5 E5 quarters; bar 2: two quarters. A grace before the bar's SECOND note, unless told. */
function build(opts: { grace?: PitchSpelling; form?: GraceForm; hostBeat?: number; sixteenths?: boolean; written?: NoteDuration; dots?: number } = {}) {
  const model = new ScoreModel()
  model.addMeasure()
  const duration = opts.sixteenths ? '16' : 'q'
  const step = opts.sixteenths ? frac(1, 4) : frac(1, 1)
  const first = model.addNote({ step: 'C', octave: 5, duration, measure: 1, beat: frac(0, 1) })
  const second = model.addNote({ step: 'E', octave: 5, duration, measure: 1, beat: step })
  const host = (opts.hostBeat ?? 1) === 0 ? first : second
  const grace = opts.grace
    ? addGrace(model.getScore(), host.id, 'before', opts.grace, opts.form ?? 'acciaccatura', { duration: opts.written ?? '8', ...(opts.dots && { dots: opts.dots }) })
    : null
  return { model, first, second, host, grace }
}

function render(model: ScoreModel) {
  const renderer = makeRenderer()
  const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
  return { renderer, scene }
}

/** The notehead x's of every head NOT inside a grace group, in page px. */
function mainHeadXs(scene: ReturnType<typeof render>['scene']): number[] {
  const inGrace = new Set(sceneGroups(scene, GRACE_GROUP).flatMap(g => sceneGroups(g, 'notehead')))
  return sceneGroups(scene, 'notehead')
    .filter(g => !inGrace.has(g))
    .flatMap(g => g.children.flatMap(c => (c.kind === 'text' ? [c.x] : [])))
}

/** A grace group's head x's in PAGE px — its placement is `scaling(k)`, about the origin. */
function graceHeadXs(group: SceneGroup): number[] {
  return sceneGroups(group, 'notehead').flatMap(g => g.children.flatMap(c => (c.kind === 'text' ? [c.x * group.placement.a] : [])))
}

describe('GracePass — one grace before a note', () => {
  it('⭐ draws ONE grace group, scaled by the grace size (D5), with one note in it', () => {
    const { model } = build({ grace: { step: 'D', alter: 0, octave: 5 } })
    const { scene } = render(model)
    const groups = sceneGroups(scene, GRACE_GROUP)
    expect(groups).toHaveLength(1)
    expect(groups[0].placement.a).toBeCloseTo(graceScale(), 9)
    expect(groups[0].placement.d).toBeCloseTo(graceScale(), 9)
    expect(sceneGroups(groups[0], GRACE_NOTE_GROUP)).toHaveLength(1)
  })

  it('⭐⭐ the grace stands LEFT of its principal and RIGHT of the note before it', () => {
    const { model } = build({ grace: { step: 'D', alter: 0, octave: 5 } })
    const { scene } = render(model)
    const [before, host] = mainHeadXs(scene)
    const [grace] = graceHeadXs(sceneGroups(scene, GRACE_GROUP)[0])
    expect(grace).toBeLessThan(host)
    expect(grace).toBeGreaterThan(before)
    // The last grace's head clears the principal by `toMain` (1.15 sp) — edge to edge, so its
    // anchor stands `toMain + its own width` left of the principal's.
    const graceWidth = (host - grace) / STAFF_SPACE_PX
    expect(graceWidth).toBeGreaterThan(1.15)
    expect(graceWidth).toBeLessThan(1.15 + 1.2)
  })

  it('⭐ its OFFSET moves the grace alone — by that many staff spaces; its principal and the bar stay put', () => {
    const plain = build({ grace: { step: 'D', alter: 0, octave: 5 } })
    const moved = build({ grace: { step: 'D', alter: 0, octave: 5 } })
    moved.model.nudgeNoteOffset(moved.grace!.pitches[0].id, -1)
    const a = render(plain.model).scene
    const b = render(moved.model).scene
    expect(mainHeadXs(b)).toEqual(mainHeadXs(a))
    const [graceA] = graceHeadXs(sceneGroups(a, GRACE_GROUP)[0])
    const [graceB] = graceHeadXs(sceneGroups(b, GRACE_GROUP)[0])
    expect((graceA - graceB) / STAFF_SPACE_PX).toBeCloseTo(1, 6)
  })

  it('⭐ the bar makes ROOM for it — where the gap is tight, the principal stands further off', () => {
    // ⚠️ 16ths: a quarter's own space already holds one grace (the floor never binds there — the
    //    grace is UNFIXED ink of the gap, plan §4), so only a dense bar shows the room being bought.
    const plain = mainHeadXs(render(build({ sixteenths: true }).model).scene)
    const graced = mainHeadXs(render(build({ grace: { step: 'D', alter: 0, octave: 5 }, sixteenths: true }).model).scene)
    expect(graced[1] - graced[0]).toBeGreaterThan(plain[1] - plain[0])
  })

  it('…and in a quarter’s gap it fits without moving anything', () => {
    const plain = mainHeadXs(render(build().model).scene)
    const graced = mainHeadXs(render(build({ grace: { step: 'D', alter: 0, octave: 5 } }).model).scene)
    expect(graced[1] - graced[0]).toBeCloseTo(plain[1] - plain[0], 6)
  })

  it('⭐ at the bar START, the grace stands inside the bar — its principal moves right', () => {
    const plain = mainHeadXs(render(build().model).scene)
    const { scene } = render(build({ grace: { step: 'D', alter: 0, octave: 5 }, hostBeat: 0 }).model)
    const graced = mainHeadXs(scene)
    expect(graced[0]).toBeGreaterThan(plain[0])
  })

  it('⭐ an acciaccatura draws a SLASH — the FONT\'s glyph, E564, as the beamed group\'s is; an appoggiatura does not', () => {
    const slashes = (form: GraceForm) => {
      const { scene } = render(build({ grace: { step: 'D', alter: 0, octave: 5 }, form }).model)
      return scenePrimitives(sceneGroups(scene, GRACE_GROUP)[0])
        .filter(p => p.kind === 'text' && p.text === String.fromCodePoint(0xe564)).length
    }
    expect(slashes('acciaccatura')).toBe(1)
    expect(slashes('appoggiatura')).toBe(0)
  })

  it('⛔ draws NO slur of its own — a slur is the user\'s (his call, 2026-09-22)', () => {
    const { scene } = render(build({ grace: { step: 'D', alter: 0, octave: 5 }, form: 'appoggiatura' }).model)
    const group = sceneGroups(scene, GRACE_GROUP)[0]
    const note = sceneGroups(group, GRACE_NOTE_GROUP)[0]
    expect(scenePrimitives(group).length, 'everything drawn is the note\'s own ink').toBe(scenePrimitives(note).length)
  })

  it('⭐ registers the grace head as a NOTE under its pitch id — and WITHOUT a beat', () => {
    const { model, grace } = build({ grace: { step: 'D', alter: 0, octave: 5 } })
    const { renderer } = render(model)
    const id = grace!.pitches[0].id
    const entry = renderer.getElementRegistry().getByType('note').find(e => e.id === id)
    expect(entry, 'a click can name it').toBeDefined()
    expect(entry!.beat, 'the beat anchors stay the principal’s').toBeUndefined()
    expect(entry!.measure).toBe(1)
  })

  it('a grace on a ledger line draws its own ledger, inside the grace group', () => {
    const { scene } = render(build({ grace: { step: 'A', alter: 0, octave: 5 } }).model)
    const withLedger = scenePrimitives(sceneGroups(scene, GRACE_GROUP)[0]).filter(p => p.kind === 'path').length
    const { scene: plainScene } = render(build({ grace: { step: 'D', alter: 0, octave: 5 } }).model)
    const without = scenePrimitives(sceneGroups(plainScene, GRACE_GROUP)[0]).filter(p => p.kind === 'path').length
    expect(withLedger).toBe(without + 1)
  })
})

describe('GracePass — a grace before a REST (D7 reversed)', () => {
  it('⭐ draws the grace, left of the rest, and registers it', () => {
    const model = new ScoreModel()
    const rest = beatRestAt(model.getScore(), model.getMeasure(1)!.slots[0].id, frac(1, 1))!
    const grace = addGrace(model.getScore(), rest.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    const { renderer, scene } = render(model)
    expect(sceneGroups(scene, GRACE_GROUP)).toHaveLength(1)
    expect(renderer.getElementRegistry().getByType('note').some(e => e.id === grace.pitches[0].id)).toBe(true)
  })
})

describe('GracePass — a grace on low ledger lines grows its stem (Gould p. 126)', () => {
  /** The grace stem's length in page px — the one path in the note group that runs vertically. */
  const stemPx = (spelling: PitchSpelling) => {
    const { scene } = render(build({ grace: spelling }).model)
    const group = sceneGroups(scene, GRACE_GROUP)[0]
    const note = sceneGroups(group, GRACE_NOTE_GROUP)[0]
    const lengths = scenePrimitives(note).flatMap(p => {
      if (p.kind !== 'path') return []
      const pts = p.ops.flatMap(op => ('x' in op && 'y' in op ? [{ x: op.x as number, y: op.y as number }] : []))
      if (pts.length !== 2 || Math.abs(pts[0].x - pts[1].x) > 1e-6) return []
      return [Math.abs(pts[0].y - pts[1].y) * group.placement.a]
    })
    return Math.max(...lengths)
  }
  it('G3 draws a longer stem than D5 — by what the rule says', () => {
    const d5 = stemPx({ step: 'D', alter: 0, octave: 5 })
    const g3 = stemPx({ step: 'G', alter: 0, octave: 3 })
    expect(d5 / STAFF_SPACE_PX).toBeCloseTo(2.5, 1)
    expect(g3 / STAFF_SPACE_PX).toBeCloseTo(3.3, 1)
  })
})

describe('GracePass — the slash by what the note HAS (his rule, 2026-09-22)', () => {
  const strokes = (form: GraceForm, written: NoteDuration) => {
    const { scene } = render(build({ grace: { step: 'D', alter: 0, octave: 5 }, form, written }).model)
    return scenePrimitives(sceneGroups(scene, GRACE_GROUP)[0]).filter(p => p.kind === 'path').length
  }
  it('a QUARTER and a HALF acciaccatura are slashed — at their own position', () => {
    expect(strokes('acciaccatura', 'q')).toBe(strokes('appoggiatura', 'q') + 1)
    expect(strokes('acciaccatura', 'h')).toBe(strokes('appoggiatura', 'h') + 1)
  })
  it('⛔ a WHOLE (no stem) draws no slash', () => {
    expect(strokes('acciaccatura', 'w')).toBe(strokes('appoggiatura', 'w'))
  })
})

describe('GracePass — a DOTTED grace', () => {
  const dotTexts = (dots: number, step: PitchSpelling['step']) => {
    const { scene } = render(build({ grace: { step, alter: 0, octave: 5 }, dots }).model)
    const note = sceneGroups(sceneGroups(scene, GRACE_GROUP)[0], GRACE_NOTE_GROUP)[0]
    return scenePrimitives(note).flatMap(p => (p.kind === 'text' && p.text === String.fromCodePoint(0xe1e7) ? [p] : []))
  }
  it('⭐ draws its dots, right of the head', () => {
    expect(dotTexts(1, 'D')).toHaveLength(1)
    expect(dotTexts(2, 'D')).toHaveLength(2)
    expect(dotTexts(0, 'D')).toHaveLength(0)
  })
  it('a head on a LINE lifts its dot into the space above; one in a space keeps it level', () => {
    const headAndDot = (step: PitchSpelling['step']) => {
      const { scene } = render(build({ grace: { step, alter: 0, octave: 5 }, dots: 1 }).model)
      const note = sceneGroups(sceneGroups(scene, GRACE_GROUP)[0], GRACE_NOTE_GROUP)[0]
      const texts = scenePrimitives(note).flatMap(p => (p.kind === 'text' ? [p] : []))
      const dot = texts.find(t => t.text === String.fromCodePoint(0xe1e7))!
      const head = sceneGroups(note, 'notehead')[0].children.find(c => c.kind === 'text')!
      return { dotY: dot.y, headY: head.kind === 'text' ? head.y : NaN }
    }
    const onLine = headAndDot('D') // D5 — the 4th line in treble
    expect(onLine.dotY).toBeLessThan(onLine.headY)
    const inSpace = headAndDot('E') // E5 — the space above it
    expect(inSpace.dotY).toBeCloseTo(inSpace.headY, 6)
  })
})

describe('GracePass — a grace\'s ARTICULATIONS (Gould p. 125: "scaled down proportionally")', () => {
  it('⭐ draws the mark inside the grace, and registers it on the grace\'s pitch so it can be clicked', () => {
    const { model, grace } = build({ grace: { step: 'D', alter: 0, octave: 5 }, form: 'appoggiatura' })
    grace!.articulations = ['staccato']
    const { renderer, scene } = render(model)
    const note = sceneGroups(sceneGroups(scene, GRACE_GROUP)[0], GRACE_NOTE_GROUP)[0]
    const plain = render(build({ grace: { step: 'D', alter: 0, octave: 5 }, form: 'appoggiatura' }).model).scene
    const plainNote = sceneGroups(sceneGroups(plain, GRACE_GROUP)[0], GRACE_NOTE_GROUP)[0]
    const texts = (g: SceneGroup) => scenePrimitives(g).filter(p => p.kind === 'text').length
    expect(texts(note), 'one more glyph: the staccato').toBe(texts(plainNote) + 1)
    const entry = renderer.getElementRegistry().getByType('articulation').find(e => e.noteId === grace!.pitches[0].id)
    expect(entry?.articulationType).toBe('staccato')
  })
})

describe('GracePass — a BEAMED group (P2b)', () => {
  /** A group of graces before bar 1's second note, of these written values. */
  const group = (...durations: NoteDuration[]) => {
    const { model, host } = build()
    const steps: PitchSpelling['step'][] = ['D', 'C', 'B', 'A']
    durations.forEach((duration, i) =>
      addGrace(model.getScore(), host.id, 'before', { step: steps[i], alter: 0, octave: 5 }, 'appoggiatura', { duration }))
    return sceneGroups(render(model).scene, GRACE_GROUP)[0]
  }
  /** The glyphs drawn inside each grace's own group — a head, plus a flag when it has one. */
  const glyphsPerGrace = (g: SceneGroup) =>
    sceneGroups(g, GRACE_NOTE_GROUP).map(n => scenePrimitives(n).filter(p => p.kind === 'text').length)

  it('⭐ three 8ths: ONE beam, drawn OUTSIDE every grace\'s own group, and no flags', () => {
    const g = group('8', '8', '8')
    const beams = sceneGroups(g, GRACE_BEAM_GROUP)
    expect(beams).toHaveLength(1)
    for (const note of sceneGroups(g, GRACE_NOTE_GROUP)) expect(sceneGroups(note, GRACE_BEAM_GROUP)).toHaveLength(0)
    expect(scenePrimitives(beams[0]).filter(p => p.kind === 'path')).toHaveLength(1) // one line
    const lone = sceneGroups(render(build({ grace: { step: 'D', alter: 0, octave: 5 }, form: 'appoggiatura' }).model).scene, GRACE_GROUP)[0]
    const flagged = glyphsPerGrace(lone)[0]
    expect(glyphsPerGrace(g)).toEqual([flagged - 1, flagged - 1, flagged - 1]) // the flag is gone
  })

  it('two 16ths draw TWO lines; an 8th + a 16th a full one and a fractional one', () => {
    expect(scenePrimitives(sceneGroups(group('16', '16'), GRACE_BEAM_GROUP)[0]).filter(p => p.kind === 'path')).toHaveLength(2)
    expect(scenePrimitives(sceneGroups(group('8', '16'), GRACE_BEAM_GROUP)[0]).filter(p => p.kind === 'path')).toHaveLength(2)
  })

  it('⭐ P2c — an ACCIACCATURA\'s beam carries ONE slash — the FONT\'s glyph, E564; an appoggiatura\'s none', () => {
    const beamStrokes = (form: GraceForm) => {
      const { model, host } = build()
      for (const step of ['D', 'C', 'B'] as const)
        addGrace(model.getScore(), host.id, 'before', { step, alter: 0, octave: 5 }, form, { duration: '8' })
      const g = sceneGroups(render(model).scene, GRACE_GROUP)[0]
      const strokes = (n: SceneGroup) => scenePrimitives(n).filter(p => p.kind === 'path' && p.painted === 'stroke').length
      const slashes = (n: SceneGroup) => scenePrimitives(n).filter(p => p.kind === 'text' && p.text === String.fromCodePoint(0xe564)).length
      return {
        onBeam: slashes(sceneGroups(g, GRACE_BEAM_GROUP)[0]),
        // A grace's own group holds its stem (a stroke) — and no slash of its own.
        perGrace: sceneGroups(g, GRACE_NOTE_GROUP).map(strokes),
      }
    }
    const acc = beamStrokes('acciaccatura')
    const app = beamStrokes('appoggiatura')
    expect(acc.onBeam).toBe(1)
    expect(app.onBeam).toBe(0)
    expect(acc.perGrace).toEqual(app.perGrace)
  })

  it('a QUARTER breaks the run — no beam, and the 8ths keep their flags', () => {
    const g = group('8', 'q', '8')
    expect(sceneGroups(g, GRACE_BEAM_GROUP)).toHaveLength(0)
  })
})

describe('GracePass — STEMS DOWN (P6, `X`)', () => {
  const glyphs = (g: SceneGroup) => scenePrimitives(g).flatMap(p => (p.kind === 'text' ? [p.text] : []))
  /** The graces before bar 1's second note, flipped when `down`. */
  const drawn = (down: boolean, durations: NoteDuration[] = ['8'], form: GraceForm = 'acciaccatura') => {
    const { model, host } = build()
    const steps: PitchSpelling['step'][] = ['D', 'C', 'B']
    durations.forEach((duration, i) =>
      addGrace(model.getScore(), host.id, 'before', { step: steps[i], alter: 0, octave: 5 }, form, { duration }))
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord' && s.graceBefore)!
    if (down && slot.type === 'chord') slot.graceBefore!.stemDirection = 'down'
    return sceneGroups(render(model).scene, GRACE_GROUP)[0]
  }

  it('⭐ a flipped grace takes the DOWN flag and the DOWN slash glyph (E565) — ⛔ neither up one', () => {
    const up = glyphs(drawn(false))
    const down = glyphs(drawn(true))
    const cp = (name: keyof typeof GLYPH_CODEPOINTS) => String.fromCodePoint(GLYPH_CODEPOINTS[name])
    expect(up).toEqual(expect.arrayContaining([cp('flag8thUp'), cp('graceNoteSlashStemUp')]))
    expect(down).toEqual(expect.arrayContaining([cp('flag8thDown'), cp('graceNoteSlashStemDown')]))
    expect(down).not.toContain(cp('flag8thUp'))
    expect(down).not.toContain(cp('graceNoteSlashStemUp'))
  })

  it('⭐ a flipped BEAMED group: its beam lies BELOW the heads; its slash is E565', () => {
    const lowestY = (g: SceneGroup) => Math.max(...scenePrimitives(g).flatMap(p => (p.kind === 'path'
      ? p.ops.flatMap(op => ('y' in op ? [op.y as number] : [])) : [])))
    const headY = (g: SceneGroup) => Math.max(...sceneGroups(g, 'notehead').flatMap(n => n.children.flatMap(c => (c.kind === 'text' ? [c.y] : []))))
    const up = drawn(false, ['8', '8'])
    const down = drawn(true, ['8', '8'])
    expect(lowestY(sceneGroups(up, GRACE_BEAM_GROUP)[0])).toBeLessThan(headY(up))
    expect(lowestY(sceneGroups(down, GRACE_BEAM_GROUP)[0])).toBeGreaterThan(headY(down))
    expect(glyphs(sceneGroups(down, GRACE_BEAM_GROUP)[0])).toEqual([String.fromCodePoint(GLYPH_CODEPOINTS.graceNoteSlashStemDown)])
  })
})

describe('GracePass — the AUTHORED beam (his report, 2026-09-23: "similar to normal notes")', () => {
  it('⭐ a `begin` in a beamed group splits it into two beams; `auto` joins it again', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const graces = (['G', 'A', 'B', 'C'] as const).map(step =>
      addGrace(model.getScore(), host.id, 'before', { step, alter: 0, octave: step === 'C' ? 5 : 4 }, 'appoggiatura', { duration: '8' })!)
    const beams = () => sceneGroups(sceneGroups(render(model).scene, GRACE_GROUP)[0], GRACE_BEAM_GROUP).length
    expect(beams()).toBe(1)
    graces[2].beam = 'begin'
    expect(beams()).toBe(2)
    delete graces[2].beam
    expect(beams()).toBe(1)
  })
})

describe('GracePass — a PARENTHESISED grace (parenthesised-note-plan P3)', () => {
  it('⭐ its round pair is stamped INSIDE its own member group (so the highlight reaches it), at the grace\'s size', () => {
    const { model, grace } = build({ grace: { step: 'D', alter: 0, octave: 5 } })
    setEnclosure(model.getScore(), [grace!.pitches[0].id], 'round')
    const { scene } = render(model)
    const outer = sceneGroups(scene, GRACE_GROUP)[0]
    expect(outer.placement.a).toBeCloseTo(graceScale(), 9)
    const texts = scenePrimitives(sceneGroups(outer, GRACE_NOTE_GROUP)[0]).flatMap(p => (p.kind === 'text' ? [p.text] : []))
    const char = (n: keyof typeof GLYPH_CODEPOINTS) => String.fromCodePoint(GLYPH_CODEPOINTS[n])
    expect(texts).toContain(char(ENCLOSURE_GLYPHS.round.left))
    expect(texts).toContain(char(ENCLOSURE_GLYPHS.round.right))
  })
})

