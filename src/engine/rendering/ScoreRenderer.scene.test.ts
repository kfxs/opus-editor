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
 * ⛔ **Anything a VexFlow object still paints itself** — today the FAN's own noteheads, accidentals
 * and marks (U2, blocked on U3's highlight), and the ghosts. 🚨 ⛔ **And `lint:paint` will not tell
 * you which**: it counts the identifier `vexContext`, which a MODIFIER never writes — the accidental,
 * the dot and the articulation were missing from this file's scenes for four migration steps without
 * moving that number by one (`docs/note-engraving-plan.md` §1f, §1g). ⭐ Hence the CENSUS below: the
 * page's glyphs, diffed against the scene's.
 * ⭐ That gap is the migration's remaining work rather than a defect of the scene, and it shrinks
 * with every commit: the noteheads, stems, flags and ledger lines arrived with P3, the beams with
 * P4, the staff's five lines, the clef, the meter and the opening barline with P5 — ⇒ ⭐⭐ **nothing
 * a score STAVE draws is outside the scene any more** — **every slur and tie arc with U1**, and with
 * P3f/P3g every MODIFIER glyph an ordinary note carries.
 * The browser suite stays for exactly that half.
 *
 * ⛔ **And still not INK EXTENTS.** A glyph's drawn width needs a font. The scene says *where a
 * glyph was stamped and which codepoint it was*, ⛔ never how wide it came out.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { scenePrimitives, sceneGroups, walkScene } from '@/engine/scene/Scene'
import { LEDGER_LINE_STYLE } from './layoutConfig'
import { THIN_BARLINE_PX } from './barlineInk'
import { STAVE_LINE_WIDTH_PX, staffLineMidY } from '@/engine/engrave/staff/staffLines'
import { meterOriginX } from '@/engine/engrave/header/meter'
import { armedClefMeterInk } from '@/engine/layout/clefMeterGap'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCreate as frac } from '@/utils/fraction'
import { resetBeamSlope, setBeamSlopeRule } from './beamSlopeExperiment'

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
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
    // that note's single "head" (`harness.ts` carries the same warning about `g.notehead text`).
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
  // `g.notehead`, and its id is how `getSVGElement` resolves one.
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
    // (`ScoreRenderer.buildStave`), and nothing else in the score stamps one.
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
    // ⭐ The engraved indentation (`headerPlacementPass`, 0.7 sp) — the clef begins inside the edge.
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

