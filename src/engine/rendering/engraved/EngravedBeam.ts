/**
 * ⭐⭐ **A BEAM — OURS, ⛔ no longer a VexFlow `Beam`** (S7e of `docs/history/vexflow-removal-map.md`;
 * `docs/plans/beam-engraving-plan.md`, `docs/plans/own-engraving-engine.md` P4).
 *
 * Every answer a beam gives is an `engrave/beams/` rule:
 *
 * | question | rule | since |
 * |---|---|---|
 * | how steep it may be | `beamSlope` (HIS open table) | P4b |
 * | which slope it takes | `beamSlopeFit` | S7a |
 * | how far each stem runs to meet it | `beamedStems` | S7b |
 * | where its first line stands | the first stem's tip ({@link EngravedBeam.getBeamYToDraw}) | S7c |
 * | which x's each line runs between | `beamLineSpans` | S7d |
 * | which way an interior fractional beam points | `fractionalBeam` ({@link applyFractionalBeamSides}) | P4c |
 * | the quads | `beamLines` | P4a |
 *
 * ## ⚠️ What still touches VexFlow, and why
 *
 * - **The NOTES are VexFlow's** (`StaveNote`, until S12), and a note must be TOLD it is beamed:
 *   `StaveNote.draw` skips its stem and flag while `note.beam` is set, and `StemmableNote.postFormat`
 *   calls `beam.postFormat()`. Those two — truthiness and `postFormat` — are all VexFlow asks of a beam
 *   (`ScoreRenderer`'s `PLACEHOLDER_BEAM` has relied on exactly that since the fan), so the note is
 *   handed THIS object through `setBeam`, cast to the type its signature names.
 * - **The STEMS are drawn here, as VexFlow's beam drew them**: a beamed note's stem belongs to the beam.
 *   Each is an `EngravedStem` whose ink is ours (P3c); it still takes VexFlow's context to hang its
 *   style on, which is why {@link EngravedBeam.setContext} exists.
 *
 * ⛔ VexFlow's `flatBeams`, stemlets, `secondaryBreakTicks`, `autoStem` and tablature branches are not
 * carried: nothing in this editor reaches them.
 */
import type { EngravedNote } from './EngravedNote'
import { ticksValue } from '@/engine/layout/tickCount'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { FractionalBeamSide, NoteDuration } from '@/types/music'
import type { Fraction } from '@/utils/fraction'
import { type BeamLineInk, beamLevelY, beamLineStartX, drawBeamLines } from '@/engine/engrave/beams/beamLines'
import { type BeamShape, beamRiseCap } from '@/engine/engrave/beams/beamSlope'
import { type BeamSlopeNote, beamLineYAt, fitBeamSlope } from '@/engine/engrave/beams/beamSlopeFit'
import { beamedStemExtension } from '@/engine/engrave/beams/beamedStems'
import {
  type BeamLineSpan, type BeamSide, FRACTIONAL_BEAM_LENGTH_PX, TICKS_PER_WHOLE, beamLineSpans,
} from '@/engine/engrave/beams/beamLineSpans'
import { stemThicknessPx } from '@/engine/engrave/inheritedDefaults'
import { fractionalBeamSides } from '@/engine/engrave/beams/fractionalBeam'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { noteLineY } from '@/engine/engrave/staff/staffFrame'
import { requireNoteFrame } from '../staff/staveFrame'
import { armedBeamSlopeRule } from '../beams/beamSlopeExperiment'
import { crossSystemBeamWidth } from '../beams/beamInk'

/**
 * The context VexFlow's own stems still draw on — named through the note's own `setContext`, so this
 * file never spells VexFlow's context type (`npm run lint:paint`).
 */
type StemContext = DrawContext

/** VexFlow's `PartialBeamDirection` letters, for {@link applyFractionalBeamSides}. */
/** A stem pointing down — VexFlow's `Stem.DOWN`. */
const STEM_DOWN = -1
const BEAM_LEFT = 'L'
const BEAM_RIGHT = 'R'

