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
| 5 | **BEAMS** | BLOCK (the GROUP is the block) | ✅ `drawBeamedBlock` — option (b), the heads ride the path (§6, §7) | — |
| 6 | key signature in the header; mid-score clef / meter / key CHANGES; cautionaries | BLOCK | ⛔ the header is clef + meter, once | the signs are `StaveSign`s already (`drawSpineSign` takes any) — needs the positional walk (`resolveStaffClefs/Keys` per bar) and room for them (#14) |
| 7 | barline TYPES — final, both repeats, the back-to-back `:||:`, wings, invisible | BLOCK | ✅ `drawSpineBarline(kind, wings)` (2026-09-21) — the page's own `paintBarlineSign` in a block, WHICH sign from `models/boundarySign`; a `|:` on bar 1 stands at the bar's start and its room is in `spineSpacing`'s lead-in. ⚠️ an invisible line draws NOTHING on the panel (the editor greys it) | — |
| 8 | tuplet number + bracket | BLOCK (with its group) | ⛔ | rides #5's group block; ⚠️ `ScoreTuplet` still draws straight on the painter (`scene/` cannot see it) |
| 9 | tremolo (one-note strokes) | BLOCK | ✅ if `NoteBuilder` attaches it — ⚠️ NOT VERIFIED on the spine | look |
| 10 | two-note tremolo · fanned (feathered) beams · cross-BAR beams | BLOCK spanning slots / bars | ⛔ | after #5; a cross-bar beam is a block that crosses a barline block |
| 11 | second VOICE | BLOCK | ◐ drawn, stems forced up/down — ⚠️ no `voiceStack` (shared column shifts, rest displacement) since each note is formatted ALONE | format the COLUMN (all voices at one beat) as one block |
| 12 | more than one STAFF; brace / bracket / system-start line; joined barlines | LINES + BLOCK | ⛔ first staff only | concentric spines (a second staff is the same path at another offset); `systemStart` as a block at s = 0 |
| 13 | ties · slurs | SPAN | ⛔ | re-solve the curve between two placed notes in PAGE space (both ends are known points; the arc must clear a curved staff) — the multi-system-slur reasoning |
| 14 | **SPACING** — `layout/spacing` (the spring law, the ink table) | ROOM | ✅ `eye/spineSpacing` (§7) | run the page's casting-off for ONE endless system and read its column x's as `s`. ⚠️ On a CLOSED path the total length is FIXED by the radius — justification on a circle is its own question (B7) |
| 15 | hairpins · ottava · pedal · trill lines | SPAN | ⛔ | offsets of the path between two `s`, like the staff lines (the *Bike Ride* plate's hairpin follows the rim, §1) |
| 16 | dynamics · tempo marks · expression words | BLOCK on a LANE (an offset from the path) | ⛔ | a lane is `pointAt(spine, s, offset)`; the ladder's offsets are the page's. Text rotates with the block (the plate rotates all text) |
| 17 | clicking / selecting / dragging | — | ⛔ the panel cannot be clicked into | B3: `ElementRegistry.withSpace(affine)`; the inverse is `spine.locate` (built) |
| 18 | the shape in the score JSON | — | ⛔ his call: not yet | B7 |
| 19 | PDF export · playback cursor | — | ⛔ | after B2 (they read the page's geometry) |

**Suggested order** (⛔ a suggestion — his pick): **5 beams** → 7 barline types → 6 header changes →
14 spacing → 11 voices as columns → 8 tuplets → 13 ties/slurs → 16 marks on lanes → 15 line spans →
12 staves → B (17–19). Blocks first because they reuse the page's classes; ROOM (#14) early because
every block's `s` comes from it; SPANS last because each is a re-solve, not a placement.

## 6. BEAMS on the spine — ✅ option (a) BUILT 2026-09-21 (his word: *"start with beams"*)

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

> ✅ **As built.** Step 1: `rendering/beams/beamGroups.ts` — `buildBeams` + `PLACEHOLDER_BEAM` moved out of
> `ScoreRenderer` UNCHANGED (the body used nothing of the renderer's but a one-line delegation; the 305
> browser tests are the proof nothing moved), with its own spec. Step 2: `eye/spineStaff.drawBeamedBlock`
> — the group's notes in ONE `BarVoice`, `formatColumns`, then each column `setX` to its distance along
> the path (the same last word `format/spacingPass` has on the page), the page's `EngravedBeam` drawn
> inside, the block placed at the group's MIDDLE `s`. `eye/spineScore` asks `buildBeams` BEFORE any
> note is formatted, so a beamed note reserves no flag room. ⚠️ A group holding a FAN gets no `Beam`
> from `buildBeams` (the page draws fans by hand) — its notes stay lone blocks until row 10.
> Seen in Chromium (`e2e/spineBeams.e2e.ts` holds the structure; `window.__h.drawSpine(radius)` draws
> the open score on a spine in the harness).
>
> 🚨 **The sagitta is REAL in the console, not only on paper**: `__spine.circle()` keeps a minimum radius
> of 160, so a SHORT score is stretched round it — one bar of eighths round R = 200 puts each pair
> 157 px apart and its end heads **1.5 sp off their lines** (seen). At the console's own density
> (48 px per quarter, four bars) a pair is 24 px and sits right. ⇒ option (b) matters exactly when the
> music is sparse for its circle — his eye to call.
> ⚠️ The sixteenths CROWD (12 px apart, tighter than a notehead): that is row 14 — the spine's spacing
> is still time-proportional — ⛔ not a beam problem.

## 7. SPACING on the spine — ✅ BUILT 2026-09-21 (his report: sixteenths piled up round the circle)

He asked whether **Belle** has a solution. Checked in its source: Belle never bends a staff, but its
answer is the right one anyway — its spacer (`belle-spacing.h`, `belle-springs.h`: minimum widths plus
springs) produces ONE number per instant, `TypesetX`, and placement (`belle-placement.h:354`) merely
consumes it. ⭐ **Spacing is ONE-DIMENSIONAL; the path only maps it.** There is no "circle spacing".

- `eye/spineSpacing.ts` — the PAGE's columns (`layout/measureColumns`: each event's measured ink, the
  padding its neighbours are owed) and law (`layout/spacing`: Gould's `3.5 × √t`, the spring solve),
  asked for one endless line; what they answer is distance along the path. The spine is ONE JUSTIFIED
  SYSTEM: bars share the room in proportion to what they ask, lead-ins stay rigid, springs stretch
  inside each bar. `naturalSpineLength(score)` is what the console sizes the circle from (× 1.15).
- 🚨 **Real spacing made option (b) NECESSARY at once**: four sixteenths became a 130 px block on a
  radius of 160 — end heads 1.3 sp off their lines (seen). `drawBeamedBlock` now lowers each note to
  where the PATH is under it (`toBlockSpace` — asked of the spine, so any path, not only a circle),
  each on its own undrawn stave; stems stay parallel, the beam straight. ⚠️ Left over: end heads are
  tilted against their lines by `L / 2R` — the plate's look.
- ⚠️ **Not corrected**: `s` is measured along the spine's reference line (the top staff line); ink
  INSIDE a circle has less arc, by `(R − d) / R` at depth `d` — on R = 160 the bottom line is 25 %
  shorter, so low notes sit closer than the law says (his score's first sixteenth stands near the
  meter). Options when it bothers: measure `s` along the MIDDLE line, or space by the innermost ink.

## 8. COLLISIONS round the circle — two causes found and fixed, one left (2026-09-21, his report)

His second score: low notes with accidentals, in beamed groups, colliding round the circle.

1. ✅ **The music is spaced where its DEEPEST ink stands.** `s` is the TOP staff line; ink inside a loop
   stands on a shorter arc — for any closed curve that turns once, the offset curve at depth `d` is
   shorter by `2π·d` (`staffSpine.innerLengthRatio`; a circle's `(R − d) / R`). Low notes six spaces
   down on R ≈ 170 had a third less room than the law gave them. ⇒ `spineSpacing.spaceBarsOnSpine`
   takes an `innerRatio`: the law is given the INNER arc's length (there nothing stands closer than on
   the page) and every answer goes back out to the spine by its angle; everything nearer the rim gets
   more room. `deepestInkPx(score)` reads the columns' own ink boxes; the console adds it to the
   radius it sizes. ⚠️ Assumes EVEN curvature (true of a circle).
2. ✅ **A beamed head is placed where the path puts it AT ITS OWN DEPTH.** §7 lowered each note to the
   path under it on the top line — but a low head hangs spaces deeper, along the BLOCK's down, which
   at a block's ends is not the path's own down: deep heads swung outward by `depth × tilt`, into the
   NEXT block. `drawBeamedBlock` now asks `pointAt(spine, s, headDepth)` and sets the note's stave so
   the head lands there.
3. ✅ **A note's OWN ink turns with the PATH, not with the block** (BUILT 2026-09-21, his word: *"yes
   do it"*). At a long block's ends an accidental stood up-left of its head (along the block's
   horizontal) instead of beside it along the arc — by `L / 2R`, ≈ 17° for four sixteenths on
   R ≈ 175 — and a ledger line cut across the staff lines at the same angle. ⇒ In `drawBeamedBlock`
   each note draws into a group of its own (`SPINE_NOTE_CLASS`), turned about the CENTRE OF ITS HEADS
   by `angle(s_note) − angle(s_middle)`. ⭐ It costs nothing structurally: a beamed note draws no stem
   (the beam draws them all), so `note.draw()` paints exactly what must turn — heads, accidentals,
   dots, articulations, ledger lines — and the stems and the beam stay in the block's frame, parallel
   and straight. ⭐ The pivot is the point `local` had already put ON the path at the note's own
   depth, so the turn moves no head off its line. ⚠️ The stem now meets a head turned by a few
   degrees — a fraction of a pixel off its edge, inside the overlap the two already have.
   Proof (`spineScore.test.ts`): block turn + note turn = the circle's tangent where the note stands
   (read back from the scene alone); the two ends turn equal and opposite; stems and beam are NOT in
   the note groups; a straight spine turns nothing. Looked at in Chromium, before and after, on his
   worst case (low sixteenths with accidentals, beamed in fours).
   ⏭️ Left: a TUPLET's bracket and a slur are not notes and do not turn (port map #8, #13).
