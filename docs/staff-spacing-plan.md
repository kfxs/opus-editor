# Staff Spacing (Sibelius-style vertical staff drag) — Plan

Status: **IMPLEMENTED — Phases 0-3 done (per-system is the default).** Keyboard nudge
(`Shift+↑/↓` fine, `Alt+↑/↓` coarse) + vertical drag (select-and-grab on mousedown); each
tweak is per-system, anchored to the durable id of the measure that opens its system, with the
global-per-staff value as fallback. Reset wired end-to-end (palette button still TODO — pure
UI). This is a *geometry / presentation* feature (Design Principle 3), so it deliberately
reuses the **engraving-overrides** machinery rather than inventing a new storage path.

---

## 1. Goal

Reproduce the Sibelius gesture: select a bar (our plain-click **single** measure box),
then **drag the staff up/down** — or nudge it with the keyboard — to widen or tighten the
vertical space above that staff. In Sibelius this adjusts *"space above staff"*: it moves
the **whole staff on that system**, not the single clicked bar, and by default the staves
below ride along.

Non-goals for the first cut: "Optimize / Space Evenly" batch commands, space-*below* as a
separate control (see §7), per-page overrides, and horizontal spacing.

## 2. Why this is Design-Principle 3, and what that dictates

A manual staff-spacing tweak is an **authored decision that must persist** — it is *not*
derived layout (like where a line auto-breaks). That is exactly the `Slur.cps` situation,
and `DESIGN-PRINCIPLES.md` boundary-case #1 already records the resolution:

- **Authored geometry does NOT go on the content model and NOT as raw pixels.** It goes in
  the **`score.engravingOverrides` compartment**, stored in **staff-spaces**,
  anchor-relative — so it survives font/zoom/spacing/reflow and keeps the content model +
  JSON pixel-free (P3 held).
- **Nothing layout-*derived* may be stored.** A *system index* is a layout result (it falls
  out of reflow), so keying an override to "system 3" is forbidden by P3. This is what
  rules out the per-(staff, system-index) design — see §4.

The other principles shape it too:

- **P4 (composable 1..N):** key by the **durable `staffId`**, so single-staff is just the
  N=1 case (its "space above" is the top-margin gap — same offset term), never a special
  path.
- **P1 (score is a value):** the compartment already clones / serializes / undoes with the
  score value, so persistence, undo, and copy come for free.

## 3. Where it lands in the code (one render seam + three mirror sites)

Today every stave Y is fully deterministic (`VexFlowRenderer.renderScore`,
`VexFlowRenderer.ts:1214-1223`):

```
staffStride = STAVE_HEIGHT(120) + VERTICAL_SPACING(30) = 150
systemTop   = margin + currentLine * numStaves * staffStride
y           = systemTop + staffIndex * staffStride        // ← the primary seam
```

There is **no per-staff vertical offset hook anywhere** — every gap is uniform. VexFlow has
no concept of staff spacing: a stave sits wherever we pass `y` to `new Stave(x, y, w)`
(`VexFlowRenderer.ts:1335`). The core render change is **one added term** at
`VexFlowRenderer.ts:1222`:

```
const above = staffSpacesToPixels(staffSpacingAbove(score, staff.id), someStaveForSpacing)
y += above + (accumulated `above` of every staff earlier in this system)
```

i.e. a staff's "space above" pushes it *and everything below it in the system* down — the
Sibelius default (staves below ride along).

**But "one added term" is only true for the *authoritative* paths — the Y math is duplicated
in four places, three of which need the same offset:**

1. **`VexFlowRenderer.ts:1222`** — the primary seam above. ✅ the real fix.
2. **`totalHeight` (`VexFlowRenderer.ts:1179`)** — must add the per-system accumulated `above`
   (sum over all staves, × numLines) so the SVG grows to fit.
3. **Ghost-note preview (`VexFlowRenderer.ts:1322-1323`)** — the entry preview recomputes
   `systemTop`/`measureY` by hand. If it's *not* patched, the translucent ghost note floats at
   the old staff position while the committed note lands at the new one, for any staff with
   spacing ≠ 0. **Functional gap, not cosmetic — must get the same accumulated `above`.**
4. **`getMeasureRect` (`MusicEngine.ts:1780`)** — computes system height as a *fixed*
   `(numStaves-1)*staffStride + STAVE_HEIGHT`, no spacing term. This rect drives the Ctrl+Shift
   **double-box** (all-staff measure select) hit-box + highlight *and* playback scroll-into-view;
   once a staff is pushed down it under-covers the lower staves. Add the per-system accumulated
   `above`.

