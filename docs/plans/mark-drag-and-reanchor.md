# Dragging a mark, and what re-anchors it

*2026-08-30. His reports through one afternoon, what MuseScore does instead, and a decision he has
NOT taken yet.*

⚠️ **This is research plus an OPEN QUESTION — ⛔ not a plan of record.** The last section is the
decision, and it is his. Nothing here authorises adopting MuseScore's model.

## What he reported

Dragging a hairpin or an octave line vertically in the Prelude (35 bars, two staves, three sheets):

1. *"i'm not seeing the hairpin while dragging"* — it had jumped to another **page**. Fixed
   (`a86966c`): a y does not name a system, and with sheets side by side it does not even name a page.
2. *"i'm dragging the hairpin length but it is refusing to grow, it gets stuck"* — a 1px vertical
   wobble made the band refuse the whole write, horizontal included. Fixed (`95c030b`).
3. *"why can i not make the 8va go up once it is down?"* — the room above a staff was being measured
   against staves on other sheets. Fixed (`f51f76a`).
4. *"the resistance i'm having to go to the top staff… my mouse y is changing and changing and i'm
   still in the down staff"*, then *"the position of the pointer is not in sync with the drawing…
   that makes me think that the solution for changing staff is not correct"*.

⭐ **The fourth is not another instance of the first three.** It is the model.

## The model we had, and why it deadlocks

A vertical drag was two rules that never met:

- **A BAND** clamped the ink to the room between the mark's own staff and its neighbours
  (`MusicEngine.nudgeStaysInBand` → `layout/systemBand`). At the edge, further travel was REFUSED.
- **A JUMP** re-assigned the staff when the ink passed *halfway* to where the mark would sit on the
  next staff (`interactions/walks/markSystemJump.systemStopFor`).

`markSystemJump`'s header claims the two "meet exactly: the band refuses the ink at the same halfway
line the jump fires on." **They do not.** The midpoint lies OUTSIDE the room the band allows, so the
ink is pinned at the ceiling while the hand travels on: his log shows the wedge stuck at `ink 316…339`
with `dy` climbing `0.14ss → 4.86ss` — five staff-spaces of dead travel — before anything happened,
and a ping-pong once it did.

## What MuseScore does (read on disk, `~/dev/engine-sources/MuseScore` @ `929d1e9`)

### 1. The ink tracks the cursor, 1:1, and nothing else

`NotationInteraction::drag` recomputes from the *current* point each move
(`notation/internal/notationinteraction.cpp:1140-1177`), and for a line the whole of it is:

```cpp
// dom/line.cpp:814 — LineSegment::drag
setOffset(offset() + ed.evtDelta);
setOffsetChanged(true);
rebaseAnchors(ed, Grip::MIDDLE);
```

Successive deltas telescope to `cursor_now − cursor_start`: drift-free by construction. A dynamic
(`TextBase`) goes through `EngravingItem::drag` (`dom/engravingitem.cpp:2248`), same shape.

### 2. There is NO band. None.

`LineSegment::drag` clamps nothing — a hairpin or ottava drags through and past the other staff. The
only clamp in the whole drag path is guarded by `if (isTextBase())` and stops at the **page
rectangle** (`dom/engravingitem.cpp:2276-2310`). No room-between-staves, no refusal, no snapping.

### 3. ⭐⭐ The staff is NEVER re-assigned by a drag — the vertical is deliberately DISCARDED

This is the sharpest finding. Before any re-anchor search, MuseScore overwrites the y with the
mark's *own* staff's y:

```cpp
// dom/line.cpp:673 — LineSegment::rebaseAnchors, Grip::MIDDLE
cpos.setY(system()->staffCanvasYpage(l->staffIdx()));   // prevent cross-system move
// dom/line.cpp:448 — findSegmentForGrip: "Restrict searching segment to the correct staff"
pos.setY(sys->staffCanvasYpage(oldStaffIndex));
```

A generic *"which staff is this point on"* exists — `System::searchStaff`, a 0.5 midpoint rule
(`dom/system.cpp:440`) — and every mark-drag call site neutralises the y so it can never be reached.
Only ticks change. Moving a mark to another staff is an **explicit command**, and only for notes
(`editing/editcrossstaff.cpp:35`). There is no drag-to-another-staff path for a dynamic, hairpin or
ottava at all.

### 4. Autoplace stays ON and ADOPTS the dragged position

