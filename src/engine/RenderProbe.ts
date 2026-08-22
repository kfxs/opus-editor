/**
 * The seam the render-timing instrument plugs into — and the reason `src/dev/` can be deleted.
 *
 * `CLAUDE.md` and `docs/ARCHITECTURE.md` both promise the dev shell "deletes cleanly", but until
 * this module existed the engine imported `dev/renderCensus` directly at three sites, so the
 * renderer would not COMPILE without the scaffolding it is supposed to be independent of. The
 * direction was wrong in the layer map's own terms — `engine/` may not know that `dev/` exists —
 * and `lint:boundary` did not catch it, because it only banned *framework* imports.
 *
 * So the engine declares the shape it wants measured, defaults it to a no-op, and `App.ts` (which
 * is allowed to know about both) injects the real census. Delete `src/dev/` and every call site
 * here keeps compiling and does nothing, which is what the promise said all along.
 *
 * ⚠️ TEMPORARY in the same sense the census is (docs/render-performance-plan.md §8/§9): when the
 * instrument goes, this goes with it. It is an interface rather than a parameter because the probed
 * sites are deep in the layout — `noteSpaceForLane` is a free function called per (measure, staff),
 * and threading a probe through every frame of that path to time it would change the shape of the
 * code being measured.
 */

/**
 * Which named walk a sample belongs to — see `RenderCensus.layoutSub`.
 *
 * ⚠️ **NOT "which third of the layout term".** It was, until 2026-08-22, and the name is why a dump
 * once reported a part at **259% of layout**: `fingerprint` is spent in `measureShapeKey`, which
 * runs *after* `endLayout()`. A part is a named walk with a share of the WHOLE RENDER; whether it
 * falls inside the layout bracket is a fact about it, not a premise of the accounting.
 *
 * - `laneView` — `staffMeasureView` rebuilding one `Measure` per (measure, staff). Inside layout.
 * - `columns` — the width rule: `measureColumns` + the natural/minimum widths. Inside layout.
 *   ⛔ It was called `format` while it timed VexFlow's `Formatter`; that formatter left this path
 *   (see `MeasureLayout.noteSpaceForMeasure`) and the name outlived it by long enough to be quoted
 *   back as "the formatter is re-running" in a dump that had not run a formatter at all.
 * - `fingerprint` — `laneFingerprint`, the `JSON.stringify` of a lane. **Outside** layout: its only
 *   live caller is the shape key, so it is a SUBSET of `shapeKey` below and ⛔ must never be added
 *   to it.
 *
 * ⭐⭐ **The seven below carve up the RESIDUAL** — the 83% of a render that the census could only
 * call "draw", on frames where `measuresRedrawn` reported **0%** and therefore nothing was drawn
 * (docs/render-performance-plan.md §12.7). They are contiguous regions of `renderScore`, in the
 * order it runs them, so what they do NOT cover shows up as the dump's `unaccounted` line rather
 * than being silently absorbed by a neighbour.
 *
 * - `tier1` — `layoutTier1`: one placement per (measure, staff), whole score, every render.
 * - `plan` — the spans, the cull window and the cross-bar beam plan (`planCrossBarBeams` runs
 *   **twice**).
 * - `shapeKey` — `measureShapeKey` per (measure, staff): a `JSON.stringify` each. ⊃ `fingerprint`.
 * - `groups` — the reuse decision, `clearForRender`, the pages, the measure loop itself (replay or
 *   rebuild), the system connectors and the cross-bar beams.
 * - `curves` — `renderTies` + `renderSlurs`. Before the ladder, and that ordering is load-bearing.
 * - `ladder` — the nine outside-staff passes: the three band plans, the dynamics line, hairpins,
 *   trills, ottavas, pedals, tempo. ⚠️ Several of these read DOM geometry.
 * - `hint` — `hintBarlines`, editor audience only.
 */
export type RenderLayoutPart =
  | 'laneView' | 'fingerprint' | 'columns'
  | 'tier1' | 'plan' | 'shapeKey' | 'groups' | 'curves' | 'ladder' | 'hint'

/** What the engine reports about a render. Implemented for real by `dev/renderCensus`. */
export interface RenderProbe {
  /**
   * Is anything actually recording? Lets a hot site skip `performance.now()` entirely when it is
   * not — the ordinary session answers `false` here and pays one boolean read.
   */
  readonly recording: boolean
  /** Tag the render about to happen; `undefined` means "recover the caller from the stack". */
  setCause(cause?: string): void
  beginRender(): void
  endRender(): void
  beginLayout(): void
  endLayout(): void
  /** How many (measure, staff) groups this render re-engraved, out of how many it owned. */
  measuresRedrawn(redrawn: number, of: number): void
  layoutSub(part: RenderLayoutPart, ms: number): void
}

/** The default: measures nothing, allocates nothing, and is what a build with no `dev/` gets. */
export const NO_RENDER_PROBE: RenderProbe = {
  recording: false,
  setCause() {},
  beginRender() {},
  endRender() {},
  beginLayout() {},
  endLayout() {},
  measuresRedrawn() {},
  layoutSub() {},
}

let current: RenderProbe = NO_RENDER_PROBE

/** Install the instrument (App.ts, dev builds only). Passing `null` puts the no-op back. */
export function setRenderProbe(probe: RenderProbe | null): void {
  current = probe ?? NO_RENDER_PROBE
}

/** The probe in force. A function, not a binding, so a site reads the CURRENT one every time. */
export function renderProbe(): RenderProbe {
  return current
}
