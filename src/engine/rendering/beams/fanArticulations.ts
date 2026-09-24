import type { EngravedStave } from '../engraved/EngravedStave'
import type { ArticulationType, Clef } from '@/types/music'
import { ARTICULATION_RENDER_ORDER } from '../engraved/NoteBuilder'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { stampGlyph } from '@/engine/engrave/glyph'
import { EngravedNote } from '../engraved/EngravedNote'
import { EngravedArticulation } from '../engraved/EngravedArticulation'
import { attachModifier, MODIFIER_POSITION, type ModifierPositionValue } from '../engraved/EngravedModifier'
import { ColumnModifiers, fileInColumn } from '../format/modifierColumns'
import { TickColumn } from '../format/columnFormat'
import { standOn } from '../staff/staveFrame'

/**
 * ⭐ **Every member of a fan wears its OWN articulations.**
 *
 * A fan is how you write N attacks with one written note, and an articulation belongs to an attack —
 * so the sixth note of an accelerando can be the accented one. That was refused for a long time
 * (`docs/plans/fanned-beam-pitches-plan.md` §3: *"Ties, articulations, dynamics on a member. Refused —
 * actively"*) on the reasoning that a mark attaches to the whole gesture, and the drawing agreed by
 * accident: only member 0 is a real `StaveNote`, so only member 0 could carry a modifier at all.
 * Both halves are gone — `FanMemberChord.articulations` stores them and this draws them — for the
 * same reason slurs stopped being refused: it is what the notation is for.
 *
 * Member 0 is NOT drawn here. It is the slot's own chord, VexFlow knows about it, and its marks come
 * from {@link ARTICULATION_RENDER_ORDER}'s owner `NoteBuilder` like any other note's. This pass is
 * only for the heads VexFlow never saw.
 *
 * ## Formatted by VexFlow, then translated
 *
 * Nothing here decides how far out a mark sits or how a stack of them spaces apart. A throwaway
 * `StaveNote` is built at the member's own pitches, clef, stem direction and stem LENGTH, the marks
 * are added to it, and the library's own `ModifierContext` formats them — the same code that placed
 * member 0's. The glyphs are then drawn at the member's x by translating what the library computed.
 *
 * That is deliberate, and the alternative was tried: a hand-rolled "one staff space per mark" rule
 * puts a single staccato 2px off where VexFlow puts the identical mark on the note beside it,
 * because a between-lines glyph gets snapped into a space and re-originned. Copying the library's
 * arithmetic is the only way two heads in one group can agree.
 *
 * ⚠️ The probe context is not decoration: `Articulation.draw` is what COMPUTES `x`/`y` (and applies
 * `setOrigin`, which lands in the shifts). It has to run before there is anything to translate, so
 * it runs once against a context that throws the ink away.
 *
 * ⚠️ `setX` before the real render is not optional — a `Modifier` drawn at explicit coordinates
 * without its own x/y set drags the note's bounding box to zero, silently
 * (reference_vexflow_modifier_bbox_needs_x_y).
 *
 * ⭐ **S12f2 — the stand-in is OURS now, and so is the rule it runs.** The throwaway note is an
 * `EngravedNote`, the marks `EngravedArticulation`s, the column our `ColumnModifiers` — the same
 * classes and rules as member 0's (`engrave/notes/articulationStack`, `articulationPlacement`), so the
 * placement has ONE owner again. No probe context any more: the mark is PLACED (`place()`), moved onto
 * the member's head, and its glyph stamped with no group of its own, as VexFlow's `Element.renderText` did.
 * ⭐ Its tick column is ours too (S12j-b).
 */

/** VexFlow's articulation codes, by our type — the same table `NoteBuilder` uses. */
export const ARTICULATION_CODES: Record<ArticulationType, string> = {
  accent: 'a>',
  staccato: 'a.',
  tenuto: 'a-',
}

