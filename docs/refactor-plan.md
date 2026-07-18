# Refactor Plan — Code Quality Pass (2026-07-18)

Outcome of a full code review (all of `src/` read; every export mechanically checked for
callers; baseline: type-check clean, 1444 unit tests green). The codebase is healthy — the
layering holds, invariants are enforced by real mechanisms, comments explain *why*. This plan
is the ordered cleanup of what the review found: three latent bugs, stale docs, a handful of
real duplications, verified dead code, and one structural split.

Each phase is independently shippable and leaves the suite green. Phases are ordered by
value-per-risk: bugs first, then the 10-minute doc fix, then dedup (which the bug fixes lean
on), then deletion, then structure.

---

## Phase 1 — Fix the three latent bugs

Each is small, each gets a regression test written FIRST (red → green).

### 1a. `MusicEngine.deleteNote` chord-membership check is not staff-scoped

`getChordNotesAt(measure, beat, voice)` filters by voice only. On a multi-staff score,
deleting a single note that has a same-beat/same-voice note on **another staff** wrongly
reads as `isPartOfChord = true`, so the note is removed without being replaced by a rest
(and the tie/slur re-anchor paths pick a "sibling" on the wrong staff). This is bug family
(a) from the multi-staff plan — "next-note search unscoped by (voice, staff)". The sibling
helper `slotPitchIdsFor` already staff-filters and its comment calls the unscoped version
"a real bug".

- Fix: give `getChordNotesAt` a `staff` parameter (mirroring
  `NoteEntryCoordinator.getChordNotesAt`, which already has one) and pass the deleted
  note's staff at both call sites in `deleteNote`.
- Test: two staves, same beat, same voice, one note each; delete one → a rest must replace
  it and the other staff must be untouched.

### 1b. `MusicEngine.renderScoreWithPreview` derives `barQuarters` from measure 1

`this.scoreModel.getMeasure(1)` is used for the capacity no matter which measure is
hovered, so the ghost note's fallback beat quantization is wrong in any measure whose
meter (or pickup length) differs from bar 1. The registry-based path usually masks it;
the coordinate-calculation fallback does not.

- Fix: resolve the hovered measure first (`coordinateMapper.pixelToMeasure`), then take
  THAT measure's `measureCapacityQuarters` — the same order `addNoteAtPosition` uses.
- Test: 4/4 bar 1 + 3/4 bar 2, preview in bar 2, assert the quantized beat clamps to 3/4.

### 1c. `SelectionController.elementVerticalPos` ignores the shipped rest shift

Its own `TODO(rest-positioning)` says the voice-lane derivation goes stale "the moment we
add manual rest positioning" — and rest vertical shift (engraving client #5) has since
shipped. Alt+Shift+↑/↓ voice hops misjudge above/below for manually shifted rests.

- Fix: in the rest branch, read the rest's real shift
  (`restShiftOverrideOf(score, restPositionKey(measure.id, voice, beat))`) and add its
  `steps` onto the voice-lane default, exactly as the renderer's `restShiftFor` does.
  Remove the TODO.
- Test: two voices, shift voice 2's rest above voice 1's note, hop up/down and assert the
  landing target follows the drawn geometry.

Verification: new tests red-before/green-after, full suite, hand-test 1a and 1c in the
browser (user does manual UI testing).

---

## Phase 2 — Update CLAUDE.md (stale, actively misleading)

- **Core Types**: remove `tempo`, `keySignature`, `defaultTimeSignature`, `clef?` from the
  `Score` listing — all four were deliberately deleted from the model (the field docs in
  `types/music.ts` record why). Show the real shape: `measures`, `staves?`, `staffGroups?`,
  `slurs?`, `engravingOverrides?`.
