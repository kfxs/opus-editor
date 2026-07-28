# Modularity Plan — the Spine Pass (2026-07-28)

Branch: `refactor/review-2026-07` (continues after Phase 6, `c52f48e`).

Outcome of a third full code review, this one asked for directly: *"the files are also growing in
number of lines and that makes it difficult for humans to read… how can we make the large files more
modular — not splitting for the sake of splitting, no line limit, but easy to follow the flow."*

Baseline, measured 2026-07-28: **2,546 tests green** (651 suites, 118 files), **23 E2E**,
`tsc --noEmit` clean, all four `build:check` gates clean. 170 source modules, 55,521 source lines +
31,131 test lines.

> **Amended 2026-07-28, after reading the plan back against the code.** Every measurement in §1–§5
> re-verified and stands (the co-change table is exact to all eleven rows; the element handlers
> really are the same five lines). The **phases** did not all survive contact: Phase 2 crossed a
> layer arrow no lint watches, Phase 1's one-interface table cannot be built over a union whose kinds
> are not all click-resolved, Phase 3's clusters were picked by line span rather than by name, and
> Phase 4 spiked the three cases that would have proved nothing. Each amendment is marked
> **`AMENDED`** inline, with what was checked.

The 2026-07-27 pass (`docs/refactor-plan-2026-07-27.md`) was about *shape* — where feature `n+1`
costs more than feature `n` — and it ended by writing down the rule. This pass is about the part of
that cost the rule **does not** reach.

---

## The argument

### 1. The line counts are not measuring what they look like

| file | lines | comment | blank | **code** |
|---|---|---|---|---|
| `rendering/VexFlowRenderer.ts` | 3,744 | 1,508 | 269 | **1,967** |
| `models/ScoreModel.ts` | 3,637 | 1,310 | 287 | **2,040** |
| `MusicEngine.ts` | 3,256 | 1,392 | 294 | **1,570** |
| `interactions/MouseController.ts` | 2,566 | 786 | 180 | **1,600** |
| `interactions/PaletteController.ts` | 2,201 | 989 | 156 | **1,056** |
| `types/music.ts` | 1,427 | 1,054 | 56 | **317** |

40–74% of every "big file" is prose, and it is the good kind — the `openGroup` prefix trap, the
`save()`/`restore()` history, why a two-note tremolo does *not* stretch its stems, the two-pass
cross-barline beam plan. Those comments are the reason this codebase is recoverable at all.

⭐ **Decision taken 2026-07-28 (his call): the comments stay exactly where they are.** Moving the
long "why" narratives to `docs/` was raised in review and declined. Nothing in this plan relocates a
comment; when code moves to a new module, its comments move with it, unchanged.

So the difficulty is **navigation, not logic volume**. `MusicEngine` holds 199 methods in 1,570
lines of code — **98 of them are ≤2-statement delegations.** You scroll sixty lines of well-argued
reasoning to reach `return this.scoreModel.getNote(id)`. Any fix aimed at "too much logic in one
file" is aimed at the wrong target.

### 2. The rule works. The spine tax is what it does not cover

Module count over the last 300 commits: **70 → 113 → 137 → 149 → 170**. New logic genuinely lands in
new modules. The rule is not failing.

But look at what one feature costs. `A fanned beam is one note, drawn as many` — 24 files,
2,035 insertions:

```
NEW MODULES — the rule working:     utils/fannedBeam.ts   +184
                                    rendering/FannedBeam.ts +173

THE SPINE — the tax:                VexFlowRenderer  +141    ScoreModel   +54
                                    PaletteController +46    types/music  +44
                                    NoteBuilder       +39    devToolbar   +32
                                    keypadSync        +24    MusicEngine  +20
                                    MeasureLayout     +12    rebar        +14
```

~430 lines of **wiring**, spread over ten files that every other feature also writes into. Each slice
is individually correct, individually small, and individually unavoidable. `Joining the strokes is a
choice` (13 files) has the same anatomy at half the size.

