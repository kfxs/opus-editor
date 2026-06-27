# Slur endpoint offset (keyboard nudge) plan

## Goal

Let the composer **fine-tune where a slur's in/out point sits** — a free x/y
offset of each endpoint, on top of (not instead of) the existing re-anchor.

When a slur is selected the two blue **endpoint squares** already show (today they
only *re-anchor* the slur onto another note when dragged). This feature adds:

1. **Click a blue square → it becomes the selected point** (its border highlights).
2. **Arrow keys nudge that point's x/y** — fine step on a plain arrow, coarse step
   on `Ctrl`+arrow (Sibelius-style fine/coarse pair; concrete amounts in the constants
   below).
3. The offset is a **persistent, anchor-relative** adjustment stored in the
   engraving-overrides compartment (staff-spaces — never pixels in the model).
4. Works identically for **same-line** and **cross-system** slurs (both endpoints
   are always note-anchored).

Out of scope for this pass: a "reset to default position" command (trivial later —
clear the `endpointOffset` kind); arrow-nudging the amber **curve-shape** dots.

## Settled decisions

- **Blue squares only.** The amber curve-bend dots stay drag-only for now.
- **Both behaviors coexist on the same selected slur.** Dragging a square
  re-anchors; clicking + arrows nudges. One does not disable the other.
- **Re-anchor does NOT clear the endpoint offset.** The offset is stored
  *anchor-relative* (dx/dy from the anchor note), so it stays meaningful after a
  re-anchor — the point carries the same relative nudge onto the new note. This is a
  deliberate exception to the §3.3 auto-reset: `setSlurEndpoint` keeps clearing the
  span-relative `curveShape`/`segmentCurveShape` (those were authored against the old
  geometry) but **leaves `endpointOffset` intact**.
- **Step sizes:** plain arrow = fine `NUDGE_FINE_SS = 0.25` staff-space (≈2.5 px at the
  default 10 px/space), `Ctrl`+arrow = coarse `NUDGE_COARSE_SS = 1.0` staff-space (≈10 px).
  A whole staff-space is a usable coarse step and 0.25 is fine without being so small it
  takes a dozen presses to see movement (the earlier 0.1/0.5 draft was too fine — and its
  prose said "1 space / 5 spaces", a 10× contradiction with the px figures; this supersedes
  both). Nudge is accumulated in **staff-spaces** so no live stave is needed in the
  controller.
- **Undo = one step per press** (mirrors `selection.adjustPitch`).
- **Geometry stays out of the content model.** The offset lives in
  `score.engravingOverrides[slurId]` as a new `kind`, staff-spaces, anchor-relative.
  The `Slur` / `Note` interfaces gain nothing. The only new content-side field is the
  ephemeral UI selection (`selectedSlurEndpoint` in `EditorState`), which is not score
  data.

## Data model

### New override kind (`src/types/music.ts`)

```ts
/**
 * Client #3 of the engraving-overrides compartment: a free positional nudge of a
 * slur's in/out endpoint(s), on top of its note anchor. Each offset is in
 * **staff-spaces**, anchor-relative (added to the auto endpoint position at render).
 * Durable — both ends are note-anchored on same-line AND cross-system slurs, so there
 * is no spanCount staleness. Survives re-anchoring (the relative nudge rides onto the
 * new anchor); cleared only when the slur is deleted.
 */
export interface SlurEndpointOffsetOverride extends EngravingOverride {
  kind: 'endpointOffset'
  /** Start (in) point offset in staff-spaces, relative to the start anchor. */
  start?: { x: number; y: number }
  /** End (out) point offset in staff-spaces, relative to the end anchor. */
  end?: { x: number; y: number }
}
```

### Reader (`src/engine/models/engravingOverrides.ts`)

```ts
export function endpointOffsetOverrideOf(
  score: Score, elementId: string,
): SlurEndpointOffsetOverride | undefined {
  return engravingOverrideOf(score, elementId, 'endpointOffset') as
    SlurEndpointOffsetOverride | undefined
}
```

No reconcile rule needed (durable, both ends note-anchored) — unlike
`reconcileSegmentShape`, this reads straight through.

### Mutators (`src/engine/models/ScoreModel.ts`)

```ts
/**
 * Nudge one endpoint of a slur by a staff-space delta, ACCUMULATING onto any existing
 * offset. Stored as a SlurEndpointOffsetOverride (anchor-relative). Pass dx/dy in
 * staff-spaces. @returns true if the slur exists.
 */
setSlurEndpointOffset(id, which: 'start' | 'end', dx, dy): boolean
```

Reads the current `endpointOffset` override (or {}), adds the delta to the
`start`/`end` field, upserts via `setEngravingOverride`. (A future "reset" simply
calls `clearEngravingOverride(id, 'endpointOffset')`.)

