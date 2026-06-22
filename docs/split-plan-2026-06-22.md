# File-Split Plan — opus-editor

**Date:** 2026-06-22
**Basis:** Line-by-line read of the large files + a coupling audit (which instance
state each method cluster actually touches), 2026-06-22.
**Goal:** Reduce the cognitive load of the few oversized files by splitting them
along **real seams of low coupling**, so a developer can find and understand one
sub-domain without loading the whole file — **without** destabilising a working
project and **preserving the framework-agnostic boundary**.

> This is the follow-up the `refactor-plan-2026-06-21` deliberately deferred. That
> pass shortened the worst *functions*; it did not split the big *files* (and two
> of them grew). This plan addresses file-level modularity specifically.

---

## Ground rules (non-negotiable)

- **No commits or pushes without explicit permission.** Each step is staged for review.
- **Behaviour-preserving.** Every step is a pure relocation guarded by tests + the
  user's manual UI pass. Rendering output and engine behaviour are identical before/after.
- **One module at a time. Each step independently shippable and revertable.** Stop
  after any step and the tree is green.
- **Public API surface is preserved.** `MusicEngine` (the facade) and `ScoreModel`'s
  public methods stay; extracted logic sits *behind* them as thin delegators. Callers
  are not rewritten in the same step that moves logic.
- **The `src/interactions/` + `src/engine/` framework-agnostic boundary is sacred.**
  Everything here stays in `engine/` / `utils/`; `npm run lint:boundary` still guards it.
- **Debug `console.*` logging stays** (intentional, dev-phase).

---

## Principles (why these splits and not others)

1. **Split along low-coupling, change-together seams — never by line count alone.**
   The win is "a file you rarely need to open," not "a smaller number." A focused
   400-line module beats a 200-line one entangled with five others.
2. **Extract collaborators that operate on passed-in state.** Do not share mutable
   instance fields across files — that turns a split into spaghetti.
3. **Match the existing idiom.** `utils/rebar.ts`, `utils/restFill.ts`, `utils/meter.ts`
   are already pure modules `ScoreModel` delegates to. New extractions follow that shape.
4. **Leave genuinely-tangled code whole.** Cohesion you would destroy by splitting is
   a reason *not* to split.
5. **Sequence by safety.** Lowest-risk, highest-clarity extractions first; reassess
   before touching the harder ones. You may stop early and still have most of the win.

### Coupling audit (the facts this plan rests on)

- **`ScoreModel` has exactly one instance field: `score`.** Every method is a function
  over `this.score`. Sub-modules just take `score` (or a `measure`) as a parameter →
  **ScoreModel is the safest file to split.**
- **`VexFlowRenderer` has 13 instance fields**; its sub-renderers *write* into shared
  per-render maps (`staveNoteMap`, `slurGroupMap`, `dynamicObjectMap`, `tupletObjectMap`,
  `measureBounds`) and draw to a `context` rebuilt each render → extractions need a
  per-render context object first (step B0). **Caveat:** those maps are not purely
  transient — they're also the renderer's *persistent post-render lookup tables*, read
  after the render by public accessors (see B0). The RenderPass must reference them, not
  replace them.
- The renderer's **width/layout math touches almost no instance state** (cleanest seam)
  but is coupled to the note-builders, so it comes out paired with a small `NoteBuilder`.

### Module-home convention (set up front)

- **Stateful orchestration over the score** → `src/engine/models/` (next to `ScoreModel`).
- **Genuinely pure helpers** (no mutation, inputs → output) → `src/utils/` (with `rebar`/`restFill`).
- **Rendering collaborators** → `src/engine/rendering/` (next to `VexFlowRenderer`).

---

## Priority map

| Target | Lines | Splittability | Risk | Value | Verdict |
|---|---|---|---|---|---|
| **ScoreModel** | 2208 | High (1 field) | Low | High | **Tier A — do first** |
| **VexFlowRenderer** | 2798 | Medium (needs render-context) | Medium | High | **Tier B — second, selective** |
| **MouseController** | 1293 | Medium (tool-strategy) | Medium-High | Medium | Tier C — defer to next tool |
| **MusicEngine** | 1393 | Low (already a facade) | Low | Low | Opportunistic only |
| **App.vue** | 935 | High (Vue components) | Low | Medium | Separate Vue track |
| **ElementRegistry** | 814 | Medium | Low | Low | Defer until it grows |

