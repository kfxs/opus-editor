/**
 * SLURS — the top-level phrasing spans, extracted from {@link ScoreModel}, which keeps thin public
 * delegators to these free functions (the `clefOps` / `rebarOps` idiom;
 * docs/modularity-plan-2026-07-28.md Phase 3).
 *
 * A slur is stored ONCE, at the top of the score (`score.slurs`), as a pair of note ids and a
 * voice — never on a measure, because a phrase does not stop at a barline and a span that lived on
 * one bar would have to be split and re-joined by every re-bar. See {@link Slur}.
 *
 * ⭐ **Everything about how a slur LOOKS lives somewhere else, and that is the point.** The arc's
 * hand-edited shape, its endpoint nudges, and the per-segment edits of a slur crossing a system
 * break are all engraving overrides keyed by the slur id (`overrideOps` / `engravingOverrides`), not
 * fields on the `Slur`: pixels stay out of the content model (docs/engraving-overrides-plan.md
 * Phase 1). So most of this module is the WRITE half of that arrangement, and the reason a slur has
 * four setters rather than one is that they clear each other on different rules — re-anchoring an
 * end drops every edit that was authored against it (the span-relative shapes AND that end's own
 * nudge) while leaving the OTHER end's nudge alone, which is a musical decision written into
 * {@link setSlurEndpoint}.
 *
 * ⚠️ Re-attaching slurs across a re-bar is NOT here — that is `rebarOps`, which owns every
 * beat-anchored thing that has to survive the barlines moving.
 */
import type {
  Score, Slur, Fraction, CurveControlPointDeltas, CurveShapeOverride, SlurEndpointOffsetOverride,
  SlurOffsetOverride, SegmentCurveShapeOverride, SegmentEndpointOffsetOverride, SlurSegmentAddress,
  SlurSegmentEndpointAddress,
} from '@/types/music'
import { fracAdd, fracSub, fracCompare } from '@/utils/fraction'
import { measureStartOffsets as measureStarts } from '@/utils/measureCapacity'
import { voiceOf } from '@/utils/lanes'
import { onSameStaff } from '@/utils/dynamicScope'
import { v4 as uuidv4 } from 'uuid'
import { engravingOverrideOf } from './engravingOverrides'
import { setEngravingOverride, clearEngravingOverride } from './overrideOps'

/** All phrasing slurs (the live array; empty if none). See {@link Slur}. */
export function getSlurs(score: Score): Slur[] {
  return score.slurs ?? []
}

/** Add a slur; returns the stored Slur (with a generated id). */
export function addSlur(score: Score, slur: Omit<Slur, 'id'>): Slur {
  const created: Slur = { ...slur, id: uuidv4() }
  if (!score.slurs) score.slurs = []
  score.slurs.push(created)
  return created
}

/** Remove a slur by id. @returns true if one was removed. */
export function removeSlur(score: Score, id: string): boolean {
  if (!score.slurs) return false
  const i = score.slurs.findIndex(s => s.id === id)
  if (i < 0) return false
  score.slurs.splice(i, 1)
  clearEngravingOverride(score, id) // auto-reset (§3.3): slur deleted → its overrides die with it
  return true
}

/** Find a slur by its exact (directional) endpoints, or undefined. */
export function findSlurByEndpoints(score: Score, startNoteId: string, endNoteId: string): Slur | undefined {
  return score.slurs?.find(s => s.startNoteId === startNoteId && s.endNoteId === endNoteId)
}

/** Find a slur anywhere by id (live reference), or null. */
export function getSlurById(score: Score, id: string): Slur | null {
  return score.slurs?.find(s => s.id === id) ?? null
}

/**
 * Set (or clear) a slur's user-edited curve shape. Pass the two cubic control-point
 * deltas (in **staff-spaces**, anchor-relative — the caller converts from pixels) to
 * override the auto arch; pass `null` to drop the override and revert to the auto
 * shape. The shape lives in the engraving-overrides compartment keyed by the slur id
 * (a {@link CurveShapeOverride}), NOT on the `Slur` — pixels stay out of the content
 * model (Phase 1; see docs/engraving-overrides-plan.md). @returns true if the slur
 * exists and was updated.
 */
