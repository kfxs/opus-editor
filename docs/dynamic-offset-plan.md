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
- `HighlightController.applyAnchorGuideLine()` draws the dashed `<line>` (pointer-events none,
  cleared by the next render), wired into `RenderController` next to the dynamic highlight.
- Only the **single-click** selection draws it (a Shift-box of many dynamics would fan out lines).

Style is deliberately provisional (blue `#2563EB`, **dotted** — `stroke-dasharray 0.1 6` + round
linecap so each segment is a round dot — width 2, 75% opacity) — to be tweaked. Kept as its own
method so a future family of toggleable guides (rulers, markers…) has a place to grow.

### ⭐⭐ AMENDED 2026-08-17 — where it leaves the MARK, and who else may draw one

Three of his reports in one sitting, and the third is the general rule:

1. **It leaves the mark's BEGINNING, not its end.** *"The line starts in the x axis at the end of the
   expression… change that point to the beginning of the expression."* It was the box's top-RIGHT
   corner; on an expression WORD that sent the guide back across the whole word to reach a note
   sitting near its start.
2. 🚨 **And it leaves the INK, not the box.** *"For dynamic letters there is too much air, so it is
   an empty space; somehow the anchor line should be measuring ink and not bbox."* The registry box's
   top is `DYNAMIC_GLYPH_INK_ABOVE` = `0.68 × the glyph size` — **one fraction for every letter** —
   while Bravura's real reaches are `f` 1.776 sp and `p` 1.096 sp. So the guide began ~9 px above
   anything drawn over a `p`. The point is now measured per letter off the font
   (`engine/rendering/dynamicMarkInk.ts` → `engine/fonts`), captured at render as
   `ElementInfo.guideFrom`, and it is the ink corner **nearest the staff** — top for a mark below,
   bottom for one above — so the guide never crosses the letter it points at.
   ⛔ **The BOX deliberately keeps the constant**: it is the hit-box, the text-overlay's placement and
   the dynamics line's clearance at once, and a row of marks reads as a row by sharing ONE height.
   ⚠️ `guideFrom` is absent for PROSE (Bravura cannot speak for a serif word) and the box is used —
   right there anyway, since a text box's top is about its cap height.
   🚨 **`ElementRegistry.shiftById` must move it.** It moved `bbox` only, so the guide stayed at the
   raw VexFlow drop position while the mark travelled to the dynamics line — *"at this point the
   anchor line is completely broken"*. ⛔ It must NOT move `anchor`, which is a point on the NOTE.
   ⚠️ Invisible to jsdom (every mark sits at 0 there); the browser suite is what caught it.
3. **The guide is KIND-AGNOSTIC now.** *"What about the rest of the elements? The anchor line is not
   just for dynamic."* `applyDynamicAnchorLine` → `applyAnchorGuideLine`: it reads whatever is
   selected and draws if the render captured endpoints for it. **A second kind is two edits, neither
   in the guide** — the pass that draws the element captures `anchor` (+ `guideFrom`) into its
   registry entry, and the kind's row in `ELEMENT_SPECS` calls `applyAnchorGuideLine` from its
   `highlight`. Only `DynamicsLayout` supplies points today.

### ⭐ Kind 2 — the TEMPO mark (2026-08-17, his call the same day)

*"So we have anchor line for expression but not for tempo; let's apply it to tempo."* It cost exactly
the two edits the rule promises — `TempoLayout.drawTempoMarks` captures the pair, and the `tempo` row
in `ELEMENT_SPECS` calls `applyAnchorGuideLine` — and **nothing in the guide changed**.

What differs is what the two ends MEAN, and both differences are the point:

- ⭐⭐ **Its anchor is a PLACE IN TIME, not a note**: the mark's own {@link anchorX} (the bar's opening
  for a downbeat mark, the note at-or-after the beat for a later one) at the **staff's top line**.
  ⛔ Deliberately unlike the dynamic's, whose anchor is the NOTE — including its lowest notehead's y —
  so that guide tracks a pitch change. A tempo does not belong to a pitch, and following one up and
  down would say that it did. ⭐ It is also what MuseScore's generic `dragAnchorLines` does: the
  parent segment's x at the staff's near edge.
