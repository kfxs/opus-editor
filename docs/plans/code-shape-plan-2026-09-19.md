# Code shape plan — 2026-09-19

**Status: IN PROGRESS — Phase 1 DONE (2026-09-19), bar item 5's two ⏭️ decisions. Phase 2 DONE. Phase 3.1: the hairpin / ottava / pedal body drags done and checked; the trill's too (`cdb7f05`); the slur's too (`69e927c`); the four SQUARE drags too (`6d903c3`); the slur HANDLE / ENDPOINT and staff-spacing drags too (`8f28f79`); the DYNAMIC and TEMPO drags too (`9a04f88`); bar width, barline join, group span and clef too (`ee31698`); the NOTE drag too (`7d2898e`) — every gesture is a module. **Phase 3.1 DONE** (`25f70a6`). 3.2: the `keys` column + dispatcher and the HAIRPIN on it (`e61626a`); OTTAVA / PEDAL / TRILL too (`14e10e7`); DYNAMIC and TEMPO too (`943fb64`); SLUR and CLEF too (`8382fcc`); the `reanchor` and `cycle` verbs done, awaiting his UI check — **Phase 3.2 DONE with it.** 3.3 (`highlight(ctx)`): the contract + the four span squares (`a7c1076`); the join and group squares (`b772418`); the `ink` column (`f1832e7`); the slur handles (`d3dcb7b`); the anchor guide line (`e2ff597`); the note pass + note-attached kinds (`aa7e5af`); every remaining row done, awaiting his UI check — **Phase 3.3 DONE** (`1efb38d`). 3.4: the panels' `rows` (`4db182d`); the typed `InspectedElement` union done, awaiting his UI check — **3.4 DONE** (`54ab9cc`). **Phase 3 DONE** — 3.5: all seven mark families are `engine/commands/<family>Commands.ts` (`e684125` … `a8549ad`), with command specs and `commit` / `saveOnly` folded into one `mutate`. **Phase 4 IN PROGRESS** — 4.1: `spanFromNotes`, `reanchorSlurs` → `slurOps`, `tieOps` (`6d720b8`) done; `deleteNote`'s repair → `deleteNoteOps` (`ab182f4`); `convertToRest` → `convertToRestOps` (`e20ca48`); `moveSelectionToVoice` → `voiceOps` (`5f6fa03`) — **4.1 DONE**. 4.2 split a–d: **a** the spanning note → `spanningNoteOps` (`551b39a`); **b** the overwrite → `entryOverwriteOps` (`ad381dd`); **c** the duration change → `durationChangeOps` (`cf41ba4`) + the chord-overflow FIX as its own commit (`6b97a8f`); **d** the tuplet builders + entry INTO a tuplet → `tupletEntryOps` (`6116fb8`) — **4.2 DONE** (coordinator 1,602 → 734 lines). 4.3 split a–e: **a** the three `repairDangling*` → `tieOps` / `slurOps` / `trillOps` (`1eed47b`); **b** the rest fill → `restFillOps` (`243d35c`); **c** slot placement + `insertPitch` → `slotPlacementOps` (`4323899`); **d** the model's `convertToRest` → `convertToRestOps.swapSlotForRest` (`5da6ce1`); **e1** `addRestSlot` — `VoiceDeps` GONE (`4e0e6b0`); **e2** `measureOps` — `RebarDeps` GONE, `ClearRangeDeps` 5 → 2 — done, awaiting his check — **4.3 DONE with it**; 4.5a (`GhostNote` / `PixelCoordinates` → the engine's type files, `7a248f7`); 4.5b (eight chapters behind the `music.ts` barrel) done, awaiting his word — **Phase 4 DONE** (`425d153`). **Phase 5 IN PROGRESS** — `RequestChannel<T>` (`ffef05b`); `spanLane` + `writeSpanOffset` (`9b9d27e`); `pressSpanTool` (`d9db8d9`); `mapElementCoordinates` (`6678cb4`); `rebarOps` twins (`da78ac2`); `trillTrace` (`073bde3`); the span-renderer shares (`33e8e4a`); the walk row measured and DROPPED (his word: no rule changes), `markLane` instead (`bca2bf6`); `src/testing/` done, awaiting his word — **Phase 5 DONE with it**; Phase 6 next.** Phases are ordered by
value over risk; each one stands alone and can be stopped after. A done item carries ✅ and what
actually happened where that differs from what was planned.

**Reviewed against the code the same day.** The measurements in §1 were re-taken and hold. The
review changed six things, each marked *(review)* where it landed: the tie undo is a confirmed
bug and leads Phase 1; `commit` and `saveOnly` differ in code but not in effect; the `delete`
and Properties rows reverse a recorded decision and now say so; `lint:hubs` counts kind mentions, not only lines;
the gestures step extends the `ActiveDrag` that already exists; and Phases 3.5 and 4.1 go family
by family.

A review of the whole codebase (140k source lines, 84k test lines, 145 docs), taken the day the
VexFlow removal closed and with less than half of the planned features built. The question was
whether the shape will carry the other half.

**Verdict: the architecture is sound and needs no rewrite.** It needs one targeted change to how
the hub files connect to the feature modules, score logic moved off the editor facade, and
overdue cleanup.

Successor to `refactor-plan-2026-07-27.md` and `modularity-plan-2026-07-28.md`. Their rule — *a
new feature adds a module* — stays. This plan explains why the hubs grew anyway and gives the rule
a mechanical check.

---

## 1. What was measured

| | |
|---|---|
| Comment share of source | 49% (68k of 140k lines). `MusicEngine` is 2,877 code lines, not 6,463 |
| Exact duplication (jscpd) | 0.36% |
| Runtime import cycles | 2 in all of `src/`. The other 51 madge reports are `import type` only |
| Unused ported VexFlow API | 3–5% |
| Tests | 6,544; no skips, no snapshots, no spec without an `expect` |
| Dead code | about 500 lines (§Phase 1) |

Hub growth in **code lines** since the module rule was written (2026-07-28):

| hub | then | now |
|---|---|---|
| `MouseController` | 1,386 | 2,122 |
| `shortcutWiring` | 489 | 986 |
| `HighlightController` | 783 | 1,171 |
| `PaletteController` | 1,076 | 1,360 |

One feature's cost: the pedal put more than 700 lines each into `MusicEngine`,
`MouseController` and `shortcutWiring`, and is mentioned in 104 files of which 12 are its own.

### Why the hubs grow although the rule is followed

Per-kind logic does land in modules. But the tables hold **dispatch rows that call back into the
hub**, so each kind's body and state stay there:

- `ElementKindSpec.highlight` is typed `(h: HighlightController) => void`
  (`interactions/elements/chain.ts`). The hairpin row calls `h.applyHairpinHandles()` — the paint
  code is still a controller method.
- `ElementChainDeps` carries nine `arm*Drag` members, each an arm method on `MouseController`.
- `MouseController` holds about 88 per-kind drag-state fields, and `handleMouseMove` probes 16
  `handle*Drag` methods in sequence.
- `pitchUp` / `pitchDown` / `octaveUp` / `octaveDown` are each one line chaining 12–13 per-kind
  nudgers with `||`. `deleteSelected` is a 184-line switch. `wireShortcuts` holds 61 per-kind
  helper closures.
- `PropertiesWidget.paint` is an `if (element.kind === …)` ladder; `selectedElements` is one
  244-line function of 22 cases.

The fix is to change the **contract**, not the rule: a row owns its body.

---

## 2. Phases

### Phase 1 — Safety and dead code (about a day)

1. ✅ `4dbdeb2` **Fix the multi-note tie's undo** *(review: confirmed by a probe, not only by reading)*.
   `MusicEngine.tieSelection`'s batch calls only `scoreModel.updateNote`, so `runBatch` counts no
   undo request: no history entry, and `isRenderStale()` stays false. Tie three notes, then
   Ctrl+Z: the ties stay and the undo takes the **previous** edit instead (the probe lost the
   third note). The ties are in no snapshot, so a later redo drops them. The fix is one line —
   request undo inside the batch. Add the spec the suite lacks: tie, undo, assert the ties went
   and the notes stayed.
2. ✅ `679f3a0` **A dev/test assertion that a public `MusicEngine` call which dirtied the model also requested
   undo** *(review: moved up from "Later")*. It would have caught item 1, and today the invariant
   is convention across about 400 methods.
   *Done as `engine/undoInvariant.ts`, armed under the test runner only. A survey of the whole
   suite found no offender beyond item 1. `preview*` became the named exception — a frame may
   defer its entry but must mark the model dirty — by PREFIX, since a list of the 51 would be one
   more per-kind slice. ⚠️ It sees only what a test calls.*
3. ✅ `22c4510` **CI runs the unit tests.** `build:check` has no `vitest run`, so a red suite still deploys
   (`.github/workflows/deploy.yml`). Add it as a separate job. The e2e suite stays out.
4. ✅ `c0620bf` **`engine/models/staffGroupOps.ts` is binary to git** — literal NUL bytes as `join()`
   separators. Write them as `'\0'`. Today the file has no diff and no blame.
5. ✅ **Delete dead code** *(what is still open is marked ⏭️ below)*, none of which carries a "kept for later" note unless listed:
   - `MusicEngine`: the 18–20 `move*` / `rebase*` methods orphaned when walking keys became runs
     (`b67b0f1`) — check each as it goes: `moveHairpinEndToStop`, `moveOttavaStartToSlot` and
     `movePedalToSlot` each have one reference beyond the quoted string — plus `getPlaybackState`, `getElementAt`, `getTupletElementById`. Remove their
     names from the walks' `Pick<MusicEngine, …>` lists, where they survive as strings.
     `getPlaybackPosition` is marked reserved — his call.
   - `ScoreModel`: `getBarline`, `getRepeatStart`, `getRepeatEnd`, `getMeasureCapacityFrac`.
   - `ElementRegistry`: `getInRect`, `getTupletsByMeasure`, `getElementTupletId`.
   - `ScoreRenderer.renderPendingTie`, `PaletteController.pressGroupNone`.
   - Ported classes: about 13 unreferenced methods (`EngravedNote.setLedgerLineStyle`,
     `getTickMultiplier`, `setKeyStyle`, `setNoteDisplaced`, `getCenterGlyphX`; four on
     `TickColumn`; one each on `ColumnModifiers`, `SvgPainter`, `EngravedBeam`, `EngravedHead`).
   - `naturalStemDirection`; drop the needless `export` on the six knip lists as file-internal.
   - About 17 test-only methods (`setClef`, `removeClef`, `isRendered`, …): decide each — a
     method only tests call is either a missing feature or a test of nothing.

   *Done: 18 `move*` / `rebase*` methods and the three getters off `MusicEngine`, their strings off
   the six walks' `Pick` lists; the `ScoreModel` four plus `setHairpinStartAtSlot` (orphaned by the
   first group); the `ElementRegistry` three; `renderPendingTie`; `pressGroupNone`; 13 methods on
   the ported classes; `naturalStemDirection`. About 540 lines.*
   - *KEPT: `moveOttavaStartToSlot`, `movePedalStartToSlot`, `movePedalToSlot` — spec and e2e
     fixtures set up with them, so they are test-only methods, not dead ones.*
   - *The deleted `rebaseHairpinEndpointOffset` comment was the one home of "a re-base is
     bookkeeping, so the page limit must not see it"; the rule now lives on
     `previewHairpinEndpointRebase` and the other re-bases point there (§3: the rule travels).*
   - ⏭️ *The "six knip lists" could not be identified — the run was not saved, and a fresh one
     reports 69 unused exports, many of them sourced rows exported on purpose. His call which.*
   - ⏭️ *The test-only methods wait on his decision, each: `MusicEngine.setClef` / `removeClef` and
     the three kept above; `ScoreModel.getEngravingOverride(s)` / `getSlotsInMeasure` /
     `slotIdForNote` / `validateMeasure`; `barlineOps.repeatStartAt` / `repeatEndAt`;
     `ScoreRenderer.setDrawFilter`; `ElementRegistry.findClosestNote` / `findNotesNearX` / `findAt`;
     `PaletteController.setDynamic` / `setTempo`; `CoordinateMapper.beatToPixelX` / `getConfig` /
     `isWithinMeasureBounds`; `ViewportModel.getContentSize`; `PlaybackEngine.getState` (no caller
     at all) and the reserved `getPlaybackPosition`.*
6. ✅ **Fence what the docs already claim.** Add `engine/rendering`, `engine/layout` and
   `engine/fonts` to the score layer's restricted imports. It fails today on
   `barlineOps.ts` → `layout/barlineSign` (→ font metrics); move the pure half
   (`signAtBoundary`, `wingsAllowed`) to the core, and the `BarlineSignKind` type with it —
   `ScoreModel.ts` imports it from the same file.
   *Done as `engine/models/boundarySign.ts` (+ its spec, moved with it). `engine/rendering` was
   already fenced; `layout` and `fonts` were added and the fence was proved to bite. ⚠️
   `wingsAllowed` was NOT pure — it read the sign's parts, hence the font — so the core states it
   as a total table and `barlineSign.test.ts` holds that table to `hasThickLine`, the same answer
   read off the parts.*
7. ✅ Cheap settings: `noImplicitOverride` (0 errors), `noImplicitReturns` (2), drop the leftover
   `jsx` / `*.tsx` settings, drop `@types/uuid`. Decide prettier: run it once with
   `.git-blame-ignore-revs` and a CI check, or remove it — today it is configured and never run.
   Decide before Phase 6, whose file moves cost the same blame.
   *Done: both flags on (the two `noImplicitReturns` sites were shortcut handlers that fell off
   the end where they meant "consumed"; they now say `return true`, the same thing to
   `ShortcutManager`, which only tests `=== false`), `jsx` / `*.tsx` gone, `@types/uuid` gone.
   **Prettier REMOVED — decided, not drifted:** measured on a scratch copy it would rewrite 888 of
   1,064 files (~48k diff lines), most of it re-breaking code laid out by hand on purpose. The
   style is held by eslint and by the surrounding code.*
8. ✅ Retire `lint:vexflow` (509 lines, 6.4 s, all zeros; the import ban already guards) and shrink
   `lint:paint` to its one live ceiling.
   *Done: the census script is deleted (git history keeps it) and `lint:paint` is the `svgNode`
   ceiling alone, 199 → 80 lines, now listing every use when it fails. ⚠️ One thing the census
   held that nothing holds now: S15's NAMES rule — no identifier or class spelled `vex` / `vf-` in
   `src/` or `e2e/`. The import ban guards the dependency, not the spelling.*

### Phase 2 — Make the rule mechanical