---

# Tier A — ScoreModel (do first; lowest risk, idiomatic)

ScoreModel does ~6 distinct jobs over one `score` object. Extract the independent
sub-APIs as modules; ScoreModel keeps its public methods as one-line delegators.

### A1 — Clef operations → `engine/models/clefOps.ts` *(pilot)*
- **Scope:** the **mutating** clef sub-API: `setClefAt`, `removeClefAt`, `moveClef`,
  `moveClefWithinMeasure`, `normalizeClefAt`, `upsertClefChange`, `removeClefChangeAt`
  (~10 methods, ~145 lines, ScoreModel.ts:228–373).
  - **Note: the read-side is already extracted.** `getEffectiveClef`/`getEffectiveClefAt`
    are *already* one-line delegators to pure functions in `utils/clefUtils.ts`
    (`effectiveClefAt`, `measureOpeningClef`, `effectiveClefBefore`, `measureClefChanges`…).
    Don't re-wrap them — leave them as-is, or have `clefOps.ts` re-export from `clefUtils`.
    This is why the real extractable chunk is the mutators only (smaller than it first looks).
- **Coupling:** reads/writes `measure.clefs` only (typed `clefs?: ClefChange[]` in
  `types/music.ts` — **not** `measure.clefChanges`, which does not exist). **Lowest-risk
  extraction in the codebase.** Use it to prove the pattern and the test/verify loop.
- **Approach:** move the bodies to free functions taking `(score, …)`; ScoreModel methods
  delegate. No caller changes.
- **Test gate:** `npm run test` (+ `lint:boundary`). **Verify gate:** add/move/delete a
  mid-measure clef in each clef type; cautionary clef at line break renders.
- **Checkpoint:** ✅ pilot complete.

### A2 — Tuplet operations → `engine/models/tupletOps.ts`
- **Scope:** `createTuplet`, `getTuplet`, `getTupletAtBeat`, `getNotesInTuplet`,
  `refillTupletRemainder`, `deleteTuplet` (~140 lines).
- **Coupling:** localized to tuplet slots; low.
- **Test gate:** tuplet tests. **Verify gate:** create/delete a triplet; refill remainder.
- **Checkpoint:** ✅

### A3 — Flat-note projection → `engine/models/noteProjection.ts`
- **Scope:** `toFlatNote`, `restToFlatNote` (internal `ChordRest` → public `Note`).
- **Why:** small, pure, used widely; a named home documents the public/internal boundary.
- **Test gate:** suite (projection is exercised everywhere). **Verify gate:** none beyond suite.
- **Checkpoint:** ✅

### A4 — Rebar/tie/slur *preservation* orchestration → `engine/models/RebarOrchestrator.ts` *(borderline; do last, decide with eyes open)*
- **Scope:** `rebarRegion`, `captureBoundaryTies`/`restoreBoundaryTies`,
  `captureSlurs`/`restoreSlurs`, `materializeBar`, `materializeAtomicPiece`,
  `linkRebarTies`, `repairDanglingTies`/`repairDanglingSlurs` (~600 lines — the single
  biggest chunk).
- **Coupling:** tightly threaded (one rebar runs through all of it) — **but** it is a
  distinct subsystem with a clear entry point (`rebarRegion`/`pasteEvents`), and its
  pure-planning half already lives in `utils/rebar.ts`. Extracting the *orchestration*
  half (operating on `score`) is feasible.
- **Caution:** this is the code prior review said "leave alone." Do **not** bundle it with
  A1–A3. Live with A1–A3 first, then decide whether the ~600-line reduction is worth the care.
- **Test gate:** the full tie/rebar/slur-preservation suite is the spine; add cases if a
  parity gap surfaces. **Verify gate:** TS change with rebar across ties+slurs; paste
  across barlines; shrink/grow regions.
- **Checkpoint:** ✅ end of Tier A.

**Net:** ScoreModel ~2208 → ~1100–1300 **only if A4 (~600 lines) is taken**. A1–A3 alone
remove ~340 lines (~145 + ~140 + ~50) → ScoreModel lands near **~1870**. A1–A3 are an easy,
high-clarity win at near-zero risk; the deeper ~1300 target needs A4.

