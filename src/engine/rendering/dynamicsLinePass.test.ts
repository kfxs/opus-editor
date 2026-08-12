// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type { Stave } from 'vexflow'
import type { Dynamic, Measure } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'
import { plainColumn, type Column } from '@/engine/layout/spacing'
import type { InkBox } from '@/engine/layout/kerning'
import type { RenderPass } from './RenderPass'
import { placeDynamicsOnLine, type DynamicsLinePlacement } from './dynamicsLinePass'

/**
 * THE DYNAMICS LINE PASS — the routing, not the geometry
 * (docs/dynamics-line-and-hairpins-plan.md P1).
 *
 * ⚠️ **Every number here is one the test HANDED IN**: the stave's line positions and each mark's
 * drawn baseline are fixtures, so what is checked is which line a mark is filed under and what the
 * pass does with it — never how big a glyph is or where ink landed. Those measure 0×0 in jsdom, and
 * they are `e2e/dynamicsLine.e2e.ts`'s. The line's own arithmetic is
 * `engine/layout/dynamicsLine.test.ts`'s.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A mark as the renderer leaves it: a `<g>` holding a `<text>` at the baseline VexFlow drew it on. */
function drawnMark(baselineY: number): { group: SVGGraphicsElement; y: () => number } {
  const group = document.createElementNS(SVG_NS, 'g') as SVGGraphicsElement
  const text = document.createElementNS(SVG_NS, 'text')
  text.setAttribute('y', String(baselineY))
  group.appendChild(text)
  // Where the mark ends up: its drawn baseline plus whatever the pass translated it by.
  const y = () => {
    const move = /translate\([^,]+,\s*(-?[\d.]+)\)/.exec(group.getAttribute('transform') ?? '')
    return baselineY + (move ? Number(move[1]) : 0)
  }
  return { group, y }
}

/** A stave whose top line is at `top`, one staff space = 10px — the same shape the real one answers. */
const staveAt = (top: number): Stave => ({
  getYForLine: (line: number) => top + line * 10,
  getSpacingBetweenLines: () => 10,
} as unknown as Stave)

const noteBox = (top: number, bottom: number, staff?: string): InkBox =>
  ({ left: 0, right: 1.13, top, bottom, kind: 'note', staff, size: 1 })

const columnsWith = (...ink: InkBox[]): Column[] => [{ ...plainColumn(frac(0, 1), frac(4, 1)), ink }]

const dynamicAt = (id: string, placement?: Dynamic['placement']): Dynamic =>
  ({ id, beat: frac(0, 1), text: 'p', ...(placement ? { placement } : {}) })

function passWith(marks: Map<string, SVGGraphicsElement>, suppressedDynamicId?: string): RenderPass {
  return {
    suppressedDynamicId,
    dynamicObjectMap: new Map([...marks].map(([id, el]) => [id, { getSVGElement: () => el }])),
    elementRegistry: { withScale: (_k: number, fn: () => void) => fn(), shiftById: vi.fn() },
  } as unknown as RenderPass
}

const measureWith = (dynamics: Dynamic[]): Measure =>
  ({ id: 'm', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], dynamics } as unknown as Measure)