**Why the reverse (hit-test / click-to-pitch) paths need NO manual offset — the load-bearing
fact that keeps the seam count small:** `ElementRegistry` captures each staff's real
`lineYPositions` from the *actual drawn* stave (`VexFlowRenderer.ts:1005-1016`), and
click-to-place pitch resolves through `registry.pixelYToPitch` (`MusicEngine.ts:1586`), not
`CoordinateMapper`. So the moment a stave is drawn lower, hit-testing existing elements and
resolving a click's pitch/staff **auto-follow the offset for free**. The one caveat:
`CoordinateMapper` still assumes uniform system height (`systemHeight()` =
`staffHeight * numStaves`, `CoordinateMapper.ts:86-88`). Its primary `pixelToMeasure` uses real
per-measure bounds so it survives, but the **fallback / closest-measure branches**
(`:205`, `:210`, `:225`) and `getMeasurePosition` (`:100`) drift on *multi-system* scores with
spacing. Fallback-only, minor — noted so it's not a surprise, not a Phase-1 blocker.

## 4. The anchor decision (settled)

The offset must attach to a **durable** thing. Three options were weighed; P3 decides:

- **(A) per-staff, global** — one "space above" value per `staffId`, applied on every
  system. Fully reflow-stable, zero layout dependency. **Cleanest under P3. Ship this
  first.** Limitation: can't spread staves apart on one crowded system only.
- **(B) per-(staff, system-index)** — Sibelius-exact granularity, but a system index is a
  layout result. **Forbidden by P3 as a stored key. Off the table.**
- **(C) per-(staff, system-anchored-to-a-durable-measure-id)** — store against the durable
  id of the measure that *opens* the system, and resolve "which system is that" as a
  render-time **view**. Gets per-system granularity **and** P3-clean durable anchoring.
  **Deferred** — layer later as an optional refinement that falls back to (A), exactly like
  single-arc `curveShape` vs per-segment `segmentCurveShape` for slurs.

**Residual tension:** none for (A). For (C) later, one small edge remains — when reflow
changes *which* measure opens a system, the anchored measure may no longer be a
system-start; it needs one rule (fall back to the (A) value / re-home / drop), directly
analogous to `segmentCurveShape`'s reset-on-`spanCount`-change. Well-precedented, not
structural.

## 5. Data model

New override kind in the compartment (`src/types/music.ts`, next to `RestShiftOverride`):

```typescript
/**
 * Client #7 of the engraving-overrides compartment: extra vertical space ABOVE a staff
 * (Sibelius "space above staff"). Stored in STAFF-SPACES, signed (+ = push the staff and
 * everything below it in its system downward). Keyed by the durable `staffId` (id-keyed,
 * the usual case — unlike the position-keyed rest clients). Absent = default spacing.
 * Phase 1 is global-per-staff (applies on every system); a future per-system refinement
 * anchors to the system's opening measure and falls back to this value.
 */
export interface StaffSpacingOverride extends EngravingOverride {
  kind: 'staffSpacing'
  /** Extra space above the staff, in staff-spaces. Signed; + pushes down. */
  above: number
}
```

Reads in `src/engine/models/engravingOverrides.ts` (mirror `restShiftOverrideOf`):

```typescript
export function staffSpacingOverrideOf(score, staffId): StaffSpacingOverride | undefined
// convenience: staffSpacingAbove(score, staffId) => number  (0 when absent)
```

Write path on `ScoreModel` (mirror `nudgeRestShift` / `setRestShift`):

```typescript
nudgeStaffSpacing(staffId, deltaSteps): void   // add; clears the entry when it lands on 0
setStaffSpacing(staffId, above): void          // absolute; clears when 0 so absent = default
resetStaffSpacing(staffId): void               // Layout → Reset Space Above
```

No JSON migration (no legacy data — `project_no_json_migration`). Absent degrades to
default like every other client.

## 6. Interaction

**Selection entry already exists.** The plain-click **single** measure box selects one
staff's band: `selectedMeasureBoxStyle === 'single'` + `selectedMeasureStaff`
(`EditorState.ts:143`, drawn in `HighlightController.ts:145`). That selection *is* the "I've
grabbed this staff" state — no new selection kind needed.

**Two ways to move it, both when a single measure box is selected:**