describe('⭐⭐ P5b — the METER in the scene, the second symbol of the HEADER that is ours', () => {
  /** Every numeral stamped inside a `timesignature` group — codepoint, anchor, and its face. */
  function meters(scene: ReturnType<typeof render>['scene']) {
    return sceneGroups(scene, 'timesignature')
      .map(g => g.children.flatMap(c => (c.kind === 'text'
        ? [{ code: c.text.codePointAt(0) ?? 0, x: c.x, y: c.y, font: c.font }]
        : [])))
  }

  /**
   * The y of every staff line the STAVE drew, read back out of P5a's own ink — the twin of the clef
   * block's, and it is the same derivation for the same reason: a staff line is STROKED through the
   * middle of its bar (`staffLineStrokeY` — `y + t/2`), so the line's own y is the stroke's minus
   * half the thickness. ⭐ Deriving it beats hard-coding 40/50/60…, which would make the assertions
   * below statements about numbers rather than about the RULE.
   */
  function staffLineYs(scene: ReturnType<typeof render>['scene']): number[] {
    return sceneGroups(scene, 'stave')
      .flatMap(g => scenePrimitives(g))
      .flatMap(p => (p.kind === 'path' && p.ops[0]?.op === 'moveTo'
        ? [p.ops[0].y - (p.style.lineWidth ?? 0) / 2]
        : []))
  }

  it('⭐⭐ a 4/4 system draws ONE meter — TWO numerals, in one group', () => {
    // ⚠️ The default meter is 4/4 and only bar 1 draws it (`drawsTimeSignature`), so a four-bar
    // score has exactly one sign — of exactly two glyphs, because a numeric meter is TWO ROWS.
    const drawn = meters(render(4).scene)
    expect(drawn.length, 'one system, one meter').toBe(1)
    expect(drawn[0].length, 'a numerator and a denominator').toBe(2)
    // SMuFL `timeSig4`, U+E084 — `0xe080 + the digit`, which is how VexFlow builds it too.
    expect(drawn[0].map(n => n.code), 'four over four').toEqual([0xe084, 0xe084])
    expect(drawn[0][0].font.family, 'the face VexFlow resolved for the meter').toContain('Bravura')
  })

  it('⭐⭐ …and each numeral is CENTRED ON a staff line — the 2nd and the 4th — in jsdom', () => {
    // ⭐ The whole of `meterRowBaseline`, asserted against the OTHER half of our own scene, exactly
    // as the clef's rule is: P5a drew the five lines, P5b stamps the glyphs, and the claim is that
    // the second lands on the first. ⚠️ A numeral is CENTRED on that line rather than sitting on
    // it — the digit is cut symmetric about its own origin (`engrave/header/meter`, and
    // `meter.test.ts` checks that premise against the font's table).
    const { scene } = render(2)
    const [[top, bottom]] = meters(scene)
    const lines = staffLineYs(scene).slice(0, 5)
    expect(lines.length, 'five lines on the first stave').toBe(5)
    // The lines come back top-to-bottom: index 1 is the second from the top, index 3 the fourth.
    expect(top.y, 'the numerator on the 2nd line down').toBeCloseTo(lines[1], 10)
    expect(bottom.y, 'the denominator on the 4th').toBeCloseTo(lines[3], 10)
  })

  it('⭐ …so the pair EXACTLY FILLS the staff — Gould p. 152, as arithmetic', () => {
    // ⭐⭐ The two numerals are two staff spaces tall and centred on their baselines, so rows two
    // LINES apart put the upper across the staff's top half and the lower across its bottom half,
    // meeting on the middle line. ⚠️ Asserted as a RATIO of the staff's own height, ⛔ not in
    // pixels, so a change of staff size cannot make it pass vacuously.
    const { scene } = render(2)
    const [[top, bottom]] = meters(scene)
    const lines = staffLineYs(scene).slice(0, 5)
    const staffHeight = lines[4] - lines[0]
    expect((bottom.y - top.y) / staffHeight, 'half the staff between the two baselines')
      .toBeCloseTo(0.5, 10)
    // ⭐ And the pair is centred on the staff: the middle line is midway between the baselines.
    expect((top.y + bottom.y) / 2, 'centred on the middle line').toBeCloseTo(lines[2], 10)
    // ⛔ The GAP between the rows is not asserted as a NUMBER on purpose: it is UNKNOWN in every
    // treatise (`docs/header-spacing-research.md` row H) and falls out of the two lines VexFlow
    // names. What is pinned here is the SHAPE — symmetric, filling the staff.
  })

  it('⭐ the numerals stack on ONE x, and the sign stands before the music', () => {
    const { scene } = render(2)
    const [[top, bottom]] = meters(scene)
    // ⚠️ Equal digits are equally wide, so 4/4 centres both rows on the same x. A row's own x is
    // VexFlow's `topStartX`/`botStartX` centring, which this step deliberately did NOT take.
    expect(bottom.x, 'the two rows are centred on each other').toBeCloseTo(top.x, 10)
    const headXs = sceneGroups(scene, 'notehead')
      .flatMap(g => g.children.flatMap(c => (c.kind === 'text' ? [c.x] : [])))
    expect(headXs.length).toBeGreaterThan(0)
    expect(top.x, 'the header runs before the music').toBeLessThan(Math.min(...headXs))
  })

  it('⭐⭐ the CLEF→METER ORDER and its GAP — assertable HERE as of P5b’s placement step', () => {
    // ⭐⭐⭐ **THIS ASSERTION USED TO SAY THE OPPOSITE, AND THAT WAS THE POINT.** Until the placement
    // became ours it read *"a zero-width clef advances the walk by nothing"* and pinned the clef and
    // the meter at THE SAME x — a passing statement of a jsdom LIMIT, written so that it would fail
    // the day the limit lifted. It failed on 2026-09-13, in the run that lifted it.
    //
    // 🚨 The limit was real and worth recording: `Stave.format()` advanced its begin walk by each
    // modifier's `Element.getWidth()`, a runtime `measureText` that is 0 in jsdom — and worse, the
    // walk reads `padding = getPadding(i + offset)` and decrements `offset` when `padding + width`
    // is zero, so a zero-width clef ATE the meter's padding and no armed gap could show up here.
    // ⇒ ⭐ **placing from `glyphBox` instead of walking past a `measureText` is what moved the
    // header's horizontal order out of the browser and into this file.**
    const { scene } = render(2)
    const [[top]] = meters(scene)
    const clefX = sceneGroups(scene, 'clef')
      .flatMap(g => g.children.flatMap(c => (c.kind === 'text' ? [c.x] : [])))
    expect(clefX.length, 'the header has a clef').toBe(1)
    expect(top.x, 'the meter stands RIGHT of the clef').toBeGreaterThan(clefX[0])

    // ⭐ …and at the stated distance: the clef's ink right (the FONT's, not a measured box) plus the
    // armed clef→meter white, converted to an origin by the digit's own bearing. Every term is a
    // number we chose, which is why it is checkable without a font.
    const inkRight = clefX[0] + glyphBox('gClef').right * STAFF_SPACE_PX
    expect(top.x, 'the armed gap, ink to ink')
      .toBeCloseTo(meterOriginX(inkRight + armedClefMeterInk() * STAFF_SPACE_PX,
        glyphBox('timeSig4').left, STAFF_SPACE_PX), 6)
  })

  it('⭐ a mid-score METER CHANGE draws a second sign, with its own digits', () => {
    const model = buildScore(4)
    model.setTimeSignature(3, { numerator: 3, denominator: 4 })
    const drawn = meters(renderModel(model).scene)
    expect(drawn.length, 'the header’s, plus the change at bar 3').toBe(2)
    const [header, change] = drawn
    expect(change.map(n => n.code), 'three over four').toEqual([0xe083, 0xe084])
    expect(change[0].x, 'the change stands later in the system').toBeGreaterThan(header[0].x)
    // ⭐ Same rule, same lines: a change is not a smaller or a shifted meter — ⛔ unlike a clef,
    // which VexFlow reduces to two thirds. Nothing in the meter's path has a `size` branch.
    expect(change[0].y, 'the numerator, on the same line as the header’s').toBeCloseTo(header[0].y, 10)
  })

  // 🚨 The break-test: every expectation above would pass vacuously on an empty list, and the
  // count is what proves the meter reaches OUR surface rather than VexFlow's.
  it('🚨 the break-test — the meter count RESPONDS to the score', () => {
    expect(meters(render(1).scene).length, 'one bar, one meter').toBe(1)
    const model = buildScore(2)
    model.setTimeSignature(2, { numerator: 5, denominator: 8 })
    expect(meters(renderModel(model).scene).length, '…and a change adds one').toBe(2)
  })
})

