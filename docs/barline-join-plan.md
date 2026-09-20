# Continuous barlines — joining the staves of a system

**Status: ✅ P1 + P2 + P3 BUILT (2026-08-28), plus the gap ink made CLICKABLE (§4a).** Select a barline, and one
blue square appears at the end of the line you pressed; pull it past the middle of the gap and the
gap FLIPS — an unjoined one joins, a joined one comes apart. ⏭️ What is left is §7 and P4 (the
per-boundary mix, Mensurstrich, instrument-aware defaults). The research is
`docs/barline-join-research.md` (three agents, 2026-08-28, sourced) — ⛔ read it before re-asking any
question below; do not re-run it.

**What is on disk:** `StaffInfo.barlineJoinBelow` · `engine/models/barlineJoin.ts` (the resolver +
the write) · `engine/rendering/barlineGap.ts` (the ink) · one call at each of `renderBarlines`' three
draw sites · `HighlightController` lighting gap ink with the sign's, and painting the square ·
`interactions/elements/barlineJoinHandles.ts` (where the square is, what a press grabbed, what the
cursor then means) · `MouseController`'s `barlineJoin` drag · `MusicEngine.setBarlineJoinBelow` +
`barlineJoinsBelow` + `previewBarlineJoinBelow` / `commitBarlineJoin` · the `'barline-gap'` hit box
(§4a).

⭐ **Read against the CODE on 2026-08-28, and the corrections are folded in where they belong** (§1's
constants, §2.1's affordance count, §2.3's default, §2.4's `staffId`, §3's drawing hazards, §4's
handle pattern + the highlight + the preview seam). Each is marked 🚨/⚠️ at its own bullet and names
what in the source says so. ⛔ Do not re-derive them from the engine sources — they came from this
repo.

⚠️ **One suspicion was RAISED AND THEN CLEARED BY MEASUREMENT** — `drawSystemConnector` reading a
possibly-stale stave y (§3). It is correct, and *why* it is correct is the thing this module needs
to know, so the finding is kept as an answer rather than deleted as a false alarm. ⛔ Do not re-open
it; ⛔ do not read it as permission to copy the connector.

---

## 0. What this is, in one line

**A barline that runs unbroken through the gap between two staves, and the square you drag to say
so.** His ask, 2026-08-28: *"the case we want to make continuous barlines between two or more
staves"*, and the gesture is his: *"we can follow Sibelius idea"*, with our blue.

**The decision record, his words, in order:**

- *"default join is join all barlines"* — 🚨 **and this plan MISREAD it once, so read it carefully:
  it is about the default reach of the GESTURE, ⛔ not the state a score starts in.** When you join,
  you join every barline in the score; ⛔ NOT per boundary in this plan. His correction, 2026-08-28,
  when the first build defaulted everything to joined: *"default should be not joined"*, then
  *"there was a misunderstanding… default gesture is joining all barlines"*. ⇒ **a fresh multi-staff
  score is NOT joined anywhere**, and every staff keeps its own barlines until someone asks.
- *"later we will see in the future how we manage the contemporary cases, we just have to take care
  not restrict the model for that"* — §2's whole job.
- *"on the first stave the square is just in the bottom, in the last stave the square is in the top,
  the intermediate staves the square is both"*, and *"if just one staff in the system, we don't show
  the square"*.
- *"I like how we are doing today the barline space and we should keep it"* — ⛔ the bar-width drag is
  untouched by this plan. Not one line of it changes.

---

## 1. The gesture

⭐⭐ **A SQUARE EXISTS EXACTLY WHERE A GAP EXISTS.** That is the whole rule, and everything else falls
out of it as arithmetic:

| staff | squares |
|---|---|
| first of a system | bottom only |
| intermediate | top and bottom |
| last | top only |
| the only staff | **none** |

**So the count is `staves − 1` per system, per side, and a single staff produces zero because the loop
has nothing to iterate** — ⛔ never an `if (staves.length === 1) return`. Each square OWNS ONE GAP,
which is the same thing the model stores (§2), so there is no square a user can grab that the model
cannot express.

🚨🚨 **BUT THAT IS THE GEOMETRY, NOT WHAT IS SHOWN — P2 OFFERS EXACTLY ONE SQUARE, AT THE SPOT THAT
WAS PRESSED.** Built 2026-08-28, after he saw the table above drawn in full and reported it twice:
*"we should show the blue square just in the stave we clicked and not in all staves"*, then — asking
the research first — *"i'm having the impresion up and down is too much"* and **the rule that
settled it**: *"the spot to click is critical… if the user click in that area we show the blue square
related with that"*.