1. **Keyboard nudge (do this first — simplest, testable).** **`Alt+↑/↓`** changes `above`
   by one staff-space step, with **`Ctrl+Alt+↑/↓`** for a coarse (larger) step — matching
   Sibelius muscle memory (DECIDED 2026-07-08). `Alt+↑/↓` is **already bound to
   `chordNoteUp/chordNoteDown`** (chord navigation) — this is NOT a collision but the app's
   standard *modal overload*: the two behaviors are gated on **disjoint** selection states
   (a chord/note is armed → navigate chord; a single measure box is selected → nudge spacing;
   you can't be in both). Implement it exactly like `pitchUp` already does for pitch-vs-rest-shift
   (`useShortcuts.ts:309`): guard first, return early, else fall through —

   ```js
   chordNoteUp: () => { if (nudgeStaffSpacingIfBoxSelected(+1)) return; selection.navigateChord(1) }
   ```

   `Ctrl+Alt+↑/↓` is genuinely unbound today, so the coarse pair needs no overload. Route the
   guard through `useShortcuts` → a `StaffSpacingController` (or fold into an existing
   controller) → `ScoreModel.nudgeStaffSpacing` → re-render. (`Alt+Shift+↑/↓` voice-hop is a
   third, distinct key — no interaction with either.)

2. **Vertical drag (Phase 2).** Reuse the slur-handle drag pattern in `MouseController`
   (`isDraggingSlurHandle`, baseline value at drag start, px→staff-spaces via the stored
   `draggedStaffSpacePx`, no-op/undo bookkeeping — `MouseController.ts:79-96`). Grab starts
   when the mouse-down lands inside the selected single box; `dy` in pixels ÷ staff-space-px
   → delta `above`; commit on mouse-up as one undo step. The box highlight follows during
   drag (live re-render, same as slur reshape).

**Undo:** each committed nudge/drag is one atomic history entry (the compartment rides the
score-value snapshot — free via P1).

## 7. Space below — not a separate control (DECIDED 2026-07-08)

There is **one knob: space-above, per staff.** In a stack, the gap *below* staff *N* and
the gap *above* staff *N+1* are literally the same gap — a per-staff "space above" already
controls every inter-staff gap, so a separate "space below" would just be a second name for
the same pixels. The *only* gap space-above can't reach is the one **below the last staff**
of a system — that's a bottom-margin concern, not between-staves, and is deferred (add a
bottom-margin term later if it ever matters; additive, no teardown).

## 8. Open questions (for the next conversation, not blockers)

1. ~~Keyboard keys.~~ **DECIDED (2026-07-08): `Alt+↑/↓` fine, `Ctrl+Alt+↑/↓` coarse — match
   Sibelius.** `Alt+↑/↓` **overloads the existing `chordNoteUp/Down` action** by selection kind
   (single measure box → spacing; note/chord armed → chord nav — disjoint states, the `pitchUp`
   modal-overload precedent at `useShortcuts.ts:309`), NOT a new binding. `Ctrl+Alt+↑/↓` is
   unbound and free. `Alt+Shift+↑/↓` voice-hop is unaffected (different key).
2. ~~Default step size.~~ **DECIDED (2026-07-08): 1 staff-space per `Alt+↑/↓`, 4 per
   `Ctrl+Alt+↑/↓`.** Chosen as a starting point; tune live during manual testing (rest-shift
   shipped too large — see `project_rest_shift_plan`, so we start conservative).
3. **Reset UX.** A "Reset spacing" button in the single-box palette
   (`PaletteController.ts:89`, the `'single'` branch) alongside the existing Staff
   Above/Below buttons? Or key-combo only?
4. **Single-staff meaning.** Confirm we want space-above of the top staff to act as extra
   top margin (it will, naturally, from the accumulation in §3).

## 9. Phases

- **Phase 0 — model + read.** `StaffSpacingOverride` type; `staffSpacingOverrideOf` /
  `staffSpacingAbove` reads; `ScoreModel.nudgeStaffSpacing/setStaffSpacing/resetStaffSpacing`
  writes. Unit tests: write/clear-on-zero, absent=0, round-trips through toJSON/undo. No
  render change yet.
