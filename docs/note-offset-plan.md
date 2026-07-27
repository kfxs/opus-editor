# Note horizontal-offset plan

## Goal

Let the composer **nudge a single note left/right** — a free horizontal offset off its
natural (formatted) column, on top of automatic spacing. The common case is dense
multi-voice passages where one note wants to sit slightly clear of another; the general
case is "move this note a bit, for whatever reason."

The offset must carry **everything the note owns** — accidental, dot, articulation — and,
because a note is *connected*, its beam, stem, ties and slurs must follow too.

Horizontal only for this pass. `y` is a trivial later addition (every other offset client is
already `{x,y}`); we ship `{x}` to keep scope honest.

## The mechanism decision: `StaveNote.setXShift`, not an SVG translate

The dynamic-offset client (#8) nudges by **SVG-translating the whole rendered `<g>`** — which
would drag accidental/dot/articulation along for free. Tempting, but **wrong for a note**: a
note is connected, and an SVG translate moves only that one group, so its **beam would not
follow** (separate group) and its **ties/slurs would point at the old spot** (their anchors
are computed pre-translate). In the multi-voice passages this feature targets — usually
beamed — that is visibly broken.

`StaveNote.setXShift(px)` moves the note's **reported geometry**, so beams, stems, ties,
slurs and hit-testing (`headX`) all recompute around the new position. It is the same lever
the renderer already uses for multi-voice collision centering (`VexFlowRenderer.ts:1219`), and
it is the *offset* tool the note-spacing feature was explicitly told to avoid (spacing must
move the whole column; an offset must not — see the ⛔ note at `VexFlowRenderer.ts:90`). A note
offset is exactly the offset case.

### The asymmetry to handle (verified against VexFlow 5 source)

A post-format `setXShift(dx)` on a `StaveNote` moves:

| Owned by the note | Follows `setXShift`? | Why |
|---|---|---|
| notehead, stem, flag | ✅ | `getNoteHeadBeginX/EndX`, `getStemX` all add `xShift` |
| beam | ✅ | reads `note.getStemX()` |
| dots | ✅ | `getModifierStartXY(RIGHT)` — the only branch that folds in `xShift` |
| ties / slurs | ✅ | endpoints read the shifted notehead X |
| hit-testing (`headX`) | ✅ | `headX = (getNoteHeadBeginX+EndX)/2`, computed after the shift |
| **accidentals** | ❌ | `getModifierStartXY(LEFT)` omits `xShift` |
| **articulations** | ❌ | `getModifierStartXY(ABOVE/BELOW)` omits `xShift` |

⇒ dots come for free; **accidental + articulation need one explicit `Modifier.setXShift(px)`**
each in the renderer apply step. That modifier shift is a **draw-time nudge applied
post-format / pre-draw** (the same window as the multi-voice re-assert below): format has
already reserved the accidental's width at the *un-shifted* column, and we want exactly that —
an offset must not change spacing (the ⛔ note at line 90). So the accidental stays glued to the
moved notehead without widening the bar.

> Verified against the VexFlow 5 source (`stavenote.js` `getModifierStartXY`, `note.js`
> `getAbsoluteX`): the returned x is `getAbsoluteX() + branchOffset`, and `getAbsoluteX()` does
> **not** fold in `xShift`. Only the `RIGHT` branch (dots) re-adds `this.xShift`; `LEFT`
> (accidentals) and `ABOVE/BELOW` (articulations) do not. `getNoteHeadBeginX/EndX` and both tie
> X's add `xShift`, so noteheads/ties/slurs/beams/stems/`headX` all follow. The table is exact.

## Storage — client #12 of the engraving-overrides compartment

Clone the dynamic-offset shape:

- `kind: 'noteOffset'`, payload `{ x }` in **staff-spaces**, anchor-relative (never pixels).
- **Keyed by SLOT id**, not pitch id. One `StaveNote` = one slot; VexFlow cannot x-shift a
  single notehead of a chord independently, so a chord moves as a unit. Selection hands us
  pitch ids → one-line pitch→slot resolve via `ScoreModel.findSlot(pitchId)` (returns the
  containing `Chord`/`Rest`; take its `.id`). A rest is a slot too, so a selected rest is
  offsettable by the same key — allow it; `setXShift` works on rests.
- Absent = default (`override ?? 0`), so old scores and fresh notes need no entry.
- Returning to `x = 0` clears the entry (JSON stays clean), matching every other client.
- ⚠️ **Durability is weaker than the dynamic-offset client.** Dynamic offsets key on *durable*
  dynamic ids; a slot id is re-minted by rebar/paste. So a `noteOffset` orphans more readily
  than a dynamic offset — the deferral of copy/paste/rebar travel (below) is the right call, but
  do not treat the two as identical durability.

## Where it lives (mirrors dynamic offset end to end)

| Piece | Location |
|---|---|
| Type (`NoteOffsetOverride`) | `src/types/music.ts` |
| Read (`noteOffsetOverrideOf`) | `src/engine/models/engravingOverrides.ts` |
| Mutator (`nudgeNoteOffset`, accumulate + clear-at-0) | `src/engine/models/ScoreModel.ts` |
| Facade (`nudgeNoteOffset` + `resetNoteOffset`, one `saveOnly` undo each) | `src/engine/MusicEngine.ts` |
| Render apply (`setXShift` compose + modifier shift) | `src/engine/rendering/VexFlowRenderer.ts` |
| Redraw-key inclusion | `src/engine/rendering/MeasureRedrawKey.ts` |
| Keyboard surface (C) | `src/interactions/shortcutWiring.ts` |
| Properties surface (B) | `src/windows/properties/` + a channel + a controller |

## Two input surfaces on one facade

Both call the same `MusicEngine.nudgeNoteOffset(slotId, dx)`.

- **C — keyboard (cheapest, built first to prove the mechanism live).**
  - ⚠️ **A note's plain `←/→` is navigation** (`selectPreviousNote` / `selectNextNote`), so — unlike
    slur/dynamic, which get fine on plain `←/→` and coarse on `Ctrl` — the offset cannot use the
    plain arrows at all; every step rides a modifier chord.
  - **The chord layout (revised after live use — the "move vs offset" swap).** The first cut put the
    offset on `Ctrl+←/→` (coarse) + `Ctrl+Shift+←/→` (fine). In practice the *easy* key should carry
    what you reach for most and move a lot — the **note spacing / bar width** "move" — while the
    offset is a small, deliberate nudge you should *not* reach for as often. So they were swapped:
    - `Ctrl+←/→` = **move** (note spacing on a note, bar width on a barline), reset `Ctrl+Backspace`.
      This is the branch that **joins the existing modal chain** — the `Ctrl+←/→` handlers
      (`ctrlArrowLeft/Right`) that already carry the slur-endpoint / dynamic coarse nudge and
      *decline* (return false) when nothing applicable is selected. Move is a `||` onto that chain;
      no fresh `Ctrl+←/→` binding (it's taken, and all these selections are disjoint).
    - `Ctrl+Shift+←/→` = offset **wide** (`NUDGE_COARSE_SS = 1.0`).
    - `Shift+Alt+←/→` = offset **fine** (`NUDGE_FINE_SS = 0.25`) — the horizontal twin of the voice
      nav that owns `Shift+Alt+↑/↓`, on the axis the nav leaves free.
    - ⚠️ The offset's two speeds sit on **two different bases** (`Ctrl+Shift`, `Shift+Alt`), not one
      base + Shift — the price of keeping *move* on the plain `Ctrl` base (a coarse/fine PAIR only
      nests cleanly on `Ctrl`, and move claimed it). The matching-backspace-per-chord rule below is
      what ties them together.
  - **Reset (the first-class reset every override client gets** — clears the `noteOffset` entry
    outright, not a walk back to 0). **Both** `Ctrl+Shift+Backspace` **and** `Shift+Alt+Backspace`
    reset the offset: it is one value, and each of its two arrow-chords gets a matching backspace.
    (`Ctrl+Backspace` resets the *move*, matching `Ctrl+←/→`.) All wired in `shortcutWiring.ts` like
    the rest-shift / dynamic / slur-endpoint nudges (`getEngine()` → guard on a single note/rest
    selection → facade → `renderer.renderScore()`).
- **B — Properties input (the durable UI).** The window stays a **dumb publisher**: the input
  writes to a new `noteOffsetSelection` channel (a `PaletteSelection`-style singleton), and a
  small controller in `interactions/` — which owns `getEngine` — applies it. This keeps the
  "a content widget never holds the engine" rule the window defends; the *second* editable
  property then costs almost nothing.
  - **Absolute value** in the panel ("offset = 1.5 staff-spaces", type a number), not a
    stepper. The facade is a nudge, so absolute is just `dx = new − current`. Reads cleaner in
    a properties panel; the keyboard stays the relative surface.

## Four gotchas (each is silent if missed)

1. **Redraw key.** A `noteOffset` is **id-keyed**, so `measureShapeKey`'s `{measureId}:`
   position-key sweep will not see it — the exact trap the dynamic offset hit (JSON grows, the
   picture does not move). The note's compartment entry must be injected explicitly into the
   shape key, mirroring the dynamics line at `MeasureRedrawKey.ts:160`. When unsure, INCLUDE —
   a wrong answer here is a stale picture, not a crash.
2. **The multi-voice re-assert WIPES a naïve post-format `setXShift` — the offset must BE the
   captured value.** The re-assert loop (`VexFlowRenderer.ts:~1229`) does **not** preserve a
   "centering" shift: this codebase stacks voices with *forced stems*, and the loop *clobbers*
   VexFlow's auto sideways shift back to the **captured pre-format value** (`intendedXShift`,
   captured at `:1153`, which is `0`). So a `setXShift(userPx)` applied *after* format is
   silently reset to `0` on the next line — and multi-voice is the case this feature targets, so
   this is the default path, not an edge case. Fix: **fold the user offset into the captured
   value** — apply `setXShift(userPx)` on the staveNote *before* the `intendedXShift.set(sn, …)`
   capture at `:1153` (or add `userPx` in the re-assert at `:1229`). Numerically it's
   `0 + userPx = userPx`; the point is *where* it lives, so the re-assert restores it instead of
   erasing it.
3. **Two render-apply paths, not one.** `intendedXShift` is populated and re-asserted **only
   `if (multiVoice)`**. The common single-voice note never enters that loop, so it needs its own
   direct `setXShift(userPx)` (post-format / pre-draw). Do not assume one hook covers both — wire
   the multi-voice path (gotcha 2) *and* a single-voice direct apply.
4. **Key by slot, not pitch.** See Storage. Resolve the selected pitch id to its slot id
   before reading/writing the override.

## Build order

1. **Shared core** — type → read helper → mutator → facade → renderer apply (incl. the
   accidental/articulation modifier shift) → redraw-key inclusion.
2. **C** — keyboard nudge. Confirm live that beams, ties, accidentals and articulations all
   move correctly before spending anything on the window.
3. **B** — `noteOffsetSelection` channel + controller + the absolute-value Properties input.

## Known issue — articulations do not follow the offset reliably (✅ FIXED 2026-07-23)

Reported from use, then fixed the same day. **The first diagnosis below was WRONG** — recorded so
we don't re-derive it.

- **Symptom.** Offset a note that carries an articulation (accent/staccato/tenuto) and the notehead,
  stem, beam, ties, dots and accidental all move — but the articulation glyph often stays put.
- **The real tell (from a per-render trace).** It follows **iff the mark sits on the BELOW side**;
  an ABOVE mark never followed. It is `pos`-driven, NOT stem-driven — the earlier "follows iff the
  stem was reassigned / flip it and it moves" reading was an artifact of which pitches happened to
  put the mark inside vs outside the staff.
- **Root cause (confirmed against VexFlow 5 source, measured).** The raw `xShift += px` DID land on
  the articulation (`xShift AFTER +=` trace showed it), but `Articulation.draw()` calls
  `setOrigin(0.5, 0.5)` for any mark that snaps **within the staff lines**, and `Element.setOriginX`
  **overwrites** `xShift` — recomputing it from `this.x`, which comes from `getModifierStartXY`'s
  ABOVE/BELOW branch (`getAbsoluteX() + glyphWidth/2`, the *unshifted* note center — VexFlow folds
  `xShift` into dots on the RIGHT but not into ABOVE/BELOW). ABOVE marks land inside the staff →
  clobbered back to centre; BELOW marks sit outside → survive. Nothing to do with `reset()`/stems.
- **The fix.** Move what draw *reads* instead of poking `xShift`: for a note carrying an articulation,
  override that note's `getModifierStartXY` so the ABOVE/BELOW base x includes the offset px (the same
  amount the notehead moved). Then both the initial placement and `setOrigin`'s re-centering resolve
  to the shifted note. Accidentals keep the raw-`xShift` path (LEFT, no re-centering to fight); dots
  follow via the note's own `xShift`. See `applyNoteOffsets` in `VexFlowRenderer.ts`.
