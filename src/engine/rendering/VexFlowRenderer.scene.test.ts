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
import { resetBeamSlope, setBeamSlopeRule } from './beamSlopeExperiment'

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
  /**
   * Every stroked two-point horizontal path — what a ledger line is (`engrave/notes/ledgerLines`).
   *
   * 🚨 **…OUTSIDE the stave's own group, and that clause arrived with P5a.** The staff's five lines
   * are the same primitive — a stroked two-point horizontal path — and since P5a they are OUR ink and
   * therefore IN THE SCENE, where before they were VexFlow's and invisible here. ⇒ every count below
   * silently gained five per bar until this filter was added. ⭐ The group is the honest
   * discriminator: a ledger line belongs to a NOTE, a staff line to the STAVE.
   */
  function horizontalStrokes(scene: ReturnType<typeof render>['scene']) {
    const staveInk = new Set(sceneGroups(scene, 'stave').flatMap(g => scenePrimitives(g)))
    return scenePrimitives(scene).filter(p =>
      !staveInk.has(p)
      && p.kind === 'path' && p.painted === 'stroke' && p.ops.length === 2
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

describe('⭐⭐ P3d — the NOTEHEAD in the scene, and the note is complete', () => {
  /** Every glyph stamped inside a `notehead` group — codepoint and anchor. */
  function heads(scene: ReturnType<typeof render>['scene']) {
    return sceneGroups(scene, 'notehead')
      .flatMap(g => g.children.filter(c => c.kind === 'text'))
      .flatMap(t => (t.kind === 'text'
        ? [{ code: t.text.codePointAt(0) ?? 0, x: t.x, y: t.y, font: t.font }]
        : []))
  }

  it('⭐⭐ every note draws its head — a SMuFL notehead glyph, in its own group', () => {
    const drawn = heads(render(2).scene)
    // ⚠️ A REST comes through this group too — VexFlow gives a rest a `StaveNote`, and its glyph is
    // that note's single "head" (`harness.ts` carries the same warning about `g.vf-notehead text`).
    // Two quarters and one half rest a bar, two bars.
    expect(drawn.length, 'four heads and two rests').toBe(6)
    const noteheads = drawn.filter(h => h.code >= 0xe0a0 && h.code <= 0xe0ff)
    expect(noteheads.length, 'four are noteheads (U+E0A0…E0FF)').toBe(4)
    const rests = drawn.filter(h => h.code >= 0xe4e0 && h.code <= 0xe4ff)
    expect(rests.length, '…and two are rests (U+E4E0…E4FF) — beats 3–4 filled as one half').toBe(2)
  })

  it('⭐⭐ …at ASCENDING x, on the same line, in Bravura — the whole geometry, in jsdom', () => {
    const noteheads = heads(render(1).scene).filter(h => h.code >= 0xe0a0 && h.code <= 0xe0ff)
    expect(noteheads.length).toBe(2)
    // ⭐ C4 then E4: the second is to the RIGHT and HIGHER (SVG y grows downward).
    expect(noteheads[1].x, 'the beat-2 note stands right of the beat-1 note').toBeGreaterThan(noteheads[0].x)
    expect(noteheads[1].y, 'E4 sits above C4').toBeLessThan(noteheads[0].y)
    // ⚠️ Two staff spaces apart exactly — C4 to E4 is a third, and a third is one space. The staff
    // space is 10 px, so a diatonic step is 5. ⭐ This is the assertion that needed a browser
    // yesterday and is arithmetic today.
    expect(noteheads[0].y - noteheads[1].y, 'a third = one staff space').toBeCloseTo(10, 6)
    expect(noteheads[0].font.family, 'the face VexFlow resolved for the note').toContain('Bravura')
  })

  // 🚨 The seam, same shape as the stem's: the highlight and a dozen browser specs find a head by
  // `g.vf-notehead`, and its id is how `getSVGElement` resolves one.
  it('🚨 each head’s group carries its own ID — the highlight resolves ink by it', () => {
    const groups = sceneGroups(render(1).scene, 'notehead')
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) expect(g.id, 'an id, or the recolour finds nothing').toBeTruthy()
  })
})

describe('⭐⭐ P4a — the BEAM’s lines, the first ink of P4 in the scene', () => {
  /** One bar of `count` beamed notes of `duration`, filling from beat 0. */
  function beamedBar(count: number, duration: '8' | '16'): ScoreModel {
    const model = new ScoreModel()
    const perNote = duration === '8' ? 2 : 4 // notes to the quarter
    for (let i = 0; i < count; i++) {
      model.addNote({ step: 'C', octave: 4, duration, measure: 1, beat: frac(i, perNote) })
    }
    return model
  }

  /** Every filled quad inside a `beam` group — what `EngravedBeam` draws. */
  function beamQuads(scene: ReturnType<typeof render>['scene']) {
    return sceneGroups(scene, 'beam')
      .flatMap(g => g.children.filter(c => c.kind === 'path'))
      .flatMap(p => (p.kind === 'path' && p.ops[0].op === 'moveTo' && p.ops[1]?.op === 'lineTo'
        ? [{
            startX: p.ops[0].x, startY: p.ops[0].y,
            thickness: p.ops[1].y - p.ops[0].y,
            vertices: p.ops.length, painted: p.painted,
          }]
        : []))
  }

  it('⭐ a beamed pair draws ONE beam line — a filled quad, in its own `beam` group', () => {
    const quads = beamQuads(renderModel(beamedBar(2, '8')).scene)
    expect(quads.length, 'two eighths under one primary beam').toBe(1)
    expect(quads[0].painted, 'a beam is FILLED, ⛔ never stroked').toBe('fill')
    expect(quads[0].vertices, 'four corners and a close').toBe(5)
  })

  it('⭐⭐ …at the beam’s own thickness — Bravura’s half staff space, which is VexFlow’s 5px', () => {
    const quads = beamQuads(renderModel(beamedBar(2, '8')).scene)
    // ⚠️ SIGNED: these notes are low in the treble staff, so the stems are up and the beam is
    // filled downward from its top edge.
    expect(quads[0].thickness, 'stem-up ⇒ filled downward, 0.5 staff spaces').toBe(5)
  })

  it('⭐⭐ sixteenths draw TWO levels, one stride apart — the stack, measured in jsdom', () => {
    const quads = beamQuads(renderModel(beamedBar(2, '16')).scene)
    expect(quads.length, 'a primary beam and a secondary').toBe(2)
    // ⭐ `beamLevelY`'s 1.5 × thickness, asserted as drawn ink rather than as arithmetic —
    // the assertion that needed a browser before the scene existed.
    expect(quads[1].startY - quads[0].startY).toBeCloseTo(1.5 * 5, 6)
    expect(quads[1].startX, 'both levels start at the same stem').toBeCloseTo(quads[0].startX, 6)
  })

  it('⭐ the beamed notes still draw their stems — P3c’s ink, drawn BY the beam', () => {
    // 🚨 The break-test for `drawStems`: `StaveNote.draw` skips a stem whose `beam` is set, so if
    // the override below ever stopped calling it, four notes would stand with no stems at all and
    // the beam would float. (Two beams of two here — the meter's own grouping.)
    const { scene } = renderModel(beamedBar(4, '8'))
    expect(sceneGroups(scene, 'stem').length, 'one stem per beamed note').toBe(4)
    expect(beamQuads(scene).length, '…and a beam line over each pair').toBeGreaterThanOrEqual(2)
  })

  // 🚨 THE SEAM. The element registry files a beam's hit box off `getBoundingBox()`, and
  // `Element.getSVGElement()` resolves ink by `getElementById(prefix(id))`. Open the group without
  // the id and beam selection silently stops resolving, with nothing failing.
  it('🚨 the beam’s group carries its own ID — the registry and the highlight resolve by it', () => {
    const groups = sceneGroups(renderModel(beamedBar(2, '8')).scene, 'beam')
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) expect(g.id, 'an id, or the beam is unreachable').toBeTruthy()
  })
})