- **Its near end is the ink's BOTTOM-left**, because a tempo is engraved ABOVE the staff. That is why
  the rule is *the ink corner NEAREST THE STAFF* rather than *the top* — one sentence covering both
  kinds and every kind after them.
- ⚠️ **From the tight extents, not the font table.** A tempo mark is mostly PROSE in a serif face and
  `dynamicMarkInk` answers `null` for exactly that; `TEMPO_INK_BELOW` is the descender depth
  `tempoStyle` already states. The font table is for glyphs, and a mark that is mostly words does not
  need it.

Both kinds' endpoints are measured in `e2e/anchorGuide.e2e.ts` — including the invariant that caught
the `shiftById` defect above (the near end must stay INSIDE its element's box, however far the pass
moved the mark).

### ⭐ Kind 3 — the TRILL (2026-08-17)

Two edits again, and the interesting part is that it lands on the *other* side of the split kind 2
opened:

- ⭐⭐ **Its anchor is a NOTE, like the dynamic's and unlike the tempo mark's** — and here that is
  not a matter of taste. A trill is DEFINED by its note: the auxiliary it alternates with is a step
  above THAT pitch (`utils/trillPitch`), so a guide ending on a staff line would point away from the
  thing the ornament is computed from. The point is the trilled notehead FACING the sign — the
  topmost of a chord for a trill above the staff, the lowest for a `below` one — at the span's own
  start x, which is the notehead's left edge the sign is already aligned to (§1 rule 4).
- **Its near end is the sign's ink corner nearest the staff**: the bottom for an above-staff trill,
  the top for a below one. Same sentence as the other two kinds.
- ⚠️ **On the FIRST fragment only.** A trill registers one entry per system fragment, all under one
  id, and `getById` answers with the first — which is the fragment holding the start note. A
  continuation `(tr)` on a later system is a REMINDER, not a second attachment, so giving it a guide
  would be a second answer to a question that has one.
- ⚠️ `undefined` when the start note was not drawn (its bar culled, the lane empty): the entry then
  carries no guide at all. ⛔ A guide is never a guess.

### ⭐ Kind 4 — the HAIRPIN (2026-08-17), and why the pair became a LIST

A hairpin is the first SPAN to draw a guide, and a span has two ends — so `anchor` + `guideFrom`
became **`guides: GuideLine[]`**, one `{ from, to }` per line. The three existing kinds each register
a single-element array; nothing about them changed. The roles are what the list makes explicit and
what the handlers turn on: `from` is ON the element (it travels with it), `to` is on something else
(it must not).

- ⛔ **ONE line, at the BEGINNING — his call**, where MuseScore draws one per END
  (`LineSegment::gripAnchorLines` returns two). A wedge's extent is already visible as ink, so what
  the guide adds is where the gesture is ANCHORED. ⛔ Do not add the end line "for symmetry": it was
  considered and declined.
- Its own end is the wedge's LEFT END on the side facing the staff (the upper arm — a hairpin lives
  below). ⚠️ For a CRESCENDO that end is the closed tip, so it sits mid-box vertically: the entry's
  box height is the OPEN end's aperture, which is at the other end of the wedge entirely.
- Its far end is a PLACE — the staff's bottom line at the start beat — like the tempo mark's and
  unlike the trill's. The rule that decides which: **is the element defined by a NOTE, or does it
  govern a REGION?** A trill's auxiliary comes from its note's pitch; a hairpin and a tempo mark
  apply to whatever is in their span.
- ⚠️ On the FIRST fragment only, and the drawer now reads **every entry registered under the id**
  rather than the first — a span is registered per system fragment, and each fragment's coordinates
  belong to its own system.

