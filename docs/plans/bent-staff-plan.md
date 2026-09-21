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

## 5. THE PORT MAP — what the engine draws that the spine does not (written 2026-09-21)

His ask: *"make sort of plan to know what is not in the spine that we have in the engine and we should
start to port it there."* Read from the source (`eye/spineScore.ts`, `eye/spineStaff.ts`), ⛔ not from
§3b's list. The KIND column is §2's — it says HOW a thing gets onto a path, which is most of the work:

- **BLOCK** — drawn upright in its own space, placed by one affine. Cheap: the page's class, reused.
- **LINES** — drawn from the path itself.
- **SPAN** — must be RE-SOLVED along the path; the page's renderer cannot simply be placed.
- **ROOM** — not ink: where things stand along the path.

| # | what | kind | on the spine today | what it takes |
|---|---|---|---|---|
| 1 | staff lines | LINES | ✅ `spineLines` | — |
| 2 | clef + meter at the start | BLOCK | ✅ `drawSpineHeader` | — |
| 3 | note · chord · rest · accidental · dot · articulation · ledger lines · stem · FLAG | BLOCK | ✅ one block per slot, through the page's `NoteBuilder` | — |
| 4 | plain barline | BLOCK | ✅ `drawSpineBarline` | — |
| 5 | **BEAMS** | BLOCK (the GROUP is the block) | ⛔ every eighth draws a flag | **§6 — next** |
| 6 | key signature in the header; mid-score clef / meter / key CHANGES; cautionaries | BLOCK | ⛔ the header is clef + meter, once | the signs are `StaveSign`s already (`drawSpineSign` takes any) — needs the positional walk (`resolveStaffClefs/Keys` per bar) and room for them (#14) |
| 7 | barline TYPES — final, double, repeats with dots and wings | BLOCK | ⛔ plain only | `layout/barlineSign.barlineSignParts` is pure: draw its strokes + dots in a block |
| 8 | tuplet number + bracket | BLOCK (with its group) | ⛔ | rides #5's group block; ⚠️ `ScoreTuplet` still draws straight on the painter (`scene/` cannot see it) |
| 9 | tremolo (one-note strokes) | BLOCK | ✅ if `NoteBuilder` attaches it — ⚠️ NOT VERIFIED on the spine | look |
| 10 | two-note tremolo · fanned (feathered) beams · cross-BAR beams | BLOCK spanning slots / bars | ⛔ | after #5; a cross-bar beam is a block that crosses a barline block |
| 11 | second VOICE | BLOCK | ◐ drawn, stems forced up/down — ⚠️ no `voiceStack` (shared column shifts, rest displacement) since each note is formatted ALONE | format the COLUMN (all voices at one beat) as one block |
| 12 | more than one STAFF; brace / bracket / system-start line; joined barlines | LINES + BLOCK | ⛔ first staff only | concentric spines (a second staff is the same path at another offset); `systemStart` as a block at s = 0 |
| 13 | ties · slurs | SPAN | ⛔ | re-solve the curve between two placed notes in PAGE space (both ends are known points; the arc must clear a curved staff) — the multi-system-slur reasoning |
| 14 | **SPACING** — `layout/spacing` (the spring law, the ink table) | ROOM | ⛔ TIME-proportional, 48 px per quarter | run the page's casting-off for ONE endless system and read its column x's as `s`. ⚠️ On a CLOSED path the total length is FIXED by the radius — justification on a circle is its own question (B7) |
| 15 | hairpins · ottava · pedal · trill lines | SPAN | ⛔ | offsets of the path between two `s`, like the staff lines (the *Bike Ride* plate's hairpin follows the rim, §1) |
| 16 | dynamics · tempo marks · expression words | BLOCK on a LANE (an offset from the path) | ⛔ | a lane is `pointAt(spine, s, offset)`; the ladder's offsets are the page's. Text rotates with the block (the plate rotates all text) |
| 17 | clicking / selecting / dragging | — | ⛔ the panel cannot be clicked into | B3: `ElementRegistry.withSpace(affine)`; the inverse is `spine.locate` (built) |
| 18 | the shape in the score JSON | — | ⛔ his call: not yet | B7 |
| 19 | PDF export · playback cursor | — | ⛔ | after B2 (they read the page's geometry) |

**Suggested order** (⛔ a suggestion — his pick): **5 beams** → 7 barline types → 6 header changes →
14 spacing → 11 voices as columns → 8 tuplets → 13 ties/slurs → 16 marks on lanes → 15 line spans →
12 staves → B (17–19). Blocks first because they reuse the page's classes; ROOM (#14) early because
every block's `s` comes from it; SPANS last because each is a re-solve, not a placement.

## 6. BEAMS on the spine — possible, and how (NEXT, awaiting his word)

**Possible, and the plan always meant it**: `placementAt` places a BLOCK, and §1's plate shows what a
beamed group is on a bent staff — *beams STRAIGHT, the group's stems PARALLEL, one rigid block*.

- **How**: a beam group's notes are formatted TOGETHER on one straight block stave, at x's equal to
  their distances along the path from the group's middle; the page's `EngravedBeam` is built over them
  and drawn in the block; the block is placed by ONE affine at the group's middle `s`. The slope, the
  stem lengths, secondary beams, fractional beams — all the page's decisions, untouched.
- 🚨 **What must be extracted first**: WHICH notes beam together, their shared stem direction, secondary
  breaks and fractional sides are decided in a PRIVATE method of `ScoreRenderer` (≈ lines 2780–2880,
  interleaved with the fan joins). The spine cannot ask it. ⇒ step 1 is a pure module
  (`rendering/beams/beamGroups.ts`) the page and the spine both call — ⛔ no behaviour change on the
  page (A/B the scene), and the hub SHRINKS.
- ⚠️ **The straight block on a curved staff — the one real question, and it has a number.** A chord of
  length `L` across an arc of radius `R` leaves its END noteheads off their lines by the sagitta
  `L² / 8R`, and tilted by `L / 2R` against the lines under them. At the console's defaults (48 px per
  quarter, R ≥ 160): two eighths (24 px) → **0.05 sp, 4°** — invisible; four eighths (72 px) →
  **0.4 sp, 13°** — visible; a full bar of sixteenths → worse. Options, his eye to choose:
  - **(a) pure rigid block** — what the plate does; short groups look right, long ones drift.
  - **(b) the heads RIDE the arc, the beam stays straight** — inside the block each note is shifted
    toward the centre by its own sagitta, so every head sits on its line; stems stay parallel and the
    beam straight (stems then differ slightly in length, as they do under any sloped beam).
  - **(c) break long groups by beat** on a tight radius — a beaming decision, ⛔ changes the music's
    look, so not by default.
  Build (a) first — it is the smallest and shows the problem honestly — with (b) as a row to switch.
