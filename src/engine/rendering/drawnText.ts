/**
 * ⭐⭐ **WHERE A DRAWN `<text>` WAS PUT — the one place that reads a rendered glyph's own origin
 * back out of the DOM.**
 *
 * Several passes reposition or measure ink AFTER it has been drawn: the dynamics line and the tempo
 * row translate a mark onto its row, and the dynamics hit-box is rebuilt from the mark's baseline
 * because VexFlow's group box unions a tall transparent pointer-rect
 * (`reference_vexflow_annotation_pointer_rect`). All of them need the same number, and all of them
 * used to read it themselves.
 *
 * ## ⚠️⚠️ The rule they each had to know, and one of them got wrong
 *
 * **A MISSING `x`/`y` MEANS ZERO, NOT "not drawn".** SVG defines both as 0 when absent, and VexFlow's
 * SVG context OMITS the attribute when the value it computed is 0 — so a perfectly ordinary mark can
 * arrive with `x="117.5"` and no `y` at all. Read that as `parseFloat('')` and you get `NaN`, which
 * every one of these call sites was treating as *nothing drew here*.
 *
 * ⭐ **The failure is silent, and that is why this is a module rather than a fix.** The dynamics line
 * pass simply skipped such a mark: it stayed exactly where VexFlow left it, on no line at all, with
 * nothing logged and nothing thrown. Found 2026-08-13 while building `e2e/ladder.e2e.ts` — a `p`
 * above a B6, whose annotation VexFlow happened to place at y=0. The same latent bug was sitting in
 * `DynamicsLayout`'s hit-box (where it would have handed back the ballooned group box instead of the
 * tight one) and in the tempo row that was being written at the time.
 *
 * ⛔ So do not read `getAttribute('x')`/`getAttribute('y')` off drawn ink anywhere else. Three
 * copies of a rule is how the third one comes to disagree, and a fourth pass will want it too.
 *
 * ⚠️ **The origin is AUTHORED, not composed** — it is the coordinate the drawing code passed, in
 * whatever space the element's ancestors establish. That is exactly what a caller repositioning the
 * element wants (its move is expressed in the same space) and exactly what a caller wanting the
 * ON-SCREEN position does not: compose the CTM for that, as `e2e/harness.ts` does.
 */

/** A drawn `<text>`'s own origin, in its parent's coordinates. */
export interface DrawnTextOrigin {
  x: number
  y: number
}

/**
 * The first `<text>` inside `group` — the element whose origin the passes measure from.
 *
 * The FIRST is the right one for every current caller because a mark's runs are laid left to right
 * on ONE baseline (`p dolce`, `Allegro (♩ = 120)`), so they all share the y and the leftmost owns
 * the x.
 */
export function firstDrawnText(group: Element | null | undefined): SVGTextElement | null {
  return (group?.querySelector('text') as SVGTextElement | null) ?? null
}

/**
 * Where that `<text>` was drawn — `null` only when there is genuinely nothing to read.
 *
 * Returns `null` for a missing element (nothing drew) and for an unparseable coordinate (an anomaly
 * worth skipping); an **absent** attribute is 0, per SVG. ⭐ Keeping those three cases apart is the
 * whole point: "no element" and "no attribute" are different facts, and collapsing them is the bug
 * this module was extracted for.
 */
export function drawnTextOrigin(text: Element | null | undefined): DrawnTextOrigin | null {
  if (!text) return null
  const x = parseFloat(text.getAttribute('x') ?? '0')
  const y = parseFloat(text.getAttribute('y') ?? '0')
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}
