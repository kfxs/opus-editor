import type { Score, EngravingOverride, CurveShapeOverride, SegmentCurveShapeOverride, SlurEndpointOffsetOverride, SegmentEndpointOffsetOverride, RestShiftOverride, StaffSpacingOverride, DynamicOffsetOverride, LeadingSpaceOverride, BarWidthOverride, CurveControlPointDeltas, Fraction } from '@/types/music'
import { fracCreate } from '@/utils/fraction'

/**
 * Pure reads over the engraving-overrides compartment (a sub-tree of `Score`; see
 * docs/engraving-overrides-plan.md). {@link ScoreModel} owns the mutators and
 * delegates its reads here; the renderer — which holds a `Score`, not a `ScoreModel` —
 * imports these directly to fetch an override at draw time.
 */

/** Every override recorded for an element id (the live array, or [] if none). */
export function engravingOverridesOf(score: Score, elementId: string): EngravingOverride[] {
  return score.engravingOverrides?.[elementId] ?? []
}

/** The override of a given `kind` on an element, or undefined when absent. */
export function engravingOverrideOf(score: Score, elementId: string, kind: string): EngravingOverride | undefined {
  return score.engravingOverrides?.[elementId]?.find(o => o.kind === kind)
}

/**
 * The element's hand-edited curve shape, if any (client #1 — slurs today). The `cps`
 * are in **staff-spaces**, anchor-relative; the renderer converts them to pixels at
 * draw time. Absent = the auto arch.
 */
export function curveShapeOverrideOf(score: Score, elementId: string): CurveShapeOverride | undefined {
  return engravingOverrideOf(score, elementId, 'curveShape') as CurveShapeOverride | undefined
}

/**
 * The element's per-segment cross-system slur shape, if any (client #2 — cross-system
 * slurs). See docs/multisystem-slur-segment-shape-plan.md. Absent = every segment draws
 * its auto arch. Read it through {@link reconcileSegmentShape} to apply the count-signature
 * staleness rule before using the `middles`.
 */
export function segmentCurveShapeOverrideOf(score: Score, elementId: string): SegmentCurveShapeOverride | undefined {
  return engravingOverrideOf(score, elementId, 'segmentCurveShape') as SegmentCurveShapeOverride | undefined
}

/**
 * The slur's hand-nudged endpoint offsets, if any (client #3 — see
 * docs/slur-endpoint-offset-plan.md). Each `start`/`end` `{x,y}` is in **staff-spaces**,
 * anchor-relative; the renderer converts to pixels against that end's own stave and adds
 * it to the auto endpoint position. Durable — both ends are note-anchored, so this reads
 * straight through (no reconcile rule, unlike {@link reconcileSegmentShape}). Absent = no
 * nudge.
 */
export function endpointOffsetOverrideOf(score: Score, elementId: string): SlurEndpointOffsetOverride | undefined {
  return engravingOverrideOf(score, elementId, 'endpointOffset') as SlurEndpointOffsetOverride | undefined
}

/** The cps to apply per segment of a cross-system slur, after the staleness rule. A field
 *  left undefined means "no override for that segment → draw the auto arch". */
export interface ResolvedSegmentShapes {
  begin?: CurveControlPointDeltas
  end?: CurveControlPointDeltas
  /** MIDDLE cps by ordinal. Empty when the override is absent OR its `spanCount` is stale. */
  middles: Record<number, CurveControlPointDeltas>
}

/**
 * Pure read-only apply rule for a {@link SegmentCurveShapeOverride} (plan §3). Given the
 * override (or undefined) and the **live** system count, decide which segment cps to use:
 *  - no override → nothing applied (all auto);
 *  - `spanCount` matches the live count → `begin`/`end`/`middles` all applied;
 *  - `spanCount` differs → `begin`/`end` applied, **`middles` ignored** (they are anchored
 *    to system margins that no longer exist; begin/end are note-anchored so they survive).
 *
 * No mutation — staleness is decided fresh every render, so this is correct without ever
 * writing back. (The optional lazy *clear* is out of scope; see plan §3.) Pure & VexFlow-free
 * for isolated unit testing, mirroring `planSlurSegments` / `slurTrueEndpoints`.
 */