---

# Tier B — VexFlowRenderer (second; selective; one enabling step first)

Separable, but only after the per-render state is bundled.

### B0 — Enabling step: `RenderPass` context object
- **Scope:** bundle the per-render state into one `RenderPass` object created at the top
  of `renderScore` and threaded through the sub-renderers. The full set (8 items, **not**
  6): `context`, `staveNoteMap`, `tupletObjectMap`, `dynamicObjectMap`, `slurGroupMap`,
  `measureLayoutInfo`, `measureBounds`, `elementRegistry`. (The earlier draft omitted
  `tupletObjectMap` and `measureBounds`, both per-render and both consumed by the
  sub-renderers being extracted — e.g. tuplet rendering needs `tupletObjectMap`, B1 ties
  needs `staveNoteMap`.)
- **⚠ Lifetime gotcha — this is NOT pure transient plumbing.** Most of these maps are read
  *after* the render finishes, by public accessors that external collaborators call:
  - `getMeasureBounds` (`measureBounds`) → CoordinateMapper / pixel↔position
  - `getStaveNoteSVGGroup`, `getSlurSVGGroup`, `getTupletSVGGroup`, `getDynamicSVGGroup`
    → drag handlers + highlight
  - `renderPendingTie` (`staveNoteMap`) → tie preview
  - `elementRegistry` → the authoritative hit-test registry read by ElementRegistry/MusicEngine
  So a literal "fresh maps inside the pass, sub-renderers populate them" **breaks those
  getters**, because the instance fields they read would no longer be the populated copy.
  **Required design:** the maps stay instance fields (the canonical post-render home); the
  `RenderPass` carries *references* to those same map instances into the sub-renderers
  (alternatively, store `this.lastPass` and route the getters through it). Either way the
  post-render lookup surface must keep pointing at the populated maps. Only `context` is
  genuinely per-render-transient.
- **Why:** prerequisite that makes B1–B4 clean instead of leaky.
- **Risk:** plumbing on the hot path, **plus** the lifetime mismatch above — the one real
  trap in this tier. Lean on identical rendering output AND on the post-render accessors
  still resolving (drag a slur/note/dynamic, hit-test after render).
- **Test gate:** suite. **Verify gate:** full render unchanged (notes, beams, ties, slurs,
  dynamics, clefs, TS, line breaks) **and** post-render interactions intact (click-to-select,
  drag a slur handle, drag a clef, pixel→position mapping).
- **Checkpoint:** ✅

### B1 — Tie rendering → `rendering/TieRenderer.ts`
- **Scope:** `getTieDirection`, `drawFlatTie`, `renderTies` (~170 lines). Takes `RenderPass`.
- **Verify gate:** ties within/across barlines; flat ties; flip-tie (`x`); pending-tie preview.
- **Checkpoint:** ✅

### B2 — Slur rendering → `rendering/SlurRenderer.ts`
- **Scope:** `slurEndpointY`, `slurArchCps`, `renderSlurs`, `drawCurveArc`,
  `measureOfNoteId` (~200 lines).
- **Verify gate:** slurs above/below, nested, dragged handles, flip side (`x`), split slurs.
- **Checkpoint:** ✅

### B3 — Dynamics layout → `rendering/DynamicsLayout.ts`
- **Scope:** `attachDynamicsToSlots`, `layoutCoLocatedDynamics`, `buildDynamicAnnotation`,
  `registerDynamics` (~140 lines).
- **Verify gate:** p/mp/mf/f + custom text placement, co-located dynamics, edit overlay.
- **Checkpoint:** ✅

### B4 — Measure-width math → `rendering/MeasureLayout.ts` *(do last in tier)*
- **Scope:** `calculateMeasureWidths`, `distributeLineWidths`, `calculateMinimumMeasureWidth`
  (~190 lines) — the seam prior review already named.
- **Coupling:** cleanest re: instance state, **but** coupled to the note-builders
  (`createStaveNotesFromSlots`, `chooseVoiceMode`, `createTupletsForMeasure`) → likely
  comes out paired with a small `NoteBuilder` module those share.
- **Verify gate:** line breaks, measure widths across TS changes, cautionaries, zoom.
- **Checkpoint:** ✅ end of Tier B.