export function setSlurShape(score: Score, id: string, cps: CurveControlPointDeltas | null): boolean {
  const slur = getSlurById(score, id)
  if (!slur) return false
  if (cps) {
    const override: CurveShapeOverride = { kind: 'curveShape', cps }
    setEngravingOverride(score, id, override)
  } else {
    clearEngravingOverride(score, id, 'curveShape')
  }
  return true
}

/**
 * ⭐⭐ **RE-POINT ONE END AND KEEP EVERY AUTHORED EDIT** — the bare model write, with none of the
 * auto-resets {@link setSlurEndpoint} makes.
 *
 * It exists for the INTERPOLATING walk (`interactions/slurEndpointWalk`), where a horizontal arrow
 * moves the endpoint's INK and the anchor follows it onto the next note once the ink gets there.
 * That crossing is meant to be **invisible** — his call, 2026-08-18: preserve the nudge, *"probably
 * reset it can be strange"* — so the very wipes that are right for "not that note" are wrong here:
 * a ¼-space press would silently drop the arc's hand-tuned shape and the end's vertical lift the
 * moment it stepped over a notehead. The walk re-bases the horizontal offset itself, by the distance
 * between the two anchors, so the ink stays exactly where it was drawn.
 *
 * ⚠️ **This is the one path that leaves an offset pointing at a note it was not tuned for**, which
 * is deliberate and bounded: the walk only re-points onto the note the ink has *arrived at*, so the
 * offset it keeps is the one the user just steered there by hand. Every other caller — the drag, the
 * Ctrl+Shift+←/→ jump, a re-bar — wants {@link setSlurEndpoint}.
 *
 * Rejected (false) on the same three grounds as its caller: missing slur, unchanged anchor, or a
 * target that would collapse the span.
 */
export function setSlurEndpointKeepingEdits(
  score: Score,
  id: string,
  which: 'start' | 'end',
  noteId: string,
): boolean {
  const slur = getSlurById(score, id)
  if (!slur) return false
  const otherId = which === 'start' ? slur.endNoteId : slur.startNoteId
  const currentId = which === 'start' ? slur.startNoteId : slur.endNoteId
  if (noteId === otherId || noteId === currentId) return false
  if (which === 'start') slur.startNoteId = noteId
  else slur.endNoteId = noteId
  return true
}

/**
 * Re-anchor one end of a slur onto a different note (the draggable endpoint handles, and the
 * Ctrl+Shift+←/→ walk in `interactions/slurReanchor`). Rewrites `startNoteId` or `endNoteId` and
 * **drops any custom shape** — the hand-tuned arc was relative to the old span, so it re-bows to
 * the auto arch for the new endpoints — **and the moved end's own nudge**, which was tuned against
 * the note it is leaving. Rejected (returns false) if the slur is missing, the target equals
 * the current anchor, or it would collapse the span (start === end).
 */
export function setSlurEndpoint(score: Score, id: string, which: 'start' | 'end', noteId: string): boolean {
  if (!setSlurEndpointKeepingEdits(score, id, which, noteId)) return false
  // auto-reset (§3.3): endpoint re-pointed onto a different element → both the single-arc
  // shape AND the cross-system per-segment shape were authored against the OLD anchors.
  clearEngravingOverride(score, id, 'curveShape')
  clearEngravingOverride(score, id, 'segmentCurveShape')
  // The open-join nudges are margin-bound and span-relative (like segmentCurveShape), so a
  // re-anchor — which can change the span — wipes them too.
  clearEngravingOverride(score, id, 'segmentEndpointOffset')
  // ⭐ …and so does the MOVED end's own nudge (his call, 2026-08-17), reversing what
  // docs/slur-endpoint-offset-plan.md §"survives" first decided. Anchor-relative makes the offset
  // *transferable*, not *wanted*: it was tuned to clear the notehead, stem and accidentals of the
  // note it used to sit on, and a re-anchor is the user saying "not that note" — so carrying the
  // nudge along re-applies an answer to a question nobody asked again. Only the end that MOVED is
  // cleared; the other end never changed anchor, so its nudge is still the answer to its own note.
  // ⚠️ Both re-anchor paths run through here — the drag and the Ctrl+Shift+←/→ walk — deliberately:
  // it is the same gesture on two devices. What does NOT run through here is `reanchorSlurs`, where
  // an edit ELSEWHERE (a re-bar, a note→rest) re-points the span without the user touching the end.
  clearEndpointOffsetSide(score, id, which)
  return true
}

