/**
 * TEMPORARY — the P0 measurement instrument (docs/render-performance-plan.md §8).
 * Delete when P0 closes; nothing may depend on it.
 *
 * Answers the two questions that need a *real browser* and a *real editing session*:
 *
 *  1. **The layout:draw split.** jsdom's DOM is far slower than Chrome's, so the findings
 *     doc's draw column is pessimistic. Here we time `calculateMeasureWidths` against the
 *     rest of the render, in Chrome, on a real score.
 *  2. **The render census.** What actually triggers a render in a normal editing session,
 *     bucketed by *cause* — because §8 predicts most renders are not edits, and if hover +
 *     selection dominate then P3/P4 jump the queue.
 *
 * Disabled (and near-free) unless `enable()` is called. Dev builds install it on
 * `window.__census`; see `dump()` for the usage banner.
 */
import { ScoreModel } from '@/engine/models/ScoreModel'
import type { RenderLayoutPart, RenderProbe } from '@/engine/RenderProbe'
import type { PitchStep } from '@/types/music'

interface Bucket {
  /** How many renders this cause fired. */
  n: number
  /** Sum of full-render wall time (ms). */
  total: number
  /** Sum of the `calculateMeasureWidths` term (ms) — 0 when the layout was frozen/reused. */
  layout: number
  /** Worst single render (ms). */
  max: number
  /** Measure-staves actually re-engraved (P5.4). */
  redrawn: number
  /** Measure-staves the render was responsible for. `redrawn/of` is the incremental-redraw hit
   *  rate — the single number that says whether P5 is working. */
  of: number
}

const now = () => performance.now()

/** `implements` on purpose: the engine calls this through {@link RenderProbe}, so a signature that
 *  drifts from the seam must fail to BUILD rather than quietly stop being installable. */
class RenderCensus implements RenderProbe {
  private on = false
  private buckets = new Map<string, Bucket>()
  private cause = '?'
  private t0 = 0
  private tLayoutStart = 0
  private layoutMs = 0
  private redrawn = 0
  private of = 0

  enable(): void {
    this.on = true
    this.reset()
    console.log('[census] recording. Play with the editor, then call __census.dump()')
  }

  disable(): void {
    this.on = false
  }

  reset(): void {
    this.buckets.clear()
    // 🚨🚨 **`sub` MUST be cleared here, and was not until 2026-08-22.** `enable()` calls `reset()`,
    // so a second `enable()` in one page life started the per-cause table from zero while the part
    // breakdown kept accumulating — including every render between the first `dump()` and the second
    // `enable()`, which nothing was counting. The dump then divided a cumulative numerator by a
    // fresh denominator and printed **`columns … 259%`**. ⚠️ A part is only comparable to a total it
    // was measured over; two accumulators with different lifetimes are not one measurement.
    this.sub = { ...ZERO_PARTS }
  }

  /**
   * Tag the render about to happen. RenderController names the ones it knows
   * ('preview', 'clef-ghost', …); a plain `renderScore()` passes `undefined` and we
   * recover the call site from the stack instead — which is the census we actually want,
   * since "an edit" and "a selection" both arrive through the same method.
   */
  setCause(cause?: string): void {
    if (!this.on) return
    this.cause = cause ?? callerFrame()
  }

  /** Called at the top of VexFlowRenderer.renderScore. */
  beginRender(): void {
    if (!this.on) return
    this.layoutMs = 0
    this.redrawn = 0
    this.of = 0
    this.t0 = now()
  }

  /**
   * How many (measure, staff) groups this render actually re-engraved, out of how many it was
   * responsible for (P5.4).
   *
   * This is the number that says whether P5 works. A slur drag should report **0 of N** — the score
   * did not change, so not one bar should be re-engraved to move a Bézier control point. An ordinary
   * note edit in wrapped view should report roughly *one system's worth*, not the whole score.
   */
  measuresRedrawn(redrawn: number, of: number): void {
    if (!this.on) return
    this.redrawn = redrawn
    this.of = of
  }

  beginLayout(): void {
    if (!this.on) return
    this.tLayoutStart = now()
  }

  endLayout(): void {
    if (!this.on) return
    this.layoutMs = now() - this.tLayoutStart
  }

