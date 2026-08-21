// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditorState, type EditorState } from './EditorState'
import { MouseController } from './MouseController'
import { fracCreate as frac, fracEq } from '@/utils/fraction'

// Characterization tests for the refactor-fragile CONTROL FLOW of MouseController —
// the parts Tier 2 Step 2.2 will decompose: the modal/scrollbar guards, the armed-paste
// routing, the hand/grab pan state machine (arm → threshold → panBy → release → suppress
// click), and the leave behavior. They assert observable outcomes via the injected
// callbacks, not internals.
//
// NOT covered here (by design — they need real VexFlow geometry / a live registry, and
// are covered by the user's manual UI pass per the refactor plan): selection-by-click
// hit-testing, note-entry-on-click, clef drag, and slur-handle/endpoint drag.

// A fake <svg> with an identity screen-CTM, so clientToSvg(event) maps clientX/Y → x/y
// 1:1 (jsdom implements neither getScreenCTM nor createSVGPoint).
function fakeSvg(): SVGSVGElement {
  return {
    createSVGPoint() {
      const p = {
        x: 0, y: 0,
        matrixTransform: (_m: unknown) => ({ x: p.x, y: p.y }),
      }
      return p
    },
    getScreenCTM: () => ({ inverse: () => ({}) }),
  } as unknown as SVGSVGElement
}

