import { describe, it, expect } from 'vitest'
import { KEYS, keypadPage, nextKeypadPageId, KEYPAD_BAKE_RECIPES } from './keypadLayouts'
import { pressKeypadCell } from './keypadPress'
import { bus } from '@/bus'

/**
 * The ACCIDENTALS page — Sibelius 6's sixth Keypad layout, as a picture
 * (`docs/research/sibelius-keypad.md` §3c says what each key means over there).
 *
 * ⛔ What is worth pinning here is WHICH keys act. ⭐ `7 8 9` do — they are page one's natural / sharp /
 * flat again (his ask, 2026-09-30: *"we already have this in the first page so we can wire it the
 * same"*). The other twelve are a PICTURE (*"still is not wired to anything, on clicking just console
 * log"*): a key is wired as a decision, one at a time — the Grace page's spec is the model — and the
 * test that lists the `momentary` keys is the one that changes when one is.
 *
 * ⚠️ No geometry: jsdom has no fonts, so a glyph's size and place are not assertable here (the bake
 * step proves the stacked drawings in a browser, picture against picture).
 */
describe('the Keypad Accidentals page', () => {
  const page = () => keypadPage('accidentals')
  const cellFor = (key: string) => page().cells.find(c => c.key === key)!
  const own = () => page().cells.filter(c => c.select !== 'mode' && c.select !== 'page')

  it('is the LAST page — `+` reaches it from Beams/Tremolos and turns back to note entry', () => {
    expect(nextKeypadPageId('beamsTremolos')).toBe('accidentals')
    expect(nextKeypadPageId('accidentals')).toBe('noteEntry')
    expect(page().name).toBe('Accidentals')
  })

  it('is the numpad, in reading order, with the two shared controls in their fixed spots', () => {
    expect(page().cells.map(c => c.key)).toEqual(KEYS)
    expect(cellFor('NumLock').select).toBe('mode')
    expect(cellFor('+').select).toBe('page')
  })

  it('draws Sibelius\'s own keys, each on the numpad key Sibelius puts it on', () => {
    const drawn: Array<[string, string]> = [
      ['/', 'double sharp'], ['*', 'double flat'], ['-', 'blank'],
      ['7', 'natural'], ['8', 'sharp'], ['9', 'flat'],
      ['4', 'natural sharp'], ['5', 'quarter-tone sharp'], ['6', 'quarter-tone flat'],
      ['1', 'natural flat'], ['2', 'three-quarter-tone sharp'], ['3', 'three-quarter-tone flat'],
      ['Enter', 'parenthesised accidental'],
      ['0', 'remove accidentals'], ['.', 'suppress cautionary accidental'],
    ]
    for (const [key, action] of drawn) expect(cellFor(key).action).toBe(action)
  })

  it('⭐ its `7 8 9` are wired — page one\'s natural / sharp / flat, cell for cell — and press `bus.accidental`', () => {
    const wired = (pageId: 'accidentals' | 'noteEntry') =>
      ['7', '8', '9'].map(k => keypadPage(pageId).cells.find(c => c.key === k)!).map(c => [c.action, c.select, c.accidental])
    expect(wired('accidentals')).toEqual([['natural', 'accidental', 'n'], ['sharp', 'accidental', '#'], ['flat', 'accidental', 'b']])
    expect(wired('accidentals')).toEqual(wired('noteEntry'))
    const pressed: string[] = []
    const stop = bus.accidental.onPress(a => pressed.push(a))
    for (const k of ['7', '8', '9']) pressKeypadCell(cellFor(k))
    stop()
    expect(pressed).toEqual(['n', '#', 'b'])
  })

  it('⛔ …and the other TWELVE are not — each is `momentary`, and a press reaches no seam', () => {
    const unwired = own().filter(c => c.select === 'momentary')
    expect(unwired.map(c => c.key)).toEqual(['/', '*', '-', '4', '5', '6', '1', '2', '3', 'Enter', '0', '.'])
    expect(own().length).toBe(unwired.length + 3)
    const pressed: string[] = []
    const stop = bus.accidental.onPress(a => pressed.push(a))
    for (const cell of unwired) pressKeypadCell(cell)
    stop()
    expect(pressed).toEqual([])
  })

  it('⭐ every STACKED drawing on it is offered to the bake — one left out draws as live text for ever', () => {
    const stacked = page().cells.filter(c => 'bake' in c.icon)
    expect(stacked.map(c => c.key)).toEqual(['0', '.'])
    const recipes = Object.values(KEYPAD_BAKE_RECIPES)
    for (const cell of stacked) {
      expect(recipes, `${cell.action} is a stack the bake never sees`)
        .toContainEqual((cell.icon as { bake: unknown }).bake)
    }
  })
})
