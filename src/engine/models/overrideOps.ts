/**
 * THE WRITE SIDE of the engraving-overrides compartment — extracted from {@link ScoreModel}, which
 * keeps thin public delegators to these free functions (the `clefOps` / `rebarOps` idiom;
 * docs/modularity-plan-2026-07-28.md Phase 3).
 *
 * The compartment is a sub-tree of `Score` (`score.engravingOverrides`) holding hand-positioning
 * data — staff-space, anchor-relative — kept OUT of the musical content model, so it clones,
 * serializes and undoes with the score value for free. See docs/engraving-overrides-plan.md.
 *
 * ⚠️ **Reads live next door in `engravingOverrides.ts`, and the split is deliberate.** The renderer
 * holds a `Score`, not a `ScoreModel`, and imports the readers directly at draw time; keeping the
 * mutators in a different module is what makes "the renderer cannot write an override" a fact about
 * the imports rather than a rule to remember. This module imports that one, never the reverse.
 *
 * Every client here is one of the same shape: accumulate or set, and **clear the entry when the
 * value returns to its default**, so "absent = default" holds and the JSON stays clean. None takes
 * an undo snapshot — the facade (`MusicEngine`) owns the per-press `mutate`, because a
 * model-level snapshot would push one undo entry per drag frame.
 *
 * ⚠️ NOT here: `setCautionaryAllowed` / `setCautionaryClefAllowed`. They write to the same
 * compartment but they are **score policy** — whether a courtesy meter/clef is allowed at a
 * barline — not authored geometry, so they stay on `ScoreModel` and call in through
 * {@link setEngravingOverride}. Filing them by their storage rather than by what they SAY is how a
 * module ends up owning a topic it has nothing to do with.
 */
import type {
  Score, EngravingOverride, RestShiftOverride, RestHiddenOverride, LeadingSpaceOverride,
  BarlineSpaceOverride, BarWidthOverride, DynamicOffsetOverride, NoteOffsetOverride,
  StaffSpacingOverride, FanMemberChord, TempoOffsetOverride, ClefOffsetOverride, Fraction } from '@/types/music'
import { dbg } from '@/utils/debug'
import { fracLt, fracLte } from '@/utils/fraction'
import {
  restShiftOverrideOf, restHiddenOf, dynamicOffsetOverrideOf, noteOffsetOverrideOf,
  staffSpacingOverrideOf, BAR_STRETCH_MIN, BAR_STRETCH_MAX, tempoOffsetOverrideOf,
  clefOffsetOverrideOf, parseRestPositionKey } from './engravingOverrides'

/**
 * Upsert an override: replaces any existing entry of the same `kind` on this
 * element, otherwise appends. Lazily creates the compartment. An element may hold
 * several overrides of *different* kinds (e.g. a nudge AND a reshape) but only one
 * per kind.
 */
export function setEngravingOverride(score: Score, elementId: string, override: EngravingOverride): void {
  if (!score.engravingOverrides) score.engravingOverrides = {}
  const all = score.engravingOverrides
  const list = all[elementId] ?? (all[elementId] = [])
  const i = list.findIndex(o => o.kind === override.kind)
  if (i >= 0) list[i] = override
  else list.push(override)
}

/**
 * Clear overrides on an element: just one `kind` when given, else ALL overrides for
 * the element. Prunes the element's entry (and the whole compartment) once it
 * empties, so "absent = none" holds and the JSON stays clean.
 * @returns true if anything was removed.
 *
 * **This is also the conservative auto-reset primitive (plan §3.3 / Phase 2).** The
 * compartment drops an override on its own ONLY when an edit *provably* breaks its
 * anchor — the element is **deleted** (clear all kinds) or a span endpoint is
 * **re-pointed onto a different element** (clear the span-relative `curveShape`). Gray
 * zone edits (anchors survive, basis merely shifted — e.g. notes inserted under a slur)
 * stay sticky; when unsure, keep and show. The rule is **operation-driven**: its callers
 * are the explicit, finite set of edit ops that remove/re-anchor an overridable element
 * (grep `auto-reset (§3.3)`), NOT a sweep over "what looks orphaned". Today that set is
 * slur-only — slurs have durable ids; it must NOT be wired to auto-rests/beams until
 * their ids stop churning across regeneration (plan §3.6, "Adding an element").
 */
