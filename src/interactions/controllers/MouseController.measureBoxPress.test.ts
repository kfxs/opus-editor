// @vitest-environment jsdom
/**
 * 🚨🚨 **A PRESS INSIDE A SELECTED MEASURE BOX — his report, 2026-08-31**: *"if a measure is selected
 * and we click inside on a selectable object, we should reselect and not keep the measure
 * selection"*.
 *
 * The staff-spacing grab (Client #7 — with a bar's box showing, drag its staff to space the system)
 * used to be tested BEFORE the element hit-tests, and its only question is *did the press land in
 * this bar's staff band?* — which every object drawn inside the bar answers yes to. So one selected
 * bar turned the whole bar into a spacing handle. It is now the empty-space fallback's first
 * question, and this file is the ORDER: what wins a press inside the box, and what still grabs it.
 *
 * Subject: {@link MouseController}. The registry is fabricated — the question is which branch takes
 * the press, ⛔ not where anything was drawn.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditorState, type EditorState } from '../state/EditorState'
import { MouseController } from './MouseController'
import { fakeSvg } from '@/testing/fakeSvg'


/** Bar 1 spans x 100…300 on a staff whose five lines run y 90…130 — the box the tests press into. */
const NOTE_EL = {
  type: 'note' as const, id: 'n1', measure: 1, staff: 0,
  bbox: { x: 150, y: 100, width: 10, height: 10 },
}
const BARLINE_EL = {
  type: 'barline' as const, id: 'b1', measure: 1, staff: 0,
  bbox: { x: 296, y: 90, width: 4, height: 40 },
}

describe('a press inside the selected measure box', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let mc: MouseController
  let selectNote: ReturnType<typeof vi.fn>
  let onNoteBody: boolean

  const ev = (over: Partial<{ clientX: number; clientY: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  /** The bar-1 box, as a plain click leaves it. */
  const selectTheBox = () => {
    state.selectedElement = {
      kind: 'measureRange', anchor: 1, focus: 1, staff: 0, focusStaff: 0, boxStyle: 'single',
    }
  }

  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    svg = fakeSvg()
    canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector
    onNoteBody = false

    const registry = {
      findClosestNoteOrRest: () => NOTE_EL,
      noteOrRestHitDistance: () => 0,
      hitsNoteOrRestBody: () => onNoteBody,
      getTupletAt: () => null,
      getTupletById: () => null,
      findStemAt: () => null,
      findTremoloAt: () => null,
      getByType: (t: string) => (t === 'barline' ? [BARLINE_EL] : []),
      isPainted: () => true,
      getByMeasure: () => [],
      getAt: () => null,
      staffIndexAtY: () => 0,
      getStaffGeometry: () => ({
        lineSpacing: 10, noteStartX: 110, lineYPositions: [90, 100, 110, 120, 130],
      }),
    }
    const engine = {
      getElementRegistry: () => registry,
      getNote: () => undefined,
      getScore: () => ({ measures: [{ number: 1, slots: [] }] }),
      pixelToMeasure: () => 1,
      getMeasureRect: () => ({ x: 100, y: 80, width: 200, height: 60 }),
      getStaffSpacingAbove: () => 0,
      barWidthRoom: () => null,
      barWidthLineKey: () => '0:1-1',
      isRenderStale: () => false,
    }
    selectNote = vi.fn()

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      { selectNote } as never, { renderScore: vi.fn() } as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
    mc.setup()
  })

  afterEach(() => { mc.teardown() })

  it('🚨🚨 on a NOTE it reselects the note — ⛔ the box does not swallow the press', () => {
    selectTheBox()
    onNoteBody = true
    mc.handleMouseDown(ev({ clientX: 155, clientY: 105 }))
    expect(selectNote).toHaveBeenCalledWith('n1')
    // `selectNote` is the real controller's job in the app; here it is stubbed, so what this file
    // can say is that the BOX is no longer what is selected.
    expect(state.selectedElement).toBeNull()
  })

  it('🚨 …and on a BARLINE it reselects the barline', () => {
    selectTheBox()
    mc.handleMouseDown(ev({ clientX: 298, clientY: 110 }))
    expect(state.selectedElement).toMatchObject({ kind: 'barline', measure: 1 })
  })

  it('⭐ …but on EMPTY staff space it still grabs the box — the spacing drag is intact', () => {
    selectTheBox()
    mc.handleMouseDown(ev({ clientX: 200, clientY: 110 }))
    expect(state.selectedElement, 'the box survived the press it was grabbed by')
      .toMatchObject({ kind: 'measureRange', anchor: 1, boxStyle: 'single' })
    expect(selectNote, 'and nothing was reselected').not.toHaveBeenCalled()
  })

  it('🚨 a press on the PASTEBOARD keeps the box — a pan keeps the selection, box included (his report, 2026-09-22)', () => {
    selectTheBox()
    // Outside every bar: x past bar 1's right edge, and `selectMeasureAt` refuses it there.
    mc.handleMouseDown(ev({ clientX: 400, clientY: 110 }))
    expect(state.selectedElement, 'the box survived the press that armed the pan')
      .toMatchObject({ kind: 'measureRange', anchor: 1, boxStyle: 'single' })
    expect(selectNote).not.toHaveBeenCalled()
  })

  // ⛔ The other half of the fallback — *no* box showing, so the press SELECTS the bar
  // (`selectMeasureAt`) — is not here: it needs a real `ScoreModel` projection and a real
  // `SelectionController`, which is the engine's own chapter. What this file owns is the ORDER.
})
