/**
 * ⭐ **THE HAIRPIN's COMMANDS** — every edit the editor can make to a wedge, built from a
 * {@link CommandContext}; `MusicEngine` keeps `readonly hairpin = hairpinCommands(ctx)`, and a
 * caller writes `engine.hairpin.nudgeHairpin(…)`. The ottava's arrangement (`./ottavaCommands`).
 *
 * Everything a wedge IS lives in `engine/models/hairpinOps`. What a command adds is the LIMIT that
 * may refuse a hand-nudge — ⚠️ judged per END here, because a `y` on one end TILTS the wedge, so the
 * ink that may enter a neighbour's room is that end's own — and the undo entry.
 */
import type { Fraction, Hairpin } from '@/types/music'
import { slotLength } from '@/utils/durations'
import type { InkBox } from '../layout/pageBounds'
import type { HairpinDragWrite, HairpinEndStop, HairpinSlotTarget, HairpinStaffSlotTarget } from '../models/hairpinOps'
import { spanFromNotes } from '../models/spanFromNotes'
import type { CommandContext } from './commandContext'

export type HairpinCommands = ReturnType<typeof hairpinCommands>

export function hairpinCommands(ctx: CommandContext) {
  /**
   * ⭐⭐ **The drawn SQUARE of the hairpin end being moved** — {@link slurEndpointInk}'s twin, and for
   * its reason: a BAND is about one point's room, so the ink judged is that point. ⛔ Never the
   * wedge's own box, which on a split hairpin spans two systems and would refuse every step.
   *
   * ⛔ Empty when the squares are not drawn (the wedge is not selected), which the rule reads as
   * "nothing to measure" and allows — the same answer the page limit gives for un-drawn ink.
   */
  function endpointInk(id: string, which: 'start' | 'end'): InkBox[] {
    const registry = ctx.registry()
    return (registry.getByType?.('hairpin-endpoint') ?? [])
      .filter(e => e.hairpinId === id && e.endpoint === which)
      .map(e => e.bbox)
  }

  /** Which bar and staff that end was DRAWN in, so the band rule knows whose neighbours to ask.
   *  ⭐ The FIRST fragment holds the start and the LAST holds the end (`elements/hairpinHandles`), so
   *  a wedge split across systems is judged in the system the moved end actually lives in. */
  function endpointLane(id: string, which: 'start' | 'end'): { measure: number; staff: number } | null {
    const registry = ctx.registry()
    const pieces = (registry.getByType?.('hairpin') ?? []).filter(e => e.id === id)
    const piece = which === 'start' ? pieces[0] : pieces[pieces.length - 1]
    return piece?.measure === undefined ? null : { measure: piece.measure, staff: piece.staff ?? 0 }
  }

  /**
   * ⭐⭐ **Both limits a hairpin end's ink must satisfy** — it may not leave its SHEET
   * ({@link nudgeStaysOnPage}) and it may not move into a neighbouring staff's room
   * ({@link nudgeStaysInBand}). The slur's pair exactly (his ask, 2026-08-20: *"we should not go
   * crazy… for the slur we have a y limit, we have to do something similar here"*), and shared by the
   * keyboard nudge and every drag frame so the two devices cannot disagree about what is allowed.
   *
   * ⛔ **The walk's RE-BASE does not come through here**, and must not: it does not move the drawn
   * mark at all ({@link previewHairpinEndpointRebase}).
   */
  function endpointOffsetAllowed(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    // 🚨 TWO AXES, TWO QUESTIONS — his report, 2026-08-21: *"take care that the endpoint is not out
    // of the page, now half is out of the page"*. The horizontal moves ONE TIP and its square
    // ({@link spanEndStaysOnPage}); a `y` tilts the whole wedge, so it is the whole drawn thing that
    // is judged.
    if (!ctx.limits.spanEndStaysOnPage('hairpin', id, which, dx)) return false
    if (dy !== 0 && !ctx.limits.nudgeStaysOnPage('hairpin', id, 0, dy)) return false
    const lane = endpointLane(id, which)
    return !lane || ctx.limits.nudgeStaysInBand(endpointInk(id, which), lane.measure, lane.staff, dy)
  }

  return {
    /**
     * Add a hairpin starting at (measure, `hairpin.beat`) and covering `hairpin.length` of music.
     * `beat` must be a slot-boundary beat. Saves undo state when added.
     * @returns the stored Hairpin, or null if the measure is missing or the length is not positive.
     */
    addHairpin(measureNumber: number, hairpin: Omit<Hairpin, 'id'>): Hairpin | null {
      const created = ctx.model().addHairpin(measureNumber, hairpin)
      if (created) {
        ctx.mutate(`Add ${created.type === 'cresc' ? 'crescendo' : 'diminuendo'} at measure ${measureNumber}`)
      }
      return created
    },

    /**
     * ⭐ **Create a hairpin over the notes the user meant** — the `H` / `Shift+H` key, the Lines
     * palette rows and the armed stamp's click all arrive here, so a wedge made one way is the wedge
     * the other two would have made.
     *
     * The note resolution is `createSlur`'s: a hairpin lives in ONE voice on ONE staff, taken from
     * the first resolved note, and notes in other lanes are dropped rather than silently widening the
     * span.
     *
     * ⭐⭐ **THE WEDGE COVERS EXACTLY THE MUSIC SELECTED — never a note more.** From the first
     * selected note's onset to the END of the last selected one, so with ONE note it covers that note
     * and stops where the next begins. His report on seeing the first build, 2026-08-12: selecting a
     * whole-note E and pressing `H` drew a wedge running to the far edge of the F after it —
     * *"what is expected for me is that it end when the F starts"*. He is right, and it is what a
     * hairpin MEANS: the wedge is the approach, and the note you arrive on is where the new level is
     * reached, not part of the climb.
     *
     * ⛔ This deliberately drops the plan's §11.4 sketch ("this note → the end of the NEXT slot").
     * That was reasoned from minimum-length — a wedge over one quarter is short — but the fix for a
     * short wedge is the angle cap (`rendering/hairpinShape.ts`), not silently covering music the
     * user did not select. `Ctrl+→` is how a wedge grows, and it is the only thing that should.
     *
     * ⛔ **A REST cannot anchor one.** A hairpin says the sounding music is getting louder; the engine
     * resolves by slot and would happily span from silence, so the refusal is here.
     *
     * Idempotent (`addHairpinOverNotes` returns an identical existing wedge). Saves undo state.
     * @returns the stored Hairpin, or null when there is no usable span.
     */
    createHairpin(noteIds: string[], type: Hairpin['type']): Hairpin | null {
      const span = spanFromNotes(ctx.model(), noteIds, { byVoice: true, sounding: true })
      if (!span) return null
      // The LAST SELECTED note, even when that is the only one — the span is the selection's, and
      // `addHairpinOverNotes` adds that note's own length so the wedge ends where the next begins.
      // ⭐⭐ The lane CHOOSES the notes; it does not become the wedge's SCOPE. `byVoice` filtered the
      // selection to one stream (a wedge cannot span two), and the voice is deliberately NOT passed
      // on: a wedge with no voice governs every voice of its staff, which is the default the user
      // asked for. Narrowing it is a second, explicit act. See docs/dynamic-voice-scope-plan.md.
      const { start: startNote, end: endNote, staff } = span

      const created = ctx.model().addHairpinOverNotes(
        type,
        { measure: startNote.measure, beat: startNote.beat },
        { measure: endNote.measure, beat: endNote.beat, length: slotLength(endNote) },
        { ...(ctx.staffIdForIndex(staff) !== undefined ? { staffId: ctx.staffIdForIndex(staff) } : {}) },
      )
      if (created) ctx.mutate(`Add ${type === 'cresc' ? 'crescendo' : 'diminuendo'}`)
      return created
    },

    /** Remove a hairpin by id. Saves undo state when removed. @returns true if one was removed. */
    removeHairpin(id: string): boolean {
      const removed = ctx.model().removeHairpin(id)
      if (removed) ctx.mutate('Remove hairpin')
      return removed
    },

    /** Edit a hairpin by id. Saves undo state when found. @returns the updated Hairpin, or null. */
    updateHairpin(id: string, updates: Partial<Omit<Hairpin, 'id'>>): Hairpin | null {
      const updated = ctx.model().updateHairpin(id, updates)
      if (updated) ctx.mutate('Edit hairpin')
      return updated
    },

    /**
     * Set how much music a hairpin covers — the model write behind lengthen/shorten. ⚠️ This is a
     * CONTENT edit, not an engraving nudge: the same key on a slur endpoint one branch over writes
     * an override instead (docs/dynamics-line-and-hairpins-plan.md §4). Saves undo state.
     * @returns true if the hairpin exists and the length is positive.
     */
    setHairpinLength(id: string, length: Fraction): boolean {
      const ok = ctx.model().setHairpinLength(id, length)
      if (ok) ctx.mutate('Change hairpin length')
      return ok
    },

    /**
     * Grow (+1) or shrink (−1) the hairpin by one slot of its own lane — `Ctrl+→` / `Ctrl+←`.
     * ⚠️ A CONTENT edit: it rewrites `length`, where the same key on a slur endpoint writes an
     * engraving override (docs/dynamics-line-and-hairpins-plan.md §4). Saves undo state.
     * @returns true when the wedge changed; false (declining the key) when there is nothing to
     *   reach, or when shrinking would leave it covering no music.
     */
    resizeHairpinBySlot(id: string, direction: 1 | -1): boolean {
      const ok = ctx.model().resizeHairpinBySlot(id, direction)
      if (ok) ctx.mutate(direction === 1 ? 'Lengthen hairpin' : 'Shorten hairpin')
      return ok
    },

    /**
     * Move the hairpin's START one slot earlier (−1) or later (+1) **without moving its end** —
     * `Ctrl+Shift+←/→` with the wedge's left square armed.
     *
     * ⚠️ A CONTENT edit like the resize beside it, and the one that writes BOTH of the model's fields:
     * holding the end still means `length' = end − start'` (see `hairpinOps.moveHairpinStartBySlot`
     * for why that is not a sign the model wants two addresses). Saves ONE undo state for the pair.
     * @returns true when the start moved; false (declining the key) when there is no slot to reach, or
     *   when it would reach the end.
     */
    moveHairpinStartBySlot(id: string, direction: 1 | -1): boolean {
      const ok = ctx.model().moveHairpinStartBySlot(id, direction)
      if (ok) ctx.mutate(direction === -1 ? 'Extend hairpin start' : 'Trim hairpin start')
      return ok
    },

    /**
     * Where {@link moveHairpinStartBySlot} would put the start, WITHOUT putting it there — a pure
     * read, no undo entry. The interpolating walk (`interactions/hairpinStartWalk`) asks before it
     * decides whether a press re-anchors or only nudges ink, and asks THIS so the two keys can never
     * land the start on different notes. @returns null at either end of the lane.
     */
    nextHairpinStartSlot(id: string, direction: 1 | -1): HairpinSlotTarget | null {
      return ctx.model().nextHairpinStartSlot(id, direction)
    },

    /**
     * Where {@link resizeHairpinBySlot} would put the TIP, WITHOUT putting it there — a pure read,
     * {@link nextHairpinStartSlot}'s twin at the other end, and named in the drag's vocabulary so the
     * three routes to the tip cannot disagree about where it may stand.
     */
    nextHairpinEndStop(id: string, direction: 1 | -1): HairpinEndStop | null {
      return ctx.model().nextHairpinEndStop(id, direction)
    },

    /**
     * Live (preview) end-move used **while dragging a hairpin's square** — writes the model but does
     * NOT record undo; call {@link commitHairpinDrag} on the drop for the single entry (the
     * `previewSlurEndpoint` / `commitSlurEndpoint` pair, and for its reason: every frame of a drag
     * would otherwise be its own undo step).
     *
     * `write` carries the address AND which boundary of it the grabbed square lands on — the tip sits
     * where the renderer draws it, which is a note's left edge rather than its head (see
     * {@link HairpinDragWrite}). @returns true when the model changed.
     */
    previewHairpinEnd(id: string, write: HairpinDragWrite): boolean {
      ctx.markDirty() // live drag, undo deferred to commitHairpinDrag — see previewSlurShape
      return ctx.model().applyHairpinDrag(id, write)
    },

    /** Record ONE undo entry after a hairpin-square drag settles. */
    commitHairpinDrag(which: 'start' | 'end'): void {
      ctx.commitPreviewed(which === 'start' ? 'Move hairpin start' : 'Resize hairpin')
    },

    /**
     * Nudge one drawn END of a hairpin by a staff-space delta and save ONE undo step — the wedge's
     * RESHAPE (plain arrow fine, `Ctrl`+arrow coarse, with that square armed).
     *
     * ⚠️ An ENGRAVING OVERRIDE, where `resizeHairpinBySlot` one method up writes the model: same two
     * squares, two chords, two categories. Nothing about the music moves — playback cannot tell — and
     * that is exactly why it may not be stored as a shorter `length`
     * (docs/dynamics-line-and-hairpins-plan.md §4).
     */
    nudgeHairpinEndpoint(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
      if (!endpointOffsetAllowed(id, which, dx, dy)) return false
      const ok = ctx.model().setHairpinEndpointOffset(id, which, dx, dy)
      if (ok) ctx.mutate('Reshape hairpin')
      return ok
    },

    /**
     * Move the WHOLE selected wedge by a staff-space delta and save ONE undo step — the arrows with a
     * hairpin selected and NO square armed.
     *
     * ⚠️ An ENGRAVING OVERRIDE like the per-end nudge it is made of (both ends, same delta): the wedge
     * moves on the page and covers the same notes, so nothing about the music changes. Moving WHICH
     * notes it covers is `Ctrl+Shift+←/→` on a square, which writes the model instead.
     */
    nudgeHairpin(id: string, dx: number, dy: number): boolean {
      if (!ctx.limits.nudgeStaysOnPage('hairpin', id, dx, dy)) return false
      const ok = ctx.model().setHairpinOffset(id, dx, dy)
      if (ok) ctx.mutate('Move hairpin')
      return ok
    },

    /**
     * ⭐⭐ **RE-BASE one end's ink — the walk's bookkeeping, ⛔ NOT a hand nudge.** When the walk hands
     * the wedge to its next stop it takes the same distance back out of the offset, so the DRAWN
     * position does not change at all; the pair *(anchor := the next stop, offset −= the gap)* is an
     * identity. No undo entry of its own.
     *
     * 🚨 **Which is why the PAGE LIMIT must not see it**, here or in any family's re-base. The limit
     * judges a delta against the LAST RENDER's ink, where the anchor has not moved yet — so it reads a
     * re-base as a hand shoving the mark half a bar sideways and refuses it. Refused, the anchor has
     * moved and the offset has not, and the next press crosses again: a runaway to the end of the
     * score. ⚠️ A rule about where INK may go can only be asked of a gesture that MOVES ink.
     */
    previewHairpinEndpointRebase(id: string, which: 'start' | 'end', dx: number): boolean {
      ctx.markDirty() // live drag, undo deferred to commitHairpinDrag
      return ctx.model().setHairpinEndpointOffset(id, which, dx, 0)
    },

    /**
     * Live (preview) nudge of ONE end's ink used **while dragging a hairpin's SQUARE** — writes the
     * override but records NO undo; the drop commits once ({@link commitHairpinDrag}).
     *
     * ⭐ It is {@link nudgeHairpinEndpoint} without the undo, and ACCUMULATING like it: the caller
     * passes the delta since the last accepted frame, never a total. The page limit still refuses the
     * write, so a wedge dragged off the sheet simply stops moving (⛔ the drawing is never clamped).
     */
    previewHairpinEndpointOffset(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
      if (!endpointOffsetAllowed(id, which, dx, dy)) return false
      ctx.markDirty() // live drag, undo deferred to commitHairpinDrag
      return ctx.model().setHairpinEndpointOffset(id, which, dx, dy)
    },

    /**
     * ⭐⭐ **Move the whole wedge onto `target`, keeping its length** — the BODY drag's walk and its
     * system jump. ⚠️ A CONTENT edit: it changes which notes get louder, and it is AUDIBLE.
     *
     * ⭐ Preview + commit, like every other drag write here: no undo entry of its own, and
     * {@link commitHairpinOffsetDrag} records the gesture once on the drop.
     */
    previewHairpinSlot(id: string, target: HairpinSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitHairpinOffsetDrag
      return ctx.model().setHairpinAtSlot(id, target)
    },

    /**
     * ⭐⭐ **…and onto ANOTHER STAFF's slot** — the VERTICAL half of the same drag (his ask,
     * 2026-08-21). The staff below is a place a dragged wedge can land, not only the system below:
     * `hairpinOps.setHairpinAtStaffSlot`, the dynamic's `previewDynamicSlot` one day on.
     *
     * ⚠️ Its own method rather than a wider `target` on {@link previewHairpinSlot}: that one is also
     * the BODY WALK's write, which travels sideways inside one lane and has no staff to say.
     */
    previewHairpinStaffSlot(id: string, target: HairpinStaffSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitHairpinOffsetDrag
      return ctx.model().setHairpinAtStaffSlot(id, target)
    },

    /** Live (preview) flip of which SIDE of its staff a wedge is drawn on — the body drag's step
     *  between "below this staff" and "above it", before any question of another system arises. No undo
     *  entry; the drop commits once. */
    previewHairpinPlacement(id: string, placement: 'above' | 'below'): boolean {
      ctx.markDirty()
      return !!ctx.model().updateHairpin(id, { placement })
    },

    /** The whole wedge's RE-BASE — {@link previewHairpinEndpointRebase} for both ends at once, and ⛔
     *  outside the page limit for its reason: the pair (anchor moves, ink gives the same back) does not
     *  move the drawn wedge at all. */
    previewHairpinOffsetRebase(id: string, dx: number, dy = 0): boolean {
      ctx.markDirty()
      return ctx.model().setHairpinOffset(id, dx, dy)
    },

    /**
     * Live (preview) whole-wedge move used **while dragging a hairpin's BODY** — writes the model but
     * does NOT record undo; call {@link commitHairpinOffsetDrag} on the drop for the single entry.
     * `previewHairpinEnd` / `commitHairpinDrag`'s pair, and for its reason: every frame of a drag
     * would otherwise be its own undo step.
     *
     * ⚠️ It is {@link nudgeHairpin} without the undo — an ACCUMULATING nudge, so the caller passes the
     * delta since the last accepted frame rather than a total. And the PAGE LIMIT still refuses the
     * write, so a wedge dragged off the sheet simply stops moving (⛔ the drawing is never clamped —
     * see `nudgeStaysOnPage`).
     * @returns true when the model changed.
     */
    previewHairpinOffset(id: string, dx: number, dy: number): boolean {
      if (!ctx.limits.nudgeStaysOnPage('hairpin', id, dx, dy)) return false
      ctx.markDirty() // live drag, undo deferred to commitHairpinOffsetDrag
      return ctx.model().setHairpinOffset(id, dx, dy)
    },

    /** Record ONE undo entry after a hairpin BODY drag settles. */
    commitHairpinOffsetDrag(): void {
      ctx.commitPreviewed('Move hairpin')
    },

    /** Drop BOTH ends' reshapes and save ONE undo step (`Ctrl+Backspace`, nothing armed).
     *  @returns false when neither end carries one, so the key falls through. */
    resetHairpinOffset(id: string): boolean {
      const ok = ctx.model().resetHairpinOffset(id)
      if (ok) ctx.mutate('Reset hairpin position')
      return ok
    },

    /** Drop ONE end's reshape and save ONE undo step (`Ctrl+Backspace` with that square armed).
     *  @returns false when that end has no offset, so the key falls through. */
    resetHairpinEndpointOffset(id: string, which: 'start' | 'end'): boolean {
      const ok = ctx.model().resetHairpinEndpointOffset(id, which)
      if (ok) ctx.mutate('Reset hairpin end')
      return ok
    },

    /**
     * Set (or clear with `null`) the selected hairpin's MOUTH, in staff-spaces, and save ONE undo step
     * (the Properties input).
     *
     * ⚠️ An ENGRAVING OVERRIDE, like the end nudges and unlike the extent — how wide a wedge opens is
     * drawing, and the loudness it means is the same either way. It replaces the automatic length-aware
     * aperture; the steepness cap still applies over it, so a short wedge cannot be authored into an
     * arrowhead. @returns false when the hairpin is unknown, the value is not positive, or there was
     * nothing to clear.
     */
    setHairpinAperture(id: string, aperture: number | null): boolean {
      const ok = ctx.model().setHairpinAperture(id, aperture)
      if (ok) ctx.mutate(aperture === null ? 'Reset hairpin mouth' : 'Set hairpin mouth')
      return ok
    },

    /** Flip a hairpin between crescendo and diminuendo. Saves undo state. @returns the new type. */
    toggleHairpinType(id: string): 'cresc' | 'dim' | null {
      const type = ctx.model().toggleHairpinType(id)
      if (type) ctx.mutate(`Change to ${type === 'cresc' ? 'crescendo' : 'diminuendo'}`)
      return type
    },

    /**
     * ⭐⭐ Move a wedge to the other dynamics lane — above the staff ⇄ below it (his ask, 2026-08-22).
     * The keyboard's instrument for what the body drag already does by crossing the staff's own lines;
     * `hairpinOps.flipHairpinPlacement` carries the rule about which offsets survive.
     *
     * ⚠️ A CONTENT edit — which side a wedge stands on is engraving the writer authored, not a nudge —
     * so it saves undo state. @returns the side it now sits on.
     */
    flipHairpinPlacement(id: string): 'above' | 'below' | null {
      const placement = ctx.model().flipHairpinPlacement(id)
      if (placement) ctx.mutate(`Move hairpin ${placement} the staff`)
      return placement
    },
  }
}
