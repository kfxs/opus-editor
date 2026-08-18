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

---

## P4 — the INTERPOLATING WALK: one gesture for the ink and the anchor

His ask, 2026-08-18: *"first i start offseting till i get to the critical point so it makes a
reanchor… lets start just horizontal in the x axis"*. Until now moving an endpoint was two
unrelated gestures — `Ctrl+←/→` slid the ink arbitrarily far from the note it claimed to hang off,
and `Ctrl+Shift+←/→` jumped the anchor a whole note with the ink snapping to the engraver's
position. Neither could say *"this end belongs a little to the left of that note over there"* in one
continuous motion.

### The identity

A drawn endpoint is `base(anchor) + offset`, and a move may spend itself on either term:

```
  offset + step  <  gap   →  keep the anchor, offset += step        (an ordinary ink nudge)
  offset + step  ≥  gap   →  anchor := next note, offset += step − gap
```

`gap` is the horizontal distance between the two anchor NOTES. Both branches move the drawn point by
exactly one step, so **the crossing is invisible**, and the offset re-zeroes itself at every note
passed — nothing accumulates into an absurd stored number.

**⭐ ARRIVAL, not midpoint.** The anchor changes when the ink gets *to* the next note, not at the
halfway mark, so an end can be parked anywhere in a gap without changing what the slur spans — and so
what it PLAYS, since `utils/slurs.legatoChordIds` lengthens the notes a slur covers. MuseScore's line
family re-anchors at the halfway point (`spacingFactor = 0.5`, `line.cpp:434`); the research does not
settle it (Sibelius's cross-staff re-attach is contact-based, i.e. arrival).

**⚠️ The re-base is a NOTE-to-NOTE distance**, not endpoint-to-endpoint: an endpoint's base sits on the
head or past the stem depending on both ends' stems, so an exact re-base would need the new anchor's
base, which exists only after a layout. MuseScore's lines do the same thing (`line.cpp:750-754`).

**🚨 It will not cross a system break** — a `gap` whose sign disagrees with the travel is refused,
because two x's from different systems are not on one ruler. `Ctrl+Shift+←/→` is the gesture that
crosses a break. **⛔ And it never guesses the staff-space size**: no drawn handle, no crossing.

### Where it lives

- `interactions/slurEndpointWalk.ts` — the module. `carryEndpoint` is the shared arithmetic;
  `walkArmedSlurEndpoint` (keys) and `dragArmedSlurEndpoint` (mouse) differ only in an
  `EndpointWriter` — a key press commits its own undo step, a drag frame previews and the drop
  commits once.
- `slurOps.setSlurEndpointKeepingEdits` — the bare re-point with NONE of `setSlurEndpoint`'s
  auto-resets, because an invisible crossing must not drop the arc's shape or this end's nudge.
- `slurReanchor.nextSlurAnchorStop` — the candidate rule, now SHARED with the jump. Two rules would
  mean the same key landing on a different note depending on how far you had nudged first.
- ⭐⭐ `shortcutWiring`'s `Ctrl+←/→` comment was AMENDED, not worked around: that chord's standing
  rule was "every branch here writes an offset". His call — *"a shortcut is for making the live easy
  to the user"* — with the reasoning that the rule was written about two families that ate the chord
  outright and changed the music on the first press with nothing on screen to say so.

### The mouse: hold + catch-up (snap-and-go)

The drag is the same journey with a cursor instead of a step, plus three things the keyboard does not
want, and one it explicitly refused (`no hold on the keys` — his call).

- **THE LATCH.** The ink stops dead on a note's own position — both onto the next note and coming
  back to the anchor it already has (*"we should not hold just when getin a new target but also when
  reaching our current target"*). One event, named once: offset zero of the nearest note in the
  direction of travel. Whatever travel the latch cuts short is reported and repaid, never eaten.
- **THE HOLD** (`SLUR_ENDPOINT_HOLD_RATIO` = 0.8, capped by `SLUR_ENDPOINT_HOLD_MAX_PX` = 30).
  Baudisch et al., *snap-and-go* (CHI 2005): do not teleport the ink within a radius — that makes the
  band either side of every note unreachable — insert motor space at the anchor instead. 🚨 The CAP
  came from his logs: a whole-note gap of 220 px made `0.8 · gap` a 176 px hold, and mid-hold the
  cursor sits 176 px past the note the ink rests on. A hold is a HAND-scale distance (they tested
  18–34 px); the ratio governs dense music, the cap the rest.
- **THE CATCH-UP** (`catchupGainFor`, `G = 1/(1 − h/gap)`). Fernquist et al., *Oh Snap*
  (INTERACT 2011) — hold, then repay at a gain. 🚨 Their published 1.5 is **not** transferable: it is
  self-consistent only with their hold (10 px against ≥30 px spacing). Repaying `h` while the ink
  covers one `gap` needs `(G−1)/G ≥ h/gap`, so the gain is DERIVED per latch, and then cursor travel
  per gap equals the gap exactly, at any spacing.
- 🚨 **The hold is sized on the gap AHEAD**, measured after the latch — not the one just crossed.
  Sizing it behind ratchets: crossing a 21.98 sp gap to land 11.09 sp from the next note leaves a debt
  the following gap cannot repay, and the measured deviation ran −80, −175, −258 px, note after note.
- **THE VERTICAL SETTLES at each crossing** on the drag only (*"in the case of the drag maybe we have
  to reset the y"*). A lift is tuned to clear the note it sits on; a sweep across a bar arrives
  holding an answer about a note it has left. The KEYS keep their y through a crossing, because an
  arrow press is a considered edit of one quantity.

### Feedback (the research's unanimous finding)

Every notation program surveyed draws a dashed line from displaced ink to what it hangs off, and
Sibelius ships a *Check Attachments* plug-in because a wrong attachment is otherwise invisible. So:

- `HighlightController.applyArmedSlurAnchorNote` — the anchor note wears the endpoint's blue while a
  square is armed. Standing, not a flash: DERIVED from the selection, so nothing to set or clear.
- `SlurRenderer.endpointGuide` — a displaced end draws the dotted line back to `drawn − offset`, so
  the line IS the offset vector (MuseScore's `gripAnchorLines` uses the same pair,
  `slurtie.cpp:103-142`). Nothing is drawn for an unmoved end.
- The old drag CANDIDATE tint is gone with `slurEndpointCandidateNoteId`, `nearestNoteId` and the
  60 px snap: with the anchor following the ink live there is no candidate distinct from the anchor.

### ⏭️ Still owed (2026-08-18 — *"it feels better but it needs more tweeks"*)

- **The feel is not settled.** The hold ratio walked 24 px flat → 0.75 → 1.0 → 0.85 → 0.8 by hand,
  and the 30 px cap arrived last. ⛔ Do not round these; nothing in the papers picks between them
  (Baudisch's own study landed on a RANGE). ⚠️ Two dials interact — the ratio and the jitter
  threshold that decides how easily a hold RELEASES — and they were once moved in the same step,
  which muddied the reading. Move one at a time.
- The per-frame `dbg` deviation instrument (`cursorΣ`/`inkΣ`/`DEVIATION`) is deliberately kept: it is
  what found both real bugs. ⚠️ It once lied — frames wholly absorbed by the hold returned early
  without counting their cursor travel, and it reported its own arithmetic as drift.
- Midpoint instead of arrival is one comparison in `arrivedAt`, if the feel argues for it.
- **Reaching a mark whose ink is off-screen at all.** The limit below stops NEW cases; a file already
  carrying a wild offset still needs a route in, and every affordance for repairing one lives ON the
  ink (both squares, both arc dots, and the arc as a hit target), so a large offset carries the whole
  repair kit out of the viewport. What survives: `Ctrl+Z`; `Ctrl+Backspace` while the endpoint is
  still ARMED (it reads the model, never pixels); the Properties reset while the slur is still
  SELECTED. ⚠️ So the bottleneck is SELECTION — click away and the only way back is the ink you cannot
  see. The general form is selecting from the MUSIC (click the anchor note, reach its spanners), and it
  will be wanted for hairpins, ottavas and pedals too.

## P5 — THE VERTICAL LIMIT: half the gap to the nearest staff

His report, 2026-08-18: a drag put `end.y` at **54.86 sp**, then **66 sp**, the arc a near-vertical
hairline across five systems with its handles off-canvas — *"we should not allow the user to do
this"*. Then, after the first attempt, `y: −11` upward — *"we should never go this way either"*.

⚠️ **`nudgeFitsOnPage` was not at fault.** It forbids a step that pushes ink FURTHER off its SHEET, and
660 px down from mid-page is still on the page. The missing rule is about the ink's NEIGHBOURS.

### ⭐⭐ Why MuseScore needs no such rule and we do — read from its source, 2026-08-18

- **There is no clamp anywhere.** `SlurSegment::dragGrip` opens with `ups(g).off += ed.delta`
  (`slur.cpp:286`); the property setter is a bare assignment (`slurtie.cpp:273-284`); `propertyDefault`
  is `PointF()` and the reset goes through `undoResetProperty` (`slurtie.cpp:320`). A grep for
  `clamp|std::min|std::max` across `slur.cpp`, `slurtie.cpp` and `tie.cpp` returns **zero hits**.
- **It does not need one, because a user-moved slur still takes part in vertical layout.** `fillShape`
  builds the segment's shape by sampling the cubic through `ups(Grip::…).pos()` — which is `p + off`,
  so the user's offset is inside the shape (`slurtielayout.cpp:3257-3267`) — and every spanner segment
  is then added to its staff's skyline (`systemlayout.cpp:1967-1973`), gated only by `addToSkyline()`
  = `!(INVISIBLE | NO_AUTOPLACE) && !isSkipDraw()` (`engravingitem.h:438`). ⭐ **There is no
  "user-modified ⇒ excluded" condition**, so the systems open up and the arc always has room.
- No page or system bound in the drag path either: the only `constrain` there is direction-locking for
  barlines (`notationinteraction.cpp:1152`).
- Slur arch height is **uncapped** — `computeShoulderHeight` is `sqrt(slurLengthInSp / 4) · spatium`,
  ×0.75 over beams, minus the shoulder offset (`slurtielayout.cpp:2910-2931`). ⚠️ TIES are capped, by
  the style default `tieMaxShoulderHeight = 2`; slurs have no equivalent.

⛔ **We do not reflow** (a slur has no vote in vertical spacing — `RenderPass.drawnCurves` feeds only
`TrillRenderer`'s clearance), so a limit is our honest substitute, and it is a **UI safety rule, not an
engraving one**: no treatise discusses a slur 66 spaces from its notes because no engraver draws one.

### The rule (`engine/layout/systemBand.ts`)

**Halfway to the nearest staff.** A mark may leave its own staff freely and use up to half the gap to
whatever is painted above or below it — derived from the render (`ElementRegistry.staffBands()`,
deduplicated by extent), not a chosen number. ⭐ It makes no distinction between a piano's other staff
and the next system's: both are somebody else's room.

🚨 **A side with NO neighbour gets the room a neighbour WOULD have given** — half the TIGHTEST gap
between any two painted staves — and never infinity. The first version made it unbounded, and that is
exactly how `y: −11` got past the guard: bar 3 is in the top system. The minimum and not the mean,
because the limit has to hold where the systems are closest. Last resort, with no second staff on the
page at all: the staff's own height.

Three properties inherited from the page limit, each load-bearing:

- it **refuses the write and never clamps the drawing** (a forward test);
- it judges whether the overhang gets **worse**, never whether the ink is outside — so a score already
  carrying a wild offset can still be dragged BACK, and a limit that trapped it would be worse than
  the bug it fixes;
- **no drawn ink ⇒ allowed**, since refusing on no evidence makes an object unmovable invisibly.

⭐ The arithmetic is `pageBounds`' own: the band is handed to `stepLeavesPage` as a sheet with
unbounded x, so "would this push the ink further out" exists once, for both limits. Both are behind one
gate (`slurEndpointOffsetAllowed`) that the keyboard nudge and every drag frame share, so the two
devices cannot disagree about what is allowed.

### Tests added

- `slurEndpointWalk.test.ts` — the ink nudging up to arrival; the crossing press taking the gap out of
  the offset; the y and the arc surviving a keyboard crossing; the system-break refusal; the
  no-guessed-scale refusal; both directions and the clamp at the partner; the drag landing exactly
  where ten presses do; ONE frame crossing several notes; the drag's y settling where the keys' does
  not; the latch coming back to its own anchor (and that the ink can still LEAVE a latched note); a
  drag frame recording no undo entry; one undo entry per crossing press.
- `SlurRenderer.endpointGuide.test.ts` — from the ink back to the un-nudged point, a vertical-only
  nudge included, and nothing at all for an unmoved end.
- `systemBand.test.ts` — half the gap on each side; the NEAREST neighbour, not the first or furthest;
  the no-neighbour fallback and that it is the tightest gap rather than an average; the
  no-second-staff last resort; an overlapping band ignored; the 66-space step refused; already-outside
  ink allowed back; no-ink allowed; the vertical judged alone.
- `slurHandlePick.test.ts` — the nearest handle wins whichever family it belongs to, a dead heat goes
  to the square, another slur's handle never answers, nor an entry lacking its gesture's fields.
- `HighlightController.slurAnchor.test.ts` — start vs end vs nothing armed, and that one pass now
  serves both devices.
