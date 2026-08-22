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

## ⭐⭐ The other half: RE-ANCHOR — `Ctrl+Shift+←/→` (his ask, 2026-08-18)

Everything above moves the mark's **ink**. What a dynamic did not have — alone among the families on
the dynamics line — was the **music** half of the standing pair: *plain / `Ctrl` arrow = the INK,
`Ctrl+Shift`+arrow = the MUSIC*. The wedge, the bracket, the pedal and the trill all read the harder
chord as "move this end through the music"; this makes the letters say it too, one **slot** per
press.

**The step is the pedal's, not the slur's.** A `Dynamic` is anchored positionally — `{measure, beat,
voice, staffId}`, no note id — so there is nothing to "re-point at another notehead": the walk visits
the onsets of the mark's own lane (its **voice**, on its staff — the hairpin's rule, since a dynamic
governs a stream, where a pedal walks the whole staff because there is one damper).

**A dynamic is a POINT, so the walk needs an ORDER, not a timeline.** The three span families each
keep a private `measureStartOffsets` because they hold a start *plus an amount* and have to hold one
end still. Nothing here does, so `dynamicOps` compares `(measure number, beat)` — the score's own
reading order — and there is no fourth copy of the capacity arithmetic.

**Crossing a barline moves the mark between the two bars' lists**, same object, same id
(`moveDynamicToMeasure`), because "the dynamics of measure N" *is* the storage. `ScoreModel.
updateDynamic` cannot express that — it only reassigns fields inside whichever measure already holds
the id — which is why this is an op and not a `{ beat }` update.

**⭐⭐ And the step CLEARS the mark's own `dynamicOffset`** (his call) — `slurOps.setSlurEndpoint`'s
rule for its reason verbatim: anchor-relative storage makes an offset *transferable*, not *wanted*.
It was tuned to clear the stem and ledgers of the note it used to sit under, and a re-anchor is the
user saying "not that note".

**⚠️ It writes the MODEL and is audible** — the level applies from the beat it writes — where the
plain and `Ctrl` arrows on the same selection write an override that playback cannot hear. Two
chords, two categories, one selection; §4 of the hairpin plan is the same argument.

Where it lives: `engine/models/dynamicOps.ts` (`moveDynamicBySlot`) → `ScoreModel.moveDynamicBySlot`
→ `MusicEngine.moveDynamicBySlot` (one `commit`) → `reanchorSelectedDynamic` in `shortcutWiring`,
chained ahead of the note offset on `ctrlShiftArrow…`. It DECLINES at either end of the lane, so the
chord still falls through to the note offset. Tests: `dynamicOps.test.ts` (the walk, the re-file, the
clear) and `shortcutWiring.dynamicReanchor.test.ts` (the routing, and that the ink chords never reach
it).

---

## ⭐⭐ The interpolating WALK — ←/→ and Ctrl+←/→ carry the anchor (2026-08-19)

His ask: *"we recently use in the slur a walk with arrow / ctrl arrow that allows interpolate between
offset and reanchor… i want to do something similar with the expression (dynamic)"*. Before it, the
two halves of moving a dynamic sideways were two unrelated gestures — the ink chord slid the mark
arbitrarily far from the note it claimed to hang off, and the music chord jumped a whole slot with
the ink snapping to wherever the engraver puts it. Neither could say "this `f` belongs a little to
the left of that note over there" as one continuous motion.