- **Reused since.** That `getModifierStartXY` override is now the shared lever for articulation X
  placement: the **articulation stem-align** feature (`docs/articulation-stem-align.md`) rides the
  same hook to snap a stem-side mark onto `getStemX()`. The Properties offset input also grew a
  small **reset** button (publishes offset `0` through `noteOffsetSelection`).

## Inside a FAN — offsetting one member (PLANNED, 2026-07-26)

Reported from use: select one member of a fanned group, nudge it, and **the fan owner moves**. Same
report the spacing feature got (docs/note-spacing-plan.md §7), and the same two causes underneath —
the address resolves to the owner, and there is nothing at the member end to shift.

- **The address.** `MusicEngine.nudgeNoteOffset` / `resetNoteOffset` / `getNoteOffset` all key the
  override through `slotIdForNote`, which is `findSlot(id, { fanMembers: true })` → **the containing
  chord's id** (`ScoreModel.ts:962`). A member's pitch id therefore writes at the owner's key. This
  is the *third* time a member has resolved to its owner (pitch, spacing, now offset).
- **And nothing to shift.** The apply is `StaveNote.setXShift` (`applyNoteOffsets`), and members
  1..n−1 are not `StaveNote`s: they are ink placed by `fannedBeamGeometry` between `headX` and
  `spanEndX`.