describe('placeDynamicsOnLine', () => {
  it('⭐⭐ two marks drawn at DIFFERENT heights end on one baseline', () => {
    // The feature in one assertion: VexFlow hangs each mark off its own note, so the two arrive
    // 30px apart; both must leave on the system's line.
    const high = drawnMark(150)
    const low = drawnMark(180)
    const pass = passWith(new Map([['a', high.group], ['b', low.group]]))
    const placement: DynamicsLinePlacement = {
      view: measureWith([dynamicAt('a'), dynamicAt('b')]),
      line: 0,
      staffIndex: 0,
      system: { columns: columnsWith(noteBox(2, 3.2)) },
      stave: staveAt(100),
      scale: 1,
    }

    placeDynamicsOnLine(pass, [placement], [undefined])

    expect(high.y()).toBe(low.y())
    // Below the staff — the bottom line is at 140 here.
    expect(high.y()).toBeGreaterThan(140)
  })

  it('⭐⭐ a low note in ANOTHER bar leaves the mark alone — the deviation is LOCAL', () => {
    const alone = drawnMark(150)
    const withNeighbour = drawnMark(150)
    const bar = (view: Measure, ink: InkBox[]): DynamicsLinePlacement => ({
      view, line: 0, staffIndex: 0, system: { columns: columnsWith(...ink) }, stave: staveAt(100), scale: 1,
    })

    placeDynamicsOnLine(
      passWith(new Map([['a', alone.group]])),
      [bar(measureWith([dynamicAt('a')]), [noteBox(2, 3.2)])],
      [undefined],
    )
    placeDynamicsOnLine(
      passWith(new Map([['a', withNeighbour.group]])),
      [
        bar(measureWith([dynamicAt('a')]), [noteBox(2, 3.2)]),
        bar(measureWith([]), [noteBox(8, 9.2)]), // bar 2 dives below the staff; it holds no mark
      ],
      [undefined],
    )

    expect(withNeighbour.y()).toBe(alone.y())
  })

  it('…but ink at the mark\'s OWN beat does move it, and only it', () => {
    const overNormal = drawnMark(150)
    const overDip = drawnMark(150)
    const pass = passWith(new Map([['a', overNormal.group], ['b', overDip.group]]))
    // Two columns in one bar: beat 0 ordinary, beat 2 three ledger lines down. A mark on each.
    const columns: Column[] = [
      { ...plainColumn(frac(0, 1), frac(2, 1)), ink: [noteBox(2, 3.2)] },
      { ...plainColumn(frac(2, 1), frac(2, 1)), ink: [noteBox(8, 9.2)] },
    ]

    placeDynamicsOnLine(pass, [{
      view: measureWith([dynamicAt('a'), { ...dynamicAt('b'), beat: frac(2, 1) }]),
      line: 0, staffIndex: 0, system: { columns }, stave: staveAt(100), scale: 1,
    }], [undefined])

    expect(overDip.y()).toBeGreaterThan(overNormal.y())
  })

  it('each SYSTEM gets its own line — a low note on line 2 leaves line 1 alone', () => {
    const first = drawnMark(150)
    const second = drawnMark(350)
    const pass = passWith(new Map([['a', first.group], ['b', second.group]]))

    placeDynamicsOnLine(pass, [
      { view: measureWith([dynamicAt('a')]), line: 0, staffIndex: 0, system: { columns: columnsWith(noteBox(2, 3.2)) }, stave: staveAt(100), scale: 1 },
      { view: measureWith([dynamicAt('b')]), line: 1, staffIndex: 0, system: { columns: columnsWith(noteBox(8, 9.2)) }, stave: staveAt(300), scale: 1 },
    ], [undefined])

    // Relative to each system's own top line, the second sits lower — it is clearing more ink.
    expect(second.y() - 300).toBeGreaterThan(first.y() - 100)
  })

  it('a mark being EDITED is left where the overlay put it', () => {
    const edited = drawnMark(150)
    const pass = passWith(new Map([['a', edited.group]]), 'a')

    placeDynamicsOnLine(pass, [{
      view: measureWith([dynamicAt('a')]),
      line: 0, staffIndex: 0, system: { columns: columnsWith(noteBox(2, 3.2)) }, stave: staveAt(100), scale: 1,
    }], [undefined])

    expect(edited.group.getAttribute('transform')).toBeNull()
  })

  it('an ABOVE mark goes above the staff, from the same call', () => {
    const above = drawnMark(150)
    const below = drawnMark(150)
    const pass = passWith(new Map([['a', above.group], ['b', below.group]]))

    placeDynamicsOnLine(pass, [{
      view: measureWith([dynamicAt('a', 'above'), dynamicAt('b')]),
      line: 0, staffIndex: 0, system: { columns: columnsWith(noteBox(2, 3.2)) }, stave: staveAt(100), scale: 1,
    }], [undefined])

    expect(above.y()).toBeLessThan(100) // over the top line
    expect(below.y()).toBeGreaterThan(140) // under the bottom one
  })

  it('⚠️ the per-staff lane decides: the LOWER staff\'s ink does not move the upper staff\'s line', () => {
    const upperMark = drawnMark(150)
    const lowerMark = drawnMark(350)
    const pass = passWith(new Map([['a', upperMark.group], ['b', lowerMark.group]]))
    // The columns are the measure's MERGED ones — both staves' ink in one list, which is why each
    // box carries the staff it was measured on. The upper staff's carry none (the absent-id
    // convention), the lower staff's carry its id.
    const columns = columnsWith(noteBox(2, 3.2), noteBox(8, 9.2, 'lower'))

    placeDynamicsOnLine(pass, [
      { view: measureWith([dynamicAt('a')]), line: 0, staffIndex: 0, system: { columns }, stave: staveAt(100), scale: 1 },
      { view: measureWith([dynamicAt('b')]), line: 0, staffIndex: 1, system: { columns }, stave: staveAt(300), scale: 1 },
    ], ['upper', 'lower'])

    expect(lowerMark.y() - 300).toBeGreaterThan(upperMark.y() - 100)
  })
})
