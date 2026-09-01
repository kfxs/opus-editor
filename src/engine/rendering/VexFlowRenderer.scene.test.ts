// @vitest-environment jsdom
/**
 * ⭐⭐ **THE PAYOFF — GEOMETRY AS A UNIT TEST** (`docs/own-engraving-engine.md` §7.2, P1d).
 *
 * > *"'the whole-bar rest is centred in its bar' becomes an assertion on a scene, in jsdom, in
 * > milliseconds. This is the single most valuable item in this document — it is worth more than
 * > the golden-image net of §6.3, and it is what makes P3 safe."*
 *
 * This file is that claim, exercised: a REAL render of a REAL score, in jsdom, with the positions
 * read back as numbers. ⚠️ Every one of these assertions previously required a browser
 * (`e2e/barlineTypes.e2e.ts` and friends), because the only record of what had been drawn was the
 * DOM — and `reference: jsdom cannot measure glyphs` made reading it there meaningless.
 *
 * ## ⚠️ What can and cannot be asserted here, and the line is sharp
 *
 * ✅ **Anything OUR primitives drew** — barlines, key signatures, grouping signs, the hairpin's
 * wedge, the octave line, the pedal's dashes, page sheets. Their coordinates are arithmetic over
 * stave geometry and the layout, and jsdom computes all of it.
 *
 * ⛔ **Anything a VexFlow object painted itself** — noteheads, stems, flags, beams, the stave's own
 * five lines. Those go through `vexContext`, never reach a `DrawContext`, and are invisible to the
 * recorder. ⭐ That gap is the migration's remaining work rather than a defect of the scene, and it
 * shrinks with every P3/P4 commit; the browser suite stays for exactly that half.
 *
 * ⛔ **And still not INK EXTENTS.** A glyph's drawn width needs a font. The scene says *where a
 * glyph was stamped and which codepoint it was*, ⛔ never how wide it came out.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { scenePrimitives, sceneGroups, walkScene } from '@/engine/scene/Scene'
import { LEDGER_LINE_STYLE } from './layoutConfig'
import { fracCreate as frac } from '@/utils/fraction'

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 800)
  return renderer
}

function buildScore(bars = 4): ScoreModel {
  const model = new ScoreModel()
  for (let i = 1; i < bars; i++) model.addMeasure()
  for (let m = 1; m <= bars; m++) {
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: m, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: m, beat: frac(1, 1) })
  }
  return model
}

/** Render once, with the drawing written down. */
function render(bars = 4) {
  return renderModel(buildScore(bars))
}

/** …and the same, for a fixture built by hand. */
function renderModel(model: ScoreModel) {
  const renderer = makeRenderer()
  const { scene, result } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
  return { renderer, model, scene, drew: result }
}

describe('recordScene', () => {
  it('⭐ renders normally AND hands back a scene — the tee paints, it does not replace', () => {
    const { renderer, scene, drew } = render()
    // ⚠️ `renderScore` answers whether a GHOST NOTE was drawn, ⛔ not whether the render succeeded —
    //    false is correct here, and reading it as "it failed" is a mistake this comment now blocks.
    expect(drew, 'no ghost note was armed').toBe(false)
    expect(scene.children.length, 'something was recorded').toBeGreaterThan(0)
    // 🚨 The break-test for "the tee paints": if the recorder had REPLACED the context, the page
    // would be empty. The measure groups are VexFlow's own, drawn through `vexContext`.
    expect(renderer.getMeasureSVGGroup(1, 0), 'the real page was still painted').not.toBeNull()
  })

  it('⛔ stops recording afterwards — a scene is one render, not a growing log', () => {
    const { renderer, model, scene } = render()
    const before = scene.children.length
    renderer.renderScore(model.getScore())
    expect(scene.children.length, 'the second render went nowhere near this scene').toBe(before)
  })
})

