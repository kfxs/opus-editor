// @vitest-environment jsdom
/**
 * Subject: {@link previewMarkFamily}, sitting beside this file — §12.5a's cheap frame.
 *
 * ⭐ **Two claims, and the feature is worthless if either fails.**
 *
 *  1. **The cheap picture is the REAL one, for the family that moved.** A preview that drew the
 *     ottava anywhere other than where a full render puts it would be a lie the user acts on.
 *  2. **Repeating it changes nothing.** `renderScore` is a sequential accumulation — every family
 *     pass appends to the element registry and to the ladder's `occupiedBands` — so re-running one
 *     pass is only safe because the preview rewinds those first. Without the rewind the bracket
 *     claims a fresh rung every frame and walks up the page while the mouse holds still.
 *
 * ⚠️ jsdom measures every glyph at 0×0 (`reference_jsdom_cannot_measure_glyphs`), so nothing here
 * asserts an absolute coordinate. Both claims are RELATIVE — one drawing against another — which is
 * exactly the shape a layout-free DOM can still answer honestly.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { MarkPreviewKind } from './markPreviewPass'
import { ScoreModel } from '../models/ScoreModel'
import { VexFlowRenderer } from './VexFlowRenderer'
import { addOttava } from '../models/ottavaOps'
import { addPedal } from '../models/pedalOps'
import { addHairpin, setHairpinAtStaffSlot } from '../models/hairpinOps'
import { addTrill } from '../models/trillOps'
import { addSlur } from '../models/slurOps'
import { setTempoAtSlot } from '../models/tempoOps'
import { fracCreate as frac } from '@/utils/fraction'

let renderer: VexFlowRenderer
let model: ScoreModel
let ottavaId: string

/** Four bars of quarters, with an octave line over the first two. */
beforeEach(() => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  renderer = new VexFlowRenderer(container)
  renderer.initialize(1200, 800)

  model = new ScoreModel()
  for (let i = 1; i < 4; i++) model.addMeasure()
  const ids: string[] = []
  for (let m = 1; m <= 4; m++) {
    for (let b = 0; b < 4; b++) {
      ids.push(model.addNote({ step: 'C', octave: 5, duration: 'q', measure: m, beat: frac(b, 1) })!.id)
    }
  }
  // ⚠️ Built on the SCORE, not through `MusicEngine`: its constructor stands up a renderer of its
  // own, and this spec needs the REAL one it is testing against.
  //
  // ⭐ ONE OF EVERY PREVIEWABLE FAMILY. Without them the per-family assertions below count zero
  // groups against zero groups and pass whatever the code does — which is the shape of vacuous test
  // this plan has already shipped twice.
  const score = model.getScore()
  ottavaId = addOttava(score, 1, { beat: frac(0, 1), length: frac(5, 1), shift: 1 })!.id
  addPedal(score, 1, { beat: frac(0, 1), length: frac(6, 1) })
  addHairpin(score, 2, { beat: frac(0, 1), length: frac(3, 1), type: 'cresc' })
  addTrill(score, { startNoteId: ids[8], endNoteId: ids[10], voice: 0 })
  addSlur(score, { startNoteId: ids[1], endNoteId: ids[3], voice: 0 })
  renderer.renderScore(model.getScore())
})

/** What the octave lines look like right now — the family's whole drawn contribution. */
function ottavaInk(): string {
  const svg = renderer.getSVGElement()!
  return [...svg.querySelectorAll('.vf-ottava')].map(g => g.outerHTML).join('|')
}

/**
 * ⚠️⚠️ **What a preview promises, and what it deliberately does NOT.**
 *
 * It promises to draw the family where the family now is. It does **not** promise the picture a full
 * render would produce, because it does not run the PLAN passes: the ladder is not restacked, so a
 * pedal that ought to step out of a rising bracket's way has not moved, and the bracket's own rung is
 * the one the last full render decided. That is exactly the approximation §12.5 signed off on, and
 * the reason every gesture owes a real render on the drop.
 *
 * ⛔ An earlier version of this spec asserted the previewed ink was byte-identical to the rendered
 * ink after an edit. It passed — with a fixture holding a lone ottava and nothing else in the ladder
 * to restack. It failed the moment the fixture grew a pedal, a hairpin, a trill and a slur, which is
 * the only reason the claim above is stated in this shape.
 */