export function reconcileSegmentShape(
  override: SegmentCurveShapeOverride | undefined,
  liveSpanCount: number,
): ResolvedSegmentShapes {
  if (!override) return { middles: {} }
  const sameCount = override.spanCount === liveSpanCount
  return {
    begin: override.begin,
    end: override.end,
    middles: sameCount ? { ...(override.middles ?? {}) } : {},
  }
}

/**
 * The slur's hand-nudged OPEN-join offsets, if any (client #4 — cross-system slurs). See
 * docs/multisystem-slur-segment-endpoint-offset-plan.md. Each `{x,y}` is in **staff-spaces**,
 * margin-relative; the renderer converts to pixels against that segment's own stave and adds
 * it to the auto open-end position. Read through {@link reconcileSegmentEndpointOffset} to
 * apply the count-signature staleness rule before using the `middles`.
 */
export function segmentEndpointOffsetOverrideOf(score: Score, elementId: string): SegmentEndpointOffsetOverride | undefined {
  return engravingOverrideOf(score, elementId, 'segmentEndpointOffset') as SegmentEndpointOffsetOverride | undefined
}

/** The open-join offsets to apply per segment of a cross-system slur, after the staleness
 *  rule. A field left undefined means "no nudge for that open end → draw at the auto margin
 *  position". Mirrors {@link ResolvedSegmentShapes}. */
export interface ResolvedSegmentEndpointOffsets {
  begin?: { x: number; y: number }
  end?: { x: number; y: number }
  /** MIDDLE open-end offsets by ordinal. Empty when the override is absent OR `spanCount`
   *  is stale (the middles' system margins no longer exist). */
  middles: Record<number, { left?: { x: number; y: number }; right?: { x: number; y: number } }>
}

/**
 * Pure read-only apply rule for a {@link SegmentEndpointOffsetOverride} — the open-join twin
 * of {@link reconcileSegmentShape}, with the identical staleness rule:
 *  - no override → nothing applied (all auto margins);
 *  - `spanCount` matches the live count → `begin`/`end`/`middles` all applied;
 *  - `spanCount` differs → `begin`/`end` applied, **`middles` ignored** (their system margins
 *    no longer exist; begin/end are tied to the stable start/end system edges so they survive).
 *
 * No mutation — staleness is decided fresh every render. Pure & VexFlow-free for isolated
 * unit testing.
 */
export function reconcileSegmentEndpointOffset(
  override: SegmentEndpointOffsetOverride | undefined,
  liveSpanCount: number,
): ResolvedSegmentEndpointOffsets {
  if (!override) return { middles: {} }
  const sameCount = override.spanCount === liveSpanCount
  return {
    begin: override.begin,
    end: override.end,
    middles: sameCount ? { ...(override.middles ?? {}) } : {},
  }
}

/**
 * Canonical position address for a rest-shift override (client #5 — see
 * docs/rest-shift-plan.md). Rests are regenerated with fresh ids on every edit, so the
 * override cannot hang off a rest id; it hangs off the rest's **position**:
 * `{measureId}[:s{staffId}]:v{voice}:b{num}/{den}`. The beat fraction is reduced (via
 * {@link fracCreate}) so `2/4` and `1/2` collapse to one key. The `measureId` (not the measure
 * *number*) keeps the key stable across insert/remove-measure renumbering and across rebar.
 *
 * The `staffId` is the rest slot's own `staffId` — a rest's vertical identity is the pair
 * `(staffId, voice)` (see {@link Chord.staffId}), and N staves SHARE one measure, so a key
 * without it would collapse the rest at bar/voice/beat on every staff onto one address — a shift
 * on staff 2 would then bleed onto staff 1's rest at the same spot. Absent (staff 0, the
 * single-staff case) appends NOTHING, so those keys stay byte-identical to the pre-multistaff
 * format; only staff 1+ carries a `:s…` segment. The `:s` still sits after `{measureId}:`, so
 * `MeasureRedrawKey.overridesFor`'s prefix match keeps catching it. Pure & exported for testing.
 */
export function restPositionKey(measureId: string, voice: number, beat: Fraction, staffId?: string): string {
  const b = fracCreate(beat.num, beat.den) // reduce defensively
  const staff = staffId ? `:s${staffId}` : '' // absent = staff 0 → no segment (back-compatible)
  return `${measureId}${staff}:v${voice}:b${b.num}/${b.den}`
}