/**
 * The side a member's marks sit on when the member has not been flipped itself — the AUTO rule, and
 * nothing else.
 *
 * ⛔ **Not member 0's side, and not `slot.articulationPlacement`.** Both were tried and both are the
 * same mistake: `Chord.articulationPlacement` is member 0's OWN flip, because member 0 *is* the
 * slot's chord. Reading it here made the owner's `x` move all six marks — *"if i flip the owner
 * articulation all articulations flip"* — which is one side per gesture again, the thing a fan is
 * not. A member follows the stem until it is flipped, and then it follows itself.
 *
 * The rule is `NoteBuilder`'s: the voice's OUTER side in multi-voice (so two voices' marks never
 * collide in the middle), the note-head side otherwise. `forcedStemDirection` is absent on the
 * cross-barline path, which has no lane to ask; a multi-voice cross-barline fan takes the
 * single-voice side there.
 */
export function fanArticulationPosition(
  stemDirection: number,
  forcedStemDirection?: number,
): ModifierPositionValue {
  return forcedStemDirection !== undefined
    ? (forcedStemDirection === 1 ? MODIFIER_POSITION.ABOVE : MODIFIER_POSITION.BELOW)
    : (stemDirection === 1 ? MODIFIER_POSITION.BELOW : MODIFIER_POSITION.ABOVE)
}

/** One drawn member mark, for the caller to register — its kind and the ink it occupies. */
interface PlacedFanArticulation {
  type: ArticulationType
  rect: { x: number; y: number; width: number; height: number }
}

/** One PLACED mark, before any ink — the glyph, where it stamps, and the box the rule measured. */
export interface PlacedArticulationInk {
  type: ArticulationType
  ink: ReturnType<EngravedArticulation['inkAt']>
  /** Its measured box (zero-sized in jsdom, where glyphs measure nothing). */
  box: { x: number; y: number; w: number; h: number } | null
}

/** One member's marks, and where its head and stem actually landed. */
interface FanMemberArticulationTarget {
  /** THIS member's own articulations — empty draws nothing. */
  types: ArticulationType[]
  /** Its pitches as VexFlow keys (`'c/4'`), so the stand-in note stands where the member does. */
  keys: string[]
  /** The clef those keys are read against — the member's own bar's. */
  clef: Clef
  /** Left edge of the member's notehead, as drawn. */
  headX: number
  /** How long the member's stem actually is, in px — a fan gives every member a different one. */
  stemLengthPx: number
  /** THIS member's own flipped side, when it has one. Absent ⇒ follow the group's. */
  placement?: 'above' | 'below'
}

/**
 * Draw ONE member's articulations. `position` comes from {@link fanArticulationPosition} so every
 * member of the group shares it; `stemDirection` is the group's.
 */
export function drawFanMemberArticulations(
  ctx: DrawContext,
  stave: EngravedStave,
  target: FanMemberArticulationTarget,
  opts: { position: ModifierPositionValue; stemDirection: number; glyphScale?: number },
): PlacedFanArticulation[] {
  const placed: PlacedFanArticulation[] = []
  for (const { type, ink, box } of placeMemberArticulations(stave, target, opts)) {
    // The ink on OUR surface, the mark's own glyph, face and shifts — ⚠️ with no group of its own.
    stampGlyph(ctx, ink.glyph, ink.x, ink.y, ink.font)
    if (box) placed.push({ type, rect: { x: box.x, y: box.y, width: box.w, height: box.h } })
  }
  return placed
}

/**
 * ⭐ The PLACEMENT half of {@link drawFanMemberArticulations}, for a head the note rules never saw —
 * a fan member's, or a GRACE's (`rendering/GracePass`, which stamps each mark at its own size about
 * the point this chose). Same stand-in, same column, same rules; no ink.
 */