describe('⭐⭐ P4b — the beam’s SLOPE, and it is the first step that MOVES PIXELS', () => {
  /** One bar of two beamed quavers, `interval` diatonic steps apart, low in the treble staff. */
  function pair(interval: number): ScoreModel {
    const ladder = [
      ['E', 4], ['F', 4], ['G', 4], ['A', 4], ['B', 4], ['C', 5], ['D', 5], ['E', 5],
    ] as const
    const model = new ScoreModel()
    model.addNote({ step: 'E', octave: 4, duration: '8', measure: 1, beat: frac(0, 2) })
    model.addNote({
      step: ladder[interval][0], octave: ladder[interval][1],
      duration: '8', measure: 1, beat: frac(1, 2),
    })
    return model
  }

  /** The primary beam line's climb and run, in staff spaces. */
  function beamRun(model: ScoreModel) {
    const { scene } = renderModel(model)
    const quad = sceneGroups(scene, 'beam')
      .flatMap(g => g.children.filter(c => c.kind === 'path'))
      .flatMap(p => (p.kind === 'path' && p.ops[0].op === 'moveTo' && p.ops[3]?.op === 'lineTo'
        ? [{ rise: Math.abs(p.ops[3].y - p.ops[0].y) / 10, run: Math.abs(p.ops[3].x - p.ops[0].x) / 10 }]
        : []))[0]
    return quad
  }

  it('⭐⭐ two quavers stand 2.5 spaces apart — so Gould’s width rule governs every one of them', () => {
    const drawn = beamRun(pair(4))
    // ⚠️ This assertion is the REASON the rule bites here, and it is our own spacing law speaking:
    // `layout/spacing` runs LILYPOND's log law (his call), which gives a quaver 2.40 spaces.
    // ⛔ NOT Gould's √2 power law — that is `GOULD_SPACING`, present and unused (corrected 2026-09-01).
    expect(drawn.run, 'first stem to last stem').toBeCloseTo(2.5, 1)
  })

  // ⚠️ ARMED EXPLICITLY, and that is the point of the file after his call of 2026-09-01: the ACTIVE
  // rule is `vexflow` — P4b moved no pixel — so a test that asserted the tradition's numbers without
  // arming them would be asserting a rule nobody is running.
  it('⭐⭐ …and under `musescore` such a beam climbs at most a QUARTER space, whatever the interval', () => {
    setBeamSlopeRule('musescore')
    try {
      for (const interval of [1, 2, 3, 4, 5, 6, 7]) {
        expect(beamRun(pair(interval)).rise, `an interval of ${interval + 1} at 2.5 spaces’ width`)
          .toBeLessThanOrEqual(0.25 + 1e-6)
      }
    } finally { resetBeamSlope() }
  })

  it('⭐ …while the ACTIVE rule (`vexflow`, his call) leaves them where they always were', () => {
    // The measured "before P4b" table is in `docs/beam-slope-research.md` §3: a 4th and everything
    // wider drew 0.60 spaces. ⭐ This asserts P4b moved NO PIXEL — the whole shape of that decision.
    expect(beamRun(pair(7)).rise, 'an octave').toBeCloseTo(0.6, 2)
    expect(beamRun(pair(1)).rise, 'a 2nd').toBeCloseTo(0.24, 2)
  })

  // 🚨🚨 THE REGRESSION TEST FOR A LIVE BUG REPORT — *"im changing it but dont see any difference on
  // screen"* (2026-09-01). Arming a rule bumped `beamSlopeGeneration()`, which was in the renderer's
  // VIEW key… and a beam is drawn INSIDE a measure group, so every group was REUSED and the old
  // beams were replayed. Nothing failed. The generation had to go in the SHAPE key as well.
  // ⚠️ This test renders the SAME renderer twice on purpose: a fresh renderer has nothing to reuse,
  // so a per-render fixture would pass while the app stayed broken.
  it('🚨🚨 arming a different rule REDRAWS — the same renderer, twice, with the bar reused', () => {
    const model = pair(7) // an octave: the rules differ most here
    const renderer = makeRenderer()
    const riseOf = (scene: ReturnType<typeof render>['scene']) => {
      const p = sceneGroups(scene, 'beam').flatMap(g => g.children.filter(c => c.kind === 'path'))[0]
      return p?.kind === 'path' && p.ops[0].op === 'moveTo' && p.ops[3]?.op === 'lineTo'
        ? Math.abs(p.ops[3].y - p.ops[0].y) / 10 : NaN
    }
    const first = renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
    setBeamSlopeRule('musescore')
    try {
      const second = renderer.recordScene(() => renderer.renderScore(model.getScore())).scene
      expect(riseOf(second), '`musescore` flattens an octave that `vexflow` lets climb')
        .toBeLessThan(riseOf(first))
    } finally {
      resetBeamSlope()
    }
  })

  it('⛔ a unison stays flat', () => {
    // 🚨 AND IT IS ALSO THE BREAK-TEST FOR `FLAT_SLOPE_RANGE`. A unison's budget is zero, and
    // VexFlow's slope search steps by `(max - min) / 20` — so if the adapter ever passes a
    // zero-width range, this test does not FAIL, it HANGS the thread. A timeout here means that
    // guard was removed (`EngravedBeam`), not that an assertion is wrong.
    expect(beamRun(pair(0)).rise).toBeCloseTo(0, 6)
  })
})