⭐ **That IS Sibelius's gesture, and the research already held the sentence** (§6, and it was read
back to him before this changed): *"Click carefully at the top or bottom of a normal barline… a
purple square 'handle' will appear"* (Reference 2022.3 §4.5 p. 343) — one handle, at the end you
clicked. MuseScore 4 shows one too: `BarLine::gripsPositions` returns exactly one grip, the top one
commented out in the source. ⇒ **the count is 1, not `gaps × 2`.**

- The press's HALF of the staff names the END — top half → the square above the staff, bottom half →
  the square below it. ⭐ Sibelius's *"click **carefully**"* is a precision we do not impose: its END
  is our HALF, so every press on the line answers one of the two.
- **A pressed end with no gap behind it offers NOTHING** (the top of the first staff, the bottom of
  the last). ⛔ Not a special case — there is no space there for a line to run through. The gap on
  that staff's far side belongs to its neighbour and is offered by pressing THAT line.
- ⚠️ The selection carries it: `SelectedElement`'s `barline` gained `staff?` + `staffEnd?`, ⛔ **not
  as identity** — the boundary is still ONE system-wide selection, lit on every staff and deleted
  from all of them. Absent (a keyboard walk, playback's start line) offers every gap's squares rather
  than guessing a spot.

⚠️ **The affordance and the stored fact are still NOT 1:1, and the plan must not pretend they are.**
Two squares exist per gap and either writes the same `barlineJoinBelow` on the same upper staff, so
one gesture still writes **one score-wide field**. That is MuseScore's behaviour and what he asked for
(§6 finding 3 — nobody makes a plain drag local), but saying it out loud is what keeps §2.4 honest:
the day the per-boundary mix arrives it arrives as a **MODIFIER on this same gesture**, which is
MuseScore's Ctrl+drag (`barline.cpp:675`, already in the research). ⭐ So P3 leaves Ctrl+drag
unclaimed rather than discovering later that it is spoken for.

🚨🚨 **THE DRAG FLIPS THE STATE — ⛔ IT DOES NOT SET AN ABSOLUTE ONE.** His rule, 2026-08-28, from the
running app: *"somehow the gesture should be oposite to the state… i have two staves, go to the first
and go down and join, correct; then if i go to the second and go up i should be able to disjoin cause
is already joined"*. ⭐ **And it is what makes every square live**: the first build read the pointer
absolutely (past the middle = joined), so a square on an already-joined gap did **nothing at all**
when pulled — the answer was already `true`. A handle you can see must do something when you pull it.

| grabbed square, gap was | pulled past the middle |
|---|---|
| not joined | **joins** |
| joined | **disjoins** |

- ✅ **HOW FAR: PAST THE MIDDLE OF THE GAP** (P3, built 2026-08-28). ⭐ The music's own geometry is the
  threshold, so there is no constant to tune and no dead zone to pick: the grabbed end has crossed
  most of the space it would fill, or it has not. ⚠️ It is also **more forgiving than either
  reference** — Sibelius and MuseScore want the handle dragged the whole way onto the next staff —
  and forgiving in the direction that costs nothing, since a mistaken join is one drag back.
  ⛔ **And no time threshold**, unlike every other handle drag here: the decision is a POSITION and
  not a delta, so a press that never moves is still on its own side of the middle and a click cannot
  flip anything.
- **Coming back before the middle restores what was there**, so a drag can always be called off by
  returning to where it started. ⭐ That is where his earlier *"important disjoint should be also
  managed here"* landed: ONE square still does both directions, but the pair is **pull to flip /
  come back to cancel** rather than the *away joins, back disjoins* that sketch guessed.
- The squares appear **only while the barline is selected**, like every other handle here.

**⛔ THE BAR-WIDTH DRAG IS UNCHANGED.** Drag the LINE sideways → bar width, exactly as today. Drag the
SQUARE → the join. Two targets, so there is no threshold to tune, no axis lock, no modifier needed to
tell the two apart, and no way for a width edit to join two staves by accident. ⭐ And nothing has to
keep the square's ground vacant: it is armed in a `MouseController` **PRE-STEP**, before the hit chain
runs at all, so the square wins any press it covers.
⚠️ **The barline's own box grew a little in both directions on 2026-08-28** — `BARLINE_PRESS_PAD_PX`
= 6, his report: *"the point is dificult to reach, it is very co[mm]on that is confused by a whole
meassure selection… not too much but a tyni"*, and *"i mean in general"*. That retired the older rule
(*"pads horizontally only — a click in the gap between two staves is on no barline at all"*), which
was written when the gap held nothing and the ends of a line meant nothing to aim at. ⛔ It is still
far short of the staff band's 12 px, so a press out in the gap reaches the music behind it.
(§2.1 does reserve a modifier, for a different question: not *which gesture*, but *how many
boundaries it reaches*.) ⚠️ That separation is the reason for the square:
the two gestures author **different categories** — width is INK (an engraving override), a join is a
MUSICAL statement about the ensemble — and a mis-swipe must not cross that line.

**The style is one we already own**, not a new one: the hairpin / ottava / trill endpoint squares are
`#2563EB` with a white stroke, `#1D4ED8` (`INDICATOR_INK`) when armed. ⚠️ The half-side is
**`SLUR_HANDLE_R + 1` = 6**, and the hit half-extent is a SEPARATE constant,
`SLUR_HANDLE_HIT` = 9 — `SLUR_HANDLE_R` itself is **5** (`HighlightController`), so quoting it as
the square's size is off by the `+ 1` every one of those four modules writes. ⭐ Sibelius's is
purple; ours is the blue every non-note selection in this editor already uses.

✅ **The two things P2 owed, both decided 2026-08-28:**

1. **WHERE it sits: 10 px outside its own staff's line**, centre to ink — the same air the hairpin's,
   ottava's and pedal's squares use (`BARLINE_JOIN_HANDLE_GAP_PX`), ⛔ not the gap's midpoint. His
   spec attaches the square to a STAVE (*"on the first stave the square is just in the bottom"*), and
   the default stride leaves ~110 px of gap, so hugging the staff is unambiguous about which staff it
   belongs to.
2. **What it looks like when the gap is ALREADY joined: exactly the same square** — his call,
   *"always the same square"*. The ink crossing the gap is what says a gap is joined; the square only
   ever says *grab here*, which is what keeps a joined gap grabbable.

🚨 **And a third the plan had not seen, from his eye on the running app**: *"i have the feeling the
blue square is not centered regarding the barline"*. Measured, and right — **the square centres on
the sign's INK, ⛔ never on the boundary COORDINATE**. A plain stroke sits at `[boundary, boundary +
0.16sp]`, so a boundary-centred square is 0.8 px left of its own line; a final bar's and an end
repeat's strokes are **entirely left** of the boundary, which would have stood the square ~5 px off.
⭐ It is the STROKES' span and never the dots — the same ink `barlineGap` draws, since the dots do not
cross (`barlineJoinHandles.strokeCentrePx`).

---

## 2. The model — ⭐⭐ THE PART THAT MUST NOT RESTRICT THE FUTURE

### 2.1 The join is a fact about a GAP at a BOUNDARY

Not about a staff, not about a group, not about a barline sign. *"Between staff 2 and staff 3, at the
line ending bar 12, is there ink in the gap?"* Everything asked for falls out of that one question —
the default (every gap, every boundary), the contemporary mix (one gap, one boundary), and the
partial case a group-wide boolean **cannot say at all**: staves 2–3 joined while staff 1 stands alone.

### 2.2 What P1 stores

**`StaffInfo.barlineJoinBelow?: boolean`** — *"my barlines continue into the gap below me"*.

- ⭐ **Gap-keyed by the upper staff** — 1:1 with the GAP (⚠️ not with the square: §1 puts two of those
  on every gap), and the same key as MuseScore's own field (`Staff::m_barLineSpan`, a bool meaning
  exactly this — research Part 2).
- **Absent = the default** (§2.3), so a fresh score stores nothing and old JSON keeps loading:
  `docs/json-io-plan.md`'s *"a new feature lands as an optional field whose absence is a legal score"*.
- ⛔ **Not on `Score`** — principle 6: a `Score.barlineJoin` would silently mean "the join at bar 1".
- ⛔ **Not a boolean on `StaffGroup`** — it cannot express §2.1's partial case, and the research kills
  the assumption it rests on: **the bracket does not own the join.** LilyPond proves it structurally
  (`GrandStaff` differs from `StaffGroup` in the delimiter only, `ChoirStaff` in the span bar only —
  two independent knobs); Sibelius says the two coincide *"often, but by no means always"*.

### 2.3 The default, and where it comes from

**NOT joined, for any gap** — his call, 2026-08-28: *"default should be not joined"*. A fresh score
stores nothing at all, and `barlineJoinsBelow` answers `false`, so every staff keeps its own
barlines exactly as it does today. A single staff has no gaps, so the question is silent there too.

🚨 **This plan had it the other way round for one build, and the misreading is instructive**: it
took *"default join is join all barlines"* for a statement about the default STATE. It is a
statement about the default SCOPE of the gesture — read it beside the bullet that follows it in §0
(*"⛔ NOT per boundary"*) and there is no other reading available.

⭐ **It is also the conservative landing, which is why nothing in the suite moved when it flipped.**
An absent field draws exactly today's picture, so P1 changed no existing test, no `barlines()` count
and no bar's spacing — the whole feature is inert until someone asks for a join. ⇒ the joined-vs-not
question comes back where it belongs: as an INSTRUMENT one.

⚠️ **⛔ Not stated as "every gap inside a staff group" either**, in any direction: that sentence
cannot be tested. `ScoreModel.ensureSingleGroupSpansAllStaves` keeps exactly ONE group spanning
every staff and clears the overlay below N=2 — a separate group is a §10 future-open op that nothing
performs — so today there is no gap that is *not* inside a group, and a reader who sees a group
clause will think a group boundary already does something.

⏭️ The refinement the research names but this plan does not build: **vocal staves are NOT joined** by
default in every program surveyed (piano joined, orchestral joined per family, choir not). That is an
INSTRUMENT question and we have no instrument object — `docs/instruments-plan.md` is where it lands.

### 2.4 ⭐⭐ HOW THE FUTURE STAYS OPEN — the resolver carries the boundary from day one

**One function, and every reader asks it:**

```ts
barlineJoinsBelow(score, staffId, measureNumber): boolean
```

⭐ **A staff `id`, ⛔ never an INDEX.** The field lives on `StaffInfo`, which is keyed by identity,
and `resolveStaffSize(score, staffId, openingMeasureId?)` — the resolver §2.4 is modelled on — takes
one for that reason. An ordinal is one renumber away from being wrong, and this repo has already
paid for that once (the key-signature override key built from an ordinal, which stored what the read
never looked up and returned `true`). The renderers hold a `staffIndex`; `staffIdAtIndex` /
`staffIndexOfId` (`engine/models/staffContent.ts`) is the conversion, and `MusicEngine.setStaffSize`
already does exactly this at the facade.

⭐ `measureNumber`, on the other hand, IS the house address for a boundary — every one of
`barlineOps`' reads and writes takes one (`barlineAt`, `boundarySign`, `setBoundaryWinged`,
`addRepeatAtBoundary`), so the resolver speaks the same language as everything it will sit beside.

`measureNumber` is in the signature **from the first commit, although nothing varies by it yet.** That
is the entire trick, and it is what he asked for when he said not to restrict the model:

- ⛔ **We do NOT add a positional field now.** A field with no feature is a field nothing maintains —
  the reason `Measure.keys` was deliberately left out of key signatures P1. §2 of
  `docs/barline-types-plan.md` did the opposite (it stores a staff scope nothing reads) and §10 lists
  that as a smell. This plan takes the first road.
- ⭐ **What forecloses a future is a READER THAT ASSUMES, never a field that is missing.** With the
  boundary already in the signature, the day the mix arrives the storage lookup changes inside this
  one function and **not one caller moves**. Same shape as `keyAt` / `resolveStaffKeys` /
  `resolveStaffSize` / `alterInForce`: readers ask the function, ⛔ never the shape of the storage.
  ⭐ `resolveStaffSize` is not an analogy — it is this trick already running, down to the
  `void openingMeasureId // reserved` line and the header that says *"three parameters, used with
  two"*. Copy that, comment included, so the unused argument reads as a decision and not as debris.
