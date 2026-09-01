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
 * ⛔ **Which x's a beam line runs between** (`getBeamLines`) and ⛔ **what SLOPE it takes**
 * (`calculateSlope`, `getBeamYToDraw`) are still VexFlow's, called as public API.
 *
 * ⭐⭐ **…except the fractional beams' SIDE, which is ours as of P4c** — the opinion §6.1 of
 * `own-engraving-engine.md` said we did not have is now written down (`docs/beam-hook-research.md`:
 * four treatises, unanimous) and supplied through `setPartialBeamSideAt` by
 * {@link applyFractionalBeamSides}. ⛔ The LENGTH of a stub is still VexFlow's `partialBeamLength`
 * and is still wrong by every source — decision A of that document's §8, and HIS.
 * ⭐ `docs/beaming.md` states this editor's GROUPING rules and they were already ours.
 *
 * ⚠️ **A subclass, for the reason `EngravedStem` is one**: `drawBeamLines` is `protected` and takes
 * VexFlow's `RenderContext`, so an override could not be typed without naming that type — which is
 * the one thing `npm run lint:paint` refuses outside its allowlist. Overriding the public `draw()`
 * instead keeps the adapter honest: every number it reads (`notes`, `slope`, `renderOptions`,
 * `getBeamLines`, `getSlopeY`, `getBeamYToDraw`) is public, and the body below is VexFlow's own
 * arithmetic moved rather than rewritten.
 */
import { Beam, Stem } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { FractionalBeamSide, NoteDuration } from '@/types/music'
import type { Fraction } from '@/utils/fraction'
import { type BeamLineInk, beamLevelY, drawBeamLines } from '@/engine/engrave/beams/beamLines'
import { type BeamShape, beamRiseCap } from '@/engine/engrave/beams/beamSlope'
import { fractionalBeamSides } from '@/engine/engrave/beams/fractionalBeam'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { armedBeamSlopeRule } from './beamSlopeExperiment'

/**
 * VexFlow's `PartialBeamDirection` values. ⚠️ Written as literals because `BEAM_LEFT`/`BEAM_RIGHT`
 * are declared in `beam.js` but ⛔ **not re-exported from the package root** — `require('vexflow')`
 * has no such key. The literal union is what `setPartialBeamSideAt` takes, so this still typechecks
 * against their type rather than around it.
 */
const BEAM_LEFT = 'L'
const BEAM_RIGHT = 'R'

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

/**
 * 🚨🚨 **A FLAT BEAM IS A RANGE NARROWER THAN A PIXEL — ⛔ NEVER A RANGE OF ZERO.**
 *
 * VexFlow searches for its slope with `for (s = minSlope; s <= maxSlope; s += (maxSlope - minSlope) / 20)`.
 * ⇒ if the two bounds are equal the increment is **0** and that loop **never terminates** — a frozen
 * tab, no error, nothing in the console. A unison's budget is legitimately zero (`INTERVAL_QUARTERS[0]`),
 * so this case is reached by ordinary music, not by a bug.
 */
