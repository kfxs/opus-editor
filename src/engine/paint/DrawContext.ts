/**
 * ⭐⭐ **THE SURFACE WE DRAW ON, DECLARED BY US** — `docs/own-engraving-engine.md` P1b.
 *
 * ## What this is
 *
 * The complete set of drawing primitives this engine actually uses, named in our own vocabulary and
 * importing nothing. ⭐ It is deliberately **satisfied by VexFlow's `SVGContext` today**, because it
 * was extracted from the calls we already make on one: nothing is implemented here, no pixel moves,
 * and the object flowing through every renderer is the same object it was.
 *
 * ## ⭐⭐ Why an interface, when the implementation is still VexFlow's
 *
 * That question is the whole reason P1 sat unstarted for a fortnight. The plan had demoted it with:
 * *"while VexFlow objects still paint themselves our context must implement VexFlow's
 * `RenderContext` anyway, so it re-implements their interface rather than escaping it"* — which is
 * **true of the implementation and false of the interface.** Declaring the type we want, and letting
 * their class satisfy it structurally, inverts the dependency while building nothing:
 *
 * - ⭐ Our renderers stop **naming** a VexFlow type, so they no longer have to be handed a VexFlow
 *   object — the precondition for handing them anything else.
 * - ⭐⭐ A **recording** implementation of this interface is the SCENE (§7.2): the same calls, kept
 *   as values instead of painted. That is the golden net P3 is gated on, and it arrives as a scene
 *   diff rather than a pixel diff.
 * - ⭐ The residue becomes **countable**: what still needs the real VexFlow context is now spelled
 *   `vexContext` (see `rendering/RenderPass`), so the coupling has a number instead of being
 *   invisible behind a shared type name.
 *
 * ## ⛔ What is deliberately NOT here
 *
 * `RenderContext` has ~35 members; we call 20. The absent ones are absent on purpose — this is the
 * measured set, not a transcription, and a primitive that nothing draws with is a primitive nobody
 * has had to justify. ⭐ Rule 4: *a new drawn element = a MODULE + a ROW in its table + an EXISTING
 * scene primitive; a new primitive needs a reason.*
 *
 * ⛔ **No DOM.** `SVGContext.svg`, `.state` and `.attributes` are reachable on the real object and
 * are not declared here; a pass that needs one is reaching past the drawing surface into the page,
 * and must say so by taking the `vexContext` instead. That is what stops a scene implementation
 * from being quietly impossible.
 */

/**
 * ⭐ **A group in the drawn output** — see `./DrawGroup`, which is what a painter hands back.
 *
 * ⚠️ This used to be `export type DrawGroup = unknown`, a placeholder for the 12 call sites that
 * cast `openGroup`'s result to an `SVGGElement`. P1c replaced it with a real handle: a placement, an
 * ink box, a discard and two tags — 🚨 and one of those, `tagLast`, exists because two passes
 * carried the same comment, *"a context's drawing calls return the context and not the node"*. In a
 * scene a primitive is a value with fields, so that whole read-back stops being necessary.
 */
export type { OpenedGroup, DrawGroup } from './DrawGroup'
import type { OpenedGroup } from './DrawGroup'

/**
 * ⭐ The 20 primitives, in the four families they fall into.
 *
 * ⚠️ Every method returns `void` rather than `this`. VexFlow's return the context for chaining and
 * nothing in this codebase chains, so requiring it would be requiring a property of *their*
 * implementation from every future one. A method that returns something is a method that has been
 * asked a question; these are all commands.
 */
export interface DrawContext {
  // ── Paths ────────────────────────────────────────────────────────────────────────────────────
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  /** ⭐ The 20th primitive, and the only one added since this set was measured: **a curve is the one
   *  thing in this engine that is not made of straight edges** (U1 — a slur's and a tie's arc are
   *  two cubics, `engrave/curves/curveInk`). ⛔ Nothing else uses it; `quadraticCurveTo` and `arc`
   *  stayed out, because a primitive nothing draws with is one nobody has had to justify. */
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void
  closePath(): void
  stroke(): void
  fill(): void

  // ── Rectangles ───────────────────────────────────────────────────────────────────────────────
  /** The workhorse: staff lines, barlines, beams and every stem in this engine are filled rects. */
  fillRect(x: number, y: number, width: number, height: number): void

  // ── Text ─────────────────────────────────────────────────────────────────────────────────────
  /** ⚠️ Prefer `rendering/glyphPainter`, which owns the font resolution. These two are the layer
   *  under it — declared because the painter needs them, not as a second way to stamp a glyph. */
  setFont(font?: string | object, size?: string | number, weight?: string | number, style?: string): void
  fillText(text: string, x: number, y: number): void

  // ── Style ────────────────────────────────────────────────────────────────────────────────────
  setFillStyle(style: string): void
  setStrokeStyle(style: string): void
  setLineWidth(width: number): void
  setLineDash(dashPattern: number[]): void

  // ── The transform + state stack ──────────────────────────────────────────────────────────────
  /** ⚠️ `save`/`restore` are NO-OPS in VexFlow's SVG context for style purposes — one of the four
   *  standing gotchas P1's own implementation closes (`docs/own-engraving-engine.md` §5 P1). Called
   *  anyway, so the intent is in the code when a context that honours them arrives. */
  save(): void
  restore(): void
  /** ⛔ Not the staff-size mechanism: that is a `transform` on the measure's own group, because
   *  `ctx.scale` rewrites the SVG's viewBox and would rescale what is already drawn
   *  (`docs/staff-size-plan.md` §4.1). */
  scale(x: number, y: number): void

  // ── Grouping + hit surface ───────────────────────────────────────────────────────────────────
  /** The class and id go onto the group as given (VexFlow's `vf-` prefix is gone since S15c) — and
   *  `closeGroup()` must always run, or an open group swallows the whole rest of the render. */
  openGroup(cls?: string, id?: string): OpenedGroup
  closeGroup(): void
  /** An invisible rect that only exists to be hit — the pointer's target, not ink. */
  pointerRect(x: number, y: number, width: number, height: number): void
}