The co-change record over 120 commits says it is systemic, not a one-off:

```
43× VexFlowRenderer   34× ScoreModel        33× MusicEngine
26× PaletteController 22× devToolbar        19× keypadSync
14× keypadLayouts     14× beaming           14× types/music
12× shortcutWiring    10× MouseController   10× rebarOps
```

### 3. The rule protects the three files it names, and only those

Measured across the window that contains the whole 2026-07-27 pass:

| file | HEAD~100 | HEAD~30 | HEAD | verdict |
|---|---|---|---|---|
| `VexFlowRenderer.ts` | 3,781 | 4,769 | **3,744** | ✅ named by the rule — P6 cut it |
| `MusicEngine.ts` | 3,363 | 3,510 | **3,256** | ✅ named by the rule — P6 cut it |
| `ScoreModel.ts` | 3,009 | 3,367 | **3,637** | ⚠️ named by the rule, **grew anyway (+628)** |
| `PaletteController.ts` | 1,676 | 2,169 | **2,201** | ⚠️ not named — **+525** |
| `MouseController.ts` | 2,430 | 2,556 | **2,566** | ⚠️ not named — +136 |

And against the *first* split plan's own baseline (`docs/split-plan-2026-06-22.md`, five weeks ago):
`ScoreModel` 2,208 → 3,637. `VexFlowRenderer` 2,798 → 3,744. That plan's Tier C verdict for
`MouseController` was *"tool-strategy split — defer to next tool"*; it was 1,293 then and is 2,566
now. **The next tool arrived several times.**

> `ScoreModel` is named by the rule and grew regardless — because the rule forbids putting *logic*
> there, and what lands there is not logic, it is one more accessor for one more field. The tax is
> paid in slices too thin for the rule to catch.

### 4. The structural cause: filed by mechanism, changed by kind

The code is filed by *what kind of operation it is* — all mousedowns together, all highlights
together, all ghosts together. It **changes** by *element kind*. So every kind is smeared as a thin
slice across five or six files:

| family | kinds | the slices |
|---|---|---|
| `SelectedElement` | **14** | `handle*MouseDown` ×17, `apply*Highlight` ×13, the `RenderController` switch, `selectionSnapshot`, Delete in `shortcutWiring` |
| `MarkingTool` ghost | **12** | `render*Ghost` ×11 → `MusicEngine.renderScoreWith*Ghost` ×10 → `VexFlowRenderer.renderScoreWith*Ghost` ×10 → `draw*Ghost` ×11 |
| palette press | 8 tools | `press*` / `arm*Tool` / `editSelected*` / `apply*ToSelection` / `refresh*Selection` ×9 |
| click placement | 13 | `place*AtClick` ×7 + `stamp*AtClick` ×6 |
| authored adjustment | **13** override kinds | key + accessor in `engravingOverrides`, setter on `ScoreModel`, `set/get/preview/commit/reset/room` on `MusicEngine`, `arm/drag/end` in `MouseController`, a read in the renderer |

Three of these are worth stating precisely, because they are where the plan's phases come from.

**The ghost pipeline is three layers of forwarding.** `RenderController.renderTieGhost` →
`MusicEngine.renderScoreWithTieGhost` → `VexFlowRenderer.renderScoreWithTieGhost` →
`ghostOverlay(drawTieGhost)`. That is **42 methods across four layers**, and the **20 in the middle
two carry no logic whatsoever** — every one is a single delegating statement. Adding a thirteenth
ghost means editing four files in order to add nothing.

**The element handlers are the same five lines.** `handleDotMouseDown`, `handleAccidentalMouseDown`,
`handleTremoloMouseDown` and `handleStemMouseDown` each reduce to: hit-test → `selectNote(null)` →
`selectedElement = { kind, noteId }` → `dbg` → `renderScore()` → `return true`. What genuinely
differs is the hit-test and **the position in the priority chain** — and that ordering, with its
comments, is the most valuable thing in the file.

