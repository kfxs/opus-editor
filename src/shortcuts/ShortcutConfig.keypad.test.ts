import { describe, it, expect } from 'vitest'
import { SHORTCUTS } from './ShortcutConfig'
import { KEYPAD_PAGES, NUMPAD_CODE_TO_KEY, keypadCellForCode } from '../windows/keypad/keypadLayouts'

/**
 * The numpad and the Keypad panel are ONE instrument: every key of the pad presses the cell under it
 * on whatever page is showing. Two ways that can quietly stop being true — a pad key nobody bound (the
 * `.` key, once: 16 keys in the pad, 15 in the shortcut table, and the dot stopped working on every
 * page), and a page that doesn't answer for a key the pad has.
 */
describe('numpad ⇄ Keypad', () => {
  it('binds every key the pad has, and binds it to the Keypad', () => {
    for (const code of Object.keys(NUMPAD_CODE_TO_KEY)) {
      expect(SHORTCUTS[code], `${code} is not bound`).toBeDefined()
      expect(SHORTCUTS[code].action, `${code} does not go to the Keypad`).toBe('keypadKey')
    }
  })

  it('leaves no numpad key bound to anything else', () => {
    for (const [code, def] of Object.entries(SHORTCUTS)) {
      if (!code.startsWith('Numpad')) continue
      expect(def.action, `${code} bypasses the Keypad`).toBe('keypadKey')
    }
  })

  it('resolves every pad key to a cell, on every page', () => {
    for (const page of KEYPAD_PAGES) {
      for (const code of Object.keys(NUMPAD_CODE_TO_KEY)) {
        expect(keypadCellForCode(page.id, code), `${code} hits nothing on ${page.id}`).not.toBeNull()
      }
    }
  })

  it('the Beams/Tremolos beam cluster is on its keys, by function', () => {
    // The mapping the beam palette lands on (Sibelius 6's own): * single, 7 begin, 8 continue,
    // 9 end, / subdivide, - beam-rest. Guards the exact key→function pairing, not just that a cell exists.
    const at = (code: string) => keypadCellForCode('beamsTremolos', code)
    expect(at('NumpadMultiply')).toMatchObject({ select: 'beam', beam: 'single' })
    expect(at('Numpad7')).toMatchObject({ select: 'beam', beam: 'begin' })
    expect(at('Numpad8')).toMatchObject({ select: 'beam', beam: 'continue' })
    expect(at('Numpad9')).toMatchObject({ select: 'beam', beam: 'end' })
    expect(at('NumpadDivide')).toMatchObject({ select: 'subdivide' })
    expect(at('NumpadSubtract')).toMatchObject({ select: 'beamOver' })
  })
})