/**
 * The beam levels, in order — VexFlow's `validBeamDurations`, kept verbatim. Index IS the level, and
 * each name is the note value a note must be SHORTER than to carry that line
 * (`engrave/beams/beamLineSpans`): `'4'` is the PRIMARY beam, `'8'` the first secondary, and so on.
 * ⚠️ `'32'` and `'64'` would need 64ths and 128ths, which this editor does not write, so they draw nothing.
 */
const VALID_BEAM_DURATIONS = ['4', '8', '16', '32', '64']

/**
 * ⭐ VexFlow ends a beam quad ONE PIXEL past the x it computed the slope at
 * (`beam.js`: `ctx.lineTo(lastBeamX + 1, …)` while `lastBeamY` comes from `lastBeamX`). ⛔ Kept, and
 * kept HERE rather than in `engrave/`: it is a fudge that closes the seam where a beam meets its
 * last stem, not a rule anyone would state — and P4a moves no pixel.
 */
const BEAM_END_OVERSHOOT = 1

let lastBeamId = 0

export class EngravedBeam {
  /** The beamed notes, in order. */
  readonly notes: readonly EngravedNote[]

  /** Its SVG group's id — ours, ⛔ not VexFlow's id counter. */
  readonly id: string

  /**
   * ⭐ One beam line's thickness, in px — Bravura's `beamThickness`, half a space, which is the 5
   * VexFlow's `renderOptions.beamWidth` defaulted to (`./beamInk`).
   */
  readonly beamWidth = crossSystemBeamWidth()

  /** Rise over run, solved by {@link calculateSlope}. */
  slope = 0

  /** How far the line was moved off the first stem's tip to clear an inner stem — VexFlow's `yShift`. */
  lift = 0

  /**
   * ⭐ CROSS-STAFF (docs/plans/cross-staff-plan.md Phase 4): the staff LINE this beam stands on,
   * when its notes are written on two staves — decided by `engrave/beams/crossStaffBeam` before the
   * formatter ran. Set ⇒ the line is HORIZONTAL at that height and the slope search does not run;
   * the stems then meet it by the ordinary rule, which already lengthens a stem pointing AGAINST its
   * beam (`engrave/beams/beamedStems`). `null` for every other beam.
   */
  private crossStaffLine: number | null = null

  /** Fixed at construction, from the first note, as VexFlow's beam fixed it. */
  private readonly stemDirection: number

  private postFormatted = false

  /** @see setContext */
  private stemContext: StemContext | null = null

  /**
   * The surface this beam's own ink draws on — `RenderPass.context`, which is the recorder during a
   * `recordScene` render and the real painter otherwise. Null until {@link drawBeamInkThrough} sets
   * it, and then the beam falls back to the stems' context, so an unset surface is a lost SCENE
   * entry and ⛔ never a lost pixel. (`EngravedNote.inkSurface` carries the same contract.)
   */
  private inkSurface: DrawContext | null = null

  /** Where the secondary beams break, and each interior fractional beam's side (S7d). */
  private secondaryBreaks: readonly number[] = []
  private readonly forcedSides = new Map<number, BeamSide>()

  /**
   * VexFlow's three refusals, kept — the renderer catches them and draws the notes unbeamed.
   * ⚠️ Every note is told it is beamed BEFORE anything else reads it, as VexFlow did.
   */
  constructor(notes: EngravedNote[]) {
    if (!notes || notes.length === 0) throw new Error('BadArguments: No notes provided for beam.')
    if (notes.length === 1) throw new Error('BadArguments: Too few notes for beam.')
    if (notes[0].getIntrinsicTicks() >= TICKS_PER_WHOLE / 4) {
      throw new Error('BadArguments: Beams can only be applied to notes shorter than a quarter note.')
    }
    this.stemDirection = notes[0].getStemDirection()
    // ⚠️ The cast is the note's signature, ⛔ not a claim: VexFlow reads only truthiness and
    // `postFormat()` off it (see the header).
    for (const note of notes) note.setBeam(this)
    this.notes = notes
    lastBeamId += 1
    this.id = `beam${lastBeamId}`
  }

