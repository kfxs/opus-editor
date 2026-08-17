// @vitest-environment jsdom
/**
 * P5.4 — **incremental redraw** (docs/render-performance-plan.md §7a).
 *
 * A render now reuses the measure groups it did not have to redraw. Two things must both be true,
 * and they pull against each other:
 *
 * 1. **It must be fast** — a render that changes nothing must re-engrave nothing.
 * 2. **It must be indistinguishable from a full render** — because a stale group is a *wrong
 *    picture that never repairs itself*, which is far worse than a slow one.
 *
 * Reuse is observable without any test-only API: a reused measure is the **same DOM node** across
 * renders, a redrawn one is a new node. So these tests assert on node identity.
 */
import { describe, it, expect } from 'vitest'
import { levelToGlyphString } from '@/utils/dynamics'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { Renderer } from 'vexflow'
import { laneFingerprint } from './MeasureWidthCache'
import { measureShapeKey } from './MeasureRedrawKey'
import type { Measure } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/** Minimal shape inputs — the width is held fixed so only CONTENT can move the key. */
function keyInputs(view: Measure) {
  return { view, staffIndex: 0, width: 300, isFirstInLine: true, scale: 1, clef: 'treble' as const, hasClefChange: false }
}

function makeRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 800)
  return renderer
}

/** A score long enough to wrap onto more than one system. */
function buildScore(bars = 12): ScoreModel {
  const model = new ScoreModel()
  for (let i = 1; i < bars; i++) model.addMeasure()
  for (let m = 1; m <= bars; m++) {
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: m, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: 'q', measure: m, beat: frac(1, 1) })
  }
  return model
}

/** The identity of every drawn measure group, so we can see which survived a render. */
function groupNodes(renderer: VexFlowRenderer, bars: number): Map<number, SVGGElement | null> {
  const nodes = new Map<number, SVGGElement | null>()
  for (let m = 1; m <= bars; m++) nodes.set(m, renderer.getMeasureSVGGroup(m, 0))
  return nodes
}

/** Which measures were RE-ENGRAVED between two renders (their group is a different node). */
function redrawnMeasures(before: Map<number, SVGGElement | null>, after: Map<number, SVGGElement | null>): number[] {
  return [...after.keys()].filter(m => before.get(m) !== after.get(m))
}

/**
 * Everything the registry knows — **every field**, not just the bbox.
 *
 * The exhaustiveness is the point. A translated measure (P5.4b) has to have every coordinate-bearing
 * field shifted: `bbox`, but also `headX`, `points`, `controlPoints`, `slurEndpoints`,
 * `tupletGeometry`, the staff's line Y positions, the measure bounds. Forgetting one does not crash
 * and does not look wrong — it drifts the *hit-box* away from the *glyph*, so clicks land on the
 * wrong thing, and only for bars that happened to move. Comparing whole elements is what makes that
 * impossible to miss.
 *
 * ⚠️⚠️ **…as far as the FIXTURE reaches, and that is a real limit — it missed one.**
 * `segmentEndpoints` (a cross-system slur segment's arc ends) went unshifted for months and this
 * comparison stayed green, because the fixture below renders in **linear** view: one system, so no
 * slur here is ever cut into segments and no entry ever carries that field. ⭐ A whole-object check
 * is only as total as what the fixture puts in the objects. The direct guard is
 * `src/engine/ElementRegistry.coordinates.test.ts`, whose fixture carries every coordinate field at
 * once; ⏭️ a wrapped-view case here would be the belt to its braces.
 */
/**
 * ⚠️ Coordinates are compared to **nine decimals**, not bit-for-bit.
 *
 * A translated bar computes `x + delta` where a freshly drawn one computes the absolute x, so the
 * two agree only as well as floating-point addition does — and whether they happen to agree exactly
 * is a property of the arithmetic upstream, not of the translate. They were bit-identical until the
 * spacing model changed the shape of the width sum, and then differed in the 13th digit: two
 * ten-thousandths of a nanometre, on a picture measured in pixels. Nine decimals is far tighter than
 * anything that could move a hit-box and still catches a field that was never shifted at all, which
 * is what this snapshot is for.
 */
