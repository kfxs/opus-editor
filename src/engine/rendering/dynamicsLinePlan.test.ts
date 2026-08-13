import { describe, it, expect } from 'vitest'
import type { Dynamic, Hairpin, Measure, Score } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'
import { plainColumn, type Column } from '@/engine/layout/spacing'
import type { InkBox } from '@/engine/layout/kerning'
import { bandOver, type OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import { planDynamicsLines, type DynamicsPlanPlacement } from './dynamicsLinePlan'
import { MARK_INK } from './dynamicsLinePass'

/**
 * THE DYNAMICS PLAN'S LADDER CLAIM — what the family tells the families placed OUTSIDE it
 * (docs/ottava-plan.md P0a).
 *
 * ⚠️ The baselines themselves are `layout/dynamicsLine.test.ts`'s and `layout/dynamicsChain.test.ts`'s;
 * what is checked here is that a claim is filed for every mark, on the right `(line, staff, side)`,
 * over the right beats, and from the **levelled** baseline rather than the per-mark one.
 */

const noteBox = (top: number, bottom: number, staff?: string): InkBox =>
  ({ left: 0, right: 1.13, top, bottom, kind: 'note', staff, size: 1 })

const columnsWith = (...ink: InkBox[]): Column[] => [{ ...plainColumn(frac(0, 1), frac(4, 1)), ink }]

const bar = (number: number, over: Partial<Measure> = {}): Measure =>
  ({
    id: `m${number}`, number, slots: [],
    timeSignature: { numerator: 4, denominator: 4 }, tuplets: [],
    ...over,
  } as unknown as Measure)

const placementFor = (view: Measure, over: Partial<DynamicsPlanPlacement> = {}): DynamicsPlanPlacement => ({
  view,
  measureNumber: view.number,
  staffIndex: 0,
  line: 0,
  system: { columns: columnsWith(noteBox(0, 4)) },
  ...over,
})

function planWith(placements: DynamicsPlanPlacement[], staffIds: (string | undefined)[] = [undefined]) {
  const bars = new Map<number, Measure>()
  for (const p of placements) if (!bars.has(p.measureNumber)) bars.set(p.measureNumber, p.view)
  const score = { measures: [...bars.values()] } as unknown as Score
  const occupied: OccupiedSpan[] = []
  const plan = planDynamicsLines(score, placements, staffIds, MARK_INK, occupied)
  return { plan, occupied }
}

const dyn = (id: string, over: Partial<Dynamic> = {}): Dynamic =>
  ({ id, beat: frac(0, 1), text: 'p', ...over } as Dynamic)

const wedge = (id: string, over: Partial<Hairpin> = {}): Hairpin =>
  ({ id, type: 'cresc', beat: frac(0, 1), length: frac(4, 1), ...over } as Hairpin)

describe('planDynamicsLines — the occupied-band sink', () => {
  it('is OPTIONAL: omitting it leaves the plan identical', () => {
    const placements = [placementFor(bar(1, { dynamics: [dyn('a')] }))]
    const { plan, occupied } = planWith(placements)
    const bars = new Map([[1, placements[0].view]])
    const score = { measures: [...bars.values()] } as unknown as Score
    expect(planDynamicsLines(score, placements, [undefined], MARK_INK)).toEqual(plan)
    expect(occupied).toHaveLength(1)
  })

  it('files ONE claim per mark, on the mark’s own side', () => {
    const { occupied } = planWith([
      placementFor(bar(1, { dynamics: [dyn('a'), dyn('b', { placement: 'above' })] })),
    ])
    expect(occupied).toHaveLength(2)
    expect(occupied.map(o => o.side).sort()).toEqual(['above', 'below'])
  })

  it('⭐ a LETTER claims a point — its own beat, not its bar', () => {
    const { occupied } = planWith([
      placementFor(bar(1, { dynamics: [dyn('a', { beat: frac(2, 1) })] })),
    ])
    expect(occupied[0].from).toEqual(occupied[0].to)
    expect(occupied[0].from).toEqual(frac(2, 1))
  })

  it('⭐ a WEDGE claims its span, on the ABSOLUTE axis across a barline', () => {
    const { occupied } = planWith([
      placementFor(bar(1, { hairpins: [wedge('h', { beat: frac(2, 1), length: frac(4, 1) })] })),
      placementFor(bar(2)),
    ])
    const claim = occupied.find(o => o.from.num === 2)
    expect(claim).toBeDefined()
    // bar 1 starts at 0, so beat 2 of bar 1 is absolute 2; four beats later is absolute 6 — beat 2
    // of bar 2. The claim must be on the shared axis, or nothing can compare it with a trill's.
    expect(claim!.to).toEqual(frac(6, 1))
  })

  it('⭐⭐ claims the LEVELLED baseline, not the mark’s OWN', () => {
    // The letter stands over SHALLOW ink in bar 1, so its own answer is the family's floor. The
    // wedge it touches runs on into bar 2's DEEP dip, so the chain drags them both down to the
    // wedge's row. Written before `levelDynamicsChains`, the letter would claim the floor — and an
    // outer family would clear a `p` that is nowhere near there.
    const shallow = placementFor(bar(1, {
      dynamics: [dyn('a', { beat: frac(0, 1) })],
      hairpins: [wedge('h', { beat: frac(0, 1), length: frac(8, 1) })],
    }))
    const deep = placementFor(bar(2), { system: { columns: columnsWith(noteBox(0, 12)) } })

    const { plan, occupied } = planWith([shallow, deep])
    const letter = plan.get('a')!
    const wedgeLine = plan.get('h@0')!

    // The premise of the test: the chain really did move the letter off its own answer.
    expect(letter).toBeGreaterThan(2.1 + MARK_INK.above)
    expect(letter).toBeCloseTo(wedgeLine, 6)

    const claim = occupied.find(o => o.from.num === 0 && o.to.num === 0)!
    expect(claim.band.top).toBeCloseTo(letter - MARK_INK.above, 6)
    expect(claim.band.bottom).toBeCloseTo(letter + MARK_INK.below, 6)
  })

  it('carries the SYSTEM and the STAFF, so a later family cannot read the wrong one', () => {
    const { occupied } = planWith(
      [placementFor(bar(1, { dynamics: [dyn('a')] }), { line: 2, staffIndex: 1 })],
      ['sA', 'sB'],
    )
    expect(occupied[0].line).toBe(2)
    expect(occupied[0].staffId).toBe('sB')
  })

  it('⭐ and the claim is READABLE by `bandOver` — the two halves agree', () => {
    const { plan, occupied } = planWith([
      placementFor(bar(1, { dynamics: [dyn('a', { beat: frac(1, 1) })] })),
    ])
    const found = bandOver(occupied, 0, undefined, 'below', frac(0, 1), frac(4, 1), undefined)
    expect(found).not.toBeNull()
    expect(found!.top).toBeCloseTo(plan.get('a')! - MARK_INK.above, 6)
  })

  it('files nothing at all for a score with no dynamics', () => {
    const { occupied } = planWith([placementFor(bar(1))])
    expect(occupied).toEqual([])
  })
})
