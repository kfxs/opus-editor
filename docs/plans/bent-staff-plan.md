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
- `__spine.circle({ notes })` LOADS a real score of fourths and bends it · `__spine.show({ radius, size, zoom })`
  bends whatever is open · `.straight({ size, zoom })` · `.clear()`. The panel is draggable and re-draws when
  the model's JSON changes (polled, like the JSON panel).
- ⭐ **`size` and `zoom` — two measures (his ask + report, 2026-09-25: *"the size is like a zoom … what I want
  is a staff size, a different measure from the radius"*).** `zoom` scales the CANVAS, circle and all. `size`
  scales the MUSIC ONLY on the SAME circle: a radius HE gives is canvas px; one sized from the music is what
  the music asks at the PAGE's size and ⛔ does not follow `size` (the first version let it, which was the
  zoom he saw). ⚠️ One line, no casting-off: bigger music may not fit — the console says the radius it needs.
  Both through the page's small-staff mechanism (`staff-size-plan.md` §4.1): ONE group placed by
  `scaling(zoom · size)`, every rule in the music's units, the radius ÷ size inside. Any positive ratio, as a
  staff's `size` is — ⛔ not a "small" type. At 1 · 1 no wrapper: byte-identical. `dev/spineConsole.test.ts`.
- ⭐ **The panel REMEMBERS** (his report, same day: *"if I change first the size and then the zoom it just
  forgets my previous size"*): every call keeps what the last one set — radius (through a `straight()` and
  a new `circle()` score too), size, zoom; `radius: 'auto'` returns to the fitted circle; a refused value keeps
  the armed one; only `clear()` forgets. `__spine.dump()` says what is armed.
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
| 6 | key signature in the header; mid-score clef / meter / key CHANGES | BLOCK | ✅ `eye/spineHeader` (2026-09-21) — WHICH signs a bar draws is the page's answer (`resolveStaffClefs` · `headerKeyAt` · `drawsTimeSignature`), bar 1 being the one system's head; the key signature is the page's own row (`KeySignaturePass.drawKeySignatureRow`) in a block; ONE parts list prices the room (`spineSpacing`'s lead-in, with the page's header→note gap) and draws. A `|:` on a bar with a header stands AFTER it (`HEADER_TO_REPEAT`). ⛔ No cautionaries (one system has no break). ⚠️ LEFT: a clef change in the MIDDLE of a bar; the header PLACEMENT's researched gaps (walk padding today) | mid-bar `EngravedClefChange` as a block in the note walk |
| 7 | barline TYPES — final, both repeats, the back-to-back `:||:`, wings, invisible | BLOCK | ✅ `drawSpineBarline(kind, wings)` (2026-09-21) — the page's own `paintBarlineSign` in a block, WHICH sign from `models/boundarySign`; a `|:` on bar 1 stands at the bar's start and its room is in `spineSpacing`'s lead-in. ⚠️ an invisible line draws NOTHING on the panel (the editor greys it) | — |
| 8 | tuplet number + bracket | BLOCK (with its group) | ✅ `drawGroupBlock` (2026-09-25, his pick) — a GROUP is the notes a beam joins, the notes a TUPLET joins, and any run those overlap into (union-find, `spineScore.groupNotes`): ONE block, its beams and marks drawn inside, straight, like the beam. The tuplet is the page's own `ScoreTuplet` by the page's rules — side (`resolveTupletLocation` + `stemMajorityTupletLocation`, moved OUT of `ScoreRenderer` for it), bracket (`tupletBracketed`: none where a beam shows the group), mark (`tupletMarkRuns`, meter-aware), bracket END (`tupletBracketEnd`: the next column's `s` / a gap before it / the bar's end). An unbeamed member (a triplet of quarters) draws its own stem and flag, which turn with it. ⚠️ `ScoreTuplet.draw` takes the `DrawContext`, so the scene DOES see it (the old note here was stale). ⏸️ Nested tuplets not probed | — |
| 9 | tremolo (one-note strokes) | BLOCK | ✅ if `NoteBuilder` attaches it — ⚠️ NOT VERIFIED on the spine | look |
| 10 | two-note tremolo · cross-BAR beams | BLOCK spanning slots / bars | ⛔ | after #5; a cross-bar beam is a block that crosses a barline block. ⚠️ FANS moved to their own row, #29 |
| 11 | second VOICE | BLOCK | ✅ (2026-09-26, his pick) — a bar is BUILT whole (every voice's notes, beams, tuplets), then with more than one voice the page's own column pass runs over ALL of them (`attachModifierColumns` + `formatColumns`: the voice rule, dots and accidentals stacked across the voices of a beat) and the page's re-assert follows; the blocks keep that column (they re-attach only a note that has none). Two answers moved OUT of `ScoreRenderer` so both ask one: `engraved/restShift` (where a multi-voice rest stands — `layout/restVoicePlacement` + the hand's `restShift`) and `format/voiceIntent` (what survives the voice rule). Net: `e2e/spineVoices.e2e.ts`. ⚠️ Two heads a second apart still overlap — the PAGE's too (§9.4 #4 of the removal map) | — |
| 12 | more than one STAFF; brace / bracket / system-start line; joined barlines | LINES + BLOCK | ⛔ first staff only | concentric spines (a second staff is the same path at another offset); `systemStart` as a block at s = 0 |
| 13 | ties · slurs | SPAN / BLOCK — the side chooses | ✅ `eye/spineCurves` + `engrave/curves/curveOnPath` (2026-09-25, his pick, then ⭐ HIS RULE after four screenshots: *"if the slur is outside the circle it should follow the curve of the circle; if the curve is inside the circle, the solution is to get the two anchor points and make the curve of the slur like normal (forgetting the curve of the circle) … the form I'm intuitively drawing with a pencil"*). Each placed note answers where it stands (`SpineNotePlace`, off the blocks); the page's own rules run unchanged on those numbers in the path's plane `(s, d)` — a tie's inset ends, bow and staff-line growth, a slur's attachment and arch height, the side by `tieSide` / `slurSideFromStems`. Then `pathBendsTowardBow` asks whether the path bends toward the curve's side between its ends: **OUTSIDE** (it does not) the lens is bent through `pointAt` and rides the lines, which there curve toward the notes — the plate's picture; **INSIDE** (it does) the curve is a RIGID unit like the beam and the tuplet bracket, the page's cubic between the two anchors' page points, bowing from its chord — because the lines there curve AWAY from the notes and a curve riding them is inverted at every point (tried: a bend, a sagitta-corrected bend that FOLDED into a V, a capped one, a faded one — his *"inverted"*, *"really??"*, *"worse than before"*). A long inside curve is a bowl across the disc, as the pencil draws it. ⚠️ **A TEMPORARY solution by his word** (*"not perfect, but looks better now … maybe there is no optimal drawing solution"*). ✅ The hand's edits reach the spine (his ask the same hour): the slur's per-end nudges, shape and whole-curve nudge through the page's own `resolveCps` / `slurEndpointOffsetPx` / `slurOffsetPx` in the page's order, and the tie's vertical nudge. ✅ A slur's SIDE is the page's whole rule since 2026-09-26 (his report: a voice-2 slur stood above, in voice 1): the hand's placement, else the VOICE's side in a multi-voice bar (`curves/slurDirection.slurVoiceSide`, moved out of `SlurRenderer` so both ask it), else the stems of every covered note. ⏸️ LEFT: a slur's obstacles, nesting, tilt, slant limit; registration (B3) | — |
| 14 | **SPACING** — `layout/spacing` (the spring law, the ink table) | ROOM | ✅ `eye/spineSpacing` (§7) | run the page's casting-off for ONE endless system and read its column x's as `s`. ⚠️ On a CLOSED path the total length is FIXED by the radius — justification on a circle is its own question (B7) |
| 15 | hairpins · ottava · pedal · trill lines | SPAN | ⛔ | offsets of the path between two `s`, like the staff lines (the *Bike Ride* plate's hairpin follows the rim, §1) |
| 16 | dynamics · tempo marks · expression words | PIECES on a LANE (an offset from the path) | ✅ `eye/spineMarks` (2026-09-26, his pick). ⛔ Nothing re-decided: the dynamics line is the page's whole `planDynamicsLines` over the spine's own columns (one system, line 0); the tempo row is `clearanceBaseline` + `TEMPO_LINE` over its beat → bar end, merged with what the dynamics claimed above (`bandOver` — the LADDER); a dynamic hangs off `anchorSlotIndex`'s slot, a level CENTRED on its ink, prose anchored, a shared beat a ROW (`layoutCoLocatedDynamics`); a tempo mark by Gould p. 183 (meter's left edge on a downbeat that prints one, else the first element, else the bar's music start); both hands' nudges (`dynamicOffset` +down, `tempoOffset` +UP). ⭐ HIS ASK: *"the text should not be rect but follow the spine"* — a WORD is one piece per LETTER, each turned where it stands; a dynamic GLYPH (`p`, `mf`) and the tempo's ♩ stay rigid pieces; *"probably for tempo too"* — so tempo text follows as well. Pieces are laid out along the LANE's own arc (`s = s0 + x / innerLengthRatio(depth)`), so letters keep normal spacing at any depth (placed along `s` unmapped, `p dolce` slid together inside the loop). 🚨 Found on the way: `glyphPainter.measureTextMetrics` silently DROPPED a `TextRunFont`'s `sizePt` (the letters came out far apart) — new `measureTextRun`, the measuring twin of `drawTextRun`; the page's callers all passed `size` and were never affected. ⚠️ Faithful to the page, and worth his eye: a tempo mark's scope runs to its bar's END inclusive, so a `pp` above the NEXT downbeat pushes a `rit.` up (the page does the same). ⏸️ Hairpins (#15); registration (B3) | — |
| 17 | clicking / selecting + SPINE PROPERTIES | — | ⛔ the panel cannot be clicked into | ⭐ **§9** (his direction, 2026-09-26): CLICK + SELECT (a SHARED selection), then a SPINE PROPERTIES window of its own |
| 18 | the shape in the score JSON | — | ⛔ his call: not yet | B7 |
| 19 | PDF export · playback cursor | — | ⛔ | after B2 (they read the page's geometry) |
| 20 | ⭐ **`__spine.svg()` / `__spine.pdf()` — export the PANEL** (his ask, 2026-09-25) | — | ⛔ | the panel is a real vector `<svg>` (paths + music-font `<text>` glyphs placed by affines), so the page's own pipeline applies from step 2: `engine/export/outlineText` (glyphs → outlines, font-free) then svg2pdf + jsPDF (`engine/export/pdfExport`), the panel's SVG as the input. ⚠️ VERIFY first that a ROTATED `<text>` glyph outlines in place — the outliner asks `getStartPositionOfChar` and must honour the group's rotation and scale. Independent of B (#19 reads the PAGE's geometry; this reads the panel's) |
| 21 | ⭐ **GRACE NOTES** — acciaccatura, appoggiatura (their slash, beam, size, dots, signs) | BLOCK (inside its HOST's) | ✅ (2026-09-26, his pick) — the page's own `GracePass.drawGraceNotes`, asked for ONE note (a new optional `only` filter; the signs still read over the whole lane) and drawn inside that note's block, right after the note, in the note's own group (`spineStaff.WithNote`) — so the graces are part of the rigid block and turn with it. The three grace passes take `GracePassContext` (the five fields they use; a `RenderPass` is one), so the spine hands them its surface and a registry of its own. ⭐ A SLUR to or from a grace (his report the same hour: *"i dont see the slur in the graces"*): each grace head is filed with its host's place on the path and the anchor `GracePass` recorded (`FanMemberAnchor`, host stave px), which `spineCurves` prefers — the page's `resolveSlurEnd` order. The spacing already bought their room (`measureColumns.slotInk`) | — |
| 22 | **BRACKETED grace** | BLOCK (inside its target's) | ✅ (2026-09-26) — arrived with #21: `GracePass` draws the bracketed graces from the same call (`BracketedGracePass`). ⏸️ The feature itself is PARKED by his call | — |
| 23 | **PARENTHESISED note** — its brackets | BLOCK (inside the note's) | ✅ (2026-09-26) — arrived with #21: `GracePass` draws the brackets from the same call (`EnclosurePass`) | — |
| 24 | **CUE-size notes** | BLOCK | ✅ seen 2026-09-26 — the size comes from `NoteBuilder`, so it arrived with the notes | — (⚠️ cue FANS ride row 10) |
| 25 | **DOUBLE + TRIPLE dots** | BLOCK | ✅ seen 2026-09-26 — the note's own modifiers | — |
| 26 | **GLISSANDO** | SPAN (a line between two heads) | ⛔ seen missing 2026-09-26 | with #15: solve in `(s, d)`, the SIDE chooses (#13's pattern); its italic word follows the path as #16's text does |
| 27 | **TUPLET hand offset** (`tupletOffset`) | — | ✅ (2026-09-26, his pick) — the page's two vertical nudges, the inner flip and the HAND's, are now ONE function in `marks/tupletPass` (`tupletYOffsetPx`); the spine asks it just before each tuplet draws in its block (`GroupBlockInk.tuplets[].beforeDraw`), once the notes are formatted there. ⭐ The inner-flip nudge arrived with it — the spine had never applied it either | — |
| 28 | **DRAGGING an element on the spine** | — | ⛔ — ⭐ ITS OWN TOPIC (his word, 2026-09-26: *"the drag is a topic different than click selection and spine properties"*) | LATER, after §9. A drag on a curve must ask "which way is ALONG and which way is ACROSS here" at every point; every drag we have (`interactions/drags/*`) assumes a straight line. ⚠️ Not the PANEL's own drag (moving the window, §9.3 D) |
| 29 | ⭐ **FANNED (feathered) BEAMS** — the fan, its members' pitches, cue fans, a fan joined to a group, a fan across a barline | BLOCK spanning the slot's territory | ◐ (2026-09-26, his ask *"do we have the fan in the spine plan?"*, then *"lets do the fan"*) — ✅ a LONE fan and a fan JOINED to the group on its left: the page's own `beams/FanPass.drawFannedBeams` (narrowed to `FanPassContext`; `applyFanStemStretch` moved out of `ScoreRenderer` so both ask it), drawn inside the block — a joined fan and its prefix are ONE block (`fanJoins` join the groups; before this the prefix wore the PLACEHOLDER beam and drew STEMLESS on the spine — a bug found on the way). The bar's columns are the spine's (`pagePass.solvedColumns`, the fan's ramp room); the fan is solved in DISTANCE ALONG THE PATH (its room ends at the next head that far on), then ⭐ each MEMBER is moved to the path's own point AT ITS OWN DEPTH (`FanPass` scope `memberPlace` — across through the geometry's own member-offset input, down by lowering its head, solved again so the stems reach the straight ramp) and TURNED with the path there, head + signs + ledgers (`memberTilt`; the stem stays parallel) — his report: *"the noteheads are not following the circle path, they should behave like normal notes"*. Two faults met: a ramp left on the tangent overshoots on a circle (`R·sin(s/R)` < `s`), and a deep head set straight down swings forward by `depth × sin(turn)` (§8 cause 2, again) — both put his rit fan's last member onto the next note. A joined fan's OWNER stays upright (`GroupBlockInk.upright`) so its stem meets the ramp. 🚨 Fixed on the way: a group block's along-the-path → x mapper was built from the lead-in constant and ended every span short by the stave's note start + half a head (a fan's room 71 px vs the page's 93; a tuplet bracket's `division`/`beforeNext` end the same). ⚠️ The stems at a long group's ends: §6.1, a KNOWN ISSUE. ⏭️ LEFT: a fan across a barline (`drawCrossBarFanBeams`, with #10), slurs/ties to a MEMBER (the anchor is recorded — the graces' route), cue fans not looked at | — |

**Suggested order** (⛔ a suggestion — his pick): **5 beams** → 7 barline types → 6 header changes →
14 spacing → 11 voices as columns → 8 tuplets → 13 ties/slurs → 16 marks on lanes → 15 line spans →
12 staves → B (17–19). ✅ 5 · 6 · 7 · 8 · 13 · 14 done by 2026-09-25, 11 · 16 · 21–23 · 27 on 2026-09-26 — ⭐ #13 set the pattern #15 and #16 reuse: solve in `(s, d)`,
then the SIDE chooses — bent along the path outside the loop, a rigid unit inside. Blocks first because they reuse the page's classes; ROOM (#14) early because
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

### 6.1 ⚠️ KNOWN ISSUE — the stems at a long group's ENDS (his report, 2026-09-26; ⛔ not to be fixed now, his word)

*"the problem of the stems is because of the curve... when too many notes for having a straight beam then the stems
in the beginning and the end of the groups rotate and look weird"* — and *"this should not be solved now, we just make
the note as a known issue"*. A group block stands on the tangent at its MIDDLE and keeps every stem PARALLEL (the beam
is straight), so at the two ends the stems lean against the lines by the path's turn there, `≈ L / 2R` — small for two
eighths, plain for a long run of sixteenths, a joined fan, a long tuplet.

⭐ **His proposed fix (recorded, not built):** *"make perpendicular the stem in the middle while the ones at both limits
change the angle little by little to compensate"* — each stem turned by a SHARE of the path's local turn where it
stands (0 at the middle, growing toward both ends), so the stems FAN slightly while the beam stays straight and every
stem still runs from its head to the beam line along its own direction. One ROW: the share (0 = today's parallel
stems, 1 = every stem perpendicular to the lines; the default by his eye). It applies alike to beamed groups, tuplets
and fans — they share `spineStaff.drawGroupBlock`.

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

## 9. Clicking, selecting and SPINE PROPERTIES — the plan (his direction, 2026-09-26; ⛔ NOT BUILT)

⚠️ **Dragging an element is NOT part of this section** — his word, the same day: *"the drag is a topic
different than click selection and spine properties for the object"*. It is port map row 28, its own topic.

His words: *"since the space is curve, i think dragging should be done later, but clicking and selecting first,
i also think we need something like spine properties so if we select an element we can change for example
space (similar to space in the score) or offset, but since spine has a different geometry is good to have it
separated"*. Written down on his ask (*"we dont have to do it now, just write these ideas in the plan"*) — a
plan, ⛔ not a queue: each step waits for his word.

### 9.1 What is DECIDED

1. **Order: CLICK + SELECT → SPINE PROPERTIES.** A click needs only the inverse of the placement — what is under
   this point — which the spine already has. ⛔ DRAGGING an element is a separate topic (row 28): a drag on a
   curve needs "which way is along and which way is across HERE", and every drag we have assumes a straight
   line (`interactions/drags/*`).
2. **⭐ ONE SHARED SELECTION** (his answer to question A, 2026-09-26: *"share selection"*). A click in the spine
   panel selects the SAME element in the editor — `EditorState.selectedNoteId` / `selectedItems` /
   `selectedElement`, the editor's own union, ⛔ no second selection. So: the element highlights in BOTH views;
   the normal Properties window shows its PAGE properties and the Spine Properties window its SPINE ones; the
   keyboard commands (Delete, a duration key, the arrows' non-drag keys) act on a spine click as on a page one.
   The rejected option: a spine-only selection the editor never sees — cleaner to isolate, but the music could
   not be edited from the spine.
3. **⭐ SPINE PROPERTIES are SEPARATE from the page's** (his instinct, agreed): the spine's geometry is different,
   so its adjustments live in their OWN compartment, keyed by element id like the page's engraving overrides,
   and ⛔ never change the page. Two reasons: (a) the AXES differ — on a path the natural nudge is ALONG it and
   OUTWARD/INWARD, not page x/y (on a circle "up" means something else at every point); (b) the two views can
   want different things — a note may need more room on the circle's short inner rim and none on the page.

### 9.2 The shape proposed (⚠️ not yet agreed in detail)

- **The hit test lives in PATH coordinates, beside the page's registry — ⛔ not in it.** Everything on the
  spine is placed by `s` (along) and `d` (across), and the inverse is already built (`staffSpine.locate`:
  a point → `(s, d)`). So each drawn element registers a box in `(s, d)` — a note's head column and its
  stem's reach, a mark's lane box, a slur's sampled band — and a click is `locate` → the box that holds it,
  with the page's `ELEMENT_HIT_ORDER` deciding who wins where two overlap. ⭐ This does NOT need plan B's
  `ElementRegistry.withSpace(affine)` (§4.3): the page's registry is untouched, the spine has a small one of
  its own. ⚠️ A rigid block's box in `(s, d)` is only approximate for a TALL block on a tight circle (it is
  turned as a whole); measure how far off before refining.
- **What is selectable, in order:** notes and rests (the first step), then the marks (dynamics, tempo), the
  curves (slurs, ties), tuplets, barlines.
- **The highlight in the panel:** the page's selection colour (`reference_color_selection_rule`) on the
  element's own group — the blocks and pieces already carry classes and ids.
- **The Spine Properties window:** a `windows/` module (builds its own elements, subscribes to state — the
  project's UI rule), shown when the selection is something the spine drew. First two knobs, both ROWS
  (`CLAUDE.md`: an engraving number is a default, never a constant):
  - **offset** — ALONG the path and OUTWARD from it, in staff spaces;
  - **space** — room BEFORE the element along the path, the spine's twin of the page's space; a row in
    `eye/spineSpacing`, which is 1-D along `s` (§7), so the path only maps it.

### 9.3 What is still OPEN — his calls, one at a time

- **B. Layering.** The spine ALREADY applies the page's hand nudges (dynamic, tempo, slur, tie and tuplet
  offsets — #13, #16, #27). Is a spine adjustment (i) a deviation ON TOP of that — what the spine derived,
  page nudges included — or (ii) does the spine IGNORE the page's nudges once spine properties exist?
  Suggested: (i), because it keeps today's behaviour and the spine value stays a small correction.
- **C. Where spine adjustments are STORED.** In the score JSON (then the shape itself belongs there too — #18,
  which he said is *"not yet"*) or only for the session (lost on reload). Decides whether this waits for #18.
- **D. The panel's own drag.** Today a press ANYWHERE on the panel drags the panel (`dev/spineConsole.makeDraggable`)
  — a click-to-select needs that moved to a handle (a title bar) first.

### 9.4 Facts found while planning (so the build does not rediscover them)

- The panel is `dev/spineConsole.ts` — scaffolding wired by `App.ts` (`__spine`); it redraws by POLLING the
  model's JSON every 300 ms (`POLL_MS`) and on a font switch. A click handler and the hit registry are rebuilt
  on each redraw.
- The picture may be inside ONE `scaling(zoom · size)` group — a click must be divided by that factor before
  `locate` (the music is drawn in its own units, §3b).
- ⚠️ `lint:boundary`: `engine/` may not import `interactions/` or `dev/`. So the `(s, d)` hit registry is
  ENGINE (`rendering/eye/`, pure), and the part that writes the selection lives on the editor's side of the
  line — ⚠️ `dev/` today, and when the panel stops being scaffolding, a real `windows/`/`interactions/` home.