  getStemDirection(): number {
    return this.stemDirection
  }

  /** The VexFlow context the STEMS draw on — see the header. */
  setContext(ctx: StemContext): this {
    this.stemContext = ctx
    return this
  }

  /** @see EngravedBeam.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /** @see crossStaffLine */
  standOnLine(line: number): this {
    this.crossStaffLine = line
    return this
  }

  breakSecondaryAt(indexes: number[]): this {
    this.secondaryBreaks = [...indexes]
    return this
  }

  setPartialBeamSideAt(noteIndex: number, side: BeamSide): this {
    this.forcedSides.set(noteIndex, side)
    return this
  }

  /**
   * The slope, then the stems — once. ⭐ Also what a note's own `postFormat` calls on its beam.
   */
  postFormat(): void {
    if (this.postFormatted) return
    this.calculateSlope()
    this.applyStemExtensions()
    this.postFormatted = true
  }

  /**
   * 🚨 **What the element registry files for a beam — a ZERO-SIZE box at `(0, lift)`, kept exactly.**
   * It is what VexFlow's generic `Element.getBoundingBox()` answered for a beam, which sets none of
   * `x`, `width` or `height` and whose `yShift` IS the lift (measured: an empty text's ascent is 0 in
   * jsdom and in Chromium). ⏸️ What a beam's box SHOULD be is `docs/history/vexflow-removal-map.md` §9.4 #2.
   */
  getBoundingBox(): { x: number; y: number; w: number; h: number } {
    return { x: 0, y: this.lift, w: 0, h: 0 }
  }

  /**
   * ⭐⭐ **S7a — THE SLOPE**: `engrave/beams/beamSlopeFit` searches, inside the BUDGET
   * `engrave/beams/beamSlope` allows (P4b — ⛔ **which rule that is stays open**, his call; see that
   * module's header).
   *
   * ⭐ **A BUDGET, ⛔ not a slope.** The search runs inside it, which is what keeps the behaviour a
   * bound cannot express: a beam is never left cutting through an inner note's stem, because the
   * search still prefers the cheapest total stem extension.
   *
   * ⚠️ Runs BEFORE {@link applyStemExtensions} moves the stem tips, which is the moment
   * {@link beamShape} and the search both need.
   */
  private calculateSlope(): void {
    if (this.crossStaffLine !== null) {
      // The line is given; `lift` is what carries it, because the stem rule and the ink both read
      // the line as "the first stem's tip, plus the lift".
      this.slope = 0
      this.lift = noteLineY(requireNoteFrame(this.notes[0]), this.crossStaffLine) - this.stems()[0].tipY
      return
    }
    const stemDirection = this.stemDirection
    // ⚠️ Read ONCE, before the stems are lengthened — the shape and the search both want these tips.
    const notes = this.stems()
    const shape = this.beamShape(stemDirection, notes)
    // ⭐ `armedBeamSlopeRule()` and ⛔ not the module default: WHICH rule is an open question, and
    // `./beamSlopeExperiment` is the knob his console arms it with (`__beams.rule(…)`).
    const range = shape.widthSpaces > 0
      ? beamRiseCap(shape, armedBeamSlopeRule()) / shape.widthSpaces
      : 0
    const { slope, lift } = fitBeamSlope({ stemDirection, notes, range })
    this.slope = slope
    this.lift = lift
  }

  /**
   * ⭐⭐ **S7b — EVERY STEM MEETS THE BEAM**: `engrave/beams/beamedStems` answers each stem's new
   * extension from the line {@link calculateSlope} solved. `adjustHeightForBeam` is the STEM's own
   * state and stays its call.
   */
  private applyStemExtensions(): void {
    // ⚠️ Read up front, which VexFlow did note by note: exact, because lengthening one note's stem
    // moves no other note's tip — and the line's first y IS the first tip, read before any change.
    const stems = this.stems()
    const line = {
      firstStemX: stems[0].stemX,
      firstY: this.getBeamYToDraw(),
      slope: this.slope,
      lift: this.lift,
      stemDirection: this.stemDirection,
      beamWidth: this.beamWidth,
    }
    for (const reading of stems) {
      const { stem } = reading
      if (!stem) continue
      stem.setExtension(beamedStemExtension({ ...reading, extension: stem.getExtension() }, line))
      stem.adjustHeightForBeam()
    }
  }