describe('the preview draws what a full render would', () => {
  it('⭐⭐ with nothing changed it reproduces the picture exactly', () => {
    const before = ottavaInk()

    expect(renderer.previewMarks('ottava'), 'a snapshot exists, so it previewed').toBe(true)
    // ⚠️ This is the assertion that caught the CONTEXT LEAK: with the ambient state left by a later
    // pass, the bracket redrew at `stroke-width="1.6"` where the render had drawn `1.3`. Right shape,
    // wrong ink, and only a byte comparison sees it.
    expect(ottavaInk(), 'a redraw of unchanged state is the same ink').toBe(before)
  })

  it('⭐ …and it actually MOVED the bracket — the comparison above is not two copies of nothing', () => {
    const before = ottavaInk()
    model.setOttavaOffset(ottavaId, 40, 0)
    renderer.previewMarks('ottava')

    expect(ottavaInk(), 'a 40px offset has to show').not.toBe(before)
  })
})

/**
 * ⭐ The two take-downs, and both are break-tested: delete either and a spec below fails.
 *
 * ⛔ There was a third — a rewind of the ladder's `occupiedBands` — and it is gone. No spec could be
 * made to fail without it, because the claim is filed by `planOttavaBands`, which a preview never
 * calls. See the module header.
 */
describe('🚨 repeating a preview changes nothing — the accumulation traps', () => {
  it('🚨 the DOM does not accumulate copies of the family', () => {
    const groups = () => renderer.getSVGElement()!.querySelectorAll('.vf-ottava').length
    const once = groups()

    for (let i = 0; i < 5; i++) renderer.previewMarks('ottava')

    expect(groups(), 'the old ink comes down before the new goes up').toBe(once)
  })

  it('🚨 the HIT-TEST does not accumulate either', () => {
    const registry = renderer.getElementRegistry()
    const once = registry.getByType('ottava').length
    expect(once, 'the fixture registers something to begin with').toBeGreaterThan(0)

    for (let i = 0; i < 5; i++) renderer.previewMarks('ottava')

    // ⛔ Without `removeByType` every frame leaves another row, and a click lands on a stale box.
    expect(registry.getByType('ottava').length).toBe(once)
  })
})

describe('it refuses rather than drawing a lie', () => {
  it('⛔ answers false before any render, so the caller falls back to a real one', () => {
    const fresh = new VexFlowRenderer(document.createElement('div'))
    fresh.initialize(600, 400)

    expect(fresh.previewMarks('ottava')).toBe(false)
  })
})


/**
 * ⭐⭐ **Every family, on the same two claims.** The ottava above is the worked example; these prove
 * the table is a table — that adding a row buys the behaviour rather than merely declaring it.
 *
 * ⚠️ Two of them are here because their DRAW appends where their siblings' PLAN does, and a preview
 * never runs a plan: `drawPedal` files the pedal's ladder claim, and `renderSlurs` appends to
 * `pass.drawnCurves`. Both would otherwise grow once per frame.
 */
/**
 * ⚠️⚠️ **ONE FAMILY PER FRAME — a preview does not compose with another preview.** Each rewind point
 * is a LENGTH into `occupiedBands`, and a preview rewrites that array's tail; a second preview in the
 * same frame rewinds to an offset the first has already invalidated. Measured: previewing all five in
 * sequence moved the pedal 21 px — two full staff spaces — with nothing edited at all.
 *
 * ⛔ Not a limitation to design around: it is what a gesture does anyway. One drag moves one mark, so
 * each test below re-renders before each family, exactly as a gesture starts from a finished render.
 *
 * ⚠️⚠️ **WHAT IS NOT COVERED HERE: the staff CROSSING itself** — his 2026-08-22 report, the wedge
 * disappearing mid-drag. Two purpose-built tests for it were written and deleted: they passed with the
 * hairpin's plan replaced by an empty one, i.e. with the bug fully present, so they proved nothing.
 * ⛔ A vacuous regression test is worse than none — it retires the question. What DOES catch a
 * hairpin that fails to draw is the pair below, which count the family's groups; the crossing itself
 * needs the browser, and `feedback_user_does_manual_ui_testing` is why.
 */
