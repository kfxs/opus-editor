/**
 * ⭐ **THE TRILL's COMMANDS** — every edit the editor can make to one, built from a
 * {@link CommandContext}; `MusicEngine` keeps `readonly trill = trillCommands(ctx)`, and a caller
 * writes `engine.trill.nudgeTrill(…)`. The ottava's arrangement (`./ottavaCommands`).
 *
 * Everything a trill IS lives in `engine/models/trillOps`. ⭐ Unlike its two neighbours a trill is
 * anchored to NOTES (its auxiliary is a step above that pitch), so its extent edits are anchor
 * writes rather than slot walks — and it has no band guard of its own: its vertical is `outward`
 * from a note, judged by the page limit alone.
 *
 * ⚠️ `commands` is named so one command can call a sibling (`createTrillOverSpan` →
 * `createTrill`) without `this`, which a destructured or `Pick`ed command would lose.
 */
import type { Fraction, Trill, TrillContinuationLabel } from '@/types/music'
import { fracToNumber } from '@/utils/fraction'
import { spanFromNotes } from '../models/spanFromNotes'
import type { CommandContext } from './commandContext'

export type TrillCommands = ReturnType<typeof trillCommands>

export function trillCommands(ctx: CommandContext) {
  const commands = {
    /**
     * Add a trill on a note — idempotent, and refused on a rest or a fanned member
     * ({@link trillOps.addTrill}). @returns the stored Trill, the existing one, or null.
     *
     * ⚠️ AUDIBLE, and unlike the slur beside it: a trill CHANGES WHAT PLAYS
     * (docs/plans/trill-plan.md §7 — it turns one sounding note into alternating attacks), so playback has
     * to be resynced. A slur is a phrasing curve with no attacks of its own, which is why it gets the
     * cheaper snapshot.
     */
    addTrill(trill: Omit<Trill, 'id'>): Trill | null {
      const created = ctx.model().addTrill(trill)
      if (created) ctx.mutate('Add trill')
      return created
    },

    /**
     * ⭐ **Create a trill over the notes the user meant** — the Lines window's row and the armed
     * stamp's click both arrive here, so a trill made one way is the trill the other would have made.
     *
     * The note resolution is `createSlur`'s, with two differences that are the trill's own:
     *
     *  - ⭐ **ONE note is a complete trill**, where one note only gives a slur something to reach
     *    FROM. A slur must span two points, so a single selected note resolves to "this note and the
     *    next slot"; a trill on one note is a finished ornament, and its span comes from the ties
     *    (`trillSpan`) rather than from a second anchor. So a single selection gets **no
     *    `endNoteId`** — deliberately not "this note to the next", which would draw a wavy line the
     *    user did not ask for.
     *  - ⛔ **A fanned member is refused**, where a slur accepts one. `trillOps.addTrill` is where
     *    that decision lives and why (docs/plans/trill-plan.md §2.2); this method simply lets it answer.
     *
     * A trill lives in ONE voice on ONE staff, taken from the first resolved note — notes in other
     * lanes are dropped rather than silently widening the span, `createSlur`'s rule exactly.
     *
     * Create-only and **idempotent**: a note already carrying a trill gets that trill back and
     * nothing is added. Removal is select-the-ornament + Delete.
     *
     * @returns the created (or pre-existing) Trill, or null if no valid anchor resolved.
     */
    createTrill(noteIds: string[]): Trill | null {
      const span = spanFromNotes(ctx.model(), noteIds, { byVoice: true, sounding: true })
      if (!span) return null
      const { start, voice } = span
      const end = span.notes.length >= 2 ? span.end : undefined
      const created = ctx.model().addTrill({
        startNoteId: start.id,
        ...(end && end.id !== start.id ? { endNoteId: end.id } : {}),
        voice,
      })
      if (created) ctx.mutate('Add trill')
      return created
    },

    /**
     * ⭐⭐ **THE SAME TRILL, OVER THERE** — what a PASTE makes (`interactions/elementClipboard`), and
     * `createSlurOverSpan`'s twin, rule for rule.
     *
     * ⭐ **It starts from a NOTE, ⛔ never an address**: an address always resolves to SOMETHING, which
     * is how a paste into an empty bar drew a slur three bars long (his report, 2026-08-20). The caller
     * holds the pointer and is the only one that can say whether a note was really under it.
     *
     * ⭐ **The extent is resolved against the DESTINATION's own notes** — `slurOps.slurEndsFrom`, whose
     * question is *"which note is this far along"* and belongs to no one family. ⚠️ A rule, not a
     * promise: the destination's rhythm is its own, so the span may cover a different number of notes
     * there. A span of ZERO is the one-note trill and asks for no end at all.
     *
     * ⚠️ ONE undo entry for the whole thing: the ornament and the three ways it READS are one paste.
     */
    createTrillOverSpan(
      startNoteId: string,
      span: Fraction,
      reads: {
        placement?: 'above' | 'below'
        continuationLabel?: TrillContinuationLabel
        extension?: 'none'
      } = {},
    ): Trill | null {
      const ends = fracToNumber(span) > 0 ? ctx.model().slurEndsFrom(startNoteId, span) : null
      let created: Trill | null = null
      ctx.runBatch('Paste trill', () => {
        created = commands.createTrill(ends ? [ends.startNoteId, ends.endNoteId] : [startNoteId])
        if (!created) return
        if (reads.placement) ctx.model().setTrillPlacement(created.id, reads.placement)
        if (reads.continuationLabel) {
          ctx.model().setTrillContinuationLabel(created.id, reads.continuationLabel)
        }
        if (reads.extension) ctx.model().setTrillExtension(created.id, reads.extension)
      })
      return created
    },

    /** Remove a trill by id (the ornament only — never the anchored notes). Saves undo state and
     *  resyncs playback when removed. @returns true if one was removed. */
    removeTrill(id: string): boolean {
      const removed = ctx.model().removeTrill(id)
      if (removed) ctx.mutate('Remove trill')
      return removed
    },

    /**
     * ⭐⭐ **Re-anchor one END of a trill by NOTE** — `Ctrl+Shift+←/→` with that square armed
     * (`interactions/trillReanchor`). `noteId === null` on the END clears it, back to the one-note
     * trill whose extent comes from the ties.
     *
     * ⚠️ **AUDIBLE** — unlike the continuation label below it. Which notes a trill
     * covers is which notes get the alternation, so this is AUDIBLE: `trilledSlotIds` reads the span
     * and the playback schedule generates its repeats from it.
     *
     * @returns true when the model changed (the caller then re-renders).
     */
    setTrillAnchor(id: string, which: 'start' | 'end', noteId: string | null): boolean {
      const ok = which === 'end'
        ? ctx.model().setTrillEnd(id, noteId)
        : noteId !== null && ctx.model().setTrillStart(id, noteId)
      if (ok) ctx.mutate(which === 'start' ? 'Move trill start' : 'Move trill end')
      return ok
    },

    /**
     * Live (preview) re-anchor used **while dragging one of a trill's squares** — writes the model but
     * does NOT record undo; call {@link commitTrillDrag} on the drop for the single entry.
     * {@link previewPedalStartAtSlot}'s twin, and for its reason: every frame of a drag would otherwise be its
     * own undo step.
     *
     * ⭐ The model is the authority on the destination — a rest, a fanned member, a note that already
     * trills, or a step past the other end are all refused there, and reaching the other end COLLAPSES
     * the trill rather than being refused ({@link setTrillAnchor}).
     *
     * @returns true when the model changed.
     */
    previewTrillAnchor(id: string, which: 'start' | 'end', noteId: string | null): boolean {
      ctx.markDirty() // live drag, undo deferred to commitTrillDrag
      // ⚠️ `null` CLEARS the end (the one-note trill), which a drag reaches by walking the end back
      // onto the start — ⛔ it must go through here and not through {@link setTrillAnchor}, or that one
      // frame records its own undo entry in the middle of the gesture.
      return which === 'end'
        ? ctx.model().setTrillEnd(id, noteId)
        : noteId !== null && ctx.model().setTrillStart(id, noteId)
    },

    /**
     * ⭐⭐ **THE BARE `tr`** — the wavy line off or back on, reached from the END square's walk one step
     * past the collapse. ⚠️ AUDIBLE: turning the line off CLEARS an explicit end, and
     * which notes a trill covers is what the notes SOUND. In the ordinary case (the trill was already
     * a one-note trill) nothing audible changes and the entry is simply cheap.
     */
    setTrillExtension(id: string, extension: 'none' | undefined): boolean {
      const ok = ctx.model().setTrillExtension(id, extension)
      if (ok) ctx.mutate(extension === 'none' ? 'Trill without a line' : 'Trill with a line')
      return ok
    },

    /** Live (preview) line on/off while DRAGGING the end square past the start —
     *  {@link previewTrillAnchor}'s twin, committed by {@link commitTrillDrag}. */
    previewTrillExtension(id: string, extension: 'none' | undefined): boolean {
      ctx.markDirty()
      return ctx.model().setTrillExtension(id, extension)
    },

    /**
     * ⭐⭐ **Nudge the armed end of a trill's INK** — a plain or `Ctrl` arrow with that square armed.
     * Staff-spaces.
     *
     * ⭐ `outward` moves the WHOLE ornament however it is asked for: the sign and the wiggle share one
     * baseline, so {@link TrillOffsetOverride} has nowhere to put a second height.
     *
     * ⭐⭐ **`outward` is a distance FROM THE STAFF, not a screen delta** — `+` is up for an `above`
     * trill and down for a `below` one, because `x` flips the side and a screen-signed field would
     * invert the nudge with it. ⚠️ Callers that speak screen convert on the way in; `shortcutWiring`
     * is the one that does.
     *
     * ⚠️ An override: moving ink changes nothing audible, which is
     * exactly what separates this key from `Ctrl+Shift+arrow` on the same square.
     */
    nudgeTrillEndpoint(id: string, which: 'start' | 'end', dx: number, outward: number): boolean {
      // ⚠️ The PAGE LIMIT predicts where ink lands, so it needs a SCREEN delta — the second of the two
      // places that convert (the renderer is the other). Above the staff, further out is further UP.
      const above = (ctx.model().getTrillById(id)?.placement ?? 'above') === 'above'
      // 🚨 TWO AXES, TWO QUESTIONS — his report, 2026-08-21: *"in the case of the trill same thing, the
      // left endpoint lands out of the page"*. The horizontal moves ONE END and its square
      // ({@link spanEndStaysOnPage}); `outward` lifts the whole ornament, sign and wiggle together.
      if (!ctx.limits.spanEndStaysOnPage('trill', id, which, dx)) return false
      const dy = above ? -outward : outward
      if (dy !== 0 && !ctx.limits.nudgeStaysOnPage('trill', id, 0, dy)) return false
      const ok = ctx.model().setTrillEndpointOffset(id, which, dx, outward)
      if (ok) ctx.mutate('Nudge trill')
      return ok
    },

    /**
     * ⭐⭐ **THE CROSSING'S SECOND HALF** — {@link nudgeTrillEndpoint} without the page limit, for the
     * interpolating walk (`interactions/trillWalk`).
     *
     * 🚨 It is BOOKKEEPING, not a nudge: the pair *(anchor := the next note, offset −= the gap)* leaves
     * the DRAWN ornament exactly where it was, so a rule about where INK may go has no business judging
     * it. The page limit measures the delta against the LAST RENDER, where the anchor has not moved
     * yet, and reads a re-base as a hand shoving the mark half a bar sideways — and a refused re-base
     * leaves the anchor ahead of the ink, so the next press crosses again (the hairpin's runaway,
     * 2026-08-20). ⭐ Horizontal only: a re-base has no vertical half.
     */
    rebaseTrillEndpointOffset(id: string, which: 'start' | 'end', dx: number): boolean {
      const ok = ctx.model().setTrillEndpointOffset(id, which, dx, 0)
      if (ok) ctx.mutate('Nudge trill') // inside the walk's batch this only counts the request
      return ok
    },

    /**
     * Live (preview) nudge of one end's ink used **while DRAGGING a trill's square** — writes the
     * override but records NO undo; the drop commits once ({@link commitTrillDrag}).
     *
     * ⭐ It is {@link nudgeTrillEndpoint} without the undo, and ACCUMULATING like it: the caller passes
     * the delta since the last accepted frame, never a total. The page limit still refuses the write,
     * so an ornament dragged off the sheet simply stops moving (⛔ the drawing is never clamped).
     */
    previewTrillEndpointOffset(id: string, which: 'start' | 'end', dx: number, outward: number): boolean {
      const above = (ctx.model().getTrillById(id)?.placement ?? 'above') === 'above'
      if (!ctx.limits.nudgeStaysOnPage('trill', id, dx, above ? -outward : outward)) return false
      ctx.markDirty() // live drag, undo deferred to commitTrillDrag
      return ctx.model().setTrillEndpointOffset(id, which, dx, outward)
    },

    /**
     * Live (preview) side change while DRAGGING an ornament across its own staff — the LADDER's first
     * rung (`interactions/trillWalk`). ⚠️ No undo of its own; the drop commits once.
     */
    previewTrillPlacement(id: string, side: 'above' | 'below'): boolean {
      ctx.markDirty()
      return ctx.model().setTrillPlacement(id, side)
    },

    /** Live (preview) nudge of the WHOLE ornament's ink — a BODY drag. {@link nudgeTrill} without the
     *  undo, and accumulating like it; the page limit still refuses the write. */
    previewTrillOffset(id: string, dx: number, outward: number): boolean {
      const above = (ctx.model().getTrillById(id)?.placement ?? 'above') === 'above'
      if (!ctx.limits.nudgeStaysOnPage('trill', id, dx, above ? -outward : outward)) return false
      ctx.markDirty() // live drag, undo deferred to commitTrillDrag
      return ctx.model().setTrillOffset(id, dx, outward)
    },

    /** The whole ornament's RE-BASE — no undo of its own, and ⛔ never judged by the page limit: it
     *  does not move the drawn ink (see {@link rebaseTrillEndpointOffset}). */
    previewTrillOffsetRebase(id: string, dx: number, dy = 0): boolean {
      ctx.markDirty()
      return ctx.model().setTrillOffset(id, dx, dy)
    },

    /** Live (preview) move of the WHOLE ornament onto another note, keeping its extent — a vertical
     *  drag landing it on another system. ⚠️ AUDIBLE, and committed by {@link commitTrillDrag}. */
    previewTrillMove(id: string, startNoteId: string, endNoteId?: string): boolean {
      ctx.markDirty()
      return ctx.model().moveTrillTo(id, startNoteId, endNoteId)
    },

    /** The re-base during a DRAG: {@link rebaseTrillEndpointOffset} with no undo entry of its own —
     *  and, like it, ⛔ never judged by the page limit. */
    previewTrillEndpointRebase(id: string, which: 'start' | 'end', dx: number): boolean {
      ctx.markDirty()
      return ctx.model().setTrillEndpointOffset(id, which, dx, 0)
    },

    /** ⭐⭐ **Move the WHOLE ornament** by a staff-space delta — the arrows with a trill selected and NO
     *  square armed. One undo step; the same screen→outward negation as its per-end twin. */
    nudgeTrill(id: string, dx: number, outward: number): boolean {
      const above = (ctx.model().getTrillById(id)?.placement ?? 'above') === 'above'
      if (!ctx.limits.nudgeStaysOnPage('trill', id, dx, above ? -outward : outward)) return false
      const ok = ctx.model().setTrillOffset(id, dx, outward)
      if (ok) ctx.mutate('Nudge trill')
      return ok
    },

    /** `Ctrl+Backspace` with a trill selected and nothing armed: every nudge dropped. DECLINEs when it
     *  carries none. */
    resetTrillOffset(id: string): boolean {
      const ok = ctx.model().resetTrillOffset(id)
      if (ok) ctx.mutate('Reset trill nudge')
      return ok
    },

    /** `Ctrl+Backspace` on an armed square: that end's `x` and the shared vertical back to the
     *  engraver's own. @returns false when it carries no nudge, so the key falls through. */
    resetTrillEndpointOffset(id: string, which: 'start' | 'end'): boolean {
      const ok = ctx.model().resetTrillEndpointOffset(id, which)
      if (ok) ctx.mutate('Reset trill nudge')
      return ok
    },

    /** Record ONE undo entry after a trill-square drag settles. */
    commitTrillDrag(which: 'start' | 'end'): void {
      ctx.commitPreviewed(which === 'start' ? 'Move trill start' : 'Move trill end')
    },

    /**
     * Set how a CONTINUATION system labels a trill — `(tr)` (default), a plain `tr`, or nothing.
     * See {@link Trill.continuationLabel} for the three, and who does which.
     *
     * ⚠️ Ink only: a label is notation, and it changes nothing audible.
     */
    setTrillContinuationLabel(id: string, label: TrillContinuationLabel): boolean {
      const ok = ctx.model().setTrillContinuationLabel(id, label)
      if (ok) ctx.mutate('Trill continuation label')
      return ok
    },

    /** Flip a trill between above and below the staff — the `x` key's trill branch. Saves undo state.
     *  ⚠️ Ink only, unlike {@link addTrill}: a side is notation, and it changes nothing audible. */
    toggleTrillPlacement(id: string): 'above' | 'below' | null {
      const side = ctx.model().toggleTrillPlacement(id)
      if (side) ctx.mutate('Flip trill side')
      return side
    },
  }
  return commands
}
