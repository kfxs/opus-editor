import { describe, it, expect } from 'vitest'
import { carryMark, markWalkCrosses, type MarkWalkPort } from './markWalk'

/**
 * ⭐⭐ THE INTERPOLATING WALK'S OWN ARITHMETIC — the identity, the crossing, the refusals.
 *
 * Subject: {@link markWalk}. Its two ports are tested against real engines next door
 * (`dynamicWalk.test.ts`, `tempoWalk.test.ts`); what THIS file is for is the claims that belong to
 * the arithmetic and to no mark in particular — so the port here is a FAKE, three numbers and a log.
 * ⭐ That is the point of the extraction: these rules can now be stated once and broken once.
 */

/** A fake mark: stops every `gap` px along a line, an offset, and a memory of what was asked. */
function fakePort(options: {
  gap?: number
  stops?: number
  staffSpacePx?: number | null
  anchorDrawn?: boolean
  refuseReanchor?: boolean
  refuseNudge?: boolean
  /** Give the port a REBASE writer of its own — the crossing's second half, which must not be
   *  refusable. Off by default, as it is for the two marks that predate it. */
  rebasing?: boolean
} = {}) {
  const gap = options.gap ?? 100
  const stops = options.stops ?? 3
  const state = {
    at: 0, offset: 0, crossed: [] as number[],
    nudges: [] as Array<[number, number]>, rebases: [] as number[],
  }
  const port: MarkWalkPort = {
    label: 'Fake',
    nextStop: (direction) => {
      const next = state.at + direction
      return next >= 0 && next < stops ? next : null
    },
    stopX: (stop) => (stop as number) * gap,
    anchorX: () => (options.anchorDrawn === false ? null : state.at * gap),
    staffSpacePx: () => (options.staffSpacePx === undefined ? 10 : options.staffSpacePx),
    offsetX: () => state.offset,
    reanchor: (stop) => {
      if (options.refuseReanchor) return false
      state.at = stop as number
      state.crossed.push(state.at)
      return true
    },
    nudge: (dx, dy) => {
      if (options.refuseNudge) return false
      state.offset += dx
      state.nudges.push([dx, dy])
      return true
    },
    ...(options.rebasing
      ? { rebase: (dx: number) => { state.offset += dx; state.rebases.push(dx); return true } }
      : {}),
  }
  return { port, state }
}

describe('carryMark — the RE-BASE is bookkeeping, not a nudge', () => {
  it('🚨🚨 a port that refuses NUDGES still crosses cleanly through its `rebase`', () => {
    // His report on the hairpin, 2026-08-20: the page limit judged the crossing's second half — a
    // write that does not move the drawn mark at all — against the LAST RENDER, refused it, and the
    // anchor then ran away from the ink one stop per press, to the end of the road.
    const { port, state } = fakePort({ refuseNudge: true, rebasing: true })
    state.offset = 9.5
    carryMark(port, 1)
    expect(state.crossed, 'it crossed ONCE').toEqual([1])
    expect(state.offset, 'and the re-base landed, so the ink is back beside its new anchor')
      .toBeCloseTo(-0.5)
  })

  it('⛔ …and without one it falls back to the nudge — the two older marks are unchanged', () => {
    const { port, state } = fakePort()
    state.offset = 9.5
    carryMark(port, 1)
    expect(state.rebases).toEqual([])
    expect(state.nudges).toEqual([[-10, 0], [1, 0]])
  })
})

