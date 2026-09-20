import type { EngravedStave } from '../engraved/EngravedStave'
import { drawGlyph } from '../painter/glyphPainter'
import type { Clef, KeySignature } from '@/types/music'
import type { RenderPass } from '../RenderPass'
import {
  BARLINE_TO_KEY_INK, CLEF_TO_KEY_INK, KEY_ACCIDENTAL_GAP, keySignatureLines, signGlyph,
} from '@/engine/layout/keySignatureLayout'
import { BARLINE_TO_CAUTIONARY_KEY_INK, CAUTIONARY_KEY_TO_LINE_END } from '@/engine/layout/cautionaryKey'
import { clefGlyph, glyphBox, type GlyphName } from '@/engine/fonts/fontMetrics'
import { inStaffSpace } from './staffScaleGroup'
import { drawGroupOf } from '../painter/svgDrawGroup'
import { STAVE_LINE_WIDTH_PX, fillStaffLine, staffLinesInk } from '@/engine/engrave/staff/staffLines'
import { barFrame, placedBarFrame, placedStaffFrame, staveFrame } from './staveFrame'
import {
  noteLineY, staffBottomLineY, staffLineY, type BarFrame, type StaffFrame,
} from '@/engine/engrave/staff/staffFrame'
import type { SignRun } from '@/engine/engrave/staff/signRun'
import { STAFF_BOTTOM_EDGE_PX } from '@/engine/engrave/inheritedDefaults'
import { placedSignRun, signRun } from './signRun'

/**
 * ⭐⭐ **THE KEY SIGNATURE — ours, not VexFlow's** (docs/plans/key-signature-plan.md §4).
 *
 * `stave.addKeySignature` is never called. The reason is the boundary test in
 * `docs/history/vexflow-boundary.md` §4 — *take a decision from VexFlow only when there is a rule we want to
 * state and cannot* — and a signature fails it twice over: a placement table and one spacing gap are
 * rules we can state outright (`engine/layout/keySignatureLayout.ts` states them, with the sources).
 * ⭐ And VexFlow's own `KeySignature` could not draw ours anyway: it is built from a key NAME, so it
 * cannot express a signature mixing a sharp and a flat, nor an authored order, nor a per-sign octave
 * — the three things this model exists to carry.
 *
 * ## Why a score-level PASS rather than ink inside the measure group
 *
 * The same reason `BarlineRenderer` is one: the signature a bar draws depends on the bar BEFORE it
 * (has the key changed across the boundary?) and on the casting-off (is this bar first on its line?),
 * neither of which a per-measure cache key can express. Being outside every measure group, and
 * rebuilt from scratch each render, means no cached `<g>` can hold a stale signature.
 *
 * 🚨 **Positions come from the PLACEMENT, never from the stave.** A bar whose shape has not changed
 * is reused and moved with a transform, so its `Stave` reports where it was last PAINTED — the trap
 * that once stole a grand staff's barlines onto the wrong staff. ⭐ So every position this pass draws
 * at is asked of the PLACED frame and sign run (`./staveFrame`'s header, S4e), exactly as
 * `BarlineRenderer` asks. ⚠️ Only a WIDTH may still come off the built stave ({@link keySignatureInkRight}):
 * a difference of two of its numbers is the same wherever the bar was carried.
 */

/** What this pass needs of a placement — satisfied by `MeasurePlacement`, and deliberately no more. */
export interface KeySignaturePlacement {
  measureNumber: number
  staffIndex: number
  stave: EngravedStave
  /** Where the bar is THIS render (SVG space) — ⛔ not `stave.getX()`. See the header. */
  x: number
  y: number
  /** The staff's drawn scale; `x`/`y` are SVG-space and the stave lives in its own scaled space. */
  scale: number
  clef: Clef
  /** The signature this bar's head draws, absent where it draws none (`headerKeyAt`). */
  headerKey?: KeySignature
  /** ⭐⭐ The CAUTIONARY row this bar draws at its END — a key change lands on the system break after
   *  it, so the cancelling naturals and the new signature are engraved here (Gould p. 93). Absent on
   *  every other bar. See `engine/layout/cautionaryKey.ts`. */
  cautionaryKey?: KeySignature
  /** The bare staff after it, in staff spaces — the engraver's default or the author's
   *  (`cautionaryKeyGapKey`). Absent falls back to {@link CAUTIONARY_KEY_TO_LINE_END}. */
  cautionaryKeyTrailing?: number
  /** The bar's own width, in the stave's space — only the cautionary needs it, to start after this
   *  bar's closing barline. */
  width: number
}