**`MusicEngine` 1185–1850 is one topic, 665 lines long.** `nudge` / `preview` / `commit` / `reset` /
`room`, written out seven times: rest shift, note spacing, bar width, note offset, dynamic offset,
staff spacing, slur endpoints. Seven instances of one pattern, unabstracted, and it is the
fastest-growing pattern in the codebase — one new adjustable element is six files.

### 5. The tests have the same shape, and that is why splits grow back

```
ScoreModel.test.ts 2,518    MusicEngine.test.ts 2,009    PaletteController.test.ts 1,755
```

`npm run audit:tests` reports **29 core modules with no spec naming them** — `rebarOps` (1,387),
`GhostRenderer` (1,017), `FanPass` (746), `tupletOps` (345), `DynamicsLayout` (320),
`TieRenderer` (277) — plus 51 more in the UI layers.

The extractions moved the **code** out and left the **tests** in the parent. So the parent spec never
shrinks, it still knows about everything the parent used to do, and the extracted module has no local
contract of its own. That is a structural reason splits do not hold, entirely independent of the
coding rule — and it is the cheapest thing in this plan to fix.

---

## What is NOT in this pass

- ⛔ **No size lint, no line-count gate.** Considered and rejected before (`project_big_three_split`);
  rejected again. It would push code into badly-shaped small files, which is the failure mode the
  brief explicitly names: *"we don't want to split for the sake of splitting."* The standing rule is
  the alternative, already chosen.
- ⛔ **No comment relocation.** Settled above.
- ⛔ **No `types/music.ts` split.** It is 74% comment and it is the shared vocabulary — one file is
  right, and its size is not a symptom.
- ⛔ **No UI framework, no new singleton, no monorepo.** Unchanged from the previous pass.
- ⛔ **No behaviour change anywhere in this plan.** Every phase is a pure relocation, guarded by the
  existing suite plus the E2E net, and by his manual pass.

---

## Phase 0 — A spec moves with its module *(≈1–2 h, do first, independently shippable)*

The ratchet that makes every later phase hold. `lint:testnames` already enforces *a spec sits beside
its subject*; `audit:tests` already reports the other direction. What is missing is the **rule** that
closes the loop:

> **Rule:** when a module is extracted, its tests are extracted with it, in the same commit.
> A split that leaves its assertions in the parent has not finished.

Work: take the 29 core offenders `audit:tests` already names, largest first, and move the assertions
that name each module out of the parent spec into the module's own sibling spec. `rebarOps`,
`GhostRenderer`, `FanPass` first — those three alone are 3,150 lines of module with no local
contract.

Zero runtime risk (test files only). It shrinks `ScoreModel.test.ts` and `MusicEngine.test.ts` as a
side effect, which is the point: **the parent spec is what keeps pulling the parent back.**

### ✅ Done 2026-07-28 — first pass, the three named

2,546 tests green and unchanged, `build:check` clean, no source file touched.

- **The rule is written down** in `CLAUDE.md` §Testing and `docs/test-layout-plan.md` §"Phase 5 — a
  spec moves with its module", which re-opens that plan's stop point deliberately and says why:
  Phases 1–4 there were about *layout*, this is about *contracts*.
- **`rebarOps`** (1,387) — 28 `it`s out of `ScoreModel.test.ts` (**2,518 → 1,967**) into four
  chapters: `rebarOps.anchors` (beat-anchored annotations survive), `.spans` (slurs/ties re-attach in
  their own voice), `.voices` (a secondary voice is not erased), `.timeSignature` (the relay itself —
  split-and-tie, atomic tuplets, `rewrite:'none'`). The meter API's *own* contract — validation,
  propagation, the no-op, the pickup override — stayed with `ScoreModel`.
- **`GhostRenderer`** (1,017) — `ghostContextLeak.test.ts` → `GhostRenderer.contextLeak.test.ts`,
  which also **shrinks the `lint:testnames` allowlist by one**: it was listed as unable to satisfy
  the rule by renaming because its subject was read as `MusicEngine` one directory up. Its subject
  was sitting beside it.
