# Code shape plan — 2026-09-19

**Status: IN PROGRESS — Phase 1 DONE (2026-09-19), bar item 5's two ⏭️ decisions. Phase 2 DONE. Phase 3.1: the hairpin / ottava / pedal body drags done and checked; the trill's too (`cdb7f05`); the slur's too (`69e927c`); the four SQUARE drags too (`6d903c3`); the slur HANDLE / ENDPOINT and staff-spacing drags too (`8f28f79`); the DYNAMIC and TEMPO drags too (`9a04f88`); bar width, barline join, group span and clef too (`ee31698`); the NOTE drag too (`7d2898e`) — every gesture is a module. **Phase 3.1 DONE** (`25f70a6`). 3.2: the `keys` column + dispatcher and the HAIRPIN on it (`e61626a`); OTTAVA / PEDAL / TRILL too (`14e10e7`); DYNAMIC and TEMPO too (`943fb64`); SLUR and CLEF too (`8382fcc`); the `reanchor` and `cycle` verbs done, awaiting his UI check — **Phase 3.2 DONE with it.** 3.3 (`highlight(ctx)`): the contract + the four span squares (`a7c1076`); the join and group squares (`b772418`); the `ink` column (`f1832e7`); the slur handles (`d3dcb7b`); the anchor guide line (`e2ff597`); the note pass + note-attached kinds (`aa7e5af`); every remaining row done, awaiting his UI check — **Phase 3.3 DONE** (`1efb38d`). 3.4: the panels' `rows` (`4db182d`); the typed `InspectedElement` union done, awaiting his UI check — **3.4 DONE** (`54ab9cc`). 3.5: `spanFromNotes` (4.1) + the OTTAVA family as `engine.ottava.*` done, awaiting his UI check; pedal / trill / hairpin / slur / dynamic / tempo to follow.** Phases are ordered by
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
   `MusicEngine`: 6,224 → 5,801 lines, kinds 1,130 → **1,051**. ⏸️ Awaiting his UI check.*

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
2. `NoteEntryCoordinator`'s model-only half — overflow, erosion, tie-split, overwrite, the
   tuplet builders — into `engine/models/noteEntryOps`. The coordinator keeps pixel resolution,
   collision and commit.
3. `ScoreModel`'s remaining logic (`fillGapsWithRests`, `pushRestSlot`, `insertPitch`,
   `convertToRest`, the three `repairDangling*`) into ops modules; then `rebarOps` imports ops
   directly and `RebarDeps`, `VoiceDeps`, `ClearRangeDeps` disappear.
4. New features call `xOps.fn(model.getScore(), …)` rather than adding a forwarder, so the
   forwarder count stops growing. Existing forwarders stay.
5. Move `GhostNote` and `PixelCoordinates` out of `types/music.ts` to the editor side; split the
   file by domain behind a re-export barrel.

### Phase 5 — Collapse the copies that have bodies

Each passes ARCHITECTURE's "a name is not a body" test — measured on bodies, not names.

| what | saves (code lines) |
|---|---|
| `spanLane` (`staffOnsets`, `measureStarts`, `locate`) + one `writeSpanOffset` for the span ops | ~200 |
| ottava + pedal walk and lane → one bracket-span pair | ~380 |
| `cutIntoPieces`, `fragmentClaim`, `baselineFor` shared by the span renderers (⚠ pedal uses `<`, ottava `<=`); move `planSlurSegments` out of `SlurRenderer` | ~120 |
| `pressSpanTool(row)` for the palette's five `create*` | ~70 |
| `RequestChannel<T>` for the 19 identical bus emitters | ~230 |
| `rebarOps` capture/restore twins (specs first) | ~100 |
| `mapElementCoordinates` walker in `ElementRegistry` — a new coordinate field is taught once | ~50 |
| `src/testing/` builders for the 307 copied spec helpers (`fakeRegistry` ×26, `note` ×16, `makeEngine` ×13) | — |
| `trillWalk`'s ~110 lines of tracing → `trillTrace.ts` | — |

### Phase 6 — Folders and docs

*(review)* Items 1–2 move about 220 files and touch every import path: run them only when
nothing else is in flight, one folder group per commit, and after the prettier decision
(Phase 1.7).

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
and the three dangling doc links (`docs/kerning.md`, `docs/small-staff-spacing.md`,
`docs/tuning-systems-and-alteration.md`).

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
