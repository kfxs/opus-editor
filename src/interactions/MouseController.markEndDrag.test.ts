// @vitest-environment jsdom
/**
 * ⭐⭐ THE SQUARE DRAG, ONE HANDLER FOR FOUR FAMILIES — `MARK_END_DRAGS` and
 * {@link MouseController.handleMarkEndDrag}, which replaced four handlers of 49–57 lines that were
 * 54–56% identical down to the prose.
 *
 * ⚠️ **These four gestures had NO controller-level spec at all** — the walks next door
 * (`../hairpinWalk.test.ts` and friends) own the arithmetic, and nothing covered the session: the
 * press that opens it, the threshold, the anchor a refusal must not advance, and the one commit at
 * the drop. That gap is exactly what let four copies drift, so the collapse brings the contract with
 * it.
 *
 * ⭐ Driven as a TABLE, because the subject is a table: what a family disagrees about is four
 * columns, and every claim below is asserted of all four.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditorState, type EditorState } from './EditorState'
import { MouseController } from './MouseController'
import { fakeSvg } from '@/testing/fakeSvg'


/** One family's square, and the engine calls its frame makes. */
interface Family {
  kind: 'hairpin' | 'ottava' | 'pedal' | 'trill'
  /** The registry type its armed square is published under. */
  handleType: string
  /** The id field that square carries. */
  idField: string
  /** The engine method a frame previews the offset through. */
  previewOffset: string
  /** …and the one the drop commits with. */
  commitDrag: string
  /** ⭐ Where those two live, for a family whose commands have left the facade
   *  (`engine/commands/<family>Commands`): `engine.<commands>.<method>`. Absent = still flat. */
  commands?: string
  /** Whatever else its port reads, beyond the shared stubs. */
  extra: Record<string, unknown>
}

const FAMILIES: Family[] = [
  {
    kind: 'hairpin', handleType: 'hairpin-endpoint', idField: 'hairpinId',
    previewOffset: 'previewHairpinEndpointOffset', commitDrag: 'commitHairpinDrag', commands: 'hairpin',
    extra: {
      getHairpinById: () => ({ id: 'M1', type: 'cresc' }),
      hairpin: {
        nextHairpinStartSlot: () => null,
        nextHairpinEndStop: () => null,
        previewHairpinEnd: () => false,
        previewHairpinEndpointRebase: () => true,
      },
      hairpinEndSlot: () => null,
    },
  },
  {
    kind: 'ottava', handleType: 'ottava-endpoint', idField: 'ottavaId',
    previewOffset: 'previewOttavaEndpointOffset', commitDrag: 'commitOttavaDrag', commands: 'ottava',
    extra: {
      getOttavaById: () => ({ id: 'M1', shift: 1 }),
      ottava: {
        nextOttavaStartSlot: () => null,
        nextOttavaEndSlot: () => null,
        ottavaEndSlot: () => null,
        previewOttavaEnd: () => false,
        previewOttavaEndpointRebase: () => true,
      },
    },
  },
  {
    kind: 'pedal', handleType: 'pedal-endpoint', idField: 'pedalId',
    previewOffset: 'previewPedalEndpointOffset', commitDrag: 'commitPedalDrag', commands: 'pedal',
    extra: {
      getPedalById: () => ({ id: 'M1' }),
      pedal: {
        nextPedalStartSlot: () => null,
        nextPedalLift: () => null,
        previewPedalEndpointRebase: () => true,
      },
      previewPedalEnd: () => false,
    },
  },
  {
    kind: 'trill', handleType: 'trill-endpoint', idField: 'trillId',
    previewOffset: 'previewTrillEndpointOffset', commitDrag: 'commitTrillDrag', commands: 'trill',
    extra: {
      getTrillById: () => ({ id: 'M1', placement: 'above', extension: 'wavy', startNoteId: 'n1' }),
      trill: {
        previewTrillExtension: () => false,
        previewTrillEndpointRebase: () => true,
      },
      previewTrillEnd: () => false,
    },
  },
]

