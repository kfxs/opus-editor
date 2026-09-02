/**
 * ⭐⭐ **THE SEAM WHERE THE STAFF'S LINES COME BACK TO US — P5a**
 * (`docs/own-engraving-engine.md` P5; the ink itself is `engrave/staff/staffLines`).
 *
 * `Stave.draw()` is three things in a fixed order, and only the FIRST is the staff:
 *
 * ```js
 * ctx.openGroup('stave', id)
 * …the five lines…        // ← P5a: now `engrave/staff/staffLines`
 * ctx.closeGroup()
 * for (modifier of this.modifiers) modifier.drawWithStyle()   // ← P5b took the CLEF; see below
 * if (this.measure > 0) …the measure number…                  // ⛔ unreachable here, see below
 * ```
 *
 * ⭐ **So P5a is the same shape P4a was**: the ink that had two owners moves to one module, the
 * objects that paint themselves keep the VexFlow context, and no pixel moves.
 *
 * ## ⛔ What this does NOT take
 *
 * ⛔ **The modifiers** — the time signature and the opening barline — still paint themselves, handed
 * the VexFlow context exactly as `EngravedBeam` hands `drawStems` one. ⭐ **The CLEF no longer does:**
 * P5b (2026-09-02) gave it `EngravedClef` + `engrave/header/clef`, and {@link EngravedStave.addClef}
 * below is what puts one on every stave of the page. ⚠️ The key signature was never among them
 * either — `stave.addKeySignature` is never called in this repo; `KeySignaturePass` draws it.
 *
 * ⭐ So what is left of the header here is the METER and the opening BARLINE's ink — and, for all
 * three, the parent plan's other half: *"`headerInk.ts` already MEASURES what a clef and a meter
 * cost; `Stave` still PLACES them"*. ⛔ P5b took the clef's INK, ⛔ not its PLACEMENT.
 *
 * ⚠️ **A subclass, for the reason `EngravedBeam` and `EngravedStem` are ones.** Every number read
 * below is public API (`getX`, `getWidth`, `getYForLine`, `getNumLines`, `options`) or `protected`
 * and therefore ours by inheritance (`formatted`, `measure`, `modifiers`) — the body is VexFlow's own
 * arithmetic MOVED, ⛔ not rewritten.
 *
 * 🚨🚨 **The group is load-bearing and its class is the seam.** `g.vf-stave path` is what the browser
 * harness (`e2e/harness.ts`) and the spacing census read to find staff lines, and both filter for a
 * `<path>` with exactly two points at equal y. ⛔ So the lines must stay STROKED PATHS inside a group
 * opened as `openGroup('stave', …)` — which is why {@link drawStaffLines} strokes rather than filling,
 * even though a filled bar is the honester description of the ink.
 */
import { Stave, StaveModifierPosition } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { STAVE_LINE_WIDTH_PX, drawStaffLines, staffLinesInk } from '@/engine/engrave/staff/staffLines'
import { EngravedClef } from './EngravedClef'

export class EngravedStave extends Stave {
  /**
   * The surface this stave's lines draw on — `RenderPass.context`, which is the recorder during a
   * `recordScene` render and the real painter otherwise. Null until {@link drawStaveInkThrough} sets
   * it, and then the stave falls back to `checkContext()`, so an unset surface is a lost SCENE entry
   * and ⛔ never a lost pixel. (`EngravedBeam.inkSurface` carries the same contract.)
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedStave.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS as of P5a** — the five lines, through our own primitives.
   *
   * ⚠️ The `openGroup` really does come before `format()`, as it does upstream: the group is opened
   * on the id, not on anything the format computes, and moving it would change the SVG's element
   * order for no reason.
   */
  override draw(): void {
    const vex = this.checkContext()
    const surface = this.inkSurface ?? vex
    this.setRendered()

    surface.openGroup('stave', this.getAttribute('id'))
    try {
      if (!this.formatted) this.format()
      drawStaffLines(surface, this.staffLineInk())
    } finally {
      surface.closeGroup()
    }

    for (const modifier of this.modifiers) {
      // ⛔ Still VexFlow's, and given VexFlow's context deliberately — see the header. ⭐ …except
      // the CLEF, which since P5b draws its glyph on OUR surface and is handed it here: the
      // modifier walk is the one place that knows both the stave's surface and its modifiers.
      // ⚠️ `setContext` still happens for every one of them, the clef included — `drawWithStyle`
      // calls `checkContext()` before it calls `draw()`, so a modifier without one throws.
      modifier.setContext(vex)
      modifier.setStave(this)
      if (modifier instanceof EngravedClef) modifier.setInkSurface(surface)
      modifier.drawWithStyle()
    }

    // ⚠️ Transcribed for completeness and ⛔ unreachable in this repo: `setMeasure` is never called,
    // so `measure` is always 0. Kept so that calling it would still draw, rather than silently not.
    if (this.measure > 0) {
      vex.setFont(this.fontInfo)
      const textWidth = vex.measureText('' + this.measure).width
      vex.fillText('' + this.measure, this.getX() - textWidth / 2, this.getYForTopText(0) + 3)
    }
  }

  /**
   * ⭐⭐ **P5b — every clef this stave carries is one of OURS.**
   *
   * ⚠️ `Stave.addClef` hard-codes `new Clef(...)`, so this is the only way to substitute the
   * subclass without touching the six call sites that add a clef. The body is VexFlow's own
   * (`stave.js:321`) with that one word changed — `clef`/`endClef` are `protected` and therefore
   * ours to keep writing, and `getClef()` must keep answering or the header's own layout stops
   * working.
   *
   * ⭐ **The GHOST and GUTTER staves are deliberately not affected**: they are plain `Stave`s
   * (`GhostRenderer`, `GutterRenderer`), so they keep VexFlow's clef exactly as they keep VexFlow's
   * staff lines after P5a. A preview is not the page.
   */
  override addClef(clef: string, size?: string, annotation?: string, position?: number): this {
    if (position === undefined || position === StaveModifierPosition.BEGIN) {
      this.clef = clef
    } else if (position === StaveModifierPosition.END) {
      this.endClef = clef
    }
    this.addModifier(new EngravedClef(clef, size, annotation), position)
    return this
  }

  /**
   * Every visible line of this stave, as ink. ⚠️ `lineConfig[line].visible` is VexFlow's own per-line
   * switch and is honoured here for the reason the rest of the body is transcribed rather than
   * simplified: an invisible line is a feature of the object we are subclassing, not a case we get
   * to drop. ⭐ It is what a one-line percussion staff would use.
   */
  private staffLineInk() {
    const ys: number[] = []
    for (let line = 0; line < this.options.numLines; line++) {
      if (this.options.lineConfig[line].visible) ys.push(this.getYForLine(line))
    }
    return staffLinesInk(this.getX(), this.getWidth(), ys, STAVE_LINE_WIDTH_PX)
  }
}

/**
 * Point every stave of a render at the surface its lines draw on, before they are drawn — the twin
 * of `EngravedBeam`'s `drawBeamInkThrough`, and it exists for the same reason: `stave.setContext()`
 * gets the real `SVGContext`, as it must while the modifiers still paint themselves, and a stave that
 * took its lines' surface from there would be invisible to `recordScene`.
 */
export function drawStaveInkThrough(staves: readonly Stave[], ctx: DrawContext): void {
  for (const stave of staves) {
    if (stave instanceof EngravedStave) stave.setInkSurface(ctx)
  }
}
