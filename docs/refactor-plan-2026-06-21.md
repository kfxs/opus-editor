# Refactor Plan — opus-editor

**Date:** 2026-06-21
**Basis:** `docs/code-review-2026-06-21.md` (review), verified line-by-line against the live tree.
**Goal:** Make the codebase **maintainable, scalable, and readable by humans** — without destabilizing a working project and **preserving the framework-agnostic boundary**.

> **Ground rules (non-negotiable):**
> - **No commits or pushes without explicit permission.** Each step is staged for the user to review.
> - **Behaviour-preserving.** Every step is either pure addition (Tier 0) or a refactor verified by tests + the user's manual UI pass.
> - **Each step is independently shippable.** Stop after any step and the tree is green.
> - **The `src/interactions/` + `src/engine/` framework-agnostic boundary is sacred.** No Vue imports leak inward. Tier 0 makes this mechanical.
> - **Debug `console.*` logging stays** (intentional, dev-phase — see review §2.6).

---

## 0. How to read this plan

The work is four tiers. **Tier 0 is new** — it is scaffolding that makes Tiers 1–2 safe and makes the result durable for humans. Tiers 1–3 are the verified review findings.

| Tier | Theme | Risk | Effort |
|---|---|---|---|
| **0** | Safety net + human-readability scaffolding | ~zero (additive) | ~1 day |
| **1** | Dead code + small DRY extractions | very low | ~half day |
| **2** | Consolidate tie-split, decompose handlers, thin facade | medium (test-gated) | a few days |
| **3** | Watch-and-defer | n/a | only when a feature forces it |

Every step below has: **Scope** · **Files/lines** · **Approach** · **Test gate** · **Verify gate** · **Checkpoint**.

A **Test gate** = `npm run test` (and `npm run lint:boundary` once Step 0.1 adds it — the *scoped* boundary lint, not the full backlog-laden `lint`; see Step 0.1) must pass. A **Verify gate** = the specific manual UI checks the user runs (per workflow; the agent does not launch browsers). A **Checkpoint** = a natural stop where the tree is green and reviewable.

---

## Verification summary (what was confirmed before writing this)

Every review claim was checked at its actual location (line numbers drifted slightly after `193576f`). All major claims hold. Refinements folded into the steps below:

- **§3.1 `linkTie`** dead block is lines **815–844**; the closing `*/` at 844 is *also* `toggleTie`'s intended JSDoc — deletion must re-attach a doc to `toggleTie`.
- **§3.3 CoordinateMapper methods** are **not dead** — `pixelXToBeat`/`pixelYToPitch` are live fallbacks; only `getNoteAtPosition`'s use of `noteToPixel` goes away. → audit-then-leave.
- **§4.1** 29 `setScore`+`saveUndoState` pairs confirmed; there are **41** `saveUndoState` total → 12 are intentionally metadata-only (e.g. `setTempo` correctly has both). Needs `commit()` **and** `saveOnly()`, not a blind collapse.
- **§4.3** the cross-measure comparator is verbatim 3× (`MusicEngine` 867/908/1038); ~30 *other* `fracCompare(a.beat,b.beat)` sorts are **within-measure** and must be left alone.
- **§4.4** `quantizeBeat` block is verbatim (1481–1485 ≡ 1489–1493) and is **float math at the pixel boundary** — extract as float; do **not** Fraction-ify.
- **§4.6** the two tie-split methods (`splitExistingNoteWithTie` 709–788, `addSplitNoteWithTie` 794–883) are genuine twins; only difference is chain head (existing vs new note).
- **Type discipline is already good** (8 `any`, 8 non-null assertions, 0 `TODO/FIXME`) → no type-cleanup workstream needed.
- **Coverage gap:** `MouseController`, `VexFlowRenderer`, `HighlightController`, `KeyboardController` have **zero co-located tests** — this drives Tier 0.

---

## Do NOT change (preserved from review §2)