- **Which is why it looks like the owner MOVES.** The fan pass reads `headX` from
  `note.getNoteHeadBeginX()`, i.e. *after* the owner's `setXShift` — so the whole ramp starts from
  the new x. `spanEndX` does not move with it, so today an owner offset does not translate the fan,
  it **squeezes** it. Fixed as part of this (below), because it is the same line of code.

### The decisions

- ⭐⭐ **AN OFFSET MOVES THE NOTE YOU OFFSET AND NOTHING ELSE — the fan owner included** (his call,
  and the whole rule): *"if I offset something, things that are not the offset note should never
  move."* Inside a fan that reads both ways at once. Offsetting a MEMBER must not move the owner
  (P0). And offsetting the OWNER must not move the members either — member 0 is one note of the
  group, not a handle the group hangs from. So there is no translate and no squeeze: the ramp is
  computed from the owner's NATURAL column and every head then takes its own offset, or none.
- ⭐ **THE WHOLE MEMBER MOVES — head, stem and all** (his call). So the value is a property of the
  MEMBER, not of one notehead, exactly as an ordinary offset is a property of the slot and not of one
  chord tone. A member that carries two pitches moves as a unit; we could draw one head off its stem
  here (unlike VexFlow, we place these heads by hand), and we deliberately do not — a displaced
  notehead is a different notation from an offset.
