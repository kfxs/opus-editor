/**
 * The one RULE this module holds, on its own: {@link markSelectionColor}. The constants beside it
 * are hexes and answer for themselves.
 *
 * `HighlightController.markColor.test.ts` asserts the same rule through the painting — this asserts
 * it without a DOM, so the rule survives a change of how the ink is applied.
 */
import { describe, it, expect } from 'vitest'
import { markSelectionColor, ELEMENT_SELECTION_FILL } from './selectionColors'
import { voiceFillColor } from './voiceColors'

describe('markSelectionColor — the colour is what the mark GOVERNS', () => {
  it('a mark with no voice governs the staff, and takes the element ink', () => {
    expect(markSelectionColor({})).toBe(ELEMENT_SELECTION_FILL)
  })

  it('a mark narrowed to a voice takes that voice’s colour', () => {
    for (const v of [0, 1, 2, 3] as const) {
      expect(markSelectionColor({ voice: v })).toBe(voiceFillColor(v))
    }
  })

  // 🚨 The whole reason the rule could not be derived before: `voice: 0` and absent were one value.
  it('voice 0 is NARROWED, not unscoped — the two differ', () => {
    expect(markSelectionColor({ voice: 0 })).not.toBe(markSelectionColor({}))
  })

  it('the element ink is never a voice colour (it must not read as voice 3’s orange)', () => {
    for (const v of [0, 1, 2, 3]) expect(ELEMENT_SELECTION_FILL).not.toBe(voiceFillColor(v))
  })
})
