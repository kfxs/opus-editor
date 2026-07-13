/**
 * @vitest-environment jsdom
 *
 * P0 measurement harness (docs/render-performance-plan.md §8). THROWAWAY — delete once the
 * numbers land in the findings doc. Layout is pure JS (no DOM writes), so these numbers
 * transfer to Chrome; jsdom is here only because VexFlow wants a document to exist.
 *
 * Run one at a time (each stage is big):
 *   npx vitest run perf/p0.test.ts -t "A."   # etc.
 * Results are appended to perf/p0-results.txt (VexFlow floods the console with warnings).
 */
import { describe, it } from 'vitest'
import { appendFileSync } from 'fs'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { calculateMeasureWidths } from '@/engine/rendering/MeasureLayout'
import { MeasureWidthCache } from '@/engine/rendering/MeasureWidthCache'
import { staffMeasureView, getStaves } from '@/engine/models/staffContent'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import type { Score, PitchStep } from '@/types/music'

/**
 * Skipped in the normal suite — stage C builds a 500×25 score and needs ~12 GB of heap.
 * Run it deliberately, one stage at a time:
 *   PERF=1 NODE_OPTIONS=--max-old-space-size=12288 npx vitest run perf/p0.test.ts -t "C\."
 */
const perfIt = process.env.PERF ? it : it.skip

const OUT = 'perf/p0-results.txt'
const say = (line: string) => appendFileSync(OUT, line + '\n')

const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** N measures × S staves, 4 quarter notes per bar per staff (the findings-doc density). */
function buildScore(bars: number, staves: number): Score {
  const model = new ScoreModel('perf')
  for (let i = 1; i < bars; i++) model.addMeasure() // constructor seeds measure 1
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
  return model.getScore()
}

/** What the renderer feeds calculateMeasureWidths: one clef fold per staff (P1/P2). */
function trebleClefs(score: Score): Map<string | undefined, StaffClefs> {
  return new Map(getStaves(score).map((s) => [s.id, resolveStaffClefs(score, s.id)]))
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

function time(runs: number, fn: () => void): number {
  fn() // warm-up
  const samples: number[] = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    fn()
    samples.push(performance.now() - t0)
  }
  return median(samples)
}

const ms = (x: number) => `${x.toFixed(1)} ms`
const heapMB = () => (process.memoryUsage().heapUsed / 1e6).toFixed(0) + ' MB'

/** Sanity: the synthetic score really has the notes we think it has. */
function describeScore(score: Score): string {
  const chords = score.measures.reduce(
    (n, m) => n + m.slots.filter((s) => s.type === 'chord').length, 0)
  const rests = score.measures.reduce(
    (n, m) => n + m.slots.filter((s) => s.type === 'rest').length, 0)
  return `${score.measures.length} bars × ${getStaves(score).length} staves — ${chords} chords, ${rests} rests`
}