**Leave whole:** the core `renderMeasure` / `buildAndDrawStave` / voice-mode /
cautionary-clef-and-TS path — the tightly-coupled heart of one render.

**Net:** VexFlowRenderer ~2798 → ~1800–1900 core + 4 focused renderers. Visual-regression
surface is real → this tier leans hardest on the manual verify.

---

# Tier C — deferred (with honest reasons)

- **MouseController (1293):** the often-cited move is the **tool-strategy pattern** (one
  module per tool: `onDown/onMove/onClick`). **Deferred — and the trigger is narrower than
  "the next tool."** Interactions come in three kinds, and only one wants this pattern:

  | Kind | Example | How it's wired today | Wants tool-strategy? |
  |---|---|---|---|
  | **Viewport command** | zoom | `window` wheel listener in `App.vue` + key shortcuts, outside the dispatcher | No |
  | **Cross-cutting gesture** | pan | one shared handler in MouseController, armed on empty-space press in *any* mode (`armPan` + `PAN_THRESHOLD_PX` tap-vs-pan) | No |
  | **Modal tool** | select vs entry vs **eraser** | *same* gesture, *different* meaning per mode | **Yes** |

  The pattern is for the bottom row only: **when pointer-down on the same spot means
  different things depending on the active mode.** Zoom and pan are the opposite — they
  behave the same regardless of mode, which is exactly why they slotted in cleanly *without*
  the pattern (zoom entirely outside MouseController; pan as one shared gesture, not N
  per-mode branches). So zoom + pan **already shipping is not evidence the pattern is
  overdue** — they're not modal tools. The real trigger is a genuinely *modal* tool (the
  classic is an **eraser**: click-note = delete, drag = sweep-delete, reusing the gestures
  that mean select/place elsewhere). Add that and one gesture forks ≥3 ways → the strategy
  layer earns its keep. Until then, defer; reshaping event routing is behaviour-sensitive
  and the characterization tests are new.

  *Separate note:* pan's ~6-method state machine is part of why MouseController is 1293
  lines, but the fix for **that** is **not** tool-strategy (pan is cross-cutting, it can't
  live in one tool's strategy object) — it's extracting pan into its own `PanGesture` helper
  (a Tier-B-style "extract a collaborator" split). Different problem, different tool.
- **MusicEngine (1393):** already a thinned facade; long-but-delegating is acceptable for a
  facade. Extract only opportunistically (e.g. remaining pixel/coordinate helpers) if in there anyway.
- **App.vue (935):** legitimate, but a **separate Vue-component track** (extract palette
  sub-components) that doesn't touch the agnostic core. Do it when the template, not the
  logic, is the bottleneck.
- **ElementRegistry (814):** breadth, not depth (30+ small query methods). Has a geometry
  seam, no pain yet. Defer.

---

# Recommended sequencing & stopping point

1. **A1 (clef ops)** — pilot: smallest, safest; proves the pattern and the loop.
2. **A2, A3** — finish the easy ScoreModel wins.
3. **Pause & reassess.** ScoreModel at ~1870 (A1–A3 done; A4 not yet) may already be
   comfortable → a legitimate stop. (Reaching ~1300 requires A4; see Tier A net.)
4. **B0 → B1 → B2 → B3 → B4** if VexFlowRenderer is still the file that hurts.
5. **A4 (rebar orchestration)** only if you want ScoreModel under ~1000 and accept the care.
6. **Tier C** — only when a feature forces it.

**Recommended scope:** do **Tier A fully** (safe, idiomatic, high-clarity) and **B0–B2**
(ties/slurs are the most self-contained renderer pieces). That brings both 2000+ line files
down meaningfully with controlled risk. Resist a big-bang split — "one module, verify,
repeat" is the whole discipline.

---

# Bottom line

This is **modularity housekeeping on good bones.** The coupling audit says the work is
safer than it looks where it matters most (ScoreModel = one field) and needs one enabling
step where it doesn't (the renderer's `RenderPass`). Do the safe half, stop and reassess,
and only take the tangled chunks (A4, MouseController) when you've lived with the easy wins
and a concrete need justifies the care. Above all: behaviour-preserving, public API intact,
boundary sacred, one revertable step at a time.