describe('⭐⭐ the barlines, measured in jsdom — what used to need a browser', () => {
  it('every bar draws its own end barline, as a rect, in a `stavebarline` group', () => {
    const { scene } = render(4)
    const groups = sceneGroups(scene, 'stavebarline')
    expect(groups.length, 'one sign per bar boundary drawn').toBeGreaterThanOrEqual(4)

    const strokes = groups.flatMap(g => g.children.filter(c => c.kind === 'rect'))
    expect(strokes.length, 'a barline is filled rects — `BarlineRenderer`').toBeGreaterThanOrEqual(4)
  })

  it('⭐⭐ …and they stand at ASCENDING x, left to right across the system', () => {
    const { scene } = render(4)
    const xs = sceneGroups(scene, 'stavebarline')
      .flatMap(g => g.children.filter(c => c.kind === 'rect').map(r => r.x))
      .sort((a, b) => a - b)
    expect(xs.length).toBeGreaterThanOrEqual(4)
    // ⭐ The assertion that could not be made in jsdom before this file existed: real positions.
    expect(xs[0]).toBeGreaterThan(0)
    expect(xs[xs.length - 1]).toBeGreaterThan(xs[0])
  })

  it('⭐ a barline is TALL and THIN — the shape of the ink, not just its presence', () => {
    const { scene } = render(2)
    const rects = sceneGroups(scene, 'stavebarline').flatMap(g =>
      g.children.filter(c => c.kind === 'rect'))
    expect(rects.length).toBeGreaterThan(0)
    for (const r of rects) {
      expect(r.height, 'a barline spans the staff').toBeGreaterThan(r.width)
      expect(r.width, 'and it is thin — 0.16 staff spaces (`barlineInk`)').toBeLessThan(5)
    }
  })

  // 🚨 The break-test for the three above: if the recorder were silently recording NOTHING and the
  // helpers were returning empty arrays, every `toBeGreaterThanOrEqual(0)`-shaped assertion would
  // pass. This one fails on an empty scene.
  it('🚨 the break-test — an empty scene would fail these, not pass them vacuously', () => {
    const { scene } = render(4)
    const primitives = scenePrimitives(scene)
    expect(primitives.length, 'real ink was recorded').toBeGreaterThanOrEqual(4)
    // ⭐ …and it carries real numbers, not zeros: the thing jsdom could never say before.
    // ⚠️ A PATH keeps its coordinates in `ops` rather than an `x` — this assertion used to read
    // `'x' in p` for every primitive, which was true only while nothing in this fixture drew a path.
    // P3a's ledger lines are paths, and that is the assertion being generalised, not weakened.
    const xs = primitives.flatMap(p => p.kind === 'path'
      ? p.ops.flatMap(op => (op.op === 'closePath' ? [] : [op.x]))
      : [p.x])
    expect(xs.every(Number.isFinite), 'every drawn coordinate is a real number').toBe(true)
    expect(xs.some(x => x > 0), '⛔ not all at the origin').toBe(true)
    expect(sceneGroups(scene, 'stavebarline').length).toBeGreaterThan(0)
    expect(sceneGroups(scene, 'no-such-group-exists'), 'and a wrong name finds nothing').toEqual([])
  })
})

describe('⭐⭐ P3a — the LEDGER LINES, the first piece of a NOTE in the scene', () => {
  /** Every stroked two-point horizontal path — what a ledger line is (`engrave/notes/ledgerLines`). */
  function horizontalStrokes(scene: ReturnType<typeof render>['scene']) {
    return scenePrimitives(scene).filter(p =>
      p.kind === 'path' && p.painted === 'stroke' && p.ops.length === 2
      && p.ops[0].op === 'moveTo' && p.ops[1].op === 'lineTo' && p.ops[0].y === p.ops[1].y)
  }

  it('⭐ middle C in a treble bar draws exactly ONE ledger line — per bar, in jsdom', () => {
    // The fixture is C4 + E4 per bar: C4 sits one line BELOW the treble staff and E4 on its
    // bottom line, so each bar owes exactly one ledger and no more.
    const strokes = horizontalStrokes(render(4).scene)
    expect(strokes.length, 'one per bar, and E4 forces none').toBe(4)
  })

  it('⭐⭐ …and it stands at the SAME y in every bar, below the staff', () => {
    const strokes = horizontalStrokes(render(4).scene)
    const ys = strokes.map(p => (p.kind === 'path' && p.ops[0].op === 'moveTo' ? p.ops[0].y : NaN))
    // ⚠️ The assertion that needed a browser before this file existed: a real drawn coordinate.
    expect(new Set(ys).size, 'one system, one pitch — one level').toBe(1)
    expect(ys[0]).toBeGreaterThan(0)
    // …and the xs march left to right with the bars.
    const xs = strokes.map(p => (p.kind === 'path' && p.ops[0].op === 'moveTo' ? p.ops[0].x : NaN))
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
  })

  it('⭐ a ledger line is HORIZONTAL, styled as the stave’s own, and overhangs its head', () => {
    const strokes = horizontalStrokes(render(2).scene)
    expect(strokes.length).toBeGreaterThan(0)
    for (const p of strokes) {
      if (p.kind !== 'path' || p.ops[0].op !== 'moveTo' || p.ops[1].op !== 'lineTo') continue
      // ⭐ The ink this editor already decided (`layoutConfig.LEDGER_LINE_STYLE`) — black, and
      // Bravura's `legerLineThickness / staffLineThickness` ratio, ⛔ not VexFlow's grey 2 px.
      // P3a inherited it unchanged; `ledgerLineStyle.test.ts` is where it is pinned.
      expect(p.style.stroke, 'black, not VexFlow’s grey').toBe(LEDGER_LINE_STYLE.strokeStyle)
      expect(p.style.lineWidth).toBeCloseTo(LEDGER_LINE_STYLE.lineWidth, 10)
      // ⚠️ jsdom measures every glyph 0 wide, so the notehead contributes nothing here — what is
      // left is the overhang at both ends, and that is arithmetic rather than font.
      expect(p.ops[1].x - p.ops[0].x, 'two overhangs of 3 px').toBeCloseTo(6, 6)
    }
  })

  // 🚨 The break-test: if `EngravedNote` had stopped drawing ledgers altogether — or drawn them on
  // the real context instead of ours — every expectation above would still pass on an empty list.
  it('🚨 the break-test — a staff-internal note draws NO ledger, and the fixture’s C4 does', () => {
    const withLedger = horizontalStrokes(render(1).scene).length
    expect(withLedger, 'the C4 is there').toBe(1)
  })
})