1. ✅ **`npm run lint:hubs`** *(review: the metric changed)*. Hubs: `MusicEngine`, `ScoreModel`,
   `ScoreRenderer`, `MouseController`, `PaletteController`, `HighlightController`,
   `shortcutWiring`, `PropertiesWidget`, `selectionSnapshot`. This is the check ARCHITECTURE says
   the rule lacks. Two counts per hub, comments excluded:
   - **Kind mentions** — identifiers naming an element kind (`Hairpin`, `Ottava`, `Pedal`,
     `Trill`, …). This is what §1 diagnosed, denser lines cannot satisfy it, and its ceiling may
     only fall from day one.
   - **Code lines** — reported from day one, but a fall-only ceiling only once a Phase 3 or 4 step
     has emptied that hub, as the step's exit condition. Before that it would contradict the
     plan's own rules: "the facade may gain a one-line delegation" and Phase 4.4 both mean a new
     feature still adds a few lines to `MusicEngine`, and a ceiling that may only fall would block
     the feature until something unrelated was extracted.

   *Done as `scripts/check-hubs.mjs`, in `build:check`. The kind vocabulary is READ OUT of the
   `SelectedElement` / `MarkingTool` unions rather than listed, so a new kind is counted from the
   commit that adds it (a fixed list would have been blind to exactly that). `deleteSelected` and
   `selectionSnapshot.selectedElements` are counted out by name. Day-one ceilings, kind mentions ·
   code lines: `MusicEngine` 1130 · 2774, `ScoreModel` 1105 · 2012, `ScoreRenderer` 901 · 2293,
   `MouseController` 970 · 2122, `PaletteController` 504 · 1351, `HighlightController` 316 · 1172,
   `shortcutWiring` 465 · 806, `PropertiesWidget` 187 · 977, `selectionSnapshot` 7 · 44.*
2. ✅ **`engine/rendering/renderTypes.ts`**: `ScoreRenderer`'s exported types plus
   `measureGroupKey`; move `isEngravedNote` into `EngravedNote.ts`. Removes both runtime cycles
   and dissolves the 35-file import cluster.
   *Done: `MeasureBounds`, `MeasurePlacement` and `measureGroupKey` are `renderTypes.ts`; nine
   importers no longer name `ScoreRenderer`. Runtime cycles 2 → **0** (madge, type imports
   skipped). ⚠️ `isEngravedNote` takes `unknown` now — `BarTickable` lives in `barVoice`, and
   importing it back would only re-draw the loop as a type one. The `LAYOUT_CONFIG` /
   `VIEWPORT_HEIGHT` / `MeasureWidthInfo` re-export stays until item 3 moves `layoutConfig`, so
   its importers are repointed once. `ScoreRenderer`'s kind ceiling 901 → 891.*
