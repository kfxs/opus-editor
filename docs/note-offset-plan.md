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

## Known issue — articulations do not follow the offset reliably (🐞 OPEN)

Reported from use (2026-07-23). **The accidental case is FIXED**; the articulation case is not.

- **Symptom.** Offset a note that carries an articulation (accent/staccato/tenuto) and the notehead,
  stem, beam, ties, dots and accidental all move — but the articulation glyph often stays put.
- **The tell (the user's diagnosis, and it is the whole clue):** it follows **iff the note has a
  stem that VexFlow reassigned** — a stemmed note works, a voice-0 whole note does not, a voice-2
  whole note does, and **flipping the stem of a stuck note makes it move**.
- **Mechanism (confirmed against VexFlow 5 source).** The shift itself is applied correctly — the raw
  `xShift += px` in `applyNoteOffsets` lands on the articulation (verified via trace), and
  `Element.renderText` draws every modifier at `x + xShift`. The articulation only *renders* the new
  `xShift` when the note has been `reset()` + `preFormat()`'d after the initial format. In the
  multi-voice pass we `setStemDirection()` (→ `reset()`) **only for notes whose stem VexFlow flipped**
  (`VexFlowRenderer.ts` re-assert loop). A note with a stable stem — voice 0's especially — never
  takes that path, so its articulation draws from a stale render position and ignores the shift.
- **Why NOT the accidental.** The accidental bug was a *sign/reset* error in `Modifier.setXShift`
  (resets to 0, negates LEFT); switching to a raw `xShift +=` fixed it. The articulation is a
  *different* fault — the shift is right, the render is stale.
- **Fix directions to try next (do NOT just poke `xShift` again):**
  1. Give the offset note the same `reset()`/`preFormat()` refresh the flipped-stem notes get — but
     *after* setting the modifier shift, and without wiping `beam` (`setStemDirection` clears it) or
     the note's own `xShift`. Likely a narrower call than `setStemDirection`.
  2. Or translate the articulation's rendered SVG post-draw (the dynamic-offset technique) — needs an
     identifiable element; articulations don't currently open their own group.
  3. Or re-run just the modifier context's format for the offset note before draw.
- **Status:** deferred by request to finish the plan (copy/paste travel) first; **next-session
  priority.** A `dbg('[NoteOffset] …')` trace is left in `applyNoteOffsets` to help.

## Explicitly deferred (not first steps)

- **Travel across copy/paste/rebar. ✅ DONE.** Slot ids are re-minted by the `RebarEvent` stream, so
  the offset is captured by POSITION and re-stamped — the rest-shift model exactly. `captureNoteOffsets`
  / `restoreNoteOffsets` in `rebarOps.ts` (keyed by `(voice, staffId, absBeat)`, covering chords AND
  rests since a note offset is slot-keyed), wired into both `rebarRegion` (meter change) and
  `pasteEvents` (destination's own offsets restored, then the clip's stamped on top — last wins). The
  clip carries them per lane: `ClipboardLane.noteOffsets` (`noteOffsetsInWindow`), threaded through
  `pasteEvents`' `clipNoteOffsets` param and `ClipboardController`. A slot the new tiling dissolves
  drops its offset (benign). Guarded by `noteOffsetTravel.test.ts`.
- **Auto-reset beyond delete.** Clear the override when the note is deleted; do not wire the
  fuller anchor-broken machinery yet.
- **Vertical (`y`) offset.** One field away, but out of scope until asked.