### ⭐ Kind 5 — the OTTAVA (2026-08-17)

The second span, and the first guide whose SIDE is decided by the model rather than by the family:

- **Its far end is a PLACE** — like the hairpin's and the tempo mark's. An octave line is a
  clef-shaped statement (§4 of `docs/ottava-plan.md`): it governs a REGION, every voice and every
  note in it, including notes typed into it afterwards, so there is no one note it belongs to.
- ⭐ **The side follows the SHIFT**, as everything else about this bracket does. An 8va hangs above,
  so its guide runs DOWN to the staff's TOP line; an 8vb runs UP to the BOTTOM one. The numeral's own
  end is its ink corner facing that same line, so the line never crosses the glyph it leaves.
- Beginning only, first fragment only — the hairpin's rule and its reasons.

⭐ **Five kinds, and the mechanism has not changed since the hairpin made it a list.** The only
question a new kind answers is the one this table states: a NOTE or a PLACE.

| kind | its far end | why |
|---|---|---|
| dynamic | the anchor NOTE (lowest notehead) | the mark belongs to that note; the guide follows a pitch change |
| trill | the trilled NOTE (notehead facing the sign) | the auxiliary is computed from that pitch |
| tempo | a PLACE: the mark's own x at the staff's top line | it governs the clock, not a pitch |
| hairpin | a PLACE: the start beat at the staff's bottom line | it governs a region |
| ottava | a PLACE: the start beat at the staff line on its own side | it governs a region, and the side is the shift's |
| pedal | a PLACE: the start beat at the staff's bottom line | it governs a region — every voice, every note struck while the damper is down |

### ⭐ Kind 6 — the PEDAL (2026-08-17): the family is complete

Nothing new in the mechanism; two details particular to this family:

- **It rides the `Ped.`, not the lift** — the sign the gesture BEGINS with, which is the same "at the
  beginning" rule the hairpin and the ottava follow.
- ⚠️ **A pedal registers one entry per GLYPH, not per fragment** (`Ped.` and `✻` are separately
  clickable, because there is no ink between them and a box spanning both would steal every press
  over the music inside). So the guide is attached to the FIRST fragment's `Ped.` and the other
  entries carry none — which the drawer already handles, since it reads every entry under the id.

### 🚨 The checklist a new COORDINATE field on `ElementInfo` has to answer

`guideFrom` needed all three of these, and each was found by a different means — worth writing down
because the next coordinate field will need them too:

1. **`offsetElement`** — a bar that moves takes its points with it (P5.4b).
2. **`shiftById`** — an element that is translated after registration takes ITS OWN points with it,
   but not the ones on other objects. ⛔ `anchor` must NOT move; `guideFrom` must. *(Found by the
   browser test — his report was "completely broken".)*
3. **`scaleElement`** — a reduced staff registers in its own scaled space, so every coordinate is
   multiplied by `k`. *(Found by reading, while adding the trill; it would have shown only on a
   small staff — the bug class `docs/staff-size-plan.md` calls "visual coords in a scaled scope".)*

#### 🚨 THE AUDIT — run 2026-08-17, and it found one field that is already wrong

His call: *"write the bug somewhere in the documentation, we have to go and analyze this."* So every
coordinate-bearing field on `ElementInfo` was checked against the three handlers:

