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

## ✅ TODO — ALL DONE (17th session, 2026-07-19)

All four items below are closed. Kept for the record.

1. **[P0] ✅ DONE — Orphan `dynamicOffset` on delete.** `ScoreModel.removeDynamic` used to splice the
   dynamic out of its measure but never clear `engravingOverrides[id]`, so a **nudged-then-deleted**
   dynamic left its offset behind forever (harmless at render — unmatched keys are ignored — but it
   accrued cruft in the JSON and every undo snapshot). Fixed: after the splice, `removeDynamic` now
   calls `this.clearEngravingOverride(id)`, covered by a test (delete a nudged dynamic →
   `engravingOverrides` is clean). Orphans already sitting in a live file still need a hand-delete or
   a one-time prune on load if it ever comes up.
2. **[P1] ✅ DONE — Offset now travels across paste (and survives any rebar).** A pasted dynamic gets
   a fresh id, so its id-keyed override used not to follow. Fixed at the `captureBeatAnchors` /
   `restoreBeatAnchors` seam in `rebarOps.ts` — the same place that already regenerates every
   dynamic's id: capture reads `dynamicOffsetOverrideOf` and CLEARS the old key, restore re-stamps it
   under the fresh id (mirroring the rest-shift capture/restore twin). The clip payload carries the
   offset as `ClipDynamic.engravingOffset`, captured at copy in `dynamicsInWindow`. This closed a
   second latent orphan for free: the destination's OWN nudged dynamics used to lose their offset on
   any rebar (meter change), because rebar regenerated their ids too. Covered by two tests (paste
   travel + rebar survival), both verified to fail without the fix.
3. **[P2] ✅ DONE — Co-located level dynamics measured inflated.** The `registerDynamics` bbox rebuild
   (see the pointer-rect note below) covered only the single-dynamic path; `layoutCoLocatedDynamics`
   then OVERWROTE the registry bbox with the raw `getBBox` group box, re-unioning the pointer-rect for
   co-located level glyphs (two dynamics on one anchor → both attachment lines drew from the inflated
   top; deleting one restored it). Fixed: shift the TIGHT registry bbox by the co-location translate
   (mirroring `applyDynamicOffsets`' shift-in-place) instead of writing back the group box.
4. **[P2] ✅ Attachment-line polish — verified live, no change needed (for now).** The eyeballed
   `DYNAMIC_GLYPH_INK_ABOVE/BELOW` (`dynamicStyle`) and the chord anchor point (lowest notehead) were
   judged correct on screen by the user, so the first-cut constants stand. A future *cosmetic* redesign
   of the line's look is possible but not queued — only revisit `INK_ABOVE` if the dot ever sits off a
   glyph's edge. Longer term, still open: the toggleable "guide" overlay family (rulers, markers) the
   attachment line was built to seed.

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

## Attachment line (selection visualization)

When a dynamic is **selected**, a thin dashed line is drawn from the mark to its rhythmic anchor
(the note/beat it hangs off) — the Dorico/MuseScore "attachment line". It answers "what is this
attached to?", which matters once the mark has been nudged away from its note.

**It is NOT part of the score** — not engraved, not hit-tested, not serialized. It is a pure
overlay in the same family as the slur handles / keyboard cursor / paste caret:

- The anchor point `{x, y}` is the anchor **note itself** — its `getAbsoluteX()` and its lowest
  notehead Y (`Math.max(getYs())`, nearest a below-staff mark) — captured at render in
  `DynamicsLayout.registerDynamics` and stored on the dynamic's `ElementRegistry` entry
  (`ElementInfo.anchor`). Anchoring to the note (not a fixed staff line) makes the line **track the
  note when its pitch moves** — a pitch change redraws the bar, recapturing at the new Y. It also
  rides the P5.4b translate (`offsetElement` shifts it with the bar), so the line tracks a measure
  that only moved.
- `HighlightController.applyDynamicAnchorLine()` draws the dashed `<line>` (pointer-events none,
  cleared by the next render), wired into `RenderController` next to the dynamic highlight.
- Only the **single-click** selection draws it (a Shift-box of many dynamics would fan out lines).

Style is deliberately provisional (blue `#2563EB`, **dotted** — `stroke-dasharray 0.1 6` + round
linecap so each segment is a round dot — width 2, 75% opacity) — to be tweaked. Kept as its own
method so a future family of toggleable guides (rulers, markers…) has a place to grow.

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
