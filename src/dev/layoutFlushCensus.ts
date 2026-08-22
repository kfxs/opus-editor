/**
 * TEMPORARY — **which call site pays the forced style+layout flush**
 * (docs/render-performance-plan.md §12.7, docs/render-performance-research.md §7a).
 *
 * ## The question the region census cannot answer
 *
 * `renderCensus` carves a render into eight wall-clock regions. That took us a long way and then hit
 * a wall: between two runs `groups` rose 71% and `ladder` fell 40% while **their sum did not move**
 * (4.60 → 4.75 ms). Nothing regressed and nothing got faster — the flush had relocated. It always
 * will, because **whichever region reads geometry first after a write pays for every write before
 * it**, so a wall-clock region reports where the bill landed, never who ran it up.
 *
 * ## Why not the Long Animation Frames API
 *
 * ⛔ `PerformanceScriptTiming.forcedStyleAndLayoutDuration` is the obvious instrument and it is the
 * wrong one HERE: a LoAF entry is only emitted for a frame longer than **50 ms**, and our frames are
 * 10–17 ms. It would report nothing at all. (It stays the right tool for a genuinely long frame, and
 * for attributing work we did not write.)
 *
 * ## What this does instead
 *
 * Patches the DOM reads that force a flush — verified against Blink, WebKit and Gecko source, each of
 * which opens these methods with a layout update (research §7a) — times each call, and buckets it by
 * the **caller's own stack frame**. That names `registerDynamics`, `drawRestGhost`, `hintBarlines`
 * directly, at any frame length, with no threshold.
 *
 * ⚠️ **A big number here is a bill, not a crime.** The first read after a batch of writes pays for all
 * of them; the reads after it are nearly free (the document is clean, and both engines early-out).
 * So a site with a large total may simply be *first in line* behind a neighbour's writes. ⭐ The
 * actionable shape is a site called MANY times with a large total — that is interleaving, and
 * batching its reads collapses N flushes into one.
 *
 * ⛔ Not installed unless `enable()` is called: until then the prototypes are untouched and this costs
 * nothing whatsoever. Dev builds put it on `window.__flush`.
 */
import { callerFrame } from './callerFrame'

interface Site {
  /** How many forcing reads this site made. */
  n: number
  /** Wall time inside those reads (ms) — the flush, plus a stored-field read that is free. */
  ms: number
  /** The worst single read, which is usually the one that paid for a big batch of writes. */
  max: number
}

/**
 * The reads that force a style+layout update, and where each is declared.
 *
 * ⭐ Every entry was read out of an engine, not out of a blog: Blink's `svg_graphics_element.cc` and
 * `svg_text_content_element.cc` open each of these with
 * `GetDocument().UpdateStyleAndLayoutForNode(...)`; WebKit's `SVGGraphicsElement::computeBBox` calls
 * `updateLayoutIgnorePendingStylesheets`; Gecko's `SVGGraphicsElement::GetBBox` takes
 * `GetPrimaryFrame(FlushType::Layout)`.
 *
 * ⚠️ Keyed by GLOBAL NAME, not by the constructor, because a headless run may not have all of them —
 * jsdom has `Element` and no `SVGGraphicsElement`. A missing global is skipped, not a crash.
 */
const FORCING_READS: { global: string; methods: string[] }[] = [
  { global: 'SVGGraphicsElement', methods: ['getBBox', 'getCTM', 'getScreenCTM'] },
  {
    global: 'SVGTextContentElement',
    methods: [
      'getNumberOfChars', 'getComputedTextLength', 'getSubStringLength', 'getStartPositionOfChar',
      'getEndPositionOfChar', 'getExtentOfChar', 'getRotationOfChar', 'getCharNumAtPosition',
    ],
  },
  { global: 'Element', methods: ['getBoundingClientRect', 'getClientRects'] },
]

/** ⛔ The wrapper is NAMED so the stack walk can step over it deterministically — an anonymous
 *  function's frame is spelled differently by every engine, and guessing would misattribute. */