describe('⭐⭐ P5b — the CLEF in the scene, the first symbol of the HEADER that is ours', () => {
  /** Every glyph stamped inside a `clef` group — codepoint, anchor, and the face it was drawn in. */
  function clefs(scene: ReturnType<typeof render>['scene']) {
    return sceneGroups(scene, 'clef')
      .flatMap(g => g.children.filter(c => c.kind === 'text'))
      .flatMap(t => (t.kind === 'text'
        ? [{ code: t.text.codePointAt(0) ?? 0, x: t.x, y: t.y, font: t.font }]
        : []))
  }

  /**
   * The y of every staff line the STAVE drew, read back out of P5a's own ink.
   *
   * ⚠️ A staff line is STROKED through the middle of its bar (`staffLineStrokeY` — `y + t/2`),
   * so the line's own y is the stroke's minus half the thickness. ⭐ Deriving it here rather than
   * hard-coding 40/50/60… is what makes the assertion below a statement about the RULE.
   */
  function staffLineYs(scene: ReturnType<typeof render>['scene']): number[] {
    return sceneGroups(scene, 'stave')
      .flatMap(g => scenePrimitives(g))
      .flatMap(p => (p.kind === 'path' && p.ops[0]?.op === 'moveTo'
        ? [p.ops[0].y - (p.style.lineWidth ?? 0) / 2]
        : []))
  }

  it('⭐⭐ a treble system draws ONE clef — a SMuFL gClef, in its own group', () => {
    // Four bars, one system, one header clef: VexFlow's `addClef` runs on bar 1 only
    // (`VexFlowRenderer.buildStave`), and nothing else in the score stamps one.
    const drawn = clefs(render(4).scene)
    expect(drawn.length, 'one system, one clef').toBe(1)
    expect(drawn[0].code, 'SMuFL gClef, U+E050').toBe(0xe050)
    expect(drawn[0].font.family, 'the face VexFlow resolved for the clef').toContain('Bravura')
  })

  it('⭐⭐ …and its baseline sits EXACTLY on a staff line — the rule, in jsdom', () => {
    // ⭐ The whole of `clefPlacement`, asserted against the OTHER half of our own scene: P5a drew
    // the five lines, P5b stamps the glyph, and the claim is that the second lands on the first.
    // ⚠️ This needed a browser yesterday — and a font, which is why it could not be checked there
    // either without measuring ink.
    const { scene } = render(2)
    const [clef] = clefs(scene)
    const lines = staffLineYs(scene)
    expect(lines.length, 'five lines per stave, at least one stave').toBeGreaterThanOrEqual(5)
    const onALine = lines.filter(y => Math.abs(y - clef.y) < 1e-6)
    expect(onALine.length, 'the clef stands on a line, not between two').toBeGreaterThan(0)
    // ⭐ …and it is the SECOND LINE UP — the G line, which is what makes it a G clef. The lines
    // come back top-to-bottom, so that is index 3 of the first stave's five.
    const first = lines.slice(0, 5)
    expect(clef.y, 'the G line — second from the bottom').toBeCloseTo(first[3], 10)
  })

  it('⭐ it stands INSIDE the staff’s left edge, and left of every notehead', () => {
    const { scene } = render(2)
    const [clef] = clefs(scene)
    const staveX = sceneGroups(scene, 'stave')
      .flatMap(g => scenePrimitives(g))
      .flatMap(p => (p.kind === 'path' && p.ops[0]?.op === 'moveTo' ? [p.ops[0].x] : []))
    // ⭐ The engraved indentation (`clefIndentPass`, 0.7 sp) — the clef begins inside the edge.
    expect(clef.x, 'indented from the system’s left edge').toBeGreaterThan(Math.min(...staveX))
    const headXs = sceneGroups(scene, 'notehead')
      .flatMap(g => g.children.filter(c => c.kind === 'text'))
      .flatMap(t => (t.kind === 'text' ? [t.x] : []))
    expect(headXs.length).toBeGreaterThan(0)
    expect(clef.x, 'the header runs before the music').toBeLessThan(Math.min(...headXs))
  })

  it('⚠️ a MID-LINE clef change draws a second clef, at VexFlow’s two-thirds — ⏳ unsourced', () => {
    // ⚠️ `Clef.getPoint('small')` is `fontSize * 2 / 3`, and NOTHING in this repo chose that ratio.
    // ⭐ It is question 3 of `docs/clef-research.md`; this assertion exists so that the day someone
    // changes it, a spec says so out loud rather than a picture changing quietly.
    const model = buildScore(4)
    model.setClef(3, 'bass')
    const drawn = clefs(renderModel(model).scene)
    expect(drawn.length, 'the header’s, plus the change at bar 3').toBe(2)
    const [header, change] = drawn
    expect(change.code, 'SMuFL fClef, U+E062').toBe(0xe062)
    expect(change.x, 'the change stands later in the system').toBeGreaterThan(header.x)
    const headerSize = header.font.size
    expect(typeof headerSize, 'the resolved face carries a size').toBe('number')
    expect(change.font.size, 'two thirds of the header clef, floored')
      .toBe(Math.floor(Number(headerSize) * 2 / 3))
  })

  // 🚨 The break-test: every expectation above would pass vacuously on an empty list, and the
  // count is what proves the clef reaches OUR surface rather than VexFlow's.
  it('🚨 the break-test — the clef count RESPONDS to the score', () => {
    expect(clefs(render(1).scene).length, 'one bar, one clef').toBe(1)
    const model = buildScore(2)
    model.setClef(2, 'alto')
    expect(clefs(renderModel(model).scene).length, '…and a change adds one').toBe(2)
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

  it('⭐⭐ the note’s five drawing calls are OURS — only its own GROUP is still VexFlow’s', () => {
    const { scene } = render(2)
    // ⭐ This test used to read *"noteheads and stems are NOT here — that gap is the work left"*.
    // It flipped one piece of ink at a time across P3a–P3d (ledger lines, flag, stem, noteheads),
    // which is the intended signal: the scene's coverage IS the migration's progress.
    // ⚠️ `stavenote` is still absent because the note's OWN group is opened by VexFlow's `draw()`
    // on `vexContext` — that one goes with P1e, not P3.
    const classes = [...walkScene(scene)]
      .filter(n => n.kind === 'group')
      .map(g => (g as { cls?: string }).cls)
    expect(classes, 'the measure group is opened by the renderer itself').toContain('measure')
    expect(classes, '✅ P3a–P3d: the parts of the note are here').toEqual(
      expect.arrayContaining(['notehead', 'stem']))
    expect(classes, '⛔ …but the note’s own group is still VexFlow’s — P1e').not.toContain('stavenote')
  })
})