- **`FanPass`** (746) — `VexFlowRenderer.fan.test.ts` → `FanPass.test.ts`. Same reasoning: the
  renderer is the only way to build a `RenderPass`, so it is the fixture; every assertion is on ink
  the pass draws.

`audit:tests` 29 → **26**. Largest still owed a spec: `PlaybackEngine` (347), `tupletOps` (345),
`DynamicsLayout` (320), `TieRenderer` (277). Worth continuing largest-first, one module per commit —
but the ratchet the later phases need is now in place, so **Phase 2 can start**.

---

## Phase 1 — The element-kind table *(≈1 day; the biggest single win)*

The `SelectedElement` union made an element's **type** one thing. Its **behaviour** is still spread
over four files. Finish that job.

The premise checks out, and more literally than §4 claimed. Of the twelve chain handlers, **eleven
end in the identical three statements** — `this.selection.selectNote(null)` →
`this.state.selectedElement = { … }` → `this.render.renderScore()`. Everything above that tail is
hit-test. `handleArticulationMouseDown` is the **one** exception: it calls
`selection.selectArticulation(noteId)` instead of the note-clear, so it gets its own tail and does
not ride the shared one.

**`AMENDED` — it is TWO structures, not one.** The single `Record<kind, ElementSpec>` with a required
`hitTest` cannot be built. Checked against `handleMouseDown` (MouseController.ts:515) and the
fourteen-kind union: only **twelve** kinds are resolved in the priority chain. `tuplet` and
`measureRange` are set by the **pre-steps** (`handleTupletMouseDown`, `handleModifierMouseDown`) that
the guard below rightly keeps outside the table, and `slur` appears **twice** — once as a pre-step
handle-drag, once in the chain. A required `hitTest` therefore has two kinds with nothing to put in
it, and the exhaustiveness this phase is bought for is exactly what an optional field would give up.

So the two axes get the two shapes they actually have — the chain is *ordered and partial*, the
paint is *unordered and total*:

```ts
// interactions/elements/ — one module per kind, each exporting its own hitTest.

/** The priority chain. ORDER IS THE CONTENT: the array position is the answer to
 *  "who gets a press two glyphs both cover?" — see the comments carried into it. */
const ELEMENT_HIT_ORDER: ReadonlyArray<ElementHit> = [ … ]   // 12 entries
interface ElementHit { hitTest(ctx: MouseDownCtx): SelectedElement | null }

/** Total over the union — a fifteenth kind fails to BUILD until it says how it paints.
 *  This is the site that replaces assertNeverElement's three. */
const ELEMENT_SPECS: Record<SelectedElement['kind'], ElementSpec> = { … }  // 14 entries
interface ElementSpec {
  highlight(h: HighlightController): void
  delete?(engine: MusicEngine, el: SelectedElement): boolean
}
```

⚠️ **`ELEMENT_SPECS`, not `elementSpecs`.** `scripts/check-singletons.mjs` matches a module-level
`export const <camelCase> = {` and would count the table as a new mutable singleton, failing
`build:check` and contradicting the §"one thing to watch" note below. The rule reads SCREAMING_SNAKE
as a constant lookup table — which is what these are, and what `MARKING_TOOL_USES_ARMED_LENGTH` and
`GHOST_DRAWERS` already are.

Then:

- **`MouseController.handleMouseDown` becomes a loop over `ELEMENT_HIT_ORDER`,** with the shared tail
  run once by the loop. ⚠️ The priority order is the load-bearing part of that method and **its
  comments travel verbatim into the array** — the dot before the note, the tremolo before the stem,
  the barline last of all. The order stays as readable as it is now, in one place, instead of being
  implied by twelve `if (…) return`s followed by twelve bodies.
