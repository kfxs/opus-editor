// @vitest-environment jsdom
/**
 * Clicking a FLAG selects it (his ask, 2026-09-28) — the stem's twin (`MouseController.stemSelection.test.ts`).
 *
 * Three rules are pinned: the flag wins inside its own ink over the STEM it hangs from (the two rects overlap at
 * the tip), the stem keeps the rest of its length, and the NOTE keeps the ground its head owns. The selection is
 * exclusive — a selected flag is not a selected note.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditorState, selectedOf, type EditorState } from '../state/EditorState'
import { MouseController } from './MouseController'
import { fakeSvg } from '@/testing/fakeSvg'

/** A stem-up eighth: head at (100, 110), stem up its right side to y=75, the flag hanging right of the tip. */
const NOTE_EL = { type: 'note' as const, id: 'n1', measure: 1, staff: 0, headX: 100,
                  bbox: { x: 94, y: 75, width: 12, height: 40 } }
const STEM_EL = { type: 'stem' as const, noteId: 'n1', measure: 1, staff: 0,
                  bbox: { x: 105, y: 75, width: 1.5, height: 35 } }
const FLAG_EL = { type: 'noteFlag' as const, noteId: 'n1', measure: 1, staff: 0,
                  bbox: { x: 105, y: 75, width: 10, height: 24 } }

describe('flag selection', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let mc: MouseController
  let selection: { selectNote: ReturnType<typeof vi.fn> }
  let render: { renderScore: ReturnType<typeof vi.fn> }
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
      findStemAt: (x: number, y: number) => {
        const b = STEM_EL.bbox
        return x >= b.x - 5 && x <= b.x + b.width + 5 && y >= b.y - 5 && y <= b.y + b.height + 5 ? STEM_EL : null
      },
      findTremoloAt: () => null,
      getTupletAt: () => null,
      getByType: (type: string) => (type === 'noteFlag' ? [FLAG_EL] : type === 'stem' ? [STEM_EL] : []),
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

  it('a press on the flag selects it, by the anchor note id', () => {
    mc.handleMouseDown(ev({ clientX: 112, clientY: 85 }))
    expect(selectedOf(state, 'noteFlag')?.noteId).toBe('n1')
    expect(render.renderScore).toHaveBeenCalled()
  })

  it('⭐ on its HOOK the flag wins over the stem — the two rects overlap', () => {
    mc.handleMouseDown(ev({ clientX: 110, clientY: 80 }))
    expect(selectedOf(state, 'noteFlag')?.noteId).toBe('n1')
    expect(selectedOf(state, 'stem')).toBeNull()
  })

  it('⭐ ON the stem\'s line the press is the STEM\'s, even inside the flag\'s box (seen in Chromium: the flag covered a short stem)', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 80 }))
    expect(selectedOf(state, 'stem')?.noteId).toBe('n1')
    expect(selectedOf(state, 'noteFlag')).toBeNull()
  })

  it('…and below the flag the stem keeps its length', () => {
    mc.handleMouseDown(ev({ clientX: 106, clientY: 106 }))
    expect(selectedOf(state, 'stem')?.noteId).toBe('n1')
    expect(selectedOf(state, 'noteFlag')).toBeNull()
  })

  it('⭐ the NOTE keeps the ground its head owns', () => {
    onHead = true
    mc.handleMouseDown(ev({ clientX: 112, clientY: 85 }))
    expect(selectedOf(state, 'noteFlag')).toBeNull()
    expect(selection.selectNote).toHaveBeenCalledWith('n1')
  })

  it('selecting the flag CLEARS the note selection — the two are exclusive', () => {
    mc.handleMouseDown(ev({ clientX: 112, clientY: 85 }))
    expect(selection.selectNote).toHaveBeenCalledWith(null)
  })
})