/**
 * Drop ONE end's {@link SlurEndpointOffsetOverride}, keeping the other's — the per-side clear
 * {@link setSlurEndpoint} needs, since the two ends share a single override object. Prunes the
 * whole entry when the other end has no offset either, so "absent = none" still holds.
 */
function clearEndpointOffsetSide(score: Score, id: string, which: 'start' | 'end'): void {
  const prev = engravingOverrideOf(score, id, 'endpointOffset') as SlurEndpointOffsetOverride | undefined
  if (!prev?.[which]) return
  const other = which === 'start' ? prev.end : prev.start
  if (!other) {
    clearEngravingOverride(score, id, 'endpointOffset')
    return
  }
  const kept: SlurEndpointOffsetOverride = which === 'start'
    ? { kind: 'endpointOffset', end: other }
    : { kind: 'endpointOffset', start: other }
  setEngravingOverride(score, id, kept)
}

/**
 * Nudge one endpoint of a slur by a staff-space delta, **accumulating** onto any existing
 * offset (the in/out keyboard fine-positioning — see docs/slur-endpoint-offset-plan.md).
 * Stored as a {@link SlurEndpointOffsetOverride} in the engraving-overrides compartment
 * (staff-spaces, anchor-relative — so it survives any font/zoom/reflow; ⚠️ it does NOT survive a
 * re-anchor of its own end, see {@link setSlurEndpoint}). `dx`/`dy` are in staff-spaces. A future
 * "reset" simply calls `clearEngravingOverride(id, 'endpointOffset')`.
 * @returns true if the slur exists.
 */
export function setSlurEndpointOffset(score: Score, id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
  if (!getSlurById(score, id)) return false
  const prev = engravingOverrideOf(score, id, 'endpointOffset') as SlurEndpointOffsetOverride | undefined
  const base = which === 'start' ? prev?.start : prev?.end
  const moved = { x: (base?.x ?? 0) + dx, y: (base?.y ?? 0) + dy }
  const next: SlurEndpointOffsetOverride = {
    kind: 'endpointOffset',
    ...(prev?.start ? { start: prev.start } : {}),
    ...(prev?.end ? { end: prev.end } : {}),
    [which]: moved,
  }
  setEngravingOverride(score, id, next)
  return true
}

/**
 * ⭐⭐ **Nudge the WHOLE curve, shape intact** — the arrows' write when the slur is selected and no
 * handle is armed (his ask, 2026-08-18), **accumulating** onto any existing offset. Stored as a
 * {@link SlurOffsetOverride} (staff-spaces, screen-signed).
 *
 * ⛔ **Not two {@link setSlurEndpointOffset} calls, which is the whole reason it is its own kind**:
 * those feed the arch solve, so an equal pair still re-runs the obstacle lift and the curve changes
 * shape as it moves. This one is added after the solve, in the renderer. See {@link SlurOffsetOverride}.
 * @returns true if the slur exists.
 */
export function setSlurOffset(score: Score, id: string, dx: number, dy: number): boolean {
  if (!getSlurById(score, id)) return false
  const prev = engravingOverrideOf(score, id, 'slurOffset') as SlurOffsetOverride | undefined
  const next: SlurOffsetOverride = {
    kind: 'slurOffset',
    x: (prev?.x ?? 0) + dx,
    y: (prev?.y ?? 0) + dy,
  }
  setEngravingOverride(score, id, next)
  return true
}