- **`RenderController.applySelectedElementHighlight`'s switch becomes an `ELEMENT_SPECS` lookup**,
  giving the **same compile-time exhaustiveness** `assertNeverElement` gives today — from **one** site
  instead of the three that must currently agree (highlight, Delete, the Properties report).
- **`HighlightController`'s per-kind `apply*Highlight` bodies STAY WHERE THEY ARE**, referenced by the
  table (`highlight: h => h.applyClefSelectionHighlight()`). ⚠️ `AMENDED` — this is not a preference,
  it is what the code allows: those bodies lean on ~10 of the class's privates
  (`highlightGlyphsInBBox`, `colorNoteArticulations`, `colorNoteDots`, `colorNoteTremolo`, `setAttr`,
  `addClass`, `raiseToFront`, `undoLog` …). Moving them out means publishing that painting toolkit as
  an API, which is a larger and worse change than the one this phase is for.

**`AMENDED` — expected yield is ~570 lines, not ~900.** With the highlight bodies staying put, the
move is `MouseController` 960–1513 (**~550 lines** of chain handlers) plus the ~20-line
`RenderController` switch. `HighlightController` does not shrink. Still the biggest single win in the
plan, and **a new selectable element still becomes one new file** plus two table rows — but budget it
at the real number.

⚠️ **Guard:** the four shared pre-steps in `handleMouseDown` (modifier/multi-select, tuplet, slur
handle, staff spacing) run **before** the `selectedElement = null` clear and must stay outside the
chain — they are gestures, not kinds. Keep them as they are. They are also why `tuplet`,
`measureRange` and the slur handles have no `ELEMENT_HIT_ORDER` entry.

---

## Phase 2 — Collapse the ghost pipeline *(≈half a day)*

Four layers, twelve kinds, 42 methods, 20 of them empty. Re-counted: `RenderController` 11 →
`MusicEngine` 10 → `VexFlowRenderer` 10 → `GhostRenderer`'s 11 exported drawers, and the twenty in
the middle two are single delegating statements exactly as claimed.

🚨 **`AMENDED` — the payload type may NOT be `MarkingTool`, and no lint would tell you.**
`MarkingTool` is declared in `interactions/EditorState.ts:46`. `src/engine/` today imports **nothing**
from `interactions/` (verified: zero hits outside one test file) — that clean arrow is
`App.ts → interactions → engine`, and it is what the npm-package goal rests on. But
`.eslintrc.boundary.json` fences only `utils/`, `types/` and `engine/models/` off from
`@/interactions`; the `src/engine/**` override bans a framework and `@/dev`, and nothing else. So
`drawToolGhost(tool: MarkingTool, …)` in `VexFlowRenderer` would pass all four `build:check` gates,
invert the arrow, and be invisible until someone tried to publish the engine.

The fix is one type, and it costs nothing: the ghost payload is **engine-owned**.

- **New `engine/rendering/ghostTypes.ts`** — a `ToolGhost` union of what the engine can actually
  draw (`{kind:'clef', clef}`, `{kind:'rest', duration, dots}`, …). It is the engine's vocabulary, not
  the editor's armed state, and the two are not the same thing: the rest ghost carries the **armed
  length** rather than a tool field, and tempo/dynamic carry a resolved *mark*, not a tool.
- `RenderController` does the `MarkingTool → ToolGhost` mapping it already half-does today —
  `tempoFieldsFromTool` and `dynamicTextFromTool` are that step, and they stay on the editor side
  where they belong.
- `GhostRenderer` gains `GHOST_DRAWERS: Record<ToolGhost['kind'], drawer>` beside the eleven
  `draw*Ghost` functions it already exports (they do not change). ⚠️ The rows are thin **adapters**,
  not the bare exports: the signatures genuinely differ — `drawClefGhost(ctx, svg, x, y, clef)` takes
  the SVG element, `drawTempoGhost(ctx, x, y, mark)` does not.
- `VexFlowRenderer` keeps **one** `drawToolGhost(ghost, coords)` over `ghostOverlay` — the ten
  `renderScoreWith*Ghost` one-liners go.