const roundCoords = (_key: string, value: unknown): unknown =>
  typeof value === 'number' ? Math.round(value * 1e9) / 1e9 : value

function registrySnapshot(renderer: VexFlowRenderer, bars: number, staves = 1) {
  const registry = renderer.getElementRegistry()
  const geometry: string[] = []
  for (let m = 1; m <= bars; m++) {
    for (let s = 0; s < staves; s++) {
      const geo = registry.getStaffGeometry(m, s)
      if (geo) geometry.push(JSON.stringify(geo, roundCoords))
    }
  }
  return {
    elements: registry.getAll().map(el => JSON.stringify(el, roundCoords)).sort(),
    geometry: geometry.sort(),
    bounds: [...renderer.getAllMeasureBounds().entries()]
      .map(([n, b]) => `${n}:${JSON.stringify(b, roundCoords)}`)
      .sort(),
  }
}

describe('P5.4 — incremental redraw', () => {
  it('a render that changes nothing re-engraves NOTHING', () => {
    // This is the slur drag (§7's loudest case, 626 ms across 6 frames): the score does not change,
    // so not one bar should be re-engraved to move a Bézier control point.
    const model = buildScore()
    const renderer = makeRenderer()

    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    renderer.renderScore(model.getScore())
    const after = groupNodes(renderer, 12)

    expect(redrawnMeasures(before, after)).toEqual([])
    // And they are all still really there.
    expect([...after.values()].every(g => g?.isConnected)).toBe(true)
  })

  it('a DYNAMIC redraws its bar — the case a width-keyed cache would silently miss', () => {
    // **The §7a headline, and the reason the redraw key is not the width key.**
    //
    // A dynamic takes no horizontal space, so P2's width fingerprint is BLIND to it — deliberately
    // (§4b excludes dynamics). Had the redraw key simply reused that fingerprint, this measure would
    // be judged "clean", its group would be reused, and the `mf` would never appear. The picture
    // would silently rot while every test about widths stayed green.
    //
    // So: prove the width key does NOT move, that the redraw key DOES, and that the bar redraws.
    const model = buildScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    const laneBefore = model.getScore().measures[0]
    const widthKeyBefore = laneFingerprint(laneBefore)
    const drawKeyBefore = measureShapeKey(model.getScore(), keyInputs(laneBefore), null, null)

    model.addDynamic(1, { text: levelToGlyphString('mf'), beat: frac(0, 1), voice: 0 })

    const laneAfter = model.getScore().measures[0]
    expect(laneFingerprint(laneAfter), 'the WIDTH key must be blind to a dynamic').toBe(widthKeyBefore)
    expect(measureShapeKey(model.getScore(), keyInputs(laneAfter), null, null), 'the DRAW key must not be').not.toBe(drawKeyBefore)

    renderer.renderScore(model.getScore())
    expect(redrawnMeasures(before, groupNodes(renderer, 12))).toContain(1)
  })

  it('a DYNAMIC OFFSET nudge redraws its bar — the id-keyed override a rest-keyed key would miss', () => {
    // The client-#8 twin of the dynamic-add case, and a second silent-rot trap. A dynamic's
    // hand-nudged offset lives in `engravingOverrides[dynamicId]` — keyed by the dynamic's uuid,
    // NOT by `{measureId}:…` like a rest shift. So the shape key's `overridesFor` (which only
    // matches the measureId prefix) is blind to it, AND the dynamics array itself is unchanged by a
    // nudge. If the offset weren't folded into the key some other way, the bar would read "clean",
    // its group would be reused, and the mark would sit still while the model moved. Prove the key
    // moves and the bar redraws. See docs/dynamic-offset-plan.md.
    const model = buildScore()
    const renderer = makeRenderer()
    const dyn = model.addDynamic(1, { text: levelToGlyphString('f'), beat: frac(0, 1), voice: 0 })!
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    const laneBefore = model.getScore().measures[0]
    const drawKeyBefore = measureShapeKey(model.getScore(), keyInputs(laneBefore), null, null)

    model.nudgeDynamicOffset(dyn.id, 0, -2) // arrow-up nudge, staff-spaces

    const laneAfter = model.getScore().measures[0]
    expect(measureShapeKey(model.getScore(), keyInputs(laneAfter), null, null), 'the DRAW key must move on a nudge').not.toBe(drawKeyBefore)

    renderer.renderScore(model.getScore())
    expect(redrawnMeasures(before, groupNodes(renderer, 12))).toContain(1)
  })

  it('a pitch change redraws ONLY that bar — its neighbours keep their DOM', () => {
    // Re-pitching a note changes the bar's content but not its width, so nothing re-justifies and
    // no neighbour moves. The blast radius should be exactly one bar.
    //
    // ⚠️ The note it moves is the one at beat 1, and that is deliberate. E4 → A4 are both inside the
    //    staff and neither draws a sign, so no ink changes anywhere. Re-pitching the bar's FIRST
    //    note is a different question and has its own test below.
    const model = buildScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    const target = model.getScore().measures[2].slots.filter(s => s.type === 'chord')[1]!
    model.updateNote(target.notes[0].id, { step: 'A', octave: 4 })

    renderer.renderScore(model.getScore())
    const after = groupNodes(renderer, 12)

    expect(redrawnMeasures(before, after)).toEqual([3])
  })

  it('⚠️ …but re-pitching the FIRST note off its ledger line re-justifies the LINE', () => {
    // ⭐ New with the spacing model's lead-in, and correct rather than regrettable. The blank between
    //   a barline and the first thing drawn is `barline↔note` plus that column's own left ink, and it
    //   is **pure ink with no duration rule over it** — so anything that changes what the first note
    //   reaches leftward changes the bar's width, and a changed width re-justifies its whole line.
    //   Here C4 (one ledger below a treble staff, reaching 0.30 left) becomes A4 (on the staff,
    //   reaching nothing).
    //
    //   The blast radius is a LINE, not the score, and only the first note of a bar can do it.
    const model = buildScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    const first = model.getScore().measures[2].slots.find(s => s.type === 'chord')!
    model.updateNote(first.notes[0].id, { step: 'A', octave: 4 })

    renderer.renderScore(model.getScore())
    const redrawn = redrawnMeasures(before, groupNodes(renderer, 12))
    expect(redrawn.length, 'more than the one bar').toBeGreaterThan(1)
    expect(redrawn).toContain(3)
  })

  it('an incremental render is INDISTINGUISHABLE from a full one', () => {
    // The correctness half. Whatever reuse saves, it must not change what the renderer ends up
    // believing: same elements, same bboxes, same measure bounds.
    const model = buildScore()

    const incremental = makeRenderer()
    incremental.renderScore(model.getScore()) // full first render
    model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: frac(2, 1) })
    model.addDynamic(4, { text: levelToGlyphString('p'), beat: frac(0, 1), voice: 0 })
    incremental.renderScore(model.getScore()) // ...then an incremental one

    const fresh = makeRenderer()
    fresh.renderScore(model.getScore()) // the same score, rendered from scratch

    expect(registrySnapshot(incremental, 12)).toEqual(registrySnapshot(fresh, 12))
  })
})

