// @vitest-environment jsdom
/**
 * Clicking a STEM selects it.
 *
 * The stem has been a registered element since the tremolo stamp (it needed somewhere to aim), but
 * pressing on it selected nothing: `hitsNoteOrRestBody` ignores the stem on purpose, so the press
 * fell through to empty-space handling and armed a box-select / pan. This is the pointer half of
 * that registration.
 *
 * Two rules are worth pinning: the NOTE keeps the ground where the two hit-boxes overlap (the head
 * end of the stem), and the selection is exclusive — a selected stem is not a selected note, exactly
 * as an accidental or a dot is not.
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

/** A stem-up quarter: head at (100, 110), stem drawn up its right side to y=75. */
const NOTE_EL = { type: 'note' as const, id: 'n1', measure: 1, staff: 0, headX: 100,
                  bbox: { x: 94, y: 75, width: 12, height: 40 } }
const STEM_EL = { type: 'stem' as const, noteId: 'n1', measure: 1, staff: 0,
                  bbox: { x: 105, y: 75, width: 1.5, height: 35 } }

describe('stem selection', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let mc: MouseController
  let selection: { selectNote: ReturnType<typeof vi.fn> }
  let render: { renderScore: ReturnType<typeof vi.fn> }
  /** Whether the press counts as landing on the notehead — the one knob the note/stem contest turns on. */
  let onHead: boolean

  const ev = (over: Partial<{ clientX: number; clientY: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    svg = fakeSvg()
    canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector

    onHead = false
    const registry = {
      findClosestNoteOrRest: () => NOTE_EL,
      hitsNoteOrRestBody: () => onHead,
      // Containment on the padded ink rect — the real registry's rule (STEM_CLICK_PAD = 5).
      findStemAt: (x: number, y: number) => {
        const b = STEM_EL.bbox
        return x >= b.x - 5 && x <= b.x + b.width + 5 && y >= b.y - 5 && y <= b.y + b.height + 5
          ? STEM_EL : null
      },
      findTremoloAt: () => null, // no tremolo on this note — the stem owns its whole length
      getTupletAt: () => null,
      getByType: () => [],
      getByMeasure: () => [],
      getTupletById: () => null,
      staffIndexAtY: () => 0,
      getStaffGeometry: () => ({ lineSpacing: 10, noteStartX: 50 }),
      noteOrRestHitDistance: () => Infinity,
    }

    const engine = {
      getElementRegistry: () => registry,
      getNote: () => ({ id: 'n1', voice: 0 }),
      getScore: () => ({ measures: [] }),
      pixelToMeasure: () => 1,
      // The two things the fall-through paths ask for: arming a spacing drag on the note, and the
      // bar rect a press on empty space would box-select. Both decline, so neither path does more.
      noteSpacingRoom: () => null,
      getMeasureRect: () => null,
    }
    selection = { selectNote: vi.fn() }
    render = { renderScore: vi.fn() }

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      selection as never, render as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
    mc.setup()
  })

  afterEach(() => { mc.teardown() })

  it('a press on the stem selects it, by the anchor note id', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 85 }))
    expect(state.selectedStemNoteId).toBe('n1')
    expect(render.renderScore).toHaveBeenCalled()
  })

  it('the tip counts — a stem is selected along its whole length, not near its head', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 76 }))
    expect(state.selectedStemNoteId).toBe('n1')
  })

  it('⭐ the NOTE keeps the overlap: a press the notehead owns never reaches the stem', () => {
    onHead = true
    mc.handleMouseDown(ev({ clientX: 106, clientY: 108 }))
    expect(state.selectedStemNoteId).toBeNull()
    expect(selection.selectNote).toHaveBeenCalledWith('n1')
  })

  it('selecting the stem CLEARS the note selection — the two are exclusive', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 85 }))
    expect(selection.selectNote).toHaveBeenCalledWith(null)
  })

  it('a press well clear of the stem selects nothing', () => {
    mc.handleMouseDown(ev({ clientX: 140, clientY: 85 }))
    expect(state.selectedStemNoteId).toBeNull()
  })
})