const FLAT_SLOPE_RANGE = 1e-6

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
   * ⭐⭐ **P4b — THE SLOPE'S BUDGET.** The one place VexFlow's solver is told how steep this beam may
   * be; the rule that decides it is `engrave/beams/beamSlope`, and ⛔ **which rule that is stays
   * open** (his call — see that module's header).
   *
   * ⭐ **A BUDGET, ⛔ not a slope.** We narrow `minSlope`/`maxSlope` and let VexFlow's own cost search
   * run inside them, which is what keeps the behaviour a bound cannot express: a beam is never left
   * cutting through an inner note's stem, because that search still prefers the cheapest total stem
   * extension. ⇒ ⭐ the whole of P4b is *"tell the existing solver a smaller room"*.
   *
   * ⚠️ Here rather than in `calculateSlope()` because the budget needs the formatted x's, and
   * `postFormat` is the last moment before the slope is solved. The `postFormatted` guard is
   * VexFlow's own, repeated so that the shape is not measured twice.
   */
  override postFormat(): void {
    if (this.postFormatted) return
    if (this.notes.length >= 2) {
      const shape = this.beamShape()
      // ⭐ `armedBeamSlopeRule()` and ⛔ not the module default: WHICH rule is an open question, and
      // `./beamSlopeExperiment` is the knob his console arms it with (`__beams.rule(…)`).
      const cap = shape.widthSpaces > 0
        ? beamRiseCap(shape, armedBeamSlopeRule()) / shape.widthSpaces
        : 0
      const range = Math.max(cap, FLAT_SLOPE_RANGE)
      this.renderOptions.maxSlope = range
      this.renderOptions.minSlope = -range
    }
    super.postFormat()
  }

  /**
   * What this beam looks like to a slope rule — the adapter's whole job, and the reason
   * `engrave/beams/beamSlope` needs no VexFlow.
   *
   * ⚠️ **The interval is read from the notes NEAREST THE BEAM** (`getLineNumber(up)`), ⛔ not from
   * their outer pitches: a chord's beam is decided by the head the stem's tip belongs to, which is
   * the same choice MuseScore makes (`closestChordsToBeam`). ⚠️ `line` is in VexFlow's units where
   * **1 = a whole space = two diatonic steps**, hence the doubling.
   */
  private beamShape(): BeamShape {
    const first = this.notes[0]
    const last = this.notes[this.notes.length - 1]
    const up = this.getStemDirection() !== Stem.DOWN
    return {
      intervalSteps: Math.abs(last.getLineNumber(up) - first.getLineNumber(up)) * 2,
      widthSpaces: Math.abs(last.getStemX() - first.getStemX()) / STAFF_SPACE_PX,
      noteCount: this.notes.length,
      // ⭐ The two outer stem TIPS as they stand before any slope is solved — VexFlow's own
      // `getStemSlope`, which reads exactly this pair (`beam.js`). ⚠️ Valid here and not later:
      // `super.postFormat()` is about to move them.
      naturalRiseSpaces:
        Math.abs(last.getStemExtents().topY - first.getStemExtents().topY) / STAFF_SPACE_PX,
      beamCount: this.getBeamCount(),
    }
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
 * ⭐⭐ **P4c — TELL THE BEAM WHICH WAY ITS FRACTIONAL BEAMS POINT**
 * (`docs/beam-hook-research.md`; the rule itself is `engrave/beams/fractionalBeam`).
 *
 * ⚠️ **This is a TRANSLATION and nothing else** — the metre is the editor's and the rule is the
 * engine's; what happens here is the one step between them, exactly as `interactions/toolGhost.ts`
 * translates an armed tool into `ghostTypes`. ⛔ No engraving decision is taken in this function.
 *
 * ## ⭐ Why `setPartialBeamSideAt` is enough, and ⛔ NOT a half-measure
 *
 * `Beam.setPartialBeamSideAt` is public API (`beam.js:340`) and `lookupBeamDirection` consults it
 * **first** — but only on the `beamAlone` branch, i.e. a note alone at its beam level *between two
 * notes that both lack that level*. That looks like a gap until you ask what the other branches are:
 *
 * | case | who decides | why it is not ours to choose |
 * |---|---|---|
 * | **first** note of a group | VexFlow ⇒ right | ⭐ forced — a left stub would leave the group, and Ross p. 124 / Gerou & Lusk p. 31 both say *"always inside the grouping"* |
 * | **last** note of a group | VexFlow ⇒ left | ⭐ forced, same rule, mirrored |
 * | after a secondary BREAK | VexFlow ⇒ right | that break is already OUR decision (`secondaryBreakIndices`) |
 * | **interior**, alone at its level | ⭐⭐ **US** | the only case where the metre has a free choice — and it is exactly Gould's |
 *
 * ⇒ **the hatch covers every case the books actually legislate.** `fractionalBeamSides` answers
 * `null` for the first and last slots for this reason, so the two agree by construction rather than
 * by luck.
 *
 * ⛔ Owning `getBeamLines` outright would buy only the ability to draw a stub *outside* its group,
 * which is the thing Gould's p. 157 *"and not"* figure is rejected for.
 */
export function applyFractionalBeamSides(beam: Beam, slots: readonly FractionalBeamSlot[]): void {
  const auto = fractionalBeamSides(
    slots.map(slot => ({
      start: slot.beat,
      duration: slot.duration,
      dots: slot.dots,
      actualLength: slot.actualDuration,
      isRest: slot.type === 'rest',
    })),
  )
  slots.forEach((slot, i) => {
    // ⭐ THE AUTHORED SIDE WINS. Absent = auto, exactly as `beam: 'auto'` is absent — so a score that
    // has never been touched by hand is engraved entirely by the metric rule.
    const side = slot.fractionalBeamSide ?? auto[i]
    if (side) beam.setPartialBeamSideAt(i, side === 'left' ? BEAM_LEFT : BEAM_RIGHT)
  })
}

/** One slot, as {@link applyFractionalBeamSides} reads it. */
interface FractionalBeamSlot {
  beat: Fraction
  duration: NoteDuration
  dots?: number
  actualDuration?: Fraction
  type: string
  /** ⭐ The user's own choice, from Properties — beats the metric rule when set. */
  fractionalBeamSide?: FractionalBeamSide
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