export function clearEngravingOverride(score: Score, elementId: string, kind?: string): boolean {
  const all = score.engravingOverrides
  const list = all?.[elementId]
  if (!all || !list) return false
  let removed = false
  if (kind === undefined) {
    delete all[elementId]
    removed = true
  } else {
    const i = list.findIndex(o => o.kind === kind)
    if (i >= 0) {
      list.splice(i, 1)
      removed = true
    }
    if (list.length === 0) delete all[elementId]
  }
  if (Object.keys(all).length === 0) delete score.engravingOverrides
  return removed
}

/**
 * Nudge a rest's manual vertical shift by `delta` whole staff-steps, **accumulating** onto
 * any existing shift (the ↑/↓ keyboard fine-positioning — see docs/rest-shift-plan.md).
 * Stored as a {@link RestShiftOverride} in the engraving-overrides compartment, keyed by the
 * rest's **position address** (`posKey`, built by `restPositionKey`) rather than an id —
 * rests have no durable id (rest-fill mints fresh ones every edit). The override is a delta
 * on top of the automatic multi-voice placement; render adds it back in.
 *
 * Returning to a net shift of 0 clears the entry (so "absent = default" holds and the JSON
 * stays clean). No undo snapshot here — the facade (`MusicEngine.nudgeRestShift`) owns the
 * per-press `mutate`, mirroring `setSlurEndpointOffset` / `nudgeSlurEndpoint`.
 * @returns true (the override always exists/updates for a valid position key).
 */
export function nudgeRestShift(score: Score, posKey: string, delta: number): boolean {
  const prev = restShiftOverrideOf(score, posKey)
  const steps = (prev?.steps ?? 0) + delta
  if (steps === 0) {
    clearEngravingOverride(score, posKey, 'restShift')
  } else {
    const next: RestShiftOverride = { kind: 'restShift', steps }
    setEngravingOverride(score, posKey, next)
  }
  return true
}

/**
 * Toggle whether the rest at this position address is hidden (the Sibelius-style
 * Ctrl+Shift+H — see docs/rest-hide-plan.md). A {@link RestHiddenOverride} is payloadless,
 * so the toggle is presence-based: set it when absent, clear it when present. Position-keyed
 * (`posKey` from `restPositionKey`) for the same reason as {@link nudgeRestShift} — rests
 * have no durable id. No undo snapshot here; the facade (`MusicEngine.toggleRestHidden`) /
 * its multi-rest batch owns the snapshot.
 * @returns true (the override always toggles for a valid position key).
 */
export function toggleRestHidden(score: Score, posKey: string): boolean {
  if (restHiddenOf(score, posKey)) {
    clearEngravingOverride(score, posKey, 'restHidden')
  } else {
    const next: RestHiddenOverride = { kind: 'restHidden' }
    setEngravingOverride(score, posKey, next)
  }
  return true
}