const IGNORE = /probedLayoutRead|LayoutFlushCensus/

type AnyFn = (...args: unknown[]) => unknown

class LayoutFlushCensus {
  private on = false
  private sites = new Map<string, Site>()
  /** How to put every prototype back exactly as it was. */
  private restore: Array<() => void> = []

  enable(): void {
    if (this.on) this.reset()
    else this.patch()
    this.on = true
    console.log('[flush] recording forced layout. Play with the editor, then call __flush.dump()')
  }

  disable(): void {
    for (const undo of this.restore) undo()
    this.restore = []
    this.on = false
  }

  reset(): void {
    this.sites.clear()
  }

  private patch(): void {
    const scope = globalThis as unknown as Record<string, { prototype: Record<string, unknown> } | undefined>
    for (const { global, methods } of FORCING_READS) {
      const proto = scope[global]?.prototype
      if (!proto) continue // headless, or an engine without this interface — skip, never throw
      for (const method of methods) {
        const original = proto[method]
        if (typeof original !== 'function') continue
        proto[method] = this.probe(original as AnyFn)
        this.restore.push(() => { proto[method] = original })
      }
    }
  }

  /**
   * Wrap one forcing read so the flush it pays is charged to whoever called it.
   *
   * ⚠️ `try/finally`, not a plain sequence: `getBBox` on a detached node throws in some engines, and
   * an instrument that loses its own bookkeeping on the interesting case is worse than none.
   */
  private probe(original: AnyFn): AnyFn {
    const recording = () => this.on
    const charge = (site: string, ms: number) => this.charge(site, ms)
    function probedLayoutRead(this: unknown, ...args: unknown[]): unknown {
      if (!recording()) return original.apply(this, args)
      const t0 = performance.now()
      try {
        return original.apply(this, args)
      } finally {
        // ⚠️ The stack is read HERE, not inside the census, so exactly one frame stands between
        // `callerFrame` and the real caller. Reading it a level deeper reported the census's own
        // plumbing as the site — every row said `record`, which is true and useless.
        charge(callerFrame({ skip: 3, ignore: IGNORE }), performance.now() - t0)
      }
    }
    return probedLayoutRead
  }

  private charge(site: string, ms: number): void {
    const bucket = this.sites.get(site) ?? { n: 0, ms: 0, max: 0 }
    bucket.n++
    bucket.ms += ms
    bucket.max = Math.max(bucket.max, ms)
    this.sites.set(site, bucket)
  }

  /** The numbers, as data — so the arithmetic is reachable from a spec. */
  report(): FlushReport {
    const sites = [...this.sites.entries()]
      .sort((a, b) => b[1].ms - a[1].ms)
      .map(([site, b]) => ({
        site,
        reads: b.n,
        'total ms': +b.ms.toFixed(1),
        'avg ms': +(b.ms / b.n).toFixed(3),
        'worst ms': +b.max.toFixed(1),
      }))
    return {
      reads: [...this.sites.values()].reduce((s, b) => s + b.n, 0),
      totalMs: [...this.sites.values()].reduce((s, b) => s + b.ms, 0),
      sites,
    }
  }

  dump(): void {
    const r = this.report()
    console.log(
      `[flush] ${r.reads} forcing reads, ${r.totalMs.toFixed(0)} ms inside them. `
        + '⚠️ The FIRST read after a batch of writes pays for all of them — a big total may mean '
        + '"first in line", not "expensive". Many reads AND a big total is interleaving.',
    )
    console.table(r.sites)
  }
}

/** What {@link LayoutFlushCensus.report} answers with. */
export interface FlushReport {
  reads: number
  totalMs: number
  sites: Array<Record<string, string | number>>
}

// `/*#__PURE__*/` for the same reason `renderCensus` carries one: constructing it touches nothing
// outside itself, but a bundler cannot know that about a module-level `new`.
export const layoutFlushCensus = /*#__PURE__*/ new LayoutFlushCensus()