3. ✅ **Move `MeasureLayout`, `MeasureWidthCache`, `layoutConfig`, `thinLineWeight` to
   `engine/layout/`** (with `drawsTimeSignature` and `PagePass`'s two constants). All five
   backwards `layout → rendering` imports go, and the arrow becomes lintable. Specs move with
   their modules.
   *Done: the four modules and their ten specs are in `engine/layout/`; `drawsTimeSignature` is
   `headerInk`'s, the page constants `surface`'s; `ScoreRenderer`'s re-export of `LAYOUT_CONFIG` &
   co. is gone and its importers name `layoutConfig`. `layout → rendering` imports 5 → 0 and
   `lint:boundary` holds it (proved to bite). Unit suite and all 300 e2e green. ⚠️ `perf/` is
   outside `tsc`'s include — a moved path there fails only when vitest loads it.*

### Phase 3 — A row owns its body (the main structural change)

Run the e2e suite either side of each step.

1. **Gestures.** `interactions/drags/<kind>.ts`, each exporting `begin<Kind>Drag(host, grab)`
   that returns:

   ```ts
   interface Gesture { kind: DragKind; move(x: number, y: number, ev: MouseEvent): void; end(): void }
   ```

   State lives in the closure, which removes the ~88 fields. `handleMouseMove` becomes
   `this.activeDrag?.move(x, y, ev)`. `ElementChainDeps`' nine `arm*Drag` members become one
   `begin(gesture)`. Start with the hairpin / ottava / pedal body drags behind one `bodyDrag`
   helper, then trill and slur.

   *(review)* This **extends what exists**: `MouseController` already has
   `ActiveDrag { kind, end }` and one `activeDrag` field, every handler is already keyed on
   `activeDrag.kind`, and `slurBodyDrag.ts` / `tempoDrag.ts` already hold two families' rules. The
   step is "add `move` to `ActiveDrag`, then move one family's state into its closure at a time".
   - The three body drags are **not** the same 15 lines: the hairpin's frame ends with a second
     draw after the preview (`settleHairpinLanding`, the flip that may not move the drawing).
     `bodyDrag` takes an after-frame hook; the hairpin is not flattened to fit.
   - The drag comments carry the costliest rules here — the three release paths, "the drop renders
     for real", the stale-lane trace. Under §3 the **rule travels with the code**; only the story
     is dropped.
   - Nine `MouseController.*.test.ts` specs cast into the private drag fields. They break at this
     step and move to `drags/<kind>.test.ts` in the same commit (a spec moves with its module).
   - jsdom cannot prove a drag. Each family stops for his UI check, not only the e2e suite.

   *First family done — the hairpin / ottava / pedal BODY drags: `interactions/drags/gesture.ts`
   (the `Gesture` contract, `DragKind`, `DragHost`; `ActiveDrag` became it, with an optional
   `move`), `drags/bodyDrag.ts` (the shared frame, with `afterFrame` for the hairpin's settle and
   `beforeCommit` for the ottava's and pedal's) and one row module per kind. `MouseController`
   lost 15 fields, three handlers and three enders; its arm methods are one line each
   (`this.begin(begin<Kind>BodyDrag(…), event)`), and `handleMouseMove` hands a gesture that has
   `move` every move before the old chain. Kind mentions 970 → 835, code lines 2,122 → 1,996.
   The specs that drive these drags through real mouse events (`MouseController.hairpinBodyDrag`,
   `.dragRelease`) passed UNCHANGED, which is the evidence the behaviour held; the helper's own
   contract is `drags/bodyDrag.test.ts`. ✅ His UI check passed (`8668f65`).*

   *Second — the TRILL body drag, `drags/trillBody.ts`. ⛔ Not a `bodyDrag` row: its frame is the
   square's — the HOLD's ledger (now the gesture's own, no longer the controller's shared
   `markHold`), the span measured at the press, and a WRAP that ends the gesture from inside a
   frame (`end` is idempotent, so the release that follows finds it over). ⚠️ No spec drove this
   drag before; `drags/trillBody.test.ts` is its first. `MouseController` kinds 835 → 779, lines
   1,996 → 1,930. ✅ His UI check passed (`cdb7f05`).*

   *Third — the SLUR body drag, `drags/slurBody.ts`: a `bodyDrag` row after all. The frame's
   delta-since-the-last-accepted-cursor IS the position `slurBodyDragStep` converts when measured
   from a fixed origin, so the arithmetic and the refusal rule stay in `slurBodyDrag.ts` and the
   row is one line. The scale is still measured once, at the press. Its first wiring spec.
   `MouseController` kinds 779 → 742. ✅ His UI check passed (`69e927c`).*

   *Fourth — the four span families' SQUARE drags, `drags/markEnd.ts`: the `MARK_END_DRAGS` table
   moved whole (its `endsOnWrap` column was `true` four times, so it is now the frame's rule), and
   `MarkEndSession` + the controller's shared `markHold` became closure state. ⭐ Its frame and the
   trill body's were the same frame — the hold, the latch, the wrap — so both are now rows of ONE
   helper, `drags/heldDrag.ts` (`bodyDrag` is that frame without the hold). `trillBody.ts` was
   ported onto it in the same step; its spec passed unchanged before the frame-level tests moved
   to `heldDrag.test.ts`. `MouseController.markEndDrag.test.ts` (event-driven, all four families)
   passed UNCHANGED. `MouseController` kinds 742 → 718, lines 1,891 → 1,792. ⏸️ Awaiting his UI
   check — the squares, and the trill body again since it was re-seated. ✅ Passed (`6d903c3`).*

   *Fifth — the slur's HANDLE and ENDPOINT drags. `drags/slurEndpoint.ts` is a `heldDrag` row: the
   controller's inlined hold (4 fields, 2 constants, `catchupGainFor`, ~150 comment lines) was the
   ORIGINAL `dragHold` was extracted from — same 0.8, same 30 px cap, same derived gain — so it is
   deleted, after the two rules only its comments held (neighbouring regions ABUT with zero margin;
   the gain quantises reachable positions) were carried into `dragHold.catchupGain`. `heldDrag`
   gained `family: 'score'`: a full render per frame and none at the drop, which is what this
   gesture always did (its frames re-tint the anchor note and move the guide line).
   `drags/slurHandle.ts` is its own small gesture — a control point is where the hand IS, so it
   sets rather than accumulates. First specs for both. `MouseController` kinds 718 → 594, lines
   1,792 → 1,640.*

   *🚨 Found on the way: `draggedStaffSpacePx` was ONE field shared by the slur-handle drag and the
   STAFF-SPACING drag, and only a slur grab ever wrote it — so dragging a staff's spacing ran at
   10 px per space unless a slur handle on a small staff had been dragged earlier in the session
   (the hazard `spacingDragStaffSpacePx`'s own comment warned of, one field over). The coupling is
   gone with the slur's state; the staff-spacing drag now divides by a constant 10, which is what
   it did in any session without a slur grab.*

   *✅ FIXED at his word, in the same step: the staff-spacing drag is `drags/staffSpacing.ts` and
   measures the GRABBED staff's own line spacing at the press. The stored distance is in that
   staff's own spaces (`staffStride.spacingAbovePx`), so this is what makes a pixel of hand a
   pixel of staff on a small staff too — ⚠️ a deliberate behaviour change there, the only one in
   this phase. Its first spec. ✅ His UI check passed (`8f28f79`).*

   *Sixth — the DYNAMIC and TEMPO drags. `drags/dynamic.ts` is a `bodyDrag` row; `bodyDrag` gained
   an optional press position, because a mark that is its OWN handle arms on the selecting press
   and takes its baseline on the first frame PAST the threshold (charging that travel would start
   the gesture with a jump). `drags/tempo.ts` is its own gesture — a SNAP measured against an
   absolute hand reference (the grab), ⛔ not a delta — and it took the exploratory `dragTrace`
   instrument with it; `drawnMarkX`, the one DOM read, is handed in by the controller. First specs
   for both. `MouseController` kinds 594 → 489, lines 1,606 → 1,478. ✅ Passed (`9a04f88`).*

   *Seventh — the four STRUCTURAL drags: `drags/barWidth.ts`, `barlineJoin.ts`,
   `staffGroupSpan.ts`, `clef.ts`, each its own gesture (none is a delta-through-the-music walk,
   so neither helper fits). The contract grew twice for them: `Gesture.move` may answer `false` —
   "not mine yet" — so a bar-width press still inside its dead zone lets the plain move carry on
   (the hover, the ghost), as it always did; and `DragHost.setCursor`, for the bar-width drag's
   hidden pointer. The clef's slot resolver is the controller's (the marking tools share it) and is
   handed in. The event-driven `MouseController.barWidthDrag` / `.barlineJoinDrag` /
   `.dragRelease` specs passed UNCHANGED; clef and group span had no spec and got their first.
   `MouseController` kinds 489 → 383, lines 1,478 → 1,228. ✅ Passed (`ee31698`).*

   *Eighth and last — the NOTE drag, `drags/note.ts`: one press, the axis decided from the
   movement (distance, not time) and then fixed; the spacing half previews and commits once, the
   pitch half writes each step through `updateNote`. It reads the grabbed note from the SELECTION
   each frame, as the handler did. `MouseController.noteSpacingDrag.test.ts` (event-driven: both
   axes, rests, a fanned member) passed UNCHANGED. With it `handleMouseMove`'s chain of sixteen
   `handle*Drag` probes is ONE line, `Gesture.move` is required, and the controller holds no
   per-gesture state at all. `MouseController` lines 1,228 → 1,135 — and its code-line ceiling
   STARTS here, as §2.1 said it would once the hub's step was done. ✅ Passed (`7d2898e`).*

   *⚠️ Noticed, not changed: a PITCH drag files one undo entry per pitch it passes through
   (`updateNote` each frame), where every other gesture files one for the whole drag. It always
   did; whether that is wanted is his call.*

   *Ninth — `ElementChainDeps`' nine `arm*Drag` members are ONE: `arm(build, event?)`. The element
   module hands over a BUILDER (`door => beginHairpinBodyDrag(door.host, id, x, y)`) and whoever
   holds the door decides whether the gesture is built at all — so `markGroupSelect`'s Ctrl-press,
   which arms nothing, shuts every kind's drag with one no-op where it stubbed nine. The builder
   is handed a `GestureDoor` (`host`, `state`, `slotBeatAt`, `drawnMarkX`): generic capabilities,
   ⛔ none per kind, so a new draggable kind adds nothing to `chain.ts` or to `MouseController`.
   ⚠️ The plan said `begin(gesture)`; a builder rather than a built gesture is what lets a closed
   door cost nothing. The seven one-line `arm…Drag` forwarders left the controller; the four
   element specs that asserted `arm<Kind>Drag(id, x, y)` now assert what the builder builds.
   `MouseController` kinds 383 → 307, lines 1,135 → 1,100. ✅ Passed (`25f70a6`).*

2. **A `keys` column on `ELEMENT_SPECS`** — `{ nudge, reset }` first — and one dispatcher.
   Replaces the four `||` chains and the 61 closures.

   *Started, one family at a time as 3.1 went. `elements/keys.ts` is the contract
   (`ElementKeys { nudge, reset }`, a `KeysCtx`, `KeysOf<'kind'>`), `ElementKindSpec` has the
   `keys?` column, and `shortcutWiring` has ONE dispatcher pair — `nudgeSelectedElement(dx, dy)` /
   `resetSelectedElement()` — at the HEAD of every chain: the four vertical ones, the two plain
   horizontal arrows, `Ctrl+←/→` and `resetMove` (nine, not four). ⭐ Dispatch on the kind is sound
   because `selectedElement` is ONE element — the chains were disjoint by construction; what is
   not disjoint (an armed square against the whole mark) is one kind, and its module decides.
   `dx`/`dy` are SCREEN staff-spaces, so a kind with its own convention (the tempo's outward `y`)
   converts inside its row. First family: the HAIRPIN — `elements/hairpinKeys.ts` replaced four
   closures and 17 chain links. `shortcutWiring` kinds 465 → 406. ✅ Passed (`e61626a`).*

   *Second — OTTAVA, PEDAL and TRILL, and ⛔ not three modules: their twelve closures were already
   thin wrappers over `spanMarkKeys.ts`'s generic verbs reading `SPAN_MARK_TOOLS`, so the family
   gets ONE factory, `spanMarkKeys(kind)`, and each element row is `keys: spanMarkKeys('pedal')`.
   The one thing the closures knew that the table did not — which commit a key RUN settles with —
   became two columns, `commitEnd` / `commitWhole` (⚠️ a trill's whole-mark run commits through
   its START). 12 closures and 54 chain links gone; `shortcutWiring` kinds 406 → 310, lines
   781 → 683.*

   *🚨 A slip worth keeping: my scripted edit dropped `keys:` INSIDE a multi-line `highlight` body,
   where it parses as a LABELLED STATEMENT. `tsc` accepts that, and a lost row is silent at
   runtime — the dispatcher declines and the key falls through to the pitch edit. The
   event-driven `shortcutWiring.pedalOffset` / `.ottavaOffset` specs caught it (16 red); the lint
   would have too (`no-unused-labels`), had I run it before them. `chain.test.ts` now pins WHICH
   kinds answer the keys by name, and that every such row has both verbs. ✅ Passed (`14e10e7`).*

   *Third — DYNAMIC and TEMPO: `elements/dynamicKeys.ts`, `elements/tempoKeys.ts`, a spec each.
   ⭐ The column speaks SCREEN staff-spaces, so the tempo's row is where `↑` (a negative screen
   `dy`) becomes a positive OUTWARD — the old chain did it by passing that one closure a flipped
   sign on each of four lines, which is exactly the kind of fact that belongs to the kind. The
   key RUN is still told the SCREEN delta. 4 closures and 15 links gone; `shortcutWiring` kinds
   310 → 260. ✅ Passed (`943fb64`).*

   *Fourth and last of `{ nudge, reset }` — SLUR and CLEF. `elements/slurKeys.ts` holds the one
   kind with four readings (a true END, an open JOIN of a cross-system slur, a SHAPE handle, the
   WHOLE curve), mutually exclusive by what is armed, and keeps the one asymmetry the closures
   had: an armed end or join ALWAYS consumes the key and renders, even on a refusal, while a shape
   handle and the whole curve decline. ⛔ No key run for the slur — every press is its own write.
   `elements/clefKeys.ts` is horizontal-only and lets the ENGINE refuse a header clef. 9 closures
   gone; `shortcutWiring` kinds 260 → 180, lines 638 → 562.*

   *⭐ The nine chains now read as the plan wanted: `pitchUp` is
   `nudgeSelectedElement(0, −fine) || nudgeSelectedRest(1)`, else the pitch edit; `Ctrl+←/→` is
   the element, else note spacing, else bar width; `resetMove` likewise. What is left in them keys
   off the NOTE selection, not `selectedElement`, and stays. Over 3.2: 29 closures and ~100 chain
   links out of `shortcutWiring`, kinds 465 → 180, lines 806 → 562; eight kinds answer the keys,
   pinned by name in `chain.test.ts`. Two orphaned doc blocks the deletions had left behind (the
   ottava's, the pedal reset's) went too — their rules already stood in `spanMarkKeys.ts`.
   ✅ Passed (`8382fcc`).*

   *Fifth — two more verbs on the column, for the two per-kind chains `{ nudge, reset }` had left:
   `reanchor(direction)` (`Ctrl+Shift+←/→` — **move it through the MUSIC**, the other category
   from `nudge`: a model write, audible for most kinds; on a span the ARMED SQUARE is the gate and
   says which end, a point mark moves whole) and `cycle(step)` (`Tab` — arm the next drawn handle).
   Sixteen closures went: five `walk…Handles`, and the eleven links of the re-anchor chain — the
   hairpin's, ottava's and pedal's resize / move-start pairs, the slur's and trill's note walks,
   the dynamic's and tempo's slot moves, and the clef's beat-map step (now `clefKeys.reanchor`,
   still ending on the DRAG's own `commitClefMove`). The span family took it as ONE more column of
   `SPAN_MARK_TOOLS`, `reanchor`. The chords now read
   `reanchorSelectedElement(±1) || nudgeSelectedNoteOffset(±coarse)` and
   `cycleSelectedElement(±1)`. `chain.test.ts` pins which kinds answer each verb: all eight
   re-anchor; only the spans and the slur have handles for `Tab`.*

   *⭐ `shortcutWiring` at the end of 3.2: kinds 465 → **67**, code lines 806 → **431** (both
   counted without `deleteSelected`), 45 per-kind closures gone — and its code-line ceiling STARTS
   here. What it still names per kind is the barline / bar-width / note-spacing group (a selected
   NOTE or a boundary, not `selectedElement`'s row), the hairpin's mouth, and `deleteSelected`'s
   switch, which stays by decision. ⏸️ Awaiting his UI check.*

   *(review)* **`delete` reverses a recorded decision and is his call.** `chain.ts`'s header (and
   CLAUDE.md, "the two sites that stay switches") says a `delete?` row was sketched and refused:
   the bodies are "5–20 lines of real per-kind reasoning" needing the engine, the state, the
   selection and the multi-select set, and Delete on a measure box runs a batch over what the box
   pulled in. What has changed since is the count — the switch is now 184 lines over 22 kinds.

   **Recommended: the decision stands; the switch stays.** Read case by case, 13 of the 22 are
   the same four lines (`eng.remove…(id)`, clear the selection, render), so a kind costs this hub
   four lines, against the dozens it costs the nudge chains — this is not where the growth is.
   The six with real reasoning (measure box, articulation, accidental, key and time signature,
   clef) are exactly what the note described. And what Delete leaves SELECTED differs by kind on
   purpose — the note for an accidental, dot or tremolo; nothing for a span; the barline itself;
   `deselectAll` for a box — which reads as one policy only while it is one screen. It is already
   exhaustive at one site. `lint:hubs` counts `deleteSelected` out by name.
3. **`highlight(ctx)` instead of `(h: HighlightController)`**: the kind's module paints. First
   `paintEndpointHandles(kind, handles)` for the four 34-line handle painters.

   *First slice done — the contract and the span squares. `elements/highlightContext.ts` is what a
   row is handed: engine, svg, state, registry and the layer's four undo-logged writes (`setAttr`,
   `setStyleProp`, `addClass`, `addNode`), built by `HighlightController.context()`. It also carries
   `controller`, ⏳ TRANSITIONAL: a row whose body has not moved reads `ctx.controller.apply…()`, so
   the rows left to do are a grep, and the member goes with the last one.
   `elements/endpointHandles.ts` is the one painter (+ `HANDLE_R` / `HANDLE_HIT`, which the slur,
   join and group squares still read through the controller's statics); the hairpin, ottava, pedal
   and trill rows call it with their own geometry, and the four `apply<Kind>Handles` are gone.
   `HighlightController.hairpin.test.ts` moved with it → `elements/endpointHandles.test.ts`, now
   through the hairpin's ROW, plus one case per kind (class, `<kind>Id`, off with the layer).
   Hub: kinds 316 → **256**, file 2,172 → 1,989 lines. ✅ Passed (`a7c1076`).*

   *Second slice — the other two squares. `elements/handleSquare.ts` is THE square (its look,
   `armed`, `handleHitBox`, and `HANDLE_R` / `HANDLE_HIT`, which moved here); `paintEndpointHandles`
   is now a loop over it. The barline's join squares are `elements/barlineJoinSquares.ts` (⛔ not
   in `barlineJoinHandles`, which is pure geometry with no DOM), spec moved with it; the grouping
   sign's WHOLE highlight — recolour + resize squares — is `staffGroup.ts`'s own row, with a new
   `staffGroup.test.ts` (it had none). 🚨 Found on the way: nothing removed the `staff-group-handle`
   entries — `clearHighlights` listed every other highlight-owned type — so they piled up across
   skipped renders (harmless only because the press guards on the selection). It removes them now.
   Hub: kinds 256 → **239**, file → 1,855 lines. ✅ Passed (`b772418`).*

   *Third slice — the seven MARK recolours, as a second column: **`ink?: (ctx, id)`** on
   `ElementKindSpec`. The recolours were never `highlight`'s: they are a SET pass (a passage box
   selects marks too), which `RenderController` ran as seven per-kind calls. It is now one loop,
   `elements/selectedInk.paintSelectedMarkInk` — for each `MARK_KINDS` kind, each `selectedIdsOf`
   id goes to that kind's own `ink` row — and `highlight` stays what a single click ADDS. The
   pedal's dashed tether is part of the pedal's `ink` (it was a set pass for the same reason),
   pressable only for the single-click one. `elements/recolour.ts` holds the three shared writes
   (`paintFill` / `paintStroke` / `paintTextMark`). Off the controller: eight `apply…` passes,
   seven `recolor…`, `drawPedalTether`, its private `selectedIdsOf`. Spec moved:
   `HighlightController.markColor.test.ts` → `elements/selectedInk.test.ts` (+ a box-member case);
   `chain.test.ts` pins the `ink` rows to exactly `MARK_KINDS` (a lost row is a mark that never
   lights, silently). Hub: kinds 239 → **171**, file → 1,521 lines. ✅ Passed (`f1832e7`).*

   *Fourth slice — the slur's handles: `elements/slurHandles.ts` (`paintSlurHandles` — the round
   dots, the blue true-end squares, the orange open-join squares — and `paintArmedSlurAnchorNote`).
   Both squares are `paintHandleSquare` now; the square gained `tone: 'join'` for the orange. The
   context gained ONE door, `paintNote(noteId, fill, stroke)`: the anchor tint paints a whole note,
   and the note painter is still the controller's own pass — ⏳ it goes with the note-attached
   slice. The controller's `SLUR_HANDLE_*` / `SLUR_ANCHOR_*` statics are gone. Specs: the two slur
   chapters of `HighlightController.test.ts` → `elements/slurHandles.test.ts`;
   `.slurAnchor.test.ts` → `elements/slurHandles.anchorNote.test.ts`; the `clearHighlights`
   chapter stays with the controller. Hub: kinds 171 → **119**, file → 1,299 lines. ✅ Passed
   (`d3dcb7b`).*

   *Fifth slice — the anchor guide line: `elements/anchorGuideLine.paintAnchorGuideLine(ctx)`, moved
   whole (it was already kind-agnostic and touched no private but `addNode`); seven rows call it,
   spec moved → `elements/anchorGuideLine.test.ts`. Hub: file → 1,222 lines. ✅ Passed
   (`e2ff597`).*

   *Sixth slice — (a) below: the NOTE pass and the six note-attached kinds. Each `colorNote<Kind>`
   is now its kind's exported painter — `paintNoteArticulations` / `paintNoteDots` /
   `paintNoteTremolo` (+ the pair group) / `paintNoteTie` / `paintNoteAccidentals` — beside that
   kind's `paintSelected<Kind>`, which IS its `highlight` row (`highlight: paintSelectedDot`). The
   note pass is `elements/notePaint.ts` (`paintSelectedNotes` + `paintNote`), which imports those
   five: ONE owner per ink, called by the row and by the note. `ctx.paintNote` — the door the slur
   slice opened — is gone (the slur's anchor tint imports `paintNote`); the context gained
   `raiseToFront` instead, the toolkit's fifth write. The articulation SET pass is
   `articulation.paintSelectedArticulations`, run by `RenderController` beside the notes and the
   marks (it is keyed by `noteId`, not `id`, so it is not an `ink` row). Specs: the tie / tremolo /
   fanned-member chapters → `elements/notePaint.test.ts`; `clearHighlights` stays the
   controller's. Hub: kinds 118 → **55**, file → 718 lines. ✅ Passed (`aa7e5af`).*

   *Seventh slice — every remaining ROW, so `ctx.controller` is GONE: clef + meter
   (`paintSelectedClef` / `paintSelectedTimeSignature` over the shared CTM-aware scan,
   `elements/headerGlyphs.paintGlyphsInBBox`); barline + open repeat (`paintSelectedBarline` /
   `paintSelectedRepeatStart` over `elements/barlineInk` — `paintBarlineHalf`, the group finders,
   `HIGHLIGHT_WEIGHT_PX`); key signature, score text, tuplet, and the measure box
   (`measureRange.paintMeasureBox`), each in its own module as its `highlight` row. Spec:
   `HighlightController.barline.test.ts` → `elements/barlineInk.test.ts`. ⭐ **`HighlightController`
   is now only the LAYER** — the undo log and its five writes, `clearHighlights`, `context()`, and
   the entry keyboard cursor (not a kind's, so it stays): kinds 55 → **9**, 2,172 → **183** file
   lines, 117 code lines — and its code-line ceiling STARTS here. ⏸️ Awaiting his UI check;
   **3.3 DONE with it.** 3.4 (Properties panels: `rows` yes, `report` no) is next.*

   *⏭️ What is left on the controller, and its shape: (a) ✅ the note pass — above. (b)–(d) ✅ the seventh slice,
   below; the keyboard cursor stays the layer's own.*
4. **Properties panels**: `windows/properties/panels/<kind>.ts` exporting `report` and `rows`,
   keyed by kind. *(review)* **Recommended: `rows` yes, `report` no.** The `paint` ladder is
   where this window grows (977 code lines, 25 kind tests), its specs are *already* split by kind
   (`PropertiesWidget.hairpin.test.ts`, …) so each moves whole with its panel, and the recorded
   decision never covered it. The `report` half is the other switch `chain.ts` keeps on purpose
   (`selectionSnapshot.selectedElements`): 287 code lines, read-only, exhaustive at one site, and
   a reader of "what is selected" wants it in one place — it stays. The 37 casts do not need it
   moved: they come from `InspectedElement.data: unknown`. Make `InspectedElement` a
   discriminated union keyed by `kind`, and each panel receives its own typed `data`.

   *First half done — the `rows`. `windows/properties/panels/<kind>.ts`, one per kind that has
   controls (note · clef · dynamic · tempo · ottava · pedal · trill · slur · hairpin · keySignature
   · barline), each exporting a `PanelRows = (element) => HTMLElement[]`; `panels/index.ts` is the
   table (`rest` shares the note's panel, `repeatStart` the barline's — the same LINE from either
   side), and `PropertiesWidget.paint` is `for (row of PANELS[kind]?.(element) ?? [])`, knowing no
   kind by name. `windows/properties/rows.ts` holds what a row IS — `commitOnFirstStep`,
   `buildMarkOffsetRow`, `scalarOffsetRow`, `buildNumberRow`, `buildPointRow`, the three colours —
   with ⛔ no `bus`: a row is handed its `publish`. `panels/panel.ts` has the contract and `liveId`
   (the eleven copies of the `id && !missing` gate). The ten per-kind specs moved whole, unchanged
   but for their imports — they drive the mounted widget through `bus.inspection`, so they are the
   proof the move changed nothing: `PropertiesWidget.<topic>.test.ts` → `panels/<kind>.test.ts`.
   Two orphaned doc comments (the fan's, the stem-align's) went back onto their functions. Hub:
   kinds 187 → **0**, 1,579 → **120** file lines; both ceilings set (0 · 73). `report` stays, by
   the recommendation above. ✅ Passed (`4db182d`).*

   *Second half done — the typed report. `interactions/inspectedElement.ts` (types only):
   `InspectedElement` is a discriminated union keyed by `kind`, one `Report<K, data, derived>`
   per kind, + `InspectedOf<K>` and `MissingElement`. `data` is precise everywhere (the model's
   own `Dynamic` / `Ottava` / … or `MissingElement`; `Measure['clefs']`-style indexed types for the
   positional kinds); `derived` is precise ONLY where a panel reads it (slur `arc`, hairpin
   `mouth`, key `cautionaryGap`, the two LINE kinds' `sign` / `winged`) and an open record
   elsewhere — its one other reader is the JSON dump, and a hand copy of the engine's span types
   would be a field list that rots. `selectedElements` is now held to those shapes by the
   compiler. A panel is `PanelRows<K>` and reads `element.data` / `.derived` with no cast:
   `panel.live(data)` narrows off `MissingElement`, `panel.overrideOf<T>(element, kind)` types an
   override entry (⚠️ ONE cast, inside it: `EngravingOverride` is a base interface its kinds
   EXTEND, not a union). The window's casts: 37 → the one in `overrideOf`, the one in
   `panels/index.panelRowsFor` (a kind-keyed lookup TypeScript cannot correlate — the table's own
   type is what makes it sound), and four `select.value as <Enum>` (a DOM string).
   🚨 Two things worth keeping: the union FIRST went into `selectionSnapshot` and `lint:hubs`
   refused it (7 → 58 kind mentions) — right: a type table is a module too. And a table row for a
   panel serving TWO kinds is refused when the row type is the ALIAS (`PanelRows<K>` compares its
   argument by name; `in K` is rejected because `Extract` hides the variance) — spell the row as
   the function type. ⏸️ Awaiting his UI check; **3.4 DONE with it.** 3.5 (mark-family commands
   off the facade, family by family with Phase 4.1) is next.*
5. **Mark-family commands off the facade**: `engine/commands/<family>Commands.ts` built from a
   small context (`mutate`, `preview`, `commitPreviewed`, the guards); `MusicEngine` keeps
   `readonly ottava = …`. About 2,600 file lines leave, and the walks swap their `Pick` for the
   command type. Typed functions, never a table of method names. Fold the five direct
   `saveUndoState` callers into `mutate`.

   *(review, second reading)* **`commit` and `saveOnly`: the code differs, the effect does not —
   recommended: fold them, his call.** `commit` also calls `playbackEngine.setScore`, which
   rebuilds the tempo map, the repeat plan and the total duration. But `play()` rebuilds all three
   itself before it schedules anything, nothing reads them while stopped (`getPosition` reports 0,
   `seekToMeasure` reads none), and the score object is the same live one — the three places it
   is *replaced* (undo, redo, load) call `setScore` directly. So while stopped the two are
   indistinguishable, and "Add measure" on `saveOnly` is not a bug. The hand-kept split already
   shows it is not load-bearing: opening and ending a **repeat**, and inserting and removing
   measures, all change what plays and all sit on `saveOnly`, with no symptom.
   The one moment they differ is an edit **during playback**, and there `commit` is the worse
   one: the audio was scheduled up-front against the old map, and the rebuild moves the cursor's
   map and the auto-stop total under it. So `mutate` is one function with no resync; `setScore`
   stays at undo / redo / load. ⚠️ Check by ear before folding: play, edit a tempo mark
   mid-playback, and watch the cursor against the sound, before and after.

   *(review)* **Family by family, with Phase 4.1.** Where a family's commands hold score logic,
   that logic goes to its ops module first (Phase 4.1's slice for that family) and the command
   moves after — otherwise this step carries it into `engine/commands/` and Phase 4 moves it a
   second time.

   *First family done — the OTTAVA, with its Phase 4.1 slice first.*

   *4.1: `engine/models/spanFromNotes.ts` — "which notes did the user mean?", ONE answer where
   `MusicEngine` held five copies (`createSlur` / `createHairpin` / `createTrill` /
   `createOttava` / `createPedal`): resolve the ids, keep the first note's LANE, order as the
   music reads. `{ byVoice, sounding }` are the two ways the five differed (a staff-wide mark keeps
   both voices; only a slur may take a rest's slot). It takes a `SpanNoteSource` (`getNote` +
   `fanMemberIndexOf`, which `ScoreModel` answers) rather than a bare `Score`, because the flat
   `Note` projection is the model's. `compareForSpan` went with it. All five creates use it now.*

   *3.5: `engine/commands/commandContext.ts` is what a family is built from — `model()` /
   `registry()` (⚠️ FUNCTIONS: undo, redo and load replace the `ScoreModel`), the four undo seams
   (`commit` · `saveOnly` · `markDirty` · `commitPreviewed`), `staffIdForIndex`, and `limits`
   (`nudgeStaysOnPage` · `nudgeStaysInBand` · `spanEndStaysOnPage` — shared by every family, so
   they stay on the facade and are handed over). `engine/commands/ottavaCommands.ts` holds the
   family's 23 commands and its two private guards; `MusicEngine` keeps
   `readonly ottava = ottavaCommands(this.commandContext())` and its READS (`getOttavaById`,
   `getOttavas`, `getOttavaSpan`, the SVG group). ⭐ **Method names are UNCHANGED** —
   `engine.nudgeOttava(…)` is `engine.ottava.nudgeOttava(…)` — so the move is a grep and the
   shorter names are a later, separate taste call. The three `Pick<MusicEngine, …>` that named
   ottava commands (`ottavaWalk`, `elementClipboard`, `enclosedMarks`) became
   `Pick<MusicEngine, reads> & { ottava: Pick<OttavaCommands, …> }`. Spec moved:
   `MusicEngine.createOttava.test.ts` → `commands/ottavaCommands.createOttava.test.ts`; seven
   specs' mock engines nest their ottava members under `ottava:`. `commit` and `saveOnly` are
   BOTH still in the context, per command as before — ⏸️ folding them is his call (above).
   `MusicEngine`: 6,224 → 5,801 lines, kinds 1,130 → **1,051**. ✅ Passed (`e684125`).*

   *Second family — the PEDAL: `engine/commands/pedalCommands.ts`, `engine.pedal.<command>(…)` —
   26 commands and its three private guards (`endpointStepAllowed`, `staysInBand`,
   `liftInkWouldMove`). Same recipe, same names. `DrawnRegistry` gained `getStaffGeometry?` (the
   lift-ink guard reads a staff's spacing), which let both families drop their inline registry
   casts. `pedalWalk` / `elementClipboard` / `enclosedMarks` ask for
   `{ pedal: Pick<PedalCommands, …> }`. Specs moved: `MusicEngine.createPedal.test.ts` and
   `MusicEngine.pedalLiftInk.test.ts` → `commands/pedalCommands.{createPedal,liftInk}.test.ts`.
   ⭐ The recipe is two scratch scripts now (cut a family into a commands body; nest a spec's
   flat mock members under `<family>:`) + a receiver-anchored rename (`engine` / `eng` /
   `getEngine()` only) that prints every OTHER receiver it left, so `palette.createPedal` and
   `pedalOps.*` are seen rather than renamed. 🚨 The mock-nesting script still over-reached twice
   — an IMPORT LIST (`addPedal, removePedal,` lines in `pedalOps.test.ts`) and a PALETTE mock in
   `lineTools.test.ts`: it matches by member name, so ⇒ read its file list before trusting it.
   `MusicEngine`: 5,801 → 5,333 lines, kinds 1,051 → **947**. ✅ Passed (`44b99d2`).*

   *Third family — the TRILL: `engine/commands/trillCommands.ts`, `engine.trill.<command>(…)` —
   22 commands, no guard of its own (its vertical is `outward` from a NOTE, judged by the page
   limit alone). Two things the first two did not need: the context gained **`runBatch`**
   (`createTrillOverSpan` is one paste = one undo entry), and the commands object is a NAMED
   `const commands` so one command can call a sibling (`→ commands.createTrill`) without `this`,
   which a `Pick`ed or destructured command would lose. Reads stay on the facade
   (`getTrills`, `getTrillById`, `trillSpan`, `trillSpanBeats`, `trillAuxiliaryOf`). A third
   scratch script now rewrites the `Pick<MusicEngine, …>` types (`trillWalk`, `trillReanchor`,
   `elementClipboard`, `enclosedMarks`); ⚠️ it flattens a multi-line Pick onto one line — reformat
   by hand. ⚠️ No engine spec tests the trill's commands on their own, so `audit:tests` lists
   `trillCommands` as owed one (`MusicEngine.pageLimit.test.ts` covers four of them among the
   other families'). `MusicEngine`: 5,333 → 5,028 lines, kinds 947 → **866**. ✅ Passed
   (`7148a63`).*

   *Fourth family — the HAIRPIN: `engine/commands/hairpinCommands.ts`,
   `engine.hairpin.<command>(…)` — 26 commands and its three private guards (`endpointInk`,
   `endpointLane`, `endpointOffsetAllowed`: judged per END, because a `y` on one end TILTS the
   wedge). Reads stay (`getHairpins`, `getHairpinById`, the SVG group). With it the facade's last
   `slotLength` user left, so that import went too. The recipe is four scratch scripts now (cut ·
   repoint · fix Picks · nest mocks); what still needed a hand: `hairpinKeys.test.ts` reset its
   mocks with `Object.values(engine)` (→ `engine.hairpin`), the table-driven
   `MouseController.markEndDrag` row (`commands: 'hairpin'`), and the mock-nester's SKIP list
   (`hairpinOps*.test.ts` — import lists). `audit:tests` lists `hairpinCommands` as owed a spec,
   the trill's gap. `MusicEngine`: 5,028 → 4,646 lines, kinds 866 → **771**. ✅ Passed
   (`cf560a1`).*

   *Fifth family — the SLUR, with its Phase 4.1 slice first.*

   *4.1: `reanchorSlurs(score, oldId, newId)` is `engine/models/slurOps` now — what happens to the
   slurs hanging off a deleted or replaced head (re-point · drop · the collapsed span · which
   overrides each outcome clears); `MusicEngine`'s six callers and `RebarDeps` pass the score.
   `nextDistinctSlot(source, start)` — where a ONE-note slur ends: the next event in its own voice
   and staff, the next MEMBER inside a fan — went beside `spanFromNotes`, over a `SlotWalkSource`
   (`SpanNoteSource` + `getAllNotes` + `fanMembersOfSlot`). Both have specs now
   (`slurOps.reanchor.test.ts`, 5; `spanFromNotes.test.ts` +4); neither had one of its own.*

   *3.5: `engine/commands/slurCommands.ts`, `engine.slur.<command>(…)` — 21 commands and its four
   private guards (`endpointInk`, `endpointLane`, `endpointOffsetAllowed`, `offsetAllowed`).
   ⭐ Every one records with `saveOnly`: a slur is notational only. Reads stay (`getSlurs`,
   `getSlurById`, `slurSpanOf`, the SVG group). ⚠️ The context's `registry()` became
   `getElementRegistry?.() ?? {}` — `flipSlur` read it through `?.()` because several engine specs
   stub a renderer with NO registry, and a context that threw there would have broken them.
   Spec moved: the `createSlur` chapter of `MusicEngine.test.ts` (425 lines, incl. the
   shape auto-reset) → `commands/slurCommands.test.ts`. `MusicEngine`: 4,646 → 4,263 lines,
   kinds 771 → **668**. ✅ Passed (`29ffe10`).*

   *Sixth and seventh families — the DYNAMIC and the TEMPO MARK, together (the two POINT marks:
   no ends, no squares, no guard of their own — a slot, a side, one two-axis ink offset):
   `engine/commands/dynamicCommands.ts` (14) → `engine.dynamic.<command>(…)`,
   `engine/commands/tempoCommands.ts` (12) → `engine.tempo.<command>(…)`. Reads stay
   (`getDynamics`, `getDynamicById`, `getTempoMarks`, `getTempoMarkById`, `getEffectiveTempoAt`,
   the SVG groups, the two `setSuppressed…Id`). Specs moved: `MusicEngine.test.ts`'s two dynamics
   chapters and its tempo chapter → `commands/{dynamic,tempo}Commands.test.ts`.
   `enclosedMarks.MarkRemover` and `elementClipboard.ElementClipEngine` now ask NOTHING of the
   facade's mutators — every family is `{ <family>: Pick<…> }`.*

   *⚠️ **THE COUNTER CHANGED, and this is his to veto.** `engine.dynamic.addDynamic(…)` names
   its kind twice where `engine.addDynamic(…)` named it once, so nine existing call sites pushed
   `MouseController` (307 → 313) and `PaletteController` (494 → 497) over their ceilings with no
   new knowledge in them. The first five families hid this behind a renamed local each; nine
   sites cannot. `scripts/check-hubs.mjs` now drops the command-namespace ACCESSOR before
   counting (`withoutCommandNamespaces`: a `.family.` member access followed by another member,
   these seven families only) — the command's own name still counts. ⛔ Not a raised ceiling:
   every hub's number FELL or stood. The alternative was moving `MouseController`'s four
   `place…AtClick` text-entry slices out, which is real work for its own step (they lean on the
   text editor, the selection and the render), not a side effect of this one.*

   *🚨 The scripts' blind spots this time: engines NOT named `engine` (`existingEngine`, `fresh`,
   `empty` — the repoint prints them, `tsc` finds the typed ones); ONE-LINE inline mocks
   (`{ commitTempoDrag: commit } as unknown as MusicEngine` — the nester reads members one per
   line); and the nester's merge dropped its open block at a SIBLING's closing `},` (fixed:
   `<=`, not `<`).*

   *`MusicEngine`: 4,263 → **3,972** lines (6,224 at the start of 3.5), kinds 668 → **543** (of
   which the accessor rule is 40-odd). ⏸️ Awaiting his UI check; **3.5's seven mark families are
   DONE with it.** Open inside 3.5: his call on folding `commit` / `saveOnly`; the three commands
   modules `audit:tests` lists as owed a spec (trill, hairpin, pedal has two).*

   *🚨 Two slips worth keeping. (1) A receiver-anchored regex (`(?<![\w.])engine\.`) skipped
   `h.engine.addOttava(…)` in `e2e/` — untyped inside `page.evaluate`, so `tsc` was silent and only
   the browser suite said so (23 failures). ⇒ after a rename, grep `e2e/` for the OLD names.
   (2) The same regex renamed `palette.createOttava` — a `PaletteController` method with the
   engine's name. ⇒ audit the RECEIVERS of a scripted rename before trusting it.*

After each step, lower that hub's kind-mention ceiling, and start its code-line ceiling once the
hub's steps are done.

### Phase 4 — Score logic into the score layer (principle 5)

The only phase that fixes a broken principle rather than a shape.

1. *(review: the mark families' slices run with Phase 3.5, family by family.)* Off
   `MusicEngine`: `toggleTie` / `tieSelection` → tie ops (after Phase 1.1's fix and its spec);
   `deleteNote`'s repair;
   `reanchorSlurs` → `slurOps`; the five `create*` span methods → one
   `spanFromNotes(score, ids, { byVoice })`; `convertToRest`, `moveSelectionToVoice`.
   *Done so far (with 3.5's families): `spanFromNotes` + `nextDistinctSlot` (the five `create*`
   heads, `e684125` / `29ffe10`) · `reanchorSlurs` → `slurOps` (`29ffe10`).*

   *TIES done — `engine/models/tieOps.ts`. `tieTargetOf(sorted, source)` is the ONE target rule
   (next slot strictly after, in the source's own staff AND voice; same pitch preferred; else
   whatever is there, a rest included) where `toggleTie` and `tieSelection` each spelled it.
   `toggleTie(model, id)` writes and answers added / removed / null; the selection is
   `planTieSelection` + `applyTiePairs` — ⭐ split in two because the facade NAMES its undo entry
   after the answer ("Add ties" / "Remove ties"), and the history's labels are observable
   (`getUndoDescription`). They take a `TieModel` (five methods `ScoreModel` answers), since the
   flat `Note` projection is the model's. The fan-member refusal and the `[Tie]` logs went with
   the rule. `MusicEngine.toggleTie` / `.tieSelection` are the undo entry and nothing else — the
   Phase 1.1 ask-inside-the-batch is kept, with its reason. Spec: `tieOps.test.ts` (11); the
   engine spec's staff-scoping chapter became a pure `tieTargetOf` case. ⏸️ Awaiting his UI
   check. Left in 4.1: `deleteNote`'s repair, `convertToRest`, `moveSelectionToVoice`.*

   *✅ Both done, 2026-09-20 (below). His two answers: **fold `commit` / `saveOnly`** as the plan recommends (3.5's
   review note), and **yes to the missing command specs** — agreed order: the specs FIRST (a fake
   `CommandContext` pins what a commands module adds over its ops: the limit's refusal and the
   undo classification — one entry per edit, none per preview frame, one per drop), THEN the fold,
   which changes exactly that classification. ⭐ The plan's by-ear check turned out MOOT — his
   word: *"i can not change tempo or anything while playing… the playback module in this editor
   is still in early demo mode."* An edit during playback was the ONE moment `commit` and
   `saveOnly` could differ, and the editor does not allow one.*

   *THE SPECS: `engine/commands/fakeCommandContext.ts` (spec support, exempt in `audit:tests`) — a
   REAL `ScoreModel`, seams that RECORD (`log`, `undoEntries()`), limits that can refuse and that
   remember what they were ASKED. On it: `trillCommands.test.ts` (11) and
   `hairpinCommands.test.ts` (8) — one entry per edit · none per preview frame · one per drop ·
   a refusal writes and records nothing · a re-base is never judged · `outward` reaches the page
   limit as a SCREEN delta that flips with the side · an END is judged on two axes, and by the
   BAND once it is drawn. ⭐ Break-tested: a preview frame made to record an entry fails the spec.*

   *THE FOLD: `MusicEngine.mutate(description)` — ONE undo entry for one edit — replaces `commit`
   and `saveOnly` (70-odd call sites) and the six direct `saveUndoState` callers; `CommandContext`
   has `mutate` where it had the pair. ⭐ Verified before folding, not taken from the plan:
   `PlaybackEngine.play()` calls `calculateTotalDuration()` itself, so the `setScore` inside
   `commit` bought nothing while stopped. `setScore` stays where the score OBJECT is replaced —
   the constructor, undo, redo, load — and `deleteNote`'s two hand-made copies of `commit` went.
   ⚠️ The KNOWLEDGE the split carried is kept: ~35 comments said "`commit`, not `saveOnly`"; they
   now say AUDIBLE / ink only, which is true of the music whatever function records it. Two of
   them gave the wrong reason once the names went (`commitStaffGroupSpan`, `commitBarlineJoin`:
   "no playback to resync") and now give the real one — `commitPreviewed` does not flag the model
   dirty, so the drop does not re-engrave a picture already on screen.*

   *🚨 Found on the way: NINE tie cases (`toggleTie`, `tieSelection`, `flipTie`, the undo
   invariant) had been filed under `MusicEngine.test.ts`'s `createSlur` chapter since they were
   written, and rode it into `commands/slurCommands.test.ts` last step. They are
   `MusicEngine.ties.test.ts` now.*

   *`deleteNote`'s REPAIR done, 2026-09-20 — `engine/models/deleteNoteOps.ts`.
   `deleteNoteWithRepair(model, id)` holds what a delete IS for each thing an id can name (a fanned
   member · a chord head · a single note → a rest of its own length in its own voice AND staff,
   with every incoming tie and slur re-pointed · a rest → the gap or the tuplet's remainder
   refilled) and the voice collapse; it takes a `DeleteNoteModel` (what `ScoreModel` answers).
   `chordNotesAt` went with it (the facade's private `getChordNotesAt` is gone; `slotPitchIdsFor`
   asks the module until `convertToRest` follows). ⭐ The UNDO LABEL stays on the facade — his
   question, answered: "Delete C4" is the history's wording, read BEFORE the note is gone, so the
   ops function answers a boolean and `MusicEngine.deleteNote` is label + ops call + one `mutate`.
   Spec: `deleteNoteOps.test.ts` (13) — the staff-scoping, slur-cleanup and voice-collapse chapters
   of `MusicEngine.test.ts` and the two-ties case of `MusicEngine.ties.test.ts` MOVED, plus new
   cases for the rest branch, the fan member and `chordNotesAt`. Break-tested: dropping the staff,
   the tie re-point, the collapse, or the member branch each fails it. The fan-member chapter of
   `MusicEngine.fanMemberCommands.test.ts` stays — it is that feature's command-layer story (undo
   included). ⏭️ Not done here: `clearOps`'s `deleteOne` still goes through the facade; pointing it
   at the ops function is 4.3's (`ClearRangeDeps` goes). `MusicEngine` kinds 536 → 513. ✅ `ab182f4`.*

   *`convertToRest` done, 2026-09-20 — `engine/models/convertToRestOps.ts`.
   `convertSlotToRest(model, id)` is the fan-member refusal, `slotPitchIds` (every head of the
   slot, staff-scoped via `deleteNoteOps.chordNotesAt`), the model's swap, the slurs of ANY head
   following onto the rest, and the voice collapse. ⭐ It answers the rest's ID, not the rest:
   silencing the last note of a secondary voice collapses the lane and the rest goes with it, yet
   the score changed and the facade owes its entry — "did it happen?" and "is the rest still
   there?" are two questions. (Behaviour unchanged: the facade already filed the entry and handed
   back null there; it is now pinned.) `MusicEngine.convertToRest` = label + ops call + one
   `mutate`. Spec: `convertToRestOps.test.ts` (9) — the whole `MusicEngine.convertToRest` chapter
   MOVED, plus the any-head slur, the collapse and the member refusal; the engine spec keeps two
   cases on the undo entry. Break-tested: the any-head re-anchor and the collapse bite; ⚠️ the
   member refusal does NOT — the model cannot find a member either, so the check is the logged
   decision, not the safety (written on the case). ⏭️ `ScoreModel.convertToRest` itself (the swap +
   the ties) is 4.3's and joins this module then. `MusicEngine` kinds 513 → 511. ✅ `e20ca48`.*

   *`moveSelectionToVoice` done, 2026-09-20 — it is `voiceOps.moveSelectionToVoice(model, ids,
   voice)`, beside the per-note move it loops over: the stable order, the `movingIds` set (a tie or
   pair whose BOTH ends move survives), the beamed-over rests re-flagged in the target voice, and
   the tremolo prune AFTER the loop. It takes a `VoiceMoveModel` (four methods `ScoreModel`
   answers) and answers `{ found, moved }` — `found` because the undo label counts the ids that
   named something ("Move 3 note(s) to voice 2", observable), `moved` because the entry is filed
   only when something changed lane. `MusicEngine.moveSelectionToVoice` = ops call + one `mutate`
   (it was a `runBatch` around N facade `moveNoteToVoice` calls; same one entry, same label).
   Spec: the chapter MOVED into `voiceOps.test.ts` (6, on a `ScoreModel`); the engine spec keeps
   the one-undo-step and no-op cases, now pinning the label; `markOps.tremoloPair.test.ts`'s
   "both notes go" case calls the real gesture where it hand-replayed the facade's loop, plus a
   new one-of-two case. Break-tested: `movingIds`, the beam-over carry and the after-loop prune
   each bite. ⚠️ KEPT AS IT WAS, and his to call: when NOTHING moves (a selection of rests only)
   the beam-over re-flag and the prune still run, and no undo entry is filed — a write outside
   the history if the target voice has a rest at that beat. Not changed in a move. `MusicEngine`
   kinds 511 → 510. ✅ `5f6fa03`. **4.1 is DONE.***

2. `NoteEntryCoordinator`'s model-only half — overflow, erosion, tie-split, overwrite, the
   tuplet builders — into `engine/models/noteEntryOps`. The coordinator keeps pixel resolution,
   collision and commit.
   *SPLIT into four, 2026-09-20, after reading the coordinator (1,602 lines) — and ⚠️ NOT one
   `noteEntryOps`: its model-only half is four subjects that share nothing but the model, so one
   file would be a ~900-line hub born whole. One module per subject, the rule's own shape:*
   - ***a. the SPANNING note*** *— `placeSpanningNote`, its two callers, `ensureMeasureExists`,
     the erosion → `models/spanningNoteOps`.* ***Done (below).***
   - ***b. what an entered note OVERWRITES*** *— `findNotesToOverwrite`, `applyEntryOverwrites`,
     `addNoteAtBeat`'s own overlap sweep and tuplet clamp → `models/entryOverwriteOps`.
     ⚠️ There are TWO overlap rules today (the keyboard path's exact half-open intervals, the mouse
     path's "starts inside my range") — moved side by side first, ⛔ not merged in the move.*
   - ***c. a DURATION CHANGE*** *— `updateNote`'s three bodies (overflow, tuplet, plain) and
     `findLargestFittingDuration` → `models/durationChangeOps`; the coordinator keeps the fan
     member's straight-through write and the commit. ⚠️ Still float + epsilon where (b)'s keyboard
     path is exact — noted, not changed in the move.*
   - ***d. the TUPLET builders*** *— `buildTupletWithFirstNote`, `applyTupletToNote`,
     `tupletFitsBar` → `tupletOps` (it exists) or a sibling, decided when read.*
   *The coordinator is left with what the plan said: pixel resolution (`resolveClickToBeat`, the
   rest finders, `isValidEntryClick`), collision, and the commit. Its own copy of `getChordNotesAt`
   goes in (c), to `deleteNoteOps.chordNotesAt`.*

   *4.2a done, 2026-09-20 — `engine/models/spanningNoteOps.ts`: `placeSpanningNote(model, p)` +
   `splitExistingNoteWithTie` (a reused head) + `addSplitNoteWithTie` (a fresh one) +
   `erodeOverflowZone`, over a `SpanningNoteModel`. Moved by script, bodies verbatim (the
   `console.warn`s and the float epsilon included). `NoteEntryCoordinator` 1,602 → 1,352 lines;
   its public `splitExistingNoteWithTie` had no caller but the spec and is gone. Spec:
   `spanningNoteOps.test.ts` (12) — the split and erosion chapters MOVED; the one case that drives
   `addNoteAtBeat` stays with the coordinator (it pins that ENTRY reaches the chain) and has an ops
   twin; NEW: erosion is scoped to the overflowing note's voice AND staff, which nothing pinned
   (break-tested: dropping either scope now fails). ⚠️ Learned writing it: the head
   `placeSpanningNote` answers is a flat SNAPSHOT taken before its tie is attached — `tiedTo` reads
   undefined on it; ask the model. Kept as it was. ✅ `551b39a`.*

   *4.2b done, 2026-09-20 — `engine/models/entryOverwriteOps.ts`: `overwriteOverlappedNotes`
   (the KEYBOARD path's sweep, lifted out of `addNoteAtBeat`'s body) + `findNotesToOverwrite` /
   `applyEntryOverwrites` (the MOUSE path), over an `EntryOverwriteModel` (two methods). Bodies
   verbatim; coordinator 1,352 → 1,230 lines. ⚠️ **The two rules were NOT merged, and the module's
   header says why they differ**: the keyboard asks whether the sounding INTERVALS overlap (exact,
   a tuplet member by its scaled length, an earlier note ringing in goes too, and so does a
   different pitch on the same beat); the mouse asks whether a note STARTS inside the new one
   (same beat + different pitch = a chord, kept; an earlier note ringing in is left; the new note
   measured undotted). ⏭️ HIS decision whether they become one — e.g. a mouse-entered quarter on
   beat 2 under a half note from beat 1 leaves the half standing, overlapped. Spec:
   `entryOverwriteOps.test.ts` (11) — all NEW (nothing pinned either rule), incl. a chapter that
   pins where they part company, "pinned, not endorsed". Break-tested ×4. ⏭️ Left for (d): entry
   INTO a tuplet — the keyboard's clamp and the mouse's fill pointer — is model-only too and goes
   with the tuplet builders. ✅ `ad381dd`.*

   *4.2c done, 2026-09-20 — `engine/models/durationChangeOps.ts`: `changeNote(model, id, updates)`
   is `updateNote`'s three bodies (the overflow split, the tuplet clamp + refill, the plain
   lengthen / shorten with its rest fill and tie release) + `findLargestFittingDuration`, over a
   `DurationChangeModel` (extends `SpanningNoteModel`). Bodies verbatim. ⭐ It answers
   `{ note, commit }` — the LABEL to commit under ("Update note" / "Update note duration" /
   "Update tuplet note"), or null on the one path that writes nothing (a tuplet member nothing
   fits); `NoteEntryCoordinator.updateNote` = the fan member's straight-through write + the ops
   call + the commit. The coordinator's own copy of `getChordNotesAt` is gone
   (`deleteNoteOps.chordNotesAt`); coordinator 1,230 → 949 lines. ⚠️ Float + epsilon kept as it
   was (the header says so). Spec: `durationChangeOps.test.ts` (15) — the overflow chapter of
   `MusicEngine.test.ts` and the voice-isolation chapter of `NoteEntryCoordinator.test.ts` MOVED;
   NEW: the labels, shorten → rests, the tie release, the clipped rest, the chord in step, both
   tuplet cases. Break-tested: voice scope, tie release and tuplet clamp bite; ⚠️ the chord-sync
   loop does NOT — the model already writes a chord's length on the slot, so the loop is
   redundant today.*

   *🚨 **A BUG FOUND WRITING THE SPEC, NOT FIXED — his call.** Lengthening a CHORD across the
   barline loses every head but the last one split: the heads are split one at a time, each split
   ERODES bar 2's overflow zone first, and so the next head's erosion deletes the continuation the
   previous head just placed. `[C E] q` at beat 3 → whole = `C h` tied across, `E h` bare, nothing
   of E in bar 2. ⭐ MEASURED to predate this phase (same result in a worktree at `5876ef6`), and
   ⚠️ it makes 4.2a's UI check item 4 ("every head splits and ties") a wrong promise. The same
   shape is in the MOUSE path (`placeSplitNote`: chord heads, then the new note). Pinned as
   `it.fails` with what SHOULD hold. ✅ `cf41ba4`.*

   *THE FIX — written 2026-09-20 at his word ("fix the chord bug first"), ✅ its OWN commit
   `6b97a8f` (he handed me the keep-or-remove call: kept, separate, one `git revert` away). He then said what this branch is: **"this project is not for
   changing rules, is for optimize the code shape."** ⭐ NO RULE CHANGES: a note standing in the
   next bar's overflow zone is still deleted when covered and trimmed when it straddles — every
   erosion case that moved with the module passes untouched. What stops is an ACCIDENT of order:
   the heads of one chord cross one at a time, and each head's erosion mistook the previous
   head's freshly placed continuation for a foreign note. `placeSpanningNote` now hands
   `erodeOverflowZone` a `spare` test — a piece whose tie chain leads back to a head on the
   chain's own starting beat, voice and staff is the slot's own and is left alone; ⚠️ except the
   head being RE-SPLIT, whose old continuation is what the new chain replaces. (⛔ NOT the "erode
   once" first proposed: a chord built ONE CLICK AT A TIME skips the head that already crossed, so
   only the erosion's own test protects its piece — probed, and it was broken the same way.)
   `splitChordWithTie` is the loop both callers use. Spec: the `it.fails` is a plain `it`; four new
   cases in `spanningNoteOps.test.ts` (three heads, foreign notes still eroded, click-by-click, the
   re-split); break-tested ×2. It is a BEHAVIOUR change all the same — hence its own commit. ⚠️ SEEN, NOT TOUCHED: re-splitting
   a head already tied across to a SHORTER overflow (`h|h` → dotted half) trims its old
   continuation like any straddler and leaves it standing beside the new piece.*

   *4.2d done, 2026-09-20 — `engine/models/tupletEntryOps.ts`: `buildTupletWithFirstNote` +
   `applyTupletToNote` + the guard they share, `tupletFitsBar`; and entering INTO a tuplet, which
   was model-only too — the KEYBOARD's `clampToTupletRemainder(params, tuplet)` (lifted out of
   `addNoteAtBeat`) and the MOUSE's `landInTuplet(model, …)` (the fill pointer, lifted out of
   `addNoteAtPosition`; it answers `{ beat, tupletId?, reason }` or null). ⚠️ Two behaviours again
   (clamp vs fill pointer), moved as they were, ⛔ not merged. Each answers null when nothing was
   written and the coordinator commits otherwise — same labels. ⛔ Not into `tupletOps`: that is
   what a tuplet IS; this is the entry standing on it. Spec: `tupletEntryOps.test.ts` (16) — the
   "must fit the bar" chapter MOVED; NEW: the build (first note, chord with a standing note,
   refusals write nothing, another voice), the apply (note / rest / refusals), the clamp, the fill
   pointer, no-room, and the too-large note that deletes the group. Break-tested ×4. ⚠️ The
   coordinator spec's other tuplet chapters STAY: they drive its own public entry
   (`createTupletAtBeat` + `addNoteAtBeat` together). ✅ `6116fb8`.*

   ***4.2 is DONE with it.** `NoteEntryCoordinator` 1,602 → 734 lines, and what is left is what the
   plan said stays: click → beat (`resolveClickToBeat`, the rest finders, `isValidEntryClick`),
   collision, the two entry methods' ORDER of calls, and the commit.*

3. `ScoreModel`'s remaining logic (`fillGapsWithRests`, `pushRestSlot`, `insertPitch`,
   `convertToRest`, the three `repairDangling*`) into ops modules; then `rebarOps` imports ops
   directly and `RebarDeps`, `VoiceDeps`, `ClearRangeDeps` disappear.
   *SPLIT into five, 2026-09-20, after measuring what each `*Deps` callback really is. Of
   `RebarDeps`' 14, EIGHT are already one-line forwarders to an ops module (`collapseEmptyVoices`,
   `staffIdForParams`, `addSlur`, `addTrill`, `findSlot`, the two override writes, `addMeasure`),
   so `rebarOps` can import those today; the bodies are what is left:*
   - ***a.** the three `repairDangling*` (62 lines) → the ops module each belongs to.* ***Done (below).***
   - ***b.** the REST FILL — `fillGapsWithRests` (101) + `pushRestSlot` (17) + `fillGapWithRests` →
     `models/restFillOps`. The one every `*Deps` bundle asks for.*
   - ***c.** `insertPitch` (89) → beside the entry ops; `VoiceDeps` then has nothing left but
     `refillTupletRemainder`, whose own callback is `addNote`.*
   - ***d.** `ScoreModel.convertToRest` (the swap + the ties) → `convertToRestOps`, as 4.1 promised.*
   - ***e.** `insertMeasureAfter` (31), then the bundles go: `rebarOps` imports ops directly,
     `RebarDeps` / `VoiceDeps` / `ClearRangeDeps` disappear, and `clearOps`' `deleteOne` points at
     `deleteNoteWithRepair`. ⚠️ `addNote` is the hard one — the callback under `refillTupletRemainder`
     and the repair's rest mint — and may have to stay a callback; decided when (b)–(d) are in.*

   *4.3a done, 2026-09-20 — `tieOps.repairDanglingTies(score)`, `slurOps.repairDanglingSlurs(score)`,
   `trillOps.repairDanglingTrills(score)`: bodies verbatim, comments with them. They were PRIVATE
   on `ScoreModel` and reached `rebarOps` only as three callbacks; `rebarOps` imports them now
   (`RebarDeps` 14 → 11) and `ScoreModel.removeMeasure` calls them like anyone else. ⛔ Not one
   `danglingRefs` module: each sweep knows its own family's rule (a slur counts fanned MEMBERS as
   anchors, a trill refuses them and DEGRADES on a lost end, a tie is severed per end) — that is
   why they differ, and why each sits with its family. Spec: the trill's already had one
   (`trillOps.test.ts`, through `removeMeasure`); NEW direct cases for ties (2) and slurs (2, incl.
   the member anchor and the override dropped with the slur) — pure functions of a `Score` now,
   which is what made them askable. Break-tested ×4. `ScoreModel` kinds 1105 → 1079. No UI surface
   of its own: it runs inside a meter change, a paste and a measure delete. ✅ `1eed47b`.*

   *4.3b done, 2026-09-20 — `engine/models/restFillOps.ts`: `fillGapsWithRests(score, measure)` +
   `pushRestSlot(measure, rest, voice, staffId?)`, bodies verbatim. It was the callback EVERY
   bundle asked for, and all of them import it now: `RebarDeps` 11 → 9, `VoiceDeps` 3 → 2, and
   `tupletOps.deleteTuplet` lost its injected `fillGapsWithRests` parameter altogether (its header
   said "it stays on ScoreModel" — no longer). `ScoreModel` calls the functions where it called
   its private methods; `fillMeasureGaps` / `repairMeasureGaps` stay as its public face.
   ⛔ `fillGapWithRests` (SINGULAR — the legacy float splitter) did NOT move: it goes through
   `addRest`, i.e. note entry, and waits for (e). Spec: `ScoreModel.restFill.test.ts` →
   `restFillOps.test.ts` (renamed after its subject; the four baseline cases unchanged) + NEW
   direct cases — the empty bar's measure rest, idempotence, a voice as its own stream, a staff as
   its own lane (first staff's rests carry NO staffId), the tuplet skip + trim, and what
   `pushRestSlot` writes and deliberately leaves absent. Break-tested ×4. `ScoreModel` kinds
   1079 → 1050. No UI surface of its own — it runs after nearly every edit, so ANY entry / delete
   / voice move / meter change exercising a full bar is its check. ✅ `243d35c`.*

   *4.3c done, 2026-09-20 — and BIGGER than planned, because `insertPitch` does not stand alone: it
   ends in `replaceRestsWithChord`, which is the private machinery under `addNote` too. So the
   CLUSTER moved first, as `engine/models/slotPlacementOps.ts` — `evictRestsOverlapping` (+ its
   scan, the tie migration, `dropRestHiddenOf`), `replaceRestsWithChord`,
   `evictRestsOverlappingChord`, `computeActualDurationForSlot`, the `fmtSlot` log helper — and
   `insertPitch(score, measure, payload)` with it. Bodies verbatim, the long "FILLING IS THE
   CALLER'S" comment included. `ScoreModel.addNote` / its duration change / `fromJSON` call the
   functions where they called `this.…`; `voiceOps` imports `insertPitch`, so `VoiceDeps` is down
   to ONE callback (`refillTupletRemainder`, whose own callback is `addNote`). `ScoreModel`
   3,511 → 3,189 lines, kinds 1050 → 972. Spec: `slotPlacementOps.test.ts` (11, all NEW and
   direct — the rules were only ever asked through `addNote`): the measure rest's and the tuplet
   member's sounding length · evict-but-don't-fill · other voices/staves untouched · the tie that
   pointed at an evicted rest · the inherited `tupletId` · ⭐ a NOTE takes the rest's hidden flag, a
   rest replacing a rest does not · place + refill + beat order · the chord that grew in place ·
   `insertPitch` keeps the supplied id, and on a merge the SHORTER duration wins. Break-tested ×5
   (one was a no-op mutation of mine the first time — the loop now reports a no-op). No UI surface
   of its own: every note entry, duration change and voice move runs through it. ✅ `4323899`.*

   *4.3d done, 2026-09-20 — `convertToRestOps.swapSlotForRest(score, noteId)`: the model's half of
   silencing a slot (the in-place swap + the ties, arcs LEAVING die / arcs ARRIVING re-point) now
   sits beside the half 4.1 moved, body and its long doc verbatim. `convertSlotToRest` calls it on
   `model.getScore()` — `ConvertToRestModel` lost its `convertToRest` member — and
   `ScoreModel.convertToRest` is the one-line forwarder the specs of `clearOps` / `markOps` still
   use (existing forwarders stay, Phase 4.4). Spec: 2 NEW direct cases in
   `convertToRestOps.test.ts` — the rest takes the chord's SEAT (same index) and keeps voice /
   staff / tupletId / the tuplet's `actualDuration`; null for a rest, a gone id and a fanned
   member. Break-tested ×3. `ScoreModel` kinds 972 → 961. ✅ `5da6ce1`.*

   *4.3e, FIRST HALF done, 2026-09-20 — ⭐ `addNote` did NOT have to stay a callback, which the
   split above feared. Read before deciding: `tupletOps.refillTupletRemainder` only ever adds
   RESTS, so what it needed of `addNote` was its REST BRANCH — and that branch is mint +
   `evictRestsOverlapping`, both already ops since (c). It is `slotPlacementOps.addRestSlot(score,
   measure, params)` now, body verbatim; `ScoreModel.addNote`'s rest branch is one line
   (`restToFlatNote(addRestSlot(…))`), `refillTupletRemainder` lost its injected `addNote`, and
   with nothing left to carry ⭐ **`VoiceDeps` is GONE** — `voiceOps.moveNoteToVoice(score, id, …)`.
   `tupletOps`' header ("two operations reach back into ScoreModel…") now says nothing is injected.
   ⚠️ Kept: a missing measure still THROWS "Measure N does not exist", as `addNote` did. Spec: 2 new
   `addRestSlot` cases in `slotPlacementOps.test.ts` (its lane + no refill; a quarter rest landing
   on a half rest replaces it). Break-tested ×2. ⛔ Still on `ScoreModel`: `fillGapWithRests`
   (singular) — moving it into `restFillOps` would make `restFillOps ⇄ slotPlacementOps` a cycle; it
   wants its own home or to be retired with the float paths. `ScoreModel` kinds 961 → 957.
   ✅ `4e0e6b0`. LEFT for e2: `insertMeasureAfter` / `addMeasure` → a measure ops module,
   then `RebarDeps` (9, all forwarders by then) and `ClearRangeDeps` go.*

   *4.3e, SECOND HALF done, 2026-09-20 — `engine/models/measureOps.ts`: `insertMeasureAfter(score,
   …)` + `addMeasure(score, …)` + `fillMeasureWithRests` + `copyTimeSignature`, bodies verbatim;
   `staffIdForParams(score, staff)` joined `staffContent`. With those two bodies out, every one of
   `RebarDeps`' nine was a function `rebarOps` could import — ⭐ **`RebarDeps` is GONE**: the
   interface, the `deps` parameter threaded through ~25 internal functions, and
   `ScoreModel.rebarDeps`. `rebarOps.rebarRegion(score, from, ts)` / `pasteEvents(score, clip,
   target)`. (⚠️ Scripted; two helpers took `deps` and NO score — `stampOverrides`, `linkTieById`,
   `materializeVoiceBar` — and gained `score`; `tsc` named each.)*

   *`ClearRangeDeps` 5 → 2, ⛔ not zero, and the reason is real: `removeSlot` (`ScoreModel.deleteNote`)
   and `deleteOne` (`deleteNoteWithRepair`) go through note entry — `addNote`, the flat `Note`
   projection — which IS the model; a `(score)` function cannot do them. The other three (rest
   fill, voice collapse, slur re-anchor) are imported. ⭐ `deleteOne` now points at
   `deleteNoteWithRepair` directly, as 4.1 promised — the facade's per-note `mutate` inside the
   batch went, and `deleteNotes`' one `mutate` is what tells the batch something changed (same one
   undo entry). `clearOps.test.ts`'s re-anchor case asks REAL slurs now instead of spying a
   callback — a stronger case for free.*

   *Spec: `measureOps.test.ts` (6, new): append in the meter in force · splice + RENUMBER bars AND
   their slots · a front insert states its meter · the meter is COPIED (grouping too) ·
   `copyTimeSignature` keeps `symbol` · an empty bar gets one measure rest in every meter.
   Break-tested ×3. `ScoreModel` 3,189 → 3,010 lines, kinds 957 → 940; `MusicEngine` kinds
   510 → 506. ⏸️ Awaiting his check (a meter change, a paste that grows the score, Add/Insert
   measure, Delete on a selection).*

   ***4.3 is DONE with it.** What it leaves on `ScoreModel` on purpose: `addNote`'s CHORD branch and
   `deleteNote` (the flat-`Note` projection lives with them), `updateNote`, `fillGapWithRests`
   singular (a cycle if moved into `restFillOps`), `removeMeasure`, and the forwarders (4.4: they
   stay). `ScoreModel` 3,745 → 3,010 over the phase; no `*Deps` bundle is left but
   `ClearRangeDeps`' two.*

4. New features call `xOps.fn(model.getScore(), …)` rather than adding a forwarder, so the
   forwarder count stops growing. Existing forwarders stay.
5. Move `GhostNote` and `PixelCoordinates` out of `types/music.ts` to the editor side; split the
   file by domain behind a re-export barrel.

   *4.5 split a–b. **a** DONE (awaiting his word to commit): the two left the score's types — but
   ⚠️ not "to the editor side": all eight files that name them are under `engine/`, which may not
   import `interactions/`, so they went to the ENGINE's own vocabulary files. `GhostNote` →
   `engine/rendering/ghosts/ghostTypes.ts` (beside `ToolGhost`, still NOT a member of that union);
   `PixelCoordinates` → `engine/rendering/renderTypes.ts` (beside `MeasureBounds`, which
   `CoordinateMapper` already read). No re-export left behind in `types/music.ts` (2,617 → 2,571
   lines). Type-only: tsc · eslint · 7,019 specs · `build:check` green, nothing for a UI check.
   **b** DONE (awaiting his word to commit): eight chapters beside the barrel, a clean DAG —
   `duration` (12 lines; `NoteDuration` + the `Fraction` re-export) · `pitch` (39) · `tuplet` (178) ·
   `notes` (680; `FanMark` ↔ `FanMemberChord` ↔ `NotePitch` ↔ `Chord` refer to each other, so the
   fan stays with the notes) · `signs` (261; clef, key, meter, barline, repeats) · `marks` (386) ·
   `engravingOverrides` (699) · `score` (370; `Measure`, staves, `Score`, playback). `music.ts` is
   15 lines of `export type * from`; no importer changed. Source order kept inside each chapter;
   a sorted-line diff against the old file shows only headers, imports and two `export`s —
   `EngravingOverrides` and `ScorePlayback` were module-private and `score.ts` now reads them
   across files, so the barrel exposes two names it did not. `audit:tests` exempts `src/types/`
   (types only, no runtime to spec). tsc · eslint · 7,019 specs · `build:check` green.
   **4.4's rule is now written where agents and developers read it**: CLAUDE.md's module rule +
   ARCHITECTURE.md §"A new feature adds a MODULE" (⛔ no new forwarder on `ScoreModel`). **Phase 4 DONE with it.***

### Phase 5 — Collapse the copies that have bodies

Each passes ARCHITECTURE's "a name is not a body" test — measured on bodies, not names.

| what | saves (code lines) |
|---|---|
| `spanLane` (`staffOnsets`, `measureStarts`, `locate`) + one `writeSpanOffset` for the span ops | ~200 — ✅ done: ottava 841 → 761, pedal 830 → 758, trill 695 → 680 |
| ottava + pedal walk and lane → one bracket-span pair | ~380 — ⚠️ MEASURED 2026-09-20: not a pair of copies, see below; ⏸️ his call |
| `cutIntoPieces`, `fragmentClaim`, `baselineFor` shared by the span renderers (⚠ pedal uses `<`, ottava `<=`); move `planSlurSegments` out of `SlurRenderer` | ~120 — ✅ done |
| `pressSpanTool(row)` for the palette's five `create*` | ~70 — ✅ done: PaletteController −98 lines, kinds 489 → 455 |
| `RequestChannel<T>` for the 19 identical bus emitters | ~230 — ✅ done, measured −250 in the 19 files, +53 for the channel |
| `rebarOps` capture/restore twins (specs first) | ~100 — ✅ done, measured: three identical bodies, rebarOps 1,807 → 1,770 with their docs |
| `mapElementCoordinates` walker in `ElementRegistry` — a new coordinate field is taught once | ~50 — ✅ done: ElementRegistry 1,996 → 1,947 |
| `src/testing/` builders for the 307 copied spec helpers (`fakeRegistry` ×26, `note` ×16, `makeEngine` ×13) | ✅ done for the copies that were BODIES: 59 specs, −590 lines |
| `trillWalk`'s ~110 lines of tracing → `trillTrace.ts` | ✅ done: trillWalk 1,448 → 1,299 |

*`RequestChannel<T>` DONE (awaiting his word to commit) — `bus/requestChannel.ts`: `RequestChannel<T>`
(`set` / `onSet`) for the 17 command-only seams and `PressChannel<T>` (`press` / `onPress`) for the two
palette-worded ones (`timeSignature`, `tuplet`), both over one private `Listeners<T>`. Each seam's module
keeps its request type and its reason and ends `create… = () => new RequestChannel<XRequest>()`, so
`bus/index.ts` did not change. ⚠️ Six seams took POSITIONAL arguments (`set(noteId, x)`) and now take the
request object every other seam already took — 7 call sites in `windows/properties/panels/` and three
controller specs rewritten; what the handler receives is identical. The "ALWAYS fires" rule, spelled 17
times, is the channel's one header. ⛔ Left alone: the stores with a MIRROR channel (`paletteSelection`,
`paletteToggleSet`, `clefSelection`, `keySignatureSelection`, `fanStampSelection`, `selectionInspection`)
— their short-circuit is the point, and each differs. Spec: `requestChannel.test.ts` (4).*

