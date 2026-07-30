# Staff size — a staff is drawn at a size, and it is not the same size for every staff

**Status: EVERY PHASE BUILT EXCEPT P3** (2026-07-29) — P0, P1, P2, P4, P5, P6. The value, the
resolver, the renamed constant, the dev button, the per-staff vertical stride, **the transform**,
**everything drawn outside a bar's group**, and the constants sweep. A small staff is drawn small,
with its ties, slurs, beams, connector and ghost.

⚠️ **P3 — the horizontal room (§6) — was skipped and is the one thing left.** A small staff's music
is still *spaced* for a full-size staff, so it reads as stretched, and §7's `laneFingerprint` +
`layoutStateKey` are owed with it (`measureShapeKey` landed in P4 — see the P2 note). The other open
item is smaller: the **marking-tool ghosts** still preview at full size over a small staff (see P5).

The review that produced the plan: the model was already proportional (staff-spaces, pixel-free),
the **rendering** was not.

> **Revised 2026-07-29** against the codebase and VexFlow 5's own source. The model half (§2, §3)
> and the vertical stride (§5) stood. The rendering half did not: `ctx.scale` is **not** a transform
> in VexFlow's SVG backend (§4), the horizontal half of the room was missing entirely (§6), and two
> memos will answer *clean* to a size change and never redraw (§7). Everything below is now cited to
> the line that proves it.

The picture this is for: a violin part above a piano part, the violin engraved small and the piano
full size, on the same system. When this was written every staff in the editor was exactly one size,
and roughly thirty numbers quietly encoded that.

> **§1-§7 below are the REVIEW, kept as written** — the diagnosis, in the present tense of the day it
> was made. Where a phase has since changed the thing it describes, the phase says so. The one place
> to look for what is true *now* is the status line above and §8's phases.

---

## 1. The defect, named

`VEXFLOW_DEFAULT_STAFF_SPACE_PX = 10` (`engravingOverrides.ts:455`) has 16 production references,
nearly all of them `staffSpaces × 10`. The name says it is VexFlow's default. It is not: it is **the
score's staff size**, written as a constant, and it is what has to stop being one.
*(P0 renamed it `STAFF_SPACE_PX` and moved it to `engine/models/staffSize.ts`.)*

⭐ Two of the sixteen are already right, and they are the shape the rest should end up in:
`measuredRoom.ts:83` and `:121` read `geometry?.lineSpacing ?? VEXFLOW_DEFAULT_STAFF_SPACE_PX` — the
staff's own spacing, with the constant only as a fallback for "no geometry yet". The registry has
carried a per-staff `lineSpacing` since multi-staff (`ElementRegistry.ts:132`); it has simply never
been given a value other than 10.

Around it, `LAYOUT_CONFIG` is eight absolute pixels that are all secretly staff-spaces at that size
— `MIN_NOTE_SPACING` 18 (1.8 sp; ⚠️ DELETED 2026-07-30, the spacing model's `MIN_COLUMN_GAP` is
1.43 sp and the same question), `CLEF_WIDTH` 45 (4.5 sp), `TIME_SIG_WIDTH` 30, `BARLINE_PADDING`
10, `STAVE_HEIGHT` 120 (12 sp), `VERTICAL_SPACING` 30. Plus ~20 loose px constants that are ink
(`LEDGER_ACCIDENTAL_GAP`, `CURVE_THICKNESS`, the `beamInk` four, `DynamicsLayout`'s `GAP`, the
dynamic/tuplet/tempo font sizes).

⭐ **The rule that sorts them is INK vs FINGER**, not "px is bad". `STEM_CLICK_PAD` 5,
`ENSURE_VISIBLE_PADDING`, `VIEWPORT_*`, the gutter chrome and `PAGE_GAP_PX` are *correctly* pixels —
a fingertip and a window do not shrink with the staff. Ink does. Today both kinds live in the same
objects under the same naming, which is exactly why nobody noticed.