/**
 * The manual vertical shift on the rest at this position address, if any (client #5 — see
 * docs/rest-shift-plan.md). `steps` is in whole staff-steps (signed, +up), added on top of
 * the automatic multi-voice placement at render. Key it with {@link restPositionKey}. Absent
 * = no shift (the rest renders at its default voice position).
 */
export function restShiftOverrideOf(score: Score, posKey: string): RestShiftOverride | undefined {
  return engravingOverrideOf(score, posKey, 'restShift') as RestShiftOverride | undefined
}

/**
 * Whether the rest at this position address is hidden (client #6 — see
 * docs/rest-hide-plan.md). The override is payloadless, so presence alone means hidden;
 * key it with {@link restPositionKey}. Absent = visible (the rest draws normally).
 */
export function restHiddenOf(score: Score, posKey: string): boolean {
  return !!engravingOverrideOf(score, posKey, 'restHidden')
}

/**
 * Canonical position address for a user-authored **leading space** (client #10 — see
 * docs/note-spacing-plan.md): `{measureId}:space:b{num}/{den}`. Like {@link restPositionKey} the
 * beat fraction is reduced, so `2/4` and `1/2` collapse to one key, and the `measureId` (not the
 * *number*) keeps it stable across renumbering and rebar.
 *
 * ⚠️ **No `voice` and no `staffId` segment, deliberately** — the one structural difference from
 * `restPositionKey`, and the whole design rests on it. A leading space belongs to the *column*, not
 * to a note in it: without a voice segment, one space is shared by every voice at that beat instead
 * of two that can disagree; without a staff segment, it is the system-wide column, so a grand staff
 * cannot drift apart. Both syncs fall out of the key.
 *
 * The `{measureId}:` prefix is load-bearing in the other direction too: `MeasureRedrawKey`'s
 * `overridesFor` sweeps every key carrying a measure's id into that measure's shape key, so the
 * bar redraws when the space changes with nothing extra to remember. That is exactly the trap the
 * (id-keyed) dynamic offset fell into.
 *
 * `:space:` cannot collide with `restPositionKey`'s `:s{staffId}:`/`:v{n}:` segments (a staffId is
 * a uuid, and the voice segment is `v` + digits), nor with a bare element id (which holds no `:`).
 */
export function spacingPositionKey(measureId: string, beat: Fraction): string {
  const b = fracCreate(beat.num, beat.den) // reduce defensively — 2/4 and 1/2 are one column
  return `${measureId}:space:b${b.num}/${b.den}`
}

/** The beat a {@link spacingPositionKey} addresses, or undefined if this isn't one. The inverse
 *  is written here, beside the builder, so the two can never drift — the width math and the render
 *  walk both have to enumerate a measure's spaces, and neither may re-derive the format. */
export function parseSpacingPositionKey(key: string): { measureId: string; beat: Fraction } | undefined {
  const at = key.lastIndexOf(':space:b')
  if (at < 0) return undefined
  const [num, den] = key.slice(at + ':space:b'.length).split('/')
  const n = Number(num), d = Number(den)
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return undefined
  return { measureId: key.slice(0, at), beat: fracCreate(n, d) }
}

/**
 * The authored leading space at this column address, if any (client #10). `space` is in
 * staff-spaces, signed. Key it with {@link spacingPositionKey}; absent = the engraver's spacing.
 */
export function leadingSpaceOverrideOf(score: Score, posKey: string): LeadingSpaceOverride | undefined {
  return engravingOverrideOf(score, posKey, 'leadingSpace') as LeadingSpaceOverride | undefined
}

/**
 * Every authored leading space inside one measure, in beat order — what the width math sums and
 * what the render walk shifts on. Enumerating the compartment is the price of a position key that
 * has width: unlike a rest shift, nobody can ask for these one element at a time, because a bar
 * has to know its total before it knows how wide it is.
 *
 * Sorted by beat so a caller can accumulate a running delta across columns in one pass.
 */
export function measureLeadingSpaces(score: Score, measureId: string): { beat: Fraction; space: number }[] {
  const all = score.engravingOverrides
  if (!all) return []
  const prefix = `${measureId}:space:b`
  const out: { beat: Fraction; space: number }[] = []
  for (const key of Object.keys(all)) {
    if (!key.startsWith(prefix)) continue
    const parsed = parseSpacingPositionKey(key)
    if (!parsed || parsed.measureId !== measureId) continue
    const space = leadingSpaceOverrideOf(score, key)?.space
    if (space === undefined || space === 0) continue
    out.push({ beat: parsed.beat, space })
  }
  return out.sort((a, b) => a.beat.num * b.beat.den - b.beat.num * a.beat.den)
}