*`spanLane` + `writeSpanOffset` DONE (awaiting his word to commit) — `models/spanLane.ts`: `staffOnsets`
(ottava's and pedal's were byte-identical — the LONGEST slot at a shared onset) and `locateSpan(score, span,
mark)`, to which each family hands the two things only it knows (its own clamped `span`, its mark); the ops
keep a two-line `locate`. Ottava's private `measureStartOffsets` was a copy of `utils/measureCapacity`'s and
is gone. `overrideOps.writeSpanOffset(score, id, kind, next)` is the sparse write the ottava / pedal / trill
each spelled — typed per kind (the pedal's vertical is `y`, the others' `outward`) and written in ONE fixed
key order, since a serialized score's key order is observable. ⛔ **The HAIRPIN is NOT on it, on purpose**:
`hairpinOps.laneOnStaff` keeps the SHORTEST slot at a shared onset, matches the staff through
`dynamicScope.onSameStaff`, and its `locate` has no missing-bar guard — a name, not a body; merging it is a
rule change and HIS call. The trill has no lane of this kind (it walks note ids). Specs: `spanLane.test.ts`
(5) + 3 `writeSpanOffset` cases; break-tested — flipping longest→shortest fails the new spec AND
`ottavaOps`' own two-voice case.*

*`pressSpanTool(row)` DONE (awaiting his word to commit) — `interactions/spanToolPress.ts`: the one
routing (re-press disarms · notes selected → create over them · nothing selected → arm) and
`SPAN_TOOL_PRESSES`, five rows — `slur` · `trill` · `pedal` · `ottava(shift)` · `hairpin(type)`; a re-press
matches the whole TOOL, payload included, which is what makes `8vb`-while-`8va` a swap. The palette's five
methods are one call each through a `SpanToolHost` (state · getEngine · arm · disarm · render); the log lines
are kept word for word. ⚠️ **One difference found and KEPT as a row field, `engineFirst`**: `createSlur` and
`createTrill` fetched the engine before anything else, so without one they neither arm nor disarm, while the
ottava / pedal / hairpins fetch it only to create (and their comments argue that is the right one). Which is
right is HIS call — pinned by a spec case either way. The trill's doc comment had drifted above
`createOttava`'s; it is back on its method. Spec: `spanToolPress.test.ts` (9). `lint:hubs` ceiling lowered.*

