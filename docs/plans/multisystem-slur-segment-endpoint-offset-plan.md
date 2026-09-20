# Multi-system slur — segment-endpoint offset (nudge) plan

## Goal

A cross-system slur is drawn as `BEGIN + k×MIDDLE + END` open-ended segments
(`SlurRenderer.ts:380-466`). Today only the two **true** endpoints — the start
note (`begin.p0`) and the end note (`end.p1`) — carry handles and can be nudged
(the blue squares + `endpointOffset` override, see
`slur-endpoint-offset-plan.md`). Every **open join point** where the slur leaves
one system and resumes on the next is computed purely from the system margins +
a constant rise, with no handle and no override:

| Point | Segment | Where it sits today |
|-------|---------|---------------------|
| `begin.p1` | BEGIN | start system's RIGHT margin, `startY + ARC·dir` |
| `end.p0`   | END   | last system's LEFT margin, `endY + ARC·dir` |
| `middle.p0` | MIDDLE | that system's LEFT margin, staff baseline |
| `middle.p1` | MIDDLE | that system's RIGHT margin, staff baseline |

This makes the height at which a slur exits/enters each line uneditable — an
important engraving control. This feature gives **every open join point its own
handle and a free x/y offset**, using the *same interaction as the blue squares*
(click to arm, arrow keys to nudge) and the *same reset rule as the segment
angle handles* (`segmentCurveShape`).

## Settled decisions

- **Interaction = identical to the blue in/out squares.** Click an open-join
  handle to **arm** it (its border highlights), then arrow keys nudge it: plain
  arrow = fine (`NUDGE_FINE_SS = 0.25` ss), `Ctrl`+arrow = coarse
  (`NUDGE_COARSE_SS = 1.0` ss), **all four directions**, **one undo step per
  press**. These points have no note to re-anchor onto, so — unlike the blue
  squares — there is **no drag/re-anchor behavior**; a click only arms.
- **Handle look = orange squares.** `#F59E0B` fill (the angle-handle color) in a
  **square** shape. Color says "same family as the segment-angle edits, resets
  with them"; square says "this is a position handle, not a curve bend." Visually
  distinct from the **blue** re-anchor squares (`#2563EB`) and the **orange round**
  angle dots (same color, different shape). These appear **only on cross-system
  slurs** (a same-line slur has no open joins).
- **Reset rule = identical to the segment angles.** Stored against a `spanCount`
  signature; `reconcileSegmentEndpointOffset` applies the same staleness rule as
  `reconcileSegmentShape`:
  - **`begin` / `end` open-end offsets are durable** — the start system's right
    margin and the end system's left margin are stable references that survive a
    same-/different-count reflow.
  - **`middle` open-end offsets reset when the span count changes** — which system
    is "middle #1" is a layout artifact, meaningless once the count differs. A pure
    line shift (content pushed above, count unchanged) does **not** reset them.
- **Geometry stays out of the content model.** Stored in
  `score.engravingOverrides[slurId]` as a NEW `kind`, staff-spaces,
  margin-relative. The `Slur` interface gains nothing. The only new content-side
  field is the ephemeral UI arming (`selectedSlurSegmentEndpoint` in
  `EditorState`), which is not score data.
- **Kept SEPARATE from the durable `endpointOffset`.** That kind holds the two
  note-anchored true-end nudges (durable, no spanCount). The new kind holds the
  margin-anchored open-join nudges (spanCount-sensitive). This mirrors the
  existing split of `curveShape` (single arc) vs `segmentCurveShape` (per
  segment): one durable, one layout-ephemeral.

## Data model

### New override kind (`src/types/music.ts`)

Structurally parallel to `SegmentCurveShapeOverride`. BEGIN has only a right open
end, END only a left; a MIDDLE has both, keyed by ordinal.