/**
 * Drop the HIDDEN flag (client #6) filed at ONE position address — the auto-reset owed when a NOTE
 * takes that position, so the rest it was written for will not be there.
 *
 * 🚨 **HIS REPORT, 2026-08-30**: hide a rest, then overwrite it with a note. The slot became a
 * chord, but `{measureId}:v0:b0/1` still carried `{kind:'restHidden'}` in the exported JSON — an
 * instruction about a rest that no longer exists, waiting to be inherited by whatever rest refills
 * that beat later. The Prelude example had 24 of them, every one sitting on a chord.
 *
 * ⛔ **The SHIFT at the same address is deliberately left standing** — `rest-shift-plan.md` §4
 * accepts resurrect-on-return, and a settled decision is not mine to retire. The asymmetry is the
 * point and it is written up in `rest-hide-plan.md` §"A hide does not resurrect": a resurrected
 * shift ANNOUNCES itself (the rest returns in the wrong place, and one nudge answers it), while a
 * resurrected hide is a rest that silently is not drawn — nothing on the page to select, and
 * nothing to undo.
 *
 * ⚠️ **The narrowness is the whole point, and it is the same line {@link clearRemovedContentOverrides}
 * draws.** A rest override outliving its rest is the DESIGN — rest ids churn on every edit, so the
 * override is filed by POSITION and *must* survive the rest-fill churn that a duration change or a
 * gap refill sets off (shorten a hidden whole rest to a quarter and it stays hidden). Only the
 * operation can tell the two apart, so this is called by the finite set of ops that put a NOTE
 * where a rest was — never by a sweep over "what looks orphaned".
 * @returns true if a hidden flag was dropped.
 */
export function clearRestHiddenAt(score: Score, posKey: string): boolean {
  const removed = clearEngravingOverride(score, posKey, 'restHidden')
  if (removed) dbg(`[overrides] dropped restHidden at ${posKey} — a note took the position`)
  return removed
}

/**
 * Set the user-authored **leading space** before one rhythmic column (client #10 — see
 * docs/note-spacing-plan.md), in staff-spaces, signed. Stored as a {@link LeadingSpaceOverride}
 * keyed by the column's position address (`posKey`, built by `spacingPositionKey`) — a column
 * has no id of its own, and deliberately no voice/staff either: the key IS the voice and staff
 * sync.
 *
 * ⚠️ **`minSpace` is the caller's, and it is not optional.** A negative space must not pull a
 * column left through its left neighbour's glyph, and that floor cannot be applied at render:
 * the formatted gap depends on the justified width, which depends on the very number being
 * clamped. Clamping only at draw would leave the *width* computed from the unclamped value, so
 * the bar would move further than its columns do and a hole would open at the barline. So the
 * clamp lands here, on the way in, measured by whoever has the last render in hand — and every
 * reader downstream applies the stored number verbatim.
 *
 * Zero clears the entry (so "absent = default" holds and the JSON stays clean). No undo snapshot
 * here — the facade (`MusicEngine.setNoteSpacing`) owns it, mirroring {@link nudgeRestShift} /
 * {@link nudgeDynamicOffset}. A model-level snapshot would push one undo entry per drag frame.
 * @returns the space actually stored, after the clamp.
 */
/**
 * Set the authored **space before the barline** for one bar (see {@link BarlineSpaceOverride}), in
 * staff-spaces, signed. Keyed by `barlineSpaceKey`.
 *
 * The same shape as {@link setNoteSpacing} and for the same reasons — `minSpace` is the caller's
 * measured floor (only the last render knows how close the bar's final glyph already stands to the
 * line), zero clears the entry, and no undo snapshot is taken here because the facade owns it.
 *
 * What differs is only the address: a leading space names a column and shifts it, this names the
 * bar's end and shifts nothing. See {@link measureUserSpacePx} for why that is all it takes.
 * @returns the space actually stored, after the clamp.
 */
export function setBarlineSpace(score: Score, key: string, space: number, minSpace: number): number {
  const clamped = Math.max(space, minSpace)
  if (clamped === 0) {
    clearEngravingOverride(score, key, 'barlineSpace')
  } else {
    const next: BarlineSpaceOverride = { kind: 'barlineSpace', space: clamped }
    setEngravingOverride(score, key, next)
  }
  return clamped
}