describe.each(FAMILIES)('the $kind square drag, through the one shared handler', (family) => {
  let state: EditorState
  let svg: SVGSVGElement
  let mc: MouseController
  let preview: ReturnType<typeof vi.fn>
  let commit: ReturnType<typeof vi.fn>
  let previewMarks: ReturnType<typeof vi.fn>

  /** The armed square, a 12×12 box at (200, 100). */
  const handle = {
    type: family.handleType, id: 'H', measure: 1, staff: 0,
    bbox: { x: 194, y: 94, width: 12, height: 12 },
    [family.idField]: 'M1', endpoint: 'end' as const,
  }
  /** The mark itself, drawn flat through y = 100. */
  const mark = {
    type: family.kind, id: 'M1', measure: 1, staff: 0,
    bbox: { x: 100, y: 94, width: 200, height: 12 },
  }

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

    preview = vi.fn(() => true)
    commit = vi.fn()
    previewMarks = vi.fn()
    const registry = {
      staffBands: () => [{ top: 90, bottom: 110 }],
      staffRuns: () => ([{ top: 90, bottom: 110 }]).map(b => ({ ...b, left: -Infinity, right: Infinity })),
      findClosestNoteOrRest: () => null,
      getTupletAt: () => null,
      hitsNoteOrRestBody: () => false,
      getByType: (t: string) => (t === family.handleType ? [handle] : t === family.kind ? [mark] : []),
      getByMeasure: () => [],
      getTupletById: () => null,
      staffIndexAtY: () => 0,
      getStaffGeometry: () => ({ lineSpacing: 10, noteStartX: 50, noteEndX: 400, lineYPositions: [90, 95, 100, 105, 110] }),
      noteOrRestHitDistance: () => Infinity,
      isPainted: () => true,
    }
    const engine = {
      getElementRegistry: () => registry,
      getNote: () => null,
      getScore: () => ({ measures: [{ number: 1, slots: [] }] }),
      pixelToMeasure: () => 1,
      runBatch: (_d: string, fn: () => void) => { fn(); return true },
      ...family.extra,
      ...(family.commands
        ? { [family.commands]: {
          ...(family.extra[family.commands] as Record<string, unknown> | undefined),
          [family.previewOffset]: preview, [family.commitDrag]: commit,
        } }
        : { [family.previewOffset]: preview, [family.commitDrag]: commit }),
    }

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      { selectNote: vi.fn() } as never, { renderScore: vi.fn(), previewMarks } as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
  })

  afterEach(() => { mc.teardown(); vi.useRealTimers() })

  /** Press on the square, wait past the click threshold, then move to (x, y). */
  const grabAndMove = (x: number, y: number) => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 100 }))
    vi.advanceTimersByTime(200)
    mc.handleMouseMove(ev({ clientX: x, clientY: y }))
  }

  it('⭐ the press ARMS that end — and the square stays armed, so the arrows can carry on', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 100 }))
    expect(state.selectedElement).toEqual({ kind: family.kind, id: 'M1', endpoint: 'end' })
  })

  it('⭐⭐ a drag reaches THIS family\'s walk, converted to staff-spaces', () => {
    grabAndMove(230, 100)
    expect(preview).toHaveBeenCalled()
    expect(preview.mock.calls[0][0], 'the mark it was armed on').toBe('M1')
  })

  it('⭐⭐ …and previews only that family\'s marks — ⛔ never a full render inside `mousemove`', () => {
    grabAndMove(230, 100)
    expect(previewMarks).toHaveBeenCalledWith(family.kind, 'M1')
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
    expect(commit).toHaveBeenCalledWith('end')
  })

  it('⛔ …and records NOTHING when the press never became a drag', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 100 }))
    mc.handleMouseUp(ev({ clientX: 200, clientY: 100 }))
    expect(commit).not.toHaveBeenCalled()
  })

  it('⛔ the session is gone after the drop, so a stray move writes nothing more', () => {
    grabAndMove(230, 100)
    mc.handleMouseUp(ev({ clientX: 230, clientY: 100 }))
    preview.mockClear()
    mc.handleMouseMove(ev({ clientX: 260, clientY: 100 }))
    expect(preview).not.toHaveBeenCalled()
  })

  /**
   * ⭐⭐ **A GESTURE ENDS ON THE RELEASE, WHEREVER IT HAPPENS — ⛔ never because the pointer left the
   * canvas** (`MouseController.ActiveDrag`, his rule of 2026-08-21).
   *
   * ⚠️ These four families were never in `handleMouseLeave`'s teardown list at all, so before the
   * session collapse nothing said which of the two rules they followed. Now one rule covers all
   * fourteen gestures, and this is where the span families pin it.
   */
  it('🚨 leaving the canvas mid-drag commits NOTHING — the hand is still dragging', () => {
    mc.setup()
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    grabAndMove(230, 100)
    mc.handleMouseLeave()
    expect(commit).not.toHaveBeenCalled()
  })

  it('⭐ …and the release OUTSIDE the canvas commits it, through the document listener', () => {
    mc.setup()
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    grabAndMove(230, 100)
    mc.handleMouseLeave()
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