- ⭐ Two of the three engines that can be EDITED already implement exactly *default + exception at a
  boundary* — MuseScore's per-instance `spanStaff` (which layout re-seeds from the staff **until the
  user touches it**, `barline.cpp:901`), LilyPond's positional `\once \override
  Staff.BarLine.allow-span-bar = ##f`. So the future this leaves open is one two engines shipped.

### 2.5 The return type is where Mensurstrich will grow

P1 answers a boolean. ⚠️ The honest primitive is **per SEGMENT of the vertical run** — joined = every
segment inked, normal = staff segments only, **Mensurstrich = gap segments only** — which is how
LilyPond and Verovio both draw it (each draws the gap as its own thing). ⛔ Not built, not stored, and
the note is here so the boolean is understood as a NARROWING and not as the shape of the world.
🚨 **Mensurstrich is absent from all four treatises we hold** (grepped: Gould, Ross, Stone, Gerou &
Lusk — three hits, none about barlines), so its rules would have to come from the engines.

---

## 3. The drawing

- ⭐⭐ **THE LINES RUN THROUGH, THE DOTS DO NOT.** Already ours (`barline-types-plan.md` §4.5, 3 of 3
  engines) and now **confirmed in the source**: LilyPond makes the `:` a literal-space replacement in
  the span glyph (`scm/bar-line.scm:1312`), Verovio's `DrawBarLineDots` sits only inside the per-staff
  branch. So a repeat's dots stay on each staff and only the strokes cross the gap.
