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

/** Which third of the layout term a sample belongs to — see `RenderCensus.layoutSub`. */
export type RenderLayoutPart = 'laneView' | 'fingerprint' | 'format'

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
  layoutCacheProbe(hit: boolean): void
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
  layoutCacheProbe() {},
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
