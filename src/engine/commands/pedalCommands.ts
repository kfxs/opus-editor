/**
 * ⭐ **THE SUSTAIN PEDAL's COMMANDS** — every edit the editor can make to one, built from a
 * {@link CommandContext}; `MusicEngine` keeps `readonly pedal = pedalCommands(ctx)`, and a caller
 * writes `engine.pedal.nudgePedal(…)`. The ottava's arrangement (`./ottavaCommands`), one family over.
 *
 * Everything a pedal IS lives in `engine/models/pedalOps` — ⭐ including the pianist's own rule for
 * two pedals meeting on one staff (*lift, re-press*: there is ONE damper). What a command adds is the
 * LIMIT that may refuse a hand-nudge, and the undo entry.
 */
import type { Fraction, Pedal } from '@/types/music'
import { slotLength } from '@/utils/durations'
import { PEDAL_SIGN_GAP } from '../rendering/marks/lines/pedalStyle'
import type { PedalLiftTarget, PedalSlotTarget, PedalStaffSlotTarget } from '../models/pedalOps'
import { spanFromNotes } from '../models/spanFromNotes'
import type { CommandContext } from './commandContext'

export type PedalCommands = ReturnType<typeof pedalCommands>

export function pedalCommands(ctx: CommandContext) {
  /**
   * 🚨🚨 **TWO AXES, TWO QUESTIONS, because they move DIFFERENT INK** — the bracket's rule of
   * 2026-08-21 ({@link ottavaEndpointOffsetAllowed}) arriving at the fourth family with squares, and
   * it is the question that was wrong here rather than the limit: a `dx` moves ONE SIGN and its
   * square ({@link spanEndStaysOnPage}), while the shared `y` lifts BOTH and is the whole-object
   * question ({@link nudgeStaysOnPage}).
   *
   * ⭐ Asking the whole-object question about a horizontal step is the recorded DEADLOCK: a pedal cut
   * by a system break has its `Ped.` near one edge of the sheet and its `✻` near the other, so a rule
   * that translates every drawn box refuses every arrow in both directions.
   *
   * ⭐ **The sign is NAMED, not counted** — `ElementInfo.pedalSign`, `pedalHandles`' rule.
   *
   * ⭐⭐ **AND THE BAND, since the square drag learned to carry the `y`** — his ask, 2026-08-21:
   * *"by the way on the drag we have to limit the pedal y offset"*. ⛔ Not a new rule and ⛔ not this
   * family's: it is the sentence that produced `layout/systemBand` for the slur, then the wedge, then
   * the bracket ({@link ottavaEndpointOffsetAllowed}) — the pedal simply had no vertical drag to be
   * judged until now, which is exactly what the bracket's own entry says. ⚠️ It is judged HERE, in
   * the gate both devices share, so the arrows and the mouse cannot disagree about how far down a
   * pedal may go.
   *
   * ⚠️ **The HORIZONTAL is still free** (*"the user should be able to offset it at will"*): the band
   * is about a neighbour's room, and sideways there is no neighbour — only the page.
   *
   * ⛔⛔ **AND NO "THE TWO SIGNS MAY NOT CROSS" RULE — it was here for a day and he removed it**
   * (2026-08-21: *"the behaviour of the pedal should be similar to the behaviour of the ottava"*).
   *
   * 🚨 **A rule that can refuse the INK changes the GESTURE'S GEAR, which is the bigger fault.** The
   * press pushes the lift when they meet (`pedalOps.setPedalStartAtSlot`), so the pair keeps one slot
   * and the glyphs stay touching; an order rule then refuses every further ink step, and every press
   * from there on hands the anchor a WHOLE STOP along (`markWalk.crossWithoutArrival`). His log:
   * 1 space per press became **24.28 spaces** in one keystroke, because the bar under it held
   * sixteenths. ⭐ {@link ottavaEndpointOffsetAllowed} has never had such a rule and never showed the
   * symptom — *"in the ottava we never have this problem"*.
   *
   * ⚠️ **What that leaves open, honestly**: the `endX: −67` score the rule was written for
   * (2026-08-21, a pedal over whole-bar RESTS whose lift had nowhere to walk to, so every press was
   * free ink). ⛔ The bracket is exposed to exactly the same thing — its `nextOttavaEndSlot` answers
   * null in the same way — so this is the family's shared behaviour rather than a hole dug here. The
   * cure, if it is ever wanted, belongs where the runaway starts: a stop the walk can always reach.
   */
  function endpointStepAllowed(
    id: string,
    which: 'start' | 'end',
    dx: number,
    dy: number,
  ): { dx: number; dy: number } | null {
    const sign = which === 'start' ? 'down' : 'up'
    const horizontal = dx !== 0
      && ctx.limits.spanEndStaysOnPage('pedal', id, which, dx, ps => ps.find(p => p.pedalSign === sign))
      && (which === 'start' || liftInkWouldMove(id, dx))
    const vertical = dy !== 0
      && ctx.limits.nudgeStaysOnPage('pedal', id, 0, dy)
      && staysInBand(id, dy)
    // 🚨🚨 **ONE AXIS'S REFUSAL MAY NOT VETO THE OTHER** — his report, 2026-08-21, of a drag that
    // *"get stuck somehow"* with a log of dozens of consecutive latches moving nothing. A mouse
    // gesture always carries both axes, so when the vertical was at its limit the write that carried
    // it took the horizontal down with it: the ink stopped, the caller (rightly) held its cursor
    // anchor back, and every following frame presented a bigger delta at the same wall. ⭐ The two
    // axes already ask TWO QUESTIONS; this makes them give two ANSWERS.
    return horizontal || vertical ? { dx: horizontal ? dx : 0, dy: vertical ? dy : 0 } : null
  }

  /**
   * ⭐ **Would this lift put any SIGN of the pedal in a neighbour's room?** — {@link nudgeStaysInBand}
   * asked of the whole mark, because a pedal's vertical is ONE number (Gould p. 333) and every glyph
   * rises with it. {@link ottavaStaysInBand}'s twin, on the other side of the staff.
   *
   * ⚠️ **Each glyph is judged against ITS OWN system's band**, exactly as the page limit judges each
   * against its own sheet: a pedal cut by a system break has its `Ped.` on one staff and its `✻` on
   * another, and one staff's neighbours say nothing about the other's. Any sign the step would push
   * into a neighbour's room blocks it, since the height they share is one field.
   *
   * ⭐ **The grain is the GLYPH here, not the fragment** — `pedalHandles`' rule, and it is the right
   * ink to measure: a pedal draws nothing between its two signs, so the boxes ARE the mark.
   */
  function staysInBand(id: string, dy: number): boolean {
    const registry = ctx.registry()
    return (registry.getByType?.('pedal') ?? [])
      .filter(e => e.id === id)
      .every(e => e.measure === undefined
        || ctx.limits.nudgeStaysInBand([e.bbox], e.measure, e.staff ?? 0, dy))
  }

  /**
   * ⭐⭐ **AN OFFSET THE DRAWING WILL IGNORE IS NOT WRITTEN** — his report, 2026-08-21: *"the `✻` goes
   * back a lot and then we have to re-establish this till I can go in the other direction"*, with a
   * log of the release's `endX` running to **−39 staff-spaces** in one held keypress and costing
   * forty presses to walk back.
   *
   * ## Why free ink stops being free HERE, and only here
   *
   * `PedalRenderer` floors the `✻` at the `Ped.`'s ink plus {@link PEDAL_SIGN_GAP} — the bracket's
   * own arrangement, and the one his *"the hook of the ottava never crosses the 8"* pointed at. Once
   * that floor binds, a further leftward press moves NOTHING on the page while the stored number
   * keeps growing: the hand sees a dead key and is silently building a debt it has to pay back press
   * by press.
   *
   * ⭐ So this is not a new limit on where ink may go — **it is the floor the renderer already
   * applies, asked before the write instead of after it.** ⛔ Inventing a limit that predates nothing
   * is what he refused for the bracket; this one is a fact about the picture.
   *
   * 🚨 **It refuses a step that makes it worse, ⛔ never one that mends it** ({@link
   * edgeStepFitsOnPage}'s shape, and load-bearing here too): a rightward press is always allowed, so
   * a file already carrying a huge negative `endX` walks back out with the same arrow.
   *
   * ⚠️ **The START has no such rule and needs none**: the floor is measured FROM the `Ped.`, so a
   * press nudged rightward carries the `✻` ahead of it — that ink is always visible.
   *
   * ⛔ **Both signs on ONE SYSTEM only.** Cut by a break, the `Ped.` is near one line's end and the
   * `✻` near the next line's start, where the two x's are not one ruler and the floor never binds.
   *
   * ⚠️ **The OTTAVA has the same fault, hidden** (`OTTAVA_MIN_LINE` floors its hook the same way), so
   * the day it is worth fixing there, this is the shape — ⛔ but it is not fixed here: this method
   * knows about two glyphs, and a bracket's floor is about a line's least length.
   */
  function liftInkWouldMove(id: string, dx: number): boolean {
    if (dx >= 0) return true // away from the floor — always allowed, see the header
    const registry = ctx.registry()
    const pieces = (registry.getByType?.('pedal') ?? []).filter(e => e.id === id)
    const down = pieces.find(e => e.pedalSign === 'down')
    const up = pieces.find(e => e.pedalSign === 'up')
    if (!down || !up || down.measure === undefined || up.measure === undefined) return true

    const home = registry.getStaffGeometry?.(down.measure, down.staff ?? 0)
    const there = registry.getStaffGeometry?.(up.measure, up.staff ?? 0)
    if (!home || !there) return true
    if (home.lineYPositions[0] !== there.lineYPositions[0]) return true // ⛔ not one ruler

    // The air the drawing still has to give: anything above the floor means this press moves ink.
    const air = up.bbox.x - (down.bbox.x + down.bbox.width) - PEDAL_SIGN_GAP * home.lineSpacing
    return air > 0
  }

  return {
    /**
     * Add a sustain pedal starting at (measure, `pedal.beat`) holding `pedal.length` of music,
     * REPLACING any pedal already on that (beat, staff) — the clef's rule, see {@link pedalOps.addPedal}.
     * `beat` must be a slot-boundary beat. Saves undo state when added.
     *
     * ⚠️ This is the LOW-level door: it stores, it does not make room. Lifting a pedal that was still
     * down is the ENTRY door's job (`addPedalOverNotes`), which is P4's (docs/plans/pedal-plan.md §3.3).
     * @returns the stored Pedal, or null if the measure is missing or the length is not positive.
     */
    addPedal(measureNumber: number, pedal: Omit<Pedal, 'id'>): Pedal | null {
      const created = ctx.model().addPedal(measureNumber, pedal)
      if (created) ctx.mutate(`Add pedal at measure ${measureNumber}`)
      return created
    },

    /**
     * ⭐⭐ **Put a pedal under the notes the user meant** — the Lines window's row and the armed stamp's
     * click both arrive here, so a pedal made one way is the pedal the other would have made.
     *
     * ⭐ **The lane is a STAFF, not a (staff, voice) pair** — `createOttava`'s exception, for a
     * physical rather than a notational reason: an octave line governs a staff because a bracket says
     * so, a pedal governs it because there is one foot. So a selection spanning two voices of one
     * staff makes ONE pedal holding both. Notes on OTHER staves are still dropped: one damper cannot
     * belong to two instruments.
     *
     * ⭐ **The span COVERS the last note** (`addPedalOverNotes` adds that note's own length), and here
     * that is literal rather than a matter of taste: the span is half-open (`holdUnderPedals`), so a
     * lift on the last note's onset would release the very note the user pointed at.
     *
     * ⭐⭐ **It also LIFTS whatever was still down** — the truncation rule lives in `addPedalOverNotes`
     * (docs/plans/pedal-plan.md §3.3), so both doors make room the same way and neither invents it. That is
     * the whole reason the entry phase has a door of its own rather than calling `addPedal`.
     *
     * ⛔ **A REST cannot anchor one**, the ottava's and hairpin's refusal — the engine resolves by
     * slot, so a rest would happily start a pedal from silence, and the gesture means *hold these
     * notes*.
     *
     * @returns the stored Pedal, or null when there is no usable span.
     */
    createPedal(noteIds: string[]): Pedal | null {
      const span = spanFromNotes(ctx.model(), noteIds, { byVoice: false, sounding: true })
      if (!span) return null
      const { start: startNote, end: endNote, staff } = span

      const created = ctx.model().addPedalOverNotes(
        { measure: startNote.measure, beat: startNote.beat },
        { measure: endNote.measure, beat: endNote.beat, length: slotLength(endNote) },
        ctx.staffIdForIndex(staff),
      )
      if (created) ctx.mutate('Add pedal')
      return created
    },

    /**
     * ⭐⭐ **Put a pedal at an ADDRESS, holding `length` of music, making room as it lands** — what a
     * PASTE of a copied pedal needs (`interactions/clipboard/elementClipboard`, his ask 2026-08-21), and
     * `createSlurOverSpan`'s twin at the other grain.
     *
     * ⭐ **It goes through the ENTRY door** (`pedalOps.addPedalOverNotes`), ⛔ never `addPedal`: two
     * pedals overlapping on one staff is a contradiction — there is ONE damper — and the rule for
     * resolving it is the pianist's own gesture, *lift, re-press* (docs/plans/pedal-plan.md §3.3). An earlier
     * press still down is shortened to end here; a later one is left alone and this pedal stops where
     * it begins; one on this exact beat is replaced. ⚠️ That is the same door the Lines window uses,
     * so a pasted pedal cannot reach a state the entry gesture could not.
     *
     * ⛔ It takes a PLACE rather than notes — a pedal governs a region, so unlike a slur or a trill it
     * needs no notehead under the pointer.
     *
     * @returns the stored Pedal, or null when the address is not in the score or the span holds no music.
     */
    addPedalOverSpan(measure: number, beat: Fraction, length: Fraction, staffId?: string): Pedal | null {
      const created = ctx.model().addPedalOverNotes(
        { measure, beat }, { measure, beat, length }, staffId)
      if (created) ctx.mutate('Add pedal')
      return created
    },

    /** Remove a sustain pedal by id. Saves undo state when one was removed. */
    removePedal(id: string): boolean {
      const removed = ctx.model().removePedal(id)
      if (removed) ctx.mutate('Remove pedal')
      return removed
    },

    /** Move the LIFT — set how much music a pedal holds. Saves undo state when it changed. */
    setPedalLength(id: string, length: Fraction): boolean {
      const ok = ctx.model().setPedalLength(id, length)
      if (ok) ctx.mutate('Resize pedal')
      return ok
    },

    /** Move a pedal's LIFT by one slot of its staff — `Ctrl+Shift+→` / `←` with its END square armed.
     *  Saves undo state when it changed. See {@link pedalOps.resizePedalBySlot}. */
    resizePedalBySlot(id: string, direction: 1 | -1): boolean {
      const ok = ctx.model().resizePedalBySlot(id, direction)
      if (ok) ctx.mutate(direction === 1 ? 'Lengthen pedal' : 'Shorten pedal')
      return ok
    },

    /** Move a pedal's PRESS by one slot, holding its lift — the same chord with the START square
     *  armed. ⚠️ AUDIBLE, like its twin: when the damper falls is AUDIBLE, so this is never a
     *  save-only cosmetic write. See {@link pedalOps.movePedalStartBySlot}. */
    movePedalStartBySlot(id: string, direction: 1 | -1): boolean {
      const ok = ctx.model().movePedalStartBySlot(id, direction)
      if (ok) ctx.mutate(direction === 1 ? 'Move pedal start later' : 'Move pedal start earlier')
      return ok
    },

    /**
     * Live (preview) re-anchor of the PRESS used **while dragging the `Ped.`** — {@link
     * movePedalStartToSlot} without the undo entry; the drop records the gesture once
     * ({@link commitPedalDrag}). @returns true when the model changed.
     *
     * ⭐ **The keyboard's own door, minus the undo** — the pair `previewPedalLiftAt` completes. That is
     * what makes a drag and N presses over one distance leave ONE state rather than two that merely
     * look alike (`interactions/pedalWalk`), and it is why the two ends need two doors: a press lands
     * on an ONSET, a lift on a MOMENT ({@link pedalOps.PedalLiftTarget}).
     */
    previewPedalStartAtSlot(id: string, target: PedalSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitPedalDrag
      return ctx.model().setPedalStartAtSlot(id, target)
    },

    /** Put the LIFT at `target`, holding the press — {@link previewPedalStartAtSlot}'s twin at the
     *  other square. It keeps that sign's nudge, so the walk can re-base it. No undo entry. */
    previewPedalLiftAt(id: string, target: PedalLiftTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitPedalDrag
      return ctx.model().setPedalLiftAt(id, target)
    },

    /**
     * Live (preview) nudge of ONE sign's ink used **while dragging a pedal's square** — writes the
     * override but records NO undo; the drop commits once ({@link commitPedalDrag}).
     *
     * ⭐ It is {@link nudgePedalEndpoint} without the undo, and ACCUMULATING like it: the caller passes
     * the delta since the last accepted frame, never a total. ⚠️ **The same gate**
     * ({@link pedalEndpointStepAllowed}), so the mouse and the arrows cannot disagree about what is
     * allowed — a sign dragged off the sheet simply stops moving (⛔ the drawing is never clamped).
     *
     * ⭐⭐ **`dy` moves BOTH signs, whichever square is under the hand** — and it needs no code here:
     * {@link PedalOffsetOverride} has ONE vertical (Gould p. 333), so either end writes the same field.
     * ⚠️ SCREEN-signed (+ down) all the way through, unlike the bracket's twin: a pedal has one side.
     */
    previewPedalEndpointOffset(id: string, which: 'start' | 'end', dx: number, dy = 0): boolean {
      // ⭐ Per AXIS ({@link pedalEndpointStepAllowed}): a drag carries both, and a vertical at its limit
      // must not freeze the horizontal — his *"get stuck somehow"*, 2026-08-21.
      const step = endpointStepAllowed(id, which, dx, dy)
      if (!step) return false
      ctx.markDirty() // live drag, undo deferred to commitPedalDrag
      return ctx.model().setPedalEndpointOffset(id, which, step.dx, step.dy)
    },

    /** One sign's RE-BASE: no undo entry of its own, and ⛔ never judged by the page limit
     *  ({@link previewHairpinEndpointRebase} has the reason). ⚠️ `dx` only: the pedal's vertical is
     *  ONE number for both signs (Gould p. 333) and no walk touches it. */
    previewPedalEndpointRebase(id: string, which: 'start' | 'end', dx: number): boolean {
      ctx.markDirty() // live drag, undo deferred to commitPedalDrag
      return ctx.model().setPedalEndpointOffset(id, which, dx, 0)
    },

    /** Record ONE undo entry after a pedal-square drag settles. */
    commitPedalDrag(which: 'start' | 'end'): void {
      ctx.commitPreviewed(which === 'start' ? 'Move pedal start' : 'Move pedal lift')
    },

    /**
     * Where {@link resizePedalBySlot} would put the LIFT, WITHOUT putting it there — a pure read, no
     * undo entry. The interpolating walk (`interactions/pedalWalk`) asks before it decides whether a
     * press re-anchors or only nudges ink, and asks THIS so the two keys can never move the damper to
     * different moments. @returns null at either end of the road.
     */
    nextPedalLift(id: string, direction: 1 | -1): PedalLiftTarget | null {
      return ctx.model().nextPedalLift(id, direction)
    },

    /** Where {@link movePedalStartBySlot} would put the PRESS, without putting it there —
     *  {@link nextPedalLift}'s twin at the other square, and for its reason. */
    nextPedalStartSlot(id: string, direction: 1 | -1): PedalSlotTarget | null {
      return ctx.model().nextPedalStartSlot(id, direction)
    },

    /** The moment the foot comes up TODAY, as an address — where the `✻` is drawn. ⚠️ Its beat may be
     *  the bar's capacity: the release at the barline ({@link pedalOps.PedalLiftTarget}). */
    pedalLiftSlot(id: string): PedalLiftTarget | null {
      return ctx.model().pedalLiftSlot(id)
    },

    /**
     * Put the PRESS on `target`, **holding the lift** — the walk's crossing write at the START square,
     * and the keyboard twin of what a drag of that square does frame by frame.
     *
     * ⚠️ A CONTENT edit ({@link movePedalStartBySlot}'s own): both model fields in one step, one undo
     * state, and AUDIBLE — it says when the damper falls. ⭐ It keeps that sign's `pedalOffset` by
     * construction (`pedalOps` writes no override here), which is what the walk needs: the crossing is
     * meant to be invisible, and the offset is re-based by the caller rather than wiped.
     */
    movePedalStartToSlot(id: string, target: PedalSlotTarget): boolean {
      const ok = ctx.model().setPedalStartAtSlot(id, target)
      if (ok) ctx.mutate('Move pedal start')
      return ok
    },

    /**
     * ⭐⭐ **Nudge the armed SIGN's ink** — a plain or `Ctrl` arrow with that square armed.
     * Staff-spaces, screen-signed (+ down).
     *
     * ⭐ `dy` moves BOTH signs however it is asked for: a pedal and its own release share one baseline
     * (Gould p. 333), so {@link PedalOffsetOverride} has nowhere to put a second height. That is an
     * engraving rule kept in the model's SHAPE rather than in the code that writes it.
     *
     * ⚠️ **No screen→outward conversion here, unlike the bracket's twin** — a pedal has one side
     * permanently, so `+ down` means the same thing everywhere it can be drawn.
     *
     * ⚠️ An override: moving ink changes nothing audible, which is
     * exactly what separates this key from `Ctrl+Shift+arrow` on the same square.
     */
    nudgePedalEndpoint(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
      const step = endpointStepAllowed(id, which, dx, dy)
      if (!step) return false
      const ok = ctx.model().setPedalEndpointOffset(id, which, step.dx, step.dy)
      if (ok) ctx.mutate('Nudge pedal')
      return ok
    },

    /** ⭐⭐ **Move the WHOLE pedal** by a staff-space delta — the arrows with a pedal selected and NO
     *  square armed. One undo step. */
    nudgePedal(id: string, dx: number, dy: number): boolean {
      // ⭐ The whole-object page rule is right HERE, unlike the per-sign nudge: this really does
      // translate every glyph. ⚠️ The BAND is the same question either way — see
      // {@link pedalEndpointStepAllowed} for his ask.
      if (!ctx.limits.nudgeStaysOnPage('pedal', id, dx, dy)) return false
      if (dy !== 0 && !staysInBand(id, dy)) return false
      const ok = ctx.model().setPedalOffset(id, dx, dy)
      if (ok) ctx.mutate('Nudge pedal')
      return ok
    },

    /**
     * ⭐⭐ **Move the WHOLE pedal onto `target`, keeping how much music it holds** — the body walk's
     * crossing write, the keyboard twin of {@link movePedalStartToSlot} at the other grain.
     *
     * ⚠️ A CONTENT edit and AUDIBLE: the same notes are no longer the ones that ring, so it is never
     * just ink. ⭐ It keeps both signs' nudges by construction (`pedalOps` writes no override
     * here), which is what the walk needs — the crossing is meant to be invisible.
     */
    movePedalToSlot(id: string, target: PedalSlotTarget): boolean {
      const ok = ctx.model().setPedalAtSlot(id, target)
      if (ok) ctx.mutate('Move pedal')
      return ok
    },

    /**
     * ⭐⭐ **Move the whole pedal onto `target` during a DRAG** — {@link movePedalToSlot} with no undo
     * entry of its own; {@link commitPedalOffsetDrag} records the gesture once on the drop.
     */
    previewPedalSlot(id: string, target: PedalSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitPedalOffsetDrag
      return ctx.model().setPedalAtSlot(id, target)
    },

    /**
     * ⭐⭐ **…and onto ANOTHER STAFF's onset** — the VERTICAL half of the same drag (his ask,
     * 2026-08-21). The staff below is a place a dragged pedal can land, not only the system below:
     * `pedalOps.setPedalAtStaffSlot`, the wedge's `previewHairpinStaffSlot` one family on.
     *
     * ⚠️ Its own method rather than a wider `target` on {@link previewPedalSlot}: that one is also the
     * PRESS's walk, which travels sideways inside one lane and has no staff to say.
     */
    previewPedalStaffSlot(id: string, target: PedalStaffSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitPedalOffsetDrag
      return ctx.model().setPedalAtStaffSlot(id, target)
    },

    /**
     * Live (preview) nudge of the WHOLE pedal's ink — a BODY drag. {@link nudgePedal} without the undo,
     * and accumulating like it; the page limit and the band still refuse the write, so the pair stops
     * at the edge rather than being clamped in the drawing.
     *
     * @param throughTheBand ⚠️⚠️ **EXPLORATORY (2026-08-30) — let the vertical PASS the band**, for the
     *   one frame kind that has somewhere to be handed to (`interactions/pedalLane.pedalCanHandOver`,
     *   which carries his report and the measurement). The band floors this mark at the partner staff's
     *   EDGE while the hand-over fires 28px lower, so the two rules deadlock and the gesture stalls.
     *   ⛔ Off everywhere else — the keyboard nudge, both squares, and a sheet with one staff on it —
     *   so the limit he asked for on 2026-08-21 stands wherever a hand-over cannot relieve it.
     *   ⚠️ The PAGE is still judged; it is the only stop left on that road.
     */
    previewPedalOffset(id: string, dx: number, dy: number, throughTheBand = false): boolean {
      if (!ctx.limits.nudgeStaysOnPage('pedal', id, dx, dy)) return false
      if (dy !== 0 && !throughTheBand && !staysInBand(id, dy)) return false
      ctx.markDirty() // live drag, undo deferred to commitPedalOffsetDrag
      return ctx.model().setPedalOffset(id, dx, dy)
    },

    /** The whole pedal's RE-BASE — both signs by the same delta, no undo of its own, and ⛔ never
     *  judged by the page limit or the band ({@link previewHairpinEndpointRebase} has the reason).
     *
     *  ⚠️ **EXPLORATORY (2026-08-30): it grew a `dy`** — a LANDING pays the travel of the mark's home
     *  into the offset so the re-anchor does not move the drawing (`interactions/pedalWalk.jumpStaves`),
     *  and that payment is vertical as well as horizontal. ⛔ It must not come through
     *  {@link previewPedalOffset}: the drawn ink does not move, so neither the page nor the band has
     *  anything to judge — and the band, measured off the render the pedal has just left, would refuse
     *  exactly the payment that keeps it still. */
    previewPedalOffsetRebase(id: string, dx: number, dy = 0): boolean {
      ctx.markDirty()
      return ctx.model().setPedalOffset(id, dx, dy)
    },

    /** Record ONE undo entry after a pedal BODY drag settles. */
    commitPedalOffsetDrag(): void {
      ctx.commitPreviewed('Move pedal')
    },

    /** `Ctrl+Backspace` with a pedal selected and nothing armed: every nudge dropped. DECLINEs when it
     *  carries none. */
    resetPedalOffset(id: string): boolean {
      const ok = ctx.model().resetPedalOffset(id)
      if (ok) ctx.mutate('Reset pedal nudge')
      return ok
    },

    /** `Ctrl+Backspace` on an armed square: that sign's `x` and the shared `y` back to the engraver's
     *  own. @returns false when it carries no nudge, so the key falls through. */
    resetPedalEndpointOffset(id: string, which: 'start' | 'end'): boolean {
      const ok = ctx.model().resetPedalEndpointOffset(id, which)
      if (ok) ctx.mutate('Reset pedal nudge')
      return ok
    },
  }
}
