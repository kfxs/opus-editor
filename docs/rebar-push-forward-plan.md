# Rebar push-forward + insert-measure plan

Status: **DONE 2026-06-20 (not yet committed).** Implemented exactly as planned, all
676 unit tests + build green. Settled with user 2026-06-20; reviewed against the
codebase 2026-06-20 (two corrections folded in: no `relayEvents` change — reuse
`bounded: false`; and preserve the measure-1 `timeSignatureChange` flag in the
`addMeasure`→`insertMeasureAfter` refactor). Implements the fix plus a reusable
`insertMeasureAfter` primitive (future GUI "add measure" feature).

## What shipped

- `ScoreModel.insertMeasureAfter(afterNumber, ts?)` (`ScoreModel.ts` ~134): splice +
  renumber (mirrors `removeMeasure`), rest-fills, marks `timeSignatureChange` only when
  it becomes measure 1 (`afterNumber === 0`). `addMeasure` now delegates
  (`insertMeasureAfter(length, ts)`) → one code path.
- `rebarRegion` (`ScoreModel.ts` ~691): relay always `bounded: false`; `grow =
  plan.length - targetBars` bars inserted via `insertMeasureAfter(lastRegionNumber + i)`
  pushing the next change forward; `regionNumbers` is now the contiguous run
  `[fromMeasure … fromMeasure+plan.length-1]`. Bounded/unbounded branches collapsed into
  one. `pasteEvents` UNTOUCHED (still its own `bounded`, fold-on-overflow) per Q1.
- `MusicEngine.insertMeasureAfter` (~245) exposed for the future GUI (own `saveUndoState`).
- Tests: `insertMeasureAfter` unit tests + measure-1-flag regression
  (`ScoreModel.test.ts` ~84), the exact repro + shrink-keeps-rests
  (`ScoreModel.test.ts`, `setTimeSignature` describe), MusicEngine single-undo + API
  (`MusicEngine.test.ts`).

This is a follow-on to the rebar work in [time-signature-plan.md](./time-signature-plan.md)
(Phase 8 rebar). Read that for the rebar pipeline background.

---

## The bug (repro)

1. Fill measures 1 & 2 each with 16 sixteenth-notes (4 beats each), score in 4/4.
2. Set **5/8 at measure 2** → rebars `[m2…end]` correctly (region grows, m3 added);
   m2 now carries an explicit 5/8 change.
3. Set **2/4 at measure 1** → **BUG**: measure 1 becomes a 2/4 bar with all 16
   sixteenths (4 beats) crammed into it, rendered crowded/SOFT.

### Why

`rebarRegion` (`ScoreModel.ts` ~691) resolves the region as
`[fromMeasure … nextExplicitChange)`. Setting 2/4 at m1 finds m2's explicit 5/8
change, so the region is **bounded to just `[m1]`** (`targetBars: 1, bounded: true`).
`relayEvents` (`utils/rebar.ts` ~348-365) then **folds** the 4 beats of overflow into
that single bar instead of making more bars — because there was no way to insert a
bar in the middle of the score and push the next change forward.

Growth already works for **unbounded** regions (region = tail of score), but only by
**appending at the end** via `addMeasure` (`ScoreModel.ts` ~116, ~737). `addMeasure`
only appends (number = length+1). There is no mid-score insert today.

---

## Desired behavior (Sibelius/Finale model)

Changing m1 to 2/4 should rebar its 4 beats into **two** 2/4 bars and **push the 5/8
change forward** by one bar (it lands on what becomes m3). Downstream content +
downstream TS changes shift later to make room. Nothing is crammed, nothing lost.

---

## Decisions (settled with user 2026-06-20)

