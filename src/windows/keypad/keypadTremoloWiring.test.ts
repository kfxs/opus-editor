import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { keypadPage } from './keypadLayouts'
import { pressKeypadCell } from './keypadPress'
import { tremoloSelection } from '../../interactions/tremoloSelection'
import { tremoloPairSelection } from '../../interactions/tremoloPairSelection'
import type { TremoloMark } from '../../types/music'

/**
 * The Beams/Tremolos page's tremolo cluster, wired (docs/tremolo-plan.md §9, §10).
 *
 * What is worth pinning is the WIRING, not the drawing: which key carries which mark, that a press
 * reaches the palette's router, and that the pair is a second axis rather than a seventh mark. The
 * lighting rules themselves are `tremoloHighlight` / `tremoloPairHighlight`, tested next door.
 */
describe('the Keypad page-2 tremolo keys', () => {
  const cells = () => keypadPage('beamsTremolos').cells
  const cellFor = (key: string) => cells().find(c => c.key === key)!

  it("sits in Sibelius's own places: 1–5 strokes, 6 Penderecki, Enter the two-note mark", () => {
    const marks: Array<[string, TremoloMark]> = [
      ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 'penderecki'],
    ]
    for (const [key, mark] of marks) {
      const cell = cellFor(key)
      expect(cell.select).toBe('tremolo')
      expect(cell.tremolo).toBe(mark)
    }
    expect(cellFor('Enter').select).toBe('tremoloPair')
  })

  it('⚠️ leaves the beam cluster alone — those keys still choose beaming', () => {
    expect(cellFor('*').select).toBe('beam')
    expect(cellFor('7').select).toBe('beam')
    expect(cellFor('/').select).toBe('subdivide')
    expect(cellFor('-').select).toBe('beamOver')
  })

  it('only the feathered beams are still unwired', () => {
    const unwired = cells().filter(c => c.select === 'momentary')
    expect(unwired.map(c => c.key)).toEqual(['0', '.'])
  })

  describe('a press reaches the palette through the store', () => {
    let pressed: Array<TremoloMark | 'pair'>
    let stops: Array<() => void>

    beforeEach(() => {
      pressed = []
      stops = [
        tremoloSelection.onPress(m => pressed.push(m)),
        tremoloPairSelection.onPress(() => pressed.push('pair')),
      ]
    })
    afterEach(() => stops.forEach(s => s()))

    it('presses the cell\'s own mark — the panel maps nothing', () => {
      pressKeypadCell(cellFor('3'))
      pressKeypadCell(cellFor('6'))
      expect(pressed).toEqual([3, 'penderecki'])
    })

    it('⭐ fires even for the mark already lit — a re-press REMOVES it', () => {
      tremoloSelection.setHighlight(3)
      pressKeypadCell(cellFor('3'))
      // A state mirror would swallow this as "no change"; the press channel must not.
      expect(pressed).toEqual([3])
    })

    it('the pair presses its OWN store — a second axis, not a seventh mark', () => {
      pressKeypadCell(cellFor('Enter'))
      expect(pressed).toEqual(['pair'])
    })
  })
})