Leave these alone; "cleaning them up" reintroduces bugs:
- The defensive `repairAllMeasureGaps()` before render.
- The "read the side the renderer last drew" fallback in `flipSlur` / `flipTie`.
- The pending-tie / re-anchor-on-delete dance.
- `chooseVoiceMode` / cautionary-clef / cautionary-TS logic in the renderer.
- The internal (`Chord`/`NotePitch`/`Rest`/`ChordRest`) vs public flat `Note` model.
- The intentional debug logging.
- File length where it's breadth, not god-functions (`VexFlowRenderer`, `ScoreModel`, `ElementRegistry`, `App.vue`).

---

# Tier 0 — Safety net & human-readability scaffolding (NEW)

**Rationale:** The review's safety story is "guarded by tests," but the handlers it most wants to decompose are the *least* tested code in the repo, and the boundary it calls "sacred" is enforced only by discipline. And the stated goal — "readable by humans after this" — has no deliverable in the original doc (`docs/` is 10 historical plans, no architecture map). Tier 0 fixes all three. **It is purely additive: no production code changes, so it cannot break anything.** Do it first.

### Step 0.1 — Enforce the framework-agnostic boundary with lint
- **Scope:** Make the "sacred boundary" mechanical instead of aspirational — **without** turning on the whole `@typescript-eslint/recommended` rule set as a build gate.
- **Files:** `.eslintrc.json`, `package.json`.
- **⚠️ Pre-existing-noise reality (verified 2026-06-21):** Lint has **never** been wired up here (no `lint` script today). A first wholesale `eslint` run is **not** clean: `src/**/*.ts` alone reports **53 errors** (unused vars, `prefer-const`, `no-explicit-any` in test files) and **193 problems** (53 errors + 140 warnings) once `.vue` is included. **None of these are boundary violations** — the boundary itself *is* clean (0 `vue` imports in `src/engine/**` or `src/interactions/**`, confirmed). The risk is purely that folding a broad `lint` into `build:check` would immediately turn the build red on 53 unrelated pre-existing errors, violating the "each step leaves the tree green" ground rule. So the boundary rule must be added **scoped**, not as a wholesale lint turn-on.
- **Approach (scoped — keeps this step truly additive):**
  - Add an ESLint `no-restricted-imports` rule (built-in; `eslint-plugin-import`/`import/no-restricted-paths` is **not installed**, so use the built-in with path patterns): files under `src/interactions/**` and `src/engine/**` may not import `vue`, `@/composables/**`, or `@/App.vue`. (Note: `NoteEntryCoordinator` lives in `src/engine/`, not `src/interactions/` — both globs are covered, so no change needed.)
  - Add a **boundary-only** script that gates on *just* this rule, e.g. `"lint:boundary": "eslint \"src/{engine,interactions}/**/*.ts\" --rule '{\"no-restricted-imports\": ...}'"` (or a tiny dedicated flat/override config that disables everything except the restriction). This is the only lint that goes into `build:check`: `lint:boundary && vue-tsc --noEmit && vite build`.
  - Also add a full `"lint": "eslint . --ext .ts,.vue"` script for *informational* use, but **do NOT** put it in `build:check` yet — the 53 pre-existing errors are out of scope for this housekeeping pass (cleaning them is a separate, optional follow-up; many are in test files and several are intentional, e.g. `_event`/`_id` placeholder params).
  - Expected boundary-rule violations: **zero** (verified clean).
- **Test gate:** `npm run lint:boundary` passes (0 violations); `npm run test` unchanged. `build:check` stays green because only the boundary rule gates it.
- **Verify gate:** none (no runtime change).
- **Checkpoint:** ✅ Boundary now fails the build on a `vue`-leak, with **no** dependency on first cleaning the unrelated lint backlog. Independent commit candidate.
- **Optional follow-up (NOT part of Tier 0):** burn down the 53 pre-existing errors (auto-`--fix` handles `prefer-const` + a couple; the rest are unused-var/`any` judgement calls), then promote the full `lint` into `build:check`. Defer until someone wants it.

