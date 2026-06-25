# Tuplet Positioning & Control — Plan

Status: **Phase 1 (multi-voice flip inconsistency) — DONE. Phase 1b (Sibelius-style `x`
round-trip) — DONE** (tuplet/slur/tie now toggle auto ↔ flipped). Tier-1 user-facing controls
(Phase 2) documented but DEFERRED. Tier 2 (self-rendering / handles) explicitly **out of
scope** for now.

This document records *why* tuplet bracket positioning behaves the way it does, what VexFlow
can and cannot do for us, and the phased path toward professional tuplet control. The
immediate goal is narrow: **fix the multi-voice flip inconsistency** using only mechanisms
VexFlow already exposes (Tier 1). We are **not** building full tuplet control now.

---

## 1. Background — how tuplets render today

A tuplet is a first-class object on `Measure.tuplets[]` (`src/types/music.ts`). Each note/rest
that belongs to it carries the `tupletId` on its slot, and the tuplet's voice is derived from
those slots (a tuplet lives in exactly one voice).

Rendering (`src/engine/rendering/VexFlowRenderer.ts`):

- `buildVexTuplets()` groups slots by `tupletId`, builds a VexFlow `Tuplet`, and chooses the
  bracket side via `resolveTupletLocation()` (`NoteBuilder.ts`):
  - explicit `Tuplet.placement` override (set by the `x` flip) wins;
  - else **multi-voice → voice 0 above, lower voices below** (so the voices' brackets spread
    to the outer edges, matching engraving practice);
  - else single-voice → stem-derived default.
- `drawAndRegisterTuplets()` calls `vexTuplet.draw()` and registers a hit-box in
  `ElementRegistry`. The hit-box Y is now taken from VexFlow's own `getYPosition()` so it
  matches the drawn bracket exactly.

`TupletGeometry` (in `ElementRegistry`) carries `bracketLegLength`, `bracketThickness`,
`notationCenterX`, `textYOffset`, `yOffset`, etc. — **today these are descriptive only**
(copied out of VexFlow; only `.location` is read back, for the flip). The struct is already
shaped for a future where *we* draw the bracket.

**Precedent:** slurs were migrated off VexFlow's auto-draw to our own low-level rendering
(`Curve.renderCurve` + editable `cps` + draggable handles). Tuplets would follow the same
evolution if/when we do Tier 2. See `docs/slur-plan.md`.

---

## 2. The VexFlow boundary — what it can and cannot do

VexFlow's `Tuplet` (node_modules/vexflow `src/tuplet.js`) does **two jobs**:

1. **Rhythm math** — constructing + `attach()` rewrites note tick values (the 3-in-2 ratio).
   Must run before formatting; drives note spacing. **We always need this and must keep it.**
2. **Drawing** — `draw()` paints the bracket + number.

The drawing side exposes only these knobs (constructor `options`):

| Option        | Effect                                   | Used today? |
|---------------|------------------------------------------|-------------|
| `location`    | bracket above / below                    | yes         |
| `bracketed`   | bracket on/off (number still shows)      | no          |
| `yOffset`     | shift whole bracket + number vertically  | no          |
| `textYOffset` | shift just the number vertically         | no          |
| `ratioed`     | show "3:2" instead of "3"                | no          |

**Hard walls — VexFlow `draw()` cannot do these** (geometry is hardcoded, `tuplet.js:182-199`):

- horizontal extend / shrink (X = `firstNote.getTieLeftX()-5` → `lastNote.getTieRightX()+5`, fixed)
- leg length (fixed `location * 10`)
- sloped / angled brackets (always flat, equal legs)
- independent number X position
- draggable handles
- placing an *above* bracket anywhere but clamped to ≥1.5 lines above the **top staff line**
  (`getYPosition()`, `tuplet.js:131-150`) — except by fighting it with `yOffset`.

---

## 3. Tiers & scope decision

**Tier 1 — feed VexFlow options (NO self-rendering).** Achievable by adding model fields and
threading them into the options at `VexFlowRenderer.ts`. Low risk, incremental.