*`mapElementCoordinates` DONE (awaiting his word to commit) — one private walk in `ElementRegistry.ts`
taking `{ x, y, length }`; `offsetElement` is `+dx / +dy / identity` and `scaleElement` is `×k` three times,
so "a move leaves LENGTHS alone" is one argument instead of nine omitted lines. ⛔ `shiftById` is NOT a third
caller — it moves the guides' `from` ends and deliberately leaves the `to` ends, a different statement.
⚠️ Found on the way: the spec's `EVERY_COORDINATE` fixture had no `ottavaAxis`, so neither walker's handling
of it was pinned — added, with a case per chapter. Break-tested: dropping `segmentEndpoints` from the ONE
walk fails BOTH chapters.*

*`rebarOps` twins DONE (awaiting his word to commit). ⚠️ **Measured before merging: of the nine
capture/restore pairs only the SLUR's and the TRILL's share bodies** — the rest-shift / note-offset /
tremolo-pair / leading-space pairs share a SKELETON (absolute offset out, `rangeForOffset` back in) and each
a different rule about what it lands on and when it drops; those stay. Three bodies were word for word:
`regionAnchorsById` (pitch id → offset + pitch + voice, both captures), `capturedEndResolver` (both rebar
restores — staff-BLIND) and `clipEndResolver` (both paste restores — staff-AWARE, taking a `ClipLanding`),
the last two over one `forEachRegionPitch`. What differs stays in its function: a slur drops on either lost
end, a trill DEGRADES to one note on a lost end. **Specs first**, as the row asked: the rebar path was
pinned for both marks; the paste path's cross-staff landing was pinned for the slur only, so a TRILL
cross-staff paste case was added and shown green on the OLD code before the merge. Break-tested: a
staff-blind clip lookup fails the cross-staff cases, a voice-blind rebar lookup fails both marks' unison
cases.*

