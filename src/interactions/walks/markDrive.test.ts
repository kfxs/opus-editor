import { describe, it, expect } from 'vitest'
import { dragFrame, inkNudge, walkPress, type MarkDriveSpec } from './markDrive'
import type { MarkWalkPort } from './markWalk'
import type { BreakWrapPort } from './markBreakWrap'

/**
 * ⭐⭐ THE DRIVER'S OWN CONTRACT — the COMPOSITION, and nothing about any particular mark.
 *
 * Subject: {@link markDrive}. `markWalk.test.ts` next door owns the arithmetic and the six
 * `*Walk.test.ts` files own their families' ports; what belongs HERE is what the six copies used to
 * each assert for themselves — when a batch is opened, what a blocked press spends itself on, which
 * knob turns which rule off, and what a frame reports in pixels.
 *
 * ⭐ The port and the wrap are FAKES for the same reason `markWalk.test.ts`'s is: these claims can
 * now be stated once, so they can be broken once.
 */

/** A fake mark: stops every `gap` px along a line, an offset, and a memory of what was asked. */
function fakePort(options: {
  gap?: number
  stops?: number
  staffSpacePx?: number | null
  refuseNudge?: boolean
} = {}) {
  const gap = options.gap ?? 100
  const stops = options.stops ?? 3
  const state = {
    at: 0, offset: 0, crossed: [] as number[], nudges: [] as Array<[number, number]>,
  }
  const port: MarkWalkPort = {
    label: 'Fake',
    nextStop: (direction) => {
      const next = state.at + direction
      return next >= 0 && next < stops ? next : null
    },
    stopX: (stop) => (stop as number) * gap,
    anchorX: () => state.at * gap,
    staffSpacePx: () => (options.staffSpacePx === undefined ? 10 : options.staffSpacePx),
    offsetX: () => state.offset,
    reanchor: (stop) => { state.at = stop as number; state.crossed.push(state.at); return true },
    nudge: (dx, dy) => {
      if (options.refuseNudge) return false
      state.offset += dx
      state.nudges.push([dx, dy])
      return true
    },
  }
  return { port, state }
}

/** A batcher that records the descriptions it was opened with. */
function fakeBatches() {
  const opened: string[] = []
  return {
    opened,
    runBatch: (description: string, fn: () => void) => { opened.push(description); fn(); return true },
  }
}

/** Every stop on the mark's own line — the ordinary case, where no wrap arises at all. */
function sameSystemWrap(): BreakWrapPort {
  const ink = { min: 0, max: 1000, key: 1 }
  return { here: () => ink, there: () => ink, address: (stop) => stop }
}

/** The next stop is on the NEXT line, so a press towards the edge has a wrap pending. */
function nextSystemWrap(): BreakWrapPort {
  return {
    here: () => ({ min: 0, max: 1000, key: 1 }),
    there: () => ({ min: 0, max: 1000, key: 9 }),
    address: (stop) => stop,
  }
}

function spec(over: Partial<MarkDriveSpec> & { port: MarkWalkPort }): MarkDriveSpec {
  return { label: 'Move it', runBatch: (_d, fn) => { fn(); return true }, ...over }
}

describe('walkPress — the batch is opened only for what the ink cannot do alone', () => {
  it('⛔ an ordinary nudge opens NO batch: it records its own single undo entry', () => {
    const { port, state } = fakePort()
    const batches = fakeBatches()
    expect(walkPress(spec({ port, runBatch: batches.runBatch }), 0.25)).toBe(true)
    expect(state.offset).toBeCloseTo(0.25)
    expect(batches.opened, 'no snapshot paid for a press that only moved ink').toEqual([])
  })

  it('⭐ a CROSSING press is one batch covering both halves of it', () => {
    const { port, state } = fakePort()
    const batches = fakeBatches()
    state.offset = 9.5 // the stop is 10ss away, so a whole-space press arrives
    expect(walkPress(spec({ port, runBatch: batches.runBatch }), 1)).toBe(true)
    expect(state.crossed, 'the anchor stepped once').toEqual([1])
    expect(batches.opened, 'and an undo takes back the re-anchor and the re-base together')
      .toEqual(['Move it'])
  })

  it('⛔ a zero press is not a press', () => {
    const { port, state } = fakePort()
    expect(walkPress(spec({ port }), 0)).toBe(false)
    expect(state.nudges).toEqual([])
  })
})

describe('walkPress — 🚨🚨 A BLOCKED PRESS STILL CROSSES', () => {
  it('spends itself on the ANCHOR when the page limit refuses the ink, and the ink goes HOME', () => {
    // His report, 2026-08-21: *"i'm not able to walk here"*. The ink is against a wall, so the whole
    // gesture died — where the press should have handed the anchor on instead.
    const { port, state } = fakePort({ refuseNudge: true })
    state.offset = 2
    const batches = fakeBatches()
    expect(walkPress(spec({ port, runBatch: batches.runBatch }), 1)).toBe(true)
    expect(state.crossed, 'the anchor stepped').toEqual([1])
    expect(batches.opened, 'in its own batch').toEqual(['Move it'])
  })

  it('⛔ …unless the family has no anchor to spend it on (`handOverWhenBlocked: false`)', () => {
    // The TRILL: no wrap to fall back onto, and a blocked press there has always done nothing.
    const { port, state } = fakePort({ refuseNudge: true })
    const batches = fakeBatches()
    expect(walkPress(spec({ port, runBatch: batches.runBatch, handOverWhenBlocked: false }), 1))
      .toBe(false)
    expect(state.crossed, 'nothing stepped').toEqual([])
    expect(batches.opened, 'and nothing was batched').toEqual([])
  })
})

