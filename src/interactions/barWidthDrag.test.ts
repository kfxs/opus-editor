// @vitest-environment jsdom
/**
 * The bar-width drag (docs/bar-width-plan.md §6, P2): grab a barline, and the bar to its LEFT gets
 * roomier or tighter with its music re-spaced proportionally.
 *
 * Simpler than the note drag in one respect — the target is a barline, so there is no axis contest
 * and no dominant-axis rule. The parts with a history are the two refusals: a press inside the dead
 * zone is still a click, and a PINNED barline (the one ending a system, which justification holds
 * at the right margin) never arms at all, because a drag that cannot follow its own cursor should
 * not start. The keyboard still resizes such a bar — by a rule a pointer cannot have.
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

/** The barline ending bar 1, drawn at x≈200 across a staff spanning y 90–130. */
const BARLINE_EL = {
  type: 'barline' as const, id: 'b1', measure: 1, staff: 0,
  bbox: { x: 198, y: 90, width: 4, height: 40 },
}

/** What the engine reports about the grabbed barline — a bar that CAN move. */
const movableRoom = () => ({
  stretch: 1,
  noteSpace: 100,
  barlineSlope: 0.5,
  widthSlope: 0.5,
  capped: false,
  minStretch: 0.25,
  maxStretch: 8,
  stretchForBarlineDelta: (d: number) => 1 + d / 0.5 / 100,
  stretchForStep: (d: number) => 1 + d / 0.5 / 100,
})