describe('the table covers every family it declares', () => {
  const KINDS = ['ottava', 'pedal', 'trill', 'hairpin', 'slur'] as const

  it('⭐ every declared family previews against a finished render', () => {
    for (const kind of KINDS) {
      renderer.renderScore(model.getScore())
      expect(renderer.previewMarks(kind), `${kind} previewed`).toBe(true)
    }
  })

  it('🚨 and no family accumulates DOM, hit-boxes, or ladder claims across frames', () => {
    const svg = renderer.getSVGElement()!
    const registry = renderer.getElementRegistry()
    const shape = () => KINDS.map(k =>
      `${k}:${svg.querySelectorAll(`.vf-${k}`).length}/${registry.getByType(k).length}`).join(' ')

    for (const kind of KINDS) {
      renderer.renderScore(model.getScore())
      const once = shape()
      for (let i = 0; i < 10; i++) renderer.previewMarks(kind)
      expect(shape(), `${kind}: ten frames, one copy of everything`).toBe(once)
    }
  })

  it('⭐⭐ …and with nothing changed, every family redraws to exactly what was there', () => {
    const svg = renderer.getSVGElement()!
    const ink = (k: MarkPreviewKind) =>
      [...svg.querySelectorAll(`.vf-${k}`)].map(g => g.outerHTML).join('|')

    for (const kind of KINDS) {
      renderer.renderScore(model.getScore())
      const before = ink(kind)
      renderer.previewMarks(kind)
      expect(ink(kind), `${kind} redraws itself, not something near itself`).toBe(before)
    }
  })
})


/**
 * 🚨🚨 **HIS BUG, 2026-08-22** — *"I'm having problems with the hairpin when crossing staves: it
 * disappears and I don't see it anymore till I release click."*
 *
 * Every family but the pedal and the slur draws from a PLAN captured with the render, keyed by
 * *(mark, line)*. Carry the mark onto another staff or system and the captured plan has no entry for
 * where it now is, so the renderer's own `if (baseline === undefined) continue` skips it — and a
 * preview that reported success would leave a hole on screen for the rest of the gesture.
 */
describe('a preview that cannot place the dragged mark REFUSES', () => {
  it('🚨 answers false when the mark it was given did not come out the other side', () => {
    // The plainest way to be un-drawable: a mark the render never saw at all. A staff jump reaches
    // the same state by a longer road — a plan keyed by a line the mark has just left.
    expect(renderer.previewMarks('ottava', 'no-such-ottava')).toBe(false)
  })

  it('⭐ …and true when it did, so an ordinary frame still takes the cheap path', () => {
    expect(renderer.previewMarks('ottava', ottavaId)).toBe(true)
  })

  it('⛔ with no mark named it vouches for nothing and simply reports that it drew', () => {
    expect(renderer.previewMarks('ottava')).toBe(true)
  })
})