## 2. ⛔ It is not a boolean, and it is not "small"

The value is a **ratio**: `1` is full size, `0.7` is a small staff, and every number in between is
legal because the user will want them. A `small: true` flag would be the whole feature's ceiling
written into the model on day one.

```ts
// types/music.ts — StaffInfo is `{ id }` today
export interface StaffInfo {
  id: string
  /** How big this staff is drawn, as a ratio of the score's staff size. Absent = 1. */
  size?: number
}
```

Absent means 1 by **rule**, not by a stored default — same as every other "absent" in this codebase.

**Why on the staff, and not in an engraving object:** principle 6's test is *can it vary at a point
in the score?* Staff size varies per staff, and (later) per system. So it is positional and belongs
to the thing it varies at. It is **not** a document-wide look setting, so it does not touch the open
boundary case in `DESIGN-PRINCIPLES.md` and does not need it settled first.

⛔ **It is not on the surface.** A canvas has no millimetres but it still has a staff size — a small
violin staff must render correctly with no page in sight. Size is representation; paper is layout.
The two meet only at export.

## 3. Per-system later, without pain — write the parameter now

The whole "don't make it hurt later" answer is one function signature, copied from a shape that
already exists here (`resolveStaffSpacingAbove`):

```ts
resolveStaffSize(score, staffId, openingMeasureId?: string): number
```

Today it ignores `openingMeasureId` and returns `staff.size ?? 1`. The day per-system size arrives,
a `staffSystemSizeKey(staffId, openingMeasureId)` engraving override is consulted **in front of**
that fallback and **nothing else in the codebase changes** — because every caller already passes the
opener. That is precisely how per-system staff *spacing* was added, and the renderer already computes
`openingMeasureId` per line in `staffSpacingLayout`.

⭐ So: build the resolver with three parameters and use two. That is the entire cost of not being
trapped later.

## 4. The rendering — VexFlow has no per-stave scale

Measured, not assumed (VexFlow 5.0.0):

