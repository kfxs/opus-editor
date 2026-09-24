// @vitest-environment jsdom
/**
 * Subject: `./EngravedNote` — ⭐ **a CUE note carries its own size** (docs/plans/cue-size-plan.md §2, P1). The
 * same dotted C♯4 eighth in two bars, the second cue: what the note stamps and strokes, read off the SCENE.
 *
 * ✅ In jsdom: each glyph's FONT size (the head, accidental, dot and flag), the stem's LENGTH, the ledger's
 * overhang and weight — arithmetic, not ink. ⛔ Not a glyph's drawn WIDTH (jsdom measures 0): that is the
 * browser's (`e2e/cueSize.e2e.ts`).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { sceneGroups, type Scene, type SceneGroup, type SceneNode } from '@/engine/scene/Scene'
import { setCue } from '../../models/cueOps'
import { resetCueSize, setCueLedger, setCueSize } from '@/engine/layout/cueSize'
import { STEM_LENGTH_PX } from '@/engine/engrave/inheritedDefaults'
import { fracCreate as frac } from '@/utils/fraction'

/** Two bars, one dotted C♯4 eighth each (a ledger, a sign, a dot, a flag); bar 2's is cue. */
function render(): Scene {
  const model = new ScoreModel()
  model.addMeasure()
  const note = (measure: number) => model.addNote({ step: 'C', alter: 1, octave: 4, duration: '8', dots: 1, measure, beat: frac(0, 1) })
  note(1)
  setCue(model.getScore(), [note(2).id], true)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  return renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
}

/** Per bar, in order: the note's drawn parts. */
function parts(scene: Scene) {
  return sceneGroups(scene, 'measure').map(bar => {
    const size = (cls: string, code?: number) => sceneGroups(bar, cls)
      .flatMap(g => g.children)
      .filter(c => c.kind === 'text' && (code === undefined || c.text.codePointAt(0) === code))
      .map(c => (c.kind === 'text' ? Number(c.font.size) : NaN))[0]
    const stem = sceneGroups(bar, 'stem').flatMap(g => g.children)
      .find(c => c.kind === 'path')
    // A ledger line: a stroked horizontal path straight under the bar's group (⛔ the stave's own lines are in `stave`).
    const ledger = (bar as SceneGroup).children.find(c => c.kind === 'path' && c.ops.length === 2)
    const span = (p: SceneNode | undefined, axis: 'x' | 'y') =>
      p?.kind === 'path' && p.ops[0].op === 'moveTo' && p.ops[1].op === 'lineTo' ? Math.abs(p.ops[1][axis] - p.ops[0][axis]) : NaN
    return {
      head: size('notehead', 0xe0a4),
      accidental: size('accidental'),
      dot: size('dot'),
      flag: size('flag'),
      stem: span(stem, 'y'),
      ledgerLength: span(ledger, 'x'),
      ledgerWeight: ledger?.kind === 'path' ? Number(ledger.style.lineWidth) : NaN,
    }
  })
}

describe('EngravedNote — a CUE note draws at its size', () => {
  afterEach(() => resetCueSize())

  it('⭐ the armed ¾ (gouldRoss): head, accidental, dot and flag at ¾ of the font', () => {
    const [full, cue] = parts(render())
    expect(full.head).toBe(30)
    for (const part of ['head', 'accidental', 'dot', 'flag'] as const) {
      expect(cue[part], part).toBeCloseTo(full[part] * 0.75, 6)
    }
  })

  it('⭐ the stem is ¾ as LONG (a negative extension, VexFlow’s GraceNote shape) — ⛔ its weight stays', () => {
    const [full, cue] = parts(render())
    expect(full.stem - cue.stem).toBeCloseTo(STEM_LENGTH_PX * 0.25, 0)
  })

  it('⭐ the ledger: ¾ the overhang, and ¾ the WEIGHT under the `gould` row (C6); `full` keeps the system’s', () => {
    const [full, cue] = parts(render())
    expect(cue.ledgerLength).toBeCloseTo(full.ledgerLength * 0.75, 6)
    expect(cue.ledgerWeight).toBeCloseTo(full.ledgerWeight * 0.75, 6)
    setCueLedger('full')
    const [full2, cue2] = parts(render())
    expect(cue2.ledgerWeight).toBeCloseTo(full2.ledgerWeight, 6)
  })

  it('⭐ the size is a PRESET: re-armed, the drawing follows (musescore 0.7)', () => {
    setCueSize('musescore')
    const [full, cue] = parts(render())
    expect(cue.head).toBeCloseTo(full.head * 0.7, 6)
  })

  it('⛔ a full-size note is exactly what it was', () => {
    const [full] = parts(render())
    expect(full).toMatchObject({ head: 30, accidental: 30, dot: 30, flag: 30 })
  })
})

describe('EngravedNote — a CUE REST (P3)', () => {
  afterEach(() => resetCueSize())

  /** Bar 1 a full dotted quarter rest, bar 2 the same rest cue, bar 3 a cue WHOLE-BAR rest. */
  function restGlyphs() {
    const model = new ScoreModel()
    model.addMeasure()
    model.addMeasure()
    for (const bar of [1, 2]) {
      model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: bar, beat: frac(0, 1) })
      model.updateNote(model.getMeasure(bar)!.slots.find(s => s.type === 'rest')!.id, { duration: 'q', dots: 1 })
    }
    const restAt = (bar: number) => model.getMeasure(bar)!.slots.find(s => s.type === 'rest')!.id
    setCue(model.getScore(), [restAt(2), restAt(3)], true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1200, 800)
    const scene = renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
    return sceneGroups(scene, 'measure').map(bar => {
      const texts = sceneGroups(bar, 'notehead').flatMap(g => g.children)
      const rest = texts.find(c => c.kind === 'text' && (c.text.codePointAt(0) ?? 0) >= 0xe4e0 && (c.text.codePointAt(0) ?? 0) <= 0xe4ff)
      const dot = sceneGroups(bar, 'dot').flatMap(g => g.children).find(c => c.kind === 'text')
      return {
        size: rest?.kind === 'text' ? Number(rest.font.size) : NaN,
        y: rest?.kind === 'text' ? rest.y : NaN,
        dot: dot?.kind === 'text' ? Number(dot.font.size) : undefined,
      }
    })
  }

  it('⭐ drawn at ¾, on the SAME line as a full rest (MuseScore: the line placed, the glyph scaled)', () => {
    const [full, cue] = restGlyphs()
    expect(full.size).toBe(30)
    expect(cue.size).toBeCloseTo(22.5, 6)
    expect(cue.y).toBeCloseTo(full.y, 6)
  })

  it('⭐ its dot is its size', () => {
    const [full, cue] = restGlyphs()
    expect(full.dot).toBe(30)
    expect(cue.dot).toBeCloseTo(22.5, 6)
  })

  it('⭐ a cue WHOLE-BAR rest too', () => {
    const [, , measureRest] = restGlyphs()
    expect(measureRest.size).toBeCloseTo(22.5, 6)
  })
})
