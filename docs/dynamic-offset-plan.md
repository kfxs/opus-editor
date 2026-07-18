# Dynamic offset (keyboard nudge) plan

## Goal

Let the composer **fine-tune where a dynamic sits** — a free x/y offset off its
note anchor, on top of (not instead of) the automatic placement below/above the
staff.

When a dynamic is selected:

1. **Arrow keys nudge its position** — fine step on a plain arrow, coarse step on
   `Ctrl`+arrow (the same Sibelius-style fine/coarse pair the slur endpoint uses).
   `←/→` move horizontally, `↑/↓` vertically (screen-down is `+y`; up-arrow lifts
   the mark).
2. The offset is a **persistent, anchor-relative** adjustment stored in the
   engraving-overrides compartment in **staff-spaces** (never pixels in the model).
3. One undo entry per press.

Out of scope for this pass: a "reset to default position" command (trivial later —
clear the `dynamicOffset` kind); making the offset **travel across paste** (a pasted
dynamic mints a fresh id, so the id-keyed override does not follow it yet — same
deferred state as slur `curveShape` travel).

## Settled decisions

- **Client #8 of the engraving-overrides compartment**, `kind: 'dynamicOffset'`,
  `{ x, y }` in staff-spaces, anchor-relative. **Element-id-keyed** (dynamics have a
  durable id) — so it reads straight through, no position-key or `spanCount`
  staleness rule (unlike the rest clients / segment offsets).
- **Both axes.** Dynamics conventionally move vertically for baseline alignment, but
  the keys line up perfectly for 2D and horizontal nudges are occasionally wanted, so
  all four arrows are bound. `←/→` reuse the otherwise-unbound `Ctrl+←/→` coarse pair
  the slur endpoint introduced; the plain `←/→`/`↑/↓` are modally overloaded exactly
  as the slur-endpoint / rest-shift / staff-spacing features already overload them.
- **Step sizes reuse the slur values:** plain arrow = fine `NUDGE_FINE_SS = 0.25`
  staff-space, `Ctrl`+arrow = coarse `NUDGE_COARSE_SS = 1.0` staff-space — so the whole
  editor nudges by one consistent feel. Tune live if needed.
- **Returning to (0,0) clears the override** (absent = default, JSON stays clean),
  matching every other client.

## Where it lives (mirrors the slur-endpoint nudge end to end)

| Piece | Location |
|---|---|
| Type (`DynamicOffsetOverride`) | `src/types/music.ts` |
| Read (`dynamicOffsetOverrideOf`) | `src/engine/models/engravingOverrides.ts` |
| Mutator (`nudgeDynamicOffset`, accumulate + clear-at-0) | `src/engine/models/ScoreModel.ts` |
| Facade (`nudgeDynamicOffset`, one `saveOnly` undo) | `src/engine/MusicEngine.ts` |
| Render apply (`applyDynamicOffsets`) | `src/engine/rendering/DynamicsLayout.ts` |
| Keyboard (`nudgeSelectedDynamic`) | `src/composables/useShortcuts.ts` |

## Render note

The offset is applied as an **SVG-transform translate** on the rendered annotation
group — the same technique `layoutCoLocatedDynamics` uses, because VexFlow's modifier
shifts are awkward to control for annotations. `applyDynamicOffsets` runs LAST (after
`registerDynamics` and `layoutCoLocatedDynamics`) and **composes** with any co-location
transform by prepending its own translate; both are pure translations, so they add
commutatively and the co-location row layout is preserved. The registry bbox is shifted
by the same delta so hit-testing follows the mark.

## The redraw-key gotcha (found in hand-testing — the picture didn't move)

`applyDynamicOffsets` only runs inside `renderMeasure`, so a nudge is visible **only if
the bar actually re-engraves**. Whether it does is decided by the P5 **shape key**
(`measureShapeKey`, docs/render-performance-plan.md §7a), and this override is a textbook
way to fall through it:

- it costs **no width**, so the width key (`laneFingerprint`) is correctly blind to it;
- it is **id-keyed** (by the dynamic's uuid), so `overridesFor` — which only matches the
  position-keyed `{measureId}:…` rest overrides — never sees it;
- it does **not** live in `measure.dynamics`, so the dynamics array in the key is
  unchanged by a nudge.

Result before the fix: the shape key was identical before/after a nudge, the bar's group
was reused, and the mark sat still while the JSON showed the offset growing. The fix folds
each measure dynamic's override list into the shape key
(`view.dynamics?.map(d => score.engravingOverrides?.[d.id] ?? null)`), so exactly the bar
holding a nudged mark redraws — same one-bar blast radius as *adding* a dynamic, and the
width key stays untouched (no neighbour reflow). Guarded by a test in
`incrementalRedraw.test.ts` that was verified to fail without the fix.

**Rule reaffirmed** (docs reference "WIDTH key vs SHAPE key"): a new engraved adjustment
is invisible to the caches until it is in the *shape* key. When unsure, INCLUDE — a
wrong answer here is a silent stale picture, not a crash.