**`setSlurEndpoint` change:** it currently clears `curveShape` + `segmentCurveShape`.
Leave that untouched — do **not** add `endpointOffset` to that clear list (decision
above). Add a one-line code comment stating the offset deliberately survives re-anchor.

**Deletion already handled:** slur delete (`ScoreModel.removeSlur` →
`clearEngravingOverride(id)` with no kind) and the `reanchorSlurs` drop paths clear
*all* kinds, so the offset dies with the slur for free.

### Engine (`src/engine/MusicEngine.ts`)

```ts
/** Nudge a slur endpoint by a staff-space delta and save ONE undo step. */
nudgeSlurEndpoint(id, which, dx, dy): boolean {
  const ok = this.scoreModel.setSlurEndpointOffset(id, which, dx, dy)
  if (ok) this.saveOnly('Nudge slur endpoint')
  return ok
}
```

One press = one `saveOnly` (undo per press, decision above). No preview/commit split
is needed — unlike a mouse drag, each arrow press is already a discrete commit.

## Render: applying the offset (`src/engine/rendering/SlurRenderer.ts`)

The endpoint pixel positions all derive from the anchor note:
`firstX = fromNote.getTieRightX()`, `lastX = toNote.getTieLeftX()`, and
`fromY`/`toY` from `slurEndpointY(...)`. Apply the offset once, before the
single-vs-cross branch, so every downstream consumer (the arc, the auto-arch cps via
`resolveCps`, `slurTrueEndpoints`, and therefore the blue squares) flows from the
shifted values automatically:

1. Read `endpointOffsetOverrideOf(score, slur.id)`.
2. Convert each end's `{x,y}` staff-spaces → px against that end's own stave
   (`fromNote.getStave()` / `toNote.getStave()`) using `staffSpacesToPixels`.
   **Guard the undefined stave:** `staffSpacesToPixels` calls
   `stave.getSpacingBetweenLines()` and throws on `undefined`, so when a note's stave is
   not yet laid out treat that end's offset as 0 (or fall back to
   `VEXFLOW_DEFAULT_STAFF_SPACE_PX`). The existing same-line code dodges this only because
   it passes the stave straight into `resolveCps`, which already tolerates `undefined`;
   this new pre-branch conversion does not, so it needs its own guard.
3. Lift `firstX`/`lastX` out of the two branches (they are identical in both today) and
   apply the offset. **Placement note:** both depend on `fromNote`/`toNote`, which are not
   aliased until `SlurRenderer.ts:317-318` (inside the `try`), so do the lift+offset just
   after those aliases (line ~318) — not at the `fromY`/`toY` site on line 299, where the
   notes aren't in hand yet (or use `fromInfo.staveNote` / `toInfo.staveNote` directly).
   Then: `firstX += offStartX; fromY += offStartY; lastX += offEndX; toY += offEndY`.

That is the entire render change. Because the auto arch recomputes from the moved
`p0`/`p1`, "move the point, the curve follows" is free, and the squares (drawn from
`slurTrueEndpoints`) land on the nudged point so the handle tracks it.

`endpointOffset` and `curveShape`/`segmentCurveShape` **compose**: the offset moves
the anchors; the cps are deltas on the spacing-based base derived from those anchors,
so a manual bend rides along on top of a nudged endpoint.

## Selection of a point

### State (`src/interactions/EditorState.ts`)

Add `selectedSlurEndpoint: 'start' | 'end' | null` (default null; only meaningful
while `selectedSlurId` is set).

**Reset discipline (the main correctness watch-item).** A stale endpoint selection
would silently nudge the wrong slur — e.g. it stays `'start'` from a previous slur, you
select a *different* slur by clicking its arc (`MouseController.ts:716`) without touching
a square, and the next arrow press moves the new slur's start. The robust rule is a
single choke point: **null `selectedSlurEndpoint` whenever `selectedSlurId` is assigned
or changed**, not only when it is cleared. Concretely:

- arc-select of a slur (`MouseController.ts:716`, where `selectedSlurId` is set) → null it;
- every site that sets `selectedSlurId = null` (e.g. `MouseController.ts:405`,
  `useShortcuts.ts:118`) → null it;
- the only thing that *sets* it non-null is the square-grab in `handleSlurHandleMouseDown`.

So "click a square" is the one and only way to arm a point, and any other selection
change disarms it.

### Click to select (`src/interactions/MouseController.ts`)

`handleSlurHandleMouseDown` already grabs a `slur-endpoint` registry hit to arm the
re-anchor drag. Extend it: on grabbing a square, **also set
`state.selectedSlurEndpoint = endHandle.endpoint`** and re-render so the border
highlights immediately. The existing arm-on-down / decide-on-move flow is unchanged —
a release without movement leaves the point selected (click = select); a drag
re-anchors (and the point stays selected afterward, so you can fine-tune with arrows).