/**
 * A measure's total authored space in **pixels** — the number the width math adds to the bar and
 * the render subtracts from the format width, so both sides are derived here and cannot disagree.
 *
 * Converted at the layout's own default staff-space, not against a live stave: this is asked
 * during casting-off, before any stave exists. Same convention as the slur migration below.
 */
export function measureUserSpacePx(score: Score, measureId: string): number {
  let total = 0
  for (const { space } of measureLeadingSpaces(score, measureId)) total += space
  return total * VEXFLOW_DEFAULT_STAFF_SPACE_PX
}

/**
 * The compartment key for a bar's authored **stretch** (client #11 — see docs/bar-width-plan.md):
 * `{measureId}:barwidth`. Id-keyed, not position-keyed: a bar width names the bar itself, so a
 * rebar (which keeps measure ids) carries it forward with no capture/restore — unlike
 * {@link spacingPositionKey}, whose key names *columns* that a meter change moves.
 *
 * The `{measureId}:` prefix is load-bearing for the same reason as the spacing key's:
 * `MeasureRedrawKey.overridesFor` sweeps every key carrying a measure's id into that measure's
 * shape key, so the bar redraws when its stretch changes with nothing extra to remember. (The bar
 * would redraw anyway — its width is in the key — but its *neighbours* change width too, and the
 * same term covers them.)
 *
 * `:barwidth` cannot collide with `spacingPositionKey`'s `:space:` or `restPositionKey`'s
 * `:s{uuid}:` / `:v{n}:` segments.
 */
export function barWidthKey(measureId: string): string {
  return `${measureId}:barwidth`
}

/**
 * The absolute bounds a stored stretch is clamped to at the write site. The *measured* floor a
 * drag supplies (how much room the bar's music is actually using) is the limit that matters in the
 * gesture — but P0 is exercised by hand-editing the override into the Score JSON panel, and
 * `distributeLineWidths` deliberately leaves negative totals uncapped ("handing width back to the
 * music is always affordable"), so a hand-authored `0` or `-1` would walk straight into a
 * negative-width bar. A write-site clamp, not a repair pass (report-never-repair).
 *
 * ⚠️ **The MAX is a sanity backstop against absurd JSON, NOT the gesture's ceiling.** It started at
 * 8, chosen for symmetry with the floor and derived from nothing — and 8× the note space is not a
 * line: a sparse bar (a whole note, ~40px of note space) topped out around a third of the way
 * across, so "make this bar fill the whole system" was unreachable. Reported from use. The ceiling
 * a gesture actually stops at is derived per bar instead — the stretch at which the bar's width
 * reaches the full line, past which there is nothing left to see (a bar wider than a line is put
 * alone on one and justified back to exactly the line width). See `MusicEngine.barWidthRoom`.
 */
export const BAR_STRETCH_MIN = 0.25
export const BAR_STRETCH_MAX = 100

/** The bar's authored stretch override, if any (client #11). Absent = the engraver's own width. */
export function barWidthOverrideOf(score: Score, measureId: string): BarWidthOverride | undefined {
  return engravingOverrideOf(score, barWidthKey(measureId), 'barWidth') as BarWidthOverride | undefined
}

/**
 * The bar's stretch multiplier as the width math will honour it: **1** when nobody has touched
 * it, and bounded by `[BAR_STRETCH_MIN, BAR_STRETCH_MAX]`.
 *
 * ⚠️ **The bounds are applied here as well as at the write site, and the second copy is not
 * belt-and-braces.** `ScoreModel.setBarWidth` guards the API, but a score arriving through
 * `loadJSON` (Import, or the P0 hand-edit) never passes through it — a typed `"stretch": 0` would
 * otherwise reach `noteSpace × (stretch − 1)` intact and drive the bar's justified width negative,
 * because `distributeLineWidths` deliberately leaves negative authored totals uncapped.
 *
 * This bounds what the layout *honours*; it does not rewrite the score (`barWidthOverrideOf` still
 * reports the stored value verbatim). Resolve-at-read, like {@link resolveStaffSpacingAbove} —
 * not a repair pass.
 */