describe('⭐⭐ P5b — the OPENING BARLINE in the scene, and the DOM repair that is gone', () => {
  /** Every rect drawn inside a `stavebarline` group, leftmost first. */
  function barlineRects(scene: ReturnType<typeof render>['scene']) {
    return sceneGroups(scene, 'stavebarline')
      .flatMap(g => g.children.filter(c => c.kind === 'rect'))
      .flatMap(r => (r.kind === 'rect' ? [r] : []))
      .sort((a, b) => a.x - b.x)
  }

  /** The y of every staff line the STAVE drew — P5a's ink, read back. @see the CLEF block above. */
  function staffLineYs(scene: ReturnType<typeof render>['scene']): number[] {
    return sceneGroups(scene, 'stave')
      .flatMap(g => scenePrimitives(g))
      .flatMap(p => (p.kind === 'path' && p.ops[0]?.op === 'moveTo'
        ? [p.ops[0].y - (p.style.lineWidth ?? 0) / 2]
        : []))
  }

  it('⭐⭐ a system OPENS with a line, and it stands on the stave’s own left edge', () => {
    const { scene } = render(4)
    const staveX = sceneGroups(scene, 'stave')
      .flatMap(g => scenePrimitives(g))
      .flatMap(p => (p.kind === 'path' && p.ops[0]?.op === 'moveTo' ? [p.ops[0].x] : []))
    const [opening] = barlineRects(scene)
    // ⭐ The BOUNDARY, not a centre: `x` is the stave's own edge and every pixel of ink is to the
    // right of it (`engrave/staff/openingBarline`'s rule 2).
    expect(opening.x, 'the leftmost barline is the one that opens the stave')
      .toBeCloseTo(Math.min(...staveX), 10)
  })

  it('⭐⭐ …it spans the staff, from the top line’s MIDDLE to the bottom line’s', () => {
    // ⭐ Asserted against the OTHER half of our own scene, as the clef's baseline is: P5a drew the
    // lines, and the claim is where this rect stops relative to them.
    //
    // ⭐⭐ **This assertion is the one that changed the picture.** It used to pin VexFlow's own
    // extent — the top line's top edge down to `bottomLine + 1`, a hard 1 that was ITS staff-line
    // thickness — as a PASSING assertion, so that the day the rule got an owner it would fail and
    // say why. It did, on 2026-09-13: a barline now runs line-middle to line-middle
    // (`engrave/staff/barlineExtent`; LilyPond, MuseScore and Verovio unanimous).
    const { scene } = render(2)
    const [opening] = barlineRects(scene)
    const lines = staffLineYs(scene).slice(0, 5)
    expect(lines.length, 'five lines on the first stave').toBe(5)
    expect(opening.y, 'the top line’s middle')
      .toBeCloseTo(staffLineMidY(lines[0], STAVE_LINE_WIDTH_PX), 10)
    expect(opening.y + opening.height, 'the bottom line’s middle')
      .toBeCloseTo(staffLineMidY(lines[4], STAVE_LINE_WIDTH_PX), 10)
    // ⭐ …so it is exactly four staff spaces, and ⛔ no longer a staff plus a line thickness.
    expect(opening.height, 'four spaces, whatever the lines are drawn at')
      .toBeCloseTo(lines[4] - lines[0], 10)
    expect(opening.y + opening.height, '⛔ NOT VexFlow’s bottom + 1')
      .not.toBeCloseTo(lines[4] + 1, 10)
  })

  it('⭐⭐ it is DRAWN at 0.16 staff spaces — ⛔ no longer a 1 px rect widened afterwards', () => {
    // 🚨 The assertion the whole step is for. `inkBarlines` used to rewrite this width in the DOM,
    // where the scene could not see it: a recorded 1 would have been a scene DISAGREEING with the
    // page. Every barline in the score now leaves the engine at its own weight.
    const { scene } = render(4)
    const rects = barlineRects(scene)
    expect(rects.length, 'the opening line, plus one per bar boundary').toBeGreaterThanOrEqual(5)
    for (const r of rects) expect(r.width, 'one weight for every line on the page').toBeCloseTo(THIN_BARLINE_PX, 10)
  })

  // 🚨 The break-test: an empty scene, or a leftmost rect that is really an end barline, would slip
  // past the three above. This pins the count against the score.
  it('🚨 the break-test — one opening line per system, and the rest RESPOND to the bar count', () => {
    const two = barlineRects(render(2).scene)
    const five = barlineRects(render(5).scene)
    expect(five.length, 'more bars, more lines').toBeGreaterThan(two.length)
    // ⭐ …and exactly one of them stands at the stave's edge: the opening line has no twin.
    const staveX = Math.min(...sceneGroups(render(5).scene, 'stave')
      .flatMap(g => scenePrimitives(g))
      .flatMap(p => (p.kind === 'path' && p.ops[0]?.op === 'moveTo' ? [p.ops[0].x] : [])))
    expect(five.filter(r => Math.abs(r.x - staveX) < 1e-6), 'one, and only one').toHaveLength(1)
  })
})