- **MusicEngine API**: drop the methods Phase 4 deletes (`addRest`, `noteToPixel`,
  `pixelToPosition`'s stale signature if wrong, `resizeCanvas` …) and reflect the ones that
  exist (`addNoteAtBeat`, `pasteEvents`, `runBatch`, view mode, …). Keep it a curated
  summary, not an exhaustive dump.
- One line for the marking-tool union (`selectedMarkingTool`) under Key Implementation
  Details, since every new tool must join it.

---

## Phase 3 — Deduplicate the repeated rules

### 3a. One pitch/alter formatter

The inline ternary `alter === 2 ? '##' : alter === 1 ? '#' : …` appears 10+ times across
MouseController, NoteEntryCoordinator, MusicEngine (`toggleTie`'s local `fmt`),
PaletteController, KeyboardController; `ScoreModel` has a private `alterMarks()` doing the
same job.

- Add to `utils/pitchSpelling.ts`:
  - `alterToString(alter): string` — `''`/`#`/`##`/`b`/`bb` (what the logs want);
  - `formatPitch({ step, alter, octave }): string` — `C#4`.
- Sweep every inline copy (including `ScoreModel.alterMarks`) onto them. Log output should
  be byte-identical — assert a couple in existing tests where convenient.

### 3b. One prevailing-accidental rule

The running-accidental logic exists three times and the comments admit they "mirror" each
other: `MusicEngine.getPrevailingAlter`, `SelectionController.computeDisplayedAccidental`,
and NoteBuilder's render-time pass.

- Extract ONE resolver into a pure util (natural home: `utils/pitchSpelling.ts` or a small
  `utils/accidentalState.ts`): given the measure's notes and a target position/beat,
  return the active alter. The three call sites keep their own thin interpretation on top
  (prevailing alter / displayed sign / drawn glyph) but share the walk.
- Guard with a test that pins the shared rule (tied notes excluded, beat-ordered, same
  diatonic position only) so the three consumers can never drift again.

### 3c. Renderer bookkeeping — one list of per-render maps

`VexFlowRenderer.clear()` and `clearForRender()` each enumerate the same maps; adding a
ninth map means remembering both sites (the N² trap this codebase deletes elsewhere).

- Extract `private resetPerRenderState()` holding the shared map-clears; each caller keeps
  only its genuine differences (SVG teardown policy, `measureBounds`, `snapshots`,
  `measureLayoutInfo` — with the existing comments moved intact).

### 3d. ScoreModel internal helpers (smaller, same commit or separate)

- `regionRanges(regionNumbers)` helper for the capacity-accumulating walk duplicated in
  `restoreBeatAnchors` / `restoreRestShifts` (and the base-walk in the two capture
  functions).
- Merge the overlap-scan shared by `evictRestsOverlapping` /
  `evictRestsOverlappingChord`; the call-site difference (who fills, who places) stays at
  the call sites per the existing comment.

Deliberately NOT deduplicated (reviewed and rejected):
- `splitBeatsIntoDurations` vs `splitBeatsIntoLengths` — documented as two different
  questions (meter chooses rest dots; a note's split is best-writing). Keep both.
- The eight ghost methods' scaffolding — each has real documented quirks; only extract the
  two verbatim blocks (blue-tint pass, collect-new-children-into-group) if it stays
  clearly simpler. Optional, judgement call at implementation time.
- The per-tool press routing in PaletteController — structurally similar but every branch
  encodes a real per-tool decision; an abstraction would hide the differences that matter.

---

## Phase 4 — Delete the dead code (agreed list), annotate the keepers

Verified: no production caller anywhere in `src/` (tests that cover these are tests of
dead code and go with them). Git history preserves everything.

### Delete

| Where | What | Note |
|---|---|---|
| `utils/musicUtils.ts` | `getTupletNoteDuration`, `getTupletTotalBeats` | float twins of the live `…Frac` versions — trap |
| `utils/musicUtils.ts` | `getStaffLinePosition` | musically wrong (semitones/2, ignores spelling) — trap |
| `utils/musicUtils.ts` | `noteNameToMidi` | string-parsing MIDI-era leftover; contradicts spelling model — trap |
| `utils/musicUtils.ts` | `noteCanFitInMeasure`, `getNextAvailableBeat` | float; superseded by `checkMeasureOverflow` + rest-fill |
| `utils/musicUtils.ts` | `sortBeatsFrac` | one-liner |
| `utils/beatMap.ts` | `notesInRange` | old Shift-click range, superseded by `notesInBox`; doc comment now false |
| `utils/clefUtils.ts` | `midMeasureClefChanges` | one-line filter over live `measureClefChanges` |
| `utils/meter.ts` | `meterBarQuarters` | unused one-liner |
| `utils/durations.ts` | `durationInfoIsConsistent` | "for tests" but untested — OR write the 3-line test; decide at impl |
| `interactions/selection.ts` | `selectionKinds` | trivial, recreate when mixed-kind selection lands |
| `types/music.ts` | `Position` interface | suggests an API that doesn't exist |
| `engine/NoteEntryCoordinator.ts` | `isTiedContinuation` param + branch in `findNotesToOverwrite` | always `false` |
| `engine/MusicEngine.ts` | `addRest`, `checkCollision`, `checkOverflow`, `findNextAvailablePosition`, `noteToPixel`, `updateCoordinateConfig`, `resizeCanvas` | the pre-NoteEntryCoordinator entry pipeline's facade |
| `engine/models/CollisionDetector.ts` | `checkNoteCollision`, `findNextAvailablePosition` (+ their tests) | only reachable via the deleted facade; `checkMeasureOverflow` stays |
| `utils/musicUtils.test.ts`, `CollisionDetector.test.ts` | the cases covering the above | green tests vouching for traps |

Also delete `CoordinateMapper.noteToPixel` if (as expected) the facade was its last caller
— verify at impl time; `beatToPixelX` stays (used internally and by live paths).

### Keep, with a one-line "reserved for" comment so the next audit doesn't re-flag them

| Where | What | Reserved for |
|---|---|---|
| `engine/MusicEngine.ts` | `setVolume`, `seekToMeasure`, `getPlaybackPosition` | transport bar (volume / seek UI) |
| `engine/MusicEngine.ts` | `getUndoDescription` / `getRedoDescription` | test-live; Edit-menu labels ("Undo Reshape slur") |
| `shortcuts/ShortcutConfig.ts` | `getShortcutList` | keyboard-help window over `SHORTCUTS` |
| `windows/content/widgets.ts` | `Label`, `TextInput` | porting the custom-TS / pickup dialogs from App.vue to plain-TS windows |
| `utils/musicUtils.ts` | `spanContainedInFrac` | nested-tuplets containment guard (allow containment, reject partial overlap) |

Verification: `npm run build:check` (boundary lint + vue-tsc + build) and the full suite.

---

## Phase 5 — Structural: split the rebar/paste machinery out of ScoreModel

`ScoreModel.ts` is 3.7k lines; the one god-file. It already delegates clefs/tuplets/staff
content/projection. The next natural seam is the region-rewrite machinery — ~1,000 lines
that only talk to each other:

- `rebarRegion`, `pasteEvents`
- `captureBeatAnchors` / `restoreBeatAnchors`
- `captureRestShifts` / `restoreRestShifts`
- `captureBoundaryTies` / `restoreBoundaryTies` / `boundaryPitchId` / `linkTieById`
- `captureSlurs` / `restoreSlurs` / `restoreClipSlurs` / `slurAnchorKey`
- `clearMeasureForRebar`, `materializeRegion`, `materializeVoiceBar`,
  `materializeAtomicPiece`, `linkRebarTies`
- the `CapturedAnchor` / `CapturedRestShift` / `CapturedSlur*` / `ClipDynamicInput` /
  `ClipSlurInput` types

Target: `engine/models/rebarOps.ts` in the established style of `clefOps` / `tupletOps` —
free functions taking `score` (plus the few ScoreModel callbacks they need:
`fillGapsWithRests`, `insertMeasureAfter`, `pushRestSlot`, engraving-override accessors).
`ScoreModel.setTimeSignature` / `pasteEvents` become thin delegations, exactly like the
clef ops today. Pure code motion — no behaviour change; the existing rebar/paste/TS test
suites are the safety net, plus `git diff --stat` sanity that nothing but imports moved.

This lands BEFORE the next big model feature (key signatures, instruments) so those don't
grow the file further.

### Parked for later (explicitly not in this pass)

- Float → Fraction migration of `NoteEntryCoordinator.updateNote` /
  `updateNonTupletNote` internals (the thinnest spot of the Fraction invariant; works
  today, epsilon-guarded, but a candidate once touched for other reasons).
- Extracting the ghost family into `rendering/GhostRenderer.ts` (~900 lines) — worthwhile
  only if VexFlowRenderer keeps growing.
- App.vue's repeated palette markup — resolved by the planned Vue-palette DELETION, not by
  refactoring; don't polish what is scheduled to go.

---

## Order of execution & hygiene

1. Phase 1 (bugs, test-first) — three small commits or one, user's call.
2. Phase 2 (CLAUDE.md) — one commit.
3. Phase 3 (dedup) — 3a+3b together (they share pitchSpelling), 3c+3d together.
4. Phase 4 (deletion + keeper comments) — one mechanical commit.
5. Phase 5 (rebarOps split) — one code-motion commit.

Every phase: `npm run test` + `npm run build:check` green before it's offered for commit.
No commits or pushes without explicit say-so, per project rules.