/**
 * The SMuFL codepoints for the signs a signature is made of.
 *
 * ⚠️ Written out rather than taken from VexFlow's `Glyphs` map, which is CJS-only and resolves to
 * `undefined` in the browser build — the same reason `TempoLayout` and `CenteredTremolo` write
 * theirs out. These are standardized codepoints; they do not move.
 *
 * ⛔ Keyed by the same {@link GlyphName}s `fontMetrics` measures, so the glyph that is DRAWN and the
 * advance the room was computed from are the same glyph by construction — not two tables that
 * happen to agree.
 *
 * ⭐ Exported for the GHOST (`./KeySignatureGhost`), which draws the same signs at the pointer: one
 * table, so a preview cannot show a glyph the click will not engrave.
 */
export const SIGN_CHARS: Partial<Record<GlyphName, string>> = {
  accidentalFlat: '\uE260',
  accidentalNatural: '\uE261',
  accidentalSharp: '\uE262',
  accidentalDoubleSharp: '\uE263',
  accidentalDoubleFlat: '\uE264',
}

/**
 * ⭐⭐ **A SIGNATURE'S SIGN IS THE SAME SIZE AS AN ORDINARY ACCIDENTAL — the rule is Gould's, p. 78:**
 * *"An accidental is scaled down in size **only** when placed before a grace note … or a cue note."*
 * ⛔ So there is no "small signature" variant to build, ever
 * (docs/research/key-signature-research.md §9.4.3, first bullet).
 *
 * **30 is how we obey it here**, not a taste call: it is `MetricsDefaults.fontSize`, VexFlow's own
 * default, which its `Accidental` inherits by having no override of its own (only `cautionary` and
 * `grace` override it, both to 20). So our signs and the accidentals beside the noteheads are one
 * size by construction rather than by two numbers agreeing.
 *
 * ⭐ **Two derivations, one answer.** 30 POINTS is 40 px (`Font.scaleToPxFrom.pt = 4/3`), and
 * `STAFF_SPACE_PX` is 10 — so the sign is drawn at **one SMuFL em = 4 staff spaces**, which is the
 * size the font was designed at and the size every advance in `bravuraMetrics` is measured against.
 * That is what makes `keySignatureExtent`'s arithmetic describe the ink actually drawn here.
 *
 * ⚠️ **POINTS, NOT PIXELS** (`reference_a_glyph_size_is_points_not_pixels`) — the confusion that
 * once made all five outside-staff families under-model their own ink by a clean ×4/3.
 *
 * 🚨🚨 **The first version said 38, "because that is what an accidental is drawn at" — invented, 27%
 * too big, reported by eye within a minute of it reaching the screen. And the record already had the
 * answer**: the research above was written before a line of this pass existed, and was not read.
 * ⛔ A number goes to the research first and to the code second — that is the standing rule for an
 * engraving question, and this is what skipping it costs.
 *
 * ⭐ G&L p. 52 says the same thing from the other end: a courtesy CLEF is cue size, while a courtesy
 * key signature and time signature are drawn normal. Two sources, no cautionary variant either way.
 */
export const SIGN_FONT_SIZE = 30

/**
 * ⭐⭐ **Where the first sign's INK starts** — {@link CLEF_TO_KEY_INK} past where the clef's ink ENDS,
 * or {@link BARLINE_TO_KEY_INK} past the barline on a bar that draws no clef. Both numbers are
 * quoted at their definitions; ⛔ neither is a padding borrowed from the extent model.
 *
 * 🚨🚨 **THE CLEF'S RIGHT EDGE COMES FROM THE FONT, NOT FROM `modifier.getWidth()`.** A modifier's
 * width is a LAYOUT BOX — the glyph plus whatever padding VexFlow's own header layout decided to
 * carry — so spacing measured against it is spacing measured against someone else's padding. His
 * rule, and the repo's: **every space is decided in INK.** `glyphBox(clefGlyph(clef)).right` is
 * where the clef's ink actually stops (gClef 2.684, fClef 2.736, cClef 2.796 staff spaces past its
 * origin), and the modifier is asked only for the ORIGIN it was drawn at.
 *
 * ⚠️ A sharp and a flat both have `left: 0`, so a sign's own origin IS its ink edge and no
 * correction is needed on this side. ⛔ That is a fact about those two glyphs, not a rule — a sign
 * whose ink began left of its origin would need `glyphBox(...).left` added here.
 */
export function firstSignX(signs: SignRun, bar: BarFrame, space: number, clef: Clef): number {
  const clefSign = signs.clef
  if (!clefSign) return bar.x + BARLINE_TO_KEY_INK * space
  const inkRight = clefSign.x + clefSign.xShift
    + glyphBox(clefGlyph(clef)).right * space
  return inkRight + CLEF_TO_KEY_INK * space
}