  /**
   * **TEMPORARY.** The named per-render walks, each timed at its own call site. §9 rests on an
   * assumption nobody had checked — that the cost is the *fingerprint walk* — and these are what
   * answer it.
   *
   *  - `laneView` — `staffMeasureView` rebuilding one `Measure` object per (measure, staff), every
   *    render. Copy-on-write fixes it (the lane can be cached on the measure's identity).
   *    **Inside** the layout bracket.
   *  - `columns` — the width rule: `measureColumns` plus the natural/minimum sums, on lanes whose
   *    width is genuinely unknown. Copy-on-write **does not help here at all**. **Inside** the
   *    bracket. ⛔ Called `format` until 2026-08-22, after the VexFlow `Formatter` it used to time —
   *    which left this path long before the name did.
   *  - `fingerprint` — `laneFingerprint`, the `JSON.stringify` of a lane, which a `WeakMap` on the
   *    measure object would delete outright. **OUTSIDE** the bracket: its only live caller is
   *    `measureShapeKey`, which runs after `endLayout()`.
   *
   * ⚠️ **So these do NOT sum to the layout term, and must never be reported as shares of it.** They
   * are shares of the WHOLE RENDER. See {@link reset} for what the other arithmetic cost us.
   *
   * ⭐⭐ **The seven RESIDUAL parts** (`tier1` … `hint`) carve up what the census could previously only
   * call "draw" — on frames reporting **0% redrawn**, where nothing was drawn at all. They are
   * contiguous regions of `renderScore` in the order it runs them, so whatever they miss surfaces as
   * `unaccounted` rather than being absorbed by a neighbour. See {@link RenderLayoutPart}.
   *
   * Session-global, not per-cause: it is one question, asked once.
   */
  private sub: Record<RenderLayoutPart, number> = { ...ZERO_PARTS }

  layoutSub(part: RenderLayoutPart, ms: number): void {
    if (!this.on) return
    this.sub[part] += ms
  }

  /** Is the instrument recording? Lets hot call sites skip `performance.now()` entirely when off. */
  get recording(): boolean {
    return this.on
  }

  /** Called at the bottom of VexFlowRenderer.renderScore. */
  endRender(): void {
    if (!this.on) return
    const total = now() - this.t0
    const b = this.buckets.get(this.cause) ?? { n: 0, total: 0, layout: 0, max: 0, redrawn: 0, of: 0 }
    b.n++
    b.total += total
    b.layout += this.layoutMs
    b.max = Math.max(b.max, total)
    b.redrawn += this.redrawn
    b.of += this.of
    this.buckets.set(this.cause, b)
    this.cause = '?'
  }

  /**
   * The numbers, as data. `dump()` is this plus `console.table`.
   *
   * ⭐ Split out so the arithmetic can be TESTED. Every bug this instrument has had lived in the
   * arithmetic, not in the timing — a denominator rebuilt out of rounded averages, and a numerator
   * with a different lifetime from its denominator ({@link reset}) — and neither was reachable from
   * a spec while the only way to read a number was to look at a console.
   */
  report(): CensusReport {
    const buckets = [...this.buckets.values()]
    return {
      renders: buckets.reduce((s, b) => s + b.n, 0),
      totalMs: buckets.reduce((s, b) => s + b.total, 0),
      // ⚠️ Summed from the RAW per-cause totals. `dump` used to rebuild it as `round(layout/n) × n`
      // per cause, which drifts by up to half a rounding step per cause for nothing.
      layoutMs: buckets.reduce((s, b) => s + b.layout, 0),
      causes: [...this.buckets.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([cause, b]) => ({
          cause,
          renders: b.n,
          'total ms': +b.total.toFixed(0),
          'avg ms': +(b.total / b.n).toFixed(1),
          'worst ms': +b.max.toFixed(1),
          'layout ms (avg)': +(b.layout / b.n).toFixed(1),
          // P5.4: bars actually re-engraved vs bars on the page. 0% is the goal for anything that
          // changes no content (a slur drag); ~one system for an ordinary edit.
          'redrawn %': b.of === 0 ? 0 : +((100 * b.redrawn) / b.of).toFixed(1),
          'draw ms (avg)': +((b.total - b.layout) / b.n).toFixed(1),
        })),
      parts: { ...this.sub },
      // ⭐ What no region claimed. ⚠️ `fingerprint` is INSIDE `shapeKey` and `laneView`/`columns` are
      // inside the layout bracket, so they are excluded here — adding a part to its own container
      // would drive this negative, which is the 259% bug wearing a different hat.
      unaccountedMs: Math.max(0, buckets.reduce((sum, b) => sum + b.total, 0)
        - buckets.reduce((sum, b) => sum + b.layout, 0)
        - RESIDUAL_PARTS.reduce((sum, k) => sum + this.sub[k], 0)),
    }
  }

