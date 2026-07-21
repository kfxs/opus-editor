// @vitest-environment jsdom
/**
 * Ledger lines are inked like the rest of the page.
 *
 * VexFlow's default is `{ strokeStyle: '#444', lineWidth: 2 }` — grey, and twice the weight of a
 * staff line. Both are visible at high zoom and neither matches engraving practice: a ledger line is
 * part of the staff, so it is black, and it is *slightly* heavier than a staff line — Bravura's
 * SMuFL `engravingDefaults` give staffLineThickness 0.13 vs legerLineThickness 0.16 (~1.23×), which
 * is where 1.25 against the staff's 1 comes from.
 *
 * Pinned because it is a DECISION, not a default: nothing else would notice VexFlow changing its own
 * default underneath us, and nothing else would notice a new stave site forgetting the override.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'

let container: HTMLElement
let engine: MusicEngine

/** Every ledger line VexFlow drew — the stroked paths inside a stavenote group. */
function ledgerLines(): SVGElement[] {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no <svg> rendered')
  return [...svg.querySelectorAll('g.vf-stavenote path')]
    .filter(p => p.getAttribute('stroke') !== null && p.getAttribute('stroke') !== 'none') as SVGElement[]
}

function addNote(step: string, octave: number, duration: string, measure: number): void {
  engine.addNoteAtBeat({
    step, octave, duration, measure, beat: { num: 0, den: 1 },
  } as unknown as Parameters<MusicEngine['addNoteAtBeat']>[0])
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  engine = new MusicEngine({ container, width: 1000, height: 500 })
})

describe('ledger line ink', () => {
  it('draws them black, not VexFlow grey', () => {
    addNote('A', 3, 'w', 1) // below the staff in treble → ledger lines, and no stem to confuse it
    engine.renderScore()

    const lines = ledgerLines()
    expect(lines.length, 'expected ledger lines below the staff').toBeGreaterThan(0)
    for (const line of lines) {
      expect(line.getAttribute('stroke')).toBe('#000000')
      expect(line.getAttribute('stroke')).not.toBe('#444')
    }
  })

  it('draws them at Bravura\'s ratio to a staff line, not double', () => {
    addNote('C', 6, 'q', 1) // above the staff
    engine.renderScore()

    const lines = ledgerLines()
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(Number(line.getAttribute('stroke-width'))).toBe(1.25)
    }
  })

  it('applies above and below the staff alike', () => {
    addNote('A', 3, 'w', 1)
    addNote('C', 6, 'q', 2)
    engine.renderScore()

    const widths = new Set(ledgerLines().map(l => l.getAttribute('stroke-width')))
    expect(widths).toEqual(new Set(['1.25']))
  })
})