- **Keyed by the member's OWN pitch id** — canonically `member.pitches[0].id`, resolved from whichever
  pitch is selected. No model change: members have been real `NotePitch` objects with real ids since
  `docs/fanned-beam-pitches-plan.md` P1, and the compartment is already id-keyed. ⛔ **Not by member
  INDEX** (`slotId#k` or similar): deleting a member is an operation that already exists (`count--`,
  ba7018a), and it would slide every entry after it onto the wrong head. ⛔ Not a new `member.id`
  field either — nothing needs it once the first pitch is the canonical key.

  ⚠️ **But "canonically the first" is not stable under an ordinary chord edit.** A member can hold
  several pitches, and deleting its FIRST one is the `member.pitches.length > 1` branch of `deleteNote`
  (`ScoreModel.ts:2741`) — the member lives on, but `pitches[0].id` is now a different id and the
  offset silently vanishes. ✅ **Decided in P0: the entry MOVES with the key.** `deleteNote` re-stamps
  it onto the new `pitches[0]` (`moveNoteOffsetKey`), so "the key is the member's first pitch" is an
  invariant and every reader — the facade, the Properties seam, the renderer — stays
  `member.pitches[0].id` and never has to search. The alternative (read under any of the member's
  pitch ids) would have put that search in two places, since the drawing looks the key up too.

  ✅ **A fallback member is not a case.** A mark that never went through `normalizeFan` has no
  `fan.members`, so `findSlot` cannot reach it (`ScoreModel.ts:1497`) and the renderer never registers
  it (`stored[k - 1]`, `VexFlowRenderer.ts:1252`) — it is unselectable, and its id IS the slot's own
  pitch, which resolves to the slot key. Nothing to decide, and saying so keeps the
  "member resolves to its owner" trap from being reopened here as a bug.