No snap-back. Every frame sets `setOffsetChanged(true)`; at layout, `rebaseMinDistance` writes the
element's new clearance into `Pid::MIN_DISTANCE` and zeroes the correction
(`rendering/score/autoplace.cpp:361-365`). Autoplace keeps protecting the mark from *other*
collisions, but the drag redefines where "engraved" is. Autoplace is disabled only by Alt
(`dom/engravingitem.cpp:2238`).

### 5. The one geometric side-test — and it is about the mark's OWN staff

```cpp
// rendering/score/autoplace.cpp:294 — rebaseOffset
bool flipped = above ? r.top() > staffHeight : r.bottom() < 0.0;
```

Measured in staff-local coordinates against *its own* `staffHeight`, never a neighbour's, only for a
single-segment spanner, and with a compensating offset shift so the ink does not jump. ⭐ It never
changes the octave: an 8va drawn below the staff still sounds up (`dom/ottava.cpp:256`; the explicit
`Flip` toggles `Pid::PLACEMENT` only, `editing/flip.cpp:223`). Side and transposition are
independent — the placement is a styled default (`style/styledef.cpp:683`), not a consequence of the
type.

### The one-line summary

The cursor is the source of truth for **position and nothing else**; the staff is not a function of
the drag's y at all. The ping-pong is structurally impossible there.

## 🚨 What was in the tree that afternoon — RESET at his request

*"lets reset the musescore change and go where we where"* — `reset --hard 39edc65`. The commit that
made **the pointer decide the staff** went with it, and so did ~15 files of exploration. ⛔ Do not
re-apply any of it from memory: the premise (*should the anchor follow the hand?*) is the open
question at the foot of this file, and it is still his.

What that stretch is worth keeping for is written down instead:

- A jump's landing should be chosen by the mark's **own beginning**, ⛔ not by the hand.
- A **re-anchor must not move the drawing** — *"i was asking for reanchor but it should not jump, the
  difference it must be an offset"*.
- A staff's territory ends where its **INK** ends, ⛔ not at its five lines.
- Hysteresis must exceed the jump's own displacement or it does nothing.

## ⭐⭐ THE SECOND SESSION, 2026-08-30 — three changes, all EXPLORATORY

⚠️ **Still not a plan of record.** Each of these is one thing he asked for, made small enough to look
at, and each is marked ⚠️ EXPLORATORY in the code with the same date. The open question below is
UNCHANGED and none of this answers it.

### 1. A re-anchor does not move the drawing (`ottavaWalk.jumpStaves`, the DRAG only)

> *"it is jumping… a reanchor should not jump, should keep the same mark position as offset"*

Measured: the anchor went `195 → 251` with the offset **zeroed**, so the bracket leapt five spaces
sideways on a frame the hand had moved one pixel down. The landing now pays the anchor's whole travel
into the offset — the x from the two anchors' drawn edges, the vertical from the two staves' edge
lines — and the address changes under a drawing that stays where the hand has it. ⭐ Its own `dy` is
in that payment: a jump fires when the ink PLUS this frame's travel crosses the line, so a landing
that dropped the travel would settle a pixel back on the side it just left.

### 2. …and it MEASURES what the landing really did (`ottavaWalk.settleLanding`)

> *"there was a strange jump back and forth in a sweet spot… this kind of glitches should not happen"*

The ink alternated `390 ↔ 406`, one flip per mousemove. The payment above predicts the landing from
the staves' **edge lines**, which is only right if the engraver hangs the bracket the same distance
off both — and he does not: the same log shows a ladder gap of **26 px** on one staff and **41 px** on
the other. So the landing still moved the ink 15 px, and the decision reads that ink — **a decision may
not read a number its own outcome writes**.

⭐ The residual cannot be known before the render, so it is measured **after** it: a landing remembers
where the ink was meant to be, and the next frame pays whatever the re-render actually did (the drop
settles a landing made on the last frame). Two frames on, *"a re-anchor does not move the drawing"* is
true rather than nearly true, and the decision reads a number its outcome no longer writes.
⛔ Not hysteresis, ⛔ not an accumulator of the hand's travel — both were tried that afternoon and both
failed.

### 3. ⛔ THE OTTAVA ALONE: a hand-over waits for the middle of the WHITE SPACE

Two reports, one rule:

> *"the mark is still down the uppest element of the down staff and on the other size have not even
> reach the middle of the white space, so this reanchor is not correct"*

> *"as the ottava alsta is more closer to the upper element of the down staff and we are kind of the
> middle or more that the white space of the between we should reanchor"*

The rule that was there — *halfway between where the mark sits and where it would sit on the other
staff* — reads badly for a mark that hangs on the far side of its own staff: an 8vb's home on the
staff ABOVE is inside the gap, so for a treble ending at 316 and a bass ending at 501 the switch fell
at **y ≈ 428**, a third of the way up a gap whose middle is 388.