export function setNoteSpacing(score: Score, posKey: string, space: number, minSpace: number): number {
  const clamped = Math.max(space, minSpace)
  if (clamped === 0) {
    clearEngravingOverride(score, posKey, 'leadingSpace')
  } else {
    const next: LeadingSpaceOverride = { kind: 'leadingSpace', space: clamped }
    setEngravingOverride(score, posKey, next)
  }
  return clamped
}

/**
 * Set a bar's authored **stretch** — the multiplier on its own note space (client #11 — see
 * docs/bar-width-plan.md). Stored as a {@link BarWidthOverride} keyed by {@link barWidthKey}.
 *
 * **Two clamps, and the second is not optional.** `minStretch` is the caller's — the *measured*
 * floor from the last render, the same contract as {@link setNoteSpacing}'s `minSpace`: only
 * whoever has the drawn bar in hand knows how much room its music is actually using. On top of
 * that sits an absolute `[BAR_STRETCH_MIN, BAR_STRETCH_MAX]`, because this override is also
 * hand-editable in the Score JSON panel and `distributeLineWidths` leaves negative totals
 * uncapped by design — so a typed `0` would otherwise produce a negative-width bar.
 *
 * `1` clears the entry (so "absent = the engraver's own width" holds and the JSON stays clean).
 * No undo snapshot here — the facade (`MusicEngine.setBarWidth`) owns it, mirroring
 * {@link setNoteSpacing}; a model-level snapshot would push one undo entry per drag frame.
 * @returns the stretch actually stored, after both clamps.
 */
export function setBarWidth(score: Score, key: string, stretch: number, minStretch: number): number {
  const clamped = Math.min(
    BAR_STRETCH_MAX,
    Math.max(BAR_STRETCH_MIN, Math.max(stretch, minStretch)),
  )
  if (clamped === 1) {
    clearEngravingOverride(score, key, 'barWidth')
  } else {
    const next: BarWidthOverride = { kind: 'barWidth', stretch: clamped }
    setEngravingOverride(score, key, next)
  }
  return clamped
}

/**
 * Nudge a dynamic's manual position offset by `(dx, dy)` staff-spaces, **accumulating** onto
 * any existing offset (the ←→↑↓ / Ctrl+arrow keyboard fine-positioning — see
 * docs/dynamic-offset-plan.md). Stored as a {@link DynamicOffsetOverride} in the
 * engraving-overrides compartment, keyed by the dynamic's durable `id` (element-id-keyed,
 * unlike the position-keyed rest clients). The offset is a delta on top of the mark's
 * automatic placement; render adds it back in.
 *
 * Returning to a net (0,0) clears the entry (so "absent = default" holds and the JSON stays
 * clean). No undo snapshot here — the facade (`MusicEngine.nudgeDynamicOffset`) owns the
 * per-press `mutate`, mirroring {@link nudgeRestShift} / {@link nudgeSlurEndpoint}.
 * @returns true (the override always exists/updates for a valid dynamic id).
 */
export function nudgeDynamicOffset(score: Score, dynamicId: string, dx: number, dy: number): boolean {
  const prev = dynamicOffsetOverrideOf(score, dynamicId)
  const x = (prev?.x ?? 0) + dx
  const y = (prev?.y ?? 0) + dy
  if (x === 0 && y === 0) {
    clearEngravingOverride(score, dynamicId, 'dynamicOffset')
  } else {
    const next: DynamicOffsetOverride = { kind: 'dynamicOffset', x, y }
    setEngravingOverride(score, dynamicId, next)
  }
  return true
}

/**
 * The same for a **TEMPO MARK** (client #13, his ask 2026-08-19) — accumulate `(dx, dy)`
 * staff-spaces onto the mark's own offset, clear the entry at a net (0,0), no undo snapshot (the
 * facade owns it). {@link nudgeDynamicOffset} verbatim with one word changed, which is the point:
 * the two marks differ in what they are attached to, not in how a hand moves them.
 * @returns true (the override always exists/updates for a valid tempo id).
 */
