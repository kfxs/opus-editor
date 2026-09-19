# Code shape plan — 2026-09-19

**Status: IN PROGRESS — Phase 1 DONE (2026-09-19), bar item 5's two ⏭️ decisions. Phase 2 DONE. Phase 3.1: the hairpin / ottava / pedal body drags done and checked; the trill's too (`cdb7f05`); the slur's too (`69e927c`); the four SQUARE drags done, awaiting his UI check. Ten gestures are still the controller's.** Phases are ordered by
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
   check — the squares, and the trill body again since it was re-seated.*

   *Still the controller's own (no `move`): note, barWidth, barlineJoin, clef, staffSpacing,
   staffGroupSpan, slurHandle, slurEndpoint, dynamic, tempo.*
2. **A `keys` column on `ELEMENT_SPECS`** — `{ nudge, reset }` first — and one dispatcher.
   Replaces the four `||` chains and the 61 closures.

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
4. **Properties panels**: `windows/properties/panels/<kind>.ts` exporting `report` and `rows`,
   keyed by kind. *(review)* **Recommended: `rows` yes, `report` no.** The `paint` ladder is
   where this window grows (977 code lines, 25 kind tests), its specs are *already* split by kind
   (`PropertiesWidget.hairpin.test.ts`, …) so each moves whole with its panel, and the recorded
   decision never covered it. The `report` half is the other switch `chain.ts` keeps on purpose
   (`selectionSnapshot.selectedElements`): 287 code lines, read-only, exhaustive at one site, and
   a reader of "what is selected" wants it in one place — it stays. The 37 casts do not need it
   moved: they come from `InspectedElement.data: unknown`. Make `InspectedElement` a
   discriminated union keyed by `kind`, and each panel receives its own typed `data`.
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
