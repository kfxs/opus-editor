/**
 * ⚠️⚠️ **AN EXPERIMENT, AND IT IS HIS** (2026-08-31) — *"so, do you have any idea how to improve the
 * slur now?"*, and then *"yes"* to putting the choice under his hand rather than under my arithmetic.
 *
 * ⭐⭐ **THE POINT: a slur's shape is a TASTE CALL, and the only instrument that can settle one is his
 * eye on his own music.** Three engines answer the height law three ways and no treatise gives a
 * number at all ({@link slurArchHeight}'s header; the library was searched again on 2026-08-31 and
 * the verdict was UNDOCUMENTED). So instead of my picking a fourth, this knob draws all three under
 * `__slur.law(…)` in the console, live, and he picks.
 *
 * ⛔ **It changes NOTHING by default.** `'lilypond'` and an indent of 0.25 are exactly what shipped
 * before this file existed, so a session that never touches the console draws what it always drew.
 *
 * ⛔ **`dev/` may not be imported by `engine/`** (CLAUDE.md's layer arrow), so the seam is this way
 * round — the ENGINE owns the setting and `dev/slurKnob.ts` writes it, the same shape as
 * `engine/RenderProbe.ts`. ⭐ And {@link slurShapeGeneration} is in the render's view key: a law is a
 * PICTURE change with no model change, so without it `isRenderStale()` answers "no" and the console
 * call does nothing at all (`reference_only_a_stale_render_runs`).
 *
 * ⏭️ **WHEN HE HAS CHOSEN**: freeze the winner in `slurArchHeight` / `curveStyle` with his choice as
 * the citation — the way the 0.693 lean ratio was settled — and delete this file. ⛔ Until he says
 * so, it stays ([[feedback_an_experiment_ends_when_he_says_so]]).
 */

/**
 * The three engines' height laws, each in STAFF SPACES in and out, each read at source. ⭐ All three
 * reproduce the comparison table in {@link slurArchHeight}'s header to 0.01, which is what says they
 * are transcribed rather than remembered.
 */
export type SlurHeightLaw = 'lilypond' | 'verovio' | 'musescore'

/** LilyPond's `slur_height` — `F0_1(w·r₀/h_inf)·h_inf`, `lily/bezier-bow.cc:29-38` with the `Slur`
 *  grob's own pair (`define-grobs.scm:3178,3181`: height-limit 2.0, ratio 0.25). ⭐ TODAY'S LAW, his
 *  call of 2026-08-16. */
function lilypondHeight(widthSpaces: number): number {
  const H_INF = 2.0, R_0 = 0.25
  const saturate = (x: number) => (2 / Math.PI) * Math.atan((Math.PI * x) / 2)
  return saturate((widthSpaces * R_0) / H_INF) * H_INF
}

/**
 * Verovio's — `BezierCurve::CalcInitialControlPointParams` (`src/devicecontext.cpp:46-86`):
 * `height = clamp(dist/5, 1.2·unit, 3·unit)`. ⚠️ A Verovio *unit* is HALF a staff space
 * (`options.cpp:1202`), so in staff spaces that is **`clamp(w/5, 0.6, 1.5)`** — a hard floor no
 * short slur can go under, which is the half of it worth looking at: ours computes 0.56 sp on his
 * two-eighths bar and Verovio would never draw one that shallow.
 */
function verovioHeight(widthSpaces: number): number {
  return Math.min(1.5, Math.max(0.6, widthSpaces / 5))
}

/** MuseScore's — the shoulder height `sqrt(slurLengthInSp / 4) · spatium` (`slurtielayout.cpp`).
 *  ⭐ The DEEPEST of the three at short spans, and the one his two hand-drawn shapes landed nearest
 *  (they asked for ×1.33 and ×1.93 of LilyPond's). */
function musescoreHeight(widthSpaces: number): number {
  return Math.sqrt(Math.abs(widthSpaces) / 4)
}

const HEIGHT_LAW: Record<SlurHeightLaw, (widthSpaces: number) => number> = {
  lilypond: lilypondHeight,
  verovio: verovioHeight,
  musescore: musescoreHeight,
}

/** VexFlow's own control-point spacing is `span/(cps+2)` = **span/4**, and ours has always taken it
 *  as given. ⚠️ Both engines vary it with length instead — Verovio eases `dist/6` (short) to
 *  `dist/3` (long, `devicecontext.cpp:46-86`), LilyPond grows an `indent` toward `2·h_inf`
 *  (`bezier-bow.cc:106-115`). A NARROWER indent at the same height lifts the shoulders faster off
 *  the endpoints — rounder ends without touching the height law, which may be what *"not that
 *  curvy"* was actually about. */
const DEFAULT_INDENT = 0.25

const state = {
  law: 'lilypond' as SlurHeightLaw,
  indent: DEFAULT_INDENT,
  /** Bumped on every write — see the header: a picture-only change must reach the render key. */
  generation: 0,
}

/** The control height for a slur of `widthSpaces`, under whichever law is armed — in staff spaces. */
export function slurLawHeightSpaces(widthSpaces: number): number {
  return HEIGHT_LAW[state.law](widthSpaces)
}

/** How far in from each endpoint the controls sit, as a fraction of the span (VexFlow's own 0.25
 *  unless the knob says otherwise). */
export function slurIndentFraction(): number {
  return state.indent
}

/** What is armed right now — for the console's own read-back, and for a spec. */
export function slurShapeSettings(): { law: SlurHeightLaw; indent: number; generation: number } {
  return { ...state }
}

/** ⚠️ In the renderer's VIEW key, so arming a law actually redraws (see the header). */
export function slurShapeGeneration(): number {
  return state.generation
}

/** Arm a height law. Unknown names are refused rather than silently ignored — a console typo that
 *  looked like it worked would be the worst possible instrument. */
export function setSlurHeightLaw(law: SlurHeightLaw): boolean {
  if (!(law in HEIGHT_LAW)) return false
  state.law = law
  state.generation++
  return true
}

/**
 * Arm an indent fraction (0.25 = VexFlow's own, 0.167 = Verovio's short end, 0.33 its long one).
 *
 * ⛔ Refuses **more than 0.5**, and only that: past it the two controls swap sides and the curve
 * loops back on itself. ⚠️ **0.5 itself is allowed** — his `__slur.indent(0.5)`, 2026-08-31, which
 * this first refused. The two controls then land on the same point and the arc draws pointier;
 * that is an extreme worth SEEING, and a knob built for an eye must not withhold a drawable shape.
 */
export function setSlurIndentFraction(fraction: number): boolean {
  if (!(fraction > 0 && fraction <= 0.5)) return false
  state.indent = fraction
  state.generation++
  return true
}

/** Back to what shipped — `'lilypond'` at 0.25. */
export function resetSlurShape(): void {
  state.law = 'lilypond'
  state.indent = DEFAULT_INDENT
  state.generation++
}