export function nudgeTempoOffset(score: Score, tempoId: string, dx: number, dy: number): boolean {
  const prev = tempoOffsetOverrideOf(score, tempoId)
  const x = (prev?.x ?? 0) + dx
  const y = (prev?.y ?? 0) + dy
  if (x === 0 && y === 0) {
    clearEngravingOverride(score, tempoId, 'tempoOffset')
  } else {
    const next: TempoOffsetOverride = { kind: 'tempoOffset', x, y }
    setEngravingOverride(score, tempoId, next)
  }
  return true
}

/**
 * ⭐ `Ctrl+Backspace` on a selected mark: drop its hand nudge and let the engraver have it back.
 *
 * ⚠️ **Returns false when there was nothing to reset**, which is the whole contract — the key has
 * several tenants (the note's spacing, the bar's width), so a branch that answered true for "no
 * change" would swallow the press for everything behind it.
 */
export function resetMarkOffset(score: Score, id: string, kind: 'dynamicOffset' | 'tempoOffset'): boolean {
  return clearEngravingOverride(score, id, kind)
}

/**
 * Nudge a note's manual horizontal offset by `dx` staff-spaces, **accumulating** onto any existing
 * offset (the Ctrl+arrow keyboard fine-positioning — see docs/note-offset-plan.md). Stored as a
 * {@link NoteOffsetOverride} in the engraving-overrides compartment under the key
 * {@link offsetTargetOf} resolves — the **slot** id for anything ordinary (one StaveNote is one
 * slot, so a chord moves as a unit), a fanned MEMBER's own first pitch id for a member. The offset
 * is a delta on top of the note's natural column; render folds it back in via `StaveNote.setXShift`.
 *
 * Returning to a net `x` of 0 clears the entry (so "absent = default" holds and the JSON stays
 * clean). No undo snapshot here — the facade (`MusicEngine.nudgeNoteOffset`) owns the per-press
 * `mutate`, mirroring {@link nudgeDynamicOffset}.
 * @returns true (the override always exists/updates for a valid key).
 */
export function nudgeNoteOffset(score: Score, key: string, dx: number): boolean {
  const prev = noteOffsetOverrideOf(score, key)
  const x = (prev?.x ?? 0) + dx
  if (x === 0) {
    clearEngravingOverride(score, key, 'noteOffset')
  } else {
    const next: NoteOffsetOverride = { kind: 'noteOffset', x }
    setEngravingOverride(score, key, next)
  }
  return true
}

/**
 * Nudge an inline clef's manual horizontal offset by `dx` staff-spaces, **accumulating** onto any
 * existing offset — {@link nudgeNoteOffset}'s twin, keyed by the {@link ClefChange} id (his ask,
 * 2026-08-28). Returning to a net `x` of 0 clears the entry, so "absent = default" holds and the JSON
 * stays clean. No undo snapshot here; the facade (`MusicEngine.nudgeClefOffset`) owns the per-press
 * `mutate`.
 * @returns true (the override always exists/updates for a valid id).
 */
export function nudgeClefOffset(score: Score, clefId: string, dx: number): boolean {
  const prev = clefOffsetOverrideOf(score, clefId)
  const x = (prev?.x ?? 0) + dx
  if (x === 0) {
    clearEngravingOverride(score, clefId, 'clefOffset')
  } else {
    const next: ClefOffsetOverride = { kind: 'clefOffset', x }
    setEngravingOverride(score, clefId, next)
  }
  return true
}

/** Drop an inline clef's horizontal offset outright, back to where the engraver put it — the
 *  first-class reset every override client gets. No undo snapshot here; the facade owns it.
 *  @returns true if an offset was there to clear. */
export function clearClefOffset(score: Score, clefId: string): boolean {
  if (!clefOffsetOverrideOf(score, clefId)) return false
  clearEngravingOverride(score, clefId, 'clefOffset')
  return true
}

