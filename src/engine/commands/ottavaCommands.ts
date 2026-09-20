/**
 * ⭐ **THE OCTAVE LINE's COMMANDS** — every edit the editor can make to one, as typed functions built
 * from a {@link CommandContext}. `MusicEngine` keeps `readonly ottava = ottavaCommands(ctx)`; a
 * caller writes `engine.ottava.nudgeOttava(…)`, and a walk that needs three of them asks for
 * `Pick<OttavaCommands, …>` rather than for the facade.
 *
 * Everything an octave line IS lives in `engine/models/ottavaOps`; what a command adds is the
 * editor's own concern and nothing else — the LIMIT that may refuse a hand-nudge, and the undo entry.
 *
 * ⚠️ Every edit records ONE undo entry (`mutate`), audible or not — but WHICH are audible is said per
 * command, because it is true of the music: an edit to the EXTENT or the direction changes what the
 * covered notes SOUND; moving ink does not. A live drag frame records nothing (`markDirty`) and its drop records once
 * (`commitPreviewed`).
 */
import type { Ottava } from '@/types/music'
import { slotLength } from '@/utils/durations'
import type { OttavaDragWrite, OttavaSlotTarget, OttavaStaffSlotTarget } from '../models/ottavaOps'
import { spanFromNotes } from '../models/spanFromNotes'
import type { CommandContext } from './commandContext'

export type OttavaCommands = ReturnType<typeof ottavaCommands>

