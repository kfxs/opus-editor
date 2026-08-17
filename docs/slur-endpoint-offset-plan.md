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
**Both were built on 2026-08-17 — see [P3](#p3--the-arc-dots-the-reset-and-the-typed-twin) below**,
where the "trivial later" turned out to hold for the squares and *not* for the arc.

## Settled decisions

- **Blue squares only.** The amber curve-bend dots stay drag-only for now.
- **Both behaviors coexist on the same selected slur.** Dragging a square
  re-anchors; clicking + arrows nudges. One does not disable the other.
- ~~**Re-anchor does NOT clear the endpoint offset.**~~ **REVERSED 2026-08-17 (his call):
  a re-anchor CLEARS the moved end's offset.** The original reasoning — the offset is
  stored *anchor-relative*, so it stays meaningful on the new note — proved to be about
  the wrong word: anchor-relative makes the nudge *transferable*, not *wanted*. It was
  tuned to clear the notehead, stem and accidentals of the note it sat on, and a
  re-anchor is the user saying "not that note". So `setSlurEndpoint` now clears the
  **moved** end's offset alongside `curveShape`/`segmentCurveShape` — no longer an
  exception to the §3.3 auto-reset — while the OTHER end's nudge stands, since that end
  never changed anchor. Both re-anchor gestures go through it (the drag and the
  Ctrl+Shift+←/→ walk); `reanchorSlurs` does not, since there the span is re-pointed by
  an edit elsewhere and the user never touched the end.
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
 * is no spanCount staleness. Cleared when the slur is deleted — and, per the 2026-08-17
 * revision, when its OWN end is re-anchored.
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

**`setSlurEndpoint` change:** it clears `curveShape` + `segmentCurveShape` — and, since
the 2026-08-17 reversal above, the **moved end's** `endpointOffset` too (a per-side
clear, `clearEndpointOffsetSide`, since the two ends share one override object).

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
| Endpoint re-anchored (`setSlurEndpoint`) | cleared | **the MOVED end cleared, the other kept** |
| `reanchorSlurs` drop | cleared (all) | cleared (all) |
| `reanchorSlurs` re-point | curveShape cleared | **kept** |

The rule (as revised 2026-08-17): a nudge dies with the anchor it was tuned against —
so the end the USER re-anchors loses it, the end that merely sat still keeps it, and a
re-point forced by an edit elsewhere (`reanchorSlurs`) keeps it too, since nobody asked
for that move. And all of it dies with the slur.

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
- **P3 — the arc dots, the reset, and the typed twin:** ✅ **BUILT 2026-08-17.** See the
  section below.

## P3 — the arc dots, the reset, and the typed twin

Three asks in one afternoon, each one the next thing the previous one made obvious:
*"i want to be able to change slur control arc point with the arrow key when selected"* →
*"how do i revert the editing on the slur control point?"* → *"this modification we do for
the control and endpoints of the slur we should be able to do it also in the property
window"*. The result is that every one of a slur's grabbable points now answers to all
three surfaces — mouse, keyboard, typed number — and none of them is a second copy of the
geometry.

Modules: `interactions/slurHandleNudge.ts` (+ its spec), `interactions/SlurGeometryController.ts`,
`bus/slurGeometrySelection.ts`, rows in `windows/properties/PropertiesWidget.ts`,
`slurOps.resetSlurShape` / `resetSlurEndpointOffset` / `resetSlurSegmentEndpointOffset`.

### ⭐⭐ The drawn shape is the baseline — why the arc could not reuse P2's arithmetic

An `endpointOffset` **adds** to the automatic position, so nudging it is `stored + delta`
and an absent entry is a true zero. A `curveShape` **replaces** the automatic arch
(`resolveCps`), so the same arithmetic would read an un-edited slur's shape as `(0,0)` and
the first arrow press would fling the control point down onto the chord line.

So the arc's baseline is what the last render actually **drew**: the control points the
`ElementRegistry` carries, inverted back through `renderCurve`'s math
(`cpsFromDrawnControlPoints`) — which is exactly what a drag does on mousedown. One press
reads the arc on screen, moves one control point, and writes **both** back. Consequences:

- the FIRST press freezes the auto arch (nest lift and obstacle clearance included) into an
  explicit shape, precisely as the first pixel of a drag does — one conversion, no second rule;
- LINEAR view draws no handles, so the registry holds none and every arc surface DECLINES
  there without needing to know why;
