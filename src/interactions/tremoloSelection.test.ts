// @vitest-environment jsdom
/**
 * Clicking a TREMOLO selects it — and the contest with the stem it is drawn on.
 *
 * THE RULE (the whole reason the stem was made selectable first): the mark wins **inside its own
 * boundaries** and nowhere else. Both are registered as ink — the strokes' measured box and the
 * stem's 1.5px line — and the tremolo is asked first, so the border between them is the edge of the
 * strokes. On a two-stroke tremolo, which covers a fraction of the stem, the rest of that stem stays
 * exactly as clickable as it was.
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

/** A stem-up quarter: head at (100, 110), stem up its right side to y=75… */
const NOTE_EL = { type: 'note' as const, id: 'n1', measure: 1, staff: 0, headX: 100,
                  bbox: { x: 94, y: 75, width: 12, height: 40 } }
const STEM_EL = { type: 'stem' as const, noteId: 'n1', measure: 1, staff: 0,
                  bbox: { x: 105, y: 75, width: 1.5, height: 35 } }
/** …carrying two strokes across the middle of it, straddling the stem as the ink does. */
const TREMOLO_EL = { type: 'tremolo' as const, noteId: 'n1', measure: 1, staff: 0,
                     bbox: { x: 99, y: 88, width: 14, height: 12 } }

describe('tremolo selection', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let mc: MouseController
  let selection: { selectNote: ReturnType<typeof vi.fn> }
  let onHead: boolean

  const ev = (over: Partial<{ clientX: number; clientY: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  const inRect = (b: { x: number; y: number; width: number; height: number }, pad: number) =>
    (x: number, y: number) =>
      x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y - pad && y <= b.y + b.height + pad

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
      // The registry's two rules, as they really are: the stem padded (STEM_CLICK_PAD = 5)…
      findStemAt: (x: number, y: number) => (inRect(STEM_EL.bbox, 5)(x, y) ? STEM_EL : null),
      // …and the tremolo bare, so it claims its ink and not a pixel more.
      findTremoloAt: (x: number, y: number) => (inRect(TREMOLO_EL.bbox, 0)(x, y) ? TREMOLO_EL : null),
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
      getNote: () => ({ id: 'n1', voice: 0, tremolo: 2 }),
      getScore: () => ({ measures: [] }),
      pixelToMeasure: () => 1,
      spacingColumnOf: () => null,
      noteSpacingRoom: () => null,
      getMeasureRect: () => null,
    }
    selection = { selectNote: vi.fn() }

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      selection as never, { renderScore: vi.fn() } as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
    mc.setup()
  })

  afterEach(() => { mc.teardown() })

  it('a press on the strokes selects the tremolo, not the stem under them', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 94 }))
    expect(state.selectedTremoloNoteId).toBe('n1')
    expect(state.selectedStemNoteId).toBeNull()
  })

  it('⭐ the stem ABOVE the strokes is still selectable — the mark wins only in its own boundaries', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 80 }))
    expect(state.selectedStemNoteId).toBe('n1')
    expect(state.selectedTremoloNoteId).toBeNull()
  })

  it('⭐ and so is the stem BELOW them, between the strokes and the notehead', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 104 }))
    expect(state.selectedStemNoteId).toBe('n1')
    expect(state.selectedTremoloNoteId).toBeNull()
  })

  it('the strokes are wider than the stem, and that width is theirs', () => {
    // x=101 is inside the tremolo ink but outside even the padded stem: the mark takes it, and
    // nothing else would have.
    mc.handleMouseDown(ev({ clientX: 101, clientY: 94 }))
    expect(state.selectedTremoloNoteId).toBe('n1')
  })

  it('selecting the tremolo CLEARS the note selection — exclusive, like the stem', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 94 }))
    expect(selection.selectNote).toHaveBeenCalledWith(null)
  })

  it('the NOTE still keeps a press its head owns', () => {
    onHead = true
    mc.handleMouseDown(ev({ clientX: 106, clientY: 94 }))
    expect(state.selectedTremoloNoteId).toBeNull()
    expect(selection.selectNote).toHaveBeenCalledWith('n1')
  })
})