```ts
/**
 * Client #4 of the engraving-overrides compartment: free positional nudges of the
 * OPEN join points of a cross-system slur (where it leaves one system and resumes on
 * the next). Each offset is in **staff-spaces**, margin-relative — added to the
 * auto open-end position at render. Parallel to {@link SegmentCurveShapeOverride}:
 * `begin`/`end` are durable; `middles` reset on a `spanCount` change. The two TRUE
 * (note-anchored) ends use {@link SlurEndpointOffsetOverride} instead.
 */
export interface SegmentEndpointOffsetOverride extends EngravingOverride {
  kind: 'segmentEndpointOffset'
  /** System count this was authored against (`toLine − fromLine + 1`). Reset signature. */
  spanCount: number
  /** BEGIN segment's open RIGHT end. Role-keyed → durable. */
  begin?: { x: number; y: number }
  /** END segment's open LEFT end. Role-keyed → durable. */
  end?: { x: number; y: number }
  /** MIDDLE open ends by ordinal (0-based among middles): left and/or right.
   *  Dropped on a count change via `spanCount`. */
  middles?: Record<number, { left?: { x: number; y: number }; right?: { x: number; y: number } }>
}
```

### Address type (`src/types/music.ts`)

Identifies one open join for a write. BEGIN/END need no side (each has one open
end); a MIDDLE needs ordinal + side. Distinct from `SlurSegmentAddress` (shape
edits), which never carries a side.

```ts
export type SlurSegmentEndpointAddress =
  | { role: 'begin' }                                    // open RIGHT end
  | { role: 'end' }                                      // open LEFT end
  | { role: 'middle'; ordinal: number; side: 'left' | 'right' }
```

### Reader + reconcile (`src/engine/models/engravingOverrides.ts`)

Mirrors `segmentCurveShapeOverrideOf` + `reconcileSegmentShape`.

```ts
export function segmentEndpointOffsetOverrideOf(score, id):
  SegmentEndpointOffsetOverride | undefined

export interface ResolvedSegmentEndpointOffsets {
  begin?: { x: number; y: number }
  end?: { x: number; y: number }
  middles: Record<number, { left?: {x,y}; right?: {x,y} }>  // {} when stale/absent
}

/** Same staleness rule as reconcileSegmentShape: begin/end always applied;
 *  middles applied only when override.spanCount === liveSpanCount. */
export function reconcileSegmentEndpointOffset(
  override: SegmentEndpointOffsetOverride | undefined,
  liveSpanCount: number,
): ResolvedSegmentEndpointOffsets
```

### Mutator (`src/engine/models/ScoreModel.ts`)

Mirrors `setSlurSegmentShape` (accumulating like `setSlurEndpointOffset`). Same
count-change-drop-middles handling on write so a stale middle can't resurrect at
the wrong geometry.

```ts
/**
 * Nudge one OPEN join of a cross-system slur by a staff-space delta, ACCUMULATING.
 * Stored as a SegmentEndpointOffsetOverride. `spanCount` is the live system count
 * (the reset signature). On a count change, MIDDLE offsets are dropped (begin/end
 * kept) before adopting the new count. @returns true if the slur exists.
 */
setSlurSegmentEndpointOffset(
  id: string,
  address: SlurSegmentEndpointAddress,
  dx: number, dy: number,
  spanCount: number,
): boolean
```