describe('⭐⭐ U1 — the CURVE in the scene: a tie’s arc, drawn by us', () => {
  /** Two quarter C4s in bar 1, the first tied to the second. */
  function tiedPair(): ScoreModel {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    if (!a || !b) throw new Error('fixture')
    model.updateNote(a.id, { tiedTo: b.id })
    model.updateNote(b.id, { tiedFrom: a.id })
    return model
  }

  /** The paths drawn inside a `tie` group. */
  function tiePaths(scene: ReturnType<typeof render>['scene']) {
    return sceneGroups(scene, 'tie')
      .flatMap(g => scenePrimitives(g))
      .flatMap(p => (p.kind === 'path' ? [p] : []))
  }

  it('⭐⭐ a tie’s ARC is in the scene — ⛔ it used to be `Curve` painting itself', () => {
    const { scene } = renderModel(tiedPair())
    const paths = tiePaths(scene)
    // ⭐ Two: the stroked outline and the filled body (`engrave/curves/curveInk`). Before U1 the
    // `tie` group was here and EMPTY — the surrounding group drew through our context, the ink
    // through VexFlow's.
    expect(paths.map(p => p.painted), 'an outline and a body').toEqual(['stroke', 'fill'])
    for (const p of paths) {
      expect(p.ops.filter(o => o.op === 'bezierCurveTo'), 'two cubic passes').toHaveLength(2)
    }
  })

  it('⭐⭐ …and it runs between its two noteheads, bowing clear of them', () => {
    const { scene } = renderModel(tiedPair())
    const [outline] = tiePaths(scene)
    const start = outline.ops[0]
    const out = outline.ops[1]
    if (start.op !== 'moveTo' || out.op !== 'bezierCurveTo') throw new Error('not an arc')
    // ⭐ The geometry that needed a browser until today: left end before right end, and both on
    // one y because a tie joins one pitch (`TieRenderer`'s *"flat, symmetric"*).
    expect(out.x, 'the arc runs left to right').toBeGreaterThan(start.x)
    expect(out.y, 'both ends share a y').toBeCloseTo(start.y, 10)
    // ⭐ Two stemmed C4s below the middle line take stems UP, so the tie bows BELOW them: its
    // control points sit further down the page than its ends.
    expect(out.cp1y, 'bowed away from the stems').toBeGreaterThan(start.y)
  })

  // 🚨 The break-test: an assertion over "the tie group's paths" says nothing if no tie was asked
  // for — an empty `toEqual([])` would pass on a score with no ties at all.
  it('🚨 the break-test — no tie in the score, no arc in the scene', () => {
    expect(tiePaths(render(2).scene), 'nothing draws a curve on its own').toHaveLength(0)
  })
})

