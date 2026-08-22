// @vitest-environment jsdom
/**
 * The note/rest drag decides between TWO gestures from the movement (docs/note-spacing-plan.md §5,
 * P2): vertical wins → re-pitch, horizontal wins → note spacing.
 *
 * These pin the decision itself, which is the part with a history. The old gate was elapsed TIME,
 * and a time gate cannot say what a drag *is*: past 150 ms it re-pitched in whatever direction the
 * cursor happened to be, so a horizontal drag that wandered one staff step changed the pitch on the
 * way past. Hence a distance dead-zone, a dominant-axis choice, and — the easy one to lose in a
 * refactor — an axis that STAYS chosen for the rest of the press.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditorState, type EditorState } from './EditorState'
import { MouseController } from './MouseController'
import { fracCreate as frac } from '@/utils/fraction'

function fakeSvg(): SVGSVGElement {
  return {
    createSVGPoint() {
      const p = { x: 0, y: 0, matrixTransform: (_m: unknown) => ({ x: p.x, y: p.y }) }
      return p
    },
    getScreenCTM: () => ({ inverse: () => ({}) }),
  } as unknown as SVGSVGElement
}

/** One note at (100, 100) in bar 1 beat 1 — the thing every test below grabs. */
const NOTE_EL = {
  type: 'note' as const, id: 'n1', measure: 1, staff: 0, beat: 1, pitch: 60,
  bbox: { x: 96, y: 96, width: 8, height: 8 }, headX: 100,
}
const REST_EL = { ...NOTE_EL, type: 'rest' as const, id: 'r1', pitch: undefined }

/** A score the pitch branch can actually find the note in. ⚠️ It re-reads the model by id — through
 *  the ENGINE (`getNote`), not a `getMeasureNotes` walk, which is blind to a fanned member. */
const scoreWithNote = () => ({
  measures: [{
    number: 1, id: 'm1', timeSignature: { numerator: 4, denominator: 4 },
    slots: [{
      type: 'chord', id: 's1', measure: 1, beat: frac(1, 1), duration: 'q', voice: 0,
      notes: [{ id: 'n1', step: 'C', alter: 0, octave: 4 }],
    }],
  }],
})

