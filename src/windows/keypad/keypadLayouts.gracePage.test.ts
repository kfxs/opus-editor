import { describe, it, expect, vi, afterEach } from 'vitest'
import { KEYS, keypadPage, nextKeypadPageId, KEYPAD_BAKE_RECIPES } from './keypadLayouts'
import { pressKeypadCell } from './keypadPress'
import { bus } from '@/bus'

/**
 * The GRACE page — Sibelius 6's second Keypad layout, as a picture
 * (`docs/research/sibelius-keypad.md` says what each key means over there).
 *
 * ⛔ What is worth pinning here is that it is a PICTURE and nothing else: the page is drawn and
 * NOTHING is wired, so every one of its own keys must be `momentary`, carry no model value, and do
 * nothing when pressed. The day a key is wired, the test that fails is the one that says "nothing on
 * this page acts" — which is the point: the wiring should arrive as a decision, not by accident.
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

  it('⛔ is a PICTURE: every key of its own is `momentary` and carries no model value', () => {
    const own = page().cells.filter(c => c.key !== 'NumLock' && c.key !== '+')
    expect(own).toHaveLength(15)
    for (const cell of own) {
      expect(cell.select, `${cell.action} (key ${cell.key})`).toBe('momentary')
      expect(cell.duration ?? cell.accidental ?? cell.articulation ?? cell.beam ?? cell.tremolo ?? cell.fan).toBeUndefined()
    }
  })

  it('⛔ …so pressing one writes to NO seam — it only logs', () => {
    const press = vi.spyOn(bus.duration, 'press')
    const accidental = vi.spyOn(bus.accidental, 'press')
    const dot = vi.spyOn(bus.dot, 'press')
    const rest = vi.spyOn(bus.rest, 'press')
    for (const cell of page().cells.filter(c => c.select === 'momentary')) pressKeypadCell(cell)
    expect(press).not.toHaveBeenCalled()
    expect(accidental).not.toHaveBeenCalled()
    expect(dot).not.toHaveBeenCalled()
    expect(rest).not.toHaveBeenCalled()
  })

  it('draws Sibelius\'s own keys, each on the numpad key Sibelius puts it on — under OUR names', () => {
    // ⚠️ `bracketed grace` and `gliss` are deliberately NOT Sibelius's "pre-bend note" and "slide":
    // the same two pictures serve a trill's auxiliary note and a plain glissando, and a name taken
    // from the guitar use would have to be renamed the first time the other one arrives.
    const drawn: Array<[string, string]> = [
      ['/', 'grace note'], ['*', 'acciaccatura'], ['-', 'bracketed grace'],
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