export function measureStretch(score: Score, measureId: string): number {
  const stored = barWidthOverrideOf(score, measureId)?.stretch
  if (stored === undefined || !Number.isFinite(stored)) return 1
  return Math.min(BAR_STRETCH_MAX, Math.max(BAR_STRETCH_MIN, stored))
}

/**
 * The compartment key for a meter change's cautionary (client #8). Keyed by the id of the measure
 * the change STARTS at — not the measure the courtesy glyph would be drawn on, which is whichever
 * bar happens to end the previous system and moves every time the music reflows.
 *
 * Distinct prefix so it can never collide with a rest's position key or a bare element id.
 */
export function cautionaryKey(measureId: string): string {
  return `caution:${measureId}`
}

/**
 * Does the meter change at this measure allow a courtesy time signature? Payloadless, so presence
 * alone is the answer — and it is only half the rule: the change must also open a system for one to
 * be drawn at all (see MeasureLayout).
 */
export function cautionaryAllowedOf(score: Score, measureId: string): boolean {
  return !!engravingOverrideOf(score, cautionaryKey(measureId), 'cautionary')
}

/**
 * The compartment key for a clef change's cautionary (client #9). Per STAFF as well as per measure,
 * because a clef belongs to one staff — unlike a meter, which is score-wide.
 *
 * Resolve a staff INDEX to what the key should carry with {@link keyStaffId} — it is the one place
 * this rule is written, after three hand-rolled copies of it disagreed.
 *
 * ⚠️ **Absent `staffId` IS the first staff** — the convention `restPositionKey` uses and that
 * `MusicEngine.staffIdForIndex` enforces (index 0 returns undefined). Passing the first staff's real
 * id instead produces a DIFFERENT key for the same staff, and the two sides then never meet: the
 * write lands under `cautionClef:m3` and the read asks for `cautionClef:m3:sstaff-1`, silently.
 * Every caller must resolve its staff through `staffIdForIndex`, or reproduce that rule exactly.
 */
export function keyStaffId(index: number, staffId: string | undefined): string | undefined {
  return index === 0 ? undefined : staffId
}

export function cautionaryClefKey(measureId: string, staffId?: string): string {
  return `cautionClef:${measureId}${staffId ? `:s${staffId}` : ''}`
}

/**
 * Does the clef change at this measure/staff allow a courtesy clef? Payloadless, so presence alone
 * is the answer — and half the rule, as with the meter's: the change must also open a system.
 */
export function cautionaryClefAllowedOf(score: Score, measureId: string, staffId?: string): boolean {
  return !!engravingOverrideOf(score, cautionaryClefKey(measureId, staffId), 'cautionaryClef')
}

/**
 * The extra vertical space above this staff, if any (client #7 — see
 * docs/staff-spacing-plan.md). `above` is in **staff-spaces**, signed (+ pushes the staff
 * and everything below it in its system down). Keyed by the durable `staffId` (id-keyed,
 * the usual case — unlike the position-keyed rest clients). Absent = default spacing.
 */
export function staffSpacingOverrideOf(score: Score, staffId: string): StaffSpacingOverride | undefined {
  return engravingOverrideOf(score, staffId, 'staffSpacing') as StaffSpacingOverride | undefined
}

/**
 * The dynamic's hand-nudged position offset, if any (client #8 — see
 * docs/dynamic-offset-plan.md). `{x,y}` is in **staff-spaces**, anchor-relative; the renderer
 * converts to pixels and adds it to the mark's auto placement. Element-id-keyed (dynamics have
 * durable ids), so it reads straight through — no reconcile rule. Absent = no offset.
 */
export function dynamicOffsetOverrideOf(score: Score, dynamicId: string): DynamicOffsetOverride | undefined {
  return engravingOverrideOf(score, dynamicId, 'dynamicOffset') as DynamicOffsetOverride | undefined
}

/** Convenience read: the staff's GLOBAL extra space-above in staff-spaces, 0 when absent —
 *  the per-staff default applied on every system, and the fallback under a per-system override
 *  ({@link resolveStaffSpacingAbove}). */
export function staffSpacingAbove(score: Score, staffId: string): number {
  return staffSpacingOverrideOf(score, staffId)?.above ?? 0
}

