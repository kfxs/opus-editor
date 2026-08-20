// @vitest-environment jsdom
/**
 * 🚨🚨 A DRAG RELEASED WHERE THE CANVAS CANNOT SEE IT MUST STILL END.
 *
 * His report, 2026-08-20: *"i went to the right so far that i click release outside the viewport,
 * and then when i went back with no mouse pressed the system think i'm still pressing the mouse and
 * is drawing"*. A drag left armed is not a harmless leak — it holds an UNCOMMITTED preview, so the
 * score keeps changing under a pointer with no button held.
 *
 * Subject: `./MouseController`, a chapter beside `.hairpinBodyDrag.test.ts` (whose fixture this
 * reuses — the body drag is simply the cheapest gesture to arm). ⭐ The claims are about the two
 * seams, ⛔ not about the hairpin: every gesture goes through the same `handleMouseUp` chain, which
 * is the point of fixing it there rather than per-drag.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditorState, type EditorState } from './EditorState'
import { MouseController } from './MouseController'

function fakeSvg(): SVGSVGElement {
  return {
    createSVGPoint() {
      const p = { x: 0, y: 0, matrixTransform: (_m: unknown) => ({ x: p.x, y: p.y }) }
      return p
    },
    getScreenCTM: () => ({ inverse: () => ({}) }),
  } as unknown as SVGSVGElement
}

/** A wedge drawn as a flat outline through y = 100, from x = 100 to x = 300. */
const HAIRPIN_EL = {
  type: 'hairpin' as const, id: 'H1', measure: 1, staff: 0,
  bbox: { x: 100, y: 94, width: 200, height: 12 },
  points: [{ x: 100, y: 100 }, { x: 300, y: 94 }, { x: 300, y: 106 }, { x: 100, y: 100 }],
}

describe('a drag released out of sight', () => {
  let state: EditorState
  let svg: SVGSVGElement
  let mc: MouseController
  let engine: Record<string, unknown>
  let preview: ReturnType<typeof vi.fn>
  let commit: ReturnType<typeof vi.fn>
  let lineSpacing: number

  const ev = (over: Partial<{ clientX: number; clientY: number; buttons: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  beforeEach(() => {
    vi.useFakeTimers()
    state = createEditorState()
    state.selectedTool = 'selection'
    svg = fakeSvg()
    const canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector

    lineSpacing = 10
    preview = vi.fn(() => true)
    commit = vi.fn()
    const registry = {
      staffBands: () => [{ top: 90, bottom: 110 }],
      findClosestNoteOrRest: () => null,
      getTupletAt: () => null,
      hitsNoteOrRestBody: () => false,
      getByType: (t: string) => (t === 'hairpin' ? [HAIRPIN_EL] : []),
      getByMeasure: () => [],
      getTupletById: () => null,
      staffIndexAtY: () => 0,
      getStaffGeometry: () => ({ lineSpacing, noteStartX: 50 }),
      noteOrRestHitDistance: () => Infinity,
      isPainted: () => true,
    }
    engine = {
      getElementRegistry: () => registry,
      getNote: () => null,
      getScore: () => ({ measures: [] }),
      pixelToMeasure: () => 1,
      previewHairpinOffset: preview,
      commitHairpinOffsetDrag: commit,
      // ⭐ The body drag is a WALK now (`../hairpinWalk`): it asks for the next slot of the wedge's
      // lane and for the system it belongs to. Nothing is drawn here but the wedge itself, so both
      // answer "nowhere", and the frame degrades to the plain ink nudge these cases are about.
      getHairpinById: () => ({ id: 'H1', type: 'cresc' }),
      nextHairpinStartSlot: () => null,
      previewHairpinSlot: () => false,
      previewHairpinOffsetRebase: vi.fn(() => true),
    }

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      { selectNote: vi.fn() } as never, { renderScore: vi.fn() } as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
  })

  afterEach(() => { mc.teardown(); vi.useRealTimers() })

  /** Press on the wedge's arm, wait past the click threshold, then move to (x, y). */
  const grabAndMove = (x: number, y: number) => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 100 }))
    vi.advanceTimersByTime(200)
    mc.handleMouseMove(ev({ clientX: x, clientY: y }))
  }

  /** Press on the wedge, past the click threshold, with the document told the button went down. */
  const armDrag = () => {
    mc.setup()
    document.dispatchEvent(new MouseEvent('mousedown'))
    grabAndMove(230, 120)
    expect(preview).toHaveBeenCalledTimes(1)
  }

  it('⭐⭐ a release anywhere in the PAGE settles it — the canvas never saw that mouseup', () => {
    armDrag()
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(commit, 'the gesture was committed, once').toHaveBeenCalledTimes(1)

    mc.handleMouseMove(ev({ clientX: 300, clientY: 120 }))
    expect(preview, 'and nothing follows the pointer any more').toHaveBeenCalledTimes(1)
  })

  it('🚨 …and a move with NO BUTTON HELD settles it too — a release outside the WINDOW fires nothing', () => {
    // The case he actually hit: no `mouseup` reaches the canvas OR the document, so the only
    // evidence is what the next move carries — `buttons === 0`.
    armDrag()
    mc.handleMouseMove(ev({ clientX: 260, clientY: 120, buttons: 0 }))
    expect(commit).toHaveBeenCalledTimes(1)
    expect(preview, 'that frame moved nothing either').toHaveBeenCalledTimes(1)
  })

  it('⛔ …and an ordinary drag frame is untouched — `buttons` says a button IS held', () => {
    armDrag()
    mc.handleMouseMove(ev({ clientX: 260, clientY: 120, buttons: 1 }))
    expect(commit).not.toHaveBeenCalled()
    expect(preview).toHaveBeenCalledTimes(2)
  })
})