- **Phase 1 — render + keyboard nudge. DONE (not yet committed).** Accumulated `above` term
  wired into all four Y sites (`VexFlowRenderer` primary seam + `totalHeight` + ghost-note
  preview; `MusicEngine.getMeasureRect`) via `VexFlowRenderer.staffAboveOffsets` (inclusive
  prefix sums, converted with `VEXFLOW_DEFAULT_STAFF_SPACE_PX`). `Alt+↑/↓` fine (overloads
  `chordNoteUp/Down` by selection kind) + `Ctrl+Alt+↑/↓` coarse (new bindings), gated to a
  single measure-box selection → `MusicEngine.nudgeStaffSpacing(index→id)` → model, one undo
  per press. Step sizes 1 / 4 ss (conservative start). Keys settled as **`Shift+↑/↓` = fine
  (1 ss)**, **`Alt+↑/↓` = coarse (4 ss)** — coarse rides the `chordNoteUp/Down` overload;
  moved off `Ctrl+Alt+↑/↓` (Linux WMs grab it for workspace switching). `CoordinateMapper.systemHeight()`
  fallback drift left as documented (§3, not a blocker). 962 unit tests green. Manual test
  pending: user nudges spacing via keyboard, saves/loads, undoes.
- **Phase 2 — vertical drag. DONE (drag) / reset-button OPEN.** `MouseController` grabs when a
  press lands inside the already-selected single box (`handleStaffSpacingMouseDown`, mirrors the
  slur-handle "select then grab"); `handleStaffSpacingDrag` turns cursor-Y travel into an
  absolute `above` via `previewStaffSpacing` (no undo), box highlight follows the live re-render;
  `endStaffSpacingDrag` → `commitStaffSpacing` records ONE undo on drop (only if it moved). New
  facade: `getStaffSpacingAbove` (baseline read) / `previewStaffSpacing` / `commitStaffSpacing`.
  Reset UX (§8.3) still open — spacing already auto-clears at 0, so nudging back to baseline is a
  working reset; a dedicated palette button is deferred pending the decision.
- **Phase 3 — per-system (option C). DONE, and now the DEFAULT (not opt-in).** The drag/nudge
  targets the system the selected bar sits on: keyed by `staffSystemSpacingKey(staffId,
  openingMeasureId)` (the durable id of the measure that opens that system), resolved at render
  time via `resolveStaffSpacingAbove` (per-system value, else the global-per-staff fallback,
  else 0). The renderer computes spacing PER LINE (`staffSpacingLayout`: `lineTopPx` / `cumPx` /
  `contentHeightPx`), so systems with different spacing stack correctly; the ghost preview +
  `getMeasureRect` resolve per-system too. `VexFlowRenderer.getSystemOpeningMeasureNumber` maps a
  bar → its system's opener; `MusicEngine.staffSpacingTarget` maps that → the durable key. The
  **reset-on-reflow rule is automatic**: an override whose anchor measure no longer opens a
  system is never looked up (self-heals; orphaned entry lingers harmlessly in JSON). No stored
  layout index → Design Principle 3 held. Global-per-staff stays as the fallback layer but the
  UI no longer writes it (so in practice every override is per-system). 966 unit tests green.

## 10. Files touched (Phases 0-1)

- `src/types/music.ts` — `StaffSpacingOverride`.
- `src/engine/models/engravingOverrides.ts` — `staffSpacingOverrideOf` / `staffSpacingAbove`.
- `src/engine/models/ScoreModel.ts` — nudge/set/reset write path.
- `src/engine/rendering/VexFlowRenderer.ts` — accumulated `above` term in **three** sites:
  the primary Y seam (`:1222`), `totalHeight` (`:1179`), AND the ghost-note preview's duplicate
  `systemTop`/`measureY` (`:1322-1323`, else the entry preview drifts from where notes land).
- `src/engine/MusicEngine.ts` — `getMeasureRect` (`:1780`) system-height formula, so the
  all-staff double-box hit-box/highlight + playback scroll cover the pushed-down staves.
- `src/shortcuts/*` + a controller (`interactions/`) — `Alt+↑/↓` (overload `chordNoteUp/Down`
  by selection kind) + `Ctrl+Alt+↑/↓` coarse nudge, gated to a single-box selection.
- (Phase 2) `src/interactions/MouseController.ts` — vertical drag; `HighlightController` /
  `PaletteController` for live box + reset button.
- Tests co-located (`engravingOverrides.test.ts`, `ScoreModel` spacing tests).

`DESIGN-PRINCIPLES.md`: add a boundary-case note (like #1) recording that staff-spacing is
authored presentation keyed to the **durable `staffId`**, never a system index.
