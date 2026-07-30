# Bar width — user-authored bar stretch

Grab a barline, drag it, and the bar to its left gets roomier or tighter — with the music inside
**re-spaced proportionally**, not pushed to one end. Sibelius does this with `Shift+Alt+←/→` on a
selected passage ("squishes together or spreads out proportionally"); Finale puts a handle on every
barline and lets you drag it; MuseScore stores a per-measure *layout stretch* multiplier but gives
you no gesture at all; Dorico has a square note-spacing handle at the barline.

We take Finale's gesture and MuseScore's model.

> ⚠️ **One name in here has been deleted, 2026-07-30.** `MIN_NOTE_SPACING` — the flat 1.8-staff-space
> floor per event — is gone, and so is `noteSpaceForLane`. The floors this plan describes are real and
> still enforced; they read **`MIN_COLUMN_GAP`** (a notehead plus its note↔note padding, 1.43 spaces)
> and the per-measure `noteSpaceForMeasure`. See `docs/spacing-model-plan.md`.

## 0. What this is NOT

**It is not more `leadingSpace`.** That client (docs/note-spacing-plan.md) exists to open a *dead
gap* before one column: the renderer formats the music into `noteAreaWidth − userSpacePx`
(`VexFlowRenderer.ts:1130`) and then walks the tick contexts to shift everything right of the
anchor. It fights the formatter on purpose.

Bar width is the opposite gesture and therefore much cheaper: **hand the formatter a bigger box and
stop.** VexFlow re-distributes the columns by duration on its own — that IS the "proportional
recalculation". No tick-context walk, and no per-staff sync problem, because every staff in the bar
formats into the same widened note area.

**And on a justified line you are not making a bar bigger — you are moving a barline.** The system
total is fixed at `availableWidth`, so the room comes from the bar's neighbours. A bar *alone* on
its line therefore cannot stretch at all: it already fills the line. That is inherent to
justification and is equally true in Sibelius and MuseScore; it is not a bug to be fixed, it is the
reason the gesture is *drag the barline* rather than *drag the bar*. (In **linear view** nothing is
justified, so a stretch genuinely grows the bar and everything after it slides.)

⚠️ **The same fact has a second, larger consequence: the barline that ENDS a system cannot move
either.** It is pinned to the right margin by justification, whatever the bar behind it is worth —
and that is one barline on every system, not the rare lone-bar case above. §4 derives it; it is
noted here because it is the first thing a reader will try with the mouse. Both are the *same*
degenerate case, and the drag declines on both.

---

## 1. Model

```
kind: 'barWidth'
stretch: number        // multiplier on the bar's own NOTE SPACE (§2 — not on its clef/meter
                       // overhead, which is reflow-dependent). 1 = the engraver's own.
```

Keyed `barWidthKey(measureId) → `${measureId}:barwidth``.

**Why a multiplier and not a distance.** Both were on the table. A stored distance makes the drag
trivially 1:1 but rots: widen a 4-note bar by 120px, add four more notes, and the bar is no longer
as roomy as you left it. A multiplier keeps the *intent* through edits — and it is the only one that
generalises to "spread this passage" (P3), where a fixed distance would make the sparse bar cavernous
and barely touch the dense one. The drag still moves 1:1 in pixels; the px→ratio conversion happens
at the write site (§4).

The `${measureId}:` prefix means `MeasureRedrawKey.overridesFor` (`MeasureRedrawKey.ts:88`) sweeps
it into the shape key for free, and `:barwidth` cannot collide with `spacingPositionKey`'s
`:space:` or `restPositionKey`'s `:s{uuid}:` / `:v{n}:`. (The bar redraws anyway — `input.width` is
already in the shape key — but its *neighbours* change width too, and they are covered by the same
term.)

`stretch === 1` clears the entry, so "absent = the engraver's own width" holds — the mirror of
"zero clears" on `leadingSpace`. `ScoreModel.setBarWidth(key, stretch, minStretch)` clamps **on the
way in** and does **not** snapshot: the facade owns undo via `saveOnly` / `commitPreviewed`, exactly
as `setNoteSpacing` does, or a drag records one undo entry per frame.

