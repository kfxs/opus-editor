# Tie stamp tool + Keypad editing of a selected tie

The third and last of the marking stamps, after `docs/articulation-stamp-plan.md` and
`docs/accidental-stamp-plan.md` — **read those first**; this doc records only where the tie
differs. As with the accidental, the feature has two halves: the **stamp** (§1) and **Keypad
editing of the selected element** (§2).

## 1. Tie stamp tool

Trigger: **selection mode, with no note selected**, press Enter (the tie key) on the Keypad.

- Arms the tool and switches to entry mode. A **ghost arc** follows the cursor.
- Click a note → **ties** it to the next slot in its own voice and staff. A rest / empty space /
  a note with nothing after it is a no-op (the click is still consumed).
- **Stays armed** so you can tie a whole passage. Esc / Select arrow / an Enter re-press disarms.

### Three ways it differs from its siblings

1. **Valueless.** The articulation stamp arms a *set* and the accidental stamp arms *one value*;
   a tie has nothing to arm — a note is tied to the next slot or it is not — so the tool is a bare
   flag, `EditorState.selectedTieTool: boolean`. There is no swap or stack, only on/off.
2. **Nothing to promote into.** Both siblings hand off to note entry on a duration press
   ("accent + duration" enters accented notes). There is no armed entry-mode tie — `tieSelection.ts`
   states the rule: *tie is a selection-mode action only* — so a duration press just **disarms** the
   tool and starts plain note entry. No `promoteTieStampToNoteEntry` exists.
3. **Entry mode keeps its old meaning.** The other two route their key three ways (apply / arm /
   arm-for-next-note); tie routes four, and the last is unchanged: in entry mode, Enter still ties
   the cursor note (Enter straight after entering a note ties it). Nothing competes for the key
   there, so the stamp branch is gated on `selectedTool === 'selection'`.

**Idempotent**, like the accidental: clicking an already-tied note does nothing. This makes one law
true of all three stamps — *a stamp only ever ADDS; removal is Delete or the selected-element edit*
— so a stray double-click can never silently undo work.

## 2. Selected tie → Keypad editing

Clicking a tie already set `selectedTieFromNoteId` and highlighted it; Delete removed it and `x`
flipped it, but **the Keypad's Enter key was inert**. Now a press routes to `editSelectedTie`, which
removes it — the tie's sibling of `editSelectedAccidental`, but with no "change it to a different
one" case, because a tie is valueless: the only edit a press can mean is remove. It follows the
accidental **switch-off rule** (`selectNote(null)`, leaving nothing selected), and the key lights
while a tie is selected so it reads as removable.

This half is **not optional**. Clicking a tie calls `selectNote(null)` first (MouseController), so
the note selection is empty — without its own branch, ordered ahead of the arm branch, an Enter
press on a selected tie would read as "nothing selected" and **arm the stamp**. That is the exact
trap `editSelectedAccidental` is ordered around.

## 3. The ghost is a real tie, previewing the MARK not the TARGET

A tie is a **relation between two notes, not a glyph**: its shape is derived entirely from its two
endpoints, and the second is *resolved* (next slot, same voice and staff, preferring the same pitch,
else a let-ring tie into whatever is there — `MusicEngine.toggleTie`). So there is no VexFlow
`draw()` to borrow, the way the articulation and accidental ghosts borrow theirs.

Instead it is **engraved as a real tie**: the same `drawCurveArc` primitive with the same `TIE_BOW` /
`TIE_THICKNESS` an engraved tie uses (exported from `TieRenderer` for exactly this), so it swells at
the belly and pinches to a point at each tip — and change those constants and the ghost follows.
`Curve.renderCurve` reads only its params and `renderOptions`; `from`/`to` are used by `draw()`
alone, which we never call, so one throwaway note satisfies the constructor.

It says *"tie tool armed"* and no more — which note ties to which is resolved at click time, and
logged there. That is the deliberate trade: previewing the real arc **on the hovered note** would
show the resolved target, but costs a `TieRenderer` refactor, the cross-system split, and a target
resolution per mouse move.

It **starts at the cursor and runs right** rather than straddling it — a tie begins at the note you
click and reaches forward, so its head is the part that follows the mouse. Geometry is three
constants in `renderScoreWithTieGhost`: `START_GAP_PX`, `WIDTH`, `LIFT_PX`. It bows downward
(direction +1), matching the Keypad's tie key, so the armed tool and the lit key read as one thing.

Two things it does differently from the other ghosts:

- **Stroked AND filled.** `renderCurve` does both, so each emitted `<path>` carries both and both
  must be overridden — or the ghost shows a blue body with a black outline (the same rule
  `HighlightController.colorTieGroup` carries). The other ghosts' pass sets `fill` only.