/** Drop a note's horizontal offset outright, back to its natural column (the Ctrl+Backspace
 *  first-class reset — see docs/note-offset-plan.md). Keyed by {@link offsetTargetOf}. No undo
 *  snapshot here; the facade owns it. @returns true if an offset was there to clear. */
export function clearNoteOffset(score: Score, key: string): boolean {
  if (!noteOffsetOverrideOf(score, key)) return false
  clearEngravingOverride(score, key, 'noteOffset')
  return true
}

/**
 * Drop the stored offsets of fanned members that are GOING AWAY — the sweep every id-keyed client
 * owes the compartment when its element dies (docs/note-offset-plan.md P3).
 *
 * ⚠️ **A member dies in more than one place**, which is the whole reason this is a helper: the
 * `Delete` key takes one ({@link deleteNote}), lowering `fan.count` truncates the list
 * (`normalizeFan` in {@link setFan}), removing the fan drops all of them, and deleting the note
 * that was typed takes the slot and the group with it. Miss one and the entry is stranded — it can
 * never mis-apply, since a new member is minted with a new id, but it stays in the JSON forever.
 */
export function clearFanMemberOffsets(score: Score, members: FanMemberChord[] | undefined): void {
  for (const member of members ?? []) {
    const first = member.pitches[0]
    if (first) clearEngravingOverride(score, first.id, 'noteOffset')
  }
}

/** Carry a stored note offset from one key to another, doing nothing when there is none — the one
 *  thing a re-keying edit owes the compartment. Only `noteOffset` moves: every other override at
 *  the old key belongs to whatever else was addressed by it. */
export function moveNoteOffsetKey(score: Score, from: string, to: string): void {
  const ov = noteOffsetOverrideOf(score, from)
  if (!ov) return
  clearEngravingOverride(score, from, 'noteOffset')
  const next: NoteOffsetOverride = { kind: 'noteOffset', x: ov.x }
  setEngravingOverride(score, to, next)
  dbg(`[Model] note offset ${ov.x} re-keyed ${from} → ${to}`)
}

/**
 * Nudge a staff's extra "space above" by `delta` staff-spaces, **accumulating** onto any
 * existing value (the Sibelius-style Alt+↑/↓ vertical staff drag — see
 * docs/staff-spacing-plan.md). Stored as a {@link StaffSpacingOverride} in the
 * engraving-overrides compartment, keyed by the durable `staffId` (unlike the position-keyed
 * rest clients). Render adds the accumulated per-system `above` back into each stave's Y.
 *
 * Returning to a net `above` of 0 clears the entry (so "absent = default" holds and the JSON
 * stays clean). No undo snapshot here — the facade owns the per-press snapshot, mirroring
 * {@link nudgeRestShift}.
 * @returns true (the override always exists/updates for a valid staffId).
 */
export function nudgeStaffSpacing(score: Score, staffId: string, delta: number): boolean {
  const prev = staffSpacingOverrideOf(score, staffId)
  const above = (prev?.above ?? 0) + delta
  if (above === 0) {
    clearEngravingOverride(score, staffId, 'staffSpacing')
  } else {
    const next: StaffSpacingOverride = { kind: 'staffSpacing', above }
    setEngravingOverride(score, staffId, next)
  }
  return true
}

/**
 * Set a staff's extra "space above" to an absolute `above` (staff-spaces). The drag path
 * (Phase 2) commits an absolute value rather than accumulating. Keyed by the durable
 * `staffId`; clears the entry when `above` lands on 0 so "absent = default" holds.
 * @returns true.
 */
export function setStaffSpacing(score: Score, staffId: string, above: number): boolean {
  if (above === 0) {
    clearEngravingOverride(score, staffId, 'staffSpacing')
  } else {
    const next: StaffSpacingOverride = { kind: 'staffSpacing', above }
    setEngravingOverride(score, staffId, next)
  }
  return true
}