| field | `offsetElement` | `scaleElement` | `shiftById` |
|---|---|---|---|
| `bbox` | ✅ | ✅ | ✅ |
| `headX` | ✅ | ✅ | — (never a dynamic's) |
| `points` | ✅ | ✅ | — |
| `controlPoints` | ✅ | ✅ | — |
| `slurEndpoints` | ✅ | ✅ | — |
| `tupletGeometry` | ✅ | ✅ | — |
| `guides` | ✅ | ✅ | ✅ (`from` ends only) |
| `segmentEndpoints` | ✅ *(fixed 2026-08-17)* | ✅ *(fixed 2026-08-17)* | — |

⚠️ **`shiftById`'s dashes are not holes**: it exists for marks that are translated AFTER being
registered, which today is dynamics only — a slur has no post-registration transform. Adding a field
there is only required when some pass moves an element carrying it.

🚨 **`segmentEndpoints` was a real gap — FIXED 2026-08-17, his call.** It holds `{ p0, p1 }` in
pixels, is written by `SlurRenderer` for each segment of a CROSS-SYSTEM slur (`SlurRenderer.ts:660`)
and read by `HighlightController` to place and drag that segment's round handles — while its own
sibling `slurEndpoints` (the same shape, for a same-line arc) was in both functions. The symptoms it
had: a cross-system slur's segment handles at **full-size coordinates on a reduced staff**, and
**stale after a bar was translated** rather than re-engraved (P5.4b). Both blocks now mirror
`slurEndpoints`', `direction` carried across untouched because it is a SIGN and not a length.

⚠️⚠️ **AND THERE WAS ALREADY A GUARD THAT SHOULD HAVE CAUGHT IT.**
`VexFlowRenderer.incrementalRedraw.test.ts` compares a translated bar against a freshly drawn one
**element for element** — exactly the shape of check this needed. It never fired because its fixture
renders in **linear** view: one system, therefore no cross-system slur, therefore no entry in it has
ever carried a `segmentEndpoints`. ⭐ **A whole-object comparison is only as total as the fixture
feeding it** — the same lesson as "a test can pass by luck of geometry", one level up. So the fix
came with `src/engine/ElementRegistry.coordinates.test.ts`, which tests the two pure functions
directly off a fixture built to carry **every** coordinate field at once, and which was break-tested
(both new blocks disabled → two assertions red).

⭐ The general lesson is the one this table exists for: **a coordinate on a registry entry is not
finished when it is written** — three separate functions have to be taught about it, and nothing in
the type system says so. The executable half of the checklist is now that fixture; add a field to it
first.

### What MuseScore does (read from its C++, 2026-08-17)

⭐ **It never picks a bbox corner** — `EngravingItem::genericDragAnchorLines`
(`engravingitem.cpp:2341-2368`) takes the element's `canvasPos()`, its ORIGIN, and layout has already
put that origin ON the ink: `xAdj = leftMargin - textBlock.boundingRect().left()` moves ink-left to
x = 0 (`textlayout.cpp:221`), the dynamics align is `BASELINE` (`styledef.cpp:1180`), and a dynamic's
shape comes from the SMuFL outline with cutouts rather than a font line box (`textlayout.cpp:376-383`).
They need no anti-air trick because there is no air. ⚠️ We cannot renormalise our origin (VexFlow
places the mark), which is why we derive the ink from the metrics table instead — the same answer
from the other side. Their glyph boxes are read from the font **on the fly** and cached per symbol
(`engravingfont.cpp:853`); ours is a table generated from the shipped OTF, keyed by the seven
dynamics LETTERS because that is what a level is stored as.

⏭️ **For the other kinds, when they come**, their dispatch is worth copying:

| MuseScore class | its anchor line connects |
|---|---|
| `EngravingItem` (the generic helper) | element origin ↔ the **segment's x at the staff's near line** (top, or bottom when placed below) |
| `TextBase` (Dynamic, Expression, Tempo, Lyrics, Fingering, Harmony — none override) | the generic one; a bbox corner is added only for frame/page texts |
| `Articulation`, `Fermata` | the **parent chord's** origin, not the staff |
| `LineSegment` (hairpin, ottava, pedal, trill) | **two** lines, one per end, PER SEGMENT, with system-clamped ends across a break |
| `SlurTieSegment` | grips only (start/end) |

⚠️ And one deliberate divergence: MuseScore draws these **only while dragging or grip-editing**
(`notationinteraction.cpp:1211-1220`), never on a plain click-selection. We draw on selection.

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
