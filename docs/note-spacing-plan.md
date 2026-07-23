# Note spacing — user-authored horizontal space

Sibelius's **note spacing**: grab a note or rest, drag it left/right, and you change the space
*allocated before* it. Everything to its right slides by the same amount, the bar grows or shrinks,
and every voice at that rhythmic position moves with it.

## The distinction the whole design rests on

**A space is not an offset.**

Everything in the overrides compartment so far — `dynamicOffset`, `restShift`, the slur handles —
is an *offset*: it moves a glyph and nothing else in the score notices. Weightless, invisible to
the width key, present only in the shape key.

`leadingSpace` is the first override that **has width**. It is not a property of the note; it is a
property of the **column** the note sits in. That single sentence decides the key, the voice sync,
and the staff sync below.

---

## 1. Model

```
kind: 'leadingSpace'
space: number          // staff-spaces, signed (+ = more room before this column)
```

Position-keyed, in the sibling style of `restPositionKey`:

```
spacingPositionKey(measureId, beat) → `${measureId}:space:b{num}/{den}`
```

**No voice and no staff segment, deliberately.** Dropping `voice` is exactly what makes one space
shared by every voice at that beat instead of two that can disagree — the sync in the request is
a consequence of the key, not a feature we implement. Dropping `staffId` makes it a property of
the system-wide column, so a grand staff cannot drift apart.

The key must start with `${measureId}:` so `MeasureRedrawKey.overridesFor` (`MeasureRedrawKey.ts:92`)
sweeps it into the shape key for free — that is the trap the dynamic offset fell into
(`MeasureRedrawKey.ts:154`), and positional keying sidesteps it. The `:space:` segment cannot
collide with `restPositionKey`'s `:s{uuid}:` / `:v{n}:` segments (a staffId is a uuid).

`ScoreModel.setNoteSpacing(measureId, beat, space)` follows `nudgeRestShift`
(`ScoreModel.ts:843`): clear at zero, set otherwise. It does **not** snapshot — the facade owns the
per-press / per-drop undo entry via `saveOnly`, exactly as `MusicEngine.nudgeRestShift` does
(`MusicEngine.ts:1126`). A model-level snapshot here would push one undo entry per drag frame.

**The value is clamped on the way IN, not on the way out.** §4's shrink floor cannot be applied at
render — the formatted gap depends on the justified width, which depends on the space being
clamped, and clamping only at draw leaves the *width* computed from the unclamped number, so the
bar moves further than its columns do and a hole opens at the barline. So `setNoteSpacing` clamps
against a floor read off the last render (the interaction layer already keeps that kind of baseline
— cf. `draggedStaffSpacePx`), and everything downstream applies the stored number verbatim. Layout
and draw then agree by construction.

No new `Measure` field ⇒ `measureRenderRoles.ts` is untouched.

---

## 2. Width — the bar has to actually grow

`calculateMinimumMeasureWidth` (`MeasureLayout.ts:126`) adds the measure's total user space
(staff-spaces × `VEXFLOW_DEFAULT_STAFF_SPACE_PX`) to `totalWidth`.

Three things to get right:

- **Outside the memo.** The addition sits where `clefOverhead` already sits — *not* inside
  `noteSpaceForLane`. The overrides live on `score`, not on `Measure`, so `laneFingerprint` cannot
  see them and must not: fold them in and every drag frame re-runs the VexFlow formatter on the bar.
- **`MAX_MEASURE_WIDTH: 400`** (`layoutConfig.ts:18`) currently clamps the result and would kill the
  drag dead at 400px with no feedback. Both clamps become caps on the *intrinsic* width — user
  space is added **after** `Math.min(Math.max(total, MIN_MEASURE_WIDTH), MAX_MEASURE_WIDTH)`, never
  before it.
- **The break pass keeps using the inclusive width.** A bar with 40px of authored space genuinely
  needs the room and may legitimately push the line to re-wrap.

`MeasureWidthInfo` carries a new `userSpace` field alongside `minWidth`, for §3.