⚠️ **Two clamps, and the second is not optional.** `minStretch` is the *measured* floor the caller
supplies from the last render (§5) — but P0 is exercised by typing the override into the Score JSON
panel, and `distributeLineWidths` deliberately leaves negative totals uncapped ("handing width back
to the music is always affordable"). So a hand-authored `stretch: 0` or `-1` walks straight into a
negative-width bar. `setBarWidth` therefore also clamps to an absolute `[BAR_STRETCH_MIN,
BAR_STRETCH_MAX]` — a write-site clamp, not a repair pass, consistent with
report-never-repair.

> ⚠️ **The MAX is a backstop against absurd JSON, not the gesture's ceiling** — corrected at P1,
> from use. It was written here as `8`, chosen for symmetry with the floor and derived from nothing,
> and 8× the note space is not a line: on a sparse bar it topped out a third of the way across, so
> *"make the first bar the whole system"* was unreachable. **The ceiling a gesture stops at is
> derived per bar instead: the stretch at which the bar's width reaches the full line.** That is the
> widest picture there is (past it the bar is put alone on its own line and justified back to
> exactly the line width, so every larger stretch draws the same thing), and it is the one number a
> fixed multiplier could never express — the same 8× is a third of a line for a sparse bar and more
> than a line for a dense one. `BAR_STRETCH_MAX` moves up out of the way (100).
>
> ⚠️ **CORRECTED AGAIN at P1.5 — that derived ceiling is still not the real one.** "The stretch at
> which the bar's width reaches the full line" is blind to the bar having become the whole system
> **earlier**, by pushing its neighbours off. Reported: *"a measure has a max width, the width of the
> line, so after that we should not add more."* Measured — bar 1 went alone at ×17.1 while the
> ceiling said ×21.6, so one press bought +4.5 that drew the identical picture, seven more did
> nothing, and every unit had to be walked back before anything moved again. **A bar alone on its
> system IS the line; that is its maximum, whatever it is.** See §1.5.

No new `Measure` field ⇒ `measureRenderRoles.ts` is untouched.

**Rebar and paste ride for free, and the reason should be written down.** `leadingSpace` has to be
captured and restamped across a rebar (`rebarOps.ts:185`/`:268`) because a meter change moves the
*columns* its key names. A bar width names the bar, and a rebar keeps measure **ids** — so the
stretch survives with no capture/restore at all. Bars a rebar *adds* start unstretched (right: they
are new music); a deleted bar leaves an orphan key in the compartment, which is the leak every
position-keyed client already has and not this feature's to fix.

---

## 1.5 ⭐ SUPERSEDED at P1.5 — a bar has THREE widths, and growth is a TRANSFER

Everything below this point describes the model as planned. Three rounds of use replaced its
centre, so read §2–§5 through this section. Written after the fact, from what was measured rather
than from what was expected.

### A bar has three widths, and collapsing any two of them breaks the page

| | what it is | what it decides |
|---|---|---|
| `naturalWidth` | what the bar asks for **ungrown** | **how many bars fit a system** |
| `minWidth` | what it asks for now | its share of the line |
| `floorWidth` | overhead + `MIN_NOTE_SPACING` per column | how far it can be **forced** |

Each wrong collapse was shipped and reported back, so each is worth stating as a trap:

- Cast off on `minWidth` ⇒ a grown bar shoves a neighbour onto the next system *before* anything
  gives way.
- Cast off on `floorWidth` ⇒ a grown bar **recruits** bars onto its line. Measured: 23 empty bars
  where 9 belong.
- Lower the *asked-for* width to make bars give way ⇒ **the whole page goes permanently narrow**.
  Measured: 14 empty bars to a system at 63px, against 9 at 103px. Reported as *"the default width is
  like maximum-shrinking… that should apply only if the bars are FORCED to it because another is
  growing."*

Capacity is therefore measured **growth-blind**, and pass 1 lets a line holding a growing bar
over-commit: the neighbours are squeezed first, and the system re-wraps only when even their floors
will not hold it.

### Growth is a transfer; a shrink is not

`distributeLineWidths` computes the line **twice**. First a baseline — where every bar would sit if
nobody had touched a width (`naturalWidth`, proportional, exactly as before, so an untouched page is
pixel-identical). Then the transfer: each grown bar is handed its growth, and that many pixels are
taken back in priority order — **spare empty bars first**, down to `floorWidth`; bars with music only
once the silence is spent; a uniform squeeze only if even that is not enough.

This is what §3's "shrink the pot everyone shares" could not do. Under it every bar on the line lost
in lockstep: measured, a bar of music gave up 9px while the empty bars beside it still had 64px of
give each. Reported as *"we don't want to auto-shrink bars that have music because of another bar's
width action unless it is really necessary."* Now it does not move at all until they are at their
floor:

```
x1:  1m=185  2e=111 3e=111  4m=111  5e=111 …
x4:  1m=401  2e=75  3e=75   4m=111  5e=75  …     ← the music bar has not moved
x8:  1m=688  2e=37  3e=37   4m=89   5e=37  …     ← empties at floor, now it pays
```

⚠️ **A SHRINK is deliberately NOT a transfer.** Growing says "give me room from my neighbours";
shrinking says "I need less of the system" — which is not a demand on anyone, so the bar's
`naturalWidth` falls with it and the whole line re-shares. Making both directions transfers was
tried and is wrong: a bar handing back its 56px of note space still drew 230px, because its *claim*
had not moved. That is the original empty-bar complaint, and this asymmetry is where it is answered.

### The limits, and the step

**The ceiling is where the bar becomes the system**, not where its width would reach the line — the
two differ whenever a neighbour is stretched too, because then it is pushed off early. Dead range is
worse than a wall: a wall you can see, and nothing has to be walked back across it.

Three ways a keyboard press went dead or wild, all one root — **rules written for a bar ALONE were
being applied to a bar whose neighbours were merely SPENT.** Under the transfer model those stopped
being the same state and nothing said so:

- `alone` was read off `widthSlope === 0`, which now *also* means "the line is spent". A bar with
  seven neighbours took the lone-bar branch, whose shrink target is a **fixed point** — shrinking
  froze while the log cheerfully reported it was alone. Ask the LINE. And the directions need
  different conditions: **growing** is dead when nobody can absorb it; **shrinking never is**,
  because handing room back needs no payer.
- The threshold jump can be a fixed point anyway — aim past the bar below, and if THAT bar is
  stretched it still does not fit. ⭐ **A press that changes nothing falls back to a continuous
  step.** A press either moves the bar or is against a limit that shows. Do not chase a cleverer
  threshold: it would have to be right about every reason a bar might not fit. (It also makes
  *accurate* aiming safe, which is why the shrink threshold can now use `squeezedWidth` — what the
  bar below can be squeezed to — instead of undershooting at its full `minWidth`.)
- The growth threshold leapt ×4.75 → ×21.63 in one press. "Worth more than the whole line" is right
  for a lone bar and wrong for a spent one; with company it is where the LAST bar gets pushed off.

### What this deletes

- **§2's empty-bar `stretchScalesShare` split** survives only as the *classifier* (which bars are
  spare, and which model reports `noteSpace`). The two branches no longer behave differently under
  justification — growth is `noteSpace × (stretch − 1)` in **both**.
