import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runWheelGesture } from './wheelGestures'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐⭐ WHAT A WHEEL MEANS ON THE SCORE — the table, and the first row in it: `Shift`+wheel opens and
 * closes a hairpin's MOUTH while its own square is armed (his ask, 2026-08-20).
 *
 * Subject: {@link wheelGestures}, beside this file. The engine is a STUB: what the mouth itself does
 * — which square has it, stepping from what is DRAWN, clamping into the authored range — is
 * `elements/hairpinHandles`' and has its own chapter. What is pinned here is the ROUTING: which
 * chord, which sign, and that a row which does not apply hands the wheel back rather than eating it.
 */
describe('runWheelGesture', () => {
  let state: EditorState
  let engine: MusicEngine
  let setAperture: ReturnType<typeof vi.fn>

  /** A wheel notch: negative deltaY is UP, as the DOM reports it. */
  const notch = (over: Partial<{ deltaY: number; deltaX: number; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
    ({ deltaY: -100, deltaX: 0, shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, ...over })

  beforeEach(() => {
    state = createEditorState()
    setAperture = vi.fn(() => true)
    engine = {
      // A crescendo, so the MOUTH is its right-hand square; drawn at 1.5 spaces with a length that
      // makes 1…2 the authorable range.
      getHairpinById: () => ({ id: 'H1', type: 'cresc' }),
      getElementRegistry: () => ({
        getByType: (t: string) => (t === 'hairpin'
          ? [{ type: 'hairpin', id: 'H1', apertureSpaces: 1.5, hairpinLengthSpaces: 40 }]
          : []),
      }),
      setHairpinAperture: setAperture,
    } as unknown as MusicEngine
    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint: 'end' }
  })

  it('⭐⭐ Shift+wheel UP opens the mouth by the keyboard’s own step', () => {
    expect(runWheelGesture(state, engine, notch()).changed).toBe(true)
    expect(setAperture).toHaveBeenCalledWith('H1', 1.55)
  })

  it('⭐ …and DOWN closes it — the sign is the screen’s, not the model’s', () => {
    expect(runWheelGesture(state, engine, notch({ deltaY: 100 })).changed).toBe(true)
    expect(setAperture).toHaveBeenCalledWith('H1', 1.45)
  })

  it('⭐ one notch is one step, however big the device says the delta is', () => {
    // ⛔ Not scaled by deltaY: a trackpad reports fractions and a mouse reports 100 at a time, so
    // anything proportional makes the same gesture mean two different things on two devices.
    runWheelGesture(state, engine, notch({ deltaY: -3 }))
    expect(setAperture).toHaveBeenCalledWith('H1', 1.55)
  })

  it('⛔ declines without Shift, so an ordinary wheel still scrolls', () => {
    expect(runWheelGesture(state, engine, notch({ shiftKey: false })).consumed).toBe(false)
    expect(setAperture).not.toHaveBeenCalled()
  })

  it('⛔ …and declines with Ctrl held: that chord is ZOOM’s, always', () => {
    expect(runWheelGesture(state, engine, notch({ ctrlKey: true })).consumed).toBe(false)
  })

  it('⛔ …and when the armed square is the CLOSED end — a tip has no aperture', () => {
    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint: 'start' }
    expect(runWheelGesture(state, engine, notch()).consumed).toBe(false)
    expect(setAperture).not.toHaveBeenCalled()
  })

  it('⛔ …and with no square armed at all, so Shift+wheel keeps its usual meaning', () => {
    state.selectedElement = { kind: 'hairpin', id: 'H1' }
    expect(runWheelGesture(state, engine, notch()).consumed).toBe(false)
  })

  it('🚨 a SHIFTED wheel usually arrives as deltaX — the gesture must read it, or the page scrolls', () => {
    // His report, 2026-08-20: at the mouth's bound *"the editor thought i wanted to horizontal
    // scroll"*. Browsers translate a shifted wheel into `deltaX`, which is exactly where that habit
    // comes from — a gesture blind to it declines and the page moves under the hand.
    expect(runWheelGesture(state, engine, notch({ deltaY: 0, deltaX: -100 })).changed).toBe(true)
    expect(setAperture).toHaveBeenCalledWith('H1', 1.55)
  })

  it('⭐⭐ …and it OWNS the wheel at its BOUND too — consumed, though nothing changed', () => {
    // ⛔ "Nothing moved" is not "not mine". Letting the bound fall through is what started the page
    // scrolling sideways mid-gesture.
    setAperture.mockClear()
    engine = { ...engine, getElementRegistry: () => ({
      getByType: (t: string) => (t === 'hairpin'
        ? [{ type: 'hairpin', id: 'H1', apertureSpaces: 2, hairpinLengthSpaces: 40 }]  // at the max
        : []),
    }) } as unknown as MusicEngine
    expect(runWheelGesture(state, engine, notch())).toEqual({ consumed: true, changed: false })
    expect(setAperture, 'and it did not write the same number again').not.toHaveBeenCalled()
  })

  it('⛔ a zero delta is not a notch, and no engine is no gesture', () => {
    expect(runWheelGesture(state, engine, notch({ deltaY: 0 })).consumed).toBe(false)
    expect(runWheelGesture(state, null, notch()).consumed).toBe(false)
  })
})