- Glyph size comes from a **global** `Metrics.fontSize` (`metrics.js:63` — 30 ⇒ 30pt × 4/3 = 40 px
  em ⇒ SMuFL's 4-staff-space em ⇒ 10 px/space). `Tables.STAVE_LINE_DISTANCE = 10` (`tables.js:647`)
  is a **second, independent** global. They agree by coincidence; nothing enforces it.
- `Stave` accepts `spacingBetweenLinesPx`, but it only moves the **lines** (`stave.js:51, 65, 72`).
  Noteheads, clefs, rests and accidentals keep the global font size — a squashed staff with
  full-size glyphs.
- Worse, VexFlow's own placement reads the **global** `STAVE_LINE_DISTANCE` rather than the stave's
  own spacing in `tuplet.js` (6 sites), `annotation.js` (5), `stavenote.js` (2), `stringnumber.js`
  (2), `articulation.js`, `ornament.js`, `vibrato.js`, `frethandfinger.js` — while thirteen other
  modules ask the stave. The library is split down the middle on the question, so per-stave spacing
  is only ever partly honoured.
- `Tables.STEM_HEIGHT` 35 and `STEM_WIDTH` 1.5 are global px.
- VexFlow's only built-in "smaller" is a global per-category `fontScale` (`GraceNote: 2/3`) and
  `Clef` `size: 'small'`. Category-wide, never per-stave.

⛔ So `spacingBetweenLinesPx` is **not** the mechanism. The mechanism is **one transform over the
ink**: the stave built at `x/k, y/k, width/k` inside a group that carries `scale(k)`. Everything —
lines, glyphs, stems, beams — scales together, because it is one transform.

### 4.1 ⛔ It is a GROUP transform, not `ctx.scale`

`ctx.scale(k, k)` is the obvious spelling and it is wrong. `SVGContext.scale()`
(`svgcontext.js:146-153`) does not transform subsequent drawing at all: it multiplies
`state.scaleX/scaleY` and rewrites the **viewBox** — which rescales the entire SVG, including every
staff already drawn. There is no per-draw scope to it, and `save()`/`restore()` do not give it one:
they clone `state` and `attributes` and never re-apply the viewBox. `GutterRenderer.ts:86` uses
`ctx.scale` correctly, and that is the tell — the gutter is a separate SVG at a whole zoom.

⭐ **The right spelling is a `transform` attribute on a `<g>`** — what VexFlow itself does for
rotation (`svgcontext.js:86`, `openRotation` = `openGroup()` plus a transform), and what this
codebase already does in `GhostRenderer`, `DynamicsLayout:118` and `replaySnapshot`. **And the group
already exists at exactly the right granularity**: `VexFlowRenderer.ts:1537` opens
`openGroup('measure', measureGroupKey(measureNumber, staffIndex))` — one group per measure **per
staff**. Set its transform, build its stave at `x/k, y/k, width/k`, and that staff's bar is small.

⚠️ **`replaySnapshot` overwrites that attribute**, and this is the trap that would be found late.
`VexFlowRenderer.ts:3539` writes `transform = translate(dx, dy)` on a group it is moving rather than
redrawing, and `:3542` *removes* the attribute when the bar returns to where it was painted. A
scaled staff would snap to full size the first time a bar moves — so never in a fresh render, and
always mid-drag. Both branches must carry the scale: `translate(dx, dy) scale(k)`, translate first,
because `dx/dy` are measured in the parent's space.

### 4.2 The cost on the way back: reading geometry

Everything we read back from VexFlow after drawing — `getYForLine`, `getNoteStartX`,
`getAbsoluteX`, `getModifierStartXY`, `getBoundingBox` — answers in **pre-transform** coordinates.
A scaled staff would register hit-boxes in the wrong place.

⭐ **There is exactly one seam, and it already exists.** Every registration in the codebase funnels
through `ElementRegistry.add()` / `setStaffGeometry()` — 28 production `add` sites across 7 modules
plus 2 `setStaffGeometry` calls, both in `VexFlowRenderer`. Compose the staff's transform there
(`× k`, plus the staff origin) and every hit-box, every glyph rect and every staff geometry lands
right, with no call site touched. `StaffGeometry.lineSpacing` becomes `10 × k` in the same stroke,
which is what makes `measuredRoom`'s two fallbacks (§1) start telling the truth.

⚠️ **`getBBox()` is not the opposite problem — it is the same problem.** It answers in the element's
own user space and ignores ancestor transforms; `getBoundingClientRect()` / `getCTM()` are the
post-transform readers. So `DynamicsLayout` and `TempoLayout` read the same pre-transform space
VexFlow does, and the actual defect there is a **mixing** one: `DynamicsLayout.ts:101-118` derives
`dx/dy` from local `getBBox()` boxes and then shifts the **registry**'s bbox by that same `dx/dy`
(`:121-127`). Under a scale the registry box is global and the delta is local — off by exactly `k`.
`TempoLayout.ts:258` has the same shape.

⭐ The e2e harness composes the CTM already (`e2e/harness.ts:111`), so its readers report the
*post*-transform picture: the browser suite can measure a scaled staff directly, which is what makes
the readback risk testable rather than eyeballed.

### 4.3 What is drawn OUTSIDE the measure group

The registry is the one seam for **hit-boxes**. It is not the seam for **ink**, and the difference
is a second half of the work. Drawn at the SVG's top level, after the measure loop, from
coordinates read off the drawn (pre-transform) VexFlow objects:

| Pass | Site |
| --- | --- |
| cross-barline beams | `VexFlowRenderer.ts:3329` |
| cross-barline fan beams | `:3332` |
| ties | `:3335` (`renderTies`) |
| slurs | `:3338` (`renderSlurs`) |
| stave connectors | `:3316` |
| the note ghost | `:3346` |
| tempo marks | `TempoLayout.ts:250` (opens its own group) |

On a scaled staff each of these draws full-size in the wrong place. Each one knows which staff it
belongs to, so the fix is uniform — draw inside that staff's scale group, or map through it — but it
has to be *planned*, because on a single-size score every one of them looks perfect.

## 5. The vertical stride is the thing that breaks *pagination*

`staffSpacingLayout` computes `staffStride = STAVE_HEIGHT + VERTICAL_SPACING` — **one number for
every staff in every system** — and `pageCastOff` decides page breaks from it. A 0.7 staff in a
fixed 150 px slot is not merely ugly; the score paginates wrong.

This is independent of glyph scaling and can land first: the stride becomes per-staff
(`staff-lines × sizeₛ + clearance`), summed instead of multiplied. In the same function,
`acc += above * VEXFLOW_DEFAULT_STAFF_SPACE_PX` becomes `× that staff's space`.

⚠️ The stride is computed in **three** places, not one — `VexFlowRenderer.ts:2955` and `:3044`, and
`MusicEngine.ts:1656` (the minimum-spacing clamp) and `:3153`. All of them read the same two
`LAYOUT_CONFIG` constants, so all of them go per-staff together or the drag clamp fights the layout.

## 6. And the horizontal room, which is the half nobody looks at

A small staff needs less room *along* the line too, and the width path is per-lane already, which is
the good news: `MeasureLayout.ts:175-203` computes `noteSpaceForLane(lane, clef, cache)` for each
staff's own view of the bar and takes the **widest**. The bar's overhead (`CLEF_WIDTH`,
`TIME_SIG_WIDTH`, `BARLINE_PADDING`) is charged once, for the whole column.

So the small staff's lane must contribute `× sizeₛ`, and the overhead must be the widest staff's,
not a constant. Leave it out and the failure is quiet and double-ended: the 0.7 staff wins the `max`
with numbers it does not need, so every bar in the score is too wide — *and* inside its own scaled
group that lane gets `1/0.7` = 43% more musical room than it asked for, which reads as a small staff
that has been stretched. Neither looks like "the widths are wrong"; they look like bad spacing.

⭐ This is the same shape as §5 — a per-staff number that used to be one number — but it is a
different pass, and it is why the transform is not the last phase.

## 7. ⚠️ Two memos will answer *clean*, and nothing will redraw

The renderer does not redraw what it believes is unchanged, and **staff size is invisible to every
one of its keys** — it lives on `score.staves[i]`, and the keys hash measures.

- `laneFingerprint` (`MeasureWidthCache`) — "is this lane's width still good?" Hashes the lane's
  slots. A size change touches no slot ⇒ the memoized width comes back, at the old size.
- `measureShapeKey` (`MeasureRedrawKey.ts`) — "does this bar still *look* the same?" Same blindness
  ⇒ the drawn `<g>` is reused verbatim, and §4's transform is never applied to it.
- `layoutStateKey` (`VexFlowRenderer.ts:491`) — "may this render reuse the last casting-off?" Holds
  view mode, surface, justification, linear spacing. Size changes the casting-off (§5, §6) and is
  not in it.

All three need the sizes of the staves in play. `measureShapeKey` needs only *this* staff's size;
`layoutStateKey` needs all of them, and the natural spelling is the same sorted-entries list the
`linearStaffSpacing` map already uses beside it.

⭐ This is the trap `docs/render-performance-plan.md` §7a names in the abstract — *reuse the wrong
key and the picture silently rots*. Here it would land on P1's very first click: the stride moves,
the bars keep their old picture, and the button looks half-broken for a reason that is nowhere near
the button.

## 8. Phases

**P0 — the value and the resolver. ✅ BUILT.** `StaffInfo.size`, `resolveStaffSize(score, staffId,
opener?)`, JSON round-trip, a `ScoreModel` mutator. No rendering change. Rename
`VEXFLOW_DEFAULT_STAFF_SPACE_PX` to what it is (`STAFF_SPACE_PX`, the score's staff size) and move
it out of `engravingOverrides.ts` — it is a scale, not an authored tweak.

> Built as one module, `engine/models/staffSize.ts` (`STAFF_SPACE_PX` + `resolveStaffSize` +
> `setStaffSize` + `isValidStaffSize`), with `ScoreModel.setStaffSize` as the one-line delegator and
> a spec beside it. Two decisions the plan left open: **1 clears the field** (absent = full size, the
> `setStaffSpacing` idiom), and a size that is not a finite positive ratio is **reported, not
> repaired** — `setStaffSize` refuses it and `ScoreModel.fromJSON` throws beside `validateMeters`,
> so the resolver stays a clean `staff.size ?? 1` with no silent clamp. Nothing calls
> `resolveStaffSize` yet; P1's button is its first caller.

**P1 — the dev-shell button. ✅ BUILT.** Select a measure → resolve its staff → toggle that staff's
size between `1` and `0.7`. **Scaffolding, in `dev/`, deliberately crude** — it exists to exercise
the infrastructure while it is iterated on, not to be the UI. It writes a *number*; the two values
are the button's business, never the model's.

> `dev/staffSizeToggle.ts` (target / light / press) + a `Small` button in the toolbar's `Staff:`
> group, on the **plain-click box** — the same gesture and the same target as `+ Above` / `+ Below`
> beside it. `MusicEngine.setStaffSize(staffIndex, size)` is the one facade line, there for the one
> reason a write is ever on the facade: undo.
>
> ⚠️ Two things that were not free. The light is an **engine read**, so the toolbar needed its
> model subscription back (`onModelChange`, the shape `wireKeypadSync` uses) — a size write touches
> no top-level state field, so the observable Proxy never emits and a state-only toolbar lights one
> press behind. And the press repaints through `RenderController.renderScore`, which the shell did
> not have: the toolbar's every other button goes through the palette, which repaints itself.
>
> ⭐ **…and it is DISABLED until a bar is selected** (his report: *"Small should not be able to
> click if a staff (measure) is not selected"*). It was a no-op in that state — `staffSizeTarget`
> returns null and the press logged and returned — but a button that looks pressable and silently
> does nothing is worse than one that says so. It now takes the same `hasStaffContext` gate
> `+ Above` / `+ Below` have always had, through a new optional `isEnabled` on the toolbar's
> `toggle` helper: a toggle differs from an action in that its LIGHT is a question about the score,
> not in whether it can be pressed.
>
> ⭐ **Nothing looks different yet, and that is P1 finishing, not P1 failing** — the staff changes
> size in the model and the picture is identical until P2's stride (and the three keys in §7, which
> is why they land there and not later).

**P2 — the vertical stride per staff** (§5). **✅ BUILT.** Visible immediately with P1: a small
staff gets a small slot. Still no glyph scaling.

> `engine/layout/staffStride.ts` — `staveHeightPx` / `staffStridePx` / `minStaffStridePx` /
> `minSpacingAboveSpaces` / `spacingAbovePx` / `systemStaffTops`. All four inline copies of
> `STAVE_HEIGHT + VERTICAL_SPACING` are gone, and the size scales the STAFF, not the CLEARANCE.
>
> ⭐ **`cumPx` became `staffTopPx`** — the one structural change. The space-above prefix sum was
> published to consumers that each added `staffIndex × stride` themselves (`layoutTier1`,
> `GhostRenderer`), which is only correct while every staff is the same size; a per-staff stride
> cannot be re-derived from an index. So the sum is computed once and read. `staffSpacingLayout`
> now resolves BOTH per-staff facts per system, opener in hand, so §3's per-system size needs no
> new plumbing here.
>
> Also §5's second half, which is easy to miss: an authored space-above is in **that staff's own**
> spaces, so it converts at `× size` (`spacingAbovePx`). And the drag clamp takes two sizes — the
> upper staff owns the slot you collide with, the dragged staff owns the unit — which comes out at
> the historical −6 spaces for any uniform size.

**⚠️ §7's three keys did NOT land here, and that is a finding, not a shortcut.** The section
predicted P1's button would "appear not to work at all" without them. It works: the vertical
casting-off is recomputed on every render (it is not memoized at all), and a bar that only *moved*
is translated by design — `measureShapeKey` deliberately excludes x/y, which is exactly the case a
size change is at P2. `VexFlowRenderer.staffSize.test.ts` pins it on the real path (one renderer,
re-rendered, asserting a mid-line bar that takes the translate branch).

Each key becomes true in the phase that makes it true, and the trap is real in both:
 - **P3** — `laneFingerprint` and `layoutStateKey`. The moment a lane's width depends on its
   staff's size, the width memo and the cached casting-off can both hand back full-size answers.
 - **P4** — `measureShapeKey`. The moment the group carries a transform, a bar at a new size
   *looks* different, and a reused `<g>` keeps the old picture.

**P3 — the horizontal room** (§6), **with `laneFingerprint` + `layoutStateKey`** (§7). The per-lane width contribution and the bar's overhead go
per-staff. Still no glyph scaling: the bar is now the right *width* for a small staff drawn large,
which looks wrong on purpose and is the last cheap step.

**P4 — the transform**, **with `measureShapeKey`** (§7). **✅ BUILT** (out of order — P3 is still
open, see below). The per-staff group transform (§4.1) + the `ElementRegistry` composition (§4.2) +
`replaySnapshot`. This is where a small staff actually looks small.

> **The mechanism is one attribute and one division.** `renderMeasure` sets `transform="scale(k)"`
> on the measure-per-staff `<g>` it already opens, and tier 1 builds the stave at
> `x/k, y/k, width/k`. That division is what makes the transform a *pure* scale about the SVG
> origin — no offset term anywhere downstream — so the bar lands exactly where the casting-off put
> it, spanning exactly what the full-size staff below it spans (barlines still align).
>
> **The readback is one seam, as predicted.** `ElementRegistry.withScale(k, fn)` — scoped state, the
> way a graphics context carries a transform — so all ~30 `add` sites are untouched. `add`,
> `setStaffGeometry` and `setClefSegments` scale on the way in. `scaleElement` is `offsetElement`'s
> twin with one difference that matters: **it scales LENGTHS too** (a 0.7 notehead has a 0.7-wide
> hit-box). `lineSpacing` becomes `10k`, which is what makes pitch↔pixel come out right on a small
> staff — every consumer already divides by it.
>
> ⚠️ **`replaySnapshot` was the trap, in both branches.** It owns the group's `transform`: it
> overwrites it to move a bar and *removes* it to put one back. Both now carry the scale
> (`translate(dx, dy) scale(k)`, translate first), so a small staff no longer snaps to full size the
> first time one of its bars moves — never on a fresh render, always mid-drag.
>
> ⚠️ **§4.2's mixing defect was real**: `DynamicsLayout` shifted a registry bbox (global) by a delta
> read off `getBBox` (local) — off by exactly `k`. Both sites now go through
> `ElementRegistry.shiftById`, which applies the scale in force.
>
> `measureShapeKey` gained `scale`, §7's P4 half. A scaled bar is not a bar that moved, so nothing
> else in that key could see it.
>
> **Proved in the browser**, since this is a drawn-position change and jsdom measures zeros:
> `e2e/staffSize.e2e.ts` — the lines close up to 0.7, the pitch span with them, the stems too, the
> bar keeps its width and its place, the staff below is untouched, and full size comes back. jsdom
> covers the two `replaySnapshot` branches, where a `transform` attribute is real.
>
> ⚠️ **P3 is still open and it shows**: a small staff's music is spaced for a full-size staff, so
> inside its scaled group it gets `1/k` more room than it asked for and reads as *stretched* —
> exactly what §6 describes. **P5 is open too**: everything in §4.3 draws full size in the wrong
> place on a scaled staff. Tempo marks turned out NOT to be one of them — `drawTempoMarks` runs
> inside `drawMeasureContent`, so its group nests in the measure's and scales with it.
>
> **Not verified: PDF export of a small staff.** The outliner replaces each `<text>` in place, so the
> ancestor scale should carry through — but nothing tests it.

**P5 — the passes drawn outside the group** (§4.3). **✅ BUILT.** Ties, slurs, cross-barline beams,
connectors, tempo, the ghost. Split from P4 deliberately: P4 is one mechanism proved on one staff,
this is seven call sites that each have to be told about it, and neither review reads well mixed
with the other.

> ⭐ **Six of the seven are the same answer as P4: put the ink back in the staff's space rather than
> converting its coordinates.** `staffScaleGroup.ts` — `inStaffSpace` for a pass that already opens
> a group of its own (a tie's, a slur's), `inScaledStaffGroup` for one that does not (the
> cross-barline beams, the pending-tie preview). Geometry, curve thickness and beam width all come
> right at once, and a new kind of ink added to those passes is right without anyone remembering.
> `RenderPass.staffScale(staffIndex)` is where they all ask.
>
> ⛔ **The stave connector is the exception, and it is the interesting one.** It runs from the top
> staff's first line to the bottom staff's last, and those two may be drawn at *different sizes* —
> which is precisely the picture this whole plan is for. There is no single scale to put it in, so
> it is the one thing whose coordinates are composed by hand, each end through its own staff's.
> `StaveConnector` went with it: `singleLeft` is `fillRect(x, topY, 1, height)`
> (staveconnector.js:70, :144), so nothing was lost. Its 1px width is deliberately NOT scaled — a
> system bracket belongs to the system, not to either staff's ink.
>
> ⭐ **`inScaledStaffGroup` opens its wrapper ONLY when the staff is not full size**, so a
> full-size score's DOM is unchanged — the cross-barline beams are identified by being direct
> children of the `<svg>`, in a unit test and in the e2e harness, and both now look one level
> deeper through `vf-scaled` as well.
>
> **The note ghost** builds its throwaway stave at `x/k, y/k, width/k` and composes
> `translate(shift) scale(k)` on the overlay group it already had — with the pointer-to-note shift
> taken out of the staff's space first, since a translate is measured in the parent's.
>
> **Tempo marks were never in this list**: `drawTempoMarks` runs inside `drawMeasureContent`, so
> its group is nested in the measure's and has been scaling since P4.
>
> `e2e/staffSize.e2e.ts` covers each: the tie and slur shrink and stay on their own staff (the
> slur's arch above its top line comes out at exactly 0.7), the cross-barline beam is inside the
> scale group with nothing left full-size at the top level, the connector still reaches from one
> staff's top line to the other's bottom when they are different sizes, and the ghost previews at
> the size the note will be.
>
> ⏭️ **Still full size on a small staff: the MARKING-TOOL ghosts** (clef, meter, dynamic, rest,
> articulation, accidental, tie, dot, tremolo, tempo). They are not in §4.3's table because they are
> not staff-anchored — each builds a stave at `(0, cursorY)` and follows the pointer, so they are in
> the right *place*, just drawn at full size over a small staff. Fixing that means resolving the
> staff under the cursor and threading it through ~10 drawers plus the `ToolGhost` dispatch: its own
> phase, not this one.

**P6 — the ink constants** (§1). **✅ BUILT, and it was not the phase it looked like.** Sweep
`LAYOUT_CONFIG` and the loose px constants into staff-spaces, by the ink/finger rule. Deliberately
last: until P4 there is nothing to be wrong about.

> ⭐⭐ **P4 had already done most of it, and the sweep as written would have been a bug.** A staff
> drawn small is drawn inside `scale(k)`, so every ink constant used at DRAW time *already* scales —
> `CURVE_THICKNESS`, the `beamInk` four, `LEDGER_ACCIDENTAL_GAP`, `DynamicsLayout`'s `GAP`, the
> tuplet/tempo font sizes. Rewriting those as "staff-spaces × that staff's size" would have scaled
> them **twice**. The constants that genuinely still need a size are the ones read during the
> **casting-off**, before any group exists — the spacing model's own numbers (⚠️ `MIN_NOTE_SPACING`
> is deleted; the ink table and `MIN_COLUMN_GAP` replace it), `CLEF_WIDTH`, `TIME_SIG_WIDTH`,
> `BARLINE_PADDING` — and those belong to **P3**, which is still open.
>
> So what landed:
>
> - **`LAYOUT_CONFIG` says its unit.** All nine are `spaces × STAFF_SPACE_PX` — numerically
>   identical, but the width path's four are now visibly the ones P3 multiplies. The ink/finger rule
>   is stated at the top of the file, next to `VIEWPORT_*`, which is where both kinds of pixel used
>   to live under one naming. Each loose ink constant got a one-line note saying it is ink and ⛔ must
>   not be multiplied by a staff's size.
> - **§9's collision, settled the way §9 said**: `PX_PER_MM` now *reads* `STAFF_SPACE_PX` instead of
>   spelling the 10 out. A page's millimetres are derived from the score's staff size, not the other
>   way round — and a *staff's own* size stays out of it, because a page is a page whichever part on
>   it is engraved small.
> - **⚠️ Two real defects the sweep found**, both the same shape: a number in SVG coordinates used
>   inside a scaled drawing scope. A **slur crossing a system break** took its system edges from
>   `measureBounds` and drew them in the staff's space, so on a 0.7 staff it stopped 30% short of the
>   margin (measured: 688 where the system ends at 980). A **cross-system beam's overhang** compared
>   a visual barline against a local stem x, so the stub never reached the margin. Both convert at
>   the one place the two spaces meet, and both are pinned — `planSlurSegments` takes the scale as a
>   parameter and has a unit test, and `e2e/staffSize.e2e.ts` measures the slur reaching the margin
>   at both sizes.
> - **One rotted repo-fact comment** fixed: `dotPlacement`'s "one place to change if the staff is
>   ever scaled". The staff is scaled now, and the answer is that nothing had to change.

## 9. Explicitly not in this plan

- **Per-system size** — §3 is the design that keeps it cheap; building it is not owed.
- **Cue notes** (a small *note* inside a normal staff) — a different feature; VexFlow's per-category
  `fontScale` is the seam for it, not this.
- ~~**The global mm-per-staff-space**~~ — ✅ **settled in P6**, the way this entry predicted: the
  collision was real, and `PX_PER_MM` now *reads* `STAFF_SPACE_PX` rather than spelling the 10 out.
  One of them names the score's base staff size and the other reads it. A *staff's* own size stays
  out of it: a page is a page whichever part on it is engraved small.
- **A UI beyond the dev button.** P1's button is scaffolding.

## 10. Rejected, so it is not re-proposed

**Swapping VexFlow's globals per staff** — set `Metrics.fontSize` and `Tables.STAVE_LINE_DISTANCE`,
draw that staff, put them back. It reads as the smaller change and it is the larger one. `Metrics`
memoizes font info per key (`metrics.js:12-24`, `cacheFont`), so every swap needs a `Metrics.clear()`
and gives back the caching the renderer relies on; and tier 1 (`buildStave`, the width pass) runs in
a *separate earlier pass* from tier 2's draw, so a global set around the draw is wrong for half the
pipeline — the widths would still be full-size. A transform needs none of that: it is applied to ink
that has already been measured, which is exactly why the arithmetic in §4.1 is `x/k` and not a
different layout.

## 11. One comment that this work makes false ✅ done in P2

`VexFlowRenderer.ts:2948` justifies computing Y from the constant with "this editor never builds a
stave with custom spacing — zoom is a CSS transform". True today, false from P2. It is a **repo
fact**, not a design fact, so it rots (`docs/ARCHITECTURE.md` on comments that need a check) — update
it in the same commit that makes it wrong.
