import { describe, it, expect, vi } from 'vitest'
import { slurBodyStaffSpacePx, slurBodyDragStep } from './slurBodyDrag'
import type { SlurBodyAnchor, SlurBodyDragEngine } from './slurBodyDrag'
import type { ElementRegistry } from '../engine/ElementRegistry'

/**
 * Dragging the whole ARC — the mouse twin of the arrows with nothing armed.
 *
 * Subject: {@link slurBodyDrag}, sitting beside this file. No DOM and no renderer: the two rules it
 * owns are arithmetic over numbers a render hands in, which is exactly why they live here rather than
 * inline in `MouseController` — a drag's refusal behaviour is invisible until it is wrong.
 *
 * ⭐ His ask, 2026-08-18: *"now the next step is doing this same offset controle by the drag mouse,
 * similar to hairpin"*.
 */
const registryWith = (entries: unknown[], geometry?: { lineSpacing: number }): ElementRegistry => ({
  getByType: (type: string) => (type === 'slur' ? entries : []),
  getStaffGeometry: () => geometry,
} as unknown as ElementRegistry)

const anchor = (over: Partial<SlurBodyAnchor> = {}): SlurBodyAnchor =>
  ({ x: 100, y: 200, staffSpacePx: 10, ...over })

describe('slurBodyStaffSpacePx', () => {
  it('reads the scale the RENDER measured off the drawn arc', () => {
    const registry = registryWith([{ id: 'SL1', staffSpacePx: 7.5, measure: 2 }])
    expect(slurBodyStaffSpacePx(registry, 'SL1')).toBe(7.5)
  })

  it('⚠️ falls back to the arc’s own STAFF geometry when the entry carries no scale', () => {
    // A cross-system fragment may register without one; the staff it was drawn on still knows.
    const registry = registryWith([{ id: 'SL1', measure: 4, staff: 1 }], { lineSpacing: 6 })
    expect(slurBodyStaffSpacePx(registry, 'SL1')).toBe(6)
  })

  it('⛔ answers NULL rather than guessing — no drawn arc, and no geometry either', () => {
    // The offset is stored in staff-spaces, so a constant would move a small staff's slur by the
    // wrong amount. The press then stays an ordinary selection.
    expect(slurBodyStaffSpacePx(registryWith([]), 'SL1')).toBeNull()
    expect(slurBodyStaffSpacePx(registryWith([{ id: 'SL1', measure: 1 }]), 'SL1')).toBeNull()
  })

  it('never answers with another slur’s scale', () => {
    const registry = registryWith([{ id: 'SL2', staffSpacePx: 9, measure: 1 }])
    expect(slurBodyStaffSpacePx(registry, 'SL1')).toBeNull()
  })
})

describe('slurBodyDragStep', () => {
  const engineThat = (accepts: boolean): SlurBodyDragEngine =>
    ({ previewSlurOffset: vi.fn().mockReturnValue(accepts) } as unknown as SlurBodyDragEngine)

  it('moves the curve by the cursor’s travel, converted to staff-spaces', () => {
    const engine = engineThat(true)
    const next = slurBodyDragStep(engine, 'SL1', anchor(), 125, 195)
    expect(engine.previewSlurOffset).toHaveBeenCalledWith('SL1', 2.5, -0.5)
    expect(next).toEqual({ x: 125, y: 195, staffSpacePx: 10 })
  })

  it('⭐ scales by the ANCHOR’s own staff-space size, not a constant', () => {
    const engine = engineThat(true)
    slurBodyDragStep(engine, 'SL1', anchor({ staffSpacePx: 5 }), 110, 200)
    expect(engine.previewSlurOffset).toHaveBeenCalledWith('SL1', 2, 0)
  })

  it('🚨 does NOT advance the anchor when the write is REFUSED', () => {
    // Both limits can refuse (the page's edge, a neighbour's band). Banking the distance the curve
    // never travelled would make it jump when the cursor came back — so the caller keeps its anchor
    // and the gesture re-synchronises.
    const engine = engineThat(false)
    expect(slurBodyDragStep(engine, 'SL1', anchor(), 400, 200)).toBeNull()
    expect(engine.previewSlurOffset).toHaveBeenCalledWith('SL1', 30, 0)
  })

  it('…so the NEXT accepted frame carries the whole travel since the last accepted one', () => {
    // The refused frame above left the anchor at 100; a cursor that reaches 130 then moves the curve
    // by 3 spaces, not by the 1 it travelled since the refusal.
    const engine = engineThat(true)
    slurBodyDragStep(engine, 'SL1', anchor(), 130, 200)
    expect(engine.previewSlurOffset).toHaveBeenCalledWith('SL1', 3, 0)
  })

  it('⛔ writes nothing for a frame the cursor did not move in', () => {
    const engine = engineThat(true)
    expect(slurBodyDragStep(engine, 'SL1', anchor(), 100, 200)).toBeNull()
    expect(engine.previewSlurOffset).not.toHaveBeenCalled()
  })
})