/** {@link firstSignX} where the bar was BUILT — for a width, or for the build itself. */
function builtFirstSignX(stave: EngravedStave, clef: Clef): number {
  return firstSignX(signRun(stave), barFrame(stave), staveFrame(stave).spacePx, clef)
}

/*
 * 🚨🚨 **A CLEF'S `getX()` IS ITS UNSHIFTED ORIGIN — the shift is a separate number, and reading one
 * without the other puts everything after the clef in the wrong place.**
 *
 * Found 2026-09-01, by `keySignature.e2e.ts` catching decision A: indenting the clef by 0.2 sp moved
 * the drawn glyph and left the signature where it was, so the gap the engines' number had bought
 * (0.82 sp) silently became 0.62. ⚠️ **The same latent bug sat under `clefOffsetPass`** — a user's
 * hand nudge on a beat-0 clef moved the glyph and not the signature after it; nobody had put a key
 * signature on such a bar and looked.
 *
 * ⭐ This is the `reference_vexflow_clefnote_xshift_is_inert` family: VexFlow's clefs answer about
 * where they were PLACED, never about where they were DRAWN. ⇒ ⛔ never measure from `getX()` alone.
 *
 * ⭐ S4a: the shift is now `HeaderSign.xShift` (`engrave/staff/signRun`), which a reader gets beside
 * the `x` it belongs to.
 */

/**
 * ⭐⭐ **Where the signature's ink ENDS, in the stave's own space** — the one owner of that answer,
 * because two places need it and they must not compute it apart: this pass, which draws the signs,
 * and `buildStave`, which puts the time signature after them.
 *
 * ⛔ An earlier version had `buildStave` SHIFT the meter by the room the model reserved instead of
 * PLACING it after the ink. The two agreed to within 0.08 sp — which is exactly the kind of drift
 * that is invisible until someone measures it, and it meant the gap a reader sees was not the gap
 * anybody had chosen.
 */
export function keySignatureInkRight(stave: EngravedStave, clef: Clef, key: KeySignature): number {
  const space = staveFrame(stave).spacePx
  let x = builtFirstSignX(stave, clef)
  key.alterations.forEach((alteration, i) => {
    const glyph = signGlyph(alteration.alter)
    if (!glyph) return
    // The last sign contributes its ink; every earlier one its advance and the gap after it.
    x += i === key.alterations.length - 1
      ? glyphBox(glyph).right * space
      : (glyphBox(glyph).advance + KEY_ACCIDENTAL_GAP) * space
  })
  return x
}

/**
 * ⭐⭐ **THE HIT BOX — registered from the pen, which is the only place both facts are known.**
 *
 * `BarlineRenderer.registerRepeatStart`'s rule verbatim (docs/plans/key-signature-plan.md §5): a hit-test
 * resolves a press against `ElementRegistry` boxes, and a score-level pass has to put them there
 * itself. Nothing else knows both WHERE this render put the bar and WHETHER it drew a signature —
 * the two questions a press asks.
 *
 * ⭐ **From the first sign's ink to the last's**, and five staff lines tall: the box is the
 * STATEMENT, not its letters. There is no removing the C♯ from D major and keeping the F♯, so one
 * box per row is the honest target — the clef's own call, one column to the left.
 *
 * ⚠️ Registered INSIDE {@link inStaffSpace}, so a small staff's box scales with its ink
 * (`ElementRegistry.withScale`). ⛔ Never after it: the coordinates here are the stave's own.
 */
function registerKeySignature(
  pass: RenderPass, placement: KeySignaturePlacement, key: KeySignature, x: number,
): void {
  const { stave } = placement
  const frame = placedStaffFrame(placement)
  const left = builtFirstSignX(stave, placement.clef)
  pass.elementRegistry.add({
    type: 'keySignature',
    measure: placement.measureNumber,
    staff: placement.staffIndex,
    bbox: {
      x,
      y: staffLineY(frame, 0),
      width: keySignatureInkRight(stave, placement.clef, key) - left,
      height: staffBottomLineY(frame) + STAFF_BOTTOM_EDGE_PX - staffLineY(frame, 0),
    },
  })
}

