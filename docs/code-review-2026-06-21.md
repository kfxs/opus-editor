# Code Review & Refactoring Report — opus-editor

**Date:** 2026-06-21
**Scope:** Whole `src/` tree (~18.7k lines non-test, 52 files; ~6.8k lines of tests across 24 files)
**Goal:** Assess maintainability, scalability, readability, duplication, dead code, and architecture after extended organic growth — *without* destabilizing a working project, and *preserving* the framework-agnostic design.

---

## 1. Executive summary

**The architecture is sound and should be kept.** This codebase does not need re-architecting. The layering is clean, the framework-agnostic boundary is real and disciplined, and the test coverage is substantial. What it needs is **targeted cleanup of accumulated debris** — dead code, a handful of measured duplications, and the decomposition of three over-long files — not a rewrite.

The work divides into three tiers:

- **Tier 1 — dead code & small DRY extractions.** Mechanical, low-risk, test-guarded. ~Half a day. Removes ~80–100 lines and creates reusable primitives.
- **Tier 2 — decompose the three problem files** (`MouseController`, `NoteEntryCoordinator`, `MusicEngine`'s update logic) and **consolidate the duplicated tie-split logic.** Higher value, behaviour-preserving, guarded by tests. A few days.
- **Tier 3 — watch-and-defer.** `VexFlowRenderer` layout split, Fraction/float discipline, undo snapshot strategy. Only act when a feature forces it.

**Nothing here requires touching the public `MusicEngine` API surface or the data model.** All changes are internal.

---

## 2. What is working well (do NOT change)

These are genuine strengths. Refactoring them would *cost* readability or stability.

### 2.1 The framework-agnostic boundary is real
`src/interactions/` (controllers + `EditorState`) contains **zero Vue imports**. `src/composables/` are thin Vue glue that wrap the controllers and bind reactivity. `EditorState.ts` even documents the React/Angular mapping. A port to another framework would touch only `composables/` + `App.vue`. **This boundary is the single best property of the codebase — keep it sacred.** Any new logic goes in `interactions/`/`engine/`, never in a composable.

### 2.2 The internal vs. public data model is a deliberate, correct choice
`ScoreModel` works internally on a rich `Chord / NotePitch / Rest / ChordRest` model and projects a flat `Note` for the public API and JSON (`toFlatNote`, `restToFlatNote`). This is *why* "voice-ready" recurs in the plans — the hard part (multi-voice data shape) is already built; only the multi-voice render loop is deferred. This is the right way to have staged it.

### 2.3 Clean layering and pure utils
`MusicEngine` (facade) → `ScoreModel` / `VexFlowRenderer` / `PlaybackEngine` / `CoordinateMapper` / `ElementRegistry`. The `utils/` modules (`fraction`, `meter`, `rebar`, `restFill`, `beaming`, `clefUtils`, `pitchSpelling`) are pure and well-isolated. Dependency direction is correct throughout.

### 2.4 "Hotfix-looking" code that is actually correct — leave it alone
Several patterns *read* like hacks but are legitimate inherent complexity, are well-commented, and are tested. **Do not "clean these up"** — you would only reintroduce bugs:
- The defensive `repairAllMeasureGaps()` before render (`MusicEngine.renderScore`).
- The "read the side the renderer last drew" fallback in `flipSlur` / `flipTie` (needed for first-press-always-flips on auto-placed elements).
- The pending-tie / re-anchor-on-delete dance for ties and slurs.
- The `chooseVoiceMode` / cautionary-clef / cautionary-TS logic in the renderer.

### 2.5 Naming and "why" comments
Method names are descriptive; the JSDoc explaining *why* (not what) is genuinely valuable and should be preserved through any refactor.

### 2.6 Debug logging is INTENTIONAL — keep it
There are ~127 `console.log` / `console.warn` calls in non-test code (notably `MouseController` ~49, `NoteEntryCoordinator` ~21, the `[Tie]` traces in `MusicEngine`). **These are kept on purpose.** The project is under active development, not in production, and the traces are useful working debug output. This report does **not** recommend removing or gating them, and they should **not** be counted as a smell or "noise" in any future pass.

A direct consequence: the duplicated tie-debug `fmt(note)` formatter (inline in `MusicEngine` `toggleTie`, and previously in the now-deleted `linkTie`) stays as-is. If anything, fold the surviving copies into one shared debug-format helper *only* if convenient — but do not remove the logging itself.

---

## 3. Dead code (Tier 1 — delete)

### 3.1 Commented-out `linkTie` method
`MusicEngine.ts` ~819–838: an entire method body lives inside a `/** … */` block comment, preceded by **two** orphaned JSDoc headers. Delete all three (the method and both stray comment blocks). Git history retains it.

### 3.2 Unused legacy `getNoteAtPosition`
`MusicEngine.ts:1141–1161`. This is the *old* hit-test: it assumes every measure has measure 1's capacity (`getMeasure(1)`, `measureCapacityQuarters`) and does an O(n) pixel-distance scan. **Zero callers** — all hit-testing now flows through `ElementRegistry`. Delete the method and its entry in `CLAUDE.md`'s API list.

> Note: the debug `console.log`/`[Tie]` traces are intentional and stay — see §2.6.

### 3.3 Lightly-used legacy coordinate methods (verify, then consider)
With `ElementRegistry` now the authoritative source for hit-testing and pixel↔position, some `CoordinateMapper` methods (`noteToPixel`, `pixelXToBeat`, `pixelYToPitch`) are only lightly used and partly act as fallbacks. **Not confirmed dead** — `getPositionFromPixels` still uses them as a fallback path. Action: audit each call site; if a method is genuinely unreferenced (as `getNoteAtPosition` was), delete it; otherwise leave it. Low priority.

---

## 4. Duplication — measured, with fixes (Tier 1 + Tier 2)

Each item below is real, counted, and fixable into a *reusable primitive* — extracting things the code has already proven it repeats, not speculative abstraction.

### 4.1 The "commit a mutation" triplet — 29 repetitions (Tier 1)
**Where:** `MusicEngine.ts`, 29×.
**Pattern:**
```ts
this.playbackEngine.setScore(this.scoreModel.getScore())
this.saveUndoState('Some description')
```
**Why it matters:** Beyond noise, it is *error-prone* — a new mutation method that forgets the `setScore` line silently desyncs playback from the score (the exact class of dormant bug previously found in the viewport work).
**Fix:** one private helper:
```ts
private commit(description: string): void {
  this.playbackEngine.setScore(this.scoreModel.getScore())
  this.saveUndoState(description)
}
```
Call sites become `this.commit('Add tie')`. Removes ~28 lines; makes "forgot to sync playback" structurally impossible.

### 4.2 Clef middle-line table — defined 3× + algorithm reimplemented (Tier 1)
**Where:**
- `VexFlowRenderer.ts:49` — clean `CLEF_CONFIG` constant `{ treble: 34, bass: 22, alto: 28, tenor: 26 }`.
- `ScoreModel.ts:1694` — same table, hand-inlined.
- `MusicEngine.ts:1257` — same table, hand-inlined.

The *algorithm* "natural stem direction = `dPos >= middle ? up : down`" is also reimplemented in `MusicEngine.flipStemDirection` (~1263), `ScoreModel.resolveStemDirection` (~1690), and several spots in `VexFlowRenderer` (599–617, 1832–1838, 1999–2000).
**Fix:** move `CLEF_CONFIG` and a `naturalStemDirection(step, octave, clef)` helper into `utils/clefUtils.ts` (already exists, correct home). All three call sites import it. Single source of truth for a rule you never want three diverging copies of.

### 4.3 The `(measure, beat)` sort comparator — 3× verbatim (Tier 1)
**Where:** `MusicEngine.ts` at ~903, ~1037, and inside `toggleTie`.
**Pattern:**
```ts
.sort((a, b) => a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat))
```
**Fix:** export `compareByPosition(a, b)` from `utils/musicUtils.ts`. Notes are ordered constantly across the codebase; this will be reused widely.

### 4.4 Beat-quantization block — duplicated in two branches (Tier 1)
**Where:** `MusicEngine.getPositionFromPixels`, lines ~1481–1485 and ~1489–1493 — identical "round beat to nearest duration grid, clamp to bar" logic in both branches of an if/else.
**Fix:** extract `quantizeBeat(beat, duration, barQuarters)`.

### 4.5 "Fill a gap with rests, advancing the beat cursor" loop (Tier 2)
**Where:** `MusicEngine.ts:705–709` and `735–738`; the same shape recurs in `NoteEntryCoordinator` and `ScoreModel:2055`. The *splitter* (`splitBeatsIntoDurations`) is already shared; the *placement loop* (walk `currentBeat` forward, `addRest` per piece) is not.
**Fix:** a `ScoreModel.fillGapWithRests(measure, fromBeat, beats)` method. Consolidate with the existing `fillMeasureGaps` / `fillGapsWithRests` family and clarify which to reach for.

### 4.6 The cross-barline tie-split logic — the headline duplication (Tier 2)
**Where:** `NoteEntryCoordinator.splitExistingNoteWithTie` (709–788) and `addSplitNoteWithTie` (794–~890) are **near-identical twins**: both do *split into current/next-measure durations → ensure the next measure exists → erode the overflow zone → build a chain of tied notes across the barline*. They differ only in whether they update an existing note or create a fresh one. `MusicEngine.updateNote` (557–584) also drives this path.
**Why it matters most:** this is simultaneously a **length** problem (these are huge methods inside a 1028-line file) and a **duplication** problem, and it is the single highest-leverage structural change available — consolidating it shrinks *both* `NoteEntryCoordinator` and `MusicEngine`.
**Fix:** one `ScoreModel` (or dedicated `TieSplitter`) primitive, e.g. `placeSpanningNote(pitch, startMeasure, startBeat, totalBeats)`, that both entry and update call. The "existing vs. new first note" difference becomes a thin caller-side concern. **Verify behaviour parity carefully** (erosion + tie-chaining are subtle) and lean on the existing tie/rebar tests.

### 4.7 Highlight recolor idiom (Tier 2, optional)
**Where:** `HighlightController.ts` — ~13 `applyXxxHighlight()` / `applyXxxSelectionHighlight()` methods. The breadth (one per element type) is inherent, but the bodies repeat the same "grab SVG group, set fill/stroke to highlight colour, restore on clear" idiom.
**Fix:** a shared `highlightGroup(group, color)` primitive the per-type methods call. Reduces repetition without collapsing the legitimately type-specific parts.

---

## 5. File length — complete verdict

Length only matters when it signals a file doing too many jobs or hiding god-functions. Full assessment of every large file:

| File | Lines | Verdict |
|---|---|---|
| `VexFlowRenderer.ts` | 2813 | **Keep.** Long but cohesive — 59 small, single-purpose methods. Optional *future* seam: layout/width math (`calculateMeasureWidths`, `distributeLineWidths`, `calculateMinimumMeasureWidth`) → a `MeasureLayout` module. Split only if it keeps growing. |
| `ScoreModel.ts` | 2195 | **Keep.** The heart of the data model + rebar/tie/slur preservation invariants. Splitting would scatter tightly-coupled logic. |
| `MusicEngine.ts` | 1718 | **Shrink** — but via §4.1 + relocating the `updateNote` overflow logic (534–759, ~220 lines) into `ScoreModel`/a `NoteMutator`. A facade should be thin; today it isn't. |
| `MouseController.ts` | 1151 | **Decompose (Tier 2).** Not the line count — the handlers: `handleMouseDown` ~340 lines, `handleClick` ~180, `handleMouseMove` ~130. |
| `NoteEntryCoordinator.ts` | 1028 | **Decompose (Tier 2).** `addNoteAtPosition` is ~256 lines; `addNoteAtBeat` ~106. Also the home of the §4.6 tie-split twins. |
| `App.vue` | 935 | **Keep.** 513 template (palette breadth, inherent) + 342 script glue. Optional later: extract palette sub-components. Vue-specific, doesn't touch the agnostic core. |
| `ElementRegistry.ts` | 814 | **Keep.** Long by *breadth* (30+ query methods), all small and single-purpose. Optional seam: pitch↔pixel geometry helpers → a geometry module. |
| `HighlightController.ts` | 586 | **Keep length; dedupe internals** (see §4.7). |

**The only true length problems are `MouseController`, `NoteEntryCoordinator`, and `MusicEngine`'s update logic.** Everything else is big for legitimate reasons; splitting those would *hurt* readability.

---

## 6. Clean-code observations

### 6.1 Over-long functions (Tier 2)
The decomposition targets, concretely:
- **`MouseController.handleMouseDown` (~340 lines).** A long `if`-chain branching on tool + element-under-cursor, interleaving selection / pan / slur-handle-drag / clef-drag / paste in one scope. **Fix:** extract per-gesture private methods (the pattern is already started: `endClefDrag`, `endSlurHandleDrag`, `commitArmedPaste`). Each top-level handler becomes a ~20-line dispatcher. *Longer term*, a small **tool-strategy** shape (one object per tool with `onDown/onMove/onClick`) lets new tools drop in without touching the dispatcher — directly serving "scalable for future features."
- **`NoteEntryCoordinator.addNoteAtPosition` (~256 lines).** Decompose by stage (resolve target slot → check overflow → place-or-split → fill rests), reusing the §4.6 spanning-note primitive.

### 6.2 Fraction vs. float-epsilon inconsistency (Tier 3)
An exact `Fraction` type exists specifically to avoid float drift, yet there are **~106 `fracToNumber()` conversions** and **15 `> X + 0.001` epsilon comparisons** in the engine (`MusicEngine`, `NoteEntryCoordinator`, `KeyboardController`, `durations`, `VexFlowRenderer`). It works, but it is a conceptual inconsistency and a latent-bug source (the epsilon patches the very float round-trip the type was meant to eliminate). **Do not mass-convert now** — too risky for a working project. **Going-forward rule:** new comparisons use `fracCompare` / `fracEq`, not `0.001`; convert opportunistically when a function is already being touched.

### 6.3 Undo strategy (Tier 3 — watch only)
`runBatch` / `saveUndoState` serialize the entire score via `JSON.stringify` per action. Correct and simple; fine at current scale. Flagged only as the thing that will eventually bite on large scores — not a now-problem.

---

## 7. Recommended sequencing

Each step is independently shippable and test-guarded. Manual UI verification by the user after each, per workflow. No commits without explicit approval.

**Step 1 — Tier 1 (half a day, near-zero risk)**
1. Delete dead code: `linkTie` block + orphaned JSDoc (§3.1); `getNoteAtPosition` (§3.2).
2. Extract `commit()` helper, collapse the 29 triplets (§4.1).
3. Extract `compareByPosition` (§4.3) and `quantizeBeat` (§4.4).
4. Move `CLEF_CONFIG` + `naturalStemDirection` to `clefUtils`, update 3 call sites (§4.2).

→ Run unit tests; user smoke-tests entry, ties, stem-flip, selection.

**Step 2 — Tier 2: consolidate tie-split (highest leverage)**
5. Verify parity between the two tie-split twins, extract one `placeSpanningNote` primitive, route `NoteEntryCoordinator` + `MusicEngine.updateNote` through it (§4.6). Add `fillGapWithRests` (§4.5) along the way.

→ Heavy reliance on existing tie/rebar tests; careful manual test of cross-barline entry and duration-lengthening.

**Step 3 — Tier 2: decompose handlers**
6. Break up `MouseController` handlers into per-gesture methods (§6.1).
7. Break up `NoteEntryCoordinator.addNoteAtPosition` by stage (§6.1).
8. (Optional) `highlightGroup` primitive in `HighlightController` (§4.7).

**Step 4 — Tier 2: thin the facade**
9. Relocate `updateNote` overflow logic from `MusicEngine` into `ScoreModel`/`NoteMutator` (§5).

**Tier 3 — defer until a feature forces it**
- `VexFlowRenderer` layout split; `ElementRegistry` geometry split.
- Fraction-discipline rule for new code.
- Undo snapshot strategy.

---

## 8. Bottom line

This is not an architecture problem — it is a **housekeeping** problem on top of good bones. Steps 1–3 are behaviour-preserving, guarded by a real test suite, and would take the codebase from "clearly grown organically" to "clearly designed." Resist anything more invasive (data-model changes, undo rework, mass Fraction migration) until a concrete feature actually demands it. Above all, **preserve the framework-agnostic boundary** and **leave the legitimately-complex notation code alone.**