**The identity** (`interactions/dynamicWalk.ts`, `slurEndpointWalk`'s sentence for sentence): a drawn
mark is `base(anchor) + offset`, so a press may spend its step on either term.

```
  offset + step  <  gap   →  keep the anchor, offset += step        (the ordinary ink nudge)
  offset + step  ≥  gap   →  anchor := next slot, offset += step − gap
```

`gap` is the distance between the two slots' drawn **noteheads**, in staff-spaces. Both branches move
the drawn mark by exactly one step, so **the crossing is invisible** — which is the whole point.

- ⭐⭐ **What differs from the slur is only what an anchor IS.** A dynamic is anchored positionally, so
  the stop it walks onto is a SLOT of its own lane — `dynamicOps.nextDynamicSlot`, split out of
  `moveDynamicBySlot` so the arrows and `Ctrl+Shift`+arrow can never land the mark on different notes.
- ⭐⭐ **`setDynamicAtSlotKeepingOffset`** exists because the crossing must be invisible: the ordinary
  re-anchor's clear (above) is right for "not that note" and wrong for a ¼-space press that happens
  to step over a notehead. One private `placeDynamic`; the two exports differ by one line.
- ⭐ **ARRIVAL, not midpoint**, his call on the slur — the mark can be parked anywhere in the gap
  without changing the beat it applies from, which playback reads.
- ⭐ **The gap is measured, never guessed**: `registerDynamics` now carries the drawn mark's
  `staffSpacePx` into the registry, and with no drawn mark there is no crossing (a small staff beside
  a normal one is a ratio, so a guessed scale would re-base by the wrong distance, quietly).
  The slot x's come from `dynamicDrag.dynamicLaneHeads`, shared so the two doors agree on where a
  slot is drawn.
- 🚨 **It will not walk across a system break** — a gap whose sign disagrees with the travel is
  refused, and the press stays a plain nudge. `Ctrl+Shift+←/→` is the gesture that crosses one.
- ⛔ **The vertical is not in it.** ↑/↓ stay a pure offset: a dynamic's lane runs sideways.
- A crossing press is ONE undo entry (`runBatch`) — the re-anchor and the re-base are two halves of
  one press.

Where it lives: `dynamicOps.nextDynamicSlot` + `setDynamicAtSlotKeepingOffset` → `ScoreModel` →
`MusicEngine.moveDynamicToSlotKeepingOffset` / `nextDynamicSlot` → `interactions/dynamicWalk.ts` →
the horizontal branch of `nudgeSelectedDynamic` in `shortcutWiring`. Tests: `dynamicWalk.test.ts`
(the arithmetic, over a fabricated render — jsdom draws nothing) and `dynamicOps.test.ts`.

### ⭐⭐ EXTRACTED, 2026-08-19 — the walk is now shared with the tempo mark

Everything below still describes what the dynamic does; where it LIVES changed when the tempo mark
asked for the same gesture. The arithmetic is `interactions/markWalk.ts` and the system rule is
`interactions/markSystemJump.ts`, each taking a per-mark PORT; `dynamicWalk` and `dynamicLane` keep
the dynamic's answers and nothing else. ⛔ A third mark writes a port, never a copy. The dynamic's
own tests passed untouched through both extractions, which is the evidence they moved nothing.

### The MOUSE, the same day

**The drag is now the same gesture** (`dragDynamic` + `MouseController.handleDynamicDrag`): one frame
converts the cursor's pixel delta with the drawn mark's own `staffSpacePx` and runs the very same
`carryDynamic`, with a preview writer — no undo per frame, `commitDynamicDrag` records the gesture
once on the drop. A drag and ten arrow presses covering the same ground leave the model in the same
state.

- ⛔ **No hold, no catch-up, no latch** (his call). The slur endpoint's drag has all three — snap-and-go
  (Baudisch, CHI 2005), hold sized on the gap AHEAD with the derived gain `1/(1−r)` — because an
  endpoint is *aimed* at a note and offset zero has to be reachable exactly. A dynamic is a label
  placed by eye: resistance would be a snag with nothing to arrive at.
- ⭐ **Both axes** (his ask): the horizontal walks the mark through the music, `dy` is a plain ink
  offset. ⭐ The lift SURVIVES a crossing here, where the slur's drag settles its y — a dynamic's lift
  answers to the dynamics LINE, not to one note's stem.
- ⭐ **A LOOP, because a drag frame is not a step**: one fast frame may cross several slots, and
  re-anchoring once per frame would leave the anchor trailing the cursor.
- ⚠️ The delta is measured from the last ACCEPTED frame (the hairpin body drag's rule), and the
  baseline is taken on the first frame PAST the time threshold — the travel that decided this was a
  drag rather than a click belongs to neither.
- ⭐⭐ **…and leaving the mark's own system is a JUMP, not a walk** (his report the same day: *"it does
  not catch other system"*). The walk refuses to cross a system break for a reason that will not go
  away — two systems' x's are not one ruler — so `dynamicLane.systemSlotFor` runs first, and when it
  answers, the mark lands on the slot of that system nearest the hand and the frame stops there.
  - ⭐⭐ **The limit is WHERE THE MARK WOULD LOOK AT HOME** — his call after trying the obvious one:
    *"crossing the stave is not a good limit… a more organic limit vertically"*. Crossing the
    pentagram is late (the mark must be dragged right onto the next staff) and lopsided (a dynamic
    hangs BELOW its staff, so the staff above is much further off than the one below). Instead:
    measure the mark's NATURAL distance from its own staff — its drawn ink with its own lift taken
    back out — and read that same distance from every other staff as "where it would sit there". The
    mark belongs to the nearest of those, so **the switch falls exactly halfway between where it sits
    and where it would sit**. ⭐ No constant anywhere in it: the gap is measured every frame (it
    contains whatever the ladder granted this mark) and the staves are the painted ones. ⭐ It mirrors
    itself for an `above` mark by measuring off the staff's TOP line.
  - 🚨 **The lift MUST come back out first.** Left in, the mark's "natural" home follows it down for
    ever and the switch never arrives — which is the picture he reported: `y: 44.86` and a guide line
    stretching over three staves.
  - ⭐⭐ **A jump lands the mark where the ENGRAVER would put it**: the offset goes, both axes. On this
    gesture the `y` is not a lift, it is the distance the hand travelled to reach the other system.
  - ⭐ It needs no travel history, unlike a crossing test: a frame taller than a whole system is judged
    by where it ENDED, so a fast hand cannot fly over a staff.
- ⭐ **Gone with it**: `elements/dynamicDrag.ts` — `dynamicDragTargetAt`, its row window and its
  150 px snap. What survives is in `interactions/dynamicLane.ts`: where a lane's slots were DRAWN
  (shared with the keyboard, so the two doors cannot disagree about where a slot is) and the staff
  crossing above. `MusicEngine.previewDynamicSlot` stayed, and is now reached only by a jump.

## ✅⭐⭐ THE WALK CROSSES A SYSTEM BREAK (2026-08-21, BUILT)

His ask: *"dynamic and tempo not [crossing] — probably we never implemented it but should be
implemented"*. Correct: `markWalk` refuses to cross a break by construction (two systems' x's are not
one ruler), and until now only the wedge, the bracket and the pedal had the wrap that answers it. The
dynamic now has it too — `markBreakWrap`'s, ⛔ ported rather than copied.

- `dynamicLane.dynamicSystemInkLimit` is the whole of what is dynamic-specific: **which staff** to
  ask about (the mark's own). The measuring and the naming are `systemInkAt`'s.
- ⭐ **It needed a RE-BASE the mark never had.** Until today the crossing's second half went through
  `nudgeDynamicOffset`, which is judged by the PAGE LIMIT — and a refused re-base leaves the anchor
  ahead of the ink so the next press crosses again, the runaway `rebaseHairpinEndpointOffset` carries
  the report for. `MusicEngine.rebaseDynamicOffset` (+ `previewDynamicOffsetRebase` for the drag)
  closes that latent hole whether or not a break is involved.
- ⭐ A blocked press still crosses (`markWalk.crossWithoutArrival`) — the page's edge can refuse the
  ink a space short of the line's end, which is precisely where the wrap is needed.

⏭️ The DRAG's horizontal wrap is not wired (the drag still has only its vertical staff-jump).

## ✅⭐⭐ THE DRAG LANDS ON THE OTHER HAND (2026-08-21, BUILT)

His report, with a grand-staff score: *"this is good for single stave system but look what happen
with multistave system… we are avoiding the other staves of the system so the dynamic just land in
the next system, but this is not wanted cause the user want to place elements vertically, so when
dragging vertically we should be aware of the other staves so the dynamic can also land there."*
The log he sent says it exactly — `[Dynamic] jumped to the staff it crossed → m11`, four bars past
the left hand it was dragged over.

### ⭐⭐ The rule did not change — it never had a candidate to pick

`markSystemJump.systemStopFor` has always chosen between **painted staves** (`staffBands()`), and
the other staff of the same system was in the running from the first day. What it then asks for is a
CANDIDATE on that staff, and `dynamicLaneHeads` answers with the mark's OWN LANE — so the left hand's
band won the vertical question and lost the horizontal one for want of anything to anchor to, and the
drag carried on until it reached a staff that did have candidates: the next system's.

⭐ So this is one line of the port and one write in the model, not a new geometry rule:

- `dynamicLane.dynamicStaffLaneHeads` — every slot of **every** painted staff, each head naming the
  staff it stands on. `systemSlotFor` hands the shared rule this instead of the mark's own lane.
  ⛔ The sideways WALK is untouched and stays in its lane: a lane is what "the next slot" is counted
  along, and the vertical is the only axis on which a staff is a place.
- `dynamicOps.setDynamicAtStaffSlot` — `setDynamicAtSlot` plus the one field that was never movable.
  The landing slot is looked for on the TARGET staff (`laneStopsOnStaff`), because that staff is not
  the mark's yet. `MusicEngine.previewDynamicSlot` now takes this target; it had exactly one caller,
  the jump.

### Settled decisions

- ⭐⭐ **The VOICE SCOPE survives the move.** Scope and position are orthogonal — `utils/dynamicScope`:
  *where the mark may stand is a STAFF question, and never a voice one* — so a mark narrowed with
  `Alt+1…5` lands narrowed, to the staff it landed on. ⛔ Resetting it would let a drag quietly
  re-state something the user said with a different gesture.
- ⚠️ **The first staff is stored ABSENT**, whichever spelling reaches the op: an absent `staffId` and
  the first staff's real id are one staff, and two spellings of one state is the bug
  (`MusicEngine.staffIdForIndex`, the emptied-`dynamics`-array rule). Resolved twice over — in
  `dynamicLane` where the head is built (`keyStaffId`) and again in the model, so no caller can get
  it wrong.
- ⚠️ **A frame that changes neither staff nor address is refused**, as the address-only write already
  was — a drag asks on every mouse move, and a caller that repainted on a true would repaint on all
  of them. ⭐ The staff is half of that test, so dragging straight DOWN onto the same beat of the
  other hand is a real move, not a no-op.
- ⭐ **A jump still lands the mark where the engraver would put it**: the sideways nudge goes with any
  re-anchor, and the lift is cleared by the caller because on this gesture it is not a lift at all —
  it is the distance the hand travelled to reach the other staff.
- 🚨 **A candidate's band is its STAFF's, not its notehead's.** `dynamicLaneHeads.y` is now the middle
  of the staff the slot was drawn on. A head on ledger lines can sit nearer the neighbouring staff's
  band than its own, which was harmless while every candidate came from one staff and is a wrong
  answer the moment they do not — a bass-clef `b4` would have offered itself as a right-hand landing.

### ⏭️ The siblings have the same gap

The hairpin, the ottava, the pedal and the trill all port into the same rule with per-staff
candidates (`hairpinLane` / `ottavaLane` / `pedalLane` / `trillLane`), so each of them still sails
past the other hand of a grand staff. Each needs the same two pieces — all-staff candidates and a
model write that moves its `staffId` — and none of them is done. ⚠️ The trill is the odd one: it
anchors to a NOTE, so its staff follows the note it lands on and it needs no `staffId` write at all.

---

## ✅ THE DRAG IS PREVIEWED (2026-08-22)

docs/render-performance-plan.md §12.5a — a mark drag now redraws one FAMILY against the last full
render instead of re-deriving the score. The dynamic joined the table the day after the tempo did,
and it is the tempo's shape: a MOVED family, since its letters are an `Annotation` attached to the
anchor note, drawn *inside its bar's group*, and repositioned by one composed transform.

- ⭐ `rendering/dynamicNudgePass` (new) — the composer's nudge, re-applied by id. Its only other
  writer is inside the bar draw a preview skips.
- `rendering/dynamicsLinePass` — the LINE, re-planned (⛔ never a captured plan) and re-applied.

### 🚨 The nudge had to be SPLIT OUT of the co-located row's shift

`dynamicMarkTransform` kept `data-dyn-shift` as *the row's x plus the hand nudge*, and inside the bar
draw the two are indistinguishable — the element is new, so adding is setting. A preview is what tells
them apart: it re-applies the nudge to a mark nobody re-engraved, and **there is no way to SET half of
a sum**. `data-dyn-nudge` is now its own component, `setDynamicMarkNudge` sets it, and
`shiftDynamicMark` still adds because the row genuinely composes with it.

### 🚨🚨 A re-anchor REFUSES — and so does a jump to the other hand

The annotation hangs off a `StaveNote` inside a measure group, so neither a walk onto the next slot
nor a landing on the other staff is something a transform can express. `registerDynamics` stamps
`data-dyn-at="<bar>:<beat>:<staffId>"` and the row's vouch compares it; a mismatch renders for real.
⭐ The STAFF is part of the address on purpose — a dragged dynamic lands on the other hand (this doc,
above), which is another measure group entirely.

### ⭐⭐ The wedges come with the letters

His report: *"when the dynamic overlaps a hairpin, it modifies it… the render of the hairpin is
behind"*. A hairpin is a member of this family — same plan, and it breaks around a letter it runs into
(docs/dynamics-line-and-hairpins-plan.md P3) — so the frame that moves a letter takes the wedges down
and draws them again, in one plan over one rewind point. ⛔ Not two previews in sequence; see the perf
plan for why that is a different and broken thing.

### Tests

`markPreviewPass.test.ts` — a pure-offset frame previews (the nudge arrives, the row and the centring
anchor survive), running it twice is the same picture (the nudge is SET), the wedges are still there
after the frame and after five, and a re-anchor refuses. All break-tested.