Read prev override; `keepMiddles = prev?.spanCount === spanCount`; rebuild fresh
(keep begin/end always, keep middles only when count unchanged); add (dx,dy) onto
the addressed slot's prior {x,y}; upsert, or `clearEngravingOverride(id,
'segmentEndpointOffset')` if nothing remains.

### `setSlurEndpoint` change (`ScoreModel.ts:474-479`)

Re-anchor already clears `curveShape` + `segmentCurveShape`. **Add
`clearEngravingOverride(id, 'segmentEndpointOffset')`** to that list — re-anchoring
can change the span and the open joins are margin-bound, so wipe them with the
segment shapes (the durable `endpointOffset` still survives re-anchor as before).

### Deletion — already free

`removeSlur` → `clearEngravingOverride(id)` (all kinds) and the `reanchorSlurs`
drop paths clear all kinds, so the new override dies with the slur for free.

### Engine (`src/engine/MusicEngine.ts`)

```ts
/** Nudge a slur OPEN join by a staff-space delta and save ONE undo step. */
nudgeSlurSegmentEndpoint(id, address, dx, dy, spanCount): boolean {
  const ok = this.scoreModel.setSlurSegmentEndpointOffset(id, address, dx, dy, spanCount)
  if (ok) this.saveOnly('Nudge slur segment endpoint')
  return ok
}
```

## Render: applying the offset (`SlurRenderer.ts`)

Each cross-system segment already has its live `stave` and computes its open
end's `p`. Read `reconcileSegmentEndpointOffset(segmentEndpointOffsetOverrideOf(
score, slur.id), spanCount)` once (next to the existing `segShape =
reconcileSegmentShape(...)` at line 422), then for each segment add the resolved
offset to its OPEN end **before** `resolveCps`, so the arch follows the moved
point (exactly how the true-end offset is applied at lines 353-357):

- **BEGIN**: `p1.x += off.begin.x; p1.y += off.begin.y` (p0 is the true end —
  untouched here, it already carries `endpointOffset`).
- **END**: `p0.x += off.end.x; p0.y += off.end.y` (p1 is the true end).
- **MIDDLE[ordinal]**: `p0 += off.middles[ordinal]?.left`; `p1 += off.middles[ordinal]?.right`.

Convert staff-spaces → px against that segment's own stave via
`staffSpacesToPixels`, guarding an undefined/not-laid-out stave as 0 (mirror the
`slurEndpointOffsetPx` guard so no throw). A small helper
`segmentEndpointOffsetPx(resolved, role, ordinal, stave)` keeps the conversion in
one place. Because `slurTrueEndpoints` is unaffected and the open ends feed
`segmentEndpoints` (which carry the round handles + the new orange squares), the
moved point and its handle track together for free.

## Handles (`HighlightController.applySlurHandles`)

The function already loops every partial and has `segmentEndpoints {p0,p1}`,
`segmentRole`, `segmentOrdinal`, `slurSpanCount` on each. Add an orange-square
pass: for each partial, draw a square at each **open** end (and register a
`slur-segment-endpoint` hit target carrying its address + spanCount):

- `segmentRole === 'begin'` → open end is `p1` (address `{role:'begin'}`).
- `segmentRole === 'end'` → open end is `p0` (address `{role:'end'}`).
- `segmentRole === 'middle'` → both: `p0` is `{role:'middle',ordinal,side:'left'}`,
  `p1` is `{role:'middle',ordinal,side:'right'}`.
- no `segmentRole` (same-line single arc) → no orange squares.

Fill `#F59E0B`, white stroke, square (reuse the blue-square half-side `S`). When
the armed point matches (`selectedSlurSegmentEndpoint`), draw it larger + thicker
ring (mirror the blue `--selected` branch). Hit-box = registry bbox (`HIT`
radius), unchanged by the cosmetic select state. The blue true-end squares are
unchanged.

### Registry (`ElementRegistry` / `ElementInfo`)

New element type `'slur-segment-endpoint'` with: `slurId`, the address
(`segmentRole` + `segmentOrdinal` already exist; add `segmentSide?: 'left'|'right'`),
`slurSpanCount`, `bbox`. No `slurEndpoints`/`controlPoints` (not draggable, not a
shape handle).

## Selection / arming

### State (`EditorState.ts`)

Add, alongside `selectedSlurEndpoint`:

```ts
selectedSlurSegmentEndpoint:
  | { role: 'begin' | 'end' }
  | { role: 'middle'; ordinal: number; side: 'left' | 'right' }
  | null            // default null
  // plus the spanCount captured at arm time, stored beside it (or folded in)
```

Store the captured `spanCount` next to it (e.g. a sibling field
`selectedSlurSegmentSpanCount`) so the arrow handler can pass the same count the
handle was registered with — matching how the shape-edit drag captures spanCount
at mousedown.

**Reset discipline (the correctness watch-item).** A stale arming would nudge the
wrong join. The two arming fields are mutually exclusive and BOTH must clear at
every selection change. Concretely, at each site that today nulls
`selectedSlurEndpoint` (arc-select `MouseController.ts:732`, deselect `:406`,
shortcut clear `useShortcuts.ts:135`, round-handle grab `:544`) **also null
`selectedSlurSegmentEndpoint`**. And the two arming actions disarm each other:
clicking an orange square nulls `selectedSlurEndpoint`; clicking a blue square
nulls `selectedSlurSegmentEndpoint`.

### Click to arm (`MouseController.handleSlurHandleMouseDown`)