**Why the memo boundary is the whole cost story.** Unlike the other four drags, this one cannot use
the cheap previewed path. `commitPreviewed` (`MusicEngine.ts:280`) pointedly does *not* set
`modelDirty`, and `layoutCache` is bypassed only when the model is dirty
(`VexFlowRenderer.ts:2012-2018`) — a spacing change *must* re-run the casting-off, so every drag
frame recomputes widths for the whole score. That is affordable only because the expensive half
(`noteSpaceForLane`'s formatter call) stays memoized on lane content, which the override cannot
touch. Break that boundary and the drag stutters.

---

## 3. Justification — option B, "the gap you drag is the gap you get"

`distributeLineWidths` (`MeasureLayout.ts:197`) stretches the line to the page width. Naively feeding
user space into `minWidth` and letting the stretcher re-share would dilute a 20px drag down to ~13px
*and* shuffle bars the user never touched. Instead:

```
U = Σ userSpace over the line
T = Σ intrinsic minWidth over the line      (minWidth − userSpace)

justify the INTRINSIC widths into (available − U)
finalWidth[m] = intrinsic[m] × (available − U) / T   +   userSpace[m]
```

Total still lands on `available`. The dragged gap survives at full size; the cost is paid as a small
proportional shrink across the line's other bars. Compression (`totalMinWidth >= available`) takes
the same shape: compress the intrinsic part, hand the user space back whole.

**`U` is capped, and the cap is not optional.** `available` is 960
(`CONTAINER_WIDTH 1000 − 2×MARGIN`); nothing in the formula stops `U` reaching or passing it, and
`(available − U)` at or below zero hands every bar on the line a negative width. Worse, pass 1
places an oversized bar alone on its line (`MeasureLayout.ts:382`), so a single bar carrying 900px
of space would squeeze its intrinsic part to nothing and *still* hand back 900px whole — straight
through the right margin.

So:

```
U = min(Σ userSpace, USER_SPACE_LINE_FRACTION × available)     // 0.6 — the line keeps 40% for music
scale = U_capped / Σ userSpace                                  // ≤ 1; scale every bar's userSpace by it
```

"Hand the user space back whole" holds up to the cap and proportionally past it. The intrinsic term
keeps its existing `MIN_MEASURE_WIDTH` floor, so the compression branch can never drive a bar to
zero and leave only its authored space standing.

Linear view needs none of this — nothing is justified there, so it is already exact. (Its widths
still carry `userSpace`, since `calculateLinearMeasureWidths` sets `finalWidth = minWidth`.)

---

## 4. Render — shift the columns, never the glyphs

`note.getAbsoluteX()` is `tickContext.getX() + stave.getNoteStartX()`
(`vexflow/build/esm/src/note.js:339`), read lazily at draw time; and `Formatter.joinVoices` gives all
voices in a lane **one shared TickContext per tick** (`VexFlowRenderer.ts:1054`). That is already
how V1 and V2 stay aligned. `Formatter.postFormat()` runs *inside* `format()`
(`formatter.js:598`), so a shift applied after `format()` returns is the last word on x.

So, per lane, in `VexFlowRenderer`:

1. Format to `formatWidth − (this measure's user space in px)`. Without this the notes spread across
   the *widened* bar and the shift below pushes the last one through the barline. ⚠️ `formatWidth`
   is `Math.max(noteAreaWidth − 15, 50)` (`VexFlowRenderer.ts:1053`) — subtract user space *before*
   that floor, or a large space hits the 50px clamp and the bar's music crams into the left edge
   before shifting.
2. After `format()` and **before** `voice.draw()`, walk `formatter.getTickContexts().array` (already
   in tick order) and add the running delta to every context from the anchor onwards:
   `context.setX(context.getX() + cumulativeDelta)`.
3. **The anchor is a TICK, not a slot.** Convert the override's beat to VexFlow ticks and shift the
   first context whose tick is **≥** that value, plus every later one.

### Why §4.3 cannot ask the anchor slot for its tick context

The obvious version — find the `StaveNote` at that beat, take its tick context, shift from there —
is wrong, and wrong in the way that breaks the promise §1 makes.

Each staff formats in its **own** `Formatter` (`drawMeasureContent` runs once per placement). On a
staff with no slot *starting* at the anchor beat there is no anchor `StaveNote` at all, so nothing
shifts — while the bar was widened for every staff. Staff 1 `q q q q`, staff 2 `h h`, space before
staff 1's beat 1: staff 2 has no context at beat 1, never shifts, and from beat 1 on the grand staff
drifts apart. That is exactly the failure §1 dropped `staffId` to prevent.

`getTickContexts()` returns `{ list, map, array, resolutionMultiplier }` with `list` already the
sorted tick keys, so "first tick ≥ anchor" is a scan over a sorted array of numbers — cheap, and the
only rule that keeps every staff on the same column. The tick arithmetic is the cost of the staff
sync, not an accident: `beatQuarters × (RESOLUTION / 4) × resolutionMultiplier`.

*Within* a lane none of this is needed — `joinVoices` mints a context at every voice's tick, so a
voice with nothing at the anchor beat still rides its neighbours' column.

What falls out for free:

- everything right of the anchor moves by exactly the same amount
- **every voice at those ticks moves with it** — shared TickContext
- beams, tuplets and ties read note x at draw time, so they follow
- `ElementRegistry` registers post-draw, so hit-testing is correct with no extra work

⛔ **`note.setXShift()` is the wrong tool** and must not appear anywhere in this feature. It moves
the glyph and leaves the column where it was — that is an offset, which is the thing this feature
explicitly is not.

**Shrink floor.** A negative space cannot pull a column left through its left neighbour's glyph: the
gap must never drop below `MIN_NOTE_SPACING` (`layoutConfig.ts:14`), the same number that already
decides how wide a bar is. But the clamp is applied **at the write site, not here** — see §1. Render
trusts the stored number.

**The preview ghost** formats its own temporary stave (`VexFlowRenderer.ts:2254-2340`) and will
ignore the shift until it runs the same walk. P0 can leave it; note it so the drift is not read as
a bug in the model.

---

## 5. Interaction

**Keyboard first** (P1) — unambiguous, and it makes the model testable by hand before any gesture
work: nudge the selected note/rest's leading space by ¼ staff-space, and a reset key.

> ⚠️ **Rebound after the note-offset feature shipped (`docs/note-offset-plan.md` §C, the "move vs
> offset" swap).** This nudge originally sat on `Shift+Alt+←/→` (`Shift+Alt+Backspace` reset). When
> the note offset arrived it wanted a chord too, and the *move* (this spacing, plus bar width) is
> the thing reached for most — so **the move took the easy key**: it now rides `Ctrl+←/→` (reset
> `Ctrl+Backspace`), joining the `ctrlArrowLeft/Right` decline-chain that already carries the
> slur-endpoint / dynamic coarse nudge. The offset took the vacated deliberate chords
> (`Ctrl+Shift+←/→` wide, `Shift+Alt+←/→` fine). All selections are disjoint, so `Ctrl+←/→` stays a
> pure modal chain. The floor / rebar / decline logic below is unchanged — only the key moved.

**Where the floor comes from.** §1 says the clamp lands at the write site and the caller supplies
it; P1 is the first caller, and `MusicEngine.measuredShrinkRoom` is the answer. It reads the drawn
column positions back out of the `ElementRegistry`, takes the **minimum gap across staves** (the
column is system-wide, so a collision on any one staff is too far for all of them), and asks each
staff for its own first column at or after the anchor beat — the same "tick, not slot" rule §4 uses.

⚠️ **A stale render cannot answer, and this is a live trap, not a technicality.** The gap on screen
already includes the space stored at that column, so the room and the stored value must come from
the same moment. Measure a fresh value against an old picture and the floor slides down one step per
press: the clamp never bites and the column walks through its neighbour — precisely what it exists
to stop. (Found by the test that presses ← two hundred times.) So `measuredShrinkRoom` returns
**null when the model is dirty**, and the nudge declines rather than guessing. Model-dirty only —
`isRenderStale` also trips on scroll and zoom, and neither moves a note relative to its neighbour.
The press is therefore *nudge then repaint*, and the repaint is part of the gesture.

**Drag** (P2). A bare drag on a notehead is already *drag to re-pitch* (`MouseController.ts:71`,
`handleNoteDrag` at `:1973`) — but that gesture is pitch-only, so **horizontal movement on a note is
currently unused**. Resolve by dominant axis past a threshold: vertical wins → re-pitch, horizontal
wins → spacing. Same "decide on the evidence, not on the press" shape as the hand/pan plan.

Two pieces of groundwork that were *not* free, and P2 did first:

- **Re-pitch was gated on TIME, not distance.** `handleNoteDrag` waited `DRAG_TIME_THRESHOLD_MS`
  and then re-pitched the moment the cursor's pitch differed, so a horizontal drag that wandered one
  staff step changed the pitch on the way past. A time gate can only answer *has the user committed
  to dragging*; it cannot say **to what**. Now: a 6px dead zone, then the dominant axis decides.
- **A rest armed no drag at all** — the arming tested `closestElement.type === 'note'`, because the
  only gesture here was re-pitch and a rest has no pitch. Spacing gives the horizontal axis a
  meaning that applies to both, so the arming now takes either.

**The axis is fixed for the rest of the press.** Re-deciding per frame would let a curved drag
re-pitch a note it had already started spacing, and both are real writes to the score — not
previews you take back by moving the mouse somewhere else.

Past that it *is* the fifth instance of the shared skeleton: baseline captured at start (the column,
the space already there, and the floor — measured ONCE against the picture the user grabbed, so it
cannot creep as the drag redraws underneath it), a `changed` flag, `previewNoteSpacing` per frame
and one `commitNoteSpacing` on release. Two departures from the other four worth knowing:

- **No zoom division.** `clientToSvg` goes through `getScreenCTM().inverse()`, so the coords are
  already layout px with the zoom undone. Only the staff space divides.
- **Its own `staffSpacePx`.** `draggedStaffSpacePx` is written only when a slur handle is grabbed;
  borrowing it would silently scale this gesture by whatever slur was dragged last.

---

## 6. Auto-reset — and travelling with the music

Position-keyed, so the P2 machinery applies unchanged: when a rebar, meter change or paste destroys
that beat, `clearEngravingOverride` drops the space with it (grep `auto-reset (§3.3)`). Conservative
and explicit — at the write sites, never as a sweep over "what looks orphaned".

**It also travels through the clipboard**, for the same reason `restShift` and `restHidden` do
(`clipboard.ts:166,196`): a position-keyed override is not attached to an id that copy/paste can
carry, so unless capture/restore handles it explicitly, copying a spaced passage silently drops the
spacing. It is the same class of authored fact — the user spaced *that music*, not that spot on
the page.

Built as the exact mirror of `captureRestShifts`/`restoreRestShifts`, with one simplification that
is the key restating itself: `CapturedLeadingSpace` is **`{absBeat, space}` and nothing else**. The
rest twin carries a voice and a staffId and paste has to re-voice and re-staff them; a space has
neither, so re-basing the offset by the paste start is the whole of the mapping.

And the two halves are one function. `restoreLeadingSpaces` stamps the space **only where some
event still starts at that beat** — any voice, any staff, mirroring the key. That single condition
IS the auto-reset above, stated positively: a rebar that dissolves the column drops its space on
the way through, at the write site, with no separate sweep. On the payload the field is top-level
(`ClipboardPayload.spaces?`) rather than per lane — the one thing in the clip that is neither —
and omitted when empty, so an older clip pastes byte-for-byte as before.

`selectionSnapshot.ts:66` wants it too, for P3's Properties field.

**The click→beat mapping was fixed, not accepted.** It was logged here as an approximation to live
with: `CoordinateMapper.pixelXToBeat` divides the note area evenly
(`(relativeX / usableWidth) * barQuarters`), so a spaced bar resolves the cursor to the wrong beat.
Looking again, that is wrong *already*, without any spacing — VexFlow gives a quarter note more room
than an eighth, so in `♩ ♪ ♪ ♪` the halfway pixel is nowhere near halfway through the bar. Authored
space widens an existing error rather than introducing one, which makes it worth fixing rather than
documenting.

`ElementRegistry.pixelXToBeat` now answers instead: the drawn notes and rests ARE the mapping, each
an `(x, beat)` anchor, and a pixel between two of them is interpolated in the **time** between their
beats, with the barline (`noteEndX` ↔ `barQuarters`) closing the run. Interpolation and not
snapping, because entry must be able to name a beat that holds no note yet — an empty bar carries
one whole rest and you still have to be able to aim at its beat 3. Staff-scoped, because the anchors
are: staves share a barline, not a rhythm. It returns **null** when nothing is drawn there, and only
then does the even-division mapper answer.

---

## Phases

- **P0 — model + math, no UI. ✅ BUILT.** `LeadingSpaceOverride` (client #10),
  `spacingPositionKey`/`parseSpacingPositionKey`/`measureLeadingSpaces`/`measureUserSpacePx`,
  `ScoreModel.setNoteSpacing` with §1's write-time clamp, `MusicEngine.setNoteSpacing`/
  `getNoteSpacing`, `measureWidthParts` + `MeasureWidthInfo.userSpace` (§2), the `U`-capped
  justify reservation (§3), and `applyLeadingSpaces` — the tick-anchored context shift (§4).
  34 unit tests in `noteSpacing.test.ts` / `noteSpacingLayout.test.ts` / `noteSpacingRender.test.ts`,
  including the two-staff bar whose staves have *different* rhythms at the anchor beat, which is the
  case §4 exists for. ⏭️ **Not yet hand-tested in the app** — no UI reaches it, so it is exercised
  by editing the override into the Score JSON panel.
- **P1 — keyboard. ✅ BUILT.** `Ctrl+←/→` / `Ctrl+Backspace` on a single selected note or rest
  (was `Shift+Alt+…` — rebound by the note-offset "move vs offset" swap, §5 above),
  `MusicEngine.nudgeNoteSpacing` / `resetNoteSpacing` / `measuredShrinkRoom`, wired in
  `shortcutWiring`. Plus §6 in full: `captureLeadingSpaces`/`restoreLeadingSpaces` in `rebarOps`
  (so a space survives a meter change and dies with its column), `ClipboardPayload.spaces`, and the
  paste threading. 21 tests in `noteSpacingNudge.test.ts` + `noteSpacingTravel.test.ts`.
- **P2 — drag. ✅ BUILT.** Distance gate + dominant-axis decision in `handleNoteDrag`, arming on
  rests too, `armSpacingDrag`/`dragNoteSpacing`/`endNoteDrag` in `MouseController`, and
  `noteSpacingRoom`/`previewNoteSpacing`/`commitNoteSpacing` on the engine. 16 tests in
  `noteSpacingDrag.test.ts`. Plus `ElementRegistry.pixelXToBeat` (§6): click→beat now interpolates
  through the drawn columns instead of dividing the bar evenly — 11 tests in
  `pixelXToBeatColumns.test.ts`.
- **P3 — optional.** Multi-select nudge; a numeric field in the Properties window.

## Out of scope

Bar-level spacing (Sibelius's "make into system"), per-note *stretch* profiles, and any global
spacing curve. This is one authored number on one column, nothing more.

---

# Review record (2026-07-21)

The plan was checked line by line against the source before P0; the findings are folded into the
sections above, not kept separately. This section is the audit trail.

**Verified as written:** `overridesFor`'s prefix match (`MeasureRedrawKey.ts:92`) and the
dynamic-offset trap it sidesteps (`MeasureRedrawKey.ts:154`); `laneFingerprint` hashing `Measure`
only, so the overrides genuinely cannot be seen from inside the memo (`MeasureWidthCache.ts`);
`MAX_MEASURE_WIDTH` really clamping `calculateMinimumMeasureWidth`'s return
(`MeasureLayout.ts:176-179`); `Formatter.getTickContexts()` (`formatter.js:304`),
`TickContext.setX`, `postFormat()` running *inside* `format()` (`formatter.js:598`) so a
post-format shift is the last word, and `getAbsoluteX()` reading the tick context lazily at draw
(`note.js:339`); one shared TickContext per tick from `joinVoices` (`VexFlowRenderer.ts:1054`);
`Shift+Alt+←/→` was unbound (only ↑/↓ taken by voice nav) when this shipped — since rebound to the
note offset's fine step by the §5 swap; linear view justifying nothing (`MeasureLayout.ts:332`).

**Corrected, and where the fix now lives:**

| # | What was wrong | Now in |
|---|---|---|
| R1 ⛔ | The anchor was a *slot*, so any staff without a note starting at that beat never shifted — the grand staff drifts apart, the exact failure §1 drops `staffId` to prevent | §4.3 + "Why §4.3 cannot ask the anchor slot" |
| R2 | `U` was unbounded: `(available − U) ≤ 0` hands the line negative widths, and one overwide bar hands its space back whole through the right margin | §3, the `U` cap |
| R3 | The shrink floor was circular — the formatted gap depends on the width that depends on the space being clamped | §1, clamped on the way in |
| R4 | Re-pitch is gated on *time*, not distance, so a wandering horizontal drag re-pitches before any axis is read; and rests arm no drag at all | §5, groundwork |
| R5 | Model-level undo would push an entry per frame; and this drag cannot use the cheap `commitPreviewed` path, so the memo boundary is load-bearing | §1 + §2 |
| R6 | `formatWidth`'s 50px floor; clipboard capture/restore; `pixelXToBeat`'s linear interpolation; the preview ghost's own stave | §4.1, §6, §4 |

**Citation nits fixed:** `setRestShift` does not exist (`nudgeRestShift`, `ScoreModel.ts:843`);
the `format()` call is `VexFlowRenderer.ts:1054`.