/**
 * Reset a staff to default spacing (Layout → Reset Space Above): drops any
 * {@link StaffSpacingOverride} on this `staffId`.
 * @returns true if an override was removed.
 */
export function resetStaffSpacing(score: Score, staffId: string): boolean {
  return clearEngravingOverride(score, staffId, 'staffSpacing')
}

/**
 * ⭐⭐ **Drop the overrides that addressed content a bar-staff just LOST** — the auto-reset (§3.3)
 * for a clear, whose anchors are provably gone because the slots holding them were deleted.
 *
 * 🚨 **HIS REPORT, 2026-08-30** (the Prelude, staff 2 of bar 1): clearing a measure left its default
 * whole-bar rest sitting six steps HIGH. The bar's old voice-0 rest had been lifted by hand, and that
 * lift is filed under a POSITION — `{measureId}:s{staffId}:v0:b0/1` — not under the rest. Clearing
 * removed the rest and refilled the same address, so the fresh rest inherited a nudge authored for a
 * rest that no longer exists.
 *
 * ⭐ **That is the cost of a position key, and it is worth naming**: a position key survives its
 * element on purpose — rest-fill mints new ids on every edit, so an id-keyed shift would evaporate
 * the moment you typed the note after it (`nudgeRestShift`). The flip side is that the compartment
 * cannot see the difference between *this rest was regenerated* (keep the nudge) and *this rest was
 * deleted* (drop it). Only the OPERATION knows, which is why this is a function a clear CALLS rather
 * than a sweep over what looks orphaned.
 *
 * Two addresses go, both belonging to the removed content:
 *   - every **position** key in this measure on this staff (`…:v{n}:b{a}/{b}`) — the rest shifts and
 *     the hidden-rest flags of every voice that stood there;
 *   - every **slot id** among `slotIds` — the note offsets of the notes just deleted, whose keys can
 *     never be reached again.
 *
 * ⛔ **NOT the column keys** (`{measureId}:space:…`, the barline space, the bar width). A leading
 * space belongs to the COLUMN and is deliberately shared by every voice and both staves
 * (`spacingPositionKey`) — clearing one staff of a grand staff must not silently re-space the other.
 * ⛔ And not the measure's cautionaries: a courtesy clef/meter is score policy at a barline, not
 * something the cleared notes owned.
 *
 * @returns how many compartment entries were removed.
 */
export function clearRemovedContentOverrides(
  score: Score,
  measureId: string,
  staffId: string | undefined,
  slotIds: readonly string[],
): number {
  const all = score.engravingOverrides
  if (!all) return 0
  // ⚠️ Absent staffId IS the first staff (`keyStaffId`), so its prefix has no `:s` segment — and
  // because every other staff's key puts `:s{uuid}` immediately after the measure id, the short
  // prefix cannot reach them.
  const prefix = `${measureId}${staffId ? `:s${staffId}` : ''}:v`
  let removed = 0
  for (const key of Object.keys(all)) {
    if (key.startsWith(prefix)) {
      delete all[key]
      removed++
    }
  }
  for (const id of slotIds) {
    if (all[id]) {
      delete all[id]
      removed++
    }
  }
  if (Object.keys(all).length === 0) delete score.engravingOverrides
  if (removed) dbg(`[overrides] cleared ${removed} entr(ies) with the content of ${measureId} staff ${staffId ?? 0}`)
  return removed
}

/** One lane's cleared time: `[from, to)` of `voice` on `staffId` in `measureId`. Absent `staffId`
 *  is the first staff, the {@link restPositionKey} convention. */
export interface ClearedSpan {
  measureId: string
  staffId: string | undefined
  voice: number
  from: Fraction
  to: Fraction
}