### Step 0.2 — Characterization tests for the untested decomposition targets
- **Scope:** Capture *current* behaviour of `MouseController` and `KeyboardController` as executable specs **before** they are decomposed in Tier 2. (These pin the quirks too — that is the point.)
- **Files (new):** `src/interactions/MouseController.test.ts`, `src/interactions/KeyboardController.test.ts`.
- **Approach:**
  - Drive each controller through its public entry points (`handleMouseDown/Move/Up/Click`, key handlers) with fake events against a real-or-stubbed `EditorState` + `MusicEngine`.
  - Assert observable outcomes (engine calls, selection state, tool transitions) — not internals — so the tests survive the refactor.
  - Prioritise the gestures Tier 2 will move: selection, pan-arming, slur-handle drag, clef drag, armed-paste, note entry on click. Aim for the high-traffic paths, not 100% coverage.
- **Test gate:** new tests pass against current code (they describe *what is*, not what should be).
- **Verify gate:** none.
- **Checkpoint:** ✅ The riskiest Tier 2 work is now net-protected. **This step is a hard prerequisite for Tier 2 Step 6.**
- **Note:** `VexFlowRenderer`/`HighlightController` decomposition is *not* scheduled in this plan (they stay), so they don't need characterization tests now. If that changes, add them first.

### Step 0.3 — Living architecture + domain glossary (the human-readability deliverable)
- **Scope:** Give a human a map. This is the single biggest "readable after this" win and is absent today.
- **Files (new):** `docs/ARCHITECTURE.md` (+ a glossary section, or `docs/GLOSSARY.md`).
- **Approach:**
  - **ARCHITECTURE.md:** the layer map (`App.vue` → composables → interactions → engine → models/rendering/audio/registry), the dependency-direction rule, the framework-agnostic boundary (link to the lint rule from 0.1), and a "where does X live?" table.
  - **Glossary:** define the model vocabulary that is currently tribal knowledge — `slot`, `ChordRest`, `NotePitch`, `Rest`, flat `Note` (public projection), beat-as-`Fraction`, written-vs-sounding, "voice-ready", rebar, erosion, pending-tie. This is the hardest thing for a newcomer to learn and the review only praised it, never documented it.
  - Optionally add a one-line "status" note pointing at the `docs/*-plan.md` files as *historical* records, so the docs folder reads clearly.
- **Test gate:** none (docs).
- **Verify gate:** user readability sanity-check.
- **Checkpoint:** ✅ Onboarding artifact exists.