/**
 * Drop the whole curve's offset — `Ctrl+Backspace` with the slur selected and nothing armed, the
 * matching backspace for {@link setSlurOffset}. ⚠️ It leaves the per-END nudges and the arc's shape
 * alone: three separate statements about the drawing, three separate resets, exactly as the hairpin's
 * whole-wedge reset leaves its aperture alone. @returns false when the curve carries no offset.
 */
export function resetSlurOffset(score: Score, id: string): boolean {
  if (!getSlurById(score, id)) return false
  if (!engravingOverrideOf(score, id, 'slurOffset')) return false
  clearEngravingOverride(score, id, 'slurOffset')
  return true
}

/**
 * Set (or clear) the shape of ONE segment of a cross-system slur (BEGIN, END, or a MIDDLE
 * addressed by ordinal). Stored in the engraving-overrides compartment as a
 * {@link SegmentCurveShapeOverride}, separate from the single-arc `curveShape`. `cps` are
 * in **staff-spaces**, anchor-relative (the caller converts from pixels); pass `null` to
 * drop just that segment's edit. `spanCount` is the **live** system count at the time of
 * the edit — it becomes the override's reset signature.
 *
 * Count-change handling on write: if the stored override was authored against a *different*
 * `spanCount`, its MIDDLE edits are stale, so they are dropped here (begin/end are durable
 * and kept) before the live count is adopted — otherwise a stale middle could resurrect at
 * the wrong geometry once the signatures matched again. Mirrors the read-time apply rule
 * in `reconcileSegmentShape`. See docs/multisystem-slur-segment-shape-plan.md §2–§3.
 * @returns true if the slur exists and was updated.
 */
export function setSlurSegmentShape(
  score: Score,
  id: string,
  segment: SlurSegmentAddress,
  cps: CurveControlPointDeltas | null,
  spanCount: number,
): boolean {
  if (!getSlurById(score, id)) return false
  const prev = engravingOverrideOf(score, id, 'segmentCurveShape') as SegmentCurveShapeOverride | undefined
  // Rebuild the override fresh (cheap, avoids in-place aliasing). Adopt the live spanCount;
  // keep begin/end always (durable), keep middles only when the count is unchanged.
  const keepMiddles = prev !== undefined && prev.spanCount === spanCount
  const next: SegmentCurveShapeOverride = {
    kind: 'segmentCurveShape',
    spanCount,
    ...(prev?.begin ? { begin: prev.begin } : {}),
    ...(prev?.end ? { end: prev.end } : {}),
    middles: keepMiddles ? { ...(prev!.middles ?? {}) } : {},
  }
  if (segment.role === 'middle') {
    if (cps) next.middles![segment.ordinal] = cps
    else delete next.middles![segment.ordinal]
  } else if (segment.role === 'begin') {
    if (cps) next.begin = cps; else delete next.begin
  } else {
    if (cps) next.end = cps; else delete next.end
  }
  const hasAny = next.begin || next.end || Object.keys(next.middles ?? {}).length > 0
  if (hasAny) setEngravingOverride(score, id, next)
  else clearEngravingOverride(score, id, 'segmentCurveShape')
  return true
}

/**
 * ⭐ **THE UNDO OF A HAND EDIT** — drop what was authored on ONE slur handle and let the automatic
 * engraving take the point back (his ask, 2026-08-17: *"how do i revert the editing on the slur
 * control point?"*). Three functions rather than one, for the same reason the four setters above are
 * four: each handle's edit is a different override, and "reset" has to name which one.
 *
 * ⚠️ Each returns **false when there was nothing to reset**, not just when the slur is missing. That
 * is what lets the keyboard chain fall through to whatever else the reset key does — a reset that
 * always claimed success would swallow the key on every unedited slur.
 *
 * ## The ARC's shape ({@link resetSlurShape})
 *
 * Pass a `segment` (+ the live `spanCount`) to drop ONE segment's edit on a cross-system slur; pass
 * neither to drop every shape edit the slur carries — both the single-arc `curveShape` and the
 * per-segment one. The whole-slur form clears both deliberately: a slur that was reshaped on one line
 * and later reflowed across a break has a `curveShape` that nothing draws any more, and "reset this
 * slur's shape" that left it behind would leave a ghost to resurrect at the next reflow.
 */