*`trillTrace` DONE (awaiting his word to commit) — `interactions/trillTrace.ts` holds the ⏱ TEMPORARY
tracing whole: `traceTrillFrame`, `traceTrillHandVsInk`, `endTrillHandTrace` and the `handVsInk` state, so
deleting the tracing is deleting one file and three call sites. ⭐ NO runtime cycle: what only the walk can
build (the body's port, the ornament's staff) arrives as a `TrillFrameProbe` from `dragTrillBody`, still
inside its `debugEnabled()` guard, so `trillTrace` imports nothing of `trillWalk`'s; the drag
(`drags/trillBody`) imports the hand trace from `trillTrace` directly. `inkXOf` became
`trillLane.trillInkX`, beside its vertical twin `trillInkY`. Every log line is word for word. Spec:
`trillTrace.test.ts` (3 — silent and read-free with debugging off; the cumulative residual; "nothing
drawn").*

*Span-renderer shares DONE (awaiting his word to commit) — two modules in `engine/rendering/`.
**`spanSegments.ts`**: `planSlurSegments` left `SlurRenderer` as `planSpanSegments` (+ `SpanSegment`) — four
files each carried a comment saying its name was the only thing about it that said "slur" — and
`cutSpanAtSystems` is the range mapping the hairpin / ottava / pedal / trill each spelled on top of it; each
family keeps only what it DECORATES a range with (`role` · `continuation` · `final`). ⚠️ The pedal's `<`
against the others' `<=` is KEPT, as the named option `keepHairWide` with its reason (a lift a hair inside a
new system must still draw its `✻`), pinned by a spec case each way. **`bracketSpanBand.ts`**: `barSlice`,
`bracketBaseline` and `bracketFragmentClaim` — the ottava's and the pedal's rung on the ladder, identical
but for the side and the family's two style rows; `ottavaFragmentClaim` / `pedalFragmentClaim` stay as
exported one-liners so their ladder specs are untouched, and the ottava's `coveredSlots` lost a third inline
copy of the slice. ⛔ **The TRILL is not on it**: its last bar runs to the onset AFTER the last trilled slot,
and its baseline reads the drawn CURVES and nothing of the ladder — a name, not a body. Specs: the planner's
chapter moved to `spanSegments.test.ts` (+5 `cutSpanAtSystems` cases), `bracketSpanBand.test.ts` (6).
Proof: unit suite + the BROWSER suite, 300 passed (cross-system ottava / pedal / hairpin / trill included).*

