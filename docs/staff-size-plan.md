# Staff size — a staff is drawn at a size, and it is not the same size for every staff

**Status: PLANNED.** Nothing built. The review that produced it: the model is already proportional
(staff-spaces, pixel-free), the **rendering** is not.

The picture this is for: a violin part above a piano part, the violin engraved small and the piano
full size, on the same system. Today every staff in the editor is exactly one size, and roughly
thirty numbers quietly encode that.

---

## 1. The defect, named

`VEXFLOW_DEFAULT_STAFF_SPACE_PX = 10` has ~20 call sites, every one of them `staffSpaces × 10`. The
name says it is VexFlow's default. It is not: it is **the score's staff size**, written as a
constant, and it is what has to stop being one.

Around it, `LAYOUT_CONFIG` is eight absolute pixels that are all secretly staff-spaces at that size
— `MIN_NOTE_SPACING` 18 (1.8 sp), `CLEF_WIDTH` 45 (4.5 sp), `TIME_SIG_WIDTH` 30, `BARLINE_PADDING`
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

- Glyph size comes from a **global** `MetricsDefaults.fontSize` (30 ⇒ 30pt × 4/3 = 40 px em ⇒
  SMuFL's 4-staff-space em ⇒ 10 px/space). `Tables.STAVE_LINE_DISTANCE = 10` is a **second,
  independent** global. They agree by coincidence; nothing enforces it.
- `Stave` accepts `spacingBetweenLinesPx`, but it only moves the **lines**. Noteheads, clefs, rests
  and accidentals keep the global font size — a squashed staff with full-size glyphs.
- Worse, VexFlow's own placement reads the **global** `STAVE_LINE_DISTANCE` rather than the stave's
  own spacing in `tuplet.js` (6 sites), `annotation.js` (5), `articulation.js`, `ornament.js`,
  `stringnumber.js`, `stavenote.js`, `vibrato.js`. Per-stave spacing is only partly honoured even
  where it exists.
- `Tables.STEM_HEIGHT` 35 and `STEM_WIDTH` 1.5 are global px.
- VexFlow's only built-in "smaller" is a global per-category `fontScale` (`GraceNote: 2/3`) and
  `Clef` `size: 'small'`. Category-wide, never per-stave.

⛔ So `spacingBetweenLinesPx` is **not** the mechanism. The mechanism is a **context transform**:
`ctx.scale(k, k)` around one staff's draw, with the stave built at `x/k, y/k, width/k`. Everything —
lines, glyphs, stems, beams — scales together, because it is one transform over the ink.

### 4.1 The one real cost: reading geometry back

Everything we read back from VexFlow after drawing — `getYForLine`, `getNoteStartX`,
`getAbsoluteX`, `getModifierStartXY`, `getBoundingBox` — answers in **pre-transform** coordinates.
A scaled staff would register hit-boxes in the wrong place.

⭐ **There is exactly one seam, and it already exists.** Every registration in the codebase funnels
through `ElementRegistry.add()` / `setStaffGeometry()` — 29 production call sites across 7 modules,
one entry point each. Compose the staff's transform there (`× k`, plus the staff origin) and every
hit-box, every glyph rect and every staff geometry lands right, with no call site touched.

⚠️ The two things that would still read raw and must be checked by hand: `DynamicsLayout` and
`TempoLayout` ask the **DOM** for `getBBox()` (which *is* post-transform — the opposite problem),
and the e2e readers already compose the CTM for a different reason. Both are named here so neither
is discovered late.

## 5. The vertical stride is the thing that breaks *pagination*

`staffSpacingLayout` computes `staffStride = STAVE_HEIGHT + VERTICAL_SPACING` — **one number for
every staff in every system** — and `pageCastOff` decides page breaks from it. A 0.7 staff in a
fixed 150 px slot is not merely ugly; the score paginates wrong.

This is independent of glyph scaling and can land first: the stride becomes per-staff
(`staff-lines × sizeₛ + clearance`), summed instead of multiplied. In the same function,
`acc += above * VEXFLOW_DEFAULT_STAFF_SPACE_PX` becomes `× that staff's space`.

## 6. Phases

**P0 — the value and the resolver.** `StaffInfo.size`, `resolveStaffSize(score, staffId, opener?)`,
JSON round-trip, a `ScoreModel` mutator. No rendering change. Rename
`VEXFLOW_DEFAULT_STAFF_SPACE_PX` to what it is (`STAFF_SPACE_PX`, the score's staff size) and move
it out of `engravingOverrides.ts` — it is a scale, not an authored tweak.

**P1 — the dev-shell button.** Select a measure → resolve its staff → toggle that staff's size
between `1` and `0.7`. **Scaffolding, in `dev/`, deliberately crude** — it exists to exercise the
infrastructure while it is iterated on, not to be the UI. It writes a *number*; the two values are
the button's business, never the model's.

**P2 — the vertical stride per staff** (§5). Visible immediately with P1: a small staff gets a small
slot. Still no glyph scaling.

**P3 — the transform.** `ctx.scale` per staff + the `ElementRegistry` composition (§4.1). This is
where a small staff actually looks small. Prototype on one staff behind a flag first; the readback
is the whole risk and the e2e harness can measure it directly.

**P4 — the ink constants** (§1). Sweep `LAYOUT_CONFIG` and the loose px constants into staff-spaces,
by the ink/finger rule. Deliberately last: until P3 there is nothing to be wrong about.

## 7. Explicitly not in this plan

- **Per-system size** — §3 is the design that keeps it cheap; building it is not owed.
- **Cue notes** (a small *note* inside a normal staff) — a different feature; VexFlow's per-category
  `fontScale` is the seam for it, not this.
- **The global mm-per-staff-space** (`PX_PER_MM = 10 / 1.75`, which currently derives millimetres
  *from* the staff size). It is a real coupling and it belongs to the engraving object beside
  `Surface`, not here. ⚠️ It will collide with this work at P4 — one of them has to name the score's
  base staff size and the other has to read it.
- **A UI beyond the dev button.** P1's button is scaffolding.