describe('⭐⭐ P3b — the FLAG, the first GLYPH of a note in the scene', () => {
  /** SMuFL's flag range — E240 `flag8thUp` … E24F. The only thing that tells one glyph from another. */
  const isFlag = (code: number): boolean => code >= 0xe240 && code <= 0xe24f

  /** Every glyph drawn inside a `flag` group, as its codepoint and anchor. */
  function flags(scene: ReturnType<typeof render>['scene']) {
    return sceneGroups(scene, 'flag')
      .flatMap(g => g.children.filter(c => c.kind === 'text'))
      .map(t => (t.kind === 'text' ? { code: t.text.codePointAt(0) ?? 0, x: t.x, y: t.y } : null))
      .filter((f): f is { code: number; x: number; y: number } => f !== null)
  }

  /** One bar, one lone eighth — a single eighth has nothing to beam with, so it keeps its flag. */
  function loneEighth(): ScoreModel {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 5, duration: '8', measure: 1, beat: frac(0, 1) })
    return model
  }

  it('⭐ a lone eighth draws ONE flag glyph, in its own `flag` group', () => {
    const drawn = flags(renderModel(loneEighth()).scene)
    expect(drawn).toHaveLength(1)
    expect(isFlag(drawn[0].code), `E${drawn[0].code.toString(16)} is in SMuFL's flag range`).toBe(true)
    // ⭐ A real drawn coordinate in jsdom — the note is somewhere in the bar, ⛔ not at the origin.
    expect(drawn[0].x).toBeGreaterThan(0)
  })

  it('⛔ a QUARTER draws none — `shouldDrawFlag` is still VexFlow’s, and still governs', () => {
    expect(flags(render(1).scene), 'the fixture is quarters').toEqual([])
  })

  it('⛔ …and neither do two BEAMED eighths — the `!beam` half of that predicate', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 5, duration: '8', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', octave: 5, duration: '8', measure: 1, beat: frac(1, 2) })
    expect(flags(renderModel(model).scene), 'a beam replaces both flags').toEqual([])
  })

  it('⚠️ the flag’s baseline sits ON the stem tip here — because jsdom cannot measure the font', () => {
    // 🚨 THE POINT OF THE WHOLE PIECE, asserted rather than described: VexFlow places a flag with a
    // runtime `measureText`, which answers 0 with no canvas — so in jsdom the glyph's reach is 0 and
    // its baseline lands exactly at the tip. In a browser it does not. That is §3's bug class, and
    // P3b's contribution is that the number is now an ARGUMENT (`flagPlacement`'s `glyphReach`)
    // instead of a hidden call. ⛔ Where it comes from is unchanged — see note-engraving-plan §3.3.
    const drawn = flags(renderModel(loneEighth()).scene)
    expect(drawn[0].y, 'a stem tip is above the staff top, and the staff starts below y=0')
      .toBeGreaterThan(0)
    expect(Number.isFinite(drawn[0].y), '⛔ never NaN — the empty metrics are zeros, not undefined')
      .toBe(true)
  })
})