describe('walkPress — the knobs a family really disagrees about', () => {
  it('⭐ `inkGuard` refuses the nudge, and the press FALLS THROUGH to the hand-over', () => {
    // The hairpin's arrangement, which is why a refusal is not the end of the press.
    const { port, state } = fakePort()
    expect(walkPress(spec({ port, inkGuard: () => false }), 1)).toBe(true)
    expect(state.nudges, 'the guard stopped the ink').toEqual([])
    expect(state.crossed, 'and the anchor took the press instead').toEqual([1])
  })

  it('⭐ the guard is told the press delta, and whether a wrap is PENDING', () => {
    // ⭐ The distinction is the hairpin's whole excuse: ink being pushed towards the edge it wraps at
    //   is not ink leaving a system it has no way off.
    const onThisLine: Array<[boolean, number]> = []
    const a = fakePort()
    walkPress(spec({
      port: a.port, wrap: sameSystemWrap(),
      inkGuard: (crossing, dx) => { onThisLine.push([crossing, dx]); return true },
    }), 0.25)
    expect(onThisLine, 'the stop is on this line, so nothing is pending').toEqual([[false, 0.25]])

    const overTheBreak: Array<[boolean, number]> = []
    const b = fakePort()
    walkPress(spec({
      port: b.port, wrap: nextSystemWrap(),
      inkGuard: (crossing, dx) => { overTheBreak.push([crossing, dx]); return true },
    }), 0.25)
    expect(overTheBreak, 'the stop is a line away, and the guard is told so').toEqual([[true, 0.25]])
  })

  it('⭐ `maxCrossings: 1` walks an ink far ahead of its note back a NOTE AT A TIME', () => {
    // His report on the trill, 2026-08-20: *"the re-anchor is completely broken"* — an unbounded
    // loop hopped every stop between the ink and its anchor on a single keystroke, invisibly.
    const { port, state } = fakePort({ stops: 8 })
    state.offset = 59
    walkPress(spec({ port, maxCrossings: 1 }), 0.25)
    expect(state.crossed, 'ONE stop, however far ahead the ink was').toEqual([1])
  })

  it('…and a point mark, which has no ink running ahead of an anchor, keeps the loop', () => {
    const { port, state } = fakePort({ stops: 8 })
    state.offset = 59
    walkPress(spec({ port }), 0.25)
    expect(state.crossed.length, 'the dynamic and the tempo mark cross as far as the ink reaches')
      .toBeGreaterThan(1)
  })

  it('⛔ a family with NO wrap never asks one: the press is the walk and nothing else', () => {
    const { port, state } = fakePort()
    state.offset = 9.5
    expect(walkPress(spec({ port }), 1)).toBe(true)
    expect(state.crossed).toEqual([1])
  })
})

describe('dragFrame — what one frame reports, in the pixels the caller measures in', () => {
  it('⛔ declines — null, not a frame — when the mark is not drawn', () => {
    const { port } = fakePort({ staffSpacePx: null })
    expect(dragFrame({ port, latch: false }, 0, 40)).toBeNull()
  })

  it('⛔ a frame with no travel in either axis reaches the model and writes nothing', () => {
    const { port, state } = fakePort()
    expect(dragFrame({ port, latch: true }, 0, 0, 0))
      .toEqual({ moved: false, wrapped: false, crossings: 0, latched: false, droppedPx: 0, gapAheadPx: 0 })
    expect(state.nudges).toEqual([])
  })

  it('⭐ pixels in, staff-spaces to the model, pixels back out', () => {
    const { port, state } = fakePort()
    const frame = dragFrame({ port, latch: false }, 0, 40, 20)
    expect(state.nudges, '10px to the staff-space').toEqual([[4, 2]])
    expect(frame?.moved).toBe(true)
  })

  it('🚨 a LATCHED frame reports what it dropped, and the gap AHEAD to repay it over', () => {
    // Baudisch's complaint about snap-and-go: unrepaid, the ink falls behind the hand a little at
    // every stop and never catches up.
    const { port, state } = fakePort()
    state.offset = -1
    const frame = dragFrame({ port, latch: true }, 0, 40)
    expect(frame?.latched).toBe(true)
    expect(frame?.droppedPx, '3ss of the 4 asked for were spent, 3 dropped').toBeCloseTo(30)
    expect(frame?.gapAheadPx, 'and the next stop is a whole gap away').toBeCloseTo(100)
  })

  it('⭐⭐ `vertical` is where SCREEN becomes the model\'s own axis, and nowhere else', () => {
    // The bracket's and the tempo mark's `y` is OUTWARD from the staff; the wedge's is screen-down.
    const { port, state } = fakePort()
    dragFrame({ port, latch: false, vertical: (px, space) => -px / space }, 0, 0, 20)
    expect(state.nudges).toEqual([[0, -2]])
  })

  it('⭐ `note` rides along on the frame\'s one log line without changing what it does', () => {
    const { port } = fakePort()
    let asked = 0
    dragFrame({ port, latch: false, note: () => { asked++; return 'x' } }, 0, 40)
    // ⚠️ Behind the debug flag, which is off here — the point is that a measured note costs nothing
    //   on a frame nobody is watching (docs/logging.md).
    expect(asked).toBe(0)
  })
})

describe('inkNudge — the ordinary press, for the one caller that wants it without the walk', () => {
  it('writes the ink and says whether the model took it', () => {
    const { port, state } = fakePort()
    expect(inkNudge(port, 0.25)).toBe(true)
    expect(state.nudges).toEqual([[0.25, 0]])
  })

  it('⛔ a refused nudge is the PAGE LIMIT speaking, and it says so', () => {
    const { port } = fakePort({ refuseNudge: true })
    expect(inkNudge(port, 0.25)).toBe(false)
  })
})
