import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from '../interactions/EditorState'
import { resolveStaffSize } from '../engine/models/staffSize'
import {
  staffSizeTarget, isSelectedStaffSmall, toggleSelectedStaffSize, DEV_SMALL_STAFF_SIZE,
} from './staffSizeToggle'

/**
 * The dev-shell staff-size button (docs/staff-size-plan.md P1). Crude on purpose, but two things
 * about it are not: WHICH staff a press acts on (the plain-click box, never the Ctrl+Shift range),
 * and that the light is read from the model rather than remembered by the button.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
  getByMeasure: vi.fn(() => []),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

let engine: MusicEngine
let state: EditorState

/** Select bar 1 on staff `staff` the way a plain click does (the SINGLE box). */
function plainClickBar(staff: number): void {
  state.selectedElement = { kind: 'measureRange', anchor: 1, focus: 1, staff, boxStyle: 'single' }
}

beforeEach(() => {
  engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  engine.addMeasure()
  engine.addStaffBelow(0)
  state = createEditorState()
})

describe('staffSizeTarget — which staff a press acts on', () => {
  it('is the plain-click-selected bar’s staff', () => {
    plainClickBar(1)
    const target = staffSizeTarget(state, engine)
    expect(target?.staffIndex).toBe(1)
    expect(target?.staffId).toBe(engine.getScore().staves![1].id)
    expect(target?.size).toBe(1)
  })

  it('is nothing with no selection, and nothing under a Ctrl+Shift measure RANGE box', () => {
    expect(staffSizeTarget(state, engine)).toBeNull()
    state.selectedElement = { kind: 'measureRange', anchor: 1, focus: 2, staff: 0, boxStyle: 'double' }
    expect(staffSizeTarget(state, engine)).toBeNull()
  })

  it('is nothing without an engine', () => {
    plainClickBar(0)
    expect(staffSizeTarget(state, null)).toBeNull()
  })
})

describe('toggleSelectedStaffSize', () => {
  it('flips the selected staff small, and only that staff', () => {
    plainClickBar(1)
    expect(toggleSelectedStaffSize(state, engine)).toBe(true)

    const score = engine.getScore()
    expect(resolveStaffSize(score, score.staves![1].id)).toBe(DEV_SMALL_STAFF_SIZE)
    expect(resolveStaffSize(score, score.staves![0].id)).toBe(1)
  })

  it('flips back to full size, clearing the field', () => {
    plainClickBar(0)
    toggleSelectedStaffSize(state, engine)
    expect(toggleSelectedStaffSize(state, engine)).toBe(true)
    expect(engine.getScore().staves![0].size).toBeUndefined()
  })

  it('returns a staff of ANY other size to full size — the button is not the only writer', () => {
    plainClickBar(0)
    engine.setStaffSize(0, 0.55)
    expect(toggleSelectedStaffSize(state, engine)).toBe(true)
    expect(resolveStaffSize(engine.getScore(), engine.getScore().staves![0].id)).toBe(1)
  })

  it('is a no-op with no bar selected', () => {
    expect(toggleSelectedStaffSize(state, engine)).toBe(false)
    expect(engine.getScore().staves!.every(s => s.size === undefined)).toBe(true)
  })

  it('is ONE undo entry, and undo puts the staff back', () => {
    plainClickBar(0)
    toggleSelectedStaffSize(state, engine)
    expect(engine.canUndo()).toBe(true)

    engine.undo()
    expect(resolveStaffSize(engine.getScore(), engine.getScore().staves![0].id)).toBe(1)
  })
})

describe('isSelectedStaffSmall — the light', () => {
  it('is off at full size and on when the staff is small', () => {
    plainClickBar(1)
    expect(isSelectedStaffSmall(state, engine)).toBe(false)
    toggleSelectedStaffSize(state, engine)
    expect(isSelectedStaffSmall(state, engine)).toBe(true)
  })

  it('asks the MODEL, so it follows the selection from staff to staff', () => {
    plainClickBar(1)
    toggleSelectedStaffSize(state, engine)
    plainClickBar(0)
    expect(isSelectedStaffSmall(state, engine)).toBe(false)
    plainClickBar(1)
    expect(isSelectedStaffSmall(state, engine)).toBe(true)
  })

  it('lights on any size that is not full, not just the button’s own 0.7', () => {
    plainClickBar(0)
    engine.setStaffSize(0, 0.55)
    expect(isSelectedStaffSmall(state, engine)).toBe(true)
  })

  it('is off, not undefined, with nothing selected', () => {
    expect(isSelectedStaffSmall(state, engine)).toBe(false)
  })
})
