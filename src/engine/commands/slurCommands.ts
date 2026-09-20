/**
 * ⭐ **THE SLUR's COMMANDS** — every edit the editor can make to one, built from a
 * {@link CommandContext}; `MusicEngine` keeps `readonly slur = slurCommands(ctx)`, and a caller
 * writes `engine.slur.nudgeSlur(…)`. The ottava's arrangement (`./ottavaCommands`).
 *
 * Everything a slur IS lives in `engine/models/slurOps`. ⭐ A slur is NOTATIONAL ONLY — nothing here
 * changes what plays — so no command here is an audible edit; and its shape is
 * cosmetic, so it has the family's richest set of ink edits (the arc's control points, per system on
 * a cross-system slur; the two true ends; the open joins) beside the two that touch the music: which
 * notes it joins, and which side it is drawn on.
 *
 * ⚠️ The limits are judged per END in that end's own band — a rigid move shifts both, and a
 * cross-system slur's ends live in different systems. ⛔ Never the arc's bbox (`endpointInk`).
 *
 * ⚠️ `commands` is named so `createSlurOverSpan` can call its sibling without `this`.
 */
import type {
  CurveControlPointDeltas, Fraction, Slur, SlurSegmentAddress, SlurSegmentEndpointAddress,
} from '@/types/music'
import type { InkBox } from '../layout/pageBounds'
import { nextDistinctSlot, spanFromNotes } from '../models/spanFromNotes'
import type { CommandContext } from './commandContext'

export type SlurCommands = ReturnType<typeof slurCommands>