/**
 * Composite key for a PER-SYSTEM staff-spacing override (Client #7, plan option C): the staff's
 * durable id joined to the durable id of the measure that OPENS the target system. The tweak is
 * resolved at render time against whichever system a measure currently opens; an entry whose
 * anchor measure no longer opens a system is simply never looked up (self-healing, so no stored
 * layout index — Design Principle 3). The `@` separator can't collide with a bare uuid key or a
 * rest position key (which uses `:`/`/`). Pure & exported for unit testing.
 */
export function staffSystemSpacingKey(staffId: string, openingMeasureId: string): string {
  return `${staffId}@${openingMeasureId}`
}

/** The per-system space-above (staff-spaces) for a staff on the system opened by
 *  `openingMeasureId`, or undefined when this system carries no per-system override. Stored as a
 *  {@link StaffSpacingOverride} under {@link staffSystemSpacingKey}. */
export function perSystemStaffSpacingOf(score: Score, staffId: string, openingMeasureId: string): number | undefined {
  return (engravingOverrideOf(score, staffSystemSpacingKey(staffId, openingMeasureId), 'staffSpacing') as StaffSpacingOverride | undefined)?.above
}

/**
 * Resolve the effective space-above for a staff on the system opened by `openingMeasureId`
 * (plan option C, per-system by default with the global value as fallback):
 *  - a per-system override on THIS system → use it;
 *  - else the global-per-staff value ({@link staffSpacingAbove});
 *  - else 0.
 * `openingMeasureId` undefined (system not resolvable) → global/0, never a per-system entry.
 * Pure — the render seam calls it once per (staff, system) each frame.
 */
export function resolveStaffSpacingAbove(score: Score, staffId: string, openingMeasureId: string | undefined): number {
  if (openingMeasureId !== undefined) {
    const ps = perSystemStaffSpacingOf(score, staffId, openingMeasureId)
    if (ps !== undefined) return ps
  }
  return staffSpacingAbove(score, staffId)
}

/**
 * The line spacing (px) a VexFlow `Stave` uses by default — `getSpacingBetweenLines()`
 * returns this unless a stave is explicitly built with a different `spacingBetweenLinesPx`,
 * which this editor never does (zoom is a CSS transform on a layer above the rendered
 * surface, not a stave-spacing change). The old `Slur.cps` was therefore authored in pixels
 * at exactly this spacing, so it is the correct divisor when migrating that legacy data
 * forward to staff-spaces (no live stave is in hand at JSON-load time).
 */
export const VEXFLOW_DEFAULT_STAFF_SPACE_PX = 10

/** A pre-Phase-1 slur that may still carry a pixel-space `cps` shape inline. */
type LegacySlur = Score['slurs'] extends (infer S)[] | undefined
  ? S & { cps?: CurveControlPointDeltas }
  : never

/**
 * One-time forward migration of the pre-Phase-1 `Slur.cps` (pixel-space, stored inline on
 * the slur) into the engraving-overrides compartment as a {@link CurveShapeOverride} in
 * staff-spaces. Runs at JSON load (see {@link ScoreModel.fromJSON}); a no-op for scores
 * already in the new format. Mutates `score` in place.
 */
export function migrateLegacySlurCps(score: Score): void {
  for (const slur of (score.slurs ?? []) as LegacySlur[]) {
    if (!slur.cps) continue
    const cps = slur.cps
    const ss: CurveControlPointDeltas = [
      { x: cps[0].x / VEXFLOW_DEFAULT_STAFF_SPACE_PX, y: cps[0].y / VEXFLOW_DEFAULT_STAFF_SPACE_PX },
      { x: cps[1].x / VEXFLOW_DEFAULT_STAFF_SPACE_PX, y: cps[1].y / VEXFLOW_DEFAULT_STAFF_SPACE_PX },
    ]
    if (!score.engravingOverrides) score.engravingOverrides = {}
    // Don't clobber a new-format override if both somehow coexist — new wins.
    const list = score.engravingOverrides[slur.id] ?? (score.engravingOverrides[slur.id] = [])
    const override: CurveShapeOverride = { kind: 'curveShape', cps: ss }
    if (!list.some(o => o.kind === 'curveShape')) list.push(override)
    delete slur.cps
  }
}