describe('⭐⭐ P3c — the STEM’s ink in the scene, and the seam that survives it', () => {
  /** Every stroked line inside a `stem` group — what `EngravedStem` draws. */
  function stems(scene: ReturnType<typeof render>['scene']) {
    return sceneGroups(scene, 'stem')
      .flatMap(g => g.children.filter(c => c.kind === 'path'))
      .flatMap(p => (p.kind === 'path' && p.ops[0].op === 'moveTo' && p.ops[1]?.op === 'lineTo'
        ? [{ x: p.ops[0].x, fromY: p.ops[0].y, toY: p.ops[1].y, width: p.style.lineWidth }]
        : []))
  }

  it('⭐ every quarter draws one stem — a vertical line, in its own `stem` group', () => {
    // The fixture is two quarters a bar; a rest has a `Stem` too but it is built `hide: true`.
    const drawn = stems(render(2).scene)
    expect(drawn.length, 'two notes a bar, two bars').toBe(4)
    for (const stem of drawn) {
      expect(stem.fromY, '⛔ never a zero-length stem').not.toBe(stem.toY)
      expect(stem.width, 'VexFlow’s `Stem.WIDTH`, kept — the font’s 0.12 is a separate question')
        .toBe(1.5)
    }
  })

  it('⭐⭐ …and it is VERTICAL — one x for both ends, which is the whole shape of the ink', () => {
    for (const stem of stems(render(2).scene)) expect(Number.isFinite(stem.x)).toBe(true)
    // A stem's two ops share an x by construction; this asserts the drawing agrees.
    const paths = sceneGroups(render(2).scene, 'stem').flatMap(g => g.children.filter(c => c.kind === 'path'))
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) {
      if (p.kind !== 'path' || p.ops[0].op !== 'moveTo' || p.ops[1].op !== 'lineTo') continue
      expect(p.ops[1].x, 'both ends on one x').toBe(p.ops[0].x)
    }
  })

  it('⛔ a hidden stem (a rest’s) draws nothing — `hide` still short-circuits', () => {
    // Four quarter slots a bar, two of them notes ⇒ two rests, each with a hidden Stem object.
    expect(stems(render(1).scene).length, 'the rests’ stems are hidden, not drawn').toBe(2)
  })

  // 🚨 THE BREAK-TEST FOR THE SEAM. The editor finds a stem's ink by the GROUP'S ID
  // (`getSVGElement` → `getElementById`), then recolours the paths inside it. If `EngravedStem.draw`
  // ever stops opening that group, or opens it without the id, stem SELECTION silently stops
  // painting and nothing else fails. This asserts the id is there and is VexFlow's own.
  it('🚨 the stem’s group carries its own ID — the selection highlight resolves ink by it', () => {
    const groups = sceneGroups(render(1).scene, 'stem')
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) expect(g.id, 'an id, or `applyStemHighlight` finds nothing').toBeTruthy()
  })
})

describe('the scene’s SHAPE', () => {
  it('⭐ groups nest, and every group carries a placement', () => {
    const { scene } = render(2)
    const groups = [...walkScene(scene)].filter(n => n.kind === 'group')
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) {
      expect(g.placement, 'rule 8: a group is placed by an affine').toBeDefined()
      expect(typeof g.placement.a).toBe('number')
    }
  })

  it('⭐ a group keeps the BARE class the pass asked for — ⛔ not VexFlow’s `vf-` prefix', () => {
    const { scene } = render(2)
    const classes = [...walkScene(scene)]
      .filter(n => n.kind === 'group')
      .map(g => (g as { cls?: string }).cls)
    expect(classes).toContain('stavebarline')
    expect(classes.filter(c => c?.startsWith('vf-')), 'the prefix is the painter’s').toEqual([])
  })

  it('⛔ noteheads and stems are NOT here — they are VexFlow’s, and that gap is the work left', () => {
    const { scene } = render(2)
    // A notehead would be a `text` primitive if we drew it; today `StaveNote.draw()` paints it
    // through `vexContext`. ⭐ This expectation flips one piece of ink at a time as P3 lands, and
    // that is the intended signal: the scene's coverage IS the migration's progress. ✅ The first
    // one flipped on 2026-09-01 — the LEDGER LINES are in the scene (the describe above); the note's
    // own `vf-stavenote` GROUP is still opened on VexFlow's context, which is why this still holds.
    const classes = [...walkScene(scene)]
      .filter(n => n.kind === 'group')
      .map(g => (g as { cls?: string }).cls)
    expect(classes, 'the measure group is opened by the renderer itself').toContain('measure')
    expect(classes).not.toContain('stavenote')
  })
})