### Step 0.4 — Name the magic numbers & write down the Fraction/float invariant
- **Scope:** Two cheap readability wins the review didn't cover.
- **Files:** the modules holding the constants; a short section in `ARCHITECTURE.md` (or top-of-file comments).
- **Approach:**
  - Give names to scattered magic numbers: hit tolerance `10`, `epsilon = 0.001`, tie-split `attempts = 20`, `bbox.width * 1.5` nearest-element threshold. Top-of-module named consts (don't over-centralise into one global file unless a value is shared).
  - Document the **Fraction/float invariant** as a stated rule: *"`beat` is an exact `Fraction` everywhere except at the pixel boundary, where `quantizeBeat()` returns a float and `beatToFrac()` re-enters exact land."* This converts review §6.2's latent inconsistency into a documented boundary.
- **Test gate:** `npm run test` (renaming a literal to a named const with the same value is behaviour-preserving).
- **Verify gate:** none.
- **Checkpoint:** ✅ End of Tier 0.

---

# Tier 1 — Dead code & small DRY extractions

Mechanical, low-risk, test-guarded. Removes ~80–100 lines and creates reusable primitives. Order within the tier is free; group into one or two checkpoints as convenient.

### Step 1.1 — Delete dead code
- **Scope:** Remove the `linkTie` block and the legacy `getNoteAtPosition`.
- **Files/lines:**
  - `MusicEngine.ts` **815–844** — two orphaned JSDoc headers + the commented `linkTie` body. **Refinement:** lines 840–844 are `toggleTie`'s intended JSDoc trapped inside the comment — after deleting, **re-attach a proper JSDoc to `toggleTie` (≈845).**
  - `MusicEngine.ts` **~1141–1161** — `getNoteAtPosition` (zero callers; all hit-testing flows through `ElementRegistry`). Also remove its entry from `CLAUDE.md`'s API list.
- **Approach:** delete; confirm no references (verified: none).
- **Test gate:** `npm run test` + `npm run lint:boundary`.
- **Verify gate:** smoke-test note selection / hit-testing still works.
- **Checkpoint:** ✅

### Step 1.2 — `commit()` + `saveOnly()` helpers (review §4.1)
- **Scope:** Collapse the 29 `setScore`+`saveUndoState` pairs; make the playback-resync decision explicit.
- **Files:** `MusicEngine.ts`.
- **Approach:**
  ```ts
  /** Sync playback with the score, then snapshot for undo. Use for any score mutation. */
  private commit(description: string): void {
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState(description)
  }
  /** Snapshot for undo WITHOUT playback resync. Use only for non-audible metadata. */
  private saveOnly(description: string): void {
    this.saveUndoState(description)
  }
  ```
  - Replace the **29** pairs with `this.commit(...)`.
  - For the **12** `saveUndoState`-only sites, audit each: if it affects audible output → `commit()`; if truly metadata → `saveOnly()` (explicit, not accidental). This audit is the bug-prevention value of the change.
- **Test gate:** `npm run test`.
- **Verify gate:** play after add/edit/delete; confirm playback matches the score (the desync class this guards against).
- **Checkpoint:** ✅

### Step 1.3 — `compareByPosition` comparator (review §4.3)
- **Scope:** Extract the **cross-measure** note comparator (verbatim 3×).
- **Files:** add to `utils/musicUtils.ts`; call sites `MusicEngine.ts` 867, 908, 1038.
- **Approach:**
  ```ts
  export const compareByPosition = (a: {measure:number;beat:Fraction}, b: typeof a) =>
    a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat)
  ```
  - **Refinement:** apply **only** to the 3 cross-measure sites. Do **not** touch the ~30 within-measure `fracCompare(a.beat, b.beat)` sorts — they have no measure tiebreak by design.
- **Test gate:** `npm run test`.
- **Verify gate:** none beyond suite.
- **Checkpoint:** ✅

### Step 1.4 — `quantizeBeat` helper (review §4.4)
- **Scope:** Extract the duplicated quantization block from both branches of `getPositionFromPixels`.
- **Files:** `MusicEngine.ts` (lines 1481–1485 ≡ 1489–1493); helper home `utils/musicUtils.ts` or `utils/durations.ts`.
- **Approach:**
  ```ts
  // Float by design — operates at the pixel boundary (see Fraction/float invariant).
  export function quantizeBeat(beat: number, duration: NoteDuration, barQuarters: number): number {
    const d = durationToBeats(duration)
    return Math.max(0, Math.min(Math.round(beat / d) * d, barQuarters - d))
  }
  ```
  - **Refinement:** keep it float. Do not convert to `Fraction` (that's Tier 3 and out of scope).
- **Test gate:** `npm run test`.
- **Verify gate:** click-to-place a note off-grid; lands on the expected quantized beat.
- **Checkpoint:** ✅

### Step 1.5 — Centralise clef table + stem-direction rule (review §4.2)
- **Scope:** Single source of truth for the clef middle-line table and the natural-stem rule.
- **Files:** `utils/clefUtils.ts` (home); call sites in `VexFlowRenderer.ts` (49, 317, 599, 1832, 1999), `ScoreModel.ts` (1690, 1694), `MusicEngine.ts` (1257–1263).
- **Approach:**
  - Move `CLEF_CONFIG` (`{ treble:34, bass:22, alto:28, tenor:26 }`) into `clefUtils.ts`.
  - Add `naturalStemDirection(step, octave, clef)` implementing `dPos >= middle ? down : up` (match the existing convention exactly).
  - Replace the 3 inlined tables and the reimplemented algorithm spots with imports.
- **Test gate:** `npm run test` (stem direction is well-covered).
- **Verify gate:** add notes above/below the middle line in each clef; stems point correctly; flip-stem (`x`) still works.
- **Checkpoint:** ✅ End of Tier 1.

---

# Tier 2 — Structural consolidation (test-gated)

Higher value, behaviour-preserving, but subtle. **Do not start Tier 2 Step 6 until Tier 0 Step 0.2 is done.** Lean hard on tests; careful manual passes.

### Step 2.1 — Consolidate the cross-barline tie-split (review §4.6) — **highest leverage**
- **Scope:** Replace the twin methods with one primitive; route entry **and** update through it. Shrinks both `NoteEntryCoordinator` and `MusicEngine`.
- **Files:** `NoteEntryCoordinator.ts` `splitExistingNoteWithTie` (709–788) + `addSplitNoteWithTie` (794–883); `MusicEngine.updateNote` overflow path (534–757); new primitive in `ScoreModel.ts` (or a dedicated `TieSplitter`).
- **Approach:**
  - Introduce `placeSpanningNote({ step, alter, octave, startMeasure, startBeat, totalBeats, existingHeadId? })` that does: split into current/next durations → ensure next measure exists → `erodeOverflowZone` → build the tied chain. The **existing-vs-new chain head** difference (the *only* real divergence) becomes the optional `existingHeadId` param.
  - Route `addSplitNoteWithTie` and `splitExistingNoteWithTie` and `MusicEngine.updateNote` through it.
  - Fold the rest-fill placement loop into `ScoreModel.fillGapWithRests(measure, fromBeat, beats)` along the way (review §4.5; sites `MusicEngine` 706/735, `ScoreModel` 2055).
  - **Verify behaviour parity carefully** — erosion + tie-chaining are subtle. Diff the two original methods first and enumerate every difference before merging.
- **Test gate:** existing tie/rebar tests are the spine; add cases if a parity gap is found.
- **Verify gate:** cross-barline note entry; lengthening a note past the barline (update path); dotted-note splits; entry into an occupied next measure (erosion).
- **Checkpoint:** ✅ (Big one — natural place to pause.)

### Step 2.2 — Decompose `MouseController` handlers (review §6.1)
- **Prerequisite:** Tier 0 Step 0.2 characterization tests exist and pass.
- **Scope:** Break the long handlers into per-gesture private methods; optionally seed the tool-strategy shape.
- **Files:** `MouseController.ts` — `handleMouseDown` (314–656, ~342 lines), `handleClick` (772–953, ~181), `handleMouseMove` (953–…).
- **Approach:**
  - Extract per-gesture methods (pattern already started: `endClefDrag`, `endSlurHandleDrag`, `commitArmedPaste`). Each top-level handler becomes a ~20-line dispatcher.
  - **Scalability option:** introduce a small **tool-strategy** shape — one object per tool with `onDown/onMove/onClick` — so new tools drop in without editing the dispatcher. This is the most scalability-relevant change for the tool-heavy roadmap (hand/pan, zoom, dynamics). Treat as optional within this step; if risk is high, ship the plain extraction first and add the strategy layer as a follow-up.
- **Test gate:** the 0.2 characterization tests must stay green (that's their whole job).
- **Verify gate:** full interaction sweep — select, multi-select, drag-pan, slur-handle drag, clef drag, paste, note entry per tool.
- **Checkpoint:** ✅

### Step 2.3 — Decompose `NoteEntryCoordinator.addNoteAtPosition` (review §6.1)
- **Scope:** Split the ~256-line method by stage.
- **Files:** `NoteEntryCoordinator.ts` `addNoteAtPosition` (151–…).
- **Approach:** decompose into resolve-target-slot → check-overflow → place-or-split → fill-rests, **reusing `placeSpanningNote` from Step 2.1.**
- **Test gate:** `NoteEntryCoordinator.test.ts` (exists).
- **Verify gate:** note entry across grid positions, overflow, rest-fill.
- **Checkpoint:** ✅

### Step 2.4 — Thin the facade: relocate `updateNote` overflow logic (review §5)
- **Scope:** Move the ~220-line overflow body out of the facade.
- **Files:** `MusicEngine.updateNote` (534–757) → `ScoreModel`/`NoteMutator`.
- **Approach:** relocate the overflow/split logic (now largely `placeSpanningNote` after Step 2.1) so `MusicEngine.updateNote` is a thin delegator + `commit()`.
- **Test gate:** `MusicEngine.test.ts`, tie/rebar tests.
- **Verify gate:** duration lengthening, chord-duration changes, tie removal on shorten.
- **Checkpoint:** ✅

### Step 2.5 — `highlightGroup` primitive (review §4.7, optional)
- **Scope:** Dedupe the recolor idiom across `HighlightController`'s ~13 `applyXxx` methods.
- **Files:** `HighlightController.ts`.
- **Approach:** extract `highlightGroup(group, color)` that the per-type methods call; keep the legitimately type-specific parts.
- **Test gate:** no co-located test today — **rely on manual verify** (note this honestly; add a small test if cheap).
- **Verify gate:** selection/hover highlight on notes, rests, clefs, dynamics, TS, slurs, ties — and clear/restore.
- **Checkpoint:** ✅ End of Tier 2.

---

# Tier 3 — Watch-and-defer (do NOT do now)

Act only when a concrete feature forces it. Recorded so the decisions are explicit.

- **`VexFlowRenderer` layout split** — optionally extract width math (`calculateMeasureWidths`, `distributeLineWidths`, `calculateMinimumMeasureWidth`) into a `MeasureLayout` module. Only if the file keeps growing.
- **`ElementRegistry` geometry split** — pitch↔pixel helpers → a geometry module. Only on growth.
- **Fraction discipline (review §6.2)** — `fracToNumber` appears 106×. **Going-forward rule (documented in Tier 0.4):** new comparisons use `fracCompare`/`fracEq`, not `0.001`; convert opportunistically when a function is already being touched. No mass migration.
- **Undo strategy (review §6.3)** — `JSON.stringify` per action is correct and simple; fine at current scale. Revisit only if large scores get slow.
- **Full re-render per edit** — standard for a notation editor; not worth optimising until profiling says so.

---

# Recommended sequencing

1. **Tier 0** (additive, ~zero risk): 0.1 lint boundary → 0.2 characterization tests → 0.3 architecture+glossary → 0.4 constants+invariant.
   → *Tier 0 can land in any order, but 0.2 must precede Tier 2 Step 2.2.*
2. **Tier 1** (half a day): 1.1 dead code → 1.2 `commit`/`saveOnly` → 1.3 `compareByPosition` → 1.4 `quantizeBeat` → 1.5 clef/stem.
   → Run tests + `lint:boundary` (the scoped gate from 0.1, not the full backlog `lint`); user smoke-tests entry, ties, stem-flip, selection.
3. **Tier 2 Step 2.1** (tie-split, highest leverage): heavy reliance on tie/rebar tests; careful manual cross-barline + lengthening test.
4. **Tier 2 Steps 2.2–2.3** (handler/entry decomposition): gated on 0.2.
5. **Tier 2 Step 2.4** (thin the facade), **2.5** (highlight, optional).
6. **Tier 3** — defer.

---

# Bottom line

This is a **housekeeping** problem on good bones, plus three things the original review didn't cover that the "readable by humans, scalable" goal actually needs: **a real safety net where the refactor targets are untested (0.2)**, **a mechanical guard for the boundary it calls sacred (0.1)**, and **the human-facing architecture/glossary that makes the whole exercise stick (0.3–0.4)**. With Tier 0 in front, Tiers 1–2 are behaviour-preserving and genuinely safe. Resist anything more invasive (data-model changes, undo rework, mass Fraction migration) until a concrete feature demands it. Above all: **preserve the framework-agnostic boundary** and **leave the legitimately-complex notation code alone.**