describe('bar-width drag', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let mc: MouseController
  let engine: Record<string, unknown>
  let render: { renderScore: ReturnType<typeof vi.fn> }
  let room: ReturnType<typeof movableRoom> | null
  let lineKey: string

  const ev = (over: Partial<{ clientX: number; clientY: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    svg = fakeSvg()
    canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector

    room = movableRoom()
    lineKey = '0:1-8'
    const registry = {
      findClosestNoteOrRest: () => null,
      getTupletAt: () => null,
      hitsNoteOrRestBody: () => false,
      findStemAt: () => null,
      findTremoloAt: () => null,
      getByType: (t: string) => (t === 'barline' ? [BARLINE_EL] : []),
      getByMeasure: () => [],
      getTupletById: () => null,
      staffIndexAtY: () => 0,
      getStaffGeometry: () => ({ lineSpacing: 10, noteStartX: 50 }),
      noteOrRestHitDistance: () => Infinity,
    }

    engine = {
      getElementRegistry: () => registry,
      getNote: () => undefined,
      getScore: () => ({ measures: [] }),
      pixelToMeasure: () => 1,
      barWidthRoom: vi.fn(() => room),
      barWidthLineKey: vi.fn(() => lineKey),
      previewBarWidth: vi.fn(() => true),
      commitBarWidth: vi.fn(),
      getBarWidth: () => 1.4,
    }
    render = { renderScore: vi.fn() }

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      { selectNote: vi.fn() } as never, render as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
    mc.setup() // the document-level listeners — one of them settles a release outside the viewport
  })

  afterEach(() => { mc.teardown() })

  /** Press on the barline, then move the pointer to `x`. */
  const grabAndMove = (x: number) => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 110 }))
    mc.handleMouseMove(ev({ clientX: x, clientY: 110 }))
  }

  it('the press still selects the barline', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 110 }))
    expect(state.selectedBarlineMeasure).toBe(1)
  })

  it('inside the dead zone nothing is stretched — a click is still a click', () => {
    grabAndMove(204) // 4px, under the 6px threshold
    expect(engine.previewBarWidth).not.toHaveBeenCalled()
  })

  it('past it the bar follows the cursor, through the room’s OWN conversion', () => {
    grabAndMove(240) // +40px of barline travel
    expect(engine.previewBarWidth).toHaveBeenCalledWith(1, 1 + 40 / 0.5 / 100, 0.25, 8)
  })

  it('drags left as happily as right', () => {
    grabAndMove(160)
    expect(engine.previewBarWidth).toHaveBeenCalledWith(1, 1 - 40 / 0.5 / 100, 0.25, 8)
  })

  it('⭐ a PINNED barline still drags — or a bar stretched to fill its system is trapped', () => {
    // It cannot follow the pointer (justification holds it at the right margin), and refusing the
    // drag for that reason was reported at once: stretch a bar until it IS the system and nothing
    // could shrink it again. So it arms, and the room answers by the bar's own music instead —
    // until the shrink re-wraps the system and tracking resumes.
    room = { ...movableRoom(), barlineSlope: 0, stretchForBarlineDelta: (d: number) => 1 + d / 100 }
    grabAndMove(160)
    expect(engine.previewBarWidth).toHaveBeenCalledWith(1, 1 - 40 / 100, 0.25, 8)
    expect(state.selectedBarlineMeasure).toBe(1)
  })

  it('declines when the last render cannot measure the room, rather than guessing one', () => {
    room = null
    grabAndMove(240)
    expect(engine.previewBarWidth).not.toHaveBeenCalled()
  })

  it('the drop records ONE undo entry, and only when something moved', () => {
    grabAndMove(240)
    mc.handleMouseUp(ev({ clientX: 240 }))
    expect(engine.commitBarWidth).toHaveBeenCalledTimes(1)
  })

  it('a press that never left the dead zone commits nothing', () => {
    grabAndMove(203)
    mc.handleMouseUp(ev({ clientX: 203 }))
    expect(engine.commitBarWidth).not.toHaveBeenCalled()
  })

  it('the room is captured once per CASTING-OFF, not re-measured per frame', () => {
    // Every term in it is fixed while the line holds the same bars (a stretch changes no bar's
    // intrinsic width), and re-reading a moving picture is how a floor creeps out from under a drag.
    grabAndMove(240)
    mc.handleMouseMove(ev({ clientX: 280, clientY: 110 }))
    mc.handleMouseMove(ev({ clientX: 320, clientY: 110 }))
    expect((engine.barWidthRoom as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
  })

  it('⭐ re-anchors when the drag RE-WRAPS the system, so the barline keeps the cursor', () => {
    // Measured before this: the barline tracked to the pixel, then a bar left the line and it ran
    // 21px ahead and stayed there, gaining more on every further re-wrap. The captured slope is a
    // sum over the bars sharing the line, so it expires the moment that set changes.
    grabAndMove(240)
    lineKey = '0:1-7' // the preview pushed a bar onto the next system
    mc.handleMouseMove(ev({ clientX: 280, clientY: 110 }))
    expect((engine.barWidthRoom as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)

    // …and the next frame is measured from the NEW anchor, not from the original grab.
    const preview = engine.previewBarWidth as ReturnType<typeof vi.fn>
    preview.mockClear()
    mc.handleMouseMove(ev({ clientX: 300, clientY: 110 }))
    expect(preview).toHaveBeenCalledWith(1, 1 + 20 / 0.5 / 100, 0.25, 8)
  })

  it('⭐ a release OUTSIDE the viewport still ends the drag', () => {
    // The element's own mouseup never fires there, and this gesture holds an uncommitted preview
    // and a hidden pointer — so being left armed means the score keeps resizing under a mouse with
    // no button held.
    grabAndMove(240)
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(engine.commitBarWidth).toHaveBeenCalledTimes(1)
    expect(canvas.style.cursor).toBe('')

    // …and it really is over: a later move changes nothing.
    const preview = engine.previewBarWidth as ReturnType<typeof vi.fn>
    preview.mockClear()
    mc.handleMouseMove(ev({ clientX: 300, clientY: 110 }))
    expect(preview).not.toHaveBeenCalled()
  })

  it('hides the pointer for the duration of the drag', () => {
    // The re-wrap boundary is a genuine discontinuity — no arithmetic keeps the line under a cursor
    // that is still visible beside it. With the pointer gone the barline IS the cursor.
    grabAndMove(240)
    expect(canvas.style.cursor).toBe('none')
    mc.handleMouseUp(ev({ clientX: 240 }))
    expect(canvas.style.cursor).toBe('')
  })

  it('a press that never became a drag leaves the pointer alone', () => {
    grabAndMove(203)
    expect(canvas.style.cursor).toBe('')
  })
})