/**
 * ⭐⭐ **THE CAUTIONARY AT A SYSTEM BREAK — after this bar's closing barline, staff left open.**
 *
 * Gould, printed p. 93: *"When a key change coincides with a system break, the cancelling naturals
 * and the new key signature go at the end of the first system. The new system takes only the new key
 * signature."* ⭐ Measured on that figure: **0.75 sp** after the barline
 * ({@link BARLINE_TO_CAUTIONARY_KEY_INK}), and no barline after it — the line simply ends.
 *
 * ⭐ **Drawn by this pass, not as a stave END modifier**, which is what the courtesy METER is. Two
 * reasons, and both are this pass's own: a signature is ours to draw at all (VexFlow cannot express
 * one of ours), and a score-level pass is rebuilt every render — so a courtesy can never be left
 * behind in a bar's cached picture when the key after the break changes. ⚠️ That is also why P6 owes
 * no `ShapeKeyInputs` row, which the plan predicted it would: measured, a change to the OUTGOING key
 * that leaves the row's width identical (three flats → three sharps) still redraws, because the row
 * is not inside any measure group.
 *
 * ⛔ Left of the ink, nothing: the room was taken off the LINE (`cautionaryKey.ts`), so this draws
 * into space no bar owns rather than into the last bar's own span.
 */
function drawCautionary(pass: RenderPass, placement: KeySignaturePlacement): void {
  const row = placement.cautionaryKey
  if (!row || row.alterations.length === 0) return
  const { staffIndex } = placement
  const frame = placedStaffFrame(placement)
  const space = frame.spacePx
  // The bar's closing barline is at its right edge — the placement's, never the stave's (see the
  // header).
  const bar = placedBarFrame(placement)
  const barlineX = bar.x + bar.width
  const group = drawGroupOf(pass.context.openGroup?.(
    'keysig', `keysig-caution-${placement.measureNumber}-${staffIndex}`,
  ))
  inStaffSpace(pass, staffIndex, group, () => {
    const inkLeft = barlineX + BARLINE_TO_CAUTIONARY_KEY_INK * space
    const inkRight = drawSignRow(pass, row, placement.clef, frame, inkLeft)
    // ⚠️ `??`, never `||`: a gap of 0 is a real answer ("no tail after the signs") and must not fall
    //    back to the default.
    const trailing = placement.cautionaryKeyTrailing ?? CAUTIONARY_KEY_TO_LINE_END
    drawOpenStaffTail(pass, frame, barlineX, inkRight + trailing * space)
    // ⭐⭐ **A PRESS ON THE COURTESY SELECTS THE CHANGE IT ANNOUNCES** — his report, 2026-08-28: *"the
    //    cautionary is not clickable and neither selectable."* One statement, two pieces of ink (this,
    //    and the signature at the head of the new line), so both boxes name the SAME element: the
    //    change's own bar. The `|:` family settled this shape already — a displaced sign resolves to
    //    the bar it belongs to, not to the bar that happens to draw it.
    //
    // ⚠️ `measureNumber + 1` is not a guess: `applyCautionaryKeys` walks CONSECUTIVE bars and sets
    //    this row only where the NEXT one opens the following line (`engine/layout/cautionaryKey.ts`),
    //    so the change is always the bar after this one.
    pass.elementRegistry.add({
      type: 'keySignature',
      measure: placement.measureNumber + 1,
      staff: staffIndex,
      bbox: {
        x: inkLeft,
        y: staffLineY(frame, 0),
        width: inkRight - inkLeft,
        height: staffBottomLineY(frame) + STAFF_BOTTOM_EDGE_PX - staffLineY(frame, 0),
      },
    })
  })
  pass.context.closeGroup?.()
}

/**
 * ⭐⭐ **THE OPEN STAFF UNDER THE COURTESY — five lines past the last barline, and no line closing them.**
 *
 * 🚨 **His report, 2026-08-28, on the first build:** *"look, the key cautionary is there, but where is
 * the pentagram?"* Dead right — the signs were floating past the end of the staff. The room for them
 * is taken off the LINE rather than out of the bar (`cautionaryKey.ts` says why: a bar's own barline
 * is drawn at its right edge, so room added inside would put the courtesy on the wrong side of it),
 * and a bar draws staff lines only across its own span. So the tail belongs to nobody — which is
 * exactly what it is: **not part of any bar, but part of the SYSTEM**, and this pass owns it because
 * this pass is what puts ink there.
 *
 * ⭐ *"The staff is left open after the courtesy key signature"* — Gerou & Lusk p. 28, Ross p. 148
 * (*"the staff remains open"*), and Gould's p. 93 figure measures **1.9 sp** of bare staff after the
 * last sign ({@link CAUTIONARY_KEY_TO_LINE_END}). ⛔ So nothing closes it: no barline, no bracket.
 *
 * ⭐⭐ **The thickness is READ, not chosen** — {@link STAVE_LINE_WIDTH_PX}, the one constant
 * `drawStave` pins before it strokes any stave. His challenge, and it is the repo's own doctrine:
 * *"vexflow? shouldnt the solution follow the rules of own engine md?"* — so this is not "match
 * VexFlow's default", it is *the tail of a line is as thick as the line*, asked of the one place that
 * decides it. ⏭️ That constant carries the note that Bravura says 0.13 sp (1.3 px) — ⛔ SMuFL publishes no default at all — and why moving every
 * staff line in the score is not this phase's to do; when it moves, the tail moves with it.
 *
 * ⭐ Drawn inside {@link inStaffSpace}, so a small staff's tail scales with its own lines rather than
 * standing thicker than them.
 */