describe('P0 — render performance measurement', () => {
  perfIt('A. layout vs BAR count (1 staff) — re-baselines the findings doc', () => {
    say('\n=== A. layout, 1 staff, wrapped ===')
    for (const bars of [100, 200, 400]) {
      const score = buildScore(bars, 1)
      if (bars === 100) say(`  built: ${describeScore(score)}`)
      const clefs = trebleClefs(score)
      const t = time(5, () => calculateMeasureWidths(score, clefs, 'wrapped'))
      say(`  ${String(bars).padStart(4)} bars: ${ms(t).padStart(9)}  (${(t / bars).toFixed(2)} ms/bar)`)
    }
  }, 900_000)

  perfIt('B. layout vs STAFF count (100 bars) — does the formatter really eat N× the notes?', () => {
    say('\n=== B. layout, 100 bars, wrapped, growing the staff axis ===')
    for (const staves of [1, 2, 4, 8, 16, 25]) {
      const score = buildScore(100, staves)
      const clefs = trebleClefs(score)
      const t = time(3, () => calculateMeasureWidths(score, clefs, 'wrapped'))
      say(`  ${String(staves).padStart(2)} staves: ${ms(t).padStart(9)}  (${(t / 100).toFixed(2)} ms/bar, heap ${heapMB()})`)
    }
  }, 900_000)

  perfIt('C. the orchestral target: 500 bars × 25 staves', () => {
    say('\n=== C. 500 bars × 25 staves (Mahler 5 scale) ===')
    const score = buildScore(500, 25)
    say(`  built: ${describeScore(score)} (heap ${heapMB()})`)
    const clefs = trebleClefs(score)

    const layout = time(3, () => calculateMeasureWidths(score, clefs, 'wrapped'))
    say(`  layout (uncached, today):          ${ms(layout).padStart(9)}  (heap ${heapMB()})`)

    // The P2 steady-state cost: fingerprint every (measure, staff) lane once per render.
    const staffList = getStaves(score)
    const fingerprint = time(5, () => {
      let acc = 0
      for (const measure of score.measures) {
        for (const staff of staffList) {
          const view = staffMeasureView(measure, staff.id, score)
          acc += JSON.stringify([view.slots, view.clefs, view.tuplets, view.timeSignature, 'treble']).length
        }
      }
      if (acc < 0) throw new Error('unreachable')
    })
    say(`  P2 fingerprint walk (per render):  ${ms(fingerprint).padStart(9)}`)

    // The third, never-measured O(N) term: undo.
    const stringify = time(5, () => { JSON.stringify(score) })
    const clone = time(5, () => { JSON.parse(JSON.stringify(score)) })
    say(`  runBatch (2× JSON.stringify):      ${ms(stringify * 2).padStart(9)}`)
    say(`  pushState (parse∘stringify):       ${ms(clone).padStart(9)}`)
    say(`  => undo term per batched edit:     ${ms(stringify * 2 + clone).padStart(9)}`)
  }, 900_000)

  perfIt('D. the undo term at ordinary size (400 bars × 1 staff)', () => {
    say('\n=== D. undo term, 400 bars × 1 staff ===')
    const score = buildScore(400, 1)
    const stringify = time(5, () => { JSON.stringify(score) })
    const clone = time(5, () => { JSON.parse(JSON.stringify(score)) })
    say(`  runBatch 2× stringify:             ${ms(stringify * 2).padStart(9)}`)
    say(`  pushState clone:                   ${ms(clone).padStart(9)}`)
    say(`  => undo term per batched edit:     ${ms(stringify * 2 + clone).padStart(9)}`)
  }, 900_000)

  perfIt('E. P1 preview — per-staff slices vs one interleaved voice set (100 bars × 25 staves)', () => {
    say('\n=== E. P1 preview: 100 bars × 25 staves ===')
    const score = buildScore(100, 25)
    const clefs = trebleClefs(score)
    const staffList = getStaves(score)

    const today = time(3, () => calculateMeasureWidths(score, clefs, 'wrapped'))

    // Approximates P1: the same layout, but over per-staff slices (the max is free arithmetic).
    const sliced: Score[] = staffList.map((staff) => ({
      ...score,
      measures: score.measures.map((m) => staffMeasureView(m, staff.id, score)),
    }))
    const p1 = time(3, () => { for (const s of sliced) calculateMeasureWidths(s, clefs, 'wrapped') })

    say(`  today (25 staves' notes in one voice set): ${ms(today).padStart(9)}`)
    say(`  P1 shape (25 per-staff passes):            ${ms(p1).padStart(9)}`)
    say(`  => P1 alone changes layout by:             ${((p1 / today - 1) * 100).toFixed(0)}%`)
    say(`  (P1's real win: each per-staff width becomes CACHEABLE. That's P2.)`)
  }, 900_000)

  perfIt('F. P2 — the cached steady state (what a render costs when you edited ONE bar)', () => {
    say('\n=== F. P2: layout, uncached vs warm cache ===')
    for (const [bars, staves] of [[400, 1], [100, 25], [500, 25]] as const) {
      const score = buildScore(bars, staves)
      const clefs = trebleClefs(score)

      const uncached = time(3, () => calculateMeasureWidths(score, clefs, 'wrapped'))

      // One cache, reused across renders — exactly how the renderer holds it.
      const cache = new MeasureWidthCache()
      calculateMeasureWidths(score, clefs, 'wrapped', cache) // cold: fills it
      const warm = time(5, () => calculateMeasureWidths(score, clefs, 'wrapped', cache))

      say(`  ${String(bars).padStart(3)} bars × ${String(staves).padStart(2)} staves:  uncached ${ms(uncached).padStart(9)}  →  warm ${ms(warm).padStart(8)}   (${(uncached / warm).toFixed(0)}× faster)`)
    }
  }, 900_000)

  perfIt('G. the undo term after the runBatch fix (2 of 3 serializations gone)', () => {
    say('\n=== G. undo per batched edit: before vs after ===')
    for (const [bars, staves] of [[400, 1], [500, 25]] as const) {
      const score = buildScore(bars, staves)
      const stringify = time(5, () => { JSON.stringify(score) })
      const clone = time(5, () => { JSON.parse(JSON.stringify(score)) })

      // Before: runBatch stringified the whole score TWICE to detect change, then pushState
      // deep-cloned it. After: the change is a counter, so only pushState's clone remains.
      const before = stringify * 2 + clone
      const after = clone
      say(`  ${String(bars).padStart(3)} bars × ${String(staves).padStart(2)} staves:  before ${ms(before).padStart(8)}  →  after ${ms(after).padStart(8)}   (${((1 - after / before) * 100).toFixed(0)}% less)`)
    }
  }, 900_000)
})