### Highlight border (`src/interactions/HighlightController.ts`)

In `applySlurHandles`, when drawing each square, if `which === selectedSlurEndpoint`
(and the slur is selected) draw it with a distinct **selected** border — thicker /
darker stroke (e.g. stroke `#1D4ED8`, `stroke-width` 2.5, slightly larger half-side)
versus the normal square. Pure cosmetic branch; no registry change.

## Keyboard nudge — interference-safe routing

### The constraint

`ShortcutManager.handleKeyDown` only `preventDefault()`s a combo that is **both**
configured **and** has a registered handler; everything else falls through untouched.
Arrow combos split into:

- **Already bound** — plain `↑↓` (pitch), plain `←→` (nav), `Ctrl+↑↓` (octave).
  These already consume the key. Add a modal check *inside* each existing handler in
  `useShortcuts.ts`: if `selectedSlurId && selectedSlurEndpoint` → nudge, else do the
  normal thing. Zero new interference (behavior outside nudge mode is unchanged).
- **Not bound** — `Ctrl+←→` (coarse horizontal). Adding them naively would make
  `ShortcutManager` `preventDefault` them **globally**, stealing them from any future
  `Ctrl`+arrow feature even when no point is selected.

### The fix: a handler can *decline*

Make `ActionHandler` able to return `boolean | void`; reorder `handleKeyDown` to call
the handler first and `preventDefault()` **unless it returned `false`**
(`void`/`undefined` = handled = preventDefault, identical to today → backward
compatible). Then bind `Ctrl+ArrowLeft`/`Ctrl+ArrowRight` to a new
`nudgeSlurEndpointCoarseX`-style action whose handler returns `false` when no endpoint
is selected — so those keys stay completely free for the rest of the system and are
claimed **only** while a blue square is selected.

Net: nudge mode owns the arrows only while a square is selected; the instant it isn't,
every arrow combo behaves exactly as today and `Ctrl+←→` remain available.

### Mapping (only active when an endpoint is selected)

| Key | Action |
|-----|--------|
| `↑` / `↓` | fine nudge y −/+ (`NUDGE_FINE_SS` = 0.25) |
| `←` / `→` | fine nudge x −/+ |
| `Ctrl+↑` / `Ctrl+↓` | coarse nudge y (`NUDGE_COARSE_SS` = 1.0) |
| `Ctrl+←` / `Ctrl+→` | coarse nudge x |

Each routes to `engine.nudgeSlurEndpoint(selectedSlurId, selectedSlurEndpoint, dx, dy)`
then `renderer.renderScore()`. Sign of y: screen-down is +y; "up arrow lifts the
point" → dy negative.

## Auto-reset summary

| Event | curveShape / segmentCurveShape | endpointOffset |
|-------|-------------------------------|----------------|
| Slur deleted | cleared (all kinds) | cleared (all kinds) |
| Endpoint re-anchored (`setSlurEndpoint`) | cleared | **kept** |
| `reanchorSlurs` drop | cleared (all) | cleared (all) |
| `reanchorSlurs` re-point | curveShape cleared | **kept** |

The only new rule: `endpointOffset` survives a re-anchor/re-point (anchor-relative),
and otherwise dies with the slur.

## Tests

- **engravingOverrides**: `endpointOffsetOverrideOf` read (present / absent).
- **ScoreModel**: `setSlurEndpointOffset` accumulates; upsert vs create; `setSlurEndpoint`
  keeps `endpointOffset` but still clears `curveShape`/`segmentCurveShape`; slur delete
  clears it.
- **SlurRenderer**: offset shifts `firstX/fromY` & `lastX/toY` (and thus the registered
  `slurEndpoints`) for same-line AND cross-system; composes with a `curveShape` override.
- **HighlightController**: selected square gets the highlighted border; unselected stays
  normal.
- **ShortcutManager**: a handler returning `false` does NOT `preventDefault`; returning
  `void` still does (regression guard for the decline mechanism).
- **MusicEngine**: `nudgeSlurEndpoint` saves exactly one undo step.

## Phases

- **P0 — data + render (no UI):** type + reader + `setSlurEndpointOffset` +
  `nudgeSlurEndpoint` + SlurRenderer offset application + tests. Renders correctly if an
  offset is hand-injected; nothing reachable from UI yet.
- **P1 — point selection:** `selectedSlurEndpoint` state + click-to-select in
  MouseController + highlighted border in HighlightController. Re-anchor coexistence
  verified.
- **P2 — keyboard nudge:** `ShortcutManager` decline mechanism + `Ctrl+←→` bindings +
  modal routing of all arrow combos in `useShortcuts`. Full feature live.
- **P3 (deferred):** "reset endpoint to default" command; extend the same selection +
  nudge machinery to the amber curve-shape dots.
