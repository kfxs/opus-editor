import { describe, it, expect } from 'vitest'
import { shortcutLabel } from './shortcutLabel'

describe('shortcutLabel', () => {
  it('shows a single letter as a capital, the way a reader types it', () => {
    expect(shortcutLabel('createSlur')).toBe('S')
  })

  it('keeps the modifiers and capitalises only the letter', () => {
    expect(shortcutLabel('createCrescendo')).toBe('H')
    expect(shortcutLabel('createDiminuendo')).toBe('Shift+H')
    expect(shortcutLabel('openFeatherWindow')).toBe('Ctrl+F')
  })

  it('leaves a NAMED key alone — it is already spelled the way it is shown', () => {
    expect(shortcutLabel('selectNextNote')).toBe('ArrowRight')
  })

  it('answers null for an action with no key, which is a real answer', () => {
    // The trill, both octave lines and the pedal have none, deliberately — their rows show nothing.
    expect(shortcutLabel('createTrill')).toBeNull()
    expect(shortcutLabel('createOttava')).toBeNull()
    expect(shortcutLabel('createPedal')).toBeNull()
  })

  /**
   * ⚠️ THE GUARD THAT MAKES THE HINT SAFE. A hint is derived by ACTION NAME, and an action renamed
   * in `ShortcutConfig` would silently take the hint off the row rather than break a build. These
   * three are the names the Lines window asks for.
   */
  it('resolves every action the Lines window shows a hint for', () => {
    for (const action of ['createSlur', 'createCrescendo', 'createDiminuendo']) {
      expect(shortcutLabel(action)).not.toBeNull()
    }
  })
})