- `MusicEngine` keeps **one** delegation — its ten go.
- `RenderController.renderToolGhost`'s switch becomes the table lookup, keeping `ensureScoreDrawn`
  and `setCause` as the shared pre-step they already are; the eleven `render*Ghost` methods go.
  ⚠️ Three of those eleven are **not** empty — tempo and dynamic build their mark, rest reads
  `selectedDuration`/`selectedDots`. That work becomes the `MarkingTool → ToolGhost` mapping; it does
  not disappear, it moves one line.

Removes ~31 forwarding methods across three files. **Adding a ghost becomes one drawer plus one table
row.**

⭐ **Worth doing while in here (15 min):** add `@/interactions`, `@/interactions/*` to the
`src/engine/**` group in `.eslintrc.boundary.json`. The arrow is currently documented in three places
and checked in none — and this phase is exactly the kind of change that would have crossed it.

⚠️ Well covered before it starts: P6a's E2E ghost specs already assert each ghost is in its own
overlay group, at the pointer, and replaced rather than piled up. Run `test:e2e` either side.
⚠️ The ghost **note** (`drawNoteGhost`, via `renderScoreWithPreview`) is not a marking tool and stays
on its own path — it rides the armed duration/accidental/tuplet, not a tool payload.

---

## Phase 3 — `ScoreModel`'s four `*Ops` modules *(≈1 day)*

`ScoreModel` has **exactly one instance field** (`score`), so every method is already a free function
over it — the 2026-06-22 coupling audit's finding, still true, and `clefOps` / `tupletOps` /
`rebarOps` are the working precedent. Four clusters, ~1,290 lines:

| cluster | today | → |
|---|---|---|
| Slurs — 10 methods incl. the four segment ones | `638–845` (207) | `models/slurOps.ts` |
| Engraving overrides — 15 methods | `845–1200` (355) | `models/overrideOps.ts` |
| Marks — tremolo / fan / pair / articulation, 6 | `2197–2412` (215) | `models/markOps.ts` |
| Voice moves — 8 incl. `moveTupletNoteToVoice` | `2860–3375` (515) | `models/voiceOps.ts` |

🚨 **`AMENDED` — those four are LINE SPANS, not clusters. Re-derive them BY NAME before starting.**
Every range was read back method by method, and each sweeps up something that does not belong to it:

| range | what is actually inside it that must NOT travel |
|---|---|
| Slurs `638–845` | the span's **last** method is `nudgeRestShift` — an override, not a slur. Off by one. |
| Overrides `845–1200` | `slotIdForNote` (a general id helper); `setCautionaryAllowed` / `setCautionaryClefAllowed` (**score policy**, not authored engraving); and the span **ends on `getActiveLevel`** — *dynamics resolution*, a different topic entirely. |
| Marks `2197–2412` | cleanest of the four; but `getNotePitch` is a general accessor, not a mark. |
| Voice `2860–3375` | `setRestBeamOver` (**beaming**), `dropStaleTremoloPairs` (**tremolo**), `insertPitch` (already flagged), and the span **ends at `validateMeasure`** (validation). The real voice cluster is ~4 public + 3 private methods. |

So **~1,290 overstates the move** — the four cohesive clusters are meaningfully smaller, and taken at
face value the ranges would ship an `overrideOps.ts` that owns dynamics and a `voiceOps.ts` that owns
beaming and validation. That is not a split, it is a second `ScoreModel` with a worse name. Write the
four method lists out first; the line count is whatever they add up to.

`ScoreModel` keeps the one-line delegations (that is what it does for `clefOps` today) and is left
with a core of note CRUD — `addNote`, `updateNote`, `deleteNote`, `insertPitch`, `convertToRest`, the
gap fills — plus the strays above, which stay because nothing better owns them yet. That core is
genuinely cohesive and **stays whole**; splitting it would be splitting for the sake of it.