export function slurCommands(ctx: CommandContext) {
  /**
   * ⭐⭐ **The drawn HANDLE of the end being moved** — the ink the band limit judges, and ⛔ NOT the
   * slur's bounding box.
   *
   * 🚨 His report, 2026-08-18: with an end 9.9 sp below the staff the endpoint could not be dragged
   * back UP. The box was the whole arc's, which spans from the arch down to that end, so its TOP
   * already poked above the band's ceiling — and the rule refuses a step that grows the overhang on
   * ANY edge, so moving up (shrinking the bottom overhang, growing the top one) was refused. The
   * endpoint was nowhere near the top; the ARCH was.
   *
   * ⚠️ The page limit's use of the whole bbox is right for the page — a sheet cares about all the ink.
   * A BAND is about one point's room, so the ink is that point. ⛔ Empty when the squares are not drawn
   * (an unselected slur, linear view), which the rule reads as "nothing to measure" and allows.
   */
  function endpointInk(id: string, which: 'start' | 'end'): InkBox[] {
    const registry = ctx.registry()
    return (registry.getByType?.('slur-endpoint') ?? [])
      .filter(e => e.slurId === id && e.endpoint === which)
      .map(e => e.bbox)
  }

  /** Where the slur end being moved is anchored, for {@link nudgeStaysInBand}. Null when the anchor
   *  is not resolvable, which the caller treats as "no limit to apply". */
  function endpointLane(id: string, which: 'start' | 'end'): { measure: number; staff: number } | null {
    const slur = ctx.model().getSlurById(id)
    if (!slur) return null
    const note = ctx.model().getNote(which === 'start' ? slur.startNoteId : slur.endNoteId)
    return note ? { measure: note.measure, staff: note.staff ?? 0 } : null
  }

  /** Both limits an endpoint offset must satisfy: it may not leave its SHEET
   *  ({@link nudgeStaysOnPage}) and it may not enter a neighbouring staff's room
   *  ({@link nudgeStaysInBand}). Shared by the keyboard nudge and every drag frame, so the two
   *  devices cannot disagree about what is allowed. */
  function endpointOffsetAllowed(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    if (!ctx.limits.nudgeStaysOnPage('slur', id, dx, dy)) return false
    const lane = endpointLane(id, which)
    return !lane || ctx.limits.nudgeStaysInBand(endpointInk(id, which), lane.measure, lane.staff, dy)
  }

  /** The same two limits for a move of the WHOLE curve ({@link nudgeSlur}) — ⭐ the band one applied
   *  to EACH end in its own band, since a rigid translate moves both and a cross-system slur's ends
   *  live in different systems. ⛔ Still not the arc's bbox: `slurEndpointInk`'s note says why. */
  function offsetAllowed(id: string, dx: number, dy: number): boolean {
    if (!ctx.limits.nudgeStaysOnPage('slur', id, dx, dy)) return false
    for (const which of ['start', 'end'] as const) {
      const lane = endpointLane(id, which)
      if (lane && !ctx.limits.nudgeStaysInBand(endpointInk(id, which), lane.measure, lane.staff, dy)) return false
    }
    return true
  }

  const commands = {
    /**
     * Create a phrasing slur over the current selection (a span object on
     * {@link Score.slurs}, distinct from ties). Endpoint resolution:
     *  - **1 note**  → slur from it to the NEXT distinct slot (note or rest). The
     *    next-slot scan dedupes by `(measure, beat)` so a chord member slurs to the
     *    next *event*, not a sibling head at the same beat.
     *  - **N notes** → slur first→last in score order (`measure`, then `beat`),
     *    filtered to voice 0 (other voices ignored; see docs/slur-plan.md §1).
     *
     * Create-only and **idempotent**: if a slur with the same endpoints already
     * exists, the existing one is returned and nothing is added (no duplicate). There
     * is intentionally no toggle-off here — removal is a separate operation (select
     * the arc + Delete → {@link removeSlur}); see docs/slur-plan.md §1.
     *
     * Slurs are notational only — no playback change — so the audio engine isn't touched.
     * @returns the created (or pre-existing) Slur, or null if no valid span resolved.
     */
    createSlur(noteIds: string[]): Slur | null {
      // ⭐ A FANNED MEMBER *can* anchor a slur — unlike a tie. The plan refused both together
      // (docs/fanned-beam-pitches-plan.md §3) and that was right for the tie: it is a pitch-to-pitch
      // continuation, and a member has no length of its own to continue into. A slur is not an
      // attachment to the event's rhythm, it is a SPAN between two points, and member 2 → member 5 is
      // a perfectly good span (his ask). So members stay in the candidate list here.
      // A slur lives in ONE voice. Derive it from the selection (the first resolved
      // note's voice) and keep only that voice's notes — so a voice-2 selection makes a
      // voice-2 slur. (Was hardcoded to voice 0, so `s` did nothing in any other voice.)
      const span = spanFromNotes(ctx.model(), noteIds, { byVoice: true, sounding: false })
      if (!span) return null
      const { start: startNote, voice: slurVoice } = span
      const endNote = span.notes.length >= 2 ? span.end : nextDistinctSlot(ctx.model(), startNote)
      if (!endNote || endNote.id === startNote.id) return null

      const existing = ctx.model().findSlurByEndpoints(startNote.id, endNote.id)
      if (existing) return existing // idempotent — never duplicate, never remove

      const created = ctx.model().addSlur({ startNoteId: startNote.id, endNoteId: endNote.id, voice: slurVoice })
      ctx.mutate('Add slur')
      return created
    },

    /**
     * ⭐⭐ **Create the slur a COPIED one describes** — the same amount of music, starting at `at`.
     *
     * ⭐ A slur's identity is two NOTE IDS, which mean nothing anywhere else, so what a copy carries is
     * its SPAN (`slurOps.slurSpanOf`) and this resolves it against the destination's own notes
     * (`slurOps.slurEndsFrom` — the last note starting within the span, the ⛔ about rests included).
     * ⛔ It starts from a NOTE, never an address: an address always resolves to something, which is how
     * a paste into an empty bar drew a slur three bars long (his report, 2026-08-20).
     * An explicit `placement` is reproduced too: it is a decision the user made, where an absent one
     * lets the renderer read the stems.
     *
     * @returns the new slur, or null when there is nothing there to join.
     */
    createSlurOverSpan(
      startNoteId: string,
      span: Fraction,
      placement?: 'above' | 'below',
    ): Slur | null {
      const ends = ctx.model().slurEndsFrom(startNoteId, span)
      if (!ends) return null
      const created = commands.createSlur([ends.startNoteId, ends.endNoteId])
      if (created && placement) ctx.model().setSlurPlacement(created.id, placement)
      return created
    },

    /** Remove a slur by id (the arc only — never the anchored notes). Saves undo
     *  state when removed. @returns true if a slur was removed. */
    removeSlur(id: string): boolean {
      const removed = ctx.model().removeSlur(id)
      if (removed) ctx.mutate('Remove slur')
      return removed
    },

    /** Set (or clear with `null`) a slur's user-edited curve shape (the two cubic
     *  control-point deltas, in **staff-spaces** — the caller converts from pixels). Stored
     *  in the engraving-overrides compartment, not on the slur (see
     *  {@link CurveShapeOverride}). Saves one undo step on success.
     *  @returns true if the slur exists and was updated. */
    setSlurShape(id: string, cps: CurveControlPointDeltas | null): boolean {
      const updated = ctx.model().setSlurShape(id, cps)
      if (updated) ctx.mutate(cps ? 'Reshape slur' : 'Reset slur shape')
      return updated
    },

    /** Live (preview) shape update used **while dragging a slur handle** — updates the
     *  slur's curve-shape override (staff-spaces) but does NOT record undo. Call
     *  {@link commitSlurShape} on drop to push the single undo entry (mirrors `moveClef` /
     *  `commitClefMove`).
     *
     *  A same-line slur (no `segment`) reshapes its whole-arc `curveShape`. A cross-system
     *  slur passes the grabbed segment's address + the live `spanCount`, routing the edit
     *  into the per-segment `segmentCurveShape` override instead. */
    previewSlurShape(
      id: string,
      cps: CurveControlPointDeltas,
      segment?: SlurSegmentAddress,
      spanCount?: number,
    ): boolean {
      // Live drag: mutates the model but defers its undo entry to commitSlurShape, so it never
      // passes through saveUndoState — the one place that flags the model dirty. Flag it here or
      // the next render would skip, and the drag would not appear (render-performance-plan §5a).
      ctx.markDirty()
      return segment && spanCount !== undefined
        ? ctx.model().setSlurSegmentShape(id, segment, cps, spanCount)
        : ctx.model().setSlurShape(id, cps)
    },

    /** Record one undo entry after a slur-handle drag settles. */
    commitSlurShape(): void {
      ctx.commitPreviewed('Reshape slur')
    },

    /** Re-anchor without undo — moves one end of the slur onto `noteId` and resets the edits that
     *  were authored against the old anchor (see `slurOps.setSlurEndpoint`). Returns false (no-op)
     *  when the target is invalid (collapses the span or is unchanged). Pair it with
     *  {@link commitSlurEndpoint} for the single undo entry: every FRAME of an endpoint drag, or the
     *  one step of a Ctrl+Shift+←/→ press (`interactions/slurReanchor`, where the two run back to
     *  back — a press is already a whole gesture). */
    previewSlurEndpoint(id: string, which: 'start' | 'end', noteId: string): boolean {
      ctx.markDirty() // live drag, undo deferred to commitSlurEndpoint — see previewSlurShape
      return ctx.model().setSlurEndpoint(id, which, noteId)
    },

    /** Record one undo entry for a re-anchor: after the drag settles, or per keyboard step. */
    commitSlurEndpoint(): void {
      ctx.commitPreviewed('Re-anchor slur')
    },

    /** Re-point one end onto `noteId` **keeping** the arc's shape and both ends' nudges, and save ONE
     *  undo step. The interpolating walk's write (`interactions/slurEndpointWalk`), which pairs it
     *  with a re-basing {@link nudgeSlurEndpoint} inside a {@link runBatch} so the press is one entry.
     *  ⚠️ NOT the general re-anchor — see `slurOps.setSlurEndpointKeepingEdits` for which caller wants
     *  which. @returns false (no-op) when the target is invalid or already the anchor. */
    setSlurEndpointKeepingEdits(id: string, which: 'start' | 'end', noteId: string): boolean {
      const ok = ctx.model().setSlurEndpointKeepingEdits(id, which, noteId)
      if (ok) ctx.mutate('Re-anchor slur')
      return ok
    },

    /** The undo-free twin of {@link setSlurEndpointKeepingEdits}, for a live endpoint DRAG whose every
     *  frame may cross a note. Pair with {@link commitSlurEndpoint} on drop. */
    previewSlurEndpointKeepingEdits(id: string, which: 'start' | 'end', noteId: string): boolean {
      ctx.markDirty() // live drag, undo deferred to commitSlurEndpoint — see previewSlurShape
      return ctx.model().setSlurEndpointKeepingEdits(id, which, noteId)
    },

    /** The undo-free twin of {@link nudgeSlurEndpoint} — accumulates the same way, keeps the same page
     *  limit, records no undo step. One frame of an endpoint drag. */
    previewSlurEndpointOffset(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
      if (!endpointOffsetAllowed(id, which, dx, dy)) return false
      ctx.markDirty()
      return ctx.model().setSlurEndpointOffset(id, which, dx, dy)
    },

    /** Drop a slur's hand-edited ARC shape and save ONE undo step — the reset half of the handle
     *  nudges, on the key that resets everything else (`interactions/slurHandleReset`). Pass a
     *  `segment` + live `spanCount` for one segment of a cross-system slur, neither for the whole
     *  slur. @returns false when there was nothing authored to reset — the caller then DECLINEs and
     *  the key falls through. */
    resetSlurShape(id: string, segment?: SlurSegmentAddress, spanCount?: number): boolean {
      const ok = ctx.model().resetSlurShape(id, segment, spanCount)
      if (ok) ctx.mutate('Reset slur shape')
      return ok
    },

    /** Drop ONE true end's nudge and save ONE undo step — the reset half of {@link nudgeSlurEndpoint}.
     *  @returns false if that end has no offset, so the caller DECLINEs and the key falls through. */
    resetSlurEndpointOffset(id: string, which: 'start' | 'end'): boolean {
      const ok = ctx.model().resetSlurEndpointOffset(id, which)
      if (ok) ctx.mutate('Reset slur endpoint')
      return ok
    },

    /** Drop ONE open join's nudge and save ONE undo step — the reset half of
     *  {@link nudgeSlurSegmentEndpoint}. @returns false if that join has no offset. */
    resetSlurSegmentEndpointOffset(id: string, address: SlurSegmentEndpointAddress, spanCount: number): boolean {
      const ok = ctx.model().resetSlurSegmentEndpointOffset(id, address, spanCount)
      if (ok) ctx.mutate('Reset slur segment endpoint')
      return ok
    },

    /** Nudge a slur endpoint by a staff-space delta and save ONE undo step (the keyboard
     *  fine-positioning — see docs/slur-endpoint-offset-plan.md). Unlike a mouse drag each
     *  arrow press is already a discrete commit, so there is no preview/commit split. */
    nudgeSlurEndpoint(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
      if (!endpointOffsetAllowed(id, which, dx, dy)) return false
      const ok = ctx.model().setSlurEndpointOffset(id, which, dx, dy)
      if (ok) ctx.mutate('Nudge slur endpoint')
      return ok
    },

    /**
     * ⭐⭐ **Nudge the WHOLE curve** by a staff-space delta and save ONE undo step — the arrows with the
     * slur selected and no handle armed (his ask, 2026-08-18), the family's rule that a hairpin, a
     * bracket, a pedal and a trill already follow. The shape does not change: see
     * {@link SlurOffsetOverride} for why this is one rigid translate rather than two endpoint nudges.
     *
     * ⚠️ **Both limits, judged END BY END.** The page limit reads the whole slur's ink (a sheet cares
     * about all of it, and each drawn fragment is judged against its own page). The BAND limit reads
     * each end's own handle in its OWN system's band — the correction of 2026-08-18 twice over: the
     * arc's bbox spans the arch, so judging it would refuse every vertical move of a curve whose arch
     * already overhangs, and on a cross-system slur the two ends do not even share a band.
     */
    nudgeSlur(id: string, dx: number, dy: number): boolean {
      if (!offsetAllowed(id, dx, dy)) return false
      const ok = ctx.model().setSlurOffset(id, dx, dy)
      if (ok) ctx.mutate('Nudge slur')
      return ok
    },

    /** The undo-free twin of {@link nudgeSlur} — one frame of an ARC-BODY drag. Accumulating, so the
     *  caller passes the delta since the last ACCEPTED frame; both limits still refuse the write, so a
     *  curve dragged into a neighbour's room stops moving (⛔ the drawing is never clamped). Pair with
     *  {@link commitSlurOffsetDrag} on the drop. @returns true when the model changed. */
    previewSlurOffset(id: string, dx: number, dy: number): boolean {
      if (!offsetAllowed(id, dx, dy)) return false
      ctx.markDirty() // live drag, undo deferred to commitSlurOffsetDrag
      return ctx.model().setSlurOffset(id, dx, dy)
    },

    /** Record ONE undo entry after an arc-body drag settles. */
    commitSlurOffsetDrag(): void {
      ctx.commitPreviewed('Move slur')
    },

    /** Drop the whole curve's offset and save ONE undo step — `Ctrl+Backspace` with nothing armed.
     *  @returns false when it carries none, so the caller DECLINEs and the key falls through. */
    resetSlurOffset(id: string): boolean {
      const ok = ctx.model().resetSlurOffset(id)
      if (ok) ctx.mutate('Reset slur offset')
      return ok
    },

    /** Nudge one OPEN join of a cross-system slur by a staff-space delta and save ONE undo step
     *  (the keyboard fine-positioning for the orange segment-endpoint squares — see
     *  docs/multisystem-slur-segment-endpoint-offset-plan.md). `spanCount` is the live system
     *  count at the time of the edit (the override's reset signature). */
    nudgeSlurSegmentEndpoint(id: string, address: SlurSegmentEndpointAddress, dx: number, dy: number, spanCount: number): boolean {
      if (!ctx.limits.nudgeStaysOnPage('slur', id, dx, dy)) return false
      const ok = ctx.model().setSlurSegmentEndpointOffset(id, address, dx, dy, spanCount)
      if (ok) ctx.mutate('Nudge slur segment endpoint')
      return ok
    },

    /** Flip a slur with a Sibelius-style `x` toggle: auto ↔ flipped. When the slur already
     *  carries an explicit `placement`, clear it back to the context-aware auto default;
     *  otherwise set an explicit side opposite to whatever was last *drawn* (read from the
     *  registry), so the first press always visibly flips. Two presses round-trip to auto.
     *  Saves one undo step. @returns true if it flipped. */
    flipSlur(id: string): boolean {
      const slur = ctx.model().getSlurById(id)
      if (!slur) return false
      if (slur.placement !== undefined) {
        // Overridden → return to the auto (stem-derived) default.
        delete slur.placement
        ctx.mutate('Reset slur to auto')
        return true
      }
      // Auto → pin the opposite of the last-drawn side. Guarded so a stubbed/headless
      // renderer just falls back to "above" (dir -1).
      const el = ctx.registry().getByType?.('slur').find(e => e.id === id)
      const currentDir = el?.slurDirection ?? -1
      slur.placement = currentDir === -1 ? 'below' : 'above'
      ctx.mutate('Flip slur')
      return true
    },
  }
  return commands
}
