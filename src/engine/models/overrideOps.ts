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
 * an undo snapshot — the facade (`MusicEngine`) owns the per-press `saveOnly`, because a
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
  StaffSpacingOverride, FanMemberChord,
} from '@/types/music'
import { dbg } from '@/utils/debug'
import {
  restShiftOverrideOf, restHiddenOf, dynamicOffsetOverrideOf, noteOffsetOverrideOf,
  staffSpacingOverrideOf, BAR_STRETCH_MIN, BAR_STRETCH_MAX,
} from './engravingOverrides'

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
 * per-press `saveOnly`, mirroring `setSlurEndpointOffset` / `nudgeSlurEndpoint`.
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
 * per-press `saveOnly`, mirroring {@link nudgeRestShift} / {@link nudgeSlurEndpoint}.
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
 * Nudge a note's manual horizontal offset by `dx` staff-spaces, **accumulating** onto any existing
 * offset (the Ctrl+arrow keyboard fine-positioning — see docs/note-offset-plan.md). Stored as a
 * {@link NoteOffsetOverride} in the engraving-overrides compartment under the key
 * {@link offsetTargetOf} resolves — the **slot** id for anything ordinary (one StaveNote is one
 * slot, so a chord moves as a unit), a fanned MEMBER's own first pitch id for a member. The offset
 * is a delta on top of the note's natural column; render folds it back in via `StaveNote.setXShift`.
 *
 * Returning to a net `x` of 0 clears the entry (so "absent = default" holds and the JSON stays
 * clean). No undo snapshot here — the facade (`MusicEngine.nudgeNoteOffset`) owns the per-press
 * `saveOnly`, mirroring {@link nudgeDynamicOffset}.
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