- **§4's hyperbola is gone.** Because growth is one linear term in both models, the slope IS the
  exact inverse; there is nothing to solve, and the "←← then →→ leaves the bar 9px narrower"
  irreversibility it existed to fix cannot arise. `barWidthRoom` and the justifier share one
  exported definition of who pays (`growthPayerShares`), so they cannot drift.
- **§4's inversion is now exact on the first bar of a line** — slope 1, because every bar that pays
  sits to its right. Under the proportional model the bar shrank its own share too, so it always
  moved slightly less than asked: the one promise §4 could not quite keep.
- **§3's `stretchSpace` pool** no longer drives justification (`userSpace` still does — a dead gap
  is reserved off the top and is not part of any transfer).

---

## 2. Width — one more term, and one line of difference

`measureWidthParts` (`MeasureLayout.ts:200`) returns `{ minWidth, userSpace }` today. It gains a
third:

```
stretchSpace = noteSpace × (stretch − 1)
minWidth     = intrinsic + userSpace + stretchSpace
```

> ⚠️ **SPLIT at P1: an EMPTY bar's stretch scales its SHARE of the line, not a reserved amount.**
> Reported from use, and structural rather than a bad constant. A bar's drawn width is mostly its
> justified share, handed out in proportion to `intrinsic` — which the reserved-space model never
> touches. So an empty bar could give back its whole note space (40px, all it has) and still sit
> there at 165px, unable to get out of a long neighbour's way. It never looked organic because
> nothing about the bar's *claim on the line* had changed.
>
> For a bar with music the reserved model is right, and the user asked explicitly that it stay:
> its music sets its claim, and shrinking stops at `MIN_NOTE_SPACING` per column. **An empty bar
> has no music to set one** — its width comes from `MIN_MEASURE_WIDTH` and the
> `EMPTY_LANE_NOTE_SPACE` floor, both defaults — so asking for it to be narrow is asking to overrule
> a default, and it should give way completely. Such a bar carries `stretchSpace: 0` and folds the
> stretch into `minWidth` (overhead excluded, floored at one column's `MIN_NOTE_SPACING`), so
> `intrinsicOf` moves with it. Measured: 184px → 75px, with the room going to the bar that has music.
>
> Two consequences worth knowing. §4's inversion needs the other branch — with `x` the bar's own
> intrinsic the barline sits at `room·(Pₒ+x)/(Tₒ+x)`, a hyperbola, so the gesture **solves** it
> rather than stepping along the tangent (a tangent step is not reversible: ←← then →→ left the bar
> 9px narrower). And a bar that later gains a note changes model, so its stored number starts
> meaning the other thing — deliberate: it also stops being a bar whose width was a default.

⚠️ **`noteSpace`, not `intrinsic` — the multiplier is on the MUSIC, not on the overhead.**
`calculateMinimumMeasureWidth` (`MeasureLayout.ts:126`) already walks the staves computing
`noteSpaceForLane(lane) + clefOverhead` and keeping the max, then adds `sharedOverhead` (barline
padding + meter glyph) and clamps. It returns one number; make it return two — the widest lane's
**note space alone**, alongside the clamped total it returns today. The extra max costs nothing (it
is the same loop) and the two maxima may legitimately land on different staves, which is fine:
`noteSpace` is "the most room any lane's music needs", which is exactly what a stretch stretches.

That is not tidiness. The overhead is **reflow-dependent**: a bar pays `CLEF_WIDTH` (45) when it
opens a line, `CLEF_CHANGE_WIDTH` (30) when its clef changes mid-line, and nothing otherwise. Fold
it into the base and the *same stored `stretch`* buys a different number of pixels the moment a
re-wrap makes the bar line-opening — which destroys the one thing the multiplier was chosen for
(§1: it keeps the intent through edits). Multiplying the note space also makes `stretch` mean what
it says in the gesture: *this bar's music gets 1.5× the room*, with the clef costing what a clef
costs.

Both ordering rules that `userSpace` obeys apply unchanged, for the same reasons already written at
that call site: added **after** the `MIN_MEASURE_WIDTH` / `MAX_MEASURE_WIDTH` clamps (they cap what
the *music* needs, and leaving authored width inside them kills the drag silently at 400px), and
**outside** `noteSpaceForLane`'s memo (the override lives on `score`, not on `Measure`, so
`laneFingerprint` cannot see it — fold it in and every drag frame re-runs the formatter).