function drawOpenStaffTail(
  pass: RenderPass, frame: StaffFrame, fromX: number, toX: number,
): void {
  if (toX <= fromX) return
  const ys: number[] = []
  for (let line = 0; line < frame.lineCount; line++) ys.push(staffLineY(frame, line))
  // ⭐ **P5a**: the same module the stave's own lines come from, so the tail cannot drift off them.
  // ⛔ Still FILLED rather than stroked — see `fillStaffLine` for why the two primitives stay
  // different — but the y and the extent are now one owner's answer instead of two.
  for (const ink of staffLinesInk(fromX, toX - fromX, ys, STAVE_LINE_WIDTH_PX)) {
    fillStaffLine(pass.context, ink)
  }
}

/**
 * ⭐ **Draw one row of signs from `x`, and answer where its INK ended** — the head signature and the
 * cautionary are the same drawing, so they are one function: the step from sign to sign, the glyph
 * table and the line conversion cannot differ between them.
 *
 * ⚠️ **The answer is the last sign's ink edge, NOT the x the loop stopped at.** The step between signs
 * is `advance + gap`, so after the last one `x` stands where a further sign's ORIGIN would go —
 * roughly a third of a space past the ink. Returning that made the cautionary's hit box 3 px wider
 * than its glyphs and would put the open staff tail's start inside dead air. ⭐ `keySignatureInkRight`
 * makes the same distinction for the head row, and for the same reason.
 */
function drawSignRow(
  pass: RenderPass, key: KeySignature, clef: Clef, frame: StaffFrame, startX: number,
): number {
  const space = frame.spacePx
  const lines = keySignatureLines(key, clef)
  let x = startX
  let inkRight = startX
  key.alterations.forEach((alteration, i) => {
    const glyph = signGlyph(alteration.alter)
    if (!glyph) return
    // ⭐ The row from the measured table, and the y from the FRAME — the table's line numbers count
    //   from the bottom up (`staffLineForSpelling`'s convention), which is the frame's NOTE line
    //   (`engrave/staff/staffFrame.noteLineY`), so the conversion lives there rather than here.
    const y = noteLineY(frame, lines[i])
    const char = SIGN_CHARS[glyph]
    if (!char) return
    drawGlyph(pass.context, 'KeySignaturePass.sign', char, x, y, SIGN_FONT_SIZE)
    // ⚠️ The step is the FONT's advance plus our own gap — the same arithmetic `keySignatureExtent`
    // reserved room with, so the last sign ends where the meter was pushed to. ⛔ Never the DRAWN
    // width of the glyph just rendered: in jsdom that is 0, and this pass would silently stack every
    // sign at one x while agreeing with itself.
    inkRight = x + glyphBox(glyph).right * space
    x += (glyphBox(glyph).advance + KEY_ACCIDENTAL_GAP) * space
  })
  return inkRight
}

/**
 * **Draw every key signature of this render.**
 *
 * One per (bar, staff) that draws one — a system head, or a bar where the key changed across the
 * barline. A bar whose signature is EMPTY (C major, or an open key) draws nothing and takes no room,
 * which is not a special case anywhere: the list is empty, so the loop runs zero times.
 */
export function renderKeySignatures(pass: RenderPass, placements: KeySignaturePlacement[]): void {
  for (const placement of placements) {
    drawCautionary(pass, placement)
    const key = placement.headerKey
    if (!key || key.alterations.length === 0) continue

    const { staffIndex } = placement
    const frame = placedStaffFrame(placement)

    const group = drawGroupOf(pass.context.openGroup?.(
      'keysig', `keysig-${placement.measureNumber}-${staffIndex}`,
    ))

    inStaffSpace(pass, staffIndex, group, () => {
      const x = firstSignX(placedSignRun(placement), placedBarFrame(placement), frame.spacePx, placement.clef)
      // Before the ink, so a drawer that throws still leaves no half-registered box behind.
      registerKeySignature(pass, placement, key, x)
      drawSignRow(pass, key, placement.clef, frame, x)
    })

    pass.context.closeGroup?.()
  }
}
