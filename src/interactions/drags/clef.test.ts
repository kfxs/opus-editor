/**
 * **The clef's drag, as a gesture** — the exact beat recovered at the press, the freeze held for the
 * gesture, the selection following the clef, and a drop that commits only a real move but always
 * unfreezes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ElementInfo } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { fracCreate as frac } from '../../utils/fraction'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'
import { beginClefDrag } from './clef'

describe('beginClefDrag', () => {
  const calls: string[] = []
  const moveClef = vi.fn(() => true)
  const commit = vi.fn()
  const engine = {
    getScore: () => ({ measures: [{ number: 2, clefs: [{ beat: frac(1, 3), clef: 'bass' }] }] }),
    setLayoutFrozen: (on: boolean) => calls.push(`frozen:${on}`),
    setDraggingClef: (at: unknown) => calls.push(`ghost:${at === null ? 'none' : 'on'}`),
    pixelToMeasure: () => 3,
    moveClef,
    commitClefMove: commit,
  } as unknown as MusicEngine
  let host: DragHost
  let state: EditorState
  const clefAt = (over: Partial<ElementInfo> = {}) => ({ measure: 2, beat: 1 / 3, ...over }) as ElementInfo
  const slot = vi.fn(() => frac(2, 1))

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    calls.length = 0
    moveClef.mockReturnValue(true)
    state = { selectedElement: { kind: 'clef', measure: 2, beat: 1 / 3, staff: 1 } } as unknown as EditorState
    host = {
      getEngine: () => engine,
      render: { previewMarks: vi.fn(), renderScore: vi.fn(() => { calls.push('render') }) },
      release: vi.fn(() => { calls.push('release') }),
      setCursor: vi.fn(),
    }
  })
  afterEach(() => vi.useRealTimers())

  const grab = () => {
    const drag = beginClefDrag(host, state, clefAt(), slot)!
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    return drag
  }

  it('⛔ DECLINES the immovable line-start clef, and a clef the model does not hold', () => {
    expect(beginClefDrag(host, state, clefAt({ immovable: true }), slot)).toBeNull()
    expect(beginClefDrag(host, state, clefAt({ beat: 2 }), slot)).toBeNull()
    expect(calls).toEqual([]) // …and freezes nothing
  })

  it('⭐ arming FREEZES the line breaks and shows the ghost', () => {
    beginClefDrag(host, state, clefAt(), slot)
    expect(calls).toEqual(['frozen:true', 'ghost:on'])
  })

  it('⭐ the move starts from the EXACT beat in the model, ⛔ not the registry\'s rounded one', () => {
    grab().move(engine, 400, 100)
    expect(moveClef).toHaveBeenCalledWith(2, frac(1, 3), 3, frac(2, 1))
  })

  it('⭐ the selection FOLLOWS the clef — reassigned, on its own staff', () => {
    grab().move(engine, 400, 100)
    expect(state.selectedElement).toEqual({ kind: 'clef', measure: 3, beat: 2, staff: 1 })
  })

  it('⛔ a CLICK is still a click; and a move onto the slot it is already on writes nothing', () => {
    beginClefDrag(host, state, clefAt(), slot)!.move(engine, 400, 100)
    expect(moveClef).not.toHaveBeenCalled()
    const drag = grab()
    drag.move(engine, 400, 100)
    drag.move(engine, 405, 100) // the same slot again
    expect(moveClef).toHaveBeenCalledTimes(1)
  })

  it('a REFUSED move leaves the clef, the selection and the picture where they were', () => {
    moveClef.mockReturnValue(false)
    grab().move(engine, 400, 100)
    expect(state.selectedElement).toMatchObject({ measure: 2 })
    expect(host.render.renderScore).not.toHaveBeenCalled()
  })

  it('the drop commits where it ENDED, then takes the ghost down, unfreezes and renders once', () => {
    const drag = grab()
    drag.move(engine, 400, 100)
    calls.length = 0
    drag.end()
    expect(commit).toHaveBeenCalledWith(3, frac(2, 1))
    expect(calls).toEqual(['release', 'ghost:none', 'frozen:false', 'render'])
  })

  it('⚠️ a press that never moved commits NOTHING — but still unfreezes: the freeze was taken at the press', () => {
    const drag = beginClefDrag(host, state, clefAt(), slot)!
    calls.length = 0
    drag.end()
    expect(commit).not.toHaveBeenCalled()
    expect(calls).toEqual(['release', 'ghost:none', 'frozen:false', 'render'])
  })
})