`MeasureWidthInfo` carries `stretchSpace?: number` beside `userSpace`.

**The one line where they differ is in the renderer.** `userSpace` is a dead gap and is subtracted
before formatting (`VexFlowRenderer.ts:1131`); `stretchSpace` is live and is **not**. That single
omission is the whole of §0's "hand the formatter a bigger box". Nothing else in `VexFlowRenderer`
changes — `applyLeadingSpaces` keeps working on top, untouched.

---

## 3. Justification — the existing reservation, widened

> ⚠️ **CORRECTED at P1: the stretch gets its own pool, and is NOT under the 0.6 cap.** Reported from
> use — an empty bar (a rest with white space either side) stopped growing with most of the line
> still visibly free, and the motion crawled and then jumped. `USER_SPACE_LINE_FRACTION` is a rule
> about **dead gaps**: a line whose *gaps* claim 60%+ of it has no music left. A stretch is live
> music room, so "this bar takes most of the line" is the legitimate case — it is the whole feature.
> Uncapping it is safe because pass 1 already bounds it: a bar joins a line only while the line's
> Σ `minWidth` fits, and authored ≤ `minWidth`, so Σ `stretchSpace` ≤ `availableWidth` on any line
> holding two or more bars. The one exception is the bar pass 1 puts **alone** on its line, which may
> be worth more than the line; a `stretchScale` guard hands that bar exactly the line and never a
> pixel past the margin. Both scales come from one exported `authoredScales`, because §4's inversion
> has to know when a scale is biting.

`distributeLineWidths` (`MeasureLayout.ts:252`) already reserves the authored part off the top and
hands it back whole so a drag is not diluted by the stretcher. `stretchSpace` joins the same pool:

```
U           = Σ (userSpace + stretchSpace)          // same USER_SPACE_LINE_FRACTION = 0.6 cap
intrinsicOf = minWidth − userSpace − stretchSpace
```