describe('note/rest drag — axis decision', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let mc: MouseController
  let element: typeof NOTE_EL | typeof REST_EL
  let note: Record<string, unknown>
  let engine: Record<string, ReturnType<typeof vi.fn> | (() => unknown)>
  let render: { renderScore: ReturnType<typeof vi.fn> }

  const ev = (over: Partial<{ clientX: number; clientY: number; target: unknown; button: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    svg = fakeSvg()
    canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector

    element = NOTE_EL
    note = { id: 'n1', measure: 1, beat: frac(1, 1), staff: 0, step: 'C', alter: 0, octave: 4, isRest: false }

    const registry = {
      findClosestNoteOrRest: () => element,
      getTupletAt: () => null,
      hitsNoteOrRestBody: () => true,
      getByType: () => [],
      getByMeasure: () => [],
      getTupletById: () => null,
      staffIndexAtY: () => 0,
      getStaffGeometry: () => ({ lineSpacing: 10, noteStartX: 50 }),
      noteOrRestHitDistance: () => 0,
    }

    engine = {
      getElementRegistry: () => registry,
      getNote: vi.fn(() => note),
      getScore: scoreWithNote,
      pixelToMeasure: vi.fn(() => 1),
      pixelToPosition: vi.fn(() => ({ measure: 1, beat: 1, spelling: { step: 'E', alter: 0, octave: 4 } })),
      updateNote: vi.fn(),
      // The spacing address of the grabbed note — its own column here; a fanned member's own beat
      // in the app (docs/note-spacing-plan.md §7).
      spacingColumnOf: vi.fn(() => ({ measure: note.measure, beat: note.beat, memberIndex: 0 })),
      noteSpacingRoom: vi.fn(() => 2),
      getNoteSpacing: vi.fn(() => 0),
      previewNoteSpacing: vi.fn(() => true),
      commitNoteSpacing: vi.fn(),
    }
    render = { renderScore: vi.fn() }

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      { selectNote: vi.fn() } as never, render as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
  })

  afterEach(() => { mc.teardown() })

  /** Press on the note, then move to (x, y). */
  const grabAndMove = (x: number, y: number) => {
    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'n1'
    mc.handleMouseMove(ev({ clientX: x, clientY: y }))
  }

  it('inside the dead zone nothing happens — a click is still a click', () => {
    grabAndMove(104, 102) // ~4.5px, under the 6px threshold
    expect(engine.previewNoteSpacing).not.toHaveBeenCalled()
    expect(engine.updateNote).not.toHaveBeenCalled()
  })

  it('a dominantly HORIZONTAL drag spaces, and never touches the pitch', () => {
    grabAndMove(140, 104) // dx 40, dy 4
    expect(engine.previewNoteSpacing).toHaveBeenCalled()
    expect(engine.updateNote).not.toHaveBeenCalled()
  })

  it('a dominantly VERTICAL drag re-pitches, and never touches the spacing', () => {
    grabAndMove(104, 140) // dx 4, dy 40
    expect(engine.updateNote).toHaveBeenCalled()
    expect(engine.previewNoteSpacing).not.toHaveBeenCalled()
  })

  it('⭐ a horizontal drag that WANDERS vertically still only spaces', () => {
    // The old time gate's failure: past 150 ms it re-pitched on whatever the cursor was doing.
    // Here the axis was settled by the first honest movement and stays settled.
    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'n1'
    mc.handleMouseMove(ev({ clientX: 140, clientY: 100 })) // decides: spacing
    mc.handleMouseMove(ev({ clientX: 150, clientY: 130 })) // wanders a staff step or three
    mc.handleMouseMove(ev({ clientX: 160, clientY: 160 }))
    expect(engine.updateNote).not.toHaveBeenCalled()
  })

  it('…and a vertical drag that wanders horizontally still only re-pitches', () => {
    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'n1'
    mc.handleMouseMove(ev({ clientX: 100, clientY: 140 })) // decides: pitch
    mc.handleMouseMove(ev({ clientX: 150, clientY: 145 }))
    expect(engine.previewNoteSpacing).not.toHaveBeenCalled()
  })

  it('the delta is in STAFF-SPACES, taken from the grabbed staff’s own line spacing', () => {
    grabAndMove(145, 100) // 45px right, 10px per staff space
    expect(engine.previewNoteSpacing).toHaveBeenLastCalledWith(1, frac(1, 1), 4.5, -2)
  })

  it('rides on top of the space already there', () => {
    engine.getNoteSpacing = vi.fn(() => 3)
    grabAndMove(120, 100) // +2 staff-spaces on a baseline of 3
    expect(engine.previewNoteSpacing).toHaveBeenLastCalledWith(1, frac(1, 1), 5, 1)
  })

  it('carries the floor measured at the GRAB, not one re-read mid-drag', () => {
    grabAndMove(60, 100)
    expect(engine.noteSpacingRoom).toHaveBeenCalledTimes(1)
    expect(engine.previewNoteSpacing).toHaveBeenLastCalledWith(1, frac(1, 1), -4, -2)
  })

  it('a REST can be dragged too — it occupies a column exactly as a note does', () => {
    element = REST_EL
    note = { id: 'r1', measure: 1, beat: frac(1, 1), staff: 0, isRest: true }
    state.selectedNoteId = 'r1'
    grabAndMove(140, 100)
    expect(engine.previewNoteSpacing).toHaveBeenCalled()
  })

  it('a rest dragged VERTICALLY does nothing — there is no pitch to drag', () => {
    element = REST_EL
    note = { id: 'r1', measure: 1, beat: frac(1, 1), staff: 0, isRest: true }
    state.selectedNoteId = 'r1'
    grabAndMove(100, 140)
    expect(engine.updateNote).not.toHaveBeenCalled()
    expect(engine.previewNoteSpacing).not.toHaveBeenCalled()
  })

  it('declines to arm spacing at all when the floor cannot be measured', () => {
    engine.noteSpacingRoom = vi.fn(() => null)
    grabAndMove(140, 100)
    expect(engine.previewNoteSpacing).not.toHaveBeenCalled()
  })

  /**
   * ⭐ A FANNED MEMBER drags like any other note (docs/fanned-beam-pitches-plan.md §2 P3).
   *
   * It reached the registry and the highlight and STILL did nothing on a drag, because the pitch
   * branch re-read the note through `getMeasureNotes` — which walks `slot.notes` and cannot see a
   * member. The gesture armed, the axis was decided, and the drop wrote nothing (his report).
   */
  it('⭐ a member the flat walk cannot see still re-pitches on a vertical drag', () => {
    // The score holds ONE fanned slot whose member id is NOT among `slot.notes`.
    engine.getScore = () => ({
      measures: [{
        number: 1, id: 'm1', timeSignature: { numerator: 4, denominator: 4 },
        slots: [{
          type: 'chord', id: 's1', measure: 1, beat: frac(0, 1), duration: 'h', voice: 0,
          notes: [{ id: 'n1', step: 'C', alter: 0, octave: 4 }],
          fan: {
            direction: 'accel', count: 2, beams: 3,
            members: [[{ id: 'fm1', step: 'C', alter: 0, octave: 4 }]],
          },
        }],
      }],
    })
    // …and the engine answers for it, exactly as the real `getNote` does.
    note = { id: 'fm1', measure: 1, beat: frac(0, 1), staff: 0, step: 'C', alter: 0, octave: 4, isRest: false }
    element = { ...NOTE_EL, id: 'fm1' }

    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'fm1'
    mc.handleMouseMove(ev({ clientX: 104, clientY: 140 })) // dominantly vertical

    expect(engine.updateNote).toHaveBeenCalledWith('fm1', expect.objectContaining({ step: 'E', octave: 4 }))
    expect(render.renderScore).toHaveBeenCalled()
  })
})