  dump(): void {
    const r = this.report()
    console.log(
      `[census] ${r.renders} renders, ${r.totalMs.toFixed(0)} ms of render time total ` +
        `(layout ${r.layoutMs.toFixed(0)} ms = ${pct(r.layoutMs, r.totalMs)})`,
    )
    console.table(r.causes)

    // The §9 question: WHERE does the per-render time actually go?
    //
    // ⚠️ **Shares of the WHOLE RENDER, not of the layout term.** That denominator is what printed a
    // part at 259% (see `reset`): `fingerprint` is spent outside the layout bracket entirely, so
    // against the layout term it was never a percentage of anything. `in layout?` is the fact that
    // used to be smuggled into the denominator instead of being stated.
    const s = r.parts
    const row = (part: string, ms: number, note: string) =>
      ({ part, ms: +ms.toFixed(0), share: pct(ms, r.totalMs), note })
    console.log(`[census] where the ${r.totalMs.toFixed(0)} ms of render went — shares of the WHOLE render:`)
    console.table([
      row('LAYOUT (the bracket)', r.layoutMs, 'calculateMeasureWidths + the layout key'),
      row('· laneView', s.laneView, 'of which — staffMeasureView, per (measure, staff)'),
      row('· columns', s.columns, 'of which — the width rule; ⛔ CoW cannot help here'),
      row('tier1', s.tier1, 'one placement per (measure, staff), whole score'),
      row('plan', s.plan, 'spans + cull window + planCrossBarBeams TWICE'),
      row('shapeKey', s.shapeKey, 'one JSON.stringify per (measure, staff)'),
      row('· fingerprint', s.fingerprint, 'of which — laneFingerprint'),
      row('groups', s.groups, 'reuse decision, clear, pages, the measure loop, connectors'),
      row('curves', s.curves, 'ties + slurs'),
      row('ladder', s.ladder, 'the NINE outside-staff passes; ⚠️ several read DOM geometry'),
      row('hint', s.hint, 'hintBarlines'),
      row('unaccounted', r.unaccountedMs, 'the header: surface, clefs, staff spacing, sizing, ghost'),
    ])
    // ⛔ A fourth line here reported `MeasureWidthCache` hits/misses. It printed `0 hits / 0 misses`
    // for its whole life, and docs/render-performance-plan.md §12.6 quoted that as if it meant the
    // cache was cold: the probe had NO call site, and the cache it would have measured is
    // deliberately not consulted (`MeasureLayout.noteSpaceForMeasure`). A line that can only print
    // zero is not a measurement, and leaving it standing cost a reading of the census.
  }
}

/** What {@link RenderCensus.report} answers with — the dump, before it becomes console output. */
export interface CensusReport {
  renders: number
  totalMs: number
  /** The layout term, summed raw across causes. */
  layoutMs: number
  causes: Array<Record<string, string | number>>
  parts: Record<RenderLayoutPart, number>
  /** Total render minus the layout bracket minus every residual region — see {@link RESIDUAL_PARTS}. */
  unaccountedMs: number
}

/**
 * The regions of `renderScore` OUTSIDE the layout bracket, and they must tile it without overlapping
 * — that is what lets `unaccountedMs` be a subtraction rather than a guess.
 *
 * ⛔ `fingerprint` is NOT here: it is spent inside `shapeKey`, and counting it twice would make the
 * remainder lie. ⛔ Nor are `laneView`/`columns`, which are inside the layout bracket.
 */
const RESIDUAL_PARTS = ['tier1', 'plan', 'shapeKey', 'groups', 'curves', 'ladder', 'hint'] as const

/** Every part at zero — the one place the list is written down, so `reset` cannot forget one. */
const ZERO_PARTS: Record<RenderLayoutPart, number> = {
  laneView: 0, fingerprint: 0, columns: 0,
  tier1: 0, plan: 0, shapeKey: 0, groups: 0, curves: 0, ladder: 0, hint: 0,
}

function pct(part: number, whole: number): string {
  return whole === 0 ? '—' : `${((100 * part) / whole).toFixed(0)}%`
}

/** The frame that called RenderController.renderScore — e.g. "MouseController.handleMouseDown". */
function callerFrame(): string {
  const stack = new Error().stack?.split('\n') ?? []
  // 0: "Error", 1: callerFrame, 2: setCause, 3: RenderController.renderScore, 4: the caller.
  for (let i = 4; i < Math.min(stack.length, 9); i++) {
    const line = stack[i] ?? ''
    // Chrome: "    at MouseController.handleClick (http://…/MouseController.ts:231:20)"
    const m = /at (?:async )?([\w$.<>]+)/.exec(line)
    const name = m?.[1]
    if (!name) continue
    if (name.startsWith('RenderCensus') || name.includes('renderScore')) continue
    return name
  }
  return 'unknown'
}

// `/*#__PURE__*/` so a production build can drop this module entirely. Constructing a census only
// initialises fields — it touches nothing outside itself — but a bundler cannot know that about a
// module-level `new`, so without the annotation the instrument ships to a site that never installs
// it (App.ts calls installPerfInstruments only in dev).
export const renderCensus = /*#__PURE__*/ new RenderCensus()

/**
 * Load a synthetic score of `bars` measures × `staves` staves, 4 quarter notes per bar per
 * staff — the density the findings doc measured, so the numbers are comparable. Returns the
 * JSON; the dev harness feeds it straight to `engine.loadJSON`.
 */
export function buildSyntheticScore(bars: number, staves = 1): string {
  const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const model = new ScoreModel(`perf ${bars}×${staves}`)
  for (let i = 1; i < bars; i++) model.addMeasure() // the constructor seeds measure 1
  for (let s = 1; s < staves; s++) model.addStaffBelow(s - 1)

  for (let m = 1; m <= bars; m++) {
    for (let s = 0; s < staves; s++) {
      for (let b = 0; b < 4; b++) {
        model.addNote({
          step: STEPS[(m + s + b) % 7],
          octave: 4,
          duration: 'q',
          measure: m,
          beat: { num: b, den: 1 },
          staff: s,
        })
      }
    }
  }
  return model.toJSON()
}