export function resetSlurShape(
  score: Score,
  id: string,
  segment?: SlurSegmentAddress,
  spanCount?: number,
): boolean {
  if (!getSlurById(score, id)) return false
  if (segment && spanCount !== undefined) {
    const prev = engravingOverrideOf(score, id, 'segmentCurveShape') as SegmentCurveShapeOverride | undefined
    // A MIDDLE authored against a different system count is already stale (the write path drops it
    // too), so there is nothing to take back.
    const authored = segment.role === 'middle'
      ? (prev?.spanCount === spanCount ? prev?.middles?.[segment.ordinal] : undefined)
      : segment.role === 'begin' ? prev?.begin : prev?.end
    if (!authored) return false
    return setSlurSegmentShape(score, id, segment, null, spanCount)
  }
  const had = engravingOverrideOf(score, id, 'curveShape') !== undefined
    || engravingOverrideOf(score, id, 'segmentCurveShape') !== undefined
  if (!had) return false
  clearEngravingOverride(score, id, 'curveShape')
  clearEngravingOverride(score, id, 'segmentCurveShape')
  return true
}

/**
 * Drop ONE true end's nudge ({@link setSlurEndpointOffset}), keeping the other's — the same per-side
 * clear a re-anchor makes, on purpose: both are "this end goes back where the engraver put it".
 * ⚠️ Unlike the arc's shape, an endpoint offset IS per-side in the model, so this resets exactly the
 * square that is armed and nothing else. @returns false if that end carries no offset.
 */
export function resetSlurEndpointOffset(score: Score, id: string, which: 'start' | 'end'): boolean {
  if (!getSlurById(score, id)) return false
  const prev = engravingOverrideOf(score, id, 'endpointOffset') as SlurEndpointOffsetOverride | undefined
  if (!prev?.[which]) return false
  clearEndpointOffsetSide(score, id, which)
  return true
}

/**
 * Drop ONE open join's nudge ({@link setSlurSegmentEndpointOffset}), keeping the other joins'.
 * Prunes the whole override once the last one goes, so "absent = none" still holds.
 * @returns false if that join carries no offset (a stale-count MIDDLE included).
 */
export function resetSlurSegmentEndpointOffset(
  score: Score,
  id: string,
  address: SlurSegmentEndpointAddress,
  spanCount: number,
): boolean {
  if (!getSlurById(score, id)) return false
  const prev = engravingOverrideOf(score, id, 'segmentEndpointOffset') as SegmentEndpointOffsetOverride | undefined
  if (!prev) return false
  const fresh = prev.spanCount === spanCount
  const authored = address.role === 'middle'
    ? (fresh ? prev.middles?.[address.ordinal]?.[address.side] : undefined)
    : address.role === 'begin' ? prev.begin : prev.end
  if (!authored) return false
  // Rebuilt rather than mutated, exactly as the write path does — and on the same count rule, so a
  // stale-count reset also sheds the middles the next nudge would have shed.
  const next: SegmentEndpointOffsetOverride = {
    kind: 'segmentEndpointOffset',
    spanCount,
    ...(prev.begin ? { begin: prev.begin } : {}),
    ...(prev.end ? { end: prev.end } : {}),
    middles: fresh ? { ...(prev.middles ?? {}) } : {},
  }
  if (address.role === 'begin') delete next.begin
  else if (address.role === 'end') delete next.end
  else {
    const slot = { ...(next.middles![address.ordinal] ?? {}) }
    delete slot[address.side]
    if (slot.left || slot.right) next.middles![address.ordinal] = slot
    else delete next.middles![address.ordinal]
  }
  const remains = next.begin || next.end || Object.keys(next.middles ?? {}).length > 0
  if (remains) setEngravingOverride(score, id, next)
  else clearEngravingOverride(score, id, 'segmentEndpointOffset')
  return true
}