describe('MouseController', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let engine: { getElementRegistry: () => unknown; pixelToMeasure: ReturnType<typeof vi.fn>; getScore: () => unknown }
  let selection: { selectNote: ReturnType<typeof vi.fn> }
  let render: { renderScore: ReturnType<typeof vi.fn> }
  let clipboard: { pasteAt: ReturnType<typeof vi.fn> }
  let panBy: ReturnType<typeof vi.fn<(dx: number, dy: number) => void>>
  let mc: MouseController
  let getEngineImpl: () => unknown

  // A plain fake mouse event for DIRECT handler calls (full control over .target).
  // `button: 0` because a REAL MouseEvent defaults to the primary button, and the handler now checks
  // it — a fake without one is a right-click that never happened.
  const ev = (over: Partial<{ clientX: number; clientY: number; target: unknown; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; button: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false, target: svg, ...over }) as unknown as MouseEvent

  beforeEach(() => {
    state = createEditorState()
    svg = fakeSvg()
    canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector

    engine = {
      getElementRegistry: () => ({ getByMeasure: vi.fn(() => []), staffIndexAtY: vi.fn(() => 0) }),
      pixelToMeasure: vi.fn(() => 3),
      getScore: () => ({ measures: [{ number: 3, slots: [] }] }),
    }
    getEngineImpl = () => engine
    selection = { selectNote: vi.fn() }
    render = { renderScore: vi.fn() }
    clipboard = { pasteAt: vi.fn() }
    panBy = vi.fn<(dx: number, dy: number) => void>()

    mc = new MouseController(
      () => getEngineImpl() as never,
      () => canvas,
      state,
      selection as never,
      render as never,
      () => undefined,        // pending articulations
      () => null,             // text edit
      clipboard as never,
      () => {},               // arm dynamic entry
      () => {},               // arm tempo entry
      panBy,
      () => 1,
    )
  })

  afterEach(() => {
    mc.teardown() // detaches any document-level pan listeners left armed by a test
  })

  describe('handleMouseDown — guards', () => {
    it('is a no-op while a text edit is open (modal)', () => {
      state.editingText = { targetId: 'd1', kind: 'dynamic', isNew: false }
      mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
      expect(panBy).not.toHaveBeenCalled()
      expect(selection.selectNote).not.toHaveBeenCalled()
      expect(clipboard.pasteAt).not.toHaveBeenCalled()
    })

    it('ignores a press on the scroll container itself (scrollbar/gutter)', () => {
      state.selectedTool = 'entry'
      mc.handleMouseDown(ev({ target: canvas }))
      expect(panBy).not.toHaveBeenCalled()
    })

    it('is a no-op when there is no engine', () => {
      getEngineImpl = () => null
      mc.handleMouseDown(ev())
      expect(panBy).not.toHaveBeenCalled()
    })

    it('ignores a RIGHT-click: that gesture belongs to the context menu, not to editing', () => {
      state.selectedTool = 'entry'
      state.pastePlacementArmed = true // the loudest thing a stray mousedown could do
      mc.handleMouseDown(ev({ clientX: 100, clientY: 100, button: 2 }))
      expect(clipboard.pasteAt).not.toHaveBeenCalled()
      expect(selection.selectNote).not.toHaveBeenCalled()
      expect(panBy).not.toHaveBeenCalled()
    })
  })

  describe('armed paste routing', () => {
    it('mousedown commits the paste at the resolved (measure, beat)', () => {
      state.pastePlacementArmed = true
      mc.handleMouseDown(ev({ clientX: 120, clientY: 60 }))
      expect(engine.pixelToMeasure).toHaveBeenCalledWith({ x: 120, y: 60 })
      expect(clipboard.pasteAt).toHaveBeenCalledTimes(1)
      const [measureArg, beatArg] = clipboard.pasteAt.mock.calls[0]
      expect(measureArg).toBe(3)
      expect(fracEq(beatArg, frac(0, 1))).toBe(true) // empty registry → slot beat 0
    })

    it('click also commits an armed paste', () => {
      state.pastePlacementArmed = true
      mc.handleClick(ev({ clientX: 10, clientY: 10 }))
      expect(clipboard.pasteAt).toHaveBeenCalledTimes(1)
    })
  })

  describe('hand/grab pan state machine (non-selection tool)', () => {
    const move = (x: number, y: number) =>
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }))
    const up = () => document.dispatchEvent(new MouseEvent('mouseup', {}))

    beforeEach(() => {
      state.selectedTool = 'entry' // entry/clef/dynamic/TS all arm a pan on empty press
    })

    it('arms but does not pan within the dead zone (< threshold)', () => {
      mc.handleMouseDown(ev({ clientX: 200, clientY: 200 }))
      move(202, 200) // 2px < 4px threshold
      expect(panBy).not.toHaveBeenCalled()
      expect(state.isPanning).toBe(false)
    })

    it('starts panning past the threshold and scrolls opposite the pointer', () => {
      mc.handleMouseDown(ev({ clientX: 200, clientY: 200 }))
      move(210, 200) // crosses threshold; baseline reset to here
      expect(state.isPanning).toBe(true)
      move(215, 203) // d = (+5, +3) → content follows hand → panBy(-5, -3)
      expect(panBy).toHaveBeenLastCalledWith(-5, -3)
    })

    it('a real pan release suppresses the trailing click (one-shot)', () => {
      mc.handleMouseDown(ev({ clientX: 200, clientY: 200 }))
      move(220, 200)
      up()
      expect(state.isPanning).toBe(false)

      // The next click is swallowed (so a drag doesn't drop a stray note); the one after isn't.
      state.pastePlacementArmed = true
      mc.handleClick(ev())
      expect(clipboard.pasteAt).not.toHaveBeenCalled() // suppressed
      mc.handleClick(ev())
      expect(clipboard.pasteAt).toHaveBeenCalledTimes(1) // suppress consumed
    })

    it('a tap (no movement) neither pans nor clears selection in a non-selection tool', () => {
      mc.handleMouseDown(ev({ clientX: 200, clientY: 200 }))
      up()
      expect(panBy).not.toHaveBeenCalled()
      expect(state.isPanning).toBe(false)
      expect(selection.selectNote).not.toHaveBeenCalled()
    })
  })

  /**
   * The rest stamp's click. Arming it KEEPS the keyboard caret (a caret is not a selection — see
   * PaletteController.armMarkingTool); PLACING is what ends keyboard entry, which is this half.
   */
  describe('rest stamp click', () => {
    beforeEach(() => {
      state.selectedTool = 'entry'
      state.selectedMarkingTool = { kind: 'rest' }
      state.selectedNoteId = 'cursor-note' // the keyboard caret, still up
    })

    it('takes the caret down once a rest is actually placed', () => {
      (engine as unknown as { stampRestAtPosition: unknown }).stampRestAtPosition =
        vi.fn(() => ({ id: 'r1', isRest: true, duration: 'q', measure: 3, beat: { num: 0, den: 1 } }))
      mc.handleClick(ev({ clientX: 100, clientY: 100 }))
      expect(state.selectedNoteId).toBeNull() // out of keyboard entry, as asked
      expect(render.renderScore).toHaveBeenCalled()
    })

    it('leaves the caret alone when nothing was placed', () => {
      (engine as unknown as { stampRestAtPosition: unknown }).stampRestAtPosition = vi.fn(() => null)
      mc.handleClick(ev({ clientX: 100, clientY: 100 }))
      expect(state.selectedNoteId).toBe('cursor-note') // a click that did nothing changes nothing
    })

    it('keeps the tool armed — a stamp is used in runs', () => {
      (engine as unknown as { stampRestAtPosition: unknown }).stampRestAtPosition =
        vi.fn(() => ({ id: 'r1', isRest: true, duration: 'q', measure: 3, beat: { num: 0, den: 1 } }))
      mc.handleClick(ev({ clientX: 100, clientY: 100 }))
      expect(state.selectedMarkingTool?.kind).toBe('rest')
    })
  })

  describe('handleMouseLeave', () => {
    it('re-renders and restores the cursor when idle', () => {
      mc.handleMouseLeave()
      expect(render.renderScore).toHaveBeenCalledTimes(1)
      expect(state.showCursor).toBe(true)
    })

    it('survives the pointer leaving the viewport mid-pan (does not tear down)', () => {
      state.selectedTool = 'entry'
      mc.handleMouseDown(ev({ clientX: 200, clientY: 200 })) // arms a pan
      mc.handleMouseLeave()
      expect(render.renderScore).not.toHaveBeenCalled() // bailed — pan still owns the gesture
    })

    /**
     * ⭐⭐ **…AND SO DOES EVERY OTHER DRAG** — his report, 2026-08-21: *"i move up and then i dont
     * release the mouse but went out of the viefinder and when i go back im not editing the slur…
     * this is wrong"*.
     *
     * ⭐ The teardown that used to run here was written for a release we could not SEE, and two
     * better answers already cover that: the document `mouseup` settles a release wherever it
     * happens, and `handleMouseMove`'s `buttons === 0` catches one outside the browser window. ⛔ What
     * was left was killing a gesture the hand is still performing.
     */
    it('🚨 leaves a LIVE gesture alone while the button is still down', () => {
      mc.setup()
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      mc.handleMouseLeave()
      // ⛔ No re-render and no cursor reset: the drag owns the screen until the button comes up.
      expect(render.renderScore).not.toHaveBeenCalled()
      mc.teardown()
    })

    it('⭐ …and still tidies up when nothing is held', () => {
      mc.setup()
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      render.renderScore.mockClear()
      mc.handleMouseLeave()
      expect(render.renderScore).toHaveBeenCalledTimes(1)
      expect(state.showCursor).toBe(true)
      mc.teardown()
    })
  })
})