  /**
   * ⭐⭐ **S7d — WHICH X'S EACH LINE RUNS BETWEEN**: `engrave/beams/beamLineSpans`, fed the breaks and
   * fractional sides this beam was told. ⚠️ `duration` is the level's name — the note value a note
   * must be SHORTER than to carry the line (`'4'` is the primary beam).
   */
  private getBeamLines(duration: string): BeamLineSpan[] {
    return beamLineSpans({
      notes: this.notes.map(note => ({
        lineX: beamLineStartX(note.getStemX(), stemThicknessPx()),
        ticks: ticksValue(note.getTicks()),
        intrinsicTicks: note.getIntrinsicTicks(),
      })),
      levelDenominator: Number(duration),
      breakIndexes: this.secondaryBreaks,
      forcedSides: this.forcedSides,
      fractionalLength: FRACTIONAL_BEAM_LENGTH_PX,
    })
  }

  /**
   * ⭐ **S7c — where the beam's first line stands: ON THE FIRST STEM'S TIP**, read fresh. Before
   * {@link applyStemExtensions} that is the tip the slope was solved from; after it, the tip the stem
   * was lengthened to — which is what the drawn quads and the cross-bar overhang anchor on.
   */
  getBeamYToDraw(): number {
    return this.notes[0].getStemExtents().topY
  }