export function placeMemberArticulations(
  stave: EngravedStave,
  target: FanMemberArticulationTarget,
  opts: {
    position: ModifierPositionValue; stemDirection: number
    /** A GRACE's size: the step out from the head scales with it, the snap does not. Absent = 1. */
    outwardScale?: number
    /** ⭐ A CUE fan's size — the stand-in note is drawn at it, so its marks measure and stamp at it too
     *  (`EngravedModifier.noteScale`), the way a cue note's own do. Absent = 1. */
    glyphScale?: number
  },
): PlacedArticulationInk[] {
  if (!target.types.length || !target.keys.length) return []

  // ⭐ The member's OWN side wins over the group's. Flipping the owner used to flip all six, which
  // is what one side per gesture means and not what a fan is.
  const position = target.placement === 'above' ? MODIFIER_POSITION.ABOVE
    : target.placement === 'below' ? MODIFIER_POSITION.BELOW
      : opts.position

  // Closest-to-the-head first, the order `NoteBuilder` adds them in — so a member's stack reads the
  // same way round as the slot's.
  const sorted = target.types.slice().sort(
    (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b),
  )

  // The stand-in: the member's own pitches, clef, stem direction and stem LENGTH, so everything the
  // formatter reads about this note is true of the head we actually drew.
  const probe = new EngravedNote({ keys: target.keys, duration: 'q', clef: target.clef, ...(opts.glyphScale && opts.glyphScale !== 1 && { glyphScale: opts.glyphScale }) })
  standOn(probe, stave)
  // A column of its own to stand in — the probe asks it only its x (0), as VexFlow's empty context answered.
  new TickColumn().addTickable(probe)
  // 🚨 LENGTH BEFORE DIRECTION, and it is not a style choice. `setStemLength` only records an
  // extension override on the NOTE (`stemExtensionOverride`); the single line that pushes it into
  // the `Stem` object is inside `setStemDirection`. Set it after, and the stem keeps VexFlow's
  // default ~35px however long the member's really is — which is what put a flipped member's accent
  // inside the feathering while the owner's, whose stem the fan had already stretched, looked right.
  if (target.stemLengthPx > 0) probe.setStemLength(target.stemLengthPx)
  probe.setStemDirection(opts.stemDirection)

  const marks = sorted.map((t) => {
    const art = new EngravedArticulation(ARTICULATION_CODES[t])
    // BEFORE the note sees it: this is what swaps `aboveCode`/`belowCode` (`setPosition` calls
    // `reset`), so the mark wears the glyph of the side it is actually on and not its mirror.
    art.setPosition(position)
    if (opts.outwardScale !== undefined) art.setOutwardScale(opts.outwardScale)
    attachModifier(probe, art, 0)
    return art
  })

  // The column's stacking — `StaveNote.preFormat` runs our column's, which runs the articulation rule
  // (`engrave/notes/articulationStack`), which spaces the marks off each glyph's measured height.
  //
  // ⚠️ ORDER. The modifiers go on FIRST and the note is formatted LAST: `getModifierStartXY` throws
  // `UnformattedNote` on a note that was never pre-formatted, and that throw takes the WHOLE
  // measure's render down with it — the bar simply does not draw.
  const mc = new ColumnModifiers()
  fileInColumn(probe, mc)
  probe.preFormat()

  // Where the stand-in's head ended up, so the move to the real one is a single delta.
  const dx = target.headX - probe.getNoteHeadBeginX()

  const placed: PlacedArticulationInk[] = []
  for (let i = 0; i < marks.length; i++) {
    const art = marks[i]
    art.place() // x/y and the origin shifts — the placement member 0 got
    art.moveX(dx)
    // The box the CALLER registers, so a member's mark can be clicked like the owner's — taken from
    // the glyph the same way the owner's is (`modifier.getBoundingBox()`).
    const box = art.getBoundingBox()
    placed.push({ type: sorted[i], ink: art.inkAt(), box: box ? { x: box.x, y: box.y, w: box.w, h: box.h } : null })
  }
  return placed
}