- hide bracket (`bracketed`)
- nudge number Y (`textYOffset`)
- nudge whole bracket Y (`yOffset`)
- show ratio (`ratioed`)
- **fix the multi-voice flip inconsistency** via a computed `yOffset` (Phase 1)

**Tier 2 — render the bracket ourselves (DEFERRED, out of scope now).** Keep VexFlow's
`Tuplet` for tick math, stop calling its `draw()`, paint from `TupletGeometry`.

- horizontal extend / shrink, leg length, slope, independent number X, draggable handles
- **Cost is not the rectangles — it's that we'd inherit responsibility for VexFlow's automatic
  avoidance of beams/stems/modifiers** (`getYPosition` factors in modifier lines). A pro result
  means owning that collision default. This is why Tier 2 is deferred.

Decision (2026-06-25): **do Tier 1, only as far as Phase 1 (the inconsistency) right now.**
Other Tier-1 features (user-facing yOffset/hide/ratio) are documented here for later. **No
Tier 2.**

---

## 4. Phase 1 (NOW) — fix the multi-voice flip inconsistency

### Problem

With two voices, the default is V1 above / V2 below — both brackets sit *outside* the system,
symmetric and correct. The inconsistency appears **only on flip**:

- Flip **V1 → below** → VexFlow's LOCATION_BOTTOM anchors to the bottom staff line → the
  bracket lands neatly just under V1's own notes. Looks right.
- Flip **V2 → above** → VexFlow's LOCATION_TOP **clamps the bracket to ≥1.5 lines above the
  top staff line** (the `min()` against `getYForLine(0)` in `getYPosition`), so the lower
  voice's bracket jumps to the **top of the whole system, above V1** — and if V1 is also
  above, the two land on the *exact same pixels* and overlap completely.

So the lower voice's flipped bracket ends up above the upper voice, which reads as wrong, and
two same-side brackets can perfectly overlap.

### Approach (Tier 1 — `yOffset`)

VexFlow adds `options.yOffset` to `getYPosition()`. We compute a `yOffset` that pulls a
flipped *inner* bracket (one pointing toward the other voice) out of the system-edge clamp and
places it **adjacent to its own notes** (in the inter-voice gap), so it no longer overshoots
past the other voice and same-side brackets don't perfectly overlap.

Sketch (to be refined against manual testing):

1. In `buildVexTuplets`/`drawAndRegisterTuplets`, detect a multi-voice tuplet whose resolved
   `location` points **toward** the other voice (the "inner" side) — i.e. a non-primary voice
   placed *above*, or the primary voice placed *below*.
2. Compute the desired bracket Y from the tuplet's **own** notes (replicating VexFlow's
   per-note term — stem tip / notehead ± a line — but **without** the staff-line ceiling
   `min()` that causes the overshoot).
3. Set `options.yOffset = desiredY − vexFlowClampedY` (read the clamped value via
   `getYPosition()` with yOffset 0), then draw.
4. The hit-box already derives from `getYPosition()`, so it follows the new yOffset
   automatically — no extra hit-box work.

Keep the logic **pure and testable** where possible (e.g. a helper that, given the clamped Y
and the own-notes Y, returns the yOffset), mirroring `resolveTupletLocation`.

### Out of Phase 1

- No model field for user-set yOffset yet (this is an automatic engraving correction, not a
  user override). The `x` flip remains the only persisted override.
- No change to single-voice behaviour.

---

## 4b. Phase 1b (NOW) — Sibelius-style flip (`x` round-trips to default)

### Problem

`x` flips a selected tuplet/slur/tie by storing an **absolute** side
(`MusicEngine.flipTuplet/flipSlur/flipTie`): it reads the current side and writes the
*opposite* absolute side (`'above'`/`'below'`, or `tieDirection ±1`). The override then has
only two reachable values — there is **no path back to `undefined` (auto)** via `x`.

Two consequences:

1. **No round-trip to default.** Once touched, `x` ping-pongs above↔below forever; the user
   can never get back to "auto". A user who flips and then flips again *thinks* they're back
   to default but is actually **pinned** to a side.
2. **A pinned side ignores context.** An auto mark re-derives its side every render
   (voice/stem/pitch aware — e.g. the multi-voice rule in §1). A pinned absolute side does
   not, so it can silently stop tracking the rule.

### Model (matches Sibelius `X` = flip)

Make `x` a **2-state toggle between auto and flipped**, not an absolute above/below setter:

- override **set** (flipped) → **clear to `undefined`** (back to the context-aware default);
- override **unset** (auto) → set to the **opposite of the last-drawn side** (a visible flip).

So: auto → flipped → auto → flipped… Two presses always return to default, and the first
press always visibly flips (the project already wants "first press always visibly flips").
This is exactly Sibelius's `X` behaviour; absolute Above/Below pinning, if ever wanted, belongs
in a future properties menu (Above / Below / Auto), not on the key.

The two reachable states (default and not-default) cover both sides, so nothing is lost: to
reach the other side you're either at default or one flip away.

### Scope

- Rewrite `flipTuplet`, `flipSlur`, `flipTie` (`MusicEngine.ts`) to the toggle above. The
  "opposite of last-drawn side" branch is already implemented (they read the registry for the
  auto case) — we only add the "if already overridden, clear instead of inverting" branch.
- Setters already exist: `setTupletPlacement(id, undefined)`, `clearTieDirection(fromNoteId)`,
  and slur `placement` is directly clearable. **No data-model or JSON change** — `undefined`
  is already the auto state on load/save.
- Update the existing flip unit tests (e.g. MusicEngine.test.ts "flipSlur toggles placement
  above ↔ below") to assert the new auto↔flipped round-trip.

### Difficulty: LOW

Three small symmetric method edits + test updates. No migration, no rendering change (render
already resolves `undefined` → context-aware default).

### Deferred refinement (NOT now)

A *relative* `flipped` flag (render side = `flipped XOR autoDefault`) would also make the
**flipped** state track context, not just the auto state. That needs a data-model + JSON change
across all three mark types, and beyond Sibelius's own behaviour. The 2-state toggle above
already fixes the reported problem (round-trip + auto tracks context); the relative flag is a
later upgrade if we find the flipped state going stale in practice.

---

## 5. Phase 2 (LATER, Tier 1) — user-facing controls

Documented, not scheduled. When picked up:

- Add override fields to `Tuplet`: `bracketVisible?` (→ `bracketed`), `numberYOffset?`
  (→ `textYOffset`), `yOffset?` (→ `yOffset`, user override layered over the Phase-1 auto
  value), `showRatio?` (→ `ratioed`).
- Thread them through `buildVexTuplets`. Undo/redo + JSON round-trip.
- UI: palette toggles and/or a vertical drag handle on the number.

---

## 6. Out of scope (Tier 2 — deferred)

Horizontal extend/shrink, leg length, slope, independent number X, draggable bracket handles,
self-rendering the bracket, and owning beam/modifier collision-avoidance. If/when needed,
mirror the slur migration: model as source of truth → low-level draw from `TupletGeometry` →
handles. VexFlow stays the rhythm/spacing engine regardless.

---

## 7. Code references

- `src/engine/rendering/VexFlowRenderer.ts` — `buildVexTuplets`, `drawAndRegisterTuplets`,
  `resolveTupletLocation` call site.
- `src/engine/rendering/NoteBuilder.ts` — `resolveTupletLocation`, `TUPLET_LOCATION_*`.
- `src/engine/ElementRegistry.ts` — `TupletGeometry`, `getTupletAt`.
- `src/interactions/HighlightController.ts` — `applyTupletSelectionHighlight` (front-floats the
  selected group so overlapping brackets don't hide the highlight).
- `node_modules/vexflow/build/esm/src/tuplet.js` — `getYPosition()` (lines 125-173),
  `draw()` (174-207).
- `docs/slur-plan.md` — the precedent for Tier-2-style self-rendering + handles.