and both branches keep their present shape. Negative totals stay uncapped — handing width back to
the music is always affordable, and §1's absolute clamp is what stops a hand-authored one going
through the floor. Linear view justifies nothing, so a stretch is already exact there.

⚠️ **Past the cap, §4 no longer inverts.** The closed form there assumes `userScale === 1`; once the
0.6 cap bites, `reserved` stops tracking the drag and the relation stops being the one we inverted.
Capture `userScale` at grab with everything else and **decline while it is below 1**, rather than
dragging against a formula that no longer describes the picture.

---

## 4. The barline must sit under the cursor — and the fix is a closed form

The trap: widening bar *m* also shrinks bar *m*'s **own** justified share, so the bar grows by less
than you dragged. From `MeasureLayout.ts:278` and `:285` — both branches reduce to the same thing,
with `A = availableWidth`, `T = Σ intrinsic` on the line:

```
finalWidth(m) = I(m)·(A − U)/T + u(m)
```

Substituting `u(m) = u₀ + e` (and therefore `U = U₀ + e`) leaves it **exactly linear in e**:

```
finalWidth(m) = [ I(m)·(A − U₀)/T + u₀ ]  +  e·(1 − I(m)/T)
```

**But `finalWidth(m)` is not where the barline is.** The barline that ends bar *m* sits at
`margin + Σ_{k≤m} finalWidth(k)` (`VexFlowRenderer.ts:822`), and the same stretch shrinks every bar
*before* it on the line by `e·I(k)/T` — so those barlines slide **left** while you drag **right**,
and they carry the grabbed one back with them. Summing the deltas:

```
d(barline m) = e · (1 − P(m)/T)          P(m) = Σ_{k≤m} I(k), the line's intrinsic UP TO AND
                                                INCLUDING the grabbed bar
```

which inverts exactly, in both the stretch and the compression branch:

```
to move the barline by d px:   Δ = d / (1 − P(m)/T)
```

`I(k)` and `T` come from the **last render** — `VexFlowRenderer.measureLayoutInfo`
(`VexFlowRenderer.ts:350`) keeps the `MeasureWidthInfo` map with `lineNumber`, so `P` and `T` are
sums over the bars sharing the grabbed bar's line (`intrinsic = minWidth − userSpace − stretchSpace`,
which is why §2 puts `stretchSpace` on the info). The map is private; P1 adds the accessor. Read
once at grab — none of these terms move during the drag, because a stretch changes no bar's
*intrinsic*. That is what makes one capture legitimate rather than merely cheap.

⚠️ **The degenerate case must decline, not divide** — and it is not rare. `P(m) = T` exactly when
*m* is the **last bar of its line**: nothing follows it to absorb the change, so its barline is the
right margin and no stretch moves it (§0). That is one barline per system, plus the lone-bar case
(where `P = I = T`) as a special case of it. The drag declines: no movement, no stored change. Same
rule as `measuredShrinkRoom`, which returns `null` when the model is dirty rather than guessing.

⚠️ **Linear view takes a different branch, not this formula.** Nothing is justified there, so
`finalWidth = minWidth` and the slope is exactly 1: `Δ = d`. Feeding linear view through the
formula above does not degrade gracefully — every bar carries `lineNumber: 0`, so `T` becomes the
whole score and `P` a prefix of it, giving a slope that is wrong by a little in a long score and
badly wrong in a short one. Branch on `viewMode`.

---

## 5. The limits — derived, never invented

**Shrink floor: the bar keeps the room its music is actually using.** The tempting statement —
"never below its own intrinsic width" — is the wrong one, and measurably so: on a *compressed* line
`finalWidth` is **already** under intrinsic for every bar (`compressionRatio < 1` is ordinary; only
below 0.7 does `distributeLineWidths` even warn). Written as an absolute it would refuse every
shrink on exactly the crowded lines where a shrink is most wanted, or jump to the floor on the first
frame.

So the floor is **measured off the last render**, the way `MusicEngine.measuredShrinkRoom` measures
the note-spacing floor: how much slack the drawn bar has above `MIN_NOTE_SPACING = 18px` per event,
read back through the `ElementRegistry`, minimum across staves (the bar is system-wide). That slack
converts to a stretch floor through §4's same linear relation, captured once at grab. Model dirty at
grab ⇒ no answer ⇒ decline, never a guessed floor.