- **Q1 Paste:** LEAVE PASTE AS-IS for now (keeps the old fold/cram on overflow). The
  same push-forward fix should eventually apply to paste ("paste should always
  override" — user), but it's deferred to keep this change focused. Recorded in the
  copy/paste memory too. `pasteEvents` shares `relayEvents`; to flip later, pass
  `bounded: false` and route its growth bars through `insertMeasureAfter` (the same
  mid-insert as rebarRegion).
- **Q2 Shrink case:** When a meter change makes content fit in FEWER bars than the
  region had, **KEEP the now-empty bars as rests** (option A). Do NOT auto-delete
  bars and do NOT pull the next change earlier. Removing bars belongs to an explicit
  "delete measure" action. (This is already what `max(needed, target)` gives.)
- **GUI:** Build `insertMeasureAfter` as a clean reusable API now; wire a GUI button
  later (user will ask). "Add measure" is a wanted feature; this fix is the priority.

---

## Implementation plan

### 1. New primitive — `insertMeasureAfter(afterNumber, ts?)` on `ScoreModel`

The building block. Mirror of `removeMeasure` (`ScoreModel.ts` ~178-192), which
already proves the splice+renumber pattern (renumbers measures AND each slot's
`.measure` field).

- Splice a fresh measure into `score.measures` right after `afterNumber`.
- Renumber every following measure + its slots' `.measure` (same loop as removeMeasure).
- A **mid-score** inserted bar carries the given meter and is **NOT** marked
  `timeSignatureChange` (it's a continuation bar, not an explicit change). Rest-fill it
  (materializeBar will overwrite it anyway when used by rebar).
- **GOTCHA — measure 1 is the exception.** `addMeasure` today special-cases
  `if (measureNumber === 1) measure.timeSignatureChange = true` (`ScoreModel.ts` ~127),
  and the constructor builds measure 1 via `addMeasure()` (~85). If `addMeasure`
  delegates to `insertMeasureAfter(0, ts)` and the primitive never marks the flag,
  **measure 1 loses its opening-signature flag** — a regression rippling into rendering,
  `effectiveTimeSignature`, and region-bounding. The refactor MUST preserve it: either
  keep the `number === 1` mark in `addMeasure` after delegating, or special-case
  `number === 1` inside `insertMeasureAfter`.
- Refactor `addMeasure()` to delegate (append = insert after the last measure) so
  there is ONE code path. Add a regression test that the constructor's measure 1 still
  has `timeSignatureChange === true`, and that `NoteEntryCoordinator`'s auto-append
  (`addMeasure()` at ~730, ~813, entering notes past the end) still works.
- Expose `insertMeasureAfter` (and keep `addMeasure`) on `MusicEngine` for the future
  GUI. Inside the rebar path undo is automatic (the whole rebar runs under
  `setTimeSignature`'s `saveUndoState`, `MusicEngine.ts` ~315; snapshot captures the
  mutation whole). But the **standalone** `MusicEngine.insertMeasureAfter` for the GUI
  must call `saveUndoState` itself, exactly like `MusicEngine.addMeasure` (~240-242).

### 2. `rebarRegion` — grow + insert in the middle — `ScoreModel.ts` ~725-746

**No change to `utils/rebar.ts` / `RelayOptions` is needed.** `bounded: false` ALREADY
means "grow": `relayEvents` returns `max(neededBars, targetBars)` bars and skips the
fold block (`rebar.ts` ~348 `wantBars`, ~355 fold guard `if (opts.bounded …)`). So the
earlier idea of adding an `overflow: 'grow' | 'fold'` option is redundant — reusing
`bounded: false` is strictly smaller surface and leaves paste untouched automatically.

- Call `relayEvents(events, meter, { targetBars, bounded: false })` (drop the bounded
  branch for the relay; still detect `endIdx` to slice the region).
- Compute `grow = plan.length - regionMeasures.length`. Insert that many bars
  **immediately after the last region measure** via `insertMeasureAfter(lastRegionNumber, ts)`.
  For an unbounded region this == appending (identical to today, so the bounded/unbounded
  branches collapse into ONE path — no separate `addMeasure` grow path here). For a
  bounded region it pushes the next-change measure (and everything after) forward.
  When `grow > 1`, insert consistently (`insertMeasureAfter(n)`, then `n+1`, …); the
  placeholder order is irrelevant since `materializeBar` overwrites each bar wholesale.
- Build the now-contiguous `regionNumbers = [fromMeasure … fromMeasure+plan.length-1]`
  and `materializeBar` into them (`materializeBar` ~1147 replaces slots wholesale, so
  pre-filled rests in inserted bars don't linger).
- Downstream relinking is UNCHANGED and survives the push for free, because it all
  keys off note **ids** not measure numbers: `restoreBoundaryTies`, `restoreSlurs`,
  `restoreBeatAnchors`. The pushed next-change measure keeps its own ids untouched
  (only region measures get regenerated).

### 3. Tests

- `relayEvents`: no signature change, so the existing bounded fold test (`utils/rebar.test.ts`
  ~138) stays as the paste-fold case. No new `grow` case is needed there — the existing
  `unbounded: longer content grows` test (~124) already covers grow.
- `insertMeasureAfter` unit tests: renumber + `slot.measure` correctness, append-equals
  behavior, mid-score bar not-marked-as-change, AND **measure 1 still marked as change**
  (constructor + append delegate).
- `NoteEntryCoordinator` auto-append regression: entering notes past the score end still
  extends the score (the `addMeasure()` calls at ~730, ~813).
- Integration test for the exact repro (ScoreModel or MusicEngine): m1+m2 full of 16ths
  in 4/4 → 5/8 at m2 → 2/4 at m1 ⇒ m1 & m2 become proper 2/4 bars, 5/8 lands on m3, no
  note lost, undo restores prior state.
- Shrink test: meter change that frees bars keeps them as trailing rest bars, next
  change unmoved.

---

## Notes / non-issues

- **Renderer / coordinate mapper:** rebuild from the score each frame; nothing caches
  measure count. No changes needed.
- **Undo/redo:** snapshot-based; free.
- **Tuplets:** still atomic (a straddling tuplet stays whole / renders crowded) —
  pre-existing, unchanged.
- **Other callers of `relayEvents`:** only `rebarRegion` and `pasteEvents`
  (`ScoreModel.ts` ~733, ~816). Paste keeps passing its own computed `bounded` (true
  when a later change pins it) → it stays on the fold/cram path automatically, with no
  flag plumbing, since `rebar.ts` is untouched (see Q1).

(Line numbers approximate — verify against current code before editing.)