⚠️ `insertPitch` sits inside the voice range but belongs to note entry — it stays.
⚠️ Do Phase 0 for `ScoreModel.test.ts` first, or this phase just moves code away from its tests
again.

---

## Phase 4 — The adjustment gesture *(spike first; ≈half a day for the spike)*

The 665-line block, and the six-files-per-adjustable-element cost. The target is a descriptor in the
core —

```ts
interface AdjustableSpec<T> { key(target: T): string; read(score, key): number
                              clamp(v: number): number; label: string }
```

— so `preview` / `commit` / `reset` / `nudge` become four generic methods parameterised by a spec,
instead of four methods × seven adjustables, with `MouseController`'s five drag lifecycles
(`arm*Drag` / `handle*Drag` / `end*Drag`) collapsing onto one `dragGesture(spec)` helper.

⚠️ **Do not start with the generalisation.** The seven are not actually uniform: bar width carries a
line key and a re-wrap re-anchor (`reanchorIfRewrapped`), staff spacing has a whole linear-view
branch that writes a view knob instead of the score, note spacing's `room` has a fan-member case. The
phase pays only if the escape hatches stay cheap.

🚨 **`AMENDED` — it is not one pattern seven times. It is three shapes, and the spike was aimed at
the wrong end.** Counted method by method across `MusicEngine`:

| shape | adjustables | surface |
|---|---|---|
| **full** `nudge/preview/commit/reset/room` | note spacing, bar width | 7 and 8 methods |
| partial | staff spacing (5, **no** `room`); slur shape/endpoint (preview/commit, no room/reset) | |
| **already a one-liner** | rest shift, dynamic offset, note offset | `nudgeRestShift` and `nudgeDynamicOffset` are **single delegating statements**; note offset is nudge/reset/get |

The plan's chosen spike — rest shift, note offset, dynamic offset — is precisely the bottom row.
Generalising three one-line delegations into a spec plus a table is **net more code**, and the spike
would "succeed" while proving nothing whatsoever about the four that carry the difficulty. Worse, a
green spike is what would license extending the spec to the hard cases, which is the failure this
phase's own warning exists to prevent.

**Spike, re-aimed:** do **note spacing and bar width** — the only two full instances, and the two
that carry the escape hatches (`reanchorIfRewrapped`, `barWidthLineKey`, the fan-member branch in
`noteSpacingRoom`). If one `AdjustableSpec` covers both without a third optional callback, the
abstraction is real and the rest can follow. If it does not, stop.

**The predicted answer is "no"** — two full instances is not a pattern, it is a coincidence with a
resemblance, and the four one-liners have nothing to abstract. Written down here so that a spike
ending in "keep the explicit versions" reads as the phase **working**, not as it failing. This is the
one phase that can correctly end in "no", and it probably will; half a day to close it honestly is
the point.

---

## Phase 5 — Extend the rule to name the real spine *(15 min, do last)*

`CLAUDE.md` and `ARCHITECTURE.md` name three files: `MusicEngine`, `ScoreModel`,
`VexFlowRenderer`. §3 above shows the growth has moved. The clause gains the files it is actually
about:

> **A new feature adds a MODULE.** It does not add methods to `MusicEngine`, `ScoreModel` or
> `VexFlowRenderer` — nor a per-kind slice to `PaletteController`, `MouseController`,
> `HighlightController`, `keypadSync` or `devToolbar`. **A slice too thin to be logic is still a
> slice**: if what you are adding is the twelfth `case` in a family, add the twelfth *module* and a
> row in its table.

⚠️ Lint cannot check this one either, for the same reason the original clause cannot: a slice in the
wrong file imports exactly what it would have imported from the right one. It is enforced in review,
or not at all. What Phases 1–2 change is that after them **there is a table to add the row to** — the
rule stops asking for restraint and starts describing the path of least resistance.

---

## Sequence, and what each phase is worth