- **No bbox, no transform.** It is positioned by absolute path coordinates, so it needs no measure
  and no `translate` — unlike the glyph ghosts, whose VexFlow-internal positions must be measured
  and shifted onto the cursor.

Both, like the other ghosts, are painted **through the DOM after the draw, never the context** — see
below for why that is not optional.

### ⚠️ `context.save()`/`restore()` are NO-OPS — the trap this feature fell into

`VexFlowRenderer.initialize()` replaces them with `() => {}` (structuredClone throws on Vue's
reactive proxies). The consequence is app-wide and silent: **every context style change is
permanent**. `setStrokeStyle` repaints the shared context; `openGroup` then copies the context's
attributes onto every group it opens; and children with no style of their own inherit it — staff
lines carry no `stroke`, so they turn whatever leaked. Wrapping the change in `save`/`restore` looks
correct and does *nothing*.

The tie ghost shipped with exactly this bug: the arc set a blue stroke on the context, and from the
**second** mouse move on, every group — including each measure's — was stamped blue, so the staff
lines went blue and survived a full repaint. It is invisible on the first draw (the context is still
clean when that group opens), which is what made it look fine in a single-shot test.

Two traps worth naming, because they cost most of the debugging:

1. **A raw `new Renderer()` has WORKING save/restore.** Probing one "proves" containment while the
   app leaks — the context under test must be the engine's neutered one. `ghostContextLeak.test.ts`
   goes through `MusicEngine` for this reason, and asserts the no-op premise itself.
2. **`drawCurveArc` wraps `setLineWidth` in `save`/`restore`** and says it does so "so we don't leak
   the width to later draws". That comment is false — it is a no-op. Its own note that the width is
   "left thick by the preceding beam/stem passes" is the same bug seen from the other end. Harmless
   enough (a width, not a colour) that it is left alone, but do not read it as a working pattern.

`.vf-ghost-tie` is registered in `GHOST_GROUP_SELECTOR` — VexFlow's `openGroup` prefixes the class
with `vf-` itself, and the selector that forgets it never takes the ghost down (the tempo ghosts'
permanent blue smear).

## 4. A selected note lights the tie it owns

The last member of the "fully selected" family — head + stem + accidental + articulations already
lit; the arc did not. `highlightNote` now calls `colorNoteTie`, shared with the selected-TIE
highlight exactly as `colorNoteArticulations` is shared.

The **forward** (`tiedTo`) tie only, which is precisely what the Keypad's Enter lights and removes
(`noteHasTie` reads `tiedTo`) — so score and Keypad always agree. Select the far end of a tie and
neither lights: that note owns no tie, it is only tied *into*. No `tiedTo` lookup is needed —
`tieGroupMap` is keyed by the FROM note, so a note tying to nothing simply has no group.

This **deleted `applySelectionTieHighlight`**, which lit an arc only when BOTH endpoints were
selected — a strict subset of "the from-note is selected", so it became unreachable. One consequence,
deliberate: a range selection now lights ties whose far end falls *outside* the selection.

Both paths must be painted (`renderCurve` strokes AND fills), or the arc shows a coloured body with a
black outline — the rule `colorTieGroup` already carried.

## 5. Fixes found alongside

- **A stale articulation flag lit during a stamp.** All three stamps arm into ENTRY mode, where
  `noteHasAccent`/`Staccato`/`Tenuto` fall through to the `accent`/`staccato`/`tenuto`
  arm-for-next-note flags — which can be stale from an earlier note-entry session. The articulation
  stamp guarded its own case; the **accidental stamp did not**, so a leftover flag lit an
  articulation key during an accidental stamp. One shared guard (`markingStampArmed()`) covers all
  three.
- **A stamp press could arm two tools at once.** `setAccidental` / `pressArticulation` checked
  "is a DIFFERENT marking tool armed?" by naming the *one* sibling that existed. Since a stamp arms
  into entry mode, any sibling missed there falls through to the entry-mode branch and arms a
  note-entry value while leaving the other tool armed. Both checks now cover every stamp — caught by
  the mutual-exclusion test.

## Shared engine seam

No new engine method: the stamp calls the same `MusicEngine.toggleTie(noteId)` the palette and
Delete already use, so target resolution, the flip-direction reset, and the cross-barline cases are
identical by construction. The click wraps it in `runBatch` to keep the stamp's shape identical to
its siblings (one click = one undo) and to mark the model dirty for the repaint.

The whole feature lives in `interactions/` + `engine/` (framework-agnostic); the Keypad drives it
through the existing `tieSelection` press/highlight channels — no Vue-side code needed.