/**
 * Nudge one OPEN join of a cross-system slur by a staff-space delta, **accumulating** onto
 * any existing offset (keyboard fine-positioning — see
 * docs/multisystem-slur-segment-endpoint-offset-plan.md). Stored as a
 * {@link SegmentEndpointOffsetOverride}, separate from the durable note-anchored
 * `endpointOffset`. `dx`/`dy` are in **staff-spaces**, margin-relative. `spanCount` is the
 * **live** system count at the time of the edit — the override's reset signature.
 *
 * Count-change handling on write mirrors {@link setSlurSegmentShape}: if the stored override
 * was authored against a different `spanCount`, its MIDDLE offsets are stale and dropped here
 * (begin/end durable, kept) before the live count is adopted. @returns true if the slur exists.
 */
export function setSlurSegmentEndpointOffset(
  score: Score,
  id: string,
  address: SlurSegmentEndpointAddress,
  dx: number, dy: number,
  spanCount: number,
): boolean {
  if (!getSlurById(score, id)) return false
  const prev = engravingOverrideOf(score, id, 'segmentEndpointOffset') as SegmentEndpointOffsetOverride | undefined
  const keepMiddles = prev !== undefined && prev.spanCount === spanCount
  const next: SegmentEndpointOffsetOverride = {
    kind: 'segmentEndpointOffset',
    spanCount,
    ...(prev?.begin ? { begin: prev.begin } : {}),
    ...(prev?.end ? { end: prev.end } : {}),
    middles: keepMiddles ? { ...(prev!.middles ?? {}) } : {},
  }
  const add = (base: { x: number; y: number } | undefined) =>
    ({ x: (base?.x ?? 0) + dx, y: (base?.y ?? 0) + dy })
  if (address.role === 'begin') {
    next.begin = add(next.begin)
  } else if (address.role === 'end') {
    next.end = add(next.end)
  } else {
    const slot = { ...(next.middles![address.ordinal] ?? {}) }
    slot[address.side] = add(slot[address.side])
    next.middles![address.ordinal] = slot
  }
  setEngravingOverride(score, id, next)
  return true
}

/**
 * ⭐⭐ **HOW MUCH MUSIC A SLUR COVERS** — the distance between its two anchors, in quarter beats.
 *
 * ⭐ It is what a COPIED slur carries (`interactions/elementClipboard`), and the reason a slur can be
 * pasted at all: a slur's identity is two NOTE IDS, which mean nothing anywhere else, but *"a slur
 * over this much music"* travels. The hairpin's `length` exactly, arrived at from the other side —
 * there the model stores the amount and the ends are derived; here the model stores the ends and the
 * amount is derived.
 *
 * Null when either anchor is no longer in the score.
 */
export function slurSpanOf(score: Score, id: string): Fraction | null {
  const slur = getSlurById(score, id)
  if (!slur) return null
  const start = noteAbsBeat(score, slur.startNoteId)
  const end = noteAbsBeat(score, slur.endNoteId)
  return start && end ? fracSub(end, start) : null
}

/** One slur's two ends, as note ids. See {@link slurSpanAt}. */
export interface SlurEnds {
  startNoteId: string
  endNoteId: string
}

