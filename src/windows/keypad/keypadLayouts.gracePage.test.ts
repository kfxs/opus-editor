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
 * other twelve are still `momentary`, carry no model value, and do nothing. A key wired by accident fails
 * the test that lists the three.
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

  it('⛔ …and the other twelve are still a PICTURE: `momentary`, no model value', () => {
    const own = page().cells.filter(c => c.key !== 'NumLock' && c.key !== '+' && c.select !== 'grace')
    expect(own).toHaveLength(12)
    for (const cell of own) {
      expect(cell.select, `${cell.action} (key ${cell.key})`).toBe('momentary')
      expect(cell.duration ?? cell.accidental ?? cell.articulation ?? cell.beam ?? cell.tremolo ?? cell.fan ?? cell.grace).toBeUndefined()
    }
  })

  it('⛔ …so pressing one writes to NO seam — it only logs', () => {
    const press = vi.spyOn(bus.duration, 'press')
    const accidental = vi.spyOn(bus.accidental, 'press')
    const dot = vi.spyOn(bus.dot, 'press')
    const rest = vi.spyOn(bus.rest, 'press')
    const grace = vi.spyOn(bus.grace, 'press')
    for (const cell of page().cells.filter(c => c.select === 'momentary')) pressKeypadCell(cell)
    expect(press).not.toHaveBeenCalled()
    expect(accidental).not.toHaveBeenCalled()
    expect(dot).not.toHaveBeenCalled()
    expect(rest).not.toHaveBeenCalled()
    expect(grace).not.toHaveBeenCalled()
  })

  it('draws Sibelius\'s own keys, each on the numpad key Sibelius puts it on — under OUR names', () => {
    // ⚠️ `bracketed grace` and `gliss` are deliberately NOT Sibelius's "pre-bend note" and "slide":
    // the same two pictures serve a trill's auxiliary note and a plain glissando, and a name taken
    // from the guitar use would have to be renamed the first time the other one arrives.
    const drawn: Array<[string, string]> = [
      ['/', 'appoggiatura'], ['*', 'acciaccatura'], ['-', 'bracketed grace'],
      ['7', '512th'], ['8', 'breve'], ['9', 'longa'],
      ['4', '64th'], ['5', '128th'], ['6', '256th'],
      ['1', 'round bracket'], ['2', 'double dot'], ['3', 'triple dot'], ['Enter', 'cue size'],
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
