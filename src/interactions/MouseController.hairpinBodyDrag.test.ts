// @vitest-environment jsdom
/**
 * ⭐⭐ DRAGGING A HAIRPIN'S BODY MOVES ITS INK (his ask, 2026-08-18: *"we are not doing drag offset
 * on the hairpin when no endpoint active"*).
 *
 * ⭐ **One wedge, two gestures, told apart by where you grabbed it.** A press on a SQUARE moves that
 * end through the music — a model write, audible, snapping to slots (`shortcutWiring.hairpinResize`
 * and `../hairpinWalk`'s carry). A press on the BODY moves the drawing — an engraving override, silent,
 * in free pixels. These pin the second one, and that it is measured in STAFF-SPACES rather than
 * pixels: the override is resolution-independent, so the same gesture on a small staff must write a
 * bigger number, not the same one.
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

describe('hairpin body drag — the wedge\'s ink follows the cursor', () => {
  let state: EditorState
  let svg: SVGSVGElement
  let mc: MouseController
  let engine: Record<string, unknown>
  let preview: ReturnType<typeof vi.fn>
  let commit: ReturnType<typeof vi.fn>
  let lineSpacing: number

  const ev = (over: Partial<{ clientX: number; clientY: number }> = {}) =>
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

  it('⭐ the press SELECTS the wedge, with no square armed — the arrows then move the whole thing', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 100 }))
    expect(state.selectedElement).toEqual({ kind: 'hairpin', id: 'H1' })
  })

  it('⭐⭐ a drag moves the ink by the cursor\'s delta, converted to STAFF-SPACES', () => {
    grabAndMove(230, 120) // +30px, +20px at 10px per staff-space
    expect(preview).toHaveBeenCalledWith('H1', 3, 2)
  })

  it('⭐⭐ …so a SMALL staff writes a BIGGER number for the same gesture', () => {
    lineSpacing = 7.5
    grabAndMove(230, 100) // the same 30px is now 4 staff-spaces, not 3
    expect(preview).toHaveBeenCalledWith('H1', 4, 0)
  })

  it('⭐ each frame moves by the delta since the LAST one — the write accumulates', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 100 }))
    vi.advanceTimersByTime(200)
    mc.handleMouseMove(ev({ clientX: 210, clientY: 100 }))
    mc.handleMouseMove(ev({ clientX: 230, clientY: 100 }))
    expect(preview.mock.calls).toEqual([['H1', 1, 0], ['H1', 2, 0]])
  })

  it('⛔ a CLICK is still a click — nothing moves inside the time threshold', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 100 }))
    mc.handleMouseMove(ev({ clientX: 260, clientY: 140 }))
    expect(preview).not.toHaveBeenCalled()
  })

  it('⭐ the drop records ONE undo entry, however many frames it took', () => {
    grabAndMove(210, 100)
    mc.handleMouseMove(ev({ clientX: 230, clientY: 100 }))
    mc.handleMouseUp(ev({ clientX: 230, clientY: 100 }))
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('⛔ …and records NOTHING when the press never became a drag', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 100 }))
    mc.handleMouseUp(ev({ clientX: 200, clientY: 100 }))
    expect(commit).not.toHaveBeenCalled()
  })

  it('🚨 a REFUSED frame (the page limit) leaves the anchor put, so the gesture re-synchronises', () => {
    preview.mockReturnValue(false)
    grabAndMove(230, 100)                                  // refused: +3 spaces
    mc.handleMouseMove(ev({ clientX: 240, clientY: 100 })) // still measured from the PRESS, not from 230
    expect(preview.mock.calls).toEqual([['H1', 3, 0], ['H1', 4, 0]])
    // ⛔ Not [3, 1]: advancing the anchor on a refusal would let the wedge jump the distance it
    // never travelled as soon as the cursor came back inside the page.
  })
})