/**
 * ⭐⭐ **The same auto-reset, for a cleared REGION rather than a whole bar-staff.**
 *
 * 🚨 **HIS REPORT, 2026-08-31** (the Prelude again, staff 2 of bar 1): clearing the second half of
 * the bar gave the right half rest in the right lane — drawn six steps high. That score lifts every
 * bass-staff voice-0 rest by hand, and the lift is filed under a POSITION
 * (`{measureId}:s{staffId}:v0:b2/1`) precisely because rest ids churn on every edit. The clear
 * refilled that position, and the new rest inherited a nudge authored for a 16th rest that had a
 * half note above it — *"we are clearing, that means the override should be cleared too"*.
 *
 * ⛔ **Span-scoped, not bar-scoped, and that is the whole difference from
 * {@link clearRemovedContentOverrides}.** A range clear empties only what was selected, so an
 * override at a position the clear never reached is still describing a rest that is still on the
 * page: dropping the bar's would silently un-lift the b0 rest that nobody touched. The two
 * functions are the same rule at two scales, which is why they live side by side.
 *
 * ⭐ Only POSITION keys are span-tested; `slotIds` covers the id-keyed entries (a note offset) of
 * the slots that went, whose anchors can never be reached again. Column keys (`:space:`) are
 * shared by every staff and are not this operation's to touch — the sibling's rule, unchanged.
 */
export function clearClearedSpanOverrides(
  score: Score,
  spans: readonly ClearedSpan[],
  slotIds: readonly string[],
): number {
  const all = score.engravingOverrides
  if (!all) return 0
  let removed = 0

  for (const key of Object.keys(all)) {
    const at = parseRestPositionKey(key)
    if (!at) continue
    const inside = spans.some(span =>
      span.measureId === at.measureId
      && span.staffId === at.staffId
      && span.voice === at.voice
      && fracLte(span.from, at.beat) && fracLt(at.beat, span.to))
    if (!inside) continue
    delete all[key]
    removed++
  }
  for (const id of slotIds) {
    if (all[id]) {
      delete all[id]
      removed++
    }
  }

  if (Object.keys(all).length === 0) delete score.engravingOverrides
  if (removed) dbg(`[overrides] cleared ${removed} entr(ies) with the content of ${spans.length} cleared span(s)`)
  return removed
}

/** The fields each bracket-shaped span's offset carries: a horizontal per END, and ONE vertical. */
interface SpanOffsetKeys {
  ottavaOffset: 'startX' | 'endX' | 'outward'
  pedalOffset: 'startX' | 'endX' | 'y'
  trillOffset: 'startX' | 'endX' | 'outward'
}
export type SpanOffsetFields<K extends keyof SpanOffsetKeys> = Partial<Record<SpanOffsetKeys[K], number>>

/** The order the fields are WRITTEN in — a serialized score's key order is observable. */
const SPAN_OFFSET_ORDER = ['startX', 'endX', 'outward', 'y'] as const

/**
 * Write a span mark's offset SPARSELY: a field that is 0 (or absent) is not written, and an entry
 * with no field left is cleared — what `ottavaOps`, `pedalOps` and `trillOps` each spelled.
 *
 * ⚠️ The shared vertical is what forces the sparseness: a purely horizontal nudge computes
 * `vertical = 0 + 0`, and written down that zero is a number the OTHER square then reports as a
 * nudge of its own — so `Ctrl+Backspace` on an untouched square would answer instead of falling
 * through to the note-spacing and bar-width resets. ⭐ It also keeps "absent = none" literally true.
 */
export function writeSpanOffset<K extends keyof SpanOffsetKeys>(
  score: Score, id: string, kind: K, next: SpanOffsetFields<K>,
): void {
  const fields = next as Partial<Record<(typeof SPAN_OFFSET_ORDER)[number], number>>
  const kept: EngravingOverride & Record<string, unknown> = { kind }
  for (const key of SPAN_OFFSET_ORDER) if (fields[key]) kept[key] = fields[key]
  if (Object.keys(kept).length === 1) {
    clearEngravingOverride(score, id, kind)
    return
  }
  setEngravingOverride(score, id, kept)
}
