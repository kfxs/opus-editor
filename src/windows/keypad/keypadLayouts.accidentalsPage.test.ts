import { describe, it, expect, afterEach } from 'vitest'
import { cellAction, cellIcon, cellSign, KEYS, keypadPage, nextKeypadPageId, KEYPAD_BAKE_RECIPES, signIcon } from './keypadLayouts'
import { keypadSignSlots } from './keypadSignSlots'
import { pressKeypadCell } from './keypadPress'
import { bus } from '@/bus'

/**
 * The ACCIDENTALS page — Sibelius 6's sixth Keypad layout, as a picture
 * (`docs/research/sibelius-keypad.md` §3c says what each key means over there).
 *
 * ⛔ What is worth pinning here is WHICH keys act. ⭐ `7 8 9` do — they are page one's natural / sharp /
 * flat SLOTS again (his ask, 2026-09-30: *"we already have this in the first page so we can wire it the
 * same"*), ⭐ `/ *` since K1 — the doubles, two more slots — ⭐ `0` since K2, the REMOVE — ⭐ `Enter` since K3, the accidental's parentheses — ⭐ `5 6 2 3` since K4, the quarter-tones — and ⭐ `4 1` since K5, ♮♯ / ♮♭. The other two are a PICTURE (*"still is not wired to anything, on clicking just console
 * log"*): a key is wired as a decision, one at a time — the Grace page's spec is the model — and the
 * test that lists the `momentary` keys is the one that changes when one is.
 *
 * ⚠️ No geometry: jsdom has no fonts, so a glyph's size and place are not assertable here (the bake
 * step proves the stacked drawings in a browser, picture against picture).
 */
describe('the Keypad Accidentals page', () => {
  afterEach(() => keypadSignSlots.reset())
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
    for (const [key, action] of drawn) expect(cellAction(cellFor(key))).toBe(action)
  })

  it('⭐ its `/ * 7 8 9` are SIGN SLOTS — page one\'s `7 8 9` the same slots — and press `bus.accidental`', () => {
    const slots = (pageId: 'accidentals' | 'noteEntry', keys: string[]) =>
      keys.map(k => keypadPage(pageId).cells.find(c => c.key === k)!).map(c => [c.select, cellSign(c)])
    expect(slots('accidentals', ['/', '*', '7', '8', '9'])).toEqual([
      ['accidental', 'doubleSharp'], ['accidental', 'doubleFlat'],
      ['accidental', 'natural'], ['accidental', 'sharp'], ['accidental', 'flat'],
    ])
    expect(slots('accidentals', ['7', '8', '9'])).toEqual(slots('noteEntry', ['7', '8', '9']))
    const pressed: Array<string | null> = []
    const stop = bus.accidental.onPress(a => pressed.push(a))
    for (const k of ['/', '*', '7', '8', '9']) pressKeypadCell(cellFor(k))
    stop()
    expect(pressed).toEqual(['doubleSharp', 'doubleFlat', 'natural', 'sharp', 'flat'])
  })

  it('⭐ a slot given another sign SHOWS, NAMES and PRESSES the other sign — no code changed (rule 2)', () => {
    keypadSignSlots.set('/', 'flat')
    expect(cellIcon(cellFor('/'))).toEqual(signIcon('flat'))
    expect(cellAction(cellFor('/'))).toBe('flat')
    const pressed: Array<string | null> = []
    const stop = bus.accidental.onPress(a => pressed.push(a))
    pressKeypadCell(cellFor('/'))
    stop()
    expect(pressed).toEqual(['flat'])
    // ⭐ A slot is its KEY: page one's `8` is the Accidentals page's `8`.
    keypadSignSlots.set('8', 'doubleSharp')
    expect(cellSign(keypadPage('noteEntry').cells.find(c => c.key === '8')!)).toBe('doubleSharp')
  })

  it('⛔ only a key that IS a slot can be given a sign — a typo invents nothing', () => {
    expect(() => keypadSignSlots.set('-', 'sharp')).toThrow(/not a sign slot/)
  })

  it('⭐ `0` presses REMOVE — `null` on `bus.accidental`, the palette\'s own "take it off" (K2)', () => {
    expect(cellFor('0').select).toBe('removeAccidentals')
    const pressed: Array<string | null> = []
    const stop = bus.accidental.onPress(a => pressed.push(a))
    pressKeypadCell(cellFor('0'))
    stop()
    expect(pressed).toEqual([null])
  })

  it('⭐ `Enter` presses the accidental\'s PARENTHESES on `bus.accidentalKeys` (K3)', () => {
    expect(cellFor('Enter').select).toBe('accidentalKey')
    const pressed: string[] = []
    const stop = bus.accidentalKeys.onPress(k => pressed.push(k))
    pressKeypadCell(cellFor('Enter'))
    stop()
    expect(pressed).toEqual(['parenthesised'])
  })

  it('⭐ `5 6 2 3` are the QUARTER-TONE slots (K4) — they press their signs on `bus.accidental`', () => {
    const keys = ['5', '6', '2', '3']
    expect(keys.map(k => cellSign(cellFor(k)))).toEqual([
      'quarterToneSharpStein', 'quarterToneFlatStein', 'threeQuarterTonesSharpStein', 'threeQuarterTonesFlatZimmermann',
    ])
    const pressed: Array<string | null> = []
    const stop = bus.accidental.onPress(a => pressed.push(a))
    for (const k of keys) pressKeypadCell(cellFor(k))
    stop()
    expect(pressed).toEqual(keys.map(k => cellSign(cellFor(k))))
  })

  it('⭐ `4 1` are ♮♯ / ♮♭ SLOTS (K5) — accidentals like any other (his rule), pressed on `bus.accidental`', () => {
    expect(['4', '1'].map(k => cellSign(cellFor(k)))).toEqual(['naturalSharp', 'naturalFlat'])
    expect(['4', '1'].map(k => cellAction(cellFor(k)))).toEqual(['natural sharp', 'natural flat'])
  })

  it('⛔ …and the other TWO are not — each is `momentary`, and a press reaches no seam', () => {
    const unwired = own().filter(c => c.select === 'momentary')
    expect(unwired.map(c => c.key)).toEqual(['-', '.'])
    expect(own().length).toBe(unwired.length + 13)
    const pressed: Array<string | null> = []
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
