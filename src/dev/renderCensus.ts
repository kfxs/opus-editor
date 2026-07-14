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

class RenderCensus {
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
   * **TEMPORARY, and the point of this round.** Split the layout term three ways, because §9 rests
   * on an assumption nobody has checked: that the cost is the *fingerprint walk*.
   *
   * The three suspects, and what each would mean:
   *
   *  - `laneView` — `staffMeasureView` rebuilding one `Measure` object per (measure, staff), every
   *    render. Copy-on-write fixes it (the lane can be cached on the measure's identity).
   *  - `fingerprint` — `JSON.stringify`ing every lane to make its cache key. **This is what §9
   *    assumes dominates**, and what a `WeakMap` on the measure object would delete outright.
   *  - `format` — the VexFlow `Formatter` actually re-running, on lanes whose key legitimately
   *    changed. Copy-on-write **does not help here at all**: the width really is unknown. If this
   *    is the bulk of it, §9 is the wrong fix and the answer lies in the key (a clef change puts a
   *    new `clef` in every later bar's fingerprint, so every later bar re-formats — even though a
   *    clef barely moves a notehead).
   *
   * Session-global, not per-cause: it is one question, asked once.
   */
  private sub = { laneView: 0, fingerprint: 0, format: 0, hits: 0, misses: 0 }

  layoutSub(part: 'laneView' | 'fingerprint' | 'format', ms: number): void {
    if (!this.on) return
    this.sub[part] += ms
  }

  layoutCacheProbe(hit: boolean): void {
    if (!this.on) return
    if (hit) this.sub.hits++
    else this.sub.misses++
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

  dump(): void {
    const rows = [...this.buckets.entries()]
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
      }))
    const n = rows.reduce((s, r) => s + r.renders, 0)
    const total = rows.reduce((s, r) => s + (r['total ms'] as number), 0)
    console.log(`[census] ${n} renders, ${total.toFixed(0)} ms of render time total`)
    console.table(rows)

    // The §9 question: WHERE does the layout term actually go?
    const s = this.sub
    const layoutTotal = rows.reduce((sum, r) => sum + (r['layout ms (avg)'] as number) * r.renders, 0)
    const probes = s.hits + s.misses
    console.log(
      `[census] layout breakdown — of ${layoutTotal.toFixed(0)} ms of layout across the session:`,
    )
    console.table([
      { part: 'laneView (staffMeasureView)', ms: +s.laneView.toFixed(0), share: pct(s.laneView, layoutTotal), 'fixed by CoW?': 'yes' },
      { part: 'fingerprint (JSON.stringify)', ms: +s.fingerprint.toFixed(0), share: pct(s.fingerprint, layoutTotal), 'fixed by CoW?': 'yes' },
      { part: 'format (VexFlow Formatter)', ms: +s.format.toFixed(0), share: pct(s.format, layoutTotal), 'fixed by CoW?': 'NO' },
    ])
    console.log(
      `[census] width cache: ${s.hits} hits / ${s.misses} misses (${pct(s.misses, probes)} miss rate). ` +
        `A high miss rate means the FORMATTER is re-running — which copy-on-write cannot help.`,
    )
  }
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

export const renderCensus = new RenderCensus()

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