> ⚠️ **REVERSED at P1, from use.** The reflow limit below was built and it reads as the bar seizing
> up for no visible reason — reported at the first sitting, along with its twin: the last bar of a
> system doing nothing at all. Both are gone. Running out of line is what makes a bar **move to the
> next system**, and that is what Sibelius, Finale and MuseScore all do; a pinned system-ending
> barline still resizes its bar, which is how the bar travels. The cursor argument the limit rests
> on ("the barline teleports out from under you") only ever applied to a live drag — a key press has
> no cursor to lose — so P2 may re-add a guard for the mouse alone, and must not assume this one.
> Declining on a pinned barline would also have become a trap once re-wrapping is allowed: stretch a
> bar until it sits alone on its system and no key could bring it back. The rest of §5 — the
> measured shrink floor — stands unchanged; it is the only real limit.

**Reflow limit: the drag stops where the line stops holding the same bars — in BOTH directions.**
Pass 1 breaks when `currentLineWidth + minWidth > availableWidth` (`MeasureLayout.ts:449`):

- *Stretching* past `availableWidth − Σ minWidth` pushes the line's **last** bar onto the next
  system — not the bar you are holding, unless it happens to be last.
- *Shrinking* is not safe by symmetry: it frees room, which lets the **next line's first** bar jump
  **up** onto this one.

Either way the line's membership changes, so `T` changes, so §4's slope changes mid-gesture and the
barline teleports out from under the cursor — the one thing that would make this feel broken. The
guard is therefore "the line keeps the same set of bars", clamped at both ends. Sibelius avoids the
same by keeping "make into system" a separate command rather than something you can fall into with
the mouse. (`setLayoutFrozen` — `VexFlowRenderer.ts:1944`, built for the clef drag — is *not* the
answer here: it freezes widths, which is the thing that must change.)

Whichever limit bites first wins; the `U` cap of §3 is a third, and the absolute clamp of §1 a
fourth.

---

## 6. Interaction

**P1 — keyboard.** With a barline selected (`selectedBarlineMeasure`, `3d88dbb`),
`Ctrl+←/→` stretches/shrinks the bar it ends, and `Ctrl+Backspace` resets it. Those are the
note-spacing keys, dispatched on **what is selected** — a note → note spacing, a barline → bar
width. Same keys, same axis, different noun, which is Sibelius's own behaviour rather than a
collision we are papering over. Cheap, too: `nudgeSelectedNoteSpacing` / `resetSelectedNoteSpacing`
already **decline** (return false) when no column is selected, so the dispatch is a `||` onto the
existing move actions and the note-spacing branch is not touched.

> ⚠️ **Rebound from `Shift+Alt+…` by the note-offset "move vs offset" swap** (`docs/note-offset-plan.md`
> §C): the *move* (this bar width + note spacing) took the easy `Ctrl+←/→` — joining the
> `ctrlArrowLeft/Right` chain that already carries the slur-endpoint / dynamic coarse nudge — and the
> note offset took the vacated deliberate chords. The dispatch-on-selection design is unchanged; only
> the key moved.

One step = **one staff-space of barline movement** (10px), converted through §4 — so "a step" means
the same distance whether it arrives from the keyboard or the mouse, instead of the keyboard nudging
an abstract ratio.