describe('carryMark — the identity', () => {
  it('⭐ nudges the ink and leaves the anchor alone until the ink ARRIVES', () => {
    // The gap is 100 px at 10 px per staff-space = 10 spaces, so nine 1-space presses stay ink.
    const { port, state } = fakePort()
    for (let i = 0; i < 9; i++) carryMark(port, 1)
    expect(state.at).toBe(0)
    expect(state.offset).toBeCloseTo(9)
  })

  it('⭐⭐ …and the press that arrives spends its step on the ANCHOR instead — invisibly', () => {
    // `offset += step − gap`: the drawn mark moves by exactly one space on this press too, which is
    // the whole design. ⛔ If this ever returns a non-zero offset the crossing has become a jump.
    const { port, state } = fakePort()
    for (let i = 0; i < 10; i++) carryMark(port, 1)
    expect(state.at).toBe(1)
    expect(state.offset).toBeCloseTo(0)
  })

  it('⭐ ARRIVAL, not midpoint — halfway is still the old anchor', () => {
    const { port, state } = fakePort()
    carryMark(port, 5)
    expect(state.at).toBe(0)
    expect(state.offset).toBeCloseTo(5)
  })

  it('⭐⭐ ONE FRAME may cross SEVERAL stops — a fast drag does not leave the anchor behind', () => {
    const { port, state } = fakePort()
    const move = carryMark(port, 20) // two whole gaps in one go
    expect(move.crossings).toBe(2)
    expect(state.at).toBe(2)
    expect(state.offset).toBeCloseTo(0)
  })

  it('walks backwards on the same terms', () => {
    const { port, state } = fakePort()
    carryMark(port, 20)          // out to stop 2
    state.nudges.length = 0
    for (let i = 0; i < 10; i++) carryMark(port, -1)
    expect(state.at).toBe(1)
    expect(state.offset).toBeCloseTo(0)
  })
})

describe('carryMark — what it refuses', () => {
  it('⛔ never guesses the staff-space size: no scale, no crossing', () => {
    // A small staff beside a normal one makes this a RATIO, so a guessed scale would re-base by the
    // wrong distance — quietly, and only on the staff that guessed.
    const { port, state } = fakePort({ staffSpacePx: null })
    for (let i = 0; i < 30; i++) carryMark(port, 1)
    expect(state.at).toBe(0)
    expect(state.offset).toBeCloseTo(30)
  })

  it('⛔ …nor crosses when the anchor is not drawn — there is nothing to measure from', () => {
    const { port, state } = fakePort({ anchorDrawn: false })
    for (let i = 0; i < 30; i++) carryMark(port, 1)
    expect(state.at).toBe(0)
  })

  it('🚨 refuses a gap whose sign disagrees with the travel — a SYSTEM BREAK', () => {
    // The next stop in TIME sits at the next system's left margin, i.e. far to the LEFT while the
    // travel is rightward. Subtracting two x's from different systems is meaningless.
    const { port, state } = fakePort({ gap: -100 })
    for (let i = 0; i < 30; i++) carryMark(port, 1)
    expect(state.at).toBe(0)
    expect(state.offset).toBeCloseTo(30)
  })

  it('stops at the end of the road, and keeps nudging ink there', () => {
    const { port, state } = fakePort({ stops: 2 })
    for (let i = 0; i < 30; i++) carryMark(port, 1)
    expect(state.at).toBe(1)
    expect(state.offset).toBeCloseTo(20) // 10 spaces to arrive, 20 presses of ink after it
  })

  it('⚠️ a REFUSED re-anchor stops the loop rather than re-basing anyway', () => {
    // The model refuses for its own reasons (a beat another mark holds). Taking the gap out of the
    // offset regardless would move the ink a whole gap for nothing.
    const { port, state } = fakePort({ refuseReanchor: true })
    for (let i = 0; i < 12; i++) carryMark(port, 1)
    expect(state.at).toBe(0)
    expect(state.offset).toBeCloseTo(12)
  })

  it('⚠️ writes nothing for a frame whose delta rounded to zero', () => {
    const { port, state } = fakePort()
    expect(carryMark(port, 0, 0).moved).toBe(false)
    expect(state.nudges).toHaveLength(0)
  })

  it('reports moved=false when the page limit refuses the ink', () => {
    const { port } = fakePort({ refuseNudge: true })
    expect(carryMark(port, 1).moved).toBe(false)
  })

  it('⭐ passes `dy` through untouched — the vertical has nothing to arrive at', () => {
    const { port, state } = fakePort()
    carryMark(port, 1, -3)
    expect(state.nudges).toEqual([[1, -3]])
  })
})

describe('markWalkCrosses — asking without moving', () => {
  it('answers the crossing question and writes nothing', () => {
    const { port, state } = fakePort()
    expect(markWalkCrosses(port, 1)).toBe(false)
    expect(markWalkCrosses(port, 10)).toBe(true)
    expect(state.nudges, 'it only asked').toHaveLength(0)
    expect(state.at).toBe(0)
  })

  it('is false for a zero step, so a caller opens no undo batch for nothing', () => {
    const { port } = fakePort()
    expect(markWalkCrosses(port, 0)).toBe(false)
  })
})
