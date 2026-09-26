import { describe, it, expect, vi, afterEach } from 'vitest'
import { KEYS, keypadPage, nextKeypadPageId, KEYPAD_BAKE_RECIPES } from './keypadLayouts'
import { pressKeypadCell } from './keypadPress'
import { bus } from '@/bus'

/**
 * The GRACE page — Sibelius 6's second Keypad layout, as a picture
 * (`docs/research/sibelius-keypad.md` says what each key means over there).
 *
 * ⛔ What is worth pinning here is WHICH keys act: the page was drawn as a PICTURE, and a key is wired only
 * as a decision. ⭐ The first three were (his ask, 2026-09-23: *"wire the grace page of the keypad the same
 * way is wired the dev shell grace pallete"*) — `/` appoggiatura, `*` acciaccatura, `-` bracketed grace; the
 * rest followed key by key, the six durations last (2026-09-26). Each wiring is pinned by the test that
 * lists it.
 *
 * ⚠️ No geometry: jsdom has no fonts, so a glyph's size and place are not assertable here (the bake
 * step proves those in a browser, picture against picture).
 */
describe('the Keypad Grace page', () => {
  const page = () => keypadPage('grace')
  const cellFor = (key: string) => page().cells.find(c => c.key === key)!

  it('is the SECOND page — the `+` ring runs note entry → Grace → Beams/Tremolos', () => {
    expect(nextKeypadPageId('noteEntry')).toBe('grace')
    expect(nextKeypadPageId('grace')).toBe('beamsTremolos')
    expect(nextKeypadPageId('beamsTremolos')).toBe('noteEntry')
    expect(page().name).toBe('Grace')
  })

  it('is the numpad, in reading order, with the two shared controls in their fixed spots', () => {
    expect(page().cells.map(c => c.key)).toEqual(KEYS)
    expect(cellFor('NumLock').select).toBe('mode')
    expect(cellFor('+').select).toBe('page')
  })

  it('⭐ its three GRACE keys are wired — the dev toolbar\'s three buttons — and press `bus.grace`', () => {
    expect(['/', '*', '-'].map(k => [cellFor(k).select, cellFor(k).grace]))
      .toEqual([['grace', 'appoggiatura'], ['grace', 'acciaccatura'], ['grace', 'bracketed']])
    const pressed: string[] = []
    const stop = bus.grace.onPress(k => pressed.push(k))
    for (const k of ['/', '*', '-']) pressKeypadCell(cellFor(k))
    stop()
    expect(pressed).toEqual(['appoggiatura', 'acciaccatura', 'bracketed'])
  })

  it('⭐ its `1` is wired too — the dev toolbar\'s `paren.` — and presses `bus.grace`', () => {
    expect([cellFor('1').select, cellFor('1').grace]).toEqual(['grace', 'parenthesised'])
    const pressed: string[] = []
    const stop = bus.grace.onPress(k => pressed.push(k))
    pressKeypadCell(cellFor('1'))
    stop()
    expect(pressed).toEqual(['parenthesised'])
  })

  it('⭐ its `2` / `3` are wired too — the dev toolbar\'s `..` / `...` — and press `bus.grace`', () => {
    expect(['2', '3'].map(k => [cellFor(k).select, cellFor(k).grace]))
      .toEqual([['grace', 'doubleDot'], ['grace', 'tripleDot']])
    const pressed: string[] = []
    const stop = bus.grace.onPress(k => pressed.push(k))
    for (const k of ['2', '3']) pressKeypadCell(cellFor(k))
    stop()
    expect(pressed).toEqual(['doubleDot', 'tripleDot'])
  })

  it('⭐ its `0` is wired too — the dev toolbar\'s `full bar` — and presses `bus.grace`', () => {
    expect([cellFor('0').select, cellFor('0').grace]).toEqual(['grace', 'barRest'])
    const pressed: string[] = []
    const stop = bus.grace.onPress(k => pressed.push(k))
    pressKeypadCell(cellFor('0'))
    stop()
    expect(pressed).toEqual(['barRest'])
  })

  it('⭐ its `.` is wired too — the dev toolbar\'s `gliss` — and presses `bus.grace`', () => {
    expect([cellFor('.').select, cellFor('.').grace]).toEqual(['grace', 'gliss'])
    const pressed: string[] = []
    const stop = bus.grace.onPress(k => pressed.push(k))
    pressKeypadCell(cellFor('.'))
    stop()
    expect(pressed).toEqual(['gliss'])
  })

  it('⭐ its `Enter` is wired too — the dev toolbar\'s `cue` — and presses `bus.grace`', () => {
    expect([cellFor('Enter').select, cellFor('Enter').grace]).toEqual(['grace', 'cue'])
    const pressed: string[] = []
    const stop = bus.grace.onPress(k => pressed.push(k))
    pressKeypadCell(cellFor('Enter'))
    stop()
    expect(pressed).toEqual(['cue'])
  })

  it('⭐ its six DURATION keys are wired — page one\'s own kind, pressing `bus.duration`', () => {
    const keys = ['7', '8', '9', '4', '5', '6']
    expect(keys.map(k => [cellFor(k).action, cellFor(k).select, cellFor(k).duration])).toEqual([
      ['512th', 'duration', '512'], ['breve', 'duration', 'breve'], ['longa', 'duration', 'longa'],
      ['64th', 'duration', '64'], ['128th', 'duration', '128'], ['256th', 'duration', '256'],
    ])
    const pressed: string[] = []
    const stop = bus.duration.onPress(d => pressed.push(d))
    for (const k of keys) pressKeypadCell(cellFor(k))
    stop()
    expect(pressed).toEqual(['512', 'breve', 'longa', '64', '128', '256'])
  })

  it('⭐ …so EVERY key on the page acts — no `momentary` picture is left', () => {
    expect(page().cells.filter(c => c.select === 'momentary')).toEqual([])
  })

  it('draws Sibelius\'s own keys, each on the numpad key Sibelius puts it on — under OUR names', () => {
    // ⚠️ `bracketed grace` and `gliss` are deliberately NOT Sibelius's "pre-bend note" and "slide":
    // the same two pictures serve a trill's auxiliary note and a plain glissando, and a name taken
    // from the guitar use would have to be renamed the first time the other one arrives.
    const drawn: Array<[string, string]> = [
      ['/', 'appoggiatura'], ['*', 'acciaccatura'], ['-', 'bracketed grace'],
      ['7', '512th'], ['8', 'breve'], ['9', 'longa'],
      ['4', '64th'], ['5', '128th'], ['6', '256th'],
      ['1', 'parenthesised note'], ['2', 'double dot'], ['3', 'triple dot'], ['Enter', 'cue size'],
      ['0', 'bar rest'], ['.', 'gliss'],
    ]
    for (const [key, action] of drawn) expect(cellFor(key).action).toBe(action)
  })

  it('⭐ every STACKED drawing on it is offered to the bake — one left out draws as live text for ever', () => {
    const stacked = page().cells.filter(c => 'bake' in c.icon)
    expect(stacked.length).toBeGreaterThan(0)
    const recipes = Object.values(KEYPAD_BAKE_RECIPES)
    for (const cell of stacked) {
      expect(recipes, `${cell.action} is a stack the bake never sees`)
        .toContainEqual((cell.icon as { bake: unknown }).bake)
    }
  })

  afterEach(() => vi.restoreAllMocks())
})