*⚠️ The ottava + pedal WALK row, MEASURED before touching it (2026-09-20) — **no code changed.** With
comments stripped and the family's name normalised (`Ottava`/`Pedal` → `X`), `ottavaWalk` (248 code lines)
and `pedalWalk` (245) differ on **149 lines**; what is identical is 118 lines in NINE scattered runs of 7–22.
The lanes: 135 / 147 code lines, 82 differing. The differences are rules, not spelling: the ottava has a SIDE
(every vertical goes through `above ? -px : px`, and its offset is `outward`) where the pedal is always below
and screen-signed; the pedal's two ends are different THINGS (`press` on a slot, `lift` on a `PedalLiftTarget`,
two commands, two x readers) where the ottava's are one `reanchor` with a `which`; the pedal's body drag
carries `throughTheBand` (hand-over) and the ottava's does not; and the engine commands differ end to end.
The shared FRAME is already shared — `markWalk` / `dragFrame` / `BreakWrapPort`. One "bracket walk" would be
a function of ~10 callbacks whose rows are today's two files. ⛔ And this is the gesture code that was reset
at his request once. **The ~380 was a count of names.**

What IS a body, and small: five lane helpers spelled per family with only the registry kind differing —
`<kind>StaffSpacePx` (×5: ottava, pedal, trill, hairpin, slur body), `staffIndexOf` (×4 private copies of
`models/staffContent.staffIndexOfId`), `<kind>SystemInkLimit` (×4), `sameAddress` (×2), and the ottava's and
pedal's `drawnOnsets`. About 60 lines, no gesture decision in any of them.*

*…and the small bodies DONE (awaiting his word to commit; his instruction: **"dont change any rule"**) —
`interactions/markLane.ts`: `staffIndexOf` (the four private copies' body, ⛔ NOT routed through
`staffContent.staffIndexOfId`, which resolves through `getStaves` and is therefore not provably the same
answer), `markStaffSpacePx(registry, kind, id)` (ottava · pedal · trill · hairpin), `markSystemInkLimit`
(ottava · pedal · hairpin · dynamic) and `sameSlotAddress`. Every family keeps its exported name as a
one-line wrapper, so no caller and no spec mock changed. ⚠️ Two entries of the list above were WRONG on
reading the bodies and were left alone: the slur body's staff space prefers a space MEASURED on the arc,
and the two `drawnOnsets` differ (the pedal reads a measure rest at its bar's onset; the ottava keeps a
right edge). Spec: `markLane.test.ts` (5). The WALK files are untouched.*