So a hand-over now **waits** until the ink has crossed the middle of the space between the two
staves' own music:

- `ElementRegistry.staffRuns()` carries `inkTop`/`inkBottom` per painted (system, staff) — the run's
  own **notes and rests**, stems and beams included. ⛔ Never a mark's box, or a dragged bracket
  carries the boundary with it and can never leave.
- `markSystemJump.pastTheMusicBetween` gates the natural rule on that. ⭐ Directional, so it reads the
  same both ways; the side (`shift` — 8va above, 8vb below, always derived) is the input the chooser
  already took, ⛔ not a second rule to write twice.

🚨🚨 **A GATE, ⛔ NEVER THE CHOOSER — and ⛔ ONLY THE OTTAVA.** Two mistakes, both his reports, minutes
apart:

1. *"the pedal is completly crazy… jumping randomly"* — measured, **eight hand-overs down the page in
   one gesture**. Nearest-by-ink as the chooser cannot work: a pedal is engraved 52 px below its
   staff where the staves' music is 105 px apart, so its own home IS the middle and every staff below
   it is nearer. ⭐ A mark's own home distance has to stay in the decision, which is exactly what the
   natural rule knows and a distance to the ink does not.
2. *"we were exploring ottava… does an ottava change the pedal? this should not happen"* — ⛔ right,
   and it did because `markSystemJump` is ONE module five families share. The gate is now opt-in
   (`SystemJumpPort.waitsForTheWhiteSpace`) and only `ottavaLane` opts in; the dynamic, the tempo
   mark, the wedge and the pedal are byte-for-byte what they were, specs included.

### And the landing lands near the MARK, not near the hand

> *"look at the draw of the anchor line… basically is anchored to a space in the score where there is
> nothing"*

Measured: the hand at x 290 while the bracket began at ~205, and each flip ratcheted the anchor
rightwards, `195 → 279 → 307`. `SystemJumpPort.inkX` (optional; supplied by the ottava only, for now)
makes the landing the onset nearest the **mark's own beginning**.

## ⭐⭐ AN ANCHOR THE USER CANNOT SEE IS A LIE

His rule, 2026-08-30, on the guide line pointing at blank paper:

> *"if the anchor is a space in the middle of nothing it is wrong, because we are giving false
> information to the user."*

⭐ This is wider than the drag, and it is not about rests as such — it is about **drawn ink**. The
anchor guide line exists to say *"this mark belongs THERE"*; drawn to a position that shows nothing,
it says something false, and the user cannot tell a real anchor from a bug.

⚠️ It bites here because a rest can be HIDDEN (`restHidden`, docs/plans/rest-hide-plan.md) and this score
carries several: the model has an onset, the picture does not. The same hole would open anywhere ink
is suppressed while a position survives.

⏭️ **Two ways to honour it, and they are not the same fix:**

1. **An anchor must be visible ink** — a position that drew nothing is not offered as an anchor to
   any route (drag, keyboard walk, creation). ⭐ The strong form: the model can never reach a state
   whose picture lies.
2. **The guide line refuses to draw to invisible ink** — the anchor may exist, but the line that
   claims it is suppressed. ⚠️ Weaker: the mark still hangs off something the user cannot find.

⛔ Neither is built. What IS built (see above) is narrower than both: a JUMP onto another staff will
not land on a rest.

## ⏸️ THE OPEN QUESTION — his call, STILL not taken (unchanged by the session above)

> *"still i'm not sure if we should adopt it"*

**Should a drag be able to change a mark's staff at all?**

- **Adopt MuseScore's model.** A drag moves ink and nothing else; the staff changes only by an
  explicit command; the only vertical rule is the mark flipping to the other side of *its own*
  staff. ⭐ This DELETES machinery — the jump chooser leaves the drag path, and the band stops
  fighting the hand. ⚠️ It also means dragging an 8va from one hand of a piano staff to the other
  becomes a command he has to learn, where today it is a gesture he expects.
- **Keep the drag re-anchor** (what is in the tree). ⭐ It matches what he reached for by hand and
  needs no new command. ⚠️ It is a rule with no precedent in the engine we treat as reference, and
  every wrinkle so far — the page jump, the ceiling deadlock, the grab-frame flip, the landing on
  silence — came from asking a drag to answer two questions at once.

⛔ Do not decide this by tuning another threshold. The two options differ in what a drag MEANS, and
the evidence for each is above.