/**
 * 🚨🚨 **HIS BUG, 2026-08-22, the second half** — *"the walking and reanchor on crossing staves
 * behave a little random."* The trace: with the cursor creeping four pixels, the wedge crossed
 * m3 → m11 → m21 across staves, and every landing that changed only the STAFF left its ink exactly
 * where it was (387.5 for `staff:0` and 387.5 again for `staff:e919…`; 653.9 for both, twice more).
 *
 * ⭐ **The cause was in the RENDERER, not the walk.** `renderHairpins` found each wedge by walking
 * the placements and reading their LANE (`from.view.hairpins`, `from.staffIndex`) — a copy filtered
 * at render time. A preview draws against a snapshot whose placements are older than the score, so a
 * wedge that had moved to the other hand was still found under the staff it had left and redrawn
 * there. `hairpinWalk` decides from the wedge's own drawn ink, saw ink that had not moved, and
 * crossed again. A measure change was survivable — the stale lane no longer matches
 * `span.startMeasure`, the wedge fails to draw and `previewMarkFamily` refuses into a real render —
 * which is why only staff-to-staff landings looked random.
 *
 * ⚠️ This is the test the previous round could not write. Two attempts were deleted for passing with
 * the bug fully present; both asserted that the wedge was *drawn*, which it always was — on the
 * wrong staff. What is asserted here is WHERE, against a full render of the same state, which is the
 * only comparison a layout-free DOM can make honestly: the registered box is arithmetic on the
 * stave's own y, not a measured glyph.
 */
describe('🚨 a mark that crossed to the OTHER STAFF is previewed on the staff it crossed to', () => {
  /** Two staves, notes on both, and a wedge that starts life on the upper one. */
  function grandStaff(): { hairpinId: string; lowerStaffId: string } {
    const score = model.getScore()
    const lowerStaffId = model.addStaffBelow(0)
    for (let m = 1; m <= 4; m++) {
      for (let b = 0; b < 4; b++) {
        model.addNote({ step: 'C', octave: 3, duration: 'q', measure: m, beat: frac(b, 1), staff: 1 })
      }
    }
    const hairpinId = addHairpin(score, 2, { beat: frac(0, 1), length: frac(3, 1), type: 'cresc' })!.id
    renderer.renderScore(score)
    return { hairpinId, lowerStaffId }
  }

  /** The wedge's first registered fragment — the very row `hairpinInkY` reads to steer the walk. */
  function drawnWedge(id: string): { staff: number | undefined; y: number } {
    const row = renderer.getElementRegistry().getByType('hairpin').find(e => e.id === id)
    expect(row, 'the wedge is drawn at all').toBeDefined()
    return { staff: row!.staff, y: row!.bbox.y }
  }

  it('🚨🚨 lands on the lower staff, where a full render of the same score puts it', () => {
    const { hairpinId, lowerStaffId } = grandStaff()
    const onUpper = drawnWedge(hairpinId)

    // The model write a staff-crossing frame makes — the same one `hairpinWalk.jumpStaves` ends in.
    expect(setHairpinAtStaffSlot(model.getScore(), hairpinId,
      { measure: 2, beat: frac(0, 1), staffId: lowerStaffId })).toBe(true)

    expect(renderer.previewMarks('hairpin', hairpinId), 'the frame took the cheap path').toBe(true)
    const previewed = drawnWedge(hairpinId)

    // ⛔ The claim, and the one the bug broke: a staff-only landing MOVED the wedge. Before the fix
    //   both numbers came back unchanged, and the walk read that as "still hasn't crossed".
    expect(previewed.staff, 'the wedge is registered on the staff it now belongs to').toBe(1)
    expect(previewed.y, 'and its ink went with it').not.toBeCloseTo(onUpper.y, 1)

    // ⭐ …and it is where a REAL render puts it, not merely somewhere else. This is the whole
    //   contract: the walk's next frame reads this number and must reach the same decision it
    //   would have reached had the frame been a full render.
    renderer.renderScore(model.getScore())
    const rendered = drawnWedge(hairpinId)
    expect(previewed.staff).toBe(rendered.staff)
    expect(previewed.y).toBeCloseTo(rendered.y, 1)
  })
})