  /**
   * ⭐ Everything the slope search and the stem rule ask of each note, in ONE place — read fresh on
   * every call, ⛔ never kept: the stems move between the two questions.
   */
  private stems() {
    return this.notes.map(note => ({
      stem: note.getStem(),
      stemX: note.getStemX(),
      tipY: note.getStemExtents().topY,
      counts: note.hasStem() || note.isRest(),
      stemDirection: note.getStemDirection(),
      beamLevels: note.getBeamCount(),
    }))
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
  private beamShape(
    stemDirection: number,
    stems: readonly (BeamSlopeNote & { beamLevels: number })[],
  ): BeamShape {
    const first = this.notes[0]
    const last = this.notes[this.notes.length - 1]
    const firstStem = stems[0]
    const lastStem = stems[stems.length - 1]
    const up = stemDirection !== STEM_DOWN
    return {
      intervalSteps: Math.abs(last.getLineNumber(up) - first.getLineNumber(up)) * 2,
      widthSpaces: Math.abs(lastStem.stemX - firstStem.stemX) / STAFF_SPACE_PX,
      noteCount: this.notes.length,
      // ⭐ The two outer stem TIPS as they stand before any slope is solved — VexFlow's own
      // `getStemSlope`, which reads exactly this pair (`beam.js`).
      naturalRiseSpaces: Math.abs(lastStem.tipY - firstStem.tipY) / STAFF_SPACE_PX,
      // VexFlow's `getBeamCount`: the most lines any note carries.
      beamCount: stems.map(s => s.beamLevels).reduce((max, n) => (n > max ? n : max)),
    }
  }

  /**
   * ⭐ The stems, then the lines, inside the beam's own group.
   *
   * 🚨 **The group is load-bearing**: the browser suite and the renderer find a beam's ink — and the
   * beamed stems inside it — as `g.beam`, so keep `openGroup('beam', id)`.
   *
   * ⚠️ **The stems keep the VexFlow context and that is deliberate**: each is handed it, and an
   * `EngravedStem` draws on its own ink surface anyway (P3c).
   */
  draw(): void {
    const stemCtx = this.stemContext
    if (!stemCtx) throw new Error('NoContext: No rendering context attached to the beam.')
    const surface = this.inkSurface ?? stemCtx
    if (!this.postFormatted) this.postFormat()

    surface.openGroup('beam', this.id)
    try {
      this.drawStems(stemCtx)
      drawBeamLines(surface, this.beamLineInk(), this.beamThickness())
    } finally {
      surface.closeGroup()
    }
  }

  /** VexFlow's `Beam.drawStems`: each stem is told its head x, then draws itself with its style. */
  private drawStems(ctx: StemContext): void {
    for (const note of this.notes) {
      const stem = note.getStem()
      if (!stem) continue
      const stemX = note.getStemX()
      stem.setNoteHeadXBounds(stemX, stemX)
      stem.setContext(ctx).drawWithStyle()
    }
  }

  /** ⚠️ SIGNED by the stem direction — a stem-down beam stacks upward, and the sign carries it. */
  private beamThickness(): number {
    return this.beamWidth * this.stemDirection
  }

  /**
   * Every line of this beam, as ink — VexFlow's `drawBeamLines` loop with the four `ctx` calls
   * lifted out. The x's come from {@link getBeamLines}, the y's from the slope this beam solved.
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
          startY: beamLineYAt(firstStemX, beamY, this.slope, startX),
          // ⭐ The slope is read at `endX`; only the drawn vertex overshoots — see the constant.
          endX: endX + BEAM_END_OVERSHOOT,
          endY: beamLineYAt(firstStemX, beamY, this.slope, endX),
        })
      }
    }
    return lines
  }
}

/**
 * ⭐⭐ **P4c — TELL THE BEAM WHICH WAY ITS FRACTIONAL BEAMS POINT**
 * (`docs/research/beam-hook-research.md`; the rule itself is `engrave/beams/fractionalBeam`).
 *
 * ⚠️ **This is a TRANSLATION and nothing else** — the metre is the editor's and the rule is the
 * engine's; what happens here is the one step between them, exactly as `interactions/state/toolGhost.ts`
 * translates an armed tool into `ghostTypes`. ⛔ No engraving decision is taken in this function.
 *
 * ## ⭐ Why `setPartialBeamSideAt` is enough, and ⛔ NOT a half-measure
 *
 * `setPartialBeamSideAt` hands the side to the line walk (`engrave/beams/beamLineSpans`, VexFlow's
 * `getBeamLines` transcribed), which consults it **first** — but only on the `beamAlone` branch, i.e. a note alone at its beam level *between two
 * notes that both lack that level*. That looks like a gap until you ask what the other branches are:
 *
 * | case | who decides | why it is not ours to choose |
 * |---|---|---|
 * | **first** note of a group | VexFlow ⇒ right | ⭐ forced — a left stub would leave the group, and Ross p. 124 / Gerou & Lusk p. 31 both say *"always inside the grouping"* |
 * | **last** note of a group | VexFlow ⇒ left | ⭐ forced, same rule, mirrored |
 * | after a secondary BREAK | the walk ⇒ right | that break is already OUR decision (`secondaryBreakIndices`). 🚨 ⏸️ But the note BEFORE a break points LEFT even when it is the group's first — `docs/history/vexflow-removal-map.md` §9.4 #1 |
 * | **interior**, alone at its level | ⭐⭐ **US** | the only case where the metre has a free choice — and it is exactly Gould's |
 *
 * ⇒ **the hatch covers every case the books actually legislate.** `fractionalBeamSides` answers
 * `null` for the first and last slots for this reason, so the two agree by construction rather than
 * by luck.
 *
 * ⭐ `getBeamLines` is ours since S7d (`engrave/beams/beamLineSpans`), and it still reads the side only
 * for an interior note: a stub *outside* its group is the thing Gould's p. 157 *"and not"* figure is
 * rejected for.
 */
export function applyFractionalBeamSides(beam: EngravedBeam, slots: readonly FractionalBeamSlot[]): void {
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
 */
export function drawBeamInkThrough(beams: readonly EngravedBeam[], ctx: DrawContext): void {
  for (const beam of beams) beam.setInkSurface(ctx)
}
