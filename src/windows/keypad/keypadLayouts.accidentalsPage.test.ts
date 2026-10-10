import { describe, it, expect, afterEach } from 'vitest'
import { cellAction, cellIcon, cellSign, KEYS, keypadPage, nextKeypadPageId, signIcon } from './keypadLayouts'
import { keypadSignSlots } from './keypadSignSlots'
import { pressKeypadCell } from './keypadPress'
import { bus } from '@/bus'

/**
 * The ACCIDENTALS page — Sibelius 6's sixth Keypad layout, then HIS (K7, 2026-10-10): every key but `Enter` is a
 * SIGN SLOT, its picture its sign's own glyph. ⛔ What is worth pinning here is WHICH key holds WHICH sign and that
 * each one presses it — the layout is one table (`keypadSignSlots`), so this spec is that table read back.
 *
 * ⚠️ No geometry: jsdom has no fonts, so a glyph's size and place are not assertable here.
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

  it('⭐ his layout (K7): which key holds which sign, named by what it does', () => {
    const drawn: Array<[string, string, string]> = [
      ['/', 'doubleSharp', 'double sharp'], ['*', 'doubleFlat', 'double flat'], ['-', 'quarterToneSharpNaturalArrowUp', 'natural, quarter-tone up'],
      ['7', 'natural', 'natural'], ['8', 'sharp', 'sharp'], ['9', 'flat', 'flat'],
      ['4', 'threeQuarterTonesSharpArrowUp', 'sharp, quarter-tone up'], ['5', 'quarterToneSharpStein', 'quarter-tone sharp'], ['6', 'quarterToneFlatStein', 'quarter-tone flat'],
      ['1', 'quarterToneSharpArrowDown', 'sharp, quarter-tone down'], ['2', 'threeQuarterTonesSharpStein', 'three-quarter-tone sharp'], ['3', 'threeQuarterTonesFlatZimmermann', 'three-quarter-tone flat'],
      ['0', 'quarterToneFlatArrowUp', 'flat, quarter-tone up'], ['.', 'threeQuarterTonesFlatArrowDown', 'flat, quarter-tone down'],
    ]
    expect(drawn.map(([key]) => [key, cellSign(cellFor(key)), cellAction(cellFor(key))])).toEqual(drawn)
  })

  it('⭐ the five ARROW keys (K7) draw their own glyph — E272 E274 E275 E270 E271 — and press their sign', () => {
    const keys = ['-', '4', '1', '0', '.']
    const codepoints = keys.map(k => {
      const icon = cellIcon(cellFor(k)) as { glyph?: string }
      return (icon.glyph ?? '').codePointAt(0)?.toString(16)
    })
    expect(codepoints).toEqual(['e272', 'e274', 'e275', 'e270', 'e271'])
    const pressed: Array<string | null> = []
    const stop = bus.accidental.onPress(a => pressed.push(a))
    for (const k of keys) pressKeypadCell(cellFor(k))
    stop()
    expect(pressed).toEqual(keys.map(k => cellSign(cellFor(k))))
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
    expect(() => keypadSignSlots.set('Enter', 'sharp')).toThrow(/not a sign slot/)
  })

  it('⭐ a sign that LOST its key is still a sign — ♮♯ goes back on `4` with no code changed (his "wider palette")', () => {
    keypadSignSlots.set('4', 'naturalSharp')
    expect([cellSign(cellFor('4')), cellAction(cellFor('4'))]).toEqual(['naturalSharp', 'natural sharp'])
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

  it('⭐ every key but `Enter` is a SIGN SLOT — no picture-only key is left', () => {
    expect(own().filter(c => c.select !== 'accidental').map(c => c.key)).toEqual(['Enter'])
    expect(page().cells.filter(c => 'bake' in c.icon)).toEqual([])
  })
})