- 🚨🚨 **THE GAP SEGMENT MAY NOT BE DRAWN INSIDE `inStaffSpace`.** `BarlineRenderer.drawSign` paints
  within a per-staff SCALE group, and a line crossing two staves belongs to neither — a 0.7 small
  staff breaks it immediately (`docs/staff-size-plan.md`'s rule: a gap inside `scale(k)` must be
  ÷ k). The gap segment is drawn in SCORE space.
- 🚨🚨 **ITS y COMES FROM THE PLACEMENTS, NEVER FROM THE STAVES.** A reused bar's `Stave` reports where
  it was last PAINTED (`BarlinePlacement.x`'s header, and the report that produced it: *"the final bar
  … stolen from the first stave"*). Top of the gap = the upper placement's bottom line, bottom = the
  lower placement's top line, both shifted by `staleShift`.
  ⭐⭐ **AND THE NEIGHBOUR IS NO PRECEDENT — ITS EXEMPTION IS EXACTLY WHERE THIS MODULE'S SHELTER
  ENDS.** `ScoreRenderer.drawSystemConnector` is the closest thing on disk to this module and it
  reads its y straight off the stave — `top.stave.getYForLine(0) * top.scale`, **no `staleShift`** —
  the placement for x, the stave for y. ⚠️ **CHECKED, 2026-08-28, and it is correct**, for a reason
  worth knowing before this module is written:

  > **A first-in-line bar of a multi-staff score is NEVER translated.** `if (multiStaff &&
  > plan.isFirstInLine) return` in the reuse decision sends it down the rebuild path, where
  > `registerTier1` builds a brand-new `Stave` at the plan's own coordinates. A connector is drawn
  > *only* at `isFirstInLine && staffIndex === 0` on a multi-staff score ⇒ **both** of its endpoint
  > staves are fresh, every render, and there is no stale y for it to read.

  Measured in the browser to be sure: staff 1 at `top 210.5 / bottom 250.5`, connector `60 → 251`;
  after a staff-spacing nudge, staff 1 at `610.5 / 650.5`, connector `60 → 651`.

  🚨 **The gap segment gets none of that.** It is drawn at EVERY boundary, and a bar that is not
  first-in-line **is** translated with its stale stave (`placements.push({ ...plan, stave:
  reused.snapshot.stave })`). So the rule above is not defensive boilerplate copied from a
  neighbour — it is load-bearing precisely where the neighbour's exemption runs out, and ⛔ reading
  the stave "because the connector does" is how it would be got wrong.
- 🚨 **WHAT WEIGHT, AND IN WHOSE STAFF-SPACE — the one number the small-staff rule actually bites on.**
  Every part of a sign is stated in `space` units (thin 0.16, gap 0.32, thick 0.50 — `barlineSignParts`),
  and between a size-1 and a size-0.7 staff there are **two `space`s and no third**. ⭐ The answer is
  already written for the line beside it: `drawSystemConnector`'s *"its width is deliberately NOT
  scaled; a system bracket belongs to the system, not to either staff's ink"*, at `THIN_BARLINE_PX`
  — which is MuseScore's `Sid::scaleBarlines = false` in one sentence. So the gap segment is
  **SCORE-space ink at the score's own staff-space**, and ⚠️ that deliberately makes it a different
  weight from a small staff's own line, which `drawSign` DOES scale. `BarlineRenderer.drawSign`'s
  closing note names this as the day to revisit that; the honest answer for now is that the two
  disagree and the disagreement is recorded here.
- 🚨 **THE HINTING PASS HAS TO BE TOLD ABOUT IT.** `hintBarlines` collects `g.stavebarline rect`,
  rounds each onto whole device pixels, skips any rect whose parent carries `data-no-hint`, and on
  first sight skips any rect that is not exactly `THIN_BARLINE_PX` wide. ⇒ the gap segment must join
  that scheme **deliberately, matching the sign above it**: hinted for a plain line — or the gap
  stroke lands at a different sub-pixel phase from the staff strokes it is supposed to continue, a
  visible jog exactly where the eye is looking — and `data-no-hint` for the composite kinds, whose
  strokes are hinted as a whole or not at all.
- 🚨 **`invisible` AND THE AUDIENCE.** `drawSign` ends with `applyHiddenTreatment(group, audience)`.
  Without the same call on the gap segment, an invisible barline becomes visible between the staves
  and PRINTS — the one thing `docs/pdf-export.md`'s *hidden = gray on screen, OMITTED in print*
  forbids. One line, and it belongs in P1's done-when, not in a later tidy-up.
- **Where it goes:** a module of its own, not a branch in `drawSign` — the extent is already a
  parameter there (`SignStaff.topY/botY`), so the per-staff paint is untouched and the new module owns
  only the segment between two staves. ⭐ MuseScore takes the other road (the upper barline simply
  draws longer, `barline.cpp:284`); LilyPond and Verovio both draw the gap separately, and so do we —
  because of the scale-group rule above, which neither of them has.
- ⏭️ **The WINGS rule needs revisiting when this lands.** They are drawn on every staff today on his
  call — *"we still have separate barlines for every stave"* — and `BarlineRenderer.renderBarlines`
  already carries the note that this is the line to revisit *"the day span bars arrive"*. Both other
  engines show one pair, top and bottom, once the line is continuous.

---

## 4. Selection, hit-testing, undo, JSON

- **The squares are a MODULE** — `interactions/elements/barlineJoinHandles.ts`, exactly as
  `hairpinHandles` / `ottavaHandles` / `pedalHandles` / `trillHandles`. ⛔ Not a per-kind slice inside
  `HighlightController`.
  🚨 **AND THAT PATTERN IS NOT A ROW IN `ELEMENT_SPECS`** — an earlier draft of this plan said it was,
  and the code says otherwise: `chain.ts` imports `HAIRPIN_ELEMENT`, ⛔ never `hairpinHandles`, and
  its own header spells the arrangement out — *"its endpoint HANDLES are a pre-step drag, also
  outside"*. What those four modules actually are is **two seams and no table row**:
  - **PAINTED + REGISTERED by the highlight**, `HighlightController.applyHairpinHandles` — it draws
    the square and `registry.add`s a hit entry of its own, which `clearHighlights` takes away again
    (the render never draws one);
  - **ARMED BY A PRE-STEP** in `MouseController` (`armHairpinEndpointAt`), which runs BEFORE the
    chain, so the square answers the press without competing in `ELEMENT_HIT_ORDER` at all.

  ⭐ That is also right on the merits: a join square is **not a selectable element**. There is no
  `SelectedElement` kind for it and this plan adds none — a row in `ELEMENT_SPECS` would force a
  22nd kind into the union and contradict the next bullet.
- The `barline` element keeps its current meaning (one system-wide selection per boundary); ⛔ nothing
  about `interactions/elements/barline.ts` changes in P1.
  ⚠️ **True, and misleading on its own: `HighlightController` DOES change, in P1.**
  `recolourBarlineHalf` finds a sign's ink by group id — `barline-<measure>-<staff>-<end|start>`,
  looped over staves `0…N−1` — so a gap segment drawn in a group of its own is **invisible to it**,
  and a selected barline on a joined system lights blue on the staves and stays black through the
  gaps. 🚨 That is the *"are we overlapping the blue to another black barline?"* report of
  2026-08-26 coming straight back. ⇒ P1 owes three things with the gap segment, not after it: a
  group-**id scheme** for gap ink, `data-half` on its strokes (a `:||:`'s gap ink has halves like
  everything else in that sign), and the matching read in `recolourBarlineHalf`'s `groupFor`.
- 🚨 **The drag must end on a release it cannot see** (pointer capture / window listener) — the trap is
  written down and has bitten this repo before.
- 🚨 **THE PREVIEW IS A RENDER, ⛔ NOT A GHOST.** An earlier draft said `GhostRenderer`, and that is
  the wrong seam: `ToolGhost` / `GHOST_DRAWERS` is the table of what an **armed MARKING TOOL** will
  do to *the next click* (`engine/rendering/ghostTypes.ts` — *"a `MarkingTool` says what the NEXT
  CLICK will do; a `ToolGhost` says what is on the page now"*), and a join drag is neither armed nor
  a tool. ⭐ The house pattern for a DRAG preview is the bar-width drag's, one gesture over: write
  the provisional value and `renderScore()` (`previewBarWidth` → `RenderController.renderScore`).
  For a join that is both cheap and exact — the barline pass is rebuilt from scratch every render
  anyway, so the preview and the committed picture are drawn by the same code.
- **Undo:** one entry per drag, and the write goes through a mutator like every other. ⭐ The shape is
  `MusicEngine.setStaffSize`'s, line for line: resolve the id, call the model, then **`saveOnly`** —
  ⛔ never `commit`. A join is INK; it changes no note's time, so there is nothing for playback to
  resync (`barlineOps`' own rule for the signs).
- 🚨 **AND `saveOnly` IS ALSO WHAT MAKES THE RENDER HAPPEN.** `RenderController` only re-engraves
  `if (engine.isRenderStale())` — `modelDirty || viewStateKey changed` — so a join written outside a
  mutator would be a **picture-only change nobody records**, and the page would simply not move
  (`reference_only_a_stale_render_runs`: it must be in `viewStateKey`, and ⚠️ e2e cannot catch it).
  Going through the model sets `modelDirty` and the question never arises.
- **JSON:** one optional field, absence legal, ⛔ no migration — `docs/json-io-plan.md`.
- **Geometry is not a unit test.** The gap ink is browser geometry: `e2e/*.e2e.ts` asserts the strokes
  cross the gap and the dots do not; jsdom asserts the resolver and the handle POSITIONS' arithmetic.
  ⚠️ **And P1 moves an existing count.** The harness's `barlines()` reads `g.stavebarline rect`,
  which is STROKES and not lines (its own note) — so joining by default adds rows to it on every
  multi-staff fixture. Those counts change **deliberately, in the same commit**, or "each phase
  independently green" is not true of P1.

---

## 4a. ⭐⭐ THE GAP INK IS PART OF THE BARLINE YOU CAN CLICK

His ask, 2026-08-28, once the join was working: *"if the barline is join and i click on in the empty
space of the two staves i want to be able to select it too and move and do the normal barline
operations"*. A joined barline is ONE line to the eye, so it must be one line to the hand.

- **It registers a `'barline-gap'` hit box where it DRAWS**, `registerRepeatStart`'s arrangement and
  for its reason: only the drawing knows both that the join is on and that ink actually landed. ⇒ the
  entry's existence IS the "is it there?" test, so ⛔ **no `isPainted` filter** at press time (and the
  filter would be wrong as well as redundant — the bar a gap's line *ends* is not always the bar that
  drew it). An unjoined gap registers nothing, because nothing is drawn there.
- **The box is the STROKES' span**, ⛔ never the sign's full extent: the dots do not cross the gap, so
  a box that reserved room for them would answer presses over blank paper.
- 🚨 **`BarlineGap.endsMeasure` is computed by the DRAWING LOOP, because only it can.** A sign at a
  bar's end ends that bar; one at its start is *normally* the boundary ending the bar before — except
  for the two cases that loop already distinguishes, a **displaced** `|:` (standing inside its own bar,
  past the header) and a **system-opening** `|:` (whose boundary is at the end of the line above).
  Both pass `null` and register nothing: the ink is drawn, it is simply not a barline you can click
  *there*. ⛔ Never `measureNumber − 1` unconditionally.
- **It resolves to the SAME selection** — the one system-wide `barline` element, with the same width
  drag armed. ⛔ Not a second `SelectedElement` kind; `elements/barline.ts` just counts these boxes as
  candidates beside the tier-1 ones, and the barline being LAST in `ELEMENT_HIT_ORDER` is what keeps a
  hairpin or a dynamic sitting in that same gap ahead of it.
- ⭐⭐ **But a press out there shows NO join square** — his call, same day: *"when i select the barline
  in the midle, in the white space i dont need to see the square, the square is related just to the
  stave"*. A handle marks the END of a staff's line; in the gap there is no end, and the line you
  would be reaching for is already there. That is `pressedAt: 'gap'` on the selection — ⛔ and it is
  **not** the same as an absent spot, which means *nobody said where the press was* and offers every
  square.
- ⚠️ **The registered box and the drawn ink differ by up to a pixel in WIDTH**, on purpose:
  `hintBarlines` rounds a thin line onto whole device pixels *after* registration (1.6 → 2). Chasing
  that would make the registry describe the device instead of the score, and the press pad is 6 either
  way. `e2e/barlineJoin.e2e.ts` asserts the agreement to the pixel.

---

## 5. Phases (each independently green)

| | what | done when |
|---|---|---|
| **P1** ✅ **BUILT** | The resolver (§2.4) + the gap segment DRAWN, in its own module + the model write path it needs to be visible at all. No squares, no drag. | ✅ A JOINED two-staff score shows continuous barlines and an unjoined one is untouched; a repeat's dots stay per staff; a small staff's join is not distorted; the gap ink is findable under the id the selection highlight looks up and carries `data-half`; an `invisible` one is tinted, not black. 6 e2e + 13 unit, and ⭐ **no existing test moved** — the default being OFF is what makes P1 inert until asked for. |
| **P2** ✅ **BUILT** | The square, PAINTED on a selected barline — the highlight's own node + registry entry, the pre-step's target. No drag. | ✅ **ONE square, at the staff and END that were pressed** (§1, his rule); none where that end has no gap, none at N=1, none for a `repeatStart` selection; it centres on the sign's INK and looks the same joined or not; the entry is keyed by the staff ABOVE the gap and comes off with the highlight layer. `interactions/elements/barlineJoinHandles.ts` + `HighlightController.applyBarlineJoinHandles` + `SelectedElement.barline.staff/staffEnd`. 21 unit tests; 5546 green. |
| **P3** ✅ **BUILT** | The DRAG — join and disjoin, writing `barlineJoinBelow` for the whole score, one undo entry, a live preview. | ✅ Pulling the square past the gap's middle FLIPS that gap (⭐ *"the gesture should be oposite to the state"* — an already-joined gap comes apart, which an absolute reading could not do); coming back before the middle cancels; every frame is a PREVIEW and the drop commits **once, and only if the gap ended up different** (a crossing that came back files nothing); the press selects nothing, so the barline stays picked and the square stays on screen; the width drag is untouched; **Ctrl+drag stays unclaimed** (§2.1). `MouseController.armBarlineJoinDrag/handleBarlineJoinDrag/endBarlineJoinDrag` + `MusicEngine.previewBarlineJoinBelow`/`commitBarlineJoin`/`barlineJoinsBelow` + `barlineJoinGrabAt`/`joinedAtPointer`. ⛔ `__barlines.join()` is **deleted** — the square is the door now. 5562 unit + 263 e2e. |
| **P4** | ⏭️ **NOT THIS PLAN** — the contemporary mix (per-boundary exceptions), Mensurstrich, the vocal default, the wings rule. | — |

---

## 6. What the research settled — and what it could not

Full record + citations: `docs/barline-join-research.md`. The five findings this plan rests on:

1. **Sibelius does drag, and does show a square** (Reference 2022.3 §4.5 p. 343: *"a purple square
   'handle' will appear… Drag the handle up or down the system"*), and MuseScore 4 has the identical
   gesture — `BarLine::gripsPositions` returns exactly one grip, at the bottom.
2. **Dorico, Finale and LilyPond do NOT treat it as a barline property**: Dorico derives it from the
   ensemble (override: Formatting ▸ Change barline joins), Finale's Group Attributes has a three-way
   *Only on Staves / Through Staves / Only Between Staves (Mensurstriche)*, LilyPond swaps engravers.
3. **Nobody makes a plain drag a purely local edit** — MuseScore's plain drag writes the STAFF's span
   (whole score) with **Ctrl** for the single barline (`barline.cpp:675`); Sibelius cannot vary it at
   all (*"This affects every system in the score simultaneously"*), nor can MusicXML.
4. **The bracket does not own the join** (§2.2).
5. **Defaults**: piano joined, orchestral joined per family, **vocal not joined**.

⛔ **UNKNOWN, with the routes that failed** (research §9, 25 entries): Sibelius's and Dorico's ORGAN
defaults; Finale's per-ensemble defaults (*not stated anywhere in its manual*); MuseScore's
`instruments.xml` values (unfetchable, 786 KB, every route); Mensurstrich in the treatises (absent).
⚠️ Also found: MuseScore's MusicXML importer silently collapses `Mensurstrich` to `yes` and never
exports it, so it does not round-trip.

---

## 7. Not in this plan

Brackets and braces (still unrendered — and per §2.2 the join does not wait for them), instrument-aware
defaults, the per-boundary mix, Mensurstrich, per-staff barline SCOPE (`barline-types-plan.md` §2,
stored and unread — a different question: which staves a SIGN applies to, not where the line runs).