| # | phase | effort | risk | removes | makes cheap |
|---|---|---|---|---|---|
| 0 | specs move with modules | 1–2 h | none | ~2,000 test lines from 3 parents | every later split holding |
| 2 | ghost pipeline | ½ day | low | ~31 methods, 3 files | a new ghost = 1 drawer + 1 row |
| 1 | element-kind table | 1 day | medium | **~570** lines, 2 files | a new selectable element = 1 file + 2 rows |
| 3 | `ScoreModel` `*Ops` | 1 day | low | 4 clusters, **sized once named** | the next model feature |
| 4 | adjustment gesture | spike | **high** | likely **nothing** — see the prediction | a new adjustable = 1 spec, *if* it survives |
| 5 | rule extension | 15 min | none | — | all of the above staying done |

**`AMENDED` — order is now 0 → 2 → 1 → 3 → 4 (spike) → 5.** Phase 0 is free and unblocks the rest.
Phases 1 and 2 are the same idea at two sizes, and **2 goes first**: it is half the effort, fully
covered by P6a's E2E ghost specs, and it is the phase that pays for the boundary lint Phase 1 will
then be building behind. Phase 1 is the only medium-risk step and benefits from going second.

The "removes" column was re-derived against the code — three of the four original figures were
optimistic (Phase 1's ~900 counted highlight bodies that cannot move; Phase 3's ~1,290 counted
methods belonging to other topics; Phase 4's ~500 counted a pattern that is only really present
twice). The *reasons* for the phases were not affected: the navigation cost in §1–§4 is measured and
stands.

Stop after any phase and the tree is green. Phase 7 of `docs/refactor-plan-2026-07-27.md` (the
model's perf index, *when measured*) is orthogonal to all of this and unaffected.

---

## Checked against DESIGN-PRINCIPLES (2026-07-28)

Read against all six. **No contradictions**, and two phases are a principle being applied rather than
new work:

| phase | principle |
|---|---|
| 1 | editor-internal — principles 1–6 are about the *model's* assumptions, and this phase makes none. That is the check passing, exactly as it did for P1 and P6a. |
| 2 | ~~editor-internal, same as 1~~ — **`AMENDED`, and this is the one the first read got wrong.** It is a §5 phase: as originally written it would have *crossed* the arrow (the engine importing the editor's `MarkingTool`), and no gate would have said so. With the engine-owned `ToolGhost` it becomes a principle being *enforced* rather than a check merely passing — and the phase now proposes the missing lint. ⭐ The lesson generalises: "editor-internal, so §5 does not apply" is safe only once you have checked which *file* the types live in. |
| 3 | §5 — *"the score layer holds the full mutation API"*. The four `*Ops` modules stay inside the core fence (`engine/models/**`), so `lint:boundary` is unchanged and the package boundary is untouched. |
| 4 | §3 — an adjustment is authored **engraving**, anchor-relative and in staff-spaces. An `AdjustableSpec` describes *where the value lives*, never a pixel; it must not become a home for layout results. |
| 0, 5 | 2026-07-27 Phase 0c — *a comment asserting a repo fact gets a script behind it*. Both already have theirs: `check-test-names.mjs` and `audit-tests.mjs`. |

⚠️ **One thing to watch in Phase 1.** `DESIGN-PRINCIPLES.md` §1 forbids module-level mutable state,
and `lint:singletons` counts what exists. An element **table** is a frozen `Record` of pure specs —
data, not state — so it is not a new singleton and the count must not move. If a spec ever wants to
*remember* something between clicks, that is instance state and it belongs on the controller, not in
the table.

⭐ `AMENDED` — **and the check cannot tell the two apart by anything but the NAME.**
`scripts/check-singletons.mjs` matches `export const <camelCase> = {` and reads SCREAMING_SNAKE as a
constant lookup table; that convention *is* the rule, deliberately, and it has no other signal to go
on. So `ELEMENT_SPECS` / `ELEMENT_HIT_ORDER` / `GHOST_DRAWERS` pass and `elementSpecs` fails the
build — which is the check working, not a nuisance. Naming a table in camelCase would be claiming it
is state.
