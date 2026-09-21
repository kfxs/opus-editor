# The bent staff — a staff is a PATH (2026-09-21)

> His brief: *"we should have some of the machinery for bending staff and doing eye music soon so it
> is in the code and later decisions, for example layout, take it into account… we don't need big
> things, just the basic infrastructure… a simple console command that can generate a circle staff
> with some notes in 4th."* And: *"the goal is also to do B… the shape — a rose, a heart, whatever —
> is a transformation applied to the JSON, I guess."*

The background is `own-engraving-engine.md` §7.5 (what *Belle, Bonne, Sage* does, and the doors we
must not close). This plan is the first thing that BUILDS any of it. ⛔ Belle is still not a source
for traditional engraving (`reference/README.md`).

## 1. What was re-checked on 2026-09-21 — against the SOURCE and the PLATE, not the doc

- ✅ `belle-placement.h:354` — `s->a = Affine::Translate(Vector(TypesetX, y)); s->Paint(Painter)` is
  the one place a musical x becomes a page position. Across all headers the placement assignments
  are 21 `Translate` + 3 `Scale`, ⛔ zero rotations; `Affine::Rotate` appears once
  (`belle-optics.h:108`, slur-anchor angle maths). `belle-stamp.h:220` composes parent · child.
  `PaintStaffLines` is one function and draws straight lines. ⇒ Belle places nothing on a curve;
  what it offers is the SHAPE: a translate-only engraver and one seam.
- ✅ The *Bike Ride* plate (`reference/belle/bike-ride-*-detail-*.png`): staff lines are true arcs;
  beams are STRAIGHT and a group's stems are parallel — the beamed group is one rigid block; every
  glyph, ledger line, tuplet number and text is rotated, never deformed.
- 🚨 **One row of §7.5.5 was WRONG and is corrected there**: the line after `pp` is not straight — it
  is a HAIRPIN that follows the rim (a second one runs under the inner staff). So the plate does
  contain spine-following spans; the third kind of ink below is real, not hypothetical.

## 2. The model of the problem

**A staff is a PATH.** It answers one question: *at distance `s` along you, where am I and at what
angle?* Today's straight staff is the simplest path; a circle, a spiral, a rose or a heart answer
the same question. Three kinds of ink:

1. **RIGID BLOCK** — a note today, a beamed group later: drawn upright in its own space, then placed
   by ONE affine (rotate + translate) taken from the path. ⛔ Never deformed.
2. **THE STAFF LINES** — drawn FROM the path (offsets of it), not transformed onto it.
3. **SPANS THAT FOLLOW THE STAFF** (hairpin, slur, ottava) — re-solved from the path, the same
   reasoning as a multi-system span re-solving per segment. Later.

**The music never changes.** A note stays *bar 3, beat 2, G4*. The shape is AUTHORED PRESENTATION
(`DESIGN-PRINCIPLES.md` §3, the third compartment) — *"this staff, bars X–Y, follows this path"* —
saved in the JSON beside the content, keyed staff × range like `staffSpacing`, ⛔ not a `Score`
global and ⛔ not element-keyed `engravingOverrides`. Take it away and the same score draws straight.
The exact field is decided in B, not now.

## 3. A — the machinery, and a circle in the console ✅ BUILT 2026-09-21

> `__spine.circle({ notes, radius })` / `.straight()` / `.clear()` — seen in Chromium. A4 landed as
> `engine/rendering/eye/spineStaff.ts`, and gained a CLEF + METER (his ask): header signs are rigid
> blocks like notes. ⭐ Found on the way: a wide block is placed by its MIDDLE — by its left edge it
> leaves the curved lines at its far end. The panel is the console's, ⛔ not the machinery's: the
> drawing takes any `DrawContext`.

A separate small drawing beside the score; the real score is untouched. No beams — quarter notes.
Every piece is its own module; nothing lands on a hub.

| # | module | what |
|---|---|---|
| A1 | `engine/paint/Affine.ts` | `rotation()` / `rotationAbout()` — the one constructor missing |
| A2 | `engine/engrave/staff/staffSpine.ts` | `Spine`: `length`, `at(s) → { x, y, angle }`; rows `straightSpine`, `circleSpine`; `placementAt(spine, s, offset) → Affine`; the inverse (page point → `s` + offset) asked of the spine (rule 5). Pure, no DOM |
| A3 | `engine/engrave/staff/spineLines.ts` | the five lines as offsets of a spine (arcs as Béziers — `bezierCurveTo` is already the 20th primitive); thickness from `staffLines.ts` |
| A4 | `engine/rendering/eye/spineStaff.ts` + `dev/spineConsole.ts` | `__spine.circle({ notes, radius })` — quarter notes a fourth apart, each through `formatLoneNote` in its OWN group whose placement is `placementAt(…)` (Belle's one seam, as ours); `__spine.clear()` |
| A5 | specs | `staffSpine.test.ts` (arithmetic) + a scene spec: N groups, placement i = a rotation by 360°/N·i, every note on the radius — jsdom, no browser |

⭐ `placementAt` places a BLOCK, not a note — so a beamed group becomes a block later with no rework.
Every number (radius, spacing along the path) is a changeable row, never a blocker.

## 3b. The bridge — the panel draws the OPEN SCORE, live ✅ BUILT 2026-09-21

> His ask: *"what we draw in the circle follows the score model… it generates a real score that I see
> in the JSON and in the score canvas, so I can edit and see in real time the changes in the circle"*
> — and ⛔ **no shape in the JSON yet** (his call): the shape is a view of the console.

- `engine/rendering/eye/spineScore.ts` — `drawScoreOnSpine(ctx, score, spine)`. ⭐ Each bar's slots go
  through the page's own `NoteBuilder`, so chords, rests, accidentals under the key, dots,
  articulations and stems are the page's decisions; each built note is one rigid block
  (`spineStaff.drawNoteBlock`). Plain barlines are blocks too (`drawSpineBarline`).
- `__spine.circle({ notes })` LOADS a real score of fourths and bends it · `__spine.show({ radius })`
  bends whatever is open · `.straight()` · `.clear()`. The panel is draggable and re-draws when the
  model's JSON changes (polled, like the JSON panel).
- ⭐ A CLOSED spine has a SEAM: the music stops short of `s = length`, so the last barline stands in
  front of the clef, ⛔ not on it (his report — the first build skipped that barline).
- ⚠️ **Named placeholders**: first staff only · spacing is TIME-proportional, ⛔ not `layout/spacing`
  · plain barlines (no final thin-thick) · no beams (flags), ties, slurs, tuplet marks, dynamics,
  hairpins, mid-score header changes · the panel cannot be clicked into.

## 4. B — the real score asks the path (LATER; his goal, a DECISION list ⛔ not a queue)

Each step is checked against A's picture.

1. Classify the 42 reads of `.topLineY` / `.spacePx` in 25 files outside `staffFrame.ts` (measured
   2026-09-21) — which are legitimate, which are the "third file" of the circle test (§0.4).
2. A bar drawn in its OWN space and placed by an affine — today `renderMeasure` draws at page x/y
   and the bar's group carries only the staff scale.
3. `ElementRegistry.withScale(k)` → `withSpace(affine)`, the space stored beside the box (rule 9);
   `offsetElement` / `shiftById` stop being translate-only. Clicking works on a bent staff.
4. Ink that lives OUTSIDE a bar's group: barlines, ties, slurs, cross-bar beams, system start.
5. Spans that follow the path (kind 3).
6. The beamed group as a rigid block.
7. The authored shape in the JSON (staff × range → path), and what LAYOUT does with it — spacing is
   along the path's length; casting-off on a closed path is its own question.