/**
 * ⭐⭐ **THE ONE FAMILY THAT IS MOVED RATHER THAN REDRAWN**, and the one whose refusal is load-bearing
 * rather than a safety net.
 *
 * A tempo mark's glyph is drawn *inside its bar's* `<g class="vf-measure">` and repositioned
 * afterwards by one composed, idempotent transform (`./tempoMarkTransform`). So a preview draws
 * nothing: it re-applies the composer's nudge (`./tempoNudgePass`) and re-runs the ladder
 * (`./tempoLinePass`), both of which the full render runs anyway.
 *
 * 🚨🚨 **And that only works while the mark stays in its bar.** His report, 2026-08-22: *"while
 * dragging tempo refuses to move and after mouse release it lands in the cursor"*. A tempo drag's
 * HORIZONTAL is a re-anchor — his trace is `[Tempo] walked onto its next stop` on every frame, with
 * the latch dropping the offset back to ~0 each time — and no transform can carry a glyph into a
 * different bar's group. It sat still for the whole gesture and jumped on the drop, which was the
 * full render finally drawing it where it belonged.
 */
describe('the TEMPO family is moved, not redrawn', () => {
  let tempoRenderer: VexFlowRenderer
  let tempoModel: ScoreModel
  let tempoId: string

  const mark = () => tempoRenderer.getSVGElement()!.querySelector(`#vf-${tempoId}`)!

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    tempoRenderer = new VexFlowRenderer(container)
    tempoRenderer.initialize(1200, 800)

    tempoModel = new ScoreModel()
    for (let i = 1; i < 4; i++) tempoModel.addMeasure()
    for (let m = 1; m <= 4; m++) {
      for (let b = 0; b < 4; b++) {
        tempoModel.addNote({ step: 'C', octave: 5, duration: 'q', measure: m, beat: frac(b, 1) })
      }
    }
    tempoId = tempoModel.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro' })!.id
    tempoRenderer.renderScore(tempoModel.getScore())
  })

  it('⭐⭐ a pure OFFSET frame previews — the nudge reaches the glyph with no bar re-engraved', () => {
    const before = mark().getAttribute('transform')
    expect(before, 'the ladder already placed it').toMatch(/^translate\(0, -?\d/)

    tempoModel.nudgeTempoOffset(tempoId, 3, 0)
    expect(tempoRenderer.previewMarks('tempo', tempoId), 'it took the cheap path').toBe(true)

    // ⛔ THE CLAIM: three staff-spaces of x arrive on the element. Without `applyTempoNudges` the
    //   frame re-runs only the LADDER, which owns the y — the mark would follow the hand down and
    //   refuse to follow it sideways, since its only other writer is inside the bar draw.
    // ⭐ And the ladder's own component survives, because the transform is COMPOSED from parts kept
    //   on the element rather than overwritten (`./tempoMarkTransform`).
    expect(mark().getAttribute('transform'))
      .toBe(before!.replace(/^translate\(0,/, 'translate(30,'))
  })

  it('🚨🚨 …and a RE-ANCHOR refuses, because no transform reaches another bar\'s group', () => {
    expect(mark().closest('.vf-measure')?.id, 'drawn in bar 1 to begin with').toMatch(/^vf-m1-s/)

    setTempoAtSlot(tempoModel.getScore(), tempoId, { measure: 3, beat: frac(0, 1) })

    // ⛔ The caller must render for real. Before this refusal the frame reported success and moved
    //   nothing — the mark sat still for the whole drag and jumped on the drop.
    expect(tempoRenderer.previewMarks('tempo', tempoId),
      'the glyph is in bar 1 and the mark now belongs to bar 3').toBe(false)
  })

  it('🚨🚨 …and so does a re-anchor WITHIN the bar — the base moved, and only the offset is ours', () => {
    // His report, 2026-08-22: the drag *"gets stuck at certain points"*. Every crossing inside a bar
    // passed the first version of this vouch (same bar, same group), so the frame wrote the latch's
    // offset of 0 against a base still measured from the PREVIOUS onset — and the ink jumped back
    // there. One sawtooth per stop, which is what the drag looked like.
    setTempoAtSlot(tempoModel.getScore(), tempoId, { measure: 1, beat: frac(2, 1) })

    expect(tempoRenderer.previewMarks('tempo', tempoId),
      'same bar, but the glyph was drawn from beat 0').toBe(false)
  })
})
