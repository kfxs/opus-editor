/**
 * ⭐⭐ **THE SEAM WHERE THE BEAM'S INK COMES BACK TO US — P4a**
 * (`docs/beam-engraving-plan.md`, `docs/own-engraving-engine.md` P4).
 *
 * `Beam.draw()` is two things in a fixed order — **the stems**, then **the lines**:
 *
 * ```js
 * ctx.openGroup('beam', id)
 * this.drawStems(ctx)      // ← each note's own Stem, already OURS since P3c (`EngravedStem`)
 * this.drawBeamLines(ctx)  // ← P4a: the quads, now `engrave/beams/beamLines`
 * ctx.closeGroup()
 * ```
 *
 * ⭐ **So P4a is smaller than it looks, and that is the point of doing P3 first**: a beamed note's
 * stem is drawn by the BEAM rather than by the note (`StaveNote.draw` skips a stem whose `beam` is
 * set), and P3c already moved that ink into `engrave/notes/stem` via the `Stem` subclass. What was
 * left of a beam was the quads.
 *
 * ## ⛔ What this does NOT take, and it is the larger half
 *
 * ⛔ **Which x's a beam line runs between** (`getBeamLines` — the partial beams and hooks) and
 * ⛔ **what SLOPE it takes** (`calculateSlope`, `getBeamYToDraw`) are still VexFlow's, called as
 * public API. `own-engraving-engine.md` §6.1 names beam hooks among the places *"where we currently
 * have no opinion"*, and its rule is that a re-implementation without an opinion is strictly worse
 * than a dependency. ⭐ `docs/beaming.md` states this editor's GROUPING rules and they are already
 * ours; the SHAPE of the drawn line is the research still owed.
 *
 * ⚠️ **A subclass, for the reason `EngravedStem` is one**: `drawBeamLines` is `protected` and takes
 * VexFlow's `RenderContext`, so an override could not be typed without naming that type — which is
 * the one thing `npm run lint:paint` refuses outside its allowlist. Overriding the public `draw()`
 * instead keeps the adapter honest: every number it reads (`notes`, `slope`, `renderOptions`,
 * `getBeamLines`, `getSlopeY`, `getBeamYToDraw`) is public, and the body below is VexFlow's own
 * arithmetic moved rather than rewritten.
 */
import { Beam } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { type BeamLineInk, beamLevelY, drawBeamLines } from '@/engine/engrave/beams/beamLines'

/**
 * The durations a beam level exists for, in level order — VexFlow's `validBeamDurations`, kept
 * verbatim. Index IS the level: `'8'` is the primary beam, `'16'` the first secondary, and so on.
 * ⚠️ `'4'` is in the list and draws nothing; it is there so the levels line up with the durations.
 */
const VALID_BEAM_DURATIONS = ['4', '8', '16', '32', '64']

/**
 * ⭐ VexFlow ends a beam quad ONE PIXEL past the x it computed the slope at
 * (`beam.js`: `ctx.lineTo(lastBeamX + 1, …)` while `lastBeamY` comes from `lastBeamX`). ⛔ Kept, and
 * kept HERE rather than in `engrave/`: it is a fudge that closes the seam where a beam meets its
 * last stem, not a rule anyone would state — and P4a moves no pixel.
 */
const BEAM_END_OVERSHOOT = 1

export class EngravedBeam extends Beam {
  /**
   * The surface this beam's own ink draws on — `RenderPass.context`, which is the recorder during a
   * `recordScene` render and the real painter otherwise. Null until {@link drawBeamInkThrough} sets
   * it, and then the beam falls back to `checkContext()`, so an unset surface is a lost SCENE entry
   * and ⛔ never a lost pixel. (`EngravedNote.inkSurface` carries the same contract.)
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedBeam.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS as of P4a** — the lines, drawn through our own primitives.
   *
   * 🚨🚨 **The group is load-bearing and its ID is the seam**, exactly as it was for the stem: the
   * element registry files a beam's hit box from `getBoundingBox()`, and `Element.getSVGElement()`
   * resolves ink by `document.getElementById(prefix(id))`. ⛔ So this must open
   * `openGroup('beam', this.getAttribute('id'))` exactly as VexFlow did.
   *
   * ⚠️ **The stems keep the VexFlow context and that is deliberate**: `drawStems` hands it to each
   * `Stem`, and an {@link EngravedStem} ignores it in favour of its own ink surface anyway
   * (P3c). A plain `Stem` — nothing builds one here today — would still paint correctly.
   *
   * ⛔ VexFlow's `if (this.unbeamable) return` is NOT transcribed: the field is `private`, and in
   * VexFlow 5 it is declared and never assigned (`private unbeamable?` in `beam.d.ts`, written
   * nowhere in `beam.js`), so the guard is dead upstream. Reproducing it would mean casting to read
   * a field that is always `undefined`.
   */
  override draw(): void {
    const vex = this.checkContext()
    const surface = this.inkSurface ?? vex
    this.setRendered()
    if (!this.postFormatted) this.postFormat()

    surface.openGroup('beam', this.getAttribute('id'))
    try {
      this.drawStems(vex)
      drawBeamLines(surface, this.beamLineInk(), this.beamThickness())
    } finally {
      surface.closeGroup()
    }
  }

  /** ⚠️ SIGNED by the stem direction — a stem-down beam stacks upward, and the sign carries it. */
  private beamThickness(): number {
    return this.renderOptions.beamWidth * this.getStemDirection()
  }

  /**
   * Every line of this beam, as ink — VexFlow's `drawBeamLines` loop with the four `ctx` calls
   * lifted out. ⛔ Nothing here is a rule of ours: the x's come from `getBeamLines`, the y's from
   * the slope this beam already solved.
   */
  private beamLineInk(): BeamLineInk[] {
    const firstStemX = this.notes[0].getStemX()
    const thickness = this.beamThickness()
    const firstLevelY = this.getBeamYToDraw()
    const lines: BeamLineInk[] = []

    for (let level = 0; level < VALID_BEAM_DURATIONS.length; level++) {
      const beamY = beamLevelY(firstLevelY, level, thickness)
      for (const line of this.getBeamLines(VALID_BEAM_DURATIONS[level])) {
        const { start: startX, end: endX } = line
        // VexFlow's own guard, falsy check included (`if (lastBeamX)` … else throw).
        if (!endX) throw new Error('NoLastBeamX: lastBeamX undefined.')
        lines.push({
          startX,
          startY: this.getSlopeY(startX, firstStemX, beamY, this.slope),
          // ⭐ The slope is read at `endX`; only the drawn vertex overshoots — see the constant.
          endX: endX + BEAM_END_OVERSHOOT,
          endY: this.getSlopeY(endX, firstStemX, beamY, this.slope),
        })
      }
    }
    return lines
  }
}

/**
 * Point every beam of a bar at the surface its own ink draws on, before they are drawn — the twin of
 * `EngravedNote`'s `drawNoteInkThrough`, and it exists for the same reason: `beam.setContext()` gets
 * the real `SVGContext`, as it must while VexFlow's `draw()` still owns the stems, and a beam that
 * took its quads' surface from there would be invisible to `recordScene`.
 *
 * Takes `Beam[]` because that is what every caller holds.
 */
export function drawBeamInkThrough(beams: readonly Beam[], ctx: DrawContext): void {
  for (const beam of beams) {
    if (beam instanceof EngravedBeam) beam.setInkSurface(ctx)
  }
}