**P2 — drag.** Grab the barline. ⛔ **No hover cursor** — a `col-resize` affordance was built and
removed on sight: the pointer changing shape as it crosses every barline is noise on a page made of
barlines. The barline highlight already says it is a thing you can grab. The bar affected is the one to its **left**
(what "the barline that ends measure N" already means, and Finale's model). Reuses the padded hit
box of `handleBarlineMouseDown` (`MouseController.ts:996`) and the shared drag skeleton — baselines
at grab, a `changed` flag, `previewBarWidth` per frame, one `commitBarWidth` on release. Simpler
than the note drag in one respect: the target is a barline, so there is no axis contest and no
dominant-axis rule.

Captured **once** at grab, all from the last render: `P(m)` and `T` (§4), the current width, the
current stretch, the measured shrink floor and both reflow limits (§5). Model dirty at grab ⇒
decline. So does a grab on a line-ending barline, which cannot move at all (§4).

⚠️ **The barline hit box is the bar's END, and only that.** `VexFlowRenderer.ts:1922` registers one
`barline` element per (measure, staff) at `x + width − 2` — bar N's closing line, never bar N+1's
opening one. So "the bar to the left" is `barlineAt.measure` with nothing to disambiguate, and the
"one barline = two rects" trap (which is about the drawn SVG) does not reach the registry.

---

## 7. Cost

The same story as note spacing, and already accepted there: a stretch sets `modelDirty`, so the
casting-off re-runs every frame — affordable only because `noteSpaceForLane`'s memo is keyed on lane
content, which the override cannot touch. What redraws is every bar whose `finalWidth` changed,
which on the whole-line model is the system. That is inherent to the feature, not overhead.

---

## Phases

- **P0 — model + math, no UI.** `BarWidthOverride` (client #11), `barWidthKey`, `ScoreModel.setBarWidth`
  with both write-time clamps (§1), `MusicEngine.getBarWidth`/`setBarWidth`, the `stretchSpace` term
  in `measureWidthParts` + `MeasureWidthInfo` — over the split-out `noteSpace`, §2 — the widened
  justification reservation (§3), and the renderer *not* subtracting it (§2). Exercised by editing
  the override into the Score JSON panel. One test carries the invariant the whole feature rests on:
  **with a stretch present, a line's Σ `finalWidth` still lands exactly on `availableWidth`.**
- **P1 — keyboard.** A renderer accessor for `measureLayoutInfo` (private today),
  `MusicEngine.barWidthRoom` (§4 inversion incl. the linear branch + §5 limits, all measured off the
  last render), the selection-dispatched `Ctrl+←/→` (rebound from `Shift+Alt+…` by the note-offset
  swap, §6), reset.
- **P2 — drag.** ✅ BUILT (whole-line). Barline grab, `previewBarWidth` per frame, one
  `commitBarWidth` on release; `stretchForBarlineDelta` (continuous) and never `stretchForStep`.
  Three corrections came straight out of using it:
  - **The room is captured once per CASTING-OFF, not once per drag.** Its `T`/`P`/slope are sums
    over the bars sharing the line, so they expire when a stretch pushes one onto the next system.
    Measured: exact tracking, then 21px of error at the re-wrap, kept for the rest of the drag and
    compounding at every further one. `reanchorIfRewrapped` re-takes the room and re-anchors to the
    pointer — one honest jump at the boundary (the layout really did move discontinuously), exact
    tracking either side.
  - **The pointer is HIDDEN for the gesture** (his idea). No arithmetic keeps the barline under a
    cursor that is still visible beside it across that discontinuity; with the pointer gone, the
    barline *is* the cursor and the jump reads as the music re-flowing.
  - **A release OUTSIDE the viewport settles the drag**, via the document-level mouseup that was
    already there for the pan. The element's own handler never fires there, and this gesture holds
    an uncommitted preview *and* a hidden pointer — so being left armed is not a harmless leak: the
    score keeps resizing under a mouse with no button held.
  - **A pinned barline still drags.** Refusing it (a drag that can't track shouldn't start) meant a
    bar stretched to fill its system could never be shrunk again — reported immediately. It arms,
    answers by the bar's own music, and picks tracking back up the moment the shrink re-wraps.
  ⏭️ **The § Open 1 question is now judgeable on screen** — see below.
- **P3 — optional.** Multi-bar passage spread; a numeric field in the Properties window;
  Finale-style local compensation (§ open).

## 🔴 Known issues — reported from use, POSTPONED (not solved)

Written down at the end of P1 rather than fixed, by decision. Nothing below is a mystery about what
*should* happen; they are open about how.

1. ✅ **CLOSED at P1.5 — "an empty bar does not shrink enough".** Reported three times, and the
   cause was never in the shrink logic: `MIN_MEASURE_WIDTH` clamped *every* bar, so a bar holding
   one whole rest claimed as much of the line as a bar of four quarters and justification could not
   tell them apart. A default was reading as a claim. See §1.5 — and note that the first two fixes
   for this were both wrong in instructive ways.

   ✅ **And the last number in it is now DECIDED, on screen, against two rivals.** A mid-line empty
   bar's width is `MIN_MEASURE_WIDTH`, and three values were drawn and compared (2026-07-30):

   | value | where it comes from | verdict |
   |---|---|---|
   | **10 spaces** | what it has always been | ✅ **kept** — *"I think 10 was nicer… as an initial setup it looks clear and nicely spaced"* |
   | 7.65 | ⭐ the RULE's own ask for a 4/4 bar of silence (6.0 + the 1.65 lead-in), i.e. the value at which this floor decides nothing | drawn: *"it does not look bad, but…"* |
   | 4 | MuseScore's *Minimum measure width* default, documented for exactly this case | too tight to START from |

   ⭐ **The distinction he drew is the one to keep:** a *default* and a *shrink floor* are different
   questions — *"of course empty bars can shrink more (depending on the context, probably to 4?) but as
   an initial setup…"*. An empty bar may well end up at 4 when the line needs the room, and that is
   already true: it is `EMPTY_BAR_FLOOR_PX` plus §1.5's transfer, which lets a bar of silence give way
   completely. It is not where an untouched page should start.

   ⚠️ Since the choice is taste, **it must stay cheap to revisit**: two specs stated how many empty
   bars a system holds and broke when 7.65 was tried (`MeasureLayout.raggedLastLine.test.ts`,
   `MusicEngine.barWidthNudge.test.ts`). Both count now. Sources and the measured pictures:
   `docs/spacing-model-research.md` §6c.
2. ✅ **CLOSED at P1.5 — "a shrink should take it out of the EMPTY bars first".** Now the rule, via
   the transfer in §1.5. ⚠️ It does NOT live where this issue assumed. A tiered version of
   `distributeLineWidths`' compression branch was built first and measured to fire **zero times**
   across the whole suite: pass 1 admits a bar only while `Σ minWidth ≤ available`, which is
   algebraically the slack condition, so that branch was unreachable. It became live only once pass
   1 was taught to over-commit a line that holds a growing bar. If that admission rule is ever made
   unconditional again, the tiers go dead again with no test failing.
3. **The keyboard step is fine-grained to a fault.** ~36 presses to walk a bar across a system, and
   an empty bar's whole shrink range is ~3 (the multiplier has far less room below 1 than above it).
   Still open at P1.5.
   A coarse modifier — or a step proportional to the bar's own range — is the obvious answer; the
   multiplier was left alone because guessing it is worse than asking.
4. **Pushing a bar back DOWN a system can cost a second press.** Still true at P1.5, with a second
   cause on top of the one below: a line now squeezes before it wraps, so there is more to push
   through on the way out. Measured at exactly 2 presses. The alone-on-its-system threshold aims
   conservatively, because the bar below is measured as a line-opener and carries a full clef it
   stops paying once it moves up; the jump assumes the worst case so it always clears. Out and back
   is 1:1, out-again is sometimes 2.

   ✅ The **worst half of this is closed**: the walk back across dead range *above* the real ceiling,
   reported as "I have to go back as many steps as I went ahead". See §1.5 — a bar alone on its
   system is at its maximum. The threshold also aims accurately now rather than conservatively,
   which the fixed-point fallback made safe.

## Open, deliberately — decided by feel

1. ✅ **DECIDED at P2 — the room comes from the WHOLE LINE, and it stays that way.** Judged on
   screen, as this entry asked: *"expanding, it is not bad what we have today."* So every barline to
   the left of the one you drag keeps sliding left — the system re-spaces under the cursor, the
   Sibelius feel — rather than Finale's next-bar-only.

   **Deliberately revisitable, and cheaper to revisit than this entry assumed.** Three reasons,
   worth stating so nobody treats it as load-bearing:
   - **Nothing about who pays is STORED.** The override is `{kind: 'barWidth', stretch}` — a
     multiplier. Switching models re-renders existing scores differently and migrates nothing.
   - **The payer set lives in one file.** `distributeLineWidths`' tiers and `growthPayerShares`
     (which mirrors them marginally), both in `MeasureLayout.ts`. Finale's model is "the payer set is
     the next bar only".
   - **§4 does NOT have to be rewritten** — the fear that made this a P2-or-never decision. Under
     Finale's model no payer sits left of the grabbed bar, so `barlineSlope` comes out 1 and the
     inversion collapses on its own. That is the existing formula giving the right answer, not a
     special case. The transfer model (§1.5) is what made this true; before it, "who pays" was
     smeared across the justifier's proportional maths and could not be moved.

   The one cost of a later switch: scores already stretched would re-flow. Not a migration — work
   already eyeballed, looking different.

2. **An authored `leadingSpace` inside a stretched bar** — does the gap scale with the bar or stay
   the fixed distance it is? Staying fixed, following Finale/Dorico, and it falls out of §2 with no
   extra code (the gap is subtracted before formatting either way).
3. **The clipboard.** A stretch is a property of the *page*, not of the music, so it does not travel
   with a copied passage — unlike `leadingSpace`, which does. Stated so the asymmetry is a decision
   and not an omission.

## Out of scope

Per-beat handles (Dorico's circular handles, Finale's beat chart) — that is note spacing, already
built. System-level "make into system". Any global spacing curve.
