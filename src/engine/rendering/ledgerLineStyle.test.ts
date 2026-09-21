// @vitest-environment jsdom
/**
 * Ledger lines are inked like the rest of the page.
 *
 * VexFlow's default is `{ strokeStyle: '#444', lineWidth: 2 }` — grey, and twice the weight of a
 * staff line. Both are visible at high zoom and neither matches engraving practice: a ledger line is
 * part of the staff, so it is black, and it is *slightly* heavier than a staff line.
 *
 * ⭐⭐ **How much heavier is the FONT's ratio, and this asserts it as a ratio** (F3,
 * docs/plans/font-metrics-plan.md): Bravura's `legerLineThickness / staffLineThickness`, 0.16 / 0.13, put
 * against the staff line VexFlow actually draws (1 px, the SVG context's default stroke-width).
 * ⛔ NOT the font's 0.16 spaces as an absolute — that is 1.6 px here, which would be too heavy beside
 * a 1 px staff line. Absolute weights from a font only agree while everything on the page comes from
 * that font, and VexFlow's staff lines do not.
 *
 * Pinned because it is a DECISION, not a default: nothing else would notice VexFlow changing its own
 * default underneath us, and nothing else would notice a new stave site forgetting the override.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { engravingDefault } from '@/engine/fonts/fontMetrics'
import { staveLineWidthPx } from '@/engine/engrave/staff/staffLines'

/** What the font says a ledger is worth in staff lines — the whole of the decision under test. */
const LEDGER_TO_STAFF_LINE =
  engravingDefault('legerLineThickness') / engravingDefault('staffLineThickness')

/**
 * ⭐ …applied to the staff line WE draw, which since 2026-09-01 is Gould's measured **0.11 sp** and
 * ⛔ no longer 1 px (`docs/research/staff-line-research.md` §8 A). Written as the product rather than a baked
 * number so the ledger keeps FOLLOWING the staff line, which is the entire point of a ratio.
 */
const LEDGER_WIDTH_PX = staveLineWidthPx() * LEDGER_TO_STAFF_LINE

let container: HTMLElement
let engine: MusicEngine

/** Every ledger line VexFlow drew — the stroked paths inside a stavenote group. */
function ledgerLines(): SVGElement[] {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no <svg> rendered')
  return [...svg.querySelectorAll('g.stavenote path')]
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
      const drawn = Number(line.getAttribute('stroke-width'))
      expect(drawn).toBeCloseTo(LEDGER_WIDTH_PX, 6)
      // …and the two things that ratio is claiming, said plainly: heavier than a staff line, and
      // nothing like VexFlow's double.
      expect(drawn, 'heavier than a staff line').toBeGreaterThan(staveLineWidthPx())
      expect(drawn, 'and not VexFlow\'s double').toBeLessThan(2 * staveLineWidthPx())
    }
  })

  it('applies above and below the staff alike', () => {
    addNote('A', 3, 'w', 1)
    addNote('C', 6, 'q', 2)
    engine.renderScore()

    const widths = new Set(ledgerLines().map(l => Number(l.getAttribute('stroke-width'))))
    expect(widths.size, 'one weight, wherever the ledger is').toBe(1)
    expect([...widths][0]).toBeCloseTo(LEDGER_WIDTH_PX, 6)
  })
})