/**
 * ⭐⭐ **THE TWO NOTES A SLUR OF `span` WOULD JOIN, starting at `startNoteId`** — what a PASTE
 * resolves, and the only place that decides what *"the same slur, over there"* means.
 *
 * ```
 *   end = the LAST note that starts within `span` of the start   (else the next note after it)
 * ```
 *
 * 🚨 **The START is a NOTE, ⛔ never an address.** His two reports, 2026-08-20: a paste into an empty
 * bar drew a slur anyway (the address resolved forward until it found music), and *"for slurring a
 * note we should be really close to the bbox of that note"*. An address can always be resolved to
 * SOMETHING; a note either was clicked or was not, and the caller — which has the pointer — is the
 * only one that can say. ⛔ So this refuses rather than searching.
 *
 * ⚠️ **A rule, not a promise.** The destination's rhythm is its own, so a two-beat span may cover
 * three notes there where it covered two here; what is reproduced is the AMOUNT OF MUSIC — the same
 * approximation the hairpin's `length` makes when it lands on other music.
 *
 * ⛔ **A REST cannot anchor a slur** (the ottava's refusal, and for its reason: the mark is about
 * sounding notes), so rests are skipped at the far end too.
 */
export function slurEndsFrom(score: Score, startNoteId: string, span: Fraction): SlurEnds | null {
  const lane = slurLaneOf(score, startNoteId)
  const from = lane.findIndex(n => n.id === startNoteId)
  if (from === -1) return null

  const reach = fracAdd(lane[from].abs, span)
  let last = from
  while (last + 1 < lane.length && fracCompare(lane[last + 1].abs, reach) <= 0) last++
  // A span that reaches no further than its own start still makes a slur — to the next note, which
  // is what `MusicEngine.createSlur` does with a single selected note.
  if (last === from) last = from + 1
  return last < lane.length ? { startNoteId, endNoteId: lane[last].id } : null
}

/** Every NOTE of the lane a given note belongs to (its staff and voice), in reading order with its
 *  absolute beat. ⛔ Rests are not in it — they cannot anchor a slur. */
function slurLaneOf(score: Score, noteId: string): Array<{ id: string; abs: Fraction }> {
  const home = findSlurAnchorSlot(score, noteId)
  if (!home) return []
  // ⛔ Not another accumulation of the bars' capacities — `measureStartOffsets` is where that walk
  // lives, and a second copy is a second answer to where bar 7 begins (its own note says so).
  const starts = measureStarts(score.measures)
  const lane: Array<{ id: string; abs: Fraction }> = []
  for (const measure of score.measures) {
    const base = starts.get(measure.number)
    if (base === undefined) continue
    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      // ⚠️ A slot carries a staffId, not an index (`utils/dynamicScope.onSameStaff` is the
      // comparison — ⛔ never `staffOf`, which is for the flat projected Note).
      if (!onSameStaff(score, home, slot) || voiceOf(slot) !== voiceOf(home)) continue
      const id = slot.notes[0]?.id
      if (id) lane.push({ id, abs: fracAdd(base, slot.beat) })
    }
  }
  return lane.sort((a, b) => fracCompare(a.abs, b.abs))
}

/** The chord slot a note id belongs to — its lane is the slur's. */
function findSlurAnchorSlot(score: Score, noteId: string) {
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type === 'chord' && slot.notes.some(n => n.id === noteId)) return slot
    }
  }
  return null
}

/** Where a note sits on the score's one absolute timeline, or null if it is not in the score. */
function noteAbsBeat(score: Score, noteId: string): Fraction | null {
  const starts = measureStarts(score.measures)
  for (const measure of score.measures) {
    const base = starts.get(measure.number)
    if (base === undefined) continue
    for (const slot of measure.slots) {
      if (slot.type === 'chord' && slot.notes.some(n => n.id === noteId)) return fracAdd(base, slot.beat)
    }
  }
  return null
}

/** Set which side of the notes a slur is drawn on — what a COPY reproduces, since an explicit
 *  placement is a decision the user made (`x` flips it) rather than the stem-derived default. */
export function setSlurPlacement(score: Score, id: string, placement: 'above' | 'below'): boolean {
  const slur = getSlurById(score, id)
  if (!slur) return false
  slur.placement = placement
  return true
}

