import {
  Articulation, Modifier, ModifierContext, StaveNote, TickContext,
  type RenderContext, type Stave,
} from 'vexflow'
import type { ArticulationType, Chord, Clef } from '@/types/music'
import { ARTICULATION_RENDER_ORDER } from './NoteBuilder'

/**
 * ⭐ **Every member of a fan wears its OWN articulations.**
 *
 * A fan is how you write N attacks with one written note, and an articulation belongs to an attack —
 * so the sixth note of an accelerando can be the accented one. That was refused for a long time
 * (`docs/fanned-beam-pitches-plan.md` §3: *"Ties, articulations, dynamics on a member. Refused —
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
 */

/** VexFlow's articulation codes, by our type — the same table `NoteBuilder` uses. */
const ARTICULATION_VEX_CODES: Record<ArticulationType, string> = {
  accent: 'a>',
  staccato: 'a.',
  tenuto: 'a-',
}

/** Swallows the ink while `Articulation.draw` works out where it would have gone. */
const PROBE_CONTEXT = {
  setFont: () => PROBE_CONTEXT,
  fillText: () => {},
} as unknown as RenderContext

/**
 * Which side this slot's marks sit on — decided ONCE for the whole gesture, so a fan cannot print
 * one member's accent above and another's below.
 *
 * Member 0's own marks are the best answer available: `NoteBuilder` already applied the full rule
 * (explicit placement, else the voice's OUTER side in multi-voice, else opposite the stem), and
 * reading it back cannot disagree with it. The rest of this only runs when member 0 has no marks to
 * read — a fan whose accent is on member 3 alone — and `forcedStemDirection` is what tells the
 * multi-voice case apart there. It is absent on the cross-barline path, which has no lane to ask;
 * a multi-voice cross-barline fan marked on a member alone would take the single-voice side.
 */
export function fanArticulationPosition(
  note: StaveNote,
  slot: Chord,
  stemDirection: number,
  forcedStemDirection?: number,
): number {
  const own = note.getModifiersByType(Articulation.CATEGORY) as Articulation[]
  if (own.length) return own[0].getPosition()
  if (slot.articulationPlacement === 'above') return Modifier.Position.ABOVE
  if (slot.articulationPlacement === 'below') return Modifier.Position.BELOW
  return forcedStemDirection !== undefined
    ? (forcedStemDirection === 1 ? Modifier.Position.ABOVE : Modifier.Position.BELOW)
    : (stemDirection === 1 ? Modifier.Position.BELOW : Modifier.Position.ABOVE)
}

/** One member's marks, and where its head and stem actually landed. */
export interface FanMemberArticulationTarget {
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
}

/**
 * Draw ONE member's articulations. `position` comes from {@link fanArticulationPosition} so every
 * member of the group shares it; `stemDirection` is the group's.
 */
export function drawFanMemberArticulations(
  ctx: RenderContext,
  stave: Stave,
  target: FanMemberArticulationTarget,
  opts: { position: number; stemDirection: number },
): void {
  if (!target.types.length || !target.keys.length) return

  // Closest-to-the-head first, the order `NoteBuilder` adds them in — so a member's stack reads the
  // same way round as the slot's.
  const sorted = target.types.slice().sort(
    (a, b) => ARTICULATION_RENDER_ORDER.indexOf(a) - ARTICULATION_RENDER_ORDER.indexOf(b),
  )

  // The stand-in: the member's own pitches, clef, stem direction and stem LENGTH, so everything the
  // formatter reads about this note is true of the head we actually drew.
  const probe = new StaveNote({ keys: target.keys, duration: 'q', clef: target.clef })
  probe.setStemDirection(opts.stemDirection)
  probe.setStave(stave)
  probe.setTickContext(new TickContext())
  if (target.stemLengthPx > 0) probe.setStemLength(target.stemLengthPx)

  const marks = sorted.map((t) => {
    const art = new Articulation(ARTICULATION_VEX_CODES[t])
    // BEFORE the note sees it: this is what swaps `aboveCode`/`belowCode` (`setPosition` calls
    // `reset`), so the member wears the same glyph as the slot and not its mirror.
    art.setPosition(opts.position)
    probe.addModifier(art, 0)
    return art
  })

  // The library's own stacking — `StaveNote.preFormat` runs the modifier context's, which runs
  // `Articulation.format`, which spaces the marks off each glyph's measured height.
  //
  // ⚠️ ORDER. The modifiers go on FIRST and the note is formatted LAST: `getModifierStartXY` throws
  // `UnformattedNote` on a note that was never pre-formatted, and that throw takes the WHOLE
  // measure's render down with it — the bar simply does not draw.
  const mc = new ModifierContext()
  probe.addToModifierContext(mc)
  probe.preFormat()

  // Where the stand-in's head ended up, so the move to the real one is a single delta.
  const dx = target.headX - probe.getNoteHeadBeginX()

  for (const art of marks) {
    art.setContext(PROBE_CONTEXT).draw() // computes x/y (and the origin shifts) — ink discarded
    art.setContext(ctx)
    art.setX(art.getX() + dx)
    art.renderText(ctx, 0, 0)
  }
}