- **No floor.** Member gaps are floored at `minHeadGap` because two heads on one spot say nothing;
  an offset is *not* floored anywhere else in this feature, and the reason to nudge a member is
  usually to clear a collision the ramp itself made. The user's assertion wins.

### The drawing — one new option, applied after the layout

`memberOffsets?: number[]` (px, +right) on `FanGeometryOptions`, added into `xs[k]` **after** the
proportional/floor/scale pass and **before** `sx` is derived (`FannedBeam.ts:309`). Then everything
downstream follows for free, because everything downstream is computed from `stems[k]`: the stem
(`stemX`), the beam quads and their slope, the registry entry, the member's highlight group, the slur
anchor, the hand-drawn accidental and the ledger lines (`VexFlowRenderer.ts:1240-1275`).

⭐ **Entry 0 is REAL, and it is SUBTRACTED, not added.** VexFlow's `getNoteHeadBeginX()` is
`getAbsoluteX() + xShift`, so the owner's px are **already inside `headX`** (`VexFlowRenderer.ts:1342`)
— and `headX` is where the ramp starts. The whole of "the owner moves alone" is therefore one line:

```
base  = headX - memberOffsets[0]        // the owner's NATURAL column
usable = spanEndX - base - minHeadGap   // untouched by any offset, which is the point
xs[k] = base + Σ gaps + memberOffsets[k]
```

`xs[0]` comes back out as `headX`, so member 0 is drawn exactly where VexFlow put it and every other
head sits where it would have if nobody had touched anything. One rule for every member, no special
case at index 0, and **no squeeze and no translate**: `usable` never sees an offset, so the ramp is
the same picture whatever the owner does.

⛔ That kills the "does a nudged fan cross its own barline?" question before it is asked — nothing at
the far end ever moves, so `spanEndX` is never re-derived and the last head never walks into the next
note or the barline.

The px come from `staffSpacesToPixels(x, stave)` (`staffSpace.ts`), the conversion `applyNoteOffsets`
already uses — not the `VEXFLOW_DEFAULT_STAFF_SPACE_PX` constant `fanMemberSpacesPx` reads. The same
10 today, but this feature's rule is the stave's.

⚠️ **The opposite rule from `memberSpaces`, and that is the point.** A space is WIDTH: its px are
already inside `spanEndX` (the tick-context shift grew the bar), so it comes off the top and the ramp
shares what is left. An offset has NO width: it must not touch `usable`, must not move the next note,
must not change the bar. Same array shape, opposite arithmetic — do not let them merge.

Two consequences to see by eye rather than be surprised by. Both are the BEAM following its notes,
which is what a beam does everywhere else:

- Offsetting the **last** member changes the ramp's end x, so the beam lengthens and its slope
  re-leans. That is correct — it is what moving the last note of any beam does.
- Offsetting the **owner** leaves every other head still and drags the beam's near end off with its
  stem, so the line re-leans from that side. **This is the one existing-behaviour change**: today the
  ramp starts at the shifted `headX` against a fixed `spanEndX` and the group SQUEEZES, moving five
  heads nobody touched.

### Phases

1. **P0 — the address. ✅ DONE.** `ScoreModel.offsetTargetOf(noteId) → { key, memberIndex }`, beside
   `spacingColumnOf`: the slot id for an ordinary note/rest/member 0, the member's first pitch id and
   `k ≥ 1` for a member. The three facade methods route through it (and `MusicEngine.offsetTargetOf`
   exposes it for P1/P2), `deleteNote` carries the entry when its key pitch goes, and
   `ScoreModel.nudgeNoteOffset`/`clearNoteOffset` take a `key`, not a `slotId`. As designed, nothing
   is visible yet: a member nudge stops moving the owner and writes an entry nobody draws.