*`src/testing/` DONE (awaiting his word to commit). ⚠️ **Measured first, and the 307 was a count of
NAMES**: `note` has 17 copies and 16 distinct bodies, `bar` 12 / 11, `score` 9 / 9 — each is its spec's own
fixture and STAYS. What was a body: the "engine with no page and no sound" preamble. `engineStubs.ts` holds
the two `vi.mock` FACTORIES (`scoreRendererStub` over one `nullRegistry`, `playbackEngineStub`) — a `vi.mock`
must be written in the spec (vitest hoists it per file), so a spec says `vi.mock(path, async () => (await
import('@/testing/engineStubs')).playbackEngineStub())`; ⛔ that file imports nothing of the engine's, since
it is loaded from inside the factory while `MusicEngine` is still importing. `makeEngine.ts` (8 specs) and
`fakeSvg.ts` (9 `MouseController` chapters) are the other two. Applied by script ONLY where the body matched:
49 specs' playback stub, 19 specs' renderer + registry (and only where the registry was used for nothing
else). A spec whose registry must ANSWER keeps its own. Same 7,062 tests pass; nothing under `src/` outside
specs changed. CLAUDE.md's tree gained the `testing/` line.*

**Phase 5 DONE** — with two rows closed by measurement rather than by merging (the ottava + pedal walks;
most of the "copied" spec helpers).

### Phase 6 — Folders and docs

*(review)* Items 1–2 move about 220 files and touch every import path: run them only when
nothing else is in flight, one folder group per commit. ✅ The prettier decision this waited on is
TAKEN (Phase 1.7: prettier REMOVED, measured) — so the moves' blame cost is paid once, not twice.

1. **`engine/rendering/`** (129 files) → `engraved/`, `format/`, `painter/`, `beams/`, `curves/`,
   `marks/{dynamics,tempo,lines}/`, `ghosts/`, `staff/`. High-cohesion groups first. Rename the
   adapter twins that share a basename with their `engrave/` interface (`noteRuler`, `signRun`,
   `staveFrame`) and fix their stale VexFlow headers.
2. **`interactions/`** (91 files) → `controllers/`, `state/`, `propertyControllers/`, `walks/`,
   `lanes/`, `drags/`, `stamps/`, `text/`, `clipboard/`, `io/`.
3. **Tests stay beside their subject.** `lint:testnames` and `audit:tests` depend on it, a folder
   move carries its specs for free, and the flat directories are the real problem. Shared
   builders go to `src/testing/`; feature tests stay in `__tests__/`; `e2e/` stays separate.
4. **Docs**: move the 65 done or superseded files to `docs/archive/`; add a one-screen
   `docs/README.md`. Refresh `ARCHITECTURE.md` — the layer map lacks `windows/`, `menus/`,
   `engrave/`, `scene/`, `paint/`, `fonts/`, `export/`; the opening still narrates VexFlow; the
   glossary's `placeSpanningNote` and multi-voice entries are stale; the bus is 43 modules, not
   21 seams; `interactions/` does import `windows/` at runtime. Rewrite `CLAUDE.md`'s tree as one
   line per folder.
5. **`DESIGN-PRINCIPLES.md`**: the six principles stand. Add to the boundary cases: the unused
   staff seam (150 raw `measure.slots` reads against 5 `staffSlots` calls, so per-staff meters
   would touch about 100 sites) and the undo cost below.

*Phase 6 item 4 (docs), first half DONE (awaiting his word; docs only, no checks run). ⚠️ **The
"move 65 done files to `docs/archive/`" half was MEASURED and NOT done**: the code's comments cite docs by
path and section — 1,774 mentions of 118 files — and the BUILT plans are the most cited of all
(`vexflow-removal-map` 122, `own-engraving-engine` 75, `render-performance-plan` 69, `pedal-plan` 66). Moving
them rewrites about a thousand comment lines for a tidier folder listing, and only 5 of 146 files carry a
status line that says "done" in a way a script could trust — which 65 is a judgement, HIS. The problem the
move was for — *which of these is live?* — is answered by the new one-screen **`docs/README.md`** instead:
rules · live work · planned · descriptions · research · feature plans · history, every file linked, no path
changed. `ARCHITECTURE.md` got the plan's listed corrections and nothing else: the layer map gained
`windows/`, `menus/` and the engine's `commands/ engrave/ paint/ scene/ fonts/ export/`; the bus is 40 seams;
the "voice-ready" glossary row no longer says multi-voice rendering is deferred; and ⚠️ the claim that only
two `import type` lines were left of the `interactions/`↔`windows/` edge was FALSE — `shortcutWiring` and
`MouseController` open windows at runtime, one way, and the doc now says so. Still owed in item 4: the
opening's spacing-model narrative (accurate but long), and `CLAUDE.md`'s tree as one line per folder —
⏸️ that one moves the ⛔ rules agents read every session, so it wants his eye first.*

*…and the DOC LINKS (awaiting his word) — his words: the docs folder *"is a little messy"*. Before tidying it,
what the tidying would break had to be checkable: **`npm run lint:doclinks`** (`scripts/check-doc-links.mjs`,
now in `build:check`) holds every `docs/….md` cited from `src/`, `e2e/`, `scripts/`, `docs/`, `CLAUDE.md` and
`reference/README.md` — 2,511 mentions — to a file that exists. It found SEVEN cited docs that did not
(28 mentions), and ⚠️ five of the seven were the names of the AGENT'S OWN MEMORY NOTES, cited in code comments
as if they were files: rules nobody else could open. Four were repointed to the doc that really holds the
rule (`staff-size-plan` · `vexflow-boundary` · `json-io-plan` · `spacing-model-plan`); two that stated a doc's
absence now say so without a path; and the most cited, **`docs/how-it-works/tuning-systems-and-alteration.md`** (12
mentions across the audio and pitch code), was WRITTEN from the note — why `alter` is a symbol and not a
count of semitones, MEI vs MusicXML, and his decision that a tuning system is a LAYER, not score content.
⏭️ Next, now that it is safe: sub-folders by kind with the paths rewritten in the same commit, and a Status
line per file — ⛔ written only where the file or the code makes it certain; a doubtful one is left as it is
and corrected when development next meets it (his rule).*

*The DOCS FOLDER sorted by KIND (awaiting his word) — 143 files moved with `git mv` into `docs/plans/` (77) ·
`docs/research/` (36) · `docs/how-it-works/` (17) · `docs/history/` (13), the five RULE files staying at the
top (`README` · `ARCHITECTURE` · `DESIGN-PRINCIPLES` · `logging` · `test-layout-plan`). ⚠️ By KIND and ⛔ not
by status: a built plan stays in `plans/`, so nothing has to move again when a status changes — which is
what this item's original "archive the done ones" got wrong. Every `docs/<name>.md` mention was rewritten in
the SAME change (775 files — comments and docs only), the index's and the docs' relative links with them,
and `lint:doclinks` was widened first so it could PROVE the move: the whole repo (not four folders), plus
relative markdown links resolved from their own file — 2,708 mentions, all resolving; break-tested with a
fake link of each kind. Suite and `build:check` green. Still owed: a Status line per file, ⛔ only where
certain (his rule).*

*Status lines (awaiting his word; docs only) — MEASURED first: 55 of the 77 plans already state their status
in their first lines. Of the 22 that do not, three state it further down in their own words, and those were
lifted to the top as quotations of the file (`dynamic-offset-plan` ALL DONE · `font-metrics-plan` BUILT ·
`fan-beam-join-plan` P0–P3 done, §5 not built). The other 19 say nothing about their own state, and that a
feature's module exists does not say every item of its plan shipped — so, ⛔ by his rule, they are LEFT, and
`docs/README.md` now says why a plan may carry no status. The other folders need none: `research/`,
`how-it-works/` and `history/` are kinds, and the folder says it.*

**Phase 6 item 4 DONE.** Open in Phase 6: `CLAUDE.md`'s tree as one line per folder (⏸️ it carries the ⛔
rules an agent reads every session — his eye first) and items 1–2, the ~220-file source-folder moves.
✅ Item 5 done with this batch: `DESIGN-PRINCIPLES.md` gained the two boundary cases — the staff seam
(re-measured: 147 raw `measure.slots` reads against 5 `staffSlots` callers) and the undo clone's cost.

*Phase 6 item 1 STARTED — the tool, and the first group (awaiting his word). **`scripts/move-source.py
<folder> <sub> <Name…>`** moves each NAME with its specs (`git mv`), re-derives every relative specifier from
where the file NOW is and keeps `@/` ones aliased — `import`/`export … from`, `import()`, `vi.mock` /
`vi.importActual` — and rewrites the PROSE mentions too (`rendering/<Name>` → `rendering/<sub>/<Name>` in
comments, docs, scripts and the lint configs: there are 1,257 of those for `rendering/` alone, and no lint
reads them). First group, the most self-contained: **`engine/rendering/ghosts/`** — the fourteen `*Ghost` /
`GhostRenderer` / `ghostCursor` / `ghostTypes` files and `loneNote` (27 with specs); imports rewritten in 31
files, prose in 35. ⚠️ **The trap checked before anything else**: the boundary lint names the folder as
`**/rendering/*`, and a `*` that stopped at `/` would have let the score layer import `rendering/ghosts/…`
silently. PROVED it still bites — a probe file in `engine/models/` importing `ghostTypes` from the new
folder, by alias and by relative path, is refused twice. tsc · eslint · `build:check` · 7,062 specs ·
the BROWSER suite (300) green.*

*Group 2 (awaiting his word): **`engine/rendering/curves/`** — the slur's and the tie's eighteen files
(`SlurRenderer` · `TieRenderer` · `curveArc` · `curveStyle` · the `slur*` / `tie*` rules · `brokenSlurTilt`),
35 with specs. Fence re-proved against the new folder; tsc · eslint · `build:check` · 7,062 specs green.*

*Group 3 (awaiting his word): **`engine/rendering/marks/`** — `dynamics/` (the dynamics line and the
hairpin, 11 modules) · `tempo/` (6) · `lines/` (ottava · pedal · trill · `bracketSpanBand`, 8) · and at
`marks/` itself `markPreviewPass` + `spanSegments`; 46 files with specs. Fence re-proved at both depths.
⚠️ **`lint:hubs` went red, and it was the COUNTER, not the hubs**: it reads kind words out of every token,
import specifiers included, so a folder called `marks/dynamics/` counted as `ScoreRenderer` learning about
dynamics (+6 with no line of it changed). ⛔ The ceiling was NOT raised: `check-hubs.mjs` now blanks the
specifier of `from '…'` / `import('…')` — a path is where a module lives, the imported NAMES are still
counted — and every ceiling FELL to the new measure (ScoreRenderer 891 → 853, ScoreModel 940 → 916,
MusicEngine 506 → 490, MouseController 307 → 282, PaletteController 455 → 449, shortcutWiring 67 → 59,
selectionSnapshot 7 → 3). tsc · eslint · `build:check` · 7,062 specs green.*

*Groups 4–8, and **`engine/rendering/` is DONE**: `engraved/` (the `Engraved*` classes, `NoteBuilder`,
`ScoreTuplet`, the two tremolos, `noteRuler`, `noteInkBox` — 40 files with specs) · `beams/` (11) ·
`format/` (the column format, the modifier columns, `spacingPass`, the accidental / dot / chord-head
placement — 17) · `painter/` (`SvgPainter`, `svgDrawGroup`, `glyphPainter`, the ink readers, the font faces
— 18) · `staff/` (the stave frame and signs, the barlines, the key signature, the header and clef passes,
the system edges — 21). What stays at the folder's top is the renderer's CORE: `ScoreRenderer` ·
`RenderPass` · `renderTypes` · `CoordinateMapper` · the two redraw-key files · `PagePass` ·
`ScoreHeaderPass` · `GutterRenderer` · `hiddenElements`. 129 flat files → 10 + eight folders. Fence
re-proved against all five new folders (5 of 5 refused); `lint:paint` followed its definition file;
tsc · eslint · `build:check` · 7,062 specs · the BROWSER suite (300) green. ⏭️ NOT done, and named in the
plan: renaming the adapter twins that share a basename with their `engrave/` interface (`noteRuler`,
`signRun`, `staveFrame`) — a rename is a separate decision from a move.
⭐ His word, 2026-09-20: these moves are mechanical, so each group is committed once its checks pass,
to the end of this task.*

### Later — before orchestral scores

Undo clones the whole score with JSON on every edit, three times on an undo. Measured on a
synthetic 400 bars × 20 staves: over 100 ms per edit, and an estimated 2 GB for a 100-deep
history. Drop the double serialisation now; plan per-measure structural sharing before it bites.
(The undo-request assertion that stood here is Phase 1.2.)

---

## 3. Comment policy (apply when a file is next touched — no bulk sweep)

The explanatory layer — invariants, units, why not the obvious thing — is the codebase's best
asset and stays. The history mixed into it (1,295 dated lines, 1,089 "his call" lines, 9,607
emoji-marked lines, 56 sentences where VexFlow still acts) hides it.

- A comment states a **present-tense rule and its reason**, plus at most one link and one line of
  provenance ("ported from VexFlow `svgcontext.js`").
- Dates, quotations, bug stories and phase ids go in the commit message or a short doc.
- *(review)* **"Decided, not derived" is provenance and stays.** Many of the "his call" lines are
  the only record that a default is a decision rather than an accident, which CLAUDE.md's
  house-style rule relies on. Keep the fact in two words; drop the date and the quotation.
- A marker is for a rule no tool can check; one per block.

First pass, because it is misinformation rather than noise: the present-tense VexFlow sentences
and the three dangling doc links (`kerning`, `small-staff-spacing` — repointed 2026-09-20 to the docs that
hold those rules — and `docs/how-it-works/tuning-systems-and-alteration.md`, written that day; `npm run lint:doclinks`
now holds all of them).

---

## 4. Not worth doing

- Collapsing the `ScoreModel` / `MusicEngine` one-line forwarders, or namespacing them — measured
  and refused in the span-mark plan; the verdict holds.
- A generic span-mark renderer, or one walk for all six kinds — the `draw*` bodies are 36–45%
  alike and the trill / dynamic / hairpin variance is real.
- Splitting `renderScore`, `drawMeasureContent` or `ElementRegistry`.
- Breaking the type-only import loops.
- `noUncheckedIndexedAccess` (3,670 errors), `exactOptionalPropertyTypes` (272).
- A bulk comment rewrite, a mass emoji strip, mass renames (`*Selection`, `*Renderer`/`*Pass`,
  stave/staff) — settle the naming for **new** code only.
- Moving tests to a separate tree.
- Table-driving the palette's small `toggle*` / `refresh*` methods or the 64 three-line shortcut
  actions.