Add a branch (before the arc-select fallthrough) for a `slur-segment-endpoint`
registry hit on the selected slur: set `state.selectedSlurSegmentEndpoint` =
the handle's address, stash `spanCount`, null `selectedSlurEndpoint`, re-render,
`preventDefault`, return true. **No drag machinery** — these don't re-anchor, so a
grab only arms (a release without movement leaves it armed; movement does
nothing).

## Keyboard nudge (`useShortcuts.ts`)

A second armed-target helper beside `nudgeArmedEndpoint`:

```ts
const nudgeArmedSegmentEndpoint = (dx, dy): boolean => {
  if (!eng || !state.selectedSlurId || !state.selectedSlurSegmentEndpoint) return false
  eng.nudgeSlurSegmentEndpoint(
    state.selectedSlurId, state.selectedSlurSegmentEndpoint, dx, dy,
    state.selectedSlurSegmentSpanCount,
  )
  renderer.renderScore()
  return true
}
```

Each arrow handler tries true-end first, then segment-end, then the default
action — e.g.:

```ts
pitchUp:   () => { if (!nudgeArmedEndpoint(0,-FINE) && !nudgeArmedSegmentEndpoint(0,-FINE)) selection.adjustPitch(1) }
moveLeft:  () => { if (nudgeArmedEndpoint(-FINE,0) || nudgeArmedSegmentEndpoint(-FINE,0)) return; /* nav */ }
```

The coarse `Ctrl+←/→` actions reuse the existing **decline** mechanism: their
handler returns `false` (so `ShortcutManager` doesn't `preventDefault`) unless an
endpoint OR segment-endpoint is armed. `Ctrl+↑/↓` (octave) gates inside its
handler like pitch. Net: the arrows behave exactly as today whenever no orange
square is armed.

| Key | When an orange square is armed |
|-----|-------------------------------|
| `↑` / `↓` | fine y −/+ |
| `←` / `→` | fine x −/+ |
| `Ctrl+↑` / `Ctrl+↓` | coarse y |
| `Ctrl+←` / `Ctrl+→` | coarse x |

## Auto-reset summary

| Event | segmentEndpointOffset |
|-------|-----------------------|
| Slur deleted | cleared (all kinds) |
| Span count changes (reflow) | begin/end kept, **middles dropped** (read-time reconcile; write-time on next edit) |
| Same-count reflow / line shift | kept (begin/end + middles) |
| Endpoint re-anchored (`setSlurEndpoint`) | cleared (with curveShape/segmentCurveShape) |
| `reanchorSlurs` drop | cleared (all) |

## Tests

- **engravingOverrides**: `segmentEndpointOffsetOverrideOf` read;
  `reconcileSegmentEndpointOffset` keeps begin/end + drops middles on count
  mismatch, keeps all on match.
- **ScoreModel**: `setSlurSegmentEndpointOffset` accumulates; upsert vs create;
  count-change drops middles, keeps begin/end; clears override when empty;
  `setSlurEndpoint` now also clears `segmentEndpointOffset`.
- **SlurRenderer**: a `begin`/`end`/`middle` offset shifts that segment's open
  end (and thus its registered `segmentEndpoints`) for a cross-system slur;
  composes with a `segmentCurveShape` bend; same-line slur draws no orange squares.
- **HighlightController**: orange square at each open end with the right address;
  armed square gets the highlighted border; same-line slur → none.
- **MusicEngine**: `nudgeSlurSegmentEndpoint` saves exactly one undo step.

## Phases

- **P0 — data + render (no UI):** type + address + reader/reconcile +
  `setSlurSegmentEndpointOffset` + `nudgeSlurSegmentEndpoint` + `setSlurEndpoint`
  clear + SlurRenderer offset application + tests. Renders correctly if an offset
  is hand-injected; nothing reachable from UI.
- **P1 — handles + arming:** orange squares in `applySlurHandles` +
  `slur-segment-endpoint` registry type + `selectedSlurSegmentEndpoint` state +
  click-to-arm in MouseController + reset discipline (all choke points).
- **P2 — keyboard nudge:** `nudgeArmedSegmentEndpoint` + modal routing of all
  arrow combos (true-end → segment-end → default) + coarse decline. Feature live.
- **P3 (deferred):** a "reset open joins to default" command (clear the kind);
  optional drag of the orange squares if click+arrows proves fiddly.