describe('⭐⭐ the note’s MODIFIERS — the accidental, the dot and the articulation in the scene', () => {
  /** A bar with a sharp on the first note and a dot on the second. */
  function marked(articulate?: 'staccato' | 'accent'): ScoreModel {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), alter: 1 })
    model.addNote({
      step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), dots: 1,
      ...(articulate ? { articulations: [articulate] } : {}),
    })
    model.addNote({ step: 'G', octave: 4, duration: '8', measure: 1, beat: frac(5, 2) })
    return model
  }

  /** Every glyph the scene holds, as codepoints. */
  function sceneGlyphs(scene: ReturnType<typeof render>['scene']): string[] {
    return scenePrimitives(scene).flatMap(p => (p.kind === 'text' ? [p.text] : []))
  }

  /** Every glyph the PAGE holds — the other side of the same census. */
  function pageGlyphs(renderer: ScoreRenderer): string[] {
    const svg = renderer.getSVGElement()
    return [...(svg?.querySelectorAll('text') ?? [])].map(t => t.textContent ?? '')
  }

  const SHARP = '\ue262'
  const AUGMENTATION_DOT = '\ue1e7'
  /** ⚠️ The two ACCENTS — the SIDE is in the GLYPH, not in a flag: `Articulation.setPosition`
   *  swaps `aboveCode` for `belowCode`, and nothing downstream of it knows which side it is on. */
  const ACCENT_ABOVE = '\ue4a0'
  const ACCENT_BELOW = '\ue4a1'

  it('⭐⭐ an accidental and a dot are OURS — the last two glyphs of an ordinary bar', () => {
    const glyphs = sceneGlyphs(renderModel(marked()).scene)
    expect(glyphs, 'the sharp').toContain(SHARP)
    expect(glyphs, 'the augmentation dot').toContain(AUGMENTATION_DOT)
  })

  it('⭐⭐ THE CENSUS: every glyph the page draws is in the scene, and in the same order', () => {
    // 🚨 This is the assertion the step was for, and it is the one that found the gap in the first
    // place: `lint:paint` counts `vexContext`, and a modifier never mentions it — it takes its
    // context from `voice.draw(ctx)` by way of `StaveNote.drawModifiers`. So the accidental and the
    // dot were VexFlow ink through all of P3, P4, P5 and U1, invisible to the ceiling AND to the
    // scene. ⭐ A ceiling nobody re-measured reads as coverage; this counts the ink itself.
    const { renderer, scene } = renderModel(marked())
    expect(pageGlyphs(renderer)).toEqual(sceneGlyphs(scene))
  })

  it('⭐⭐ …and the ARTICULATION with them — an articulated bar’s census is COMPLETE', () => {
    // ⭐ This test used to be the BOUNDARY. It asserted that exactly ONE glyph the page drew was
    // missing from the scene — a PASSING statement of what was left, written so that the day the
    // articulation's ink moved it would fail and say so. 2026-09-14 is that day, and what it states
    // now is the same census with nothing left out of it.
    // ⚠️ A MULTISET equality and ⛔ not `includes`: VexFlow draws a STACCATO with the augmentation
    // dot's own codepoint, so a membership test reads "present" while the page holds TWO of them and
    // the scene one. The first draft of the old test passed for exactly that reason.
    const { renderer, scene } = renderModel(marked('staccato'))
    expect(pageGlyphs(renderer)).toEqual(sceneGlyphs(scene))
  })

  it('⭐ an ACCENT is ours by its own codepoint — ⚠️ and which one says which SIDE it took', () => {
    const { renderer, scene } = renderModel(marked('accent'))
    const accents = sceneGlyphs(scene).filter(g => g === ACCENT_ABOVE || g === ACCENT_BELOW)
    expect(accents, 'one accent, stamped through our own primitives').toHaveLength(1)
    expect(pageGlyphs(renderer)).toEqual(sceneGlyphs(scene))
  })

  it('⭐⭐ each mark is a GROUP OF ITS OWN, named for the kind the registry files it under', () => {
    // 🚨 His report, 2026-09-14: *"i dont see the bbox of the dot in `__bbox.ink()` either"*, and
    // *"the `__bbox.ink()` of the notehead becomes bigger with articulation"*. Both are one gap:
    // VexFlow's modifiers open NO group, so their ink landed loose in the notehead's and the ruler
    // had nothing to draw a box around — while the head's box swallowed all three.
    // ⭐ A group per mark is what makes a mark MEASURABLE on its own, and the class is the REGISTRY's
    // kind name so P6b can match a scene group to the hit box a click already resolves against.
    const { scene } = renderModel(marked('accent'))
    for (const [cls, glyph] of [['accidental', SHARP], ['dot', AUGMENTATION_DOT], ['articulation', ACCENT_BELOW]] as const) {
      const groups = sceneGroups(scene, cls)
      expect(groups, `one ‘${cls}’ group`).toHaveLength(1)
      expect(sceneGlyphs(groups[0]), `and its glyph is inside it`).toEqual([glyph])
      expect(groups[0].id, 'carrying the drawn sign’s own id').toBeTruthy()
    }
  })

  it('⭐ …and they are NESTED in the notehead group — ⛔ the DOM order the highlight reads is unchanged', () => {
    // ⚠️ This is the one DOM change the modifier family has made, and it is safe for exactly this
    // reason: every highlight selector is a DESCENDANT search (`group.querySelectorAll('text')`, and
    // the articulation walk whose index 0 is still the head), so wrapping a glyph in a `<g>` moves
    // nothing in document order. The assertion below is that fact, stated where it can fail.
    const { renderer } = renderModel(marked('accent'))
    const heads = [...(renderer.getSVGElement()?.querySelectorAll('g.notehead') ?? [])]
    expect(heads.length, 'the bar drew a head group per note').toBeGreaterThanOrEqual(3)
    // ⚠️ The sharp is on the FIRST note and the dot and the mark on the SECOND — a modifier belongs
    // to the head it hangs off, so each one nests in its own head's group. ⚠️ A REST draws as a
    // `notehead` too (the harness records the same surprise), so this counts rather than indexes.
    expect(
      heads.map(h => [...h.querySelectorAll('g')].map(g => g.getAttribute('class'))).filter(cs => cs.length),
      'each mark nests in the head it belongs to, and no head holds a mark that is not its own',
    ).toEqual([['accidental'], ['dot', 'articulation']])
    for (const head of heads) {
      const first = head.querySelector('text')?.textContent ?? ''
      expect(
        (first.codePointAt(0) ?? 0) >= 0xe0a0 && (first.codePointAt(0) ?? 0) <= 0xe4ff,
        '⛔ the HEAD (or a rest) is still the first glyph in document order, which is the index the highlight skips',
      ).toBe(true)
    }
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

  it('⭐ the scene and the page name a group ALIKE — the class the pass asked for is the SVG’s (S15c)', () => {
    const { renderer, scene } = render(2)
    const classes = [...walkScene(scene)]
      .filter(n => n.kind === 'group')
      .map(g => (g as { cls?: string }).cls)
      .filter((c): c is string => !!c)
    expect(classes).toContain('stavebarline')
    // 🚨 Until S15c the painter wrote VexFlow's prefix on every class, so these two lists disagreed
    // and a reader had to know which one it held. Now a scene's class finds the page's group as is.
    const onPage = new Set([...renderer.getSVGElement()!.querySelectorAll('g')].map(g => g.getAttribute('class')))
    expect(classes.filter(c => !onPage.has(c)), 'a scene class the page does not carry').toEqual([])
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