- a cross-system slur edits the segment whose dot is **armed**, because the armed dot names
  its segment and that segment's own endpoints ride on the same registry entry.

The inversion moved out of `MouseController` into the module and is imported back, so the
mouse and the arrows can never drift onto different arcs.

### ⚠️ Two coordinate spaces, deliberately

`cps.y` is **arc space** — `drawCurveArc` draws it at `p.y + cps.y · direction` — while an
endpoint offset is plain screen-down. The keyboard therefore multiplies its `dy` by
`direction` (without it, ↑ raises a slur above the staff and *lowers* one below it), and the
Properties inputs do **not**: they show the number the model holds, because the override's own
JSON is printed a few lines below the input and a control that disagreed in sign with the dump
under it would be unreadable. Keyboard speaks screen; the panel speaks model.

### The reset (`Ctrl+Backspace`)

The reset half of the nudges, on the key every other nudge in `shortcutWiring` resets with —
"one value, a matching backspace per arrow-chord". It takes back **whatever is armed**: an
amber arc dot drops the shape, a blue square that end's nudge, an orange join that join's.
Each model-side reset returns **false when nothing was authored**, which is what lets
`Ctrl+Backspace` fall through to the note-spacing / bar-width resets it shares the key with.

⚠️ **The arc returns as a whole, both dots** — the one place "the armed handle" is not exactly
what goes back. A shape override is ONE pair, and the automatic value of a single dot exists
only inside the renderer's arch law (span, slant, nest/obstacle lift), so the model cannot say
"this dot is automatic and that one is not". Invisible in the ordinary case: the untouched dot
was written at the value the arch had given it. The two square kinds have no such caveat —
their offsets are per-side in the model.

### The Properties rows

Four rows for a selected slur — `start end`, `end end`, `arc 1`, `arc 2` — each an x/y pair in
staff-spaces plus a reset, on the `NoteOffsetController` boundary: the window publishes to
`bus.slurGeometry` and never holds the engine.

- **Blank means AUTO, and blank is not zero.** `0` is a hand-authored position that happens to
  sit at the anchor; `auto` is no authorship at all. Reset returns a row to blank.
- **Each box publishes its own axis** (`{x}` or `{y}`, never a synthesised pair). A row that
  insisted on both would be unusable from `auto`: the first commit would have to invent the
  second number, and for the arc that invention is destructive. The controller fills the
  unnamed axis from the model.
- **Absolute in, relative out** for the ends (`delta = wanted − stored`, read from the
  compartment rather than from the panel, so a stale panel cannot write a wrong delta);
  the arc hands its absolute straight to `setSlurControlPoint`, which resolves the other dot
  from the drawn arc — so typing 2.5 and nudging to 2.5 land on identical model state.
- **A split slur's arc rows address the armed segment** and name it in the caption; with no dot
  armed there is no system to write to, so they are disabled rather than guessing. The end rows
  stay live — a true end belongs to the whole slur.
- `selectionSnapshot` resolves which override kind the arc numbers come from (`curveShape` vs
  the armed segment of `segmentCurveShape`) and reports it under `derived.arc`, so the window
  never has to know.

### ⏭️ Not built

- No Properties row for the **open joins** (the orange squares of a cross-system slur); the
  keyboard and its reset reach them, the panel does not.
- In LINEAR view the arc rows accept input that silently declines — no handles are drawn there,
  so there is no baseline to write against.

### Tests added

- `slurHandleNudge.test.ts` — the drawn baseline (2 → 2.25, not 0.25); the `direction` flip
  asserted as a PAIR (drop the factor and both sides read 1.75, which each half alone accepts);
  segment routing; one undo per press; the reset dispatch across all three handle kinds; every
  decline.
- `slurOps.test.ts` — `resetSlurShape` (whole vs addressed, and "false when nothing authored",
  including a stale-count MIDDLE); `resetSlurEndpointOffset` (per-side, prunes); 
  `resetSlurSegmentEndpointOffset` (per join and side, prunes the slot then the override).
- `SlurGeometryController.test.ts` — absolute → relative; an absent axis is a zero delta, never
  a move to 0; re-typing the same number leaves no undo entry; null resets; arc requests never
  touch the endpoint verbs.
- `PropertiesWidget.slur.test.ts` — the four rows; blank ≠ 0; one axis per commit; a
  non-number restores only its own box; reset publishes `null`; the disabled split-slur case.