2. **P1 — the drawing. ✅ DONE (hand-test).** `memberOffsets` on `FanGeometryOptions` with the base
   subtraction at index 0, and `fanMemberOffsetsPx` reading the entries (the twin of
   `fanMemberSpacesPx`, ⚠️ opposite arithmetic). Two things came with it because the phase is not
   testable by hand without them:
   - **The shape-key line moved up from P3** — a member key is invisible to both existing override
     lines, so without it the bar never repaints and a nudge looks like it did nothing.
   - **The fan's ink rect now measures every member's own x** on both edges (`registerFanInk`): it
     spanned `headX` → last stem, and the ramp's order stops being the ink's order the moment a
     member is nudged past its neighbour.
3. **P2 — the surfaces. ✅ DONE.** `noteOverrideKey` became **`noteOverrideKeys`** (plural) in
   `interactions/selectionSnapshot.ts` and asks the engine for the key the nudge itself writes
   (`offsetTargetOf`), so a member reports ITS number and not its owner's — the `getNote` lesson: a
   surface must report what the model will accept. Its doc comment said *"no compartment client keys
   off a note's pitch id"*; that is now false, so it is rewritten rather than re-routed.
   ⭐ **Plural, because a REST answers to two schemes at once** — its shift and its hide are
   position-keyed, its offset is keyed by the slot it is — and reading either key alone hid the
   other silently. That was a live bug of its own: a rest with an offset showed `0` in Properties.
   `MusicEngine.slotIdForNote` had no caller left and is **deleted**; the model keeps its own
   (documented as ⚠️ *not* the offset address, which is the one case they differ on).
   ✅ The `measureShapeKey` half was pulled forward into P1 (and **stays out** of the width key — an
   offset has no width). The keyboard surface needs nothing: it goes through the facade.
4. **P3 — travel + cleanup. ✅ DONE.** Member entries joined `captureNoteOffsets` /
   `restoreNoteOffsets` and `ClipboardLane.noteOffsets`, captured as
   `(voice, staffId, slot absBeat, member index)` and restored onto the destination member's first
   pitch id. Index is the address *there* because `cloneFanFresh` re-mints every member pitch id, so
   the ids on the far side are new by construction while capture and restore are one instant of one
   passage. **The drop rule, stated like the slot one:** no slot starting at that beat → drop; slot
   there but no member `k` (a fan with fewer members, or no fan at all) → drop. Both benign.
   **FOUR ways a member dies, not two** — `clearFanMemberOffsets` is one helper called from all of
   them, which is the point of having it: `deleteNote` on the member; **lowering `fan.count`**
   (`normalizeFan`'s `slice(0, want)`, which never goes near `deleteNote`); removing the fan
   outright; and deleting the note that was typed, which takes the slot and the whole group with it.

Tests: the geometry contract in `FannedBeam.test.ts` (an offset moves that member's head and stem and
**no other head** — the ramp is unchanged; the same run with the offset at index 0, where `headX`
already carries it, must leave members 1..n−1 exactly where the un-offset run put them), the
resolution (a member id and
its owner return different keys), **the multi-pitch member keeps its offset when its first pitch is
deleted**, the shape key changes when a member's offset does while the width key does not, and one
travel test — all mirroring the spacing pass's.

## Explicitly deferred (not first steps)

- **Travel across copy/paste/rebar. ✅ DONE.** Slot ids are re-minted by the `RebarEvent` stream, so
  the offset is captured by POSITION and re-stamped — the rest-shift model exactly. `captureNoteOffsets`
  / `restoreNoteOffsets` in `rebarOps.ts` (keyed by `(voice, staffId, absBeat)`, covering chords AND
  rests since a note offset is slot-keyed), wired into both `rebarRegion` (meter change) and
  `pasteEvents` (destination's own offsets restored, then the clip's stamped on top — last wins). The
  clip carries them per lane: `ClipLane.noteOffsets` (`noteOffsetsInWindow`) — which since the `Clip`
  object (docs/refactor-plan-2026-07-27.md Phase 4) is ALL the plumbing there is: `pasteEvents` reads
  the lane it is given, with no separate param and nothing for `ClipboardController` to project. A slot the new tiling dissolves
  drops its offset (benign). Guarded by `noteOffsetTravel.test.ts`.
- **Auto-reset beyond delete.** Clear the override when the note is deleted; do not wire the
  fuller anchor-broken machinery yet.
- **Vertical (`y`) offset.** One field away, but out of scope until asked.
