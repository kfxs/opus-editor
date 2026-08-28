import { Element, StaveModifierPosition, type Stave } from 'vexflow'
import type { Clef, KeySignature } from '@/types/music'
import type { RenderPass } from './RenderPass'
import {
  BARLINE_TO_KEY_INK, CLEF_TO_KEY_INK, KEY_ACCIDENTAL_GAP, keySignatureLines,
} from '@/engine/layout/keySignatureLayout'
import { accidentalGlyph, clefGlyph, glyphBox, type GlyphName } from '@/engine/fonts/fontMetrics'
import { alterToString } from '@/utils/pitchSpelling'
import { inStaffSpace } from './staffScaleGroup'

/**
 * ⭐⭐ **THE KEY SIGNATURE — ours, not VexFlow's** (docs/key-signature-plan.md §4).
 *
 * `stave.addKeySignature` is never called. The reason is the boundary test in
 * `docs/vexflow-boundary.md` §4 — *take a decision from VexFlow only when there is a rule we want to
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
 * that once stole a grand staff's barlines onto the wrong staff. `staleShift` below is that
 * correction, and it is `BarlineRenderer`'s, verbatim in intent.
 */

/** What this pass needs of a placement — satisfied by `MeasurePlacement`, and deliberately no more. */
export interface KeySignaturePlacement {
  measureNumber: number
  staffIndex: number
  stave: Stave
  /** Where the bar is THIS render (SVG space) — ⛔ not `stave.getX()`. See the header. */
  x: number
  y: number
  /** The staff's drawn scale; `x`/`y` are SVG-space and the stave lives in its own scaled space. */
  scale: number
  clef: Clef
  /** The signature this bar's head draws, absent where it draws none (`headerKeyAt`). */
  headerKey?: KeySignature
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
 * (docs/key-signature-research.md §9.4.3, first bullet).
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

/** How far this render moved the bar since its stave was built — `BarlineRenderer.staleShift`. */
function staleShift(placement: KeySignaturePlacement): { dx: number; dy: number } {
  const { stave, scale } = placement
  return { dx: placement.x / scale - stave.getX(), dy: placement.y / scale - stave.getY() }
}

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
export function firstSignX(stave: Stave, clef: Clef, dx: number): number {
  const space = stave.getSpacingBetweenLines()
  const clefModifier = stave.getModifiers(StaveModifierPosition.BEGIN)
    .find(m => m.getCategory() === 'Clef')
  if (!clefModifier) return stave.getX() + dx + BARLINE_TO_KEY_INK * space
  const inkRight = clefModifier.getX() + glyphBox(clefGlyph(clef)).right * space
  return inkRight + dx + CLEF_TO_KEY_INK * space
}

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
export function keySignatureInkRight(stave: Stave, clef: Clef, key: KeySignature): number {
  const space = stave.getSpacingBetweenLines()
  let x = firstSignX(stave, clef, 0)
  key.alterations.forEach((alteration, i) => {
    const glyph = accidentalGlyph(alterToString(alteration.alter))
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
 * `BarlineRenderer.registerRepeatStart`'s rule verbatim (docs/key-signature-plan.md §5): a hit-test
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
  pass: RenderPass, placement: KeySignaturePlacement, key: KeySignature, x: number, dy: number,
): void {
  const { stave } = placement
  const left = firstSignX(stave, placement.clef, 0)
  pass.elementRegistry.add({
    type: 'keySignature',
    measure: placement.measureNumber,
    staff: placement.staffIndex,
    bbox: {
      x,
      y: stave.getTopLineTopY() + dy,
      width: keySignatureInkRight(stave, placement.clef, key) - left,
      height: stave.getBottomLineBottomY() - stave.getTopLineTopY(),
    },
  })
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
    const key = placement.headerKey
    if (!key || key.alterations.length === 0) continue

    const { stave, staffIndex } = placement
    const { dx, dy } = staleShift(placement)
    const space = stave.getSpacingBetweenLines()
    const lines = keySignatureLines(key, placement.clef)

    const group = pass.context.openGroup?.(
      'keysig', `keysig-${placement.measureNumber}-${staffIndex}`,
    ) as SVGGElement | undefined

    inStaffSpace(pass, staffIndex, group, () => {
      let x = firstSignX(stave, placement.clef, dx)
      // Before the ink, so a drawer that throws still leaves no half-registered box behind.
      registerKeySignature(pass, placement, key, x, dy)
      key.alterations.forEach((alteration, i) => {
        const glyph = accidentalGlyph(alterToString(alteration.alter))
        if (!glyph) return
        // ⭐ The row from the measured table, and the y from the STAVE — `getYForLine` counts from
        //   the top line downward, while the table's line numbers count from the bottom up
        //   (`staffLineForSpelling`'s convention, which is what `keySignatureLines` returns). The
        //   conversion is here, at the one place the two meet.
        const y = stave.getYForLine(5 - lines[i]) + dy
        const char = SIGN_CHARS[glyph]
        if (!char) return
        const element = new Element('KeySignaturePass.sign')
        element.setText(char)
        element.setFontSize(SIGN_FONT_SIZE)
        element.renderText(pass.context, x, y)
        // ⚠️ The step is the FONT's advance plus our own gap — the same arithmetic
        // `keySignatureExtent` reserved room with, so the last sign ends where the meter was pushed
        // to. ⛔ Never the DRAWN width of the glyph just rendered: in jsdom that is 0, and this pass
        // would silently stack every sign at one x while agreeing with itself.
        x += (glyphBox(glyph).advance + KEY_ACCIDENTAL_GAP) * space
      })
    })

    pass.context.closeGroup?.()
  }
}