describe('note/rest drag — release', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let mc: MouseController
  let engine: Record<string, ReturnType<typeof vi.fn> | (() => unknown)>

  const ev = (over: Partial<{ clientX: number; clientY: number; target: unknown; button: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    svg = fakeSvg()
    canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector

    const registry = {
      findClosestNoteOrRest: () => NOTE_EL, getTupletAt: () => null, hitsNoteOrRestBody: () => true,
      getByType: () => [], getByMeasure: () => [], getTupletById: () => null, staffIndexAtY: () => 0,
      getStaffGeometry: () => ({ lineSpacing: 10, noteStartX: 50 }), noteOrRestHitDistance: () => 0,
    }
    engine = {
      getElementRegistry: () => registry,
      getNote: vi.fn(() => ({ id: 'n1', measure: 1, beat: frac(1, 1), staff: 0, step: 'C', alter: 0, octave: 4 })),
      getScore: scoreWithNote,
      pixelToMeasure: vi.fn(() => 1),
      pixelToPosition: vi.fn(() => ({ measure: 1, beat: 1, spelling: { step: 'E', alter: 0, octave: 4 } })),
      updateNote: vi.fn(),
      spacingColumnOf: vi.fn(() => ({ measure: 1, beat: frac(1, 1), memberIndex: 0 })),
      noteSpacingRoom: vi.fn(() => 2), getNoteSpacing: vi.fn(() => 0),
      previewNoteSpacing: vi.fn(() => true), commitNoteSpacing: vi.fn(),
    }

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      { selectNote: vi.fn() } as never, { renderScore: vi.fn(), previewMarks: vi.fn() } as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
  })

  afterEach(() => { mc.teardown() })

  it('records ONE undo entry on release, however many frames it took', () => {
    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'n1'
    for (const x of [120, 130, 140, 150]) mc.handleMouseMove(ev({ clientX: x, clientY: 100 }))
    mc.handleMouseUp(ev())
    expect(engine.commitNoteSpacing).toHaveBeenCalledTimes(1)
  })

  it('a press that never left the dead zone commits nothing', () => {
    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'n1'
    mc.handleMouseMove(ev({ clientX: 102, clientY: 101 }))
    mc.handleMouseUp(ev())
    expect(engine.commitNoteSpacing).not.toHaveBeenCalled()
  })

  it('a drag the engine refused (nothing changed) commits nothing', () => {
    engine.previewNoteSpacing = vi.fn(() => false)
    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'n1'
    mc.handleMouseMove(ev({ clientX: 160, clientY: 100 }))
    mc.handleMouseUp(ev())
    expect(engine.commitNoteSpacing).not.toHaveBeenCalled()
  })

  it('leaving the viewport mid-drag still commits — the score already moved', () => {
    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'n1'
    mc.handleMouseMove(ev({ clientX: 150, clientY: 100 }))
    mc.handleMouseLeave()
    expect(engine.commitNoteSpacing).toHaveBeenCalledTimes(1)
  })

  it('a second press starts undecided again', () => {
    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    state.selectedNoteId = 'n1'
    mc.handleMouseMove(ev({ clientX: 150, clientY: 100 })) // spacing
    mc.handleMouseUp(ev())

    mc.handleMouseDown(ev({ clientX: 100, clientY: 100 }))
    mc.handleMouseMove(ev({ clientX: 100, clientY: 150 })) // …now vertical: must re-pitch
    expect(engine.updateNote).toHaveBeenCalled()
  })
})