/**
 * P5.4b — **a bar that only MOVED is translated, not re-engraved** (§7a).
 *
 * Measured, not guessed: with position baked into the key, a staff-spacing drag re-engraved 66% of
 * the score on every frame and that one gesture was **53% of all render time** in an ordinary
 * session. Nothing about those bars had changed. They had moved.
 *
 * Linear view is the clean way to provoke it: widen bar 2 and every later bar slides right, with
 * identical content and identical justified width.
 */
describe('P5.4b — a bar that only moved is translated', () => {
  function linearRenderer() {
    const renderer = makeRenderer()
    renderer.setViewMode('linear')
    return renderer
  }

  /** Pack bar 2 with sixteenths so it genuinely gets WIDER — everything after it must slide right. */
  function widenBar2(model: ScoreModel): void {
    for (const [num, den] of [[2, 1], [9, 4], [5, 2], [11, 4], [3, 1], [13, 4], [7, 2], [15, 4]] as const) {
      model.addNote({ step: 'G', octave: 4, duration: '16', measure: 2, beat: frac(num, den) })
    }
  }

  it('bars downstream of an edit KEEP their DOM and are translated', () => {
    const model = buildScore()
    const renderer = linearRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)
    const xBefore = renderer.getMeasureBounds(5)!.measureX

    widenBar2(model)
    renderer.renderScore(model.getScore())
    const after = groupNodes(renderer, 12)

    // The premise: bar 5 really did move. (Without this, a no-op edit would pass vacuously.)
    expect(renderer.getMeasureBounds(5)!.measureX, 'bar 5 did not move').not.toBe(xBefore)

    // Only bar 2 was re-engraved...
    expect(redrawnMeasures(before, after)).toEqual([2])

    // ...and the bars after it moved by TRANSFORM, keeping their DOM.
    expect(after.get(5)!.getAttribute('transform'), 'bar 5 should have been translated').toMatch(/^translate\(/)
    // Bars BEFORE the edit did not move, so they carry no transform.
    expect(after.get(1)!.getAttribute('transform')).toBeNull()
  })

  it('a translated bar is INDISTINGUISHABLE from a freshly drawn one — every field', () => {
    // The one that catches a forgotten coordinate. If `headX`, a tuplet bracket, a staff line Y or a
    // measure bound is left un-offset, the glyph and its hit-box part company and this goes red.
    const model = buildScore()
    const incremental = linearRenderer()
    incremental.renderScore(model.getScore())

    widenBar2(model)
    incremental.renderScore(model.getScore()) // bars 3..12 translate

    const fresh = linearRenderer()
    fresh.renderScore(model.getScore())

    expect(registrySnapshot(incremental, 12)).toEqual(registrySnapshot(fresh, 12))
  })

  it('translating the same bar repeatedly does not accumulate drift', () => {
    // The offset is measured from where the group was PAINTED, never from where it was last seen —
    // so a bar dragged across many frames carries one exact transform, not a compounding one.
    const model = buildScore()
    const incremental = linearRenderer()
    incremental.renderScore(model.getScore())

    for (const beat of [2, 3]) {
      model.addNote({ step: 'A', octave: 4, duration: '8', measure: 2, beat: frac(beat, 1) })
      incremental.renderScore(model.getScore())
    }
    widenBar2(model)
    incremental.renderScore(model.getScore())

    const fresh = linearRenderer()
    fresh.renderScore(model.getScore())

    expect(registrySnapshot(incremental, 12)).toEqual(registrySnapshot(fresh, 12))
  })

  it("a SPAN's endpoint bars are re-engraved when they move — never translated", () => {
    // Ties and slurs are redrawn every render from their endpoint notes' `StaveNote`s, and a
    // translated bar keeps the StaveNotes it was DRAWN with — which still report the old
    // coordinates. So an anchor bar must be redrawn when it moves, or the slur detaches from its
    // notes. The bars a span merely CROSSES are unaffected and still translate.
    const model = buildScore()
    const m4 = model.getScore().measures[3].slots.find(s => s.type === 'chord')!
    const m7 = model.getScore().measures[6].slots.find(s => s.type === 'chord')!
    model.addSlur({ startNoteId: m4.notes[0].id, endNoteId: m7.notes[0].id, voice: 0 })

    const renderer = linearRenderer()
    renderer.renderScore(model.getScore())
    const before = groupNodes(renderer, 12)

    widenBar2(model)
    renderer.renderScore(model.getScore())
    const after = groupNodes(renderer, 12)

    const redrawn = redrawnMeasures(before, after)
    expect(redrawn, 'the edited bar plus the slur ENDPOINTS').toEqual([2, 4, 7])
    // The bars the slur merely crosses still just translate.
    expect(after.get(5)!.getAttribute('transform')).toMatch(/^translate\(/)
    expect(after.get(6)!.getAttribute('transform')).toMatch(/^translate\(/)
  })

  it('the ghost note still draws after a render — the layout it overlays must survive', () => {
    // REGRESSION. The ghost is an overlay drawn against the LAST render's layout (P4), which lives
    // on `measureLayoutInfo`. That field is *assigned* (not filled) during a render, so the
    // incremental teardown — which runs after the assignment, where the old `clear()` ran before it
    // — emptied the very layout it had just computed. `drawGhostNote` bails on an empty layout, so
    // note-entry mode silently showed no ghost at all, while every other test stayed green.
    const model = buildScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())

    const drew = renderer.drawGhostNote(model.getScore(), {
      step: 'D', alter: 0, octave: 5, duration: 'q', measure: 2, beat: 2,
    })

    expect(drew, 'the ghost declined to draw').toBe(true)
    expect(renderer.getSVGElement()!.querySelector('.ghost-note-group')).not.toBeNull()

    // ...and it must still work on the render AFTER an incremental one.
    model.addDynamic(1, { text: levelToGlyphString('f'), beat: frac(0, 1), voice: 0 })
    renderer.renderScore(model.getScore())
    expect(renderer.drawGhostNote(model.getScore(), {
      step: 'D', alter: 0, octave: 5, duration: 'q', measure: 2, beat: 2,
    })).toBe(true)
  })

  it('clearGhosts removes the group openGroup actually creates — not the one we assumed', () => {
    // REGRESSION, and a naming contract rather than a drawing one.
    //
    // Ghosts are overlays (P4), so hovering does NOT re-render: `clearGhosts()` is the ONLY thing
    // that takes the previous one down, and it matches BY CLASS. Four of the five ghosts build
    // their `<g>` by hand. The tempo ghost is the one that goes through VexFlow's
    // `openGroup('ghost-tempo')` — **which prefixes the class with `vf-` itself**. The selector
    // said `.ghost-tempo`, matched nothing, and so every mouse position left its ghost behind: a
    // permanent blue smear across the score.
    //
    // So don't assert the class we *think* VexFlow produces — ask VexFlow, then require
    // `clearGhosts` to handle exactly that. (The real tempo-ghost draw path can't run here: it
    // needs `getBBox`, which jsdom does not implement.)
    const renderer = makeRenderer()
    renderer.renderScore(buildScore().getScore())
    const svg = renderer.getSVGElement()!

    const probe = new Renderer(document.createElement('div'), Renderer.Backends.SVG).getContext()
    const groupClass = (probe.openGroup('ghost-tempo') as SVGGElement).getAttribute('class')!
    probe.closeGroup()
    expect(groupClass).toBe('vf-ghost-tempo') // VexFlow's prefix — the whole trap

    // A ghost of exactly that shape must be removable.
    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    ghost.setAttribute('class', groupClass)
    svg.appendChild(ghost)

    renderer.clearGhosts()
    expect(svg.querySelector(`.${groupClass}`), 'the tempo ghost was never taken down').toBeNull()
  })

  it('a deleted measure leaves nothing behind', () => {
    // measureBounds was never cleared before P5.4 — a removed measure's bounds lingered for the life
    // of the renderer, so a click in empty space could still resolve to a bar that no longer exists.
    const model = buildScore(4)
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    expect(renderer.getMeasureBounds(4)).toBeDefined()

    model.removeMeasure(4)
    renderer.renderScore(model.getScore())

    expect(renderer.getMeasureBounds(4)).toBeUndefined()
    expect(renderer.getMeasureSVGGroup(4, 0)).toBeNull()
    expect(renderer.getSVGElement()!.querySelector('#vf-m4-s0')).toBeNull()
  })
})

/**
 * 🚨 A REUSED MEASURE MUST KEEP ITS FAN MEMBERS' HIGHLIGHT TARGETS.
 *
 * The trap this pins (his report): a member has no `StaveNote`, so the highlight resolves it through
 * the renderer's own `fanMemberGroupMap`. That map is cleared every render like the others — but a
 * measure whose shape key is unchanged is NOT redrawn, so anything cleared must also be captured
 * into its snapshot and restored. Miss it and the failure is beautifully quiet: the registry slice
 * IS restored, so the member still SELECTS; only the highlight stops, and only for bars that
 * happened not to repaint. Editing a different bar was all it took.
 */
describe('a reused measure keeps its fanned members', () => {
  function fannedScore() {
    const model = new ScoreModel()
    model.addMeasure()
    model.addMeasure()
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, { direction: 'accel', count: 4, beams: 3 })
    const slot = model.getMeasure(1)!.slots.find(s => s.type === 'chord')!
    if (slot.type !== 'chord') throw new Error('expected a chord')
    return { model, memberIds: slot.fan!.members!.map(m => m.pitches[0].id) }
  }

  it('⭐ an edit in ANOTHER bar leaves every member still highlightable', () => {
    const { model, memberIds } = fannedScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    for (const id of memberIds) expect(renderer.getFanMemberSVGGroup(id)).not.toBeNull()

    const before = renderer.getMeasureSVGGroup(1, 0)

    // The edit he made: a note in a LATER bar. Bar 1 is untouched, so it is reused.
    model.addNote({ step: 'A', octave: 3, duration: 'w', measure: 3, beat: frac(0, 1) })
    renderer.renderScore(model.getScore())

    expect(renderer.getMeasureSVGGroup(1, 0)).toBe(before) // reused, not redrawn — the precondition
    for (const id of memberIds) {
      const info = renderer.getFanMemberSVGGroup(id)
      expect(info, `member ${id} after a reuse`).not.toBeNull()
      expect(info!.group.isConnected).toBe(true)
    }
  })

  it('and the member is still selectable — the registry half was never the broken one', () => {
    const { model, memberIds } = fannedScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())
    model.addNote({ step: 'A', octave: 3, duration: 'w', measure: 3, beat: frac(0, 1) })
    renderer.renderScore(model.getScore())
    for (const id of memberIds) expect(renderer.getElementRegistry().getById(id)).not.toBeNull()
  })

  it('⭐ nudging a MEMBER redraws its bar — the third key a member is invisible to', () => {
    // The client-#12 twin of the dynamic-offset case above, and the same silent trap one level in: a
    // member's offset is keyed by the member's own first PITCH id, which is neither a slot id nor a
    // `{measureId}:…` position key — so both of the shape key's existing override lines are blind to
    // it. Without the member line, the nudge changes nothing in the key, the bar keeps its drawn
    // group, and the head sits still while the model moves. See docs/note-offset-plan.md.
    const { model, memberIds } = fannedScore()
    const renderer = makeRenderer()
    renderer.renderScore(model.getScore())

    const laneBefore = model.getScore().measures[0]
    const widthKeyBefore = laneFingerprint(laneBefore)
    const drawKeyBefore = measureShapeKey(model.getScore(), keyInputs(laneBefore), null, null)
    const before = renderer.getMeasureSVGGroup(1, 0)

    model.nudgeNoteOffset(model.offsetTargetOf(memberIds[0])!.key, 1)

    const laneAfter = model.getScore().measures[0]
    expect(laneFingerprint(laneAfter), 'an offset has NO width').toBe(widthKeyBefore)
    expect(measureShapeKey(model.getScore(), keyInputs(laneAfter), null, null), 'but it is a different PICTURE').not.toBe(drawKeyBefore)

    renderer.renderScore(model.getScore())
    expect(renderer.getMeasureSVGGroup(1, 0)).not.toBe(before)
  })
})