export function ottavaCommands(ctx: CommandContext) {
  /**
   * ⭐⭐ **Both limits an octave bracket's ink must satisfy** — the wedge's pair, one lane over: it may
   * not leave its SHEET ({@link spanEndStaysOnPage} horizontally, {@link nudgeStaysOnPage}
   * vertically) and it may not move into a neighbouring staff's room ({@link nudgeStaysInBand}).
   *
   * 🚨 **His report, 2026-08-21, on the new vertical drag**: *"we should not go crazy, we have to
   * limit the user somehow here in the y so the ottava is on the system it belongs to"* — the same
   * sentence that produced the band rule for the slur and then the wedge, arriving a third time. ⛔ So
   * it is not a new rule: the bracket simply had no vertical drag to be judged until now.
   *
   * ⚠️ Shared by the keyboard nudge and every drag frame, so the two devices cannot disagree about
   * what is allowed. ⛔ The walk's RE-BASE does not come through here and must not: it moves no ink
   * ({@link previewHairpinEndpointRebase}).
   *
   * @param dy SCREEN staff-spaces (+down) — ⚠️ the caller converts its OUTWARD number first, since
   *   both limits predict where INK lands.
   */
  function endpointOffsetAllowed(
    id: string,
    which: 'start' | 'end',
    dx: number,
    dy: number,
  ): boolean {
    if (!ctx.limits.spanEndStaysOnPage('ottava', id, which, dx)) return false
    if (dy === 0) return true
    return ctx.limits.nudgeStaysOnPage('ottava', id, 0, dy) && staysInBand(id, dy)
  }

  /**
   * ⭐ **Would this lift put any piece of the bracket in a neighbour's room?** — {@link
   * nudgeStaysInBand} asked of the whole line, because an octave bracket's vertical is ONE number and
   * every fragment rises with it.
   *
   * ⚠️ **Each fragment is judged against ITS OWN system's band**, exactly as the page limit judges
   * each against its own sheet: a bracket cut by a system break has pieces on two staves, and one
   * staff's neighbours say nothing about the other's. Any piece the step would push into a
   * neighbour's room blocks it, since the height they share is one field.
   */
  function staysInBand(id: string, dy: number): boolean {
    return (ctx.registry().getByType?.('ottava') ?? [])
      .filter(e => e.id === id)
      .every(e => e.measure === undefined
        || ctx.limits.nudgeStaysInBand([e.bbox], e.measure, e.staff ?? 0, dy))
  }

  return {
    /**
     * Add an octave line starting at (measure, `ottava.beat`) covering `ottava.length` of music,
     * REPLACING any line already on that (beat, staff) — the clef's rule, see
     * {@link ottavaOps.addOttava}. `beat` must be a slot-boundary beat. Saves undo state when added.
     * @returns the stored Ottava, or null if the measure is missing or the length is not positive.
     */
    addOttava(measureNumber: number, ottava: Omit<Ottava, 'id'>): Ottava | null {
      const created = ctx.model().addOttava(measureNumber, ottava)
      if (created) ctx.mutate(`Add ${created.shift > 0 ? '8va' : '8vb'} at measure ${measureNumber}`)
      return created
    },

    /**
     * ⭐ **Create an octave line over the notes the user meant** — the Lines window's row and the armed
     * stamp's click both arrive here, so a line made one way is the line the other would have made.
     *
     * ⭐⭐ **The lane is a STAFF, not a (staff, voice) pair** — the one place this parts company with
     * `createSlur` / `createHairpin` / `createTrill`, all of which narrow to the first note's voice
     * and drop the rest. An ottava governs the staff, so a selection spanning two voices of one staff
     * produces ONE line covering both, and narrowing would silently leave half the selection sounding
     * where it was. Notes on OTHER staves are still dropped: an octave line cannot govern two.
     *
     * ⭐ **The span COVERS the last note** (`addOttavaOverNotes` adds that note's own length), which
     * for one selected note means the line covers exactly that note. Unlike the hairpin's — where "end
     * where the next note begins" was his correction — that is not a matter of taste here: the span is
     * half-open, so an end on the last note's onset would leave it drawn under the bracket and
     * sounding un-shifted.
     *
     * ⛔ **A REST cannot anchor one**, the hairpin's refusal and for its reason: an octave line
     * displaces sounding music, and the engine resolves by slot, so it would happily start from
     * silence.
     *
     * ⏭️ **§7.3, THE OPEN QUESTION, and this is where it is answered by hand.** Selecting a high
     * passage and pressing 8va can either (a) leave the noteheads and let the passage sound an octave
     * higher — Sibelius's, and what this does — or (b) drop every covered note's written pitch an
     * octave in the same batch so the SOUND is unchanged and the noteheads come down off their ledger
     * lines — Dorico's. (b) is one added loop over the covered notes calling `updateNote`, inside this
     * same `runBatch`, and it is **not a stored flag** either way (docs/plans/ottava-plan.md §2's tail).
     * Shipping (a) first because it is the literal reading of the gesture — the command adds a MARK —
     * and because it is not destructive: (b) rewrites pitches, and a wrong default there is undone one
     * `Ctrl+Z` at a time on real music.
     *
     * @returns the stored Ottava, or null when there is no usable span.
     */
    createOttava(noteIds: string[], shift: Ottava['shift']): Ottava | null {
      const span = spanFromNotes(ctx.model(), noteIds, { byVoice: false, sounding: true })
      if (!span) return null
      const { start: startNote, end: endNote, staff } = span

      const created = ctx.model().addOttavaOverNotes(
        shift,
        { measure: startNote.measure, beat: startNote.beat },
        { measure: endNote.measure, beat: endNote.beat, length: slotLength(endNote) },
        ctx.staffIdForIndex(staff),
      )
      if (created) ctx.mutate(`Add ${shift > 0 ? '8va' : '8vb'}`)
      return created
    },

    /**
     * ⭐ Flip a selected octave line's DIRECTION — 8va ↔ 8vb, 15ma ↔ 15mb — the `x` key's ottava
     * branch (`interactions/state/flipSelection.ts`). His request, 2026-08-17.
     *
     * ⚠️ **AUDIBLE, and that is the difference from the trill's branch of the same
     * key.** Flipping a trill swaps a SIDE — nothing audible — so it only records undo. An ottava's
     * shift is what the covered notes SOUND (`soundingShiftAt`), which is the hairpin's
     * case too. ⚠️ Playback reads the SAME live
     * score object today (`ScoreModel.getScore` returns the model's own), so what this actually buys
     * is the convention, not a fix for a stale-playback bug — but the classification is the part a
     * future non-live score would depend on. @returns the new shift, or null if no ottava has that id.
     */
    toggleOttavaDirection(id: string): Ottava['shift'] | null {
      const shift = ctx.model().toggleOttavaDirection(id)
      if (shift) ctx.mutate(`Flip octave line to ${shift > 0 ? '8va' : '8vb'}`)
      return shift
    },

    /**
     * Re-anchor an octave line's END by one slot of its staff — `Ctrl+Shift+→` / `←` with its end
     * square armed. Saves undo state when it changed. See {@link ottavaOps.resizeOttavaBySlot}.
     *
     * ⚠️ **A CONTENT edit, like the flip above it**: the notes the bracket newly covers (or lets go)
     * change octave when they SOUND. Hence AUDIBLE.
     */
    resizeOttavaBySlot(id: string, direction: 1 | -1): boolean {
      const ok = ctx.model().resizeOttavaBySlot(id, direction)
      if (ok) ctx.mutate(direction === 1 ? 'Lengthen octave line' : 'Shorten octave line')
      return ok
    },

    /**
     * Move an octave line's BEGINNING by one slot of its staff, holding its end — `Ctrl+Shift+←/→`
     * with its start square armed. Saves undo state when it changed. See
     * {@link ottavaOps.moveOttavaStartBySlot}.
     */
    moveOttavaStartBySlot(id: string, direction: 1 | -1): boolean {
      const ok = ctx.model().moveOttavaStartBySlot(id, direction)
      if (ok) ctx.mutate('Move octave line start')
      return ok
    },

    /**
     * ⭐⭐ **Nudge the armed end of an octave bracket's INK** — a plain or `Ctrl` arrow with that square
     * armed. Staff-spaces; screen-down is +y.
     *
     * ⭐ **`outward` moves the WHOLE bracket** however it is asked for, because an octave line is a
     * straight horizontal rule and {@link OttavaOffsetOverride} has nowhere to put a second height.
     * That is his rule, kept in the model's SHAPE rather than in the code that writes it.
     *
     * ⭐⭐ **`outward` is a distance FROM THE STAFF, not a screen delta** — `+` is up for an 8va and
     * down for an 8vb (his correction: a screen value reads backwards on one side). ⚠️ Callers that
     * speak screen convert on the way in; `shortcutWiring` is the one that does, because `↑` is a
     * screen direction. `dx` is unaffected — right is right on both sides of the staff.
     *
     * ⚠️ An override: moving ink changes nothing audible, unlike
     * the extent edits above it.
     */
    nudgeOttavaEndpoint(id: string, which: 'start' | 'end', dx: number, outward: number): boolean {
      // ⚠️ The PAGE LIMIT predicts where ink lands, so it needs a SCREEN delta — the second of the two
      // places that convert (the renderer is the other). Above the staff, further out is further UP.
      const above = (ctx.model().getOttavaById(id)?.shift ?? 1) > 0
      // 🚨🚨 **TWO AXES, TWO QUESTIONS, because they move DIFFERENT INK** (his report, 2026-08-21).
      // The horizontal moves ONE EDGE of the bracket; the vertical is a single shared number and lifts
      // the WHOLE line — and only it can enter a neighbour's room. {@link ottavaEndpointOffsetAllowed}.
      if (!endpointOffsetAllowed(id, which, dx, above ? -outward : outward)) return false
      const ok = ctx.model().setOttavaEndpointOffset(id, which, dx, outward)
      if (ok) ctx.mutate('Nudge octave line')
      return ok
    },

    /**
     * ⭐⭐ **Move the WHOLE octave bracket** by a staff-space delta and save ONE undo step — the arrows
     * with an ottava selected and NO square armed.
     *
     * ⚠️ `outward` is a distance FROM THE STAFF, like its per-end twin, and the page limit needs a
     * SCREEN delta to predict where the ink lands — so the same negation happens here.
     */
    nudgeOttava(id: string, dx: number, outward: number): boolean {
      const above = (ctx.model().getOttavaById(id)?.shift ?? 1) > 0
      const dy = above ? -outward : outward
      // ⭐ The whole-object page rule is right HERE, unlike the per-end nudge: this really does
      // translate every piece. ⚠️ The BAND is the same question either way — see
      // {@link ottavaEndpointOffsetAllowed} for his report.
      if (!ctx.limits.nudgeStaysOnPage('ottava', id, dx, dy)) return false
      if (dy !== 0 && !staysInBand(id, dy)) return false
      const ok = ctx.model().setOttavaOffset(id, dx, outward)
      if (ok) ctx.mutate('Nudge octave line')
      return ok
    },

    /**
     * ⭐⭐ **Move the whole bracket onto `target`, keeping its length** — the body walk's crossing write
     * (`interactions/walks/ottavaWalk`). It keeps both ends' nudges (`ottavaOps` writes no override here): the
     * crossing is meant to be invisible, and the caller re-bases the offset rather than wiping it. No
     * undo entry of its own; {@link commitOttavaOffsetDrag} records the gesture once.
     */
    previewOttavaSlot(id: string, target: OttavaSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitOttavaOffsetDrag
      return ctx.model().setOttavaAtSlot(id, target)
    },

    /**
     * ⭐⭐ **…and onto ANOTHER STAFF's onset** — the VERTICAL half of the same drag (his ask,
     * 2026-08-21), the last of the five families to get it: `ottavaOps.setOttavaAtStaffSlot`.
     *
     * ⚠️⚠️ **AUDIBLE, and more so than its siblings' landings**: an octave line TRANSPOSES the staff it
     * is filed under, so moving it moves which notes sound an octave away.
     *
     * ⚠️ Its own method rather than a wider `target` on {@link previewOttavaSlot}: that one is also the
     * BODY WALK's re-anchor, which travels sideways inside one lane and has no staff to say.
     */
    previewOttavaStaffSlot(id: string, target: OttavaStaffSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitOttavaOffsetDrag
      return ctx.model().setOttavaAtStaffSlot(id, target)
    },

    /**
     * Live (preview) nudge of the WHOLE bracket's ink — a BODY drag. {@link nudgeOttava} without the
     * undo, and accumulating like it; the page and band limits still refuse the write.
     *
     * ⚠️ `outward` is a distance FROM THE STAFF, like every other ottava vertical — the caller converts
     * its screen delta on the way in.
     */
    previewOttavaOffset(id: string, dx: number, outward: number): boolean {
      const above = (ctx.model().getOttavaById(id)?.shift ?? 1) > 0
      const dy = above ? -outward : outward
      if (!ctx.limits.nudgeStaysOnPage('ottava', id, dx, dy)) return false
      if (dy !== 0 && !staysInBand(id, dy)) return false
      ctx.markDirty() // live drag, undo deferred to commitOttavaOffsetDrag
      return ctx.model().setOttavaOffset(id, dx, outward)
    },

    /** The whole bracket's RE-BASE — both ends by the same delta, no undo of its own, and ⛔ never
     *  judged by the page limit or the band ({@link previewHairpinEndpointRebase} has the reason).
     *
     *  ⚠️ `outward` is the second half of the same bookkeeping and is unjudged for the same reason: a
     *  re-base pays back a move the ANCHOR made, so the drawn ink does not move and there is nothing
     *  for a limit to have an opinion about (`interactions/walks/ottavaWalk.jumpStaves`). */
    previewOttavaOffsetRebase(id: string, dx: number, outward = 0): boolean {
      ctx.markDirty()
      return ctx.model().setOttavaOffset(id, dx, outward)
    },

    /** Record ONE undo entry after a bracket BODY drag settles. */
    commitOttavaOffsetDrag(): void {
      ctx.commitPreviewed('Move octave line')
    },

    /** `Ctrl+Backspace` with a bracket selected and nothing armed: every nudge dropped. DECLINEs when
     *  it carries none. */
    resetOttavaOffset(id: string): boolean {
      const ok = ctx.model().resetOttavaOffset(id)
      if (ok) ctx.mutate('Reset octave line nudge')
      return ok
    },

    /** `Ctrl+Backspace` on an armed square: that end's `x` and the shared `y` back to the engraver's
     *  own. @returns false when it carries no nudge, so the key falls through. */
    resetOttavaEndpointOffset(id: string, which: 'start' | 'end'): boolean {
      const ok = ctx.model().resetOttavaEndpointOffset(id, which)
      if (ok) ctx.mutate('Reset octave line nudge')
      return ok
    },

    /**
     * Where {@link resizeOttavaBySlot} would put the HOOK, WITHOUT putting it there — a pure read, no
     * undo entry. The interpolating walk (`interactions/walks/ottavaWalk`) asks before it decides whether a
     * press re-anchors or only nudges ink, and asks THIS so the two keys can never land the bracket's
     * end on different notes. @returns null at either end of the road.
     */
    nextOttavaEndSlot(id: string, direction: 1 | -1): OttavaSlotTarget | null {
      return ctx.model().nextOttavaEndSlot(id, direction)
    },

    /** Where {@link moveOttavaStartBySlot} would put the BEGINNING, without putting it there —
     *  {@link nextOttavaEndSlot}'s twin at the other square, and for its reason. */
    nextOttavaStartSlot(id: string, direction: 1 | -1): OttavaSlotTarget | null {
      return ctx.model().nextOttavaStartSlot(id, direction)
    },

    /** The slot the bracket's hook closes around TODAY — the address every drawn thing about its end
     *  is drawn at. ⚠️ ⛔ NOT the span's exclusive end ({@link ottavaOps.ottavaEndSlot}). */
    ottavaEndSlot(id: string): OttavaSlotTarget | null {
      return ctx.model().ottavaEndSlot(id)
    },

    /**
     * Put the bracket's BEGINNING on `target`, **holding its end** — the walk's crossing write at the
     * START square, and the keyboard twin of what a drag of that square does frame by frame.
     *
     * ⚠️ A CONTENT edit ({@link moveOttavaStartBySlot}'s own): both model fields in one step, one undo
     * state, and AUDIBLE — it changes which notes are displaced.
     *
     * ⭐ It keeps that end's `ottavaOffset` by construction (`ottavaOps` writes no override here),
     * which is what the walk needs: the crossing is meant to be invisible, and the offset is re-based
     * by the caller rather than wiped.
     */
    moveOttavaStartToSlot(id: string, target: OttavaSlotTarget): boolean {
      const ok = ctx.model().applyOttavaDrag(id, { at: 'start', ...target })
      if (ok) ctx.mutate('Move octave line start')
      return ok
    },

    /**
     * Live (preview) end-move used **while dragging one of an ottava's squares** — writes the model
     * but does NOT record undo; call {@link commitOttavaDrag} on the drop for the single entry. The
     * hairpin's `previewHairpinEnd` / `commitHairpinDrag` pair verbatim, and for its reason: every
     * frame of a drag would otherwise be its own undo step.
     *
     * `write` carries the address AND which end of the bracket lands on it — two cases, not the
     * wedge's three (see {@link OttavaDragWrite}). @returns true when the model changed.
     */
    previewOttavaEnd(id: string, write: OttavaDragWrite): boolean {
      ctx.markDirty() // live drag, undo deferred to commitOttavaDrag
      return ctx.model().applyOttavaDrag(id, write)
    },

    /**
     * Live (preview) nudge of ONE end's ink used **while dragging an ottava's SQUARE** — writes the
     * override but records NO undo; the drop commits once ({@link commitOttavaDrag}).
     *
     * ⭐ It is {@link nudgeOttavaEndpoint} without the undo, and ACCUMULATING like it: the caller passes
     * the delta since the last accepted frame, never a total. The page limit still refuses the write,
     * so an end dragged off the sheet simply stops moving (⛔ the drawing is never clamped).
     *
     * ⭐⭐ **`outward` moves the WHOLE bracket, whichever square is dragged** — the keyboard's rule
     * arriving at the mouse, and it needs no code: {@link OttavaOffsetOverride} has ONE vertical, so
     * either end writes the same field. ⛔ Do not "fix" this into a per-end pair to match the wedge — a
     * tilted octave bracket is not a shape.
     *
     * ⚠️ **`outward` is a distance FROM THE STAFF**, like every other ottava vertical: the caller
     * converts its screen delta on the way in (`interactions/walks/ottavaWalk.dragOttavaEndpoint`, the drag's
     * twin of `shortcutWiring`'s conversion for the keys).
     *
     * 🚨 TWO AXES, TWO QUESTIONS at the page limit — {@link spanEndStaysOnPage}: the horizontal moves
     * ONE END and its square, the vertical moves the whole drawn bracket.
     */
    previewOttavaEndpointOffset(
      id: string,
      which: 'start' | 'end',
      dx: number,
      outward = 0,
    ): boolean {
      // ⚠️ Both limits predict where INK lands, so they need a SCREEN delta. Above the staff, further
      // out is further UP.
      const above = (ctx.model().getOttavaById(id)?.shift ?? 1) > 0
      if (!endpointOffsetAllowed(id, which, dx, above ? -outward : outward)) return false
      ctx.markDirty() // live drag, undo deferred to commitOttavaDrag
      return ctx.model().setOttavaEndpointOffset(id, which, dx, outward)
    },

    /** One end's RE-BASE: no undo entry of its own, and ⛔ never judged by the page limit
     *  ({@link previewHairpinEndpointRebase} has the reason). ⚠️ `dx` only: the bracket's vertical is
     *  ONE number for the whole line and no walk touches it. */
    previewOttavaEndpointRebase(id: string, which: 'start' | 'end', dx: number): boolean {
      ctx.markDirty() // live drag, undo deferred to commitOttavaDrag
      return ctx.model().setOttavaEndpointOffset(id, which, dx, 0)
    },

    /** Record ONE undo entry after an ottava-square drag settles. */
    commitOttavaDrag(which: 'start' | 'end'): void {
      ctx.commitPreviewed(which === 'start' ? 'Move octave line start' : 'Resize octave line')
    },

    /** Remove an octave line by id. Saves undo state when one was removed. */
    removeOttava(id: string): boolean {
      const removed = ctx.model().removeOttava(id)
      if (removed) ctx.mutate('Remove octave line')
      return removed
    },
  }
}
