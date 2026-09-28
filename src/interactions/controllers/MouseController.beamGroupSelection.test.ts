// @vitest-environment jsdom
/**
 * Clicking a BEAM selects it (his ask, 2026-09-28) — the stem's and the flag's twin. Pinned: a press on the beam's
 * slanted INK selects the beam by its anchor; the note keeps the ground its head owns; a press beside the slant but
 * inside the beam's box is NOT the beam; the selection is exclusive of the notes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditorState, selectedOf, type EditorState } from '../state/EditorState'
import { MouseController } from './MouseController'
import { fakeSvg } from '@/testing/fakeSvg'
import { beamLineBand } from '@/engine/rendering/beams/beamHitInk'

const NOTE_EL = { type: 'note' as const, id: 'n1', measure: 1, staff: 0, headX: 100,
                  bbox: { x: 94, y: 60, width: 12, height: 50 } }
const BEAM_LINE = { type: 'beamGroup' as const, noteId: 'n1', measure: 1, staff: 0,
                    points: beamLineBand({ startX: 105, startY: 60, endX: 165, endY: 48 }, 5),
                    bbox: { x: 105, y: 48, width: 60, height: 17 } }

describe('beam selection', () => {
  let state: EditorState
  let svg: SVGSVGElement
  let mc: MouseController
  let selection: { selectNote: ReturnType<typeof vi.fn> }
  let onHead: boolean

  const ev = (over: Partial<{ clientX: number; clientY: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    svg = fakeSvg()
    const canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector
    onHead = false
    const registry = {
      findClosestNoteOrRest: () => NOTE_EL,
      hitsNoteOrRestBody: () => onHead,
      findStemAt: () => null,
      findTremoloAt: () => null,
      getTupletAt: () => null,
      getByType: (type: string) => (type === 'beamGroup' ? [BEAM_LINE] : []),
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

  it('a press on the beam\'s ink selects it, by its anchor note', () => {
    mc.handleMouseDown(ev({ clientX: 135, clientY: 56 }))
    expect(selectedOf(state, 'beamGroup')?.noteId).toBe('n1')
    expect(selection.selectNote).toHaveBeenCalledWith(null)
  })

  it('⭐ inside the beam\'s BOX but off its slant is not the beam', () => {
    mc.handleMouseDown(ev({ clientX: 110, clientY: 50 }))
    expect(selectedOf(state, 'beamGroup')).toBeNull()
  })

  it('⭐ the NOTE keeps the ground its head owns', () => {
    onHead = true
    mc.handleMouseDown(ev({ clientX: 135, clientY: 56 }))
    expect(selectedOf(state, 'beamGroup')).toBeNull()
    expect(selection.selectNote).toHaveBeenCalledWith('n1')
  })
})
