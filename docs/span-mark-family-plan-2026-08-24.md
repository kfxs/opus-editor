# Span-Mark Family Plan — the Fourth Copy (2026-08-24)

Branch: to be cut from `main` at `71521a8` (clean, 0 ahead of origin).

Outcome of a fourth full code review, asked for directly: *"I want the codebase to be scalable,
maintainable, clean and following best practices… clean code; no duplication; real dead code; large
files that could be more modular."*

Baseline, measured 2026-08-24: **5,052 tests green** (316 files, 1 skipped), `build:check` clean at
all four gates, `tsc --noEmit` clean. 372 source modules, 105,626 source lines + 71,476 test lines.

> **✅ Independently re-reviewed and amended 2026-08-24.** A second full pass was run over the whole
> codebase without reading this plan first, then held up against it. It reached the same diagnosis
> from the same evidence, so the argument and the phase order below stand unchanged. Baseline
> re-verified exactly (`build:check` exit 0; 5,052 passed / 7 skipped). The per-family `MusicEngine`
> counts in §2 were re-derived independently and matched to the method. What the second pass added is
> marked **`[A1]`–`[A6]`** below; where it corrected a number, the old figure is struck and the
> correction says which way it cuts. Nothing in the amendments changes the sequence or the
> stop conditions.

The 2026-07-27 pass was about *shape*, and ended by writing the rule. The 2026-07-28 pass
(`docs/modularity-plan-2026-07-28.md`) was about the *spine tax* the rule does not reach, and ended
by naming eight files instead of three. This pass is about the cost the rule does not reach because
**the rule was obeyed**.

---

## The argument

### 1. Three of the four axes are already clean

| signal | count | in |
|---|---|---|
| `any` | **~27** (13 `as any` + 14 annotation-position) | 105,626 lines |
| `@ts-ignore` / `@ts-expect-error` | **0** | — |
| `eslint-disable` | **4** | — |
| `TODO` / `FIXME` / `HACK` | **3** | — |
| functions ≥ 80 lines | **57** | of 2,819 (2.0%) |
| functions ≥ 150 lines | **24** | of ~2,800 (0.9%) |
| `MusicEngine` median method body | **5 lines** | of 378 methods |

That last row is the rule working. 262 of 377 methods are ≤6 lines; the logic really is in feature
modules. **No cleanliness phase is proposed below, because the measurements do not support one.**

*(The `any` row read **18** in the first draft; counting both syntactic positions gives ~27. A zero in
the `@ts-ignore` row at this size is the load-bearing number, and it is unchanged — the conclusion
holds either way.)*

### 2. The cost is combinatorial, not qualitative

Ottava, pedal, hairpin and trill are one concept — *a line spanning some music, with two draggable
ends, on a ladder rung, wrapping at a system break*. Each grew a full vertical stack, and the stacks
line up layer for layer:

| layer | ottava | pedal | hairpin | trill |
|---|---|---|---|---|
| `engine/models/*Ops` | 841 | 830 | 877 | 646 |
| `engine/rendering/*Renderer` | 728 | 614 | 689 | 952 |
| `engine/rendering/*Style` | 285 | 161 | — | 209 |
| `engine/rendering/*Ghost` | 81 | 79 | — | 72 |
| `interactions/*Walk` | 569 | 580 | 702 | 953 |
| `interactions/*Lane` | 253 | 286 | 281 | 321 |
| `interactions/*GeometryController` | 70 | 71 | 69 | 70 |
| `interactions/*Stamp` | 75 | 77 | 70 | 70 |
| `interactions/elements/*Handles` | 172 | 178 | 272 | 169 |
| `interactions/elements/*` | 66 | 90 | 54 | 69 |
| `bus/*GeometrySelection` | 76 | 75 | 69 | 71 |
| **total (all modules)** | **3,216** | **3,411** | **3,845** | **4,126** |
| `MusicEngine` methods | 30 | 32 | 34 | 27 |
| test lines | 3,447 | 3,497 | 3,457 | 2,878 |

**54 modules, 14,598 source lines (13.8%), plus 13,279 test lines** — 27,877 lines, **15.7% of all
TypeScript in the repo**, are four parallel renderings of one idea.

#### **`[A1]` `[A2]`** …and the shared hubs each kind *also* slices

⚠️ **The table above counts only the modules a family OWNS.** It therefore understates the cost,
because a span mark is not just its own stack — it is also a slice cut into hubs it shares with
everything else. Counting how often each kind is *named* per hub file (a proxy for per-kind slices,
slur included since it is the fifth member of the same idea):

| shared hub | hairpin | ottava | pedal | trill | slur | total |
|---|---|---|---|---|---|---|
| `engine/MusicEngine.ts` | 227 | 190 | 269 | 204 | 275 | **1,165** |
| `interactions/MouseController.ts` | 142 | 134 | 151 | 139 | 301 | **867** |
| **`engine/models/ScoreModel.ts`** | 159 | 145 | 145 | 148 | 160 | **757** |
| `interactions/shortcutWiring.ts` | 117 | 104 | 125 | 93 | 118 | **557** |
| **`engine/models/rebarOps.ts`** | 40 | 41 | 50 | 84 | 111 | **326** |
| `interactions/HighlightController.ts` | 36 | 29 | 68 | 39 | 131 | **303** |
| `engine/rendering/ScoreRenderer.ts` | 38 | 38 | 34 | 47 | 55 | **212** |
| `engine/ElementRegistry.ts` | 19 | 28 | 34 | 15 | 61 | **157** |
| `windows/properties/PropertiesWidget.ts` | 35 | 16 | 20 | 42 | 30 | **143** |
| `interactions/PaletteController.ts` | 24 | 17 | 18 | 26 | 37 | **122** |
| `interactions/EditorState.ts` | 21 | 16 | 24 | 24 | 33 | **118** |
| `interactions/clipboard.ts` | 16 | 20 | 16 | 28 | 35 | **115** |
| `interactions/elements/chain.ts` | 11 | 10 | 13 | 14 | 15 | **63** |

**~4,900 mentions across 14 hub files.** ⭐ The honest statement of the cost is therefore: **a sixth
span kind touches at least fourteen files**, not the eleven-module stack §4 prices.

Two of these rows are new to this plan and each changes a phase:

- **`[A1]` `engine/models/ScoreModel.ts` was missing from the plan entirely, and it changes Phase 5.**
  It carries **96 per-kind span methods** — hairpin 24, ottava 20, pedal 20, slur 17, trill 15 — the
  same verb families as the facade, one layer *beneath* it. Phase 5 as first written collapses
  `MusicEngine`'s verb families and leaves `ScoreModel`'s untouched, so glissando would still cost
  ~20 hand-written methods there. Phase 5 now has two halves.
- **`[A2]` `engine/models/rebarOps.ts` was missing from both this table and Phase 2's outlier list.**
  Its `pasteEvents` is **375 lines — the 4th-largest function in the repo** — and holds **40
  span-kind mentions across 8 distinct per-kind blocks** (capture-before-id-regen, re-attach,
  destination replacement, clip re-anchor, × the families). ⭐⭐ **This is the highest-risk per-kind
  site in the codebase**, and the reason is worth stating plainly: every other site mis-*draws* a
  glyph when a kind is forgotten, while this one silently mis-*writes the score* on a paste. See
  Phase 2 and Phase 4.

Structural identity, measured by normalising the family name out (`ottava` → `X`) and diffing the
stripped, comment-free lines — identical share of the smaller file:

```
85%  OttavaGhost ↔ PedalGhost ↔ TrillGhost      69%  Ottava ↔ Trill GeometryController
85%  pedalStamp ↔ trillStamp                    57%  ottavaLane ↔ pedalLane
70%  ottavaHandles ↔ trillHandles               51%  ottavaWalk ↔ pedalWalk
64%  ottavaHandles ↔ pedalHandles               51%  OttavaRenderer ↔ PedalRenderer
                                                41%  ottavaWalk.test ↔ pedalWalk.test
```

The tests duplicate on the same axis, so every copy costs twice.

⚠️ **The rule did not fail here — it has no clause for this.** "A new feature adds a MODULE" is
satisfied by adding the fourth copy of eleven modules. Nothing in `CLAUDE.md`, `ARCHITECTURE.md` or
any of the four lint gates notices when the twelfth module is the fourth rendering of the first.

### 3. The abstraction is already built, and already generic

This is what makes the pass tractable rather than speculative:

- `interactions/markWalk.ts` (293) — `MarkWalkPort`, the per-mark seam. ~~All four implement it.~~
  **`[A3]` SIX implement it, not four:** `ottavaWalk`, `pedalWalk`, `hairpinWalk`, `trillWalk` — **and
  `dynamicWalk` and `tempoWalk`**.
- `interactions/markBreakWrap.ts` (290) — `BreakWrapPort`, the system-break crossing. Five
  implementors: the four families **plus `dynamicWalk` and `tempoWalk`**, minus `trillWalk`.
- `interactions/markSystemJump.ts` (123) — `SystemJumpPort<Stop>`, already generic in its stop type.
  Live, not aspirational: `systemStopFor` is imported by **six** lane modules (`dynamicLane`,
  `tempoWalk`, `hairpinLane`, `ottavaLane`, `pedalLane`, `trillLane`).

⭐ **`[A3]` This widens Phase 1 and constrains its signature, so it matters before the driver is
written, not after.** The dynamic and the tempo mark are **point marks** — they have no `length` and
two draggable ends is not their shape — so they do **not** join `SPAN_MARK_MODEL` in Phase 3. But
they are *already* sharing the very seam Phase 1 hoists. Two consequences:

1. **The payoff is larger than §3 prices.** The driver is shared by six callers, not four.
2. ⚠️ **The driver must be written against the port, never against "a span".** If
   `walkEndpoint` / `dragEndpoint` assume a `length` or a second end, the two point marks cannot call
   it and Phase 1 has quietly forked the seam it was sent to unify. **Phase 1's acceptance test is
   that `dynamicWalk` and `tempoWalk` call the same driver** — they are the cheap proof that the
   abstraction is about *the walk*, not about *spans*.

What was never hoisted is the **driver** — the code composing port + wrap + hold into
`walkXEndpoint` / `dragXEndpoint` / `walkXBody` / `dragXBody`. Each family rewrote it. So did
`MouseController`: `handleHairpinEndDrag`, `handleOttavaEndDrag`, `handlePedalEndDrag` and
`handleTrillEndDrag` are **49–57 lines each** (hairpin 51, ottava 51, pedal 49, trill 57 — re-measured
2026-08-24; the first draft said 30–31), **54–56% identical**, down to the prose comments — the same
paragraph about the hold being absorbed, the same dated note `(it was, 2026-08-18)`, four times.

⭐ **The target shape is finishing the abstraction that exists, not inventing one.** A `SpanMarkSpec`
row per family feeding shared drivers, in the style of `ELEMENT_SPECS` in
`interactions/elements/chain.ts` — the pattern this repo already uses well.

### 4. What it costs at the next feature

Glissando is next (`memory: project_open_small_items`). On current precedent: **~13 modules, ~3,500
source lines, ~3,300 test lines, ~30 `MusicEngine` methods**, and a row in each of ~10 registration
tables (`ELEMENT_SPECS`, `ELEMENT_HIT_ORDER`, `GHOST_DRAWERS`, `MARK_PREVIEW_FAMILIES`,
`SCOPED_KINDS`, `SelectedElement`, the marking-tool union, …).

---

## Two decisions owed before Phase 3

Both change the phases, and neither should be guessed.

**D1 — Does hairpin join the abstraction?** It is the least similar of the four (51% to ottava, but
it alone carries `hairpinShape` (475), the aperture, the mouth, and `hairpinBreaks` (195)). Forcing
a fourth member in is the classic way these refactors go wrong. The plan below assumes
**pedal + ottava + trill first, hairpin decided on the evidence of those three** — it is written so
that answering "no" costs nothing already spent.

**D2 — Which side of the boundary does `SpanMarkSpec` live on?** The mark's ops
(`engine/models/*Ops`) and its walk (`interactions/*Walk`) sit on **opposite sides** of the arrow
`lint:boundary` enforces — `engine/` may not import `interactions/`. So the spec cannot be one
object naming both. The shape that respects the fence is **two tables**: `SPAN_MARK_MODEL` in
`engine/models/` (ops + geometry + style + ghost, engine-owned vocabulary) and `SPAN_MARK_TOOLS` in
`interactions/` (port builders + handles + stamp), keyed by the same kind. This is the same split
`engine/rendering/ghostTypes.ts` + `interactions/toolGhost.ts` already uses, and it is the answer
this plan assumes.

---

## What is NOT in this pass

- **No cleanliness phase.** §1 says the hygiene numbers do not support one.
- **`types/music.ts` is not split.** 2,249 lines, **77% comments**, 438 lines of type code. The
  prose is load-bearing (it records *why* `Score` has no global tempo/clef). Per the 2026-07-28
  decision, comments stay where they are; this is not a size problem.
- **`bus/` is not collapsed.** 16 of 36 modules are a bare `Set<listener>`, but the boilerplate is
  ~71 lines total and each module's real content is its doc comment. Collapsing trades documentation
  for line count.
- **`windows/content/widgets.ts` is not split.** 16 cohesive widget classes; nothing duplicated.
- **No renderer engine work.** `project_own_engraving_engine` P3 is orthogonal and unaffected.
- **`spanContainedInFrac` is not deleted** — it carries an explicit note reserving it for the
  nested-tuplets containment guard. Same for the `GhostRenderer` drawers and `voiceOps` helpers that
  look unused but are reached through in-file tables.

---

## ✅ Phase 0 — Subtraction — **DONE 2026-08-24**

Pure removal, compiler-verified, no behaviour touched. Clears the noise so the real seams are visible.

**Genuinely dead** — no caller anywhere in `src/`, `e2e/` or `scripts/`, not even inside its own
file, and no note reserving it:

| lines | symbol |
|---|---|
| 60 | `engine/rendering/NoteBuilder.ts:376` · `createTupletsForMeasure` — superseded by `ScoreTuplet` / `buildScoreTuplets` |
| 1 | `menus/expressionMenu.ts:74` · `EXPRESSION_WORDS` — a convenience projection nothing consumes |
| 1 | `rendering/ledgerAccidentalClearance.ts:66` · `VEXFLOW_LEDGER_OVERHANG` — ⚠️ arguably **keep**: it documents the default beside the trimmed `LEDGER_OVERHANG_BESIDE_ACCIDENTAL`. His call. |

**Over-exposed** — ~~~80~~ **`[correction]` 242** symbols exported but referenced only inside their
own module. Not dead, just public API nothing asked for, which makes the real seams harder to find.
Drop the `export`; `tsc` verifies each one. Do it in one commit per directory, not one big sweep.

⚠️ **Re-measured 2026-08-24 at 242**, by the strict definition — exported, and referenced by **no
other file in the repo, test files included**. Of 1,820 exported symbols. By directory:

```
68  engine/rendering     18  engine/models     10  engine/layout      7  menus
49  interactions         15  bus                9  interactions/elements
24  utils                14  dev                6  windows/content    4  engine, 4  engine/audio
```

⚠️ **This is ~3× the original estimate, so re-budget the phase: 1–2 h is optimistic.** The risk is
still genuinely none — the compiler verifies every single one — but the estimate below has been
widened to ½ day. ⭐ Take the per-directory commits seriously at this size, and start with
`engine/rendering` (68): it is both the largest bucket and the one whose seams Phases 2–4 need to
read.

Risk: none. `build:check` + 5,052 tests are the whole gate.

### ✅ What actually happened

**231 exports dropped** across all 20 directories; an independent re-scan measured **235** candidates
(the plan said 242) and the per-directory shape matched — rendering 67, interactions 48 + 8, utils 24,
models 18, bus 14. Re-running it now returns **4**, all of them reserved on purpose with a note in
their own doc comment (`SLUR_CONTROL_ANGLE`, `PEDAL_PAREN_FONT`, `spanContainedInFrac`,
`VEXFLOW_LEDGER_OVERHANG`) — for those, the `export` is the only thing keeping `noUnusedLocals` quiet.

**Five dead symbols, not three.** The plan's table found `createTupletsForMeasure`,
`EXPRESSION_WORDS` and `VEXFLOW_LEDGER_OVERHANG`; the sweep surfaced two more that only become
visible once `noUnusedLocals` can see them — `elements/trillHandles.TrillDragWrite` (fully orphaned:
`lineOff` appears nowhere else in the repo) and `models/CollisionDetector.CollisionResult`
(`hasCollision` has no other mention). Both deleted.

> ⏭️ **2026-09-14:** `VEXFLOW_LEDGER_OVERHANG` was deleted in S1b of `docs/vexflow-removal-map.md`: its
> value is now the attributed row `LEDGER_OVERHANG_PX` in `engine/engrave/inheritedDefaults.ts`, which is
> read, so the export no longer needed to exist.

🚨 **A measurement trap worth keeping.** The first scan used `git ls-files 'src/**/*.ts'`, which in git
pathspec does **not** match top-level `src/*.ts` — so `App.ts` and `main.ts` were outside the corpus —
and `'e2e/**/*.ts'` matched **zero** of the 27 e2e files. That inflated the count to 249 and
un-exported 14 symbols that are genuinely used. `tsc` caught the `App.ts` ones loudly; the e2e ones it
could **not**, because `e2e/` is outside `tsconfig.include`. ⭐ So the gate for this phase had to be
wider than `build:check`: type-check `e2e/` together with `src/` under a scratch tsconfig and compare
the error count either side (31 before, 31 after, all pre-existing `ChordRest` narrowing).

---

## ✅ Phase 1 — The drag driver — **DONE 2026-08-24**

**The smallest slice that proves the Phase 3 abstraction, at a tenth of the size.** If the four
families cannot share a driver, this is where we find out cheaply — and Phase 3 does not start.

Two edits, same idea at two scales:

**1a. `MouseController` — one session object.** The class holds ~~135~~ **147 fields** (and 95
methods), most of them flat per-family drag state (`draggedHairpinId`, `hairpinEndLastX`,
`hairpinDragStartTime`, … × 4). That is *why* the four handlers cannot share code today. Replace with
one `MarkDragSession { kind, id, which, lastX, lastY, startedAt }`, and the four `handle*EndDrag`
methods (~~30–31~~ **49–57** lines each) become one.

⭐ **`[correction]` The four handlers are half again as big as first measured** — hairpin 51, ottava
51, pedal 49, trill 57 — so **Phase 1's payoff is larger than budgeted, not smaller.** This cuts in
the plan's favour and does not change the phase.

⭐ **The `isDragging*` flags are the same finding one level up, and 1a should take them too.** There
are **17** parallel `isDragging*` booleans on the class, each with its own `end*Drag()`, dispatched
by **sixteen sequential `if`s** in `handleMouseUp`. It is *disciplined* — every flag is reset exactly
once, in its own handler, and the second review found no bug in it — but it is precisely the "⭐ **a
slice too thin to be logic is still a slice**" shape `CLAUDE.md` §Important Rules forbids, in a file
that rule **names**. One `activeDrag: { kind, id, end(): void } | null` replaces seventeen booleans
and turns sixteen `if`s into one call. ⚠️ The one behaviour to preserve deliberately: the trailing
`barWidthDrag` check is **unconditional** on purpose — an armed-but-never-moved press still has state
to clear — so the session object must model *armed* as distinct from *dragging*, or that case
regresses silently.

**1b. Hoist the driver into `markWalk.ts`.** `walkEndpoint(port, wrap, dx)` and
`dragEndpoint(port, wrap, cursorX, dxPx, dyPx)` — the composition of port + wrap + hold that each
of `ottavaWalk` / `pedalWalk` / `hairpinWalk` / `trillWalk` re-implements. Those four files are 2,804
lines; the driver is ~40% of them. Each shrinks to its **port builders**, which is the part that is
genuinely per-family.

Expected: **~1,000 lines removed**, no model change, no engraving rule touched, no renderer touched.

⚠️ Per the repo's own rule, **the specs move with the code in the same commit** — the shared driver
gets its contract in `markWalk.*.test.ts`; each family spec keeps only what its *port* answers for.
`ottavaWalk.test.ts ↔ pedalWalk.test.ts` are 41% identical today and should not stay that way.

Gate: `build:check` + 5,052 unit tests. No `test:e2e` needed — nothing here draws.

---

### ✅ What actually happened

**1b — the driver — DONE.** `interactions/markDrive.ts`: `walkPress` (one arrow press) and
`dragFrame` (one drag frame). **All six families call it**, so the plan's acceptance criterion holds —
`dynamicWalk` and `tempoWalk` are POINT marks, and their calling it is what proves the driver is about
the WALK and not about spans.

⚠️ **It lives in a new module, not in `markWalk.ts` as the plan says**: `markBreakWrap` imports
`markWalk`, and the driver needs both, so putting it in the lower of the two would close a cycle.

Five knobs, each one a rule somebody reported: `wrap` (absent for the trill's keys), `maxCrossings`
(1 for a span end, the loop for a point mark), `inkGuard` (the hairpin's system, the trill's ribbon),
`handOverWhenBlocked` (off for the trill), `vertical` (screen-down vs outward-from-the-staff). What is
**not** a knob — the batching rule, wrap-then-ink-then-hand-over, the folded-distance re-base — was
identical in all six copies.

**1a — the square drag — DONE.** The four `handle*EndDrag` methods (49–57 lines, 54–56% identical)
are one `handleMarkEndDrag` plus a `MARK_END_DRAGS` table; the four `end*EndDrag` are one; **28 flat
drag fields are one `MarkEndSession`**. `MouseController` 3,762 → ~3,500 lines.

**…and the 13 `isDragging*` flags are one `ActiveDrag` — 2026-08-24.** Fourteen `if`s in
`handleMouseUp` are `this.activeDrag?.end()`; each gesture carries its own ender, so a new one is a
`kind` and an `arm` rather than a line in every block that dispatches.

⭐⭐ **The rule the survey was waiting for turned out not to need deciding — it was already in force
and one block had simply not been told.** *A gesture ends on the RELEASE, wherever that release
happens; leaving the canvas ends nothing.* Three paths see every release — `onDocMouseUp` (document,
capture), the canvas's own `mouseup`, and `handleMouseMove`'s `buttons === 0` for a release outside
the browser window — and every ender clears the session, so the redundancy is safe rather than three
commits. **One exception: the PAN**, settled by its own document pair because it is armed on a press
that may still be a tap.

🚨 **So `handleMouseLeave`'s six-gesture teardown was DEAD CODE, not an asymmetry to preserve.** It
sits behind `if (isMouseButtonDown) return`, and both assignments of that flag to `false` call
`handleMouseUp` first — so past the guard every gesture is already over. It had been unreachable
since the document listener landed (2026-08-20) and the button-down guard followed (2026-08-21);
the list had also fallen four gestures behind, which is what made it look like a rule.

⚠️ **One spec was standing on the dead path** — `MouseController.noteSpacingDrag.test.ts`'s *"leaving
the viewport mid-drag still commits"* passed only because that fixture never calls `setup()`, so the
document listeners were never attached and `isMouseButtonDown` stayed false. It asserted the opposite
of the shipped rule; it now asserts the rule, and the four span families pin it too
(`MouseController.markEndDrag.test.ts`). 5,099 → **5,109** tests.

⭐ The plan's trap was real and is handled: `isDraggingBarWidth` is not a gesture flag, it is the
past-the-dead-zone bit, so the session is armed from the PRESS and that boolean stays its own.

🚨 **The line-count estimate was wrong, and it matters for Phases 3–5.** The table below says Phase 1
removes ~1,000 lines. It removed **262** from the six families and added **266** in the driver — net
zero. The *composition* each family had rewritten is only ~45 lines; "the driver is ~40% of those
2,804 lines" counted the ports and lane machinery, which are genuinely per-family and stayed. ⭐ What
went is the DUPLICATION, not the volume — one composition instead of six, and the next family writes
a table row. ⚠️ Price Phases 3–5 on rows-not-copied, ⛔ not on lines.

**Coverage the collapse brought with it.** The four square drags had **no controller-level spec at
all** — the walks own the arithmetic, nothing covered the session. `markDrive.test.ts` (18) pins the
composition against a fake port; `MouseController.markEndDrag.test.ts` (28) is table-driven over all
four families (arming, the threshold, the preview reaching the right family, one commit at the drop,
the session clearing). 5,052 → **5,098** tests.

**Two bugs the hand-testing then found, both pre-existing, both fixed here.**
1. 🚨🚨 `PedalRenderer` and `OttavaRenderer` filed **every** fragment under the mark's FIRST
   placement's measure. The band limit looks a staff's geometry up by that number, so a fragment drawn
   on system 2 was judged against system 1's band — a permanent ~150 px overhang, which refused every
   downward nudge for ever while allowing every upward one. `pedalStaysInBand`'s own comment already
   promised *"each glyph is judged against ITS OWN system's band"*; the code just did not. Each
   fragment now registers under the bar it is drawn in.
2. The trill's end drag did not stop at a system break (`docs/trill-plan.md` §18).

**Logs added, and one of them is a rule.** The shared frame line carried only `dx`, so a
pure-vertical frame read as a hand that had not moved — that hid bug 1 for a whole round trip. It now
carries `dy`, says `frame REFUSED` when the model writes nothing, and `[Band]`/`[Page]` print the
numbers they judged. ⭐ **Never leave an axis out of the one line per frame.**

---

## Phase 2 — The four outlier functions *(≈½–1 day; orthogonal, parallelisable)*

Independent of the family work — different files, different risk profile. Can run on its own branch,
or by whoever is not on Phase 1.

| lines | function | what to do |
|---|---|---|
| 767 | `App.ts:113` · `createEditorApp` | Split the two phases it already is: `buildScoreDom()` returning the element bag, then `wireControllers(dom, state)` (22 constructions), then a short composer. 767 of `App.ts`'s 879 lines. |
| 555 | `ScoreRenderer.ts:3463` · `renderScore` | ⭐ **Flat, not nested** — 353 of 555 lines at one indent. A straight-line pipeline whose phases are *already marked by comment blocks*: resolve surface → resolve clefs per staff → compute widths → cast off → size the SVG → draw measures → post-passes. Extract each against the existing `RenderPass` state object. |
| 438 | `SlurRenderer.ts:541` · `renderSlurs` | Assess only. Slur geometry is the most-revised area in the repo (`project_slur_plan` §12); do not touch it in the same pass as everything else. |
| **375** | **`[A2]` `rebarOps.ts:320` · `pasteEvents`** | **⛔ Assess only — do NOT extract in this pass.** See below. |
| 337 | `ScoreRenderer.ts:1873` · `drawMeasureContent` | ⚠️ `measure` here is **the LANE**, not the bar (`reference_drawmeasurecontent_measure_is_the_lane`). Assess only; extract in a later pass if `renderScore` goes well. |

**`[A2]` On `pasteEvents` — the 4th-largest function in the repo, and missing from the first draft.**
It is an outlier function *and* a per-kind span site: **40 span-kind mentions across 8 distinct
blocks** — capture-before-id-regeneration, re-attach by onset+pitch, destination replacement, clip
re-anchor, each × the families. A sixth kind must be added at every one of them.

⛔ **It is nevertheless the wrong thing to extract in Phase 2, and the reason is the risk asymmetry
that makes it important in the first place.** Every other site in this plan mis-*draws* a glyph when
a kind is forgotten — visible, and caught by `test:e2e`. This one silently mis-*writes the score* on
a paste: a dropped hairpin, a re-voiced pedal, an ottava re-anchored to the wrong note. There is no
pixel to inspect, and the damage is in the user's document. ⭐ **So it is assessed in Phase 2 and
ported in Phase 4** — with the family, behind the table, where the port makes each of the 8 blocks a
row lookup instead of a fifth hand-written branch. Phase 4's per-family gate covers it.

⚠️ Read `rebarOps`'s own comments before touching it: the pedal "takes the ottava's road entire",
hairpins key on *where the wedge starts*, and only fully-enclosed spans are ever in a clip. Those
three sentences are the contract, and they are not the same across the families.

Also worth naming, though it collapses on its own in Phase 5: **`wireShortcuts` is 1,648 lines in a
single function taking 15 parameters**, holding yet another set of per-family closures
(`walkSlurHandles`, `walkHairpinHandles`, `walkOttavaHandles`, `walkPedalHandles`,
`walkTrillHandles`). The parameter list is the tell — it wants a deps object.

🚨 **Gate: `npm run test:e2e` either side of every renderer commit.** jsdom measures every glyph at
0×0, so unit tests agree with themselves about geometry
(`reference_jsdom_cannot_measure_glyphs`). Also check `viewStateKey` — a picture-only change that is
not in the key never runs (`reference_only_a_stale_render_runs`), and **e2e cannot catch that one**.

✅ **`[A6]` The gate has teeth — verified, so nobody downgrades it under time pressure.** The browser
suite is **8,166 lines across 27 specs**, and it carries a **dedicated geometry spec for every mark
this plan touches**: `hairpin.e2e.ts`, `ottava.e2e.ts`, `pedal.e2e.ts`, `trill.e2e.ts`,
`slur.e2e.ts`, plus `ladder.e2e.ts` for the below-staff rung order the four families share, and
`ghosts.e2e.ts` / `systems.e2e.ts` for the stamp and the break-wrap. Mark mentions in `e2e/`: trill
177, slur 168, ottava 88, hairpin 81, pedal 78. ⭐ This is *why* Phases 2 and 4 can be attempted at
all — the regression net for the riskiest work already exists and does not have to be written first.

---

## ✅ Phase 3 — `SpanMarkSpec`, one family — **DONE 2026-08-26**

Gated on Phase 1 succeeding and on **D2**.

Two tables, per D2, keyed by the same `SpanMarkKind`:

```
engine/models/spanMarkModel.ts     SPAN_MARK_MODEL  — ops, geometry, style, ghost
interactions/spanMarkTools.ts      SPAN_MARK_TOOLS  — port builders, handles, stamp
```

⚠️ Both are **frozen `Record`s of pure specs — data, not state**, so `lint:singletons` must not move.
That check reads SCREAMING_SNAKE as a lookup table and camelCase as state; the naming *is* the rule.

### ⭐⭐ `[A4]` THE ACCEPTANCE CRITERION: BOTH TABLES MUST BE TOTAL

**This plan adds two tables without saying what makes a table safe. This is that clause, and it is
the one thing in the amendments that must not be traded away.**

A registry is worth having **only when the compiler refuses to build a kind that forgot its row.**
That is not a style preference — it is the entire reason `interactions/elements/chain.ts` works,
and the difference between a table that prevents the next glissando bug and a table that merely
relocates it. Of the six registries a new kind must join today, **four are compiler-total and two
are arrays**:

| registry | shape | total? |
|---|---|---|
| `ELEMENT_SPECS` (`elements/chain.ts`) | `Record<SelectedElement['kind'], ElementKindSpec>` | ✅ |
| `GHOST_DRAWERS` (`GhostRenderer.ts`) | mapped type `{ [K in ToolGhost['kind']]: … }` | ✅ |
| `MARK_PREVIEW_FAMILIES` (`markPreviewPass.ts`) | `Record<MarkPreviewKind, MarkPreviewFamily>` | ✅ |
| `MARKING_TOOL_USES_ARMED_LENGTH` (`EditorState.ts`) | `Record<MarkingTool['kind'], boolean>` | ✅ |
| `ELEMENT_HIT_ORDER` (`elements/chain.ts`) | `ReadonlyArray<ClickableElementSpec>` | ⚠️ partial **by design** |
| `SCOPED_KINDS` (`markVoiceScope.ts`) | `ReadonlyArray<SelectionItem['kind']>` | ⚠️ partial — see `[A5]` |

`ELEMENT_HIT_ORDER`'s partiality is correct and documented: **order is the content** (it answers
"who wins a press two glyphs both cover"), and 2 of the 19 kinds are set by pre-steps rather than
hit-tested. An array is the right shape for a question whose answer is a sequence.

⭐ **So the rule is not "always use a `Record`" — it is: a table answering *what does kind K do?* must
be total; a table answering *in what order?* may be a list.** Both new tables answer the first
question. Therefore:

> **`SPAN_MARK_MODEL` and `SPAN_MARK_TOOLS` MUST be declared `Record<SpanMarkKind, …>` or a mapped
> type over `SpanMarkKind`. ⛔ Never an array, never a `Partial<…>`, never an index signature
> (`[k: string]: …`) — each of those three silently accepts a missing kind.**

⚠️ **The `Partial` temptation will arrive in Phase 4, and it must be refused.** Trill carries
`trillReanchor` / `trillPitch` with no counterpart, and the reflex is to reach for
`Partial<SpanMarkModelSpec>` so pedal need not mention them. ⭐ The correct move is the one Phase 4
already names: **the table stays total and the SPEC grows an optional MEMBER** — `reanchor?: …`
declared on the spec type, `undefined` on the rows that have none. A total table of specs with
optional members still fails to build on a missing *kind*; a `Partial` table does not. That is the
whole difference, and it is invisible until the kind that was forgotten ships.

**Stop condition, sharpened:** if the two tables cannot be made total — if some kind genuinely cannot
state a row — that is evidence the abstraction is wrong, and it belongs with Phase 3's existing
"say so and stop", not worked around with a `Partial`.

**Port `pedal` first.** It is the simplest of the four and the closest twin to ottava (51% / 57% /
64% across the layers). Move its spec, its port builders, its style constants and its ghost into the
two rows — and **move its specs with it**, per `CLAUDE.md` §Testing.

Stop condition: if porting pedal does not shrink pedal, the abstraction is wrong. Say so and stop —
the same way Phase 4 of the 2026-07-28 plan spiked to "no" and was closed.

---

### ✅ What actually happened

**The stop condition was met: pedal shrank, so Phase 4 is open.** The pedal's own per-kind logic went
from **111 code lines to 28** — its two table rows — a 75% cut, measured in code lines (comments
excluded, since this repo's files are mostly prose):

| pedal's own | before | after |
|---|---|---|
| `interactions/pedalStamp.ts` | 77 / **37** | **deleted** |
| `interactions/PedalGeometryController.ts` | 71 / **36** | **deleted** |
| `engine/rendering/PedalGhost.ts` | 79 / **28** | 55 / **7** |
| its five closures in `shortcutWiring` | — / **17** | — / **0** |
| its rows in the two tables | — | — / **28** |

**🚨 D2 was right about the fence and wrong about the addresses: it is THREE homes, not two.** The
plan puts "ops + geometry + style + **ghost**" in `engine/models/`. But `engine/models/` imports
`engine/rendering/` **nowhere** today, and a table there holding a ghost drawer would have been the
first arrow — the same cycle-shaped mistake Phase 1 hit when the driver could not live in
`markWalk.ts`. What shipped:

- `engine/models/spanMarkModel.ts` — `SPAN_MARK_MODEL`, the SCORE's vocabulary. ⚠️ It may name
  nothing above `engine/models/`: not `MusicEngine` (the *editor's* facade, §5), not the renderer. So
  it holds the `noun`, the `endNoun`, how the vertical is **signed** (`'screen' | 'outward'`) and
  `offsetOf(score, id, field)` — three numbers (two ends + one shared vertical) read off the
  compartment, **0** where the mark carries no nudge.
- `interactions/spanMarkTools.ts` — `SPAN_MARK_TOOLS`, the EDITOR's. It may name `MusicEngine`, the
  `bus` and the registry freely, and it does.
- `engine/rendering/ghostCursor.ts` — `drawSignGhost`, and **not a table at all**. The ghost
  duplication was never per-kind dispatch (`GHOST_DRAWERS` is already total); it was 35 lines of
  open-group → measure → recolour → park written out identically in three drawers. A helper is the
  honest shape, and it leaves a drawer as its SIGN and nothing else.

**⭐⭐ The `[A4]` totality was BREAK-TESTED, not asserted.** Adding `'ottava'` to `SpanMarkKind` makes
`tsc` refuse **both** tables by name (`TS2741: Property 'ottava' is missing`) — which is the whole
claim, checked rather than promised. `spanMarkModel.test.ts` and `spanMarkTools.test.ts` also assert
it at runtime, and the second pins the *other* drift: the two tables must stay keyed by one union.

**⭐ Nothing in the rows needs a cast, and that is a design choice worth keeping.** Each row is written
**at its own kind** — the pedal row calls `armedTool(state, 'pedal')` and `bus.pedalGeometry` **by
name** — so each seam's own spelling (`PedalGeometryRequest`'s `y` where the bracket has `outward`) is
translated *inside* the row that owns it, and the drivers above see one shape. The alternative, a
driver that narrows a union it was handed, is the correlated-union problem and would have needed a
cast per call.

**What ported, and what deliberately did not.** Ported: the stamp, the Properties geometry seam, the
five keyboard verbs, the ghost body. **Not** ported: `pedalOps` (830), `PedalRenderer` (629),
`pedalLane` (286), `pedalWalk` (500), `pedalHandles` (178), `elements/pedal.ts` (90). Measured against
ottava after normalising the nouns, those are **47–74% alike** where the ported four were **86–89%** —
i.e. they are where the families genuinely differ, and Phase 1 already took the one composition they
shared. ⭐ The rows POINT at them; they do not absorb them.

**🚨 The repo grew, and the report has to say so.** The five new shared modules are **264 code lines**
against **111** removed: net **+150** this phase. That is Phase 1's lesson holding —
**price it on rows-not-copied, ⛔ not on lines.** The drivers exist and exactly one family uses them;
the shrink lands in Phase 4, where each remaining kind trades ~110 code lines for ~28 of row.
⚠️ So the sequence table's "~1,500 lines" for Phase 3 was wrong in the same direction as Phase 1's
"~1,000", and **Phase 4's "~5,000–6,500" should be read as ~110 code lines × 4 families plus whatever
the ops/renderer collapse turns out to be worth — ⛔ not as a line count already earned.**

**⭐⭐ D1 has its first real evidence, and it points at NO.** Building the geometry driver put the five
controllers side by side: pedal, ottava and trill are the same 36 code lines with three nouns changed,
while **hairpin** carries an `aperture` case and a `null`-means-RESET case, and **slur** carries
control points, a whole-curve target and its own reset. The wedge did not fit the *simplest* member of
the family. That is one data point, not the decision — Phase 4 takes it on the evidence of ottava and
trill — but it is the direction the plan guessed.

**Gate.** `build:check` clean, **5,122 unit tests passed / 7 skipped** (5,109 → +13), and
`npm run test:e2e` **226 passed** either side — run because `PedalGhost` is drawn ink, per the plan's
own rule about jsdom.

---

## Phase 4 — Port ottava, then trill; then decide hairpin — **OTTAVA + TRILL DONE 2026-08-26**

In that order — increasing distance from the shared shape.

- **ottava** — ✅ **DONE, and it was near-mechanical exactly as predicted.**

  ⭐⭐ **THE RESULT THAT VALIDATES PHASE 3: all four shared drivers took the ottava with ZERO
  changes.** `git diff` on `spanMarkStamp.ts`, `SpanMarkGeometryController.ts`, `spanMarkKeys.ts` and
  `ghostCursor.drawSignGhost` is **empty** — the second kind is two table rows and four call sites
  re-pointed, which is what the abstraction promised and had not yet been asked to prove.

  | ottava's own | code lines |
  |---|---|
  | `interactions/ottavaStamp.ts` | **38** → deleted |
  | `interactions/OttavaGeometryController.ts` | **36** → deleted |
  | `engine/rendering/OttavaGhost.ts` | **31** → **11** |
  | its five closures in `shortcutWiring` | **23** → **0** |
  | its two rows | — → **34** |

  **117 code lines → 34.** ⭐ And the running total turns: Phase 3 was **+150** (drivers with one
  user), the ottava is **−83**, so the family is at **+67** with three kinds still to come. The
  crossover lands inside Phase 4, as the rows-not-copied pricing predicted.

  ⭐⭐ **The one genuine difference is now a ROW MEMBER, not a branch**: `verticalSign`. Every other
  kind passes the keyboard's screen delta through; a bracket negates it above the staff, because `↑`
  is a screen direction while the stored number is `outward` — and it asks the MODEL for the side each
  time, since `x` flips a bracket and two marks of one kind can want opposite signs at once. ⚠️ Both
  the `[A4]` totality and this flip were **break-tested**: adding a kind with no row fails `tsc` by
  name, and replacing the ottava's `verticalSign` with the pedal's `() => 1` reddens two specs.
- **trill** — ✅ **DONE, and the predicted `Partial` temptation never arrived.** `trillReanchor` and
  `trillPitch` are reached by gestures this family does not share (`Ctrl+Shift` re-anchor, the pitch
  keys), so they were never candidates for a row. The spec did **not** grow an optional member; the
  table did **not** grow a special case. **117 code lines → 28**, and the four drivers were again
  unchanged.

  ⚠️ **One real signature change, and it belongs in the record.** `walkArmedTrillEndpoint(state,
  engine, dx)` read the armed square off `EditorState` itself; its siblings take `(engine, id, which,
  dx)`. It is now `walkTrillEndpoint` with the siblings' shape — the `state` was only ever used to
  re-derive what the caller already knew. ⭐ **A decline moved layers as a result**: "no square armed"
  was that module's answer and is now the driver's, so `trillWalk.test.ts`'s case for it moved to
  `spanMarkKeys.test.ts`. The old spec case is replaced by a note saying where the rule went and why
  ⛔ not to re-add it.

  🚨 **The break-test found an UNCOVERED RULE, which is the best thing this port produced.** Replacing
  the trill's `verticalSign` with `() => 1` left **all 1,687 interaction specs green** — the
  screen→outward conversion had lived in a `shortcutWiring` closure since it was written and nothing
  had ever asserted it. It is covered now (three cases, and they redden when the flip is removed).
  ⭐ That is the refactor paying in a currency the line count cannot show: one home per kind per rule,
  so a missing test is visible instead of buried in a closure.
- **hairpin** — ⛔ **do not start until D1 is answered on the evidence of the first three.** If it
  joins, `hairpinShape` / `hairpinBreaks` / the aperture stay family-specific modules the spec points
  at; if it does not, it keeps its own stack and the table has three rows. Three is still worth it.

Expected across Phases 3–4: **~6,000–8,000 lines collapsed**, source and test together.

🚨 Every family here draws. `test:e2e` either side of each port, and re-read
`reference_a_placement_view_is_a_frozen_lane_copy` before touching any `*Renderer` — a mark must be
resolved from the SCORE plus `staffIndexOfId`, never from a placement's frozen `view`.

**`[A2]` Port each family's `pasteEvents` blocks with it.** Per Phase 2, the 8 per-kind blocks in
`rebarOps.pasteEvents` are ported here rather than extracted there — the family's row is what turns
each block from a hand-written branch into a lookup. ⚠️ This is the one part of Phase 4 that
`test:e2e` does **not** cover, because nothing is drawn: a paste writes the model. **Its gate is unit
tests on `rebarOps`, and they must be written before the port, not after** — the failure mode is a
silently corrupted paste, which no pixel will show.

### ⚠️ `[A5]` Make `SCOPED_KINDS` total while D1 is open

`interactions/markVoiceScope.ts:41` is the one registry where partiality is a **hazard rather than a
design choice**:

```ts
export const SCOPED_KINDS: ReadonlyArray<SelectionItem['kind']> = ['dynamic', 'hairpin']
```

A hand-written array of *which kinds carry a voice scope*. A kind that should be scoped and has no
row here is **silently unscoped** — no build error, no test failure, no visual difference until
someone plays back a score and the wrong voices respond.

⭐ **This is the same silent failure `project_dynamic_voice_scope` already warns about**, and this
plan already flags it at the bottom: *"absent means all voices of its staff … getting it wrong is
silent."* Two facts make Phase 4 exactly the right moment:

1. **D1 is precisely a question about hairpin's scope semantics.** The asymmetry is being reasoned
   about here anyway.
2. **Its own comment says a row is the whole of adding a third** — which is true, and is exactly why
   forgetting the row costs nothing at build time and everything at playback.

**Do:** replace the array with a total map, `Record<SelectionItem['kind'], boolean>` (or
`VoiceScopeSpec | null` if a scoped kind ever needs more than a yes), so every existing kind must
answer and every future one must too. ⛔ This is a **type-shape change only** — the two `true` rows
stay `dynamic` and `hairpin`, and no runtime behaviour changes. Anything else is D1's business,
not this amendment's.

⚠️ **Whichever way D1 lands, the asymmetry is a spec MEMBER, never a shared default.** If hairpin
joins the table with `scope` defaulted rather than declared, the mark family inherits `voiceOf()`
semantics — and `voiceOf()` is documented as *wrong* for both members of the dynamics family.

---

## Phase 5 — Collapse the verb families, **on both layers** *(≈1 day; falls out of 3–4)*

**`[A1]` This phase has two halves. The first draft had only the facade.**

### 5a — `MusicEngine`, the editor's facade

`MusicEngine` is **5,899 lines, 378 methods** — and **170 of them sit in parallel verb families**:

```
10 × nudge{}                 BarWidth BarlineSpace Hairpin NoteOffset NoteSpacing
                             Ottava Pedal Slur StaffSpacing Trill
 7 × reset{}Offset  preview{}Offset  get{}SVGGroup
 6 × rebase{}Offset  commit{}Drag  remove{}  get{}s  get{}ById  preview{}OffsetRebase
 5 × nudge{}Endpoint  preview{}EndpointOffset  reset{}EndpointOffset  create{}  add{}
      … 43 verb-shapes in total
```

The count grows as *kinds × verbs*, and both factors are still growing. Once Phases 3–4 make the
kind a table row, a driver takes `(kind, id, …)` and the named-pair methods stop being necessary.

⛔ **Do not split `MusicEngine` into partial classes** — that moves lines without removing any. The
only two things that shrink it are the F1 collapse and the rule in Phase 6.

**Independently re-derived 2026-08-24:** 378 methods, of which **148 (39%) are span-named** — hairpin
34, pedal 32, ottava 30, trill 27, **slur 25**. §2's per-family figures matched to the method; slur
is the fifth member the facade count should include.

### `[A1]` 5b — `ScoreModel`, the layer beneath

⚠️ **`ScoreModel` has the same verb-family problem and was absent from the plan.** It carries **96
per-kind span methods** — hairpin 24, ottava 20, pedal 20, slur 17, trill 15 — in 3,497 lines. Collapse
5a alone and glissando still costs **~20 hand-written methods here**, one layer down, where nobody is
looking because the facade got tidy.

⭐ **The distinction that makes this safe is `DESIGN-PRINCIPLES.md` §5, and it cuts the opposite way
from 5a.** `MusicEngine` is the *editor's* facade — collapsing its verb families is cosmetic, because
nothing there is a score operation. `ScoreModel` **is** the score layer: these 96 methods are the real
mutation API. So:

- ✅ **Collapse the delegation shape** — `setHairpinOffset` / `setOttavaOffset` / `setPedalOffset` are
  one operation over `SPAN_MARK_MODEL`, keyed by kind, and become one method taking `(kind, id, …)`.
- ⛔ **Nothing migrates onto `MusicEngine` in the process.** The score layer keeps the full mutation
  API; 5a removes *delegations*, never *capabilities*. If a 5a collapse would leave an operation with
  no home in `engine/models/**`, the collapse is wrong, not the layering.
- ⚠️ **`saveUndoState` is the trap.** Every mutator here saves an undo entry
  (`reference_mutators_must_save_undo_state`); skipping it costs both undo *and* the repaint. When N
  named methods become one keyed driver, the save must move **into the driver** — and a test per kind
  must assert an undo entry is still written, because a missing one is invisible until someone
  presses `Ctrl+Z`.

**Order: 5a then 5b.** 5a is the cheap, low-risk half and proves the keyed-driver shape on a layer
where a mistake is cosmetic. 5b then applies the proven shape where a mistake is not.

---

## ✅ Phase 6 — **DONE 2026-08-26, and REDUCED — two of its four parts were refused**

⚠️ **The drafted clause below is NOT what was written down, and the difference matters.** It says
*"the feature is a **row**, not a stack."* Phase 5's measurement contradicts the strong form: most of
a family's bulk — `pedalOps` 830, `PedalRenderer` 629, `pedalWalk` 500, `pedalLane` 286 — is genuinely
per-kind and cannot be a row, which this plan itself says when it has the rows POINT at them. Four of
the family's ~14 sites became rows; ten did not. Writing the clause as drafted would enshrine the
very error that produced four wrong estimates in a row.

**What went into `docs/ARCHITECTURE.md` instead** (§"…and the other direction: a name is not a
body"), stated as what was measured rather than what was predicted:

> **Collapse a copy only when the copy has a BODY.** The trade is `N × body` removed against
> `1 × driver + N × row + one fixed contract`, and a row is never free — each kind still has to
> speak, it just speaks as data instead of as code.

…with the hub clause kept, because that half held up: **count the hubs, not just the modules.**
⛔ It went in `ARCHITECTURE.md` and **not** `CLAUDE.md`: that file's rules should be things that
change what you DO, and this is a thing you learn once and then measure.

**✅ The `[A4]` declaration guard was built** — `scripts/check-total-tables.mjs`, wired into
`build:check` as `lint:tables`. `tsc` enforces totality *given* the declaration; nothing stopped a
future edit from weakening `Record<SpanMarkKind, …>` to a `Partial<…>` to make one awkward kind fit,
which is the one move that silently ends the whole abstraction's value. It refuses four shapes —
`Partial<…>`, an index signature, an array, and a missing annotation — and covers `SPAN_MARK_MODEL`,
`SPAN_MARK_TOOLS`, `ELEMENT_SPECS` and `MARKING_TOOL_USES_ARMED_LENGTH`. **All four failure modes
were break-tested**; ⭐ `ELEMENT_HIT_ORDER` is deliberately NOT covered, because a table answering
*"in what order?"* is legitimately a list.

**⛔ The filename-parity script was REFUSED.** Run today it fails on `hairpinStamp.ts` and
`slurStamp.ts` — both correct (D1 answered no for the wedge; the slur was never in this family) — so
its first act would be an allowlist of the two most carefully-made decisions in the plan. ⭐ A check
that starts life with hand-maintained exceptions is the rot `check-test-names.mjs`'s own comment
warns about, and it would only ever have seen filenames, never duplication.

**⏭️ `[A5]` `SCOPED_KINDS` was NOT done and is not part of this.** It is still
`ReadonlyArray<SelectionItem['kind']> = ['dynamic', 'hairpin']` in `interactions/markVoiceScope.ts` —
a partial registry that fails **silently at playback** rather than loudly at build. That is a real
bug class and it stands on its own merits; ⛔ it should not be bundled with a phase whose premise did
not hold.

---

### The original draft, kept for the record

The rule caught what it named and missed what it did not — **twice now, by its own account**
(2026-07-18 undone in nine days; 2026-07-28 extended from three files to eight). The gap this time:

> **A fourth copy of a stack is not a new module.** When the module you are adding is the *N*th
> rendering of an existing family — same layer, same neighbours, same verbs with a different noun —
> the feature is a **row**, not a stack. Add it to the family's table, or say in the plan why this
> one cannot be a row.

Goes in `CLAUDE.md` §Important Rules and `docs/ARCHITECTURE.md` §"A new feature adds a MODULE",
beside the eight-file clause it extends.

⭐ **And a script behind it**, per 2026-07-27 Phase 0c (*a comment asserting a repo fact gets a check*).
The cheap, honest version: `scripts/check-span-mark-parity.mjs` fails the build when a file matches
a family basename pattern (`<kind>Walk.ts`, `<kind>Ops.ts`, `<kind>Stamp.ts`, `<kind>Ghost.ts`,
`<kind>GeometryController.ts`, …) for a `kind` that is **not** a row in `SPAN_MARK_MODEL`. It cannot
detect duplication in general; it can detect *this* duplication recurring, which is the one that has
actually happened.

**`[A4]` Give the script a second, cheaper assertion: the tables stay total.** Grep that
`SPAN_MARK_MODEL` and `SPAN_MARK_TOOLS` are declared `Record<SpanMarkKind, …>` or a mapped type over
it — and ⛔ **fail on `Partial<`, on an index signature, and on an array literal type.** `tsc` already
enforces totality *given* the declaration; what nothing checks is that a future edit does not quietly
weaken the declaration itself to make one awkward kind fit. That is a three-line check guarding the
invariant the whole abstraction rests on (Phase 3 `[A4]`).

⭐ **`[A5]` Same check, same three lines, for `SCOPED_KINDS`** once Phase 4 makes it total — it is the
registry whose partiality fails silently at playback rather than loudly at build.

⚠️ Write it before glissando, not after.

**`[A1]` `[A2]` And extend the rule's prose past the module layer.** The clause as drafted says *a
fourth copy of a stack is not a new module* — true, and it catches the eleven-module stack. But §2's
second table shows the cost is also **fourteen shared hubs**, and the two heaviest of those
(`ScoreModel` 96 methods, `rebarOps.pasteEvents` 8 blocks) were missed by a review that read the
stack. So the clause should end:

> …**and count the hubs, not just the modules.** A kind that adds no module can still add a slice to
> a dozen shared files. Before adding one, list the hubs it touches; if the list is longer than the
> table row, the row is not finished.

---

## Sequence, and what each phase is worth

| # | phase | effort | risk | removes | makes cheap |
|---|---|---|---|---|---|
| 0 | ✅ subtraction | ~~1–2 h~~ **½ day** | none | **83** dead lines, ~~~80~~ ~~242~~ **231** exports | seeing the real seams |
| 1 | ✅ drag driver **(spike)** | ½–1 day | low | ~~**~1,000** lines~~ **net 0** — 6 copies → 1; 8 methods → 3; **28 fields → 1**; **13 flags → 1**, 20 `if`s → 1 call | the Phase 3 decision, cheaply — **taken: it works** |
| 2 | outlier functions | ½–1 day | medium | 0 — it is navigation | reading `renderScore` and `App.ts` |
| 3 | ✅ `SpanMarkSpec` + pedal | 1–2 days | **medium** | ~~~1,500 lines~~ pedal's own **111 code lines → 28** (a row); repo **+150** | the shape for the rest — **taken: it shrinks** |
| 4 | ottava ✅, trill ✅, ⟨hairpin — **D1 says no**⟩ | 2–3 days | medium | ~~**~5,000–6,500** lines~~ per kind: **117 code lines → ~30**, measured 3× | one row per kind at **4 of the 14 hubs** |
| 5 | verb families — **5a facade + 5b `ScoreModel`** | ~~½~~ **1 day** | low (5a) / **medium (5b)** | ~170 + **96** methods | every future kind |
| 6 | the rule + its check | 30 min | none | — | all of the above staying done |

**`[amended]` Three estimates moved, all for reasons verified against the code:** Phase 0 is ~3× the
symbol count first measured (still zero risk); Phase 5 gained the `ScoreModel` half; Phase 1 gained
the 17 drag flags — and Phase 1's four handlers turned out to be 49–57 lines rather than 30–31, which
is the one correction that cuts in the plan's favour.

**Order: 0 → 1 → (2 ∥ 3) → 4 → 5 → 6.** Phase 0 is free and unblocks nothing but clears noise.
Phase 1 is the spike and **gates Phase 3**. Phase 2 is orthogonal — run it in parallel or skip it
without affecting anything else. Phase 5 cannot start before 4 and takes almost no time once it can.

**Stop after any phase and the tree is green.** Every phase keeps `build:check` and the 5,052 unit
tests passing; Phases 2 and 4 additionally require `npm run test:e2e` either side, since
`build:check` is deliberately browser-free.

---

## Checked against DESIGN-PRINCIPLES (2026-08-24)

| phase | principle |
|---|---|
| 0 | none engaged — removal only. |
| 1 | editor-internal. The driver lives in `interactions/` and reads ports; it makes no claim about the model. |
| 2 | §3 — *content and presentation are separate*. `renderScore`'s phases are all presentation; extracting them must not let a layout result reach the model. Watch that `RenderPass` stays the only carrier. |
| 3, 4 | **§5, and this is the one to get right.** The score layer holds the full mutation API; `MusicEngine` is the *editor's* facade. `SPAN_MARK_MODEL` stays inside `engine/models/**` and `SPAN_MARK_TOOLS` inside `interactions/**` — **two tables, not one** — because one object naming both sides would cross the arrow `lint:boundary` enforces. ⚠️ This is exactly the trap the 2026-07-28 plan's Phase 2 fell into and had to amend: *"editor-internal, so §5 does not apply" is safe only once you have checked which file the types live in.* |
| 3, 4 | §1 — no module-level mutable state. Both tables are frozen `Record`s of pure specs. `lint:singletons` must not move; SCREAMING_SNAKE naming is what tells the check they are data. |
| 5a | §5 again — collapsing delegations changes the facade's *shape*, never what the core can do. No score operation may migrate onto `MusicEngine` in the process. |
| **5b** | **`[A1]` §5 at its sharpest, and the reason 5b is the riskier half.** `ScoreModel` **is** the score layer, so its 96 span methods are the real mutation API — not delegations. Collapsing their *shape* into a keyed driver is allowed; letting any of them migrate onto `MusicEngine` is the §5 violation this whole document exists to avoid. ⚠️ Plus `reference_mutators_must_save_undo_state`: the `saveUndoState` moves into the driver, with a per-kind test, or undo breaks silently. |
| 6 | 2026-07-27 Phase 0c — the rule gets a script behind it. **`[A4]` `[A5]` The check also guards the totality of both new tables and of `SCOPED_KINDS`.** |

⭐ **One thing to watch in Phase 4.** `project_dynamic_voice_scope` records that a dynamic's and a
hairpin's voice scope is **not** `voiceOf()` — absent means *all voices of its staff*. If hairpin
joins the table, that asymmetry is a spec member, not a shared default. Getting it wrong is silent.
**`[A5]` makes that warning enforceable rather than remembered** — see Phase 4.

---

## Amendments index (2026-08-24, second review)

An independent full-codebase pass reached this plan's diagnosis on its own evidence, so **the
argument, the phase order and the stop conditions are unchanged.** Six additions and four numeric
corrections:

| tag | amendment | where | why it matters |
|---|---|---|---|
| **A1** | `ScoreModel` — **96 per-kind span methods**, absent from the plan | §2 table · **Phase 5b** (new) | Collapse the facade alone and glissando still costs ~20 hand-written methods one layer down |
| **A2** | `rebarOps.pasteEvents` — 375 lines, 8 per-kind blocks | §2 table · Phase 2 · Phase 4 | The only site whose failure mode is a **silently corrupted score**, not a mis-drawn glyph |
| **A3** | `MarkWalkPort` has **six** implementors, not four | §3 · Phase 1 | Bigger payoff, and the driver must be written against *the walk*, not *a span* |
| **A4** | ⭐⭐ **Both new tables must be TOTAL** | **Phase 3** (new §) · Phase 6 | The invariant the whole abstraction rests on, and the one the plan never stated |
| **A5** | `SCOPED_KINDS` is the one silently-partial registry | Phase 4 (new §) · Phase 6 | Fails at playback, not at build — and D1 is already reasoning about it |
| **A6** | The e2e gate has **verified teeth** (8,166 lines, per-mark suites) | Phase 2 | Phases 2 and 4 are attemptable *because* the net already exists |

| correction | was | is | direction |
|---|---|---|---|
| `handle*EndDrag` size | 30–31 lines | **49–57** | ⬆ **in the plan's favour** — Phase 1 pays more |
| Over-exposed exports | ~80 | **242** | ⬇ Phase 0 re-budgeted 1–2 h → ½ day |
| `MouseController` fields | 135 | **147** (+95 methods, **17 `isDragging*` flags**) | ⬆ Phase 1a scope grew |
| `any` | 18 | **~27** | — conclusion unchanged (the `@ts-ignore` **0** is the load-bearing figure) |

**Verified unchanged:** the baseline (`build:check` exit 0; 5,052 passed / 7 skipped); all three
Phase 0 dead-code claims (one occurrence each, no callers in `src/`, `e2e/` or `scripts/`); the
per-family `MusicEngine` counts in §2 (34/32/30/27, matched to the method); `wireShortcuts` at 1,648
lines (14 parameters, not 15); and the existence and liveness of `markWalk` / `markBreakWrap` /
`markSystemJump`.

⭐ **The three judgements the second review would most want kept:** the refusal of a cleanliness
phase (the hygiene numbers genuinely do not support one), Phase 1 as a *gating* spike, and Phase 3's
stop condition — *"if porting pedal does not shrink pedal, say so and stop"* — which remains the
single most valuable sentence in this document.

---

## 🚨 The ledger after three kinds (2026-08-26) — read this before Phase 5

**Tree-wide source: 48,491 → 48,451 code lines. Minus forty.** That is the whole size effect of
Phases 3 and 4, against a plan that predicted **~6,000–8,000 lines collapsed across the two**.

Per kind the trade is good and consistent — **117 code lines of copy → ~30 of row**, measured three
times. What ate it is a **fixed contract of 49 code lines** (ten declared members on
`SpanMarkToolSpec`, plus `SpanMarkModelSpec`, `SpanMarkGeometryTarget`, `SpanMarkStampAction`) that
duplicated functions never had to pay, and the fact that **each kind still speaks — as a row instead
of as code.** "Two functions → one" is really "two bodies → one body + two rows". Break-even was
~2.6 kinds; we crossed it at three.

Per site, across pedal + ottava + trill:

| site | before | after | net |
|---|---|---|---|
| stamp | 3 copies | 1 driver + 3 rows | **−49** |
| geometry controller | 3 copies | 1 driver | **−73** |
| ghost | 3 copies | 1 helper + 3 drawers | **−31** |
| keyboard verbs | 3 sets of closures | 1 module + wrappers that REMAIN | **+19** |

⛔ **The keyboard-verb extraction was a mistake and should not be repeated.** Those closures were
3–5 lines each; collapsing them cost more than it saved, and the per-family wrappers still exist
because they still have to call `renderScore()`. ⭐ **The rule it teaches: collapse a copy only when
the COPY has a body.** A three-line delegation is not a slice worth a row.

⚠️ **And the plan's headline claim needs restating honestly.** It said a sixth kind "touches all
fourteen hubs". This work changed **4 of those 14** — stamp, Properties seam, ghost, keys. A new kind
still writes its own ops, renderer, lane, walk, handles, element spec, bus store, palette entry,
`rebarOps` blocks, playback and Properties wiring. ⛔ The plan also names **glissando** as the sixth
kind; that is an assumption, not a decision — it is not scheduled, and a note-to-note line has more
in common with a tie than with a region mark on a below-staff rung. **Do not use it to justify
further phases.**

**What the three phases actually bought, in present tense:**
1. Four sites that were literally the same function written 3× are now written once.
2. Forgetting a kind at one of those sites is a **build error**, verified by break-test.
3. A rule that had no test for its whole life (the trill's screen→outward flip) became visible and is
   now covered — found by break-testing, not by reading.

**🚨 Four estimates in this plan are now wrong in the same direction:** Phase 1 predicted −1,000 and
delivered 0; Phase 3 predicted −1,500 and delivered +150; Phase 4 predicted −5,000–6,500 and
delivered −190; Phases 3+4 together predicted −6,000–8,000 and delivered −40. **⛔ Phase 5's "~170 +
96 methods" comes from the same source and must be MEASURED before it is scheduled.**

---

## ⛔ Phase 5, MEASURED 2026-08-26 — **it does not exist. Close it.**

The plan schedules Phase 5 as *"~170 + 96 methods"* across `MusicEngine` (5a) and `ScoreModel` (5b),
a day's work, and calls it *"every future kind"*'s payoff. The counts are right. **What they are made
of is not what the plan assumes.**

| | span-named methods | signature | **body** | doc comment | footprint |
|---|---|---|---|---|---|
| `MusicEngine` | 147 of 345 | 164 | **454** | 846 | 1,464 |
| `ScoreModel` | 96 of 225 | 111 | **96** | 161 | 368 |

**🚨 5b is the keyboard-verb mistake at 20× scale — ⛔ do not do it.** Of `ScoreModel`'s 96 span
methods, **91 have a ONE-LINE body**; the whole 96 come to **98 code lines of body between them.**
They are delegations, not copies. Collapsing them to a table costs a row per kind per verb — 5 × 16
shared verbs = 80 rows minimum — to remove 98 lines. That is the rule this session already learned
the hard way, stated again: ⭐ **collapse a copy only when the COPY HAS A BODY.**

**5a is nearly the same story.** `MusicEngine`'s span methods have a **median body of 3 lines**; 117
of 147 are ≤3. A table can reach at most **104 of the 147** (25 verbs shared by ≥3 kinds); the other
43 are unique to one kind and have nothing to share with. Optimistically that trades ~430 code lines
for ~180 of generic methods + ~125 of rows + ~50 of contract — call it **−75**, on the repo's
most-read facade, with **846 lines of per-kind doc comment** to relocate without losing the reasoning
they carry. ⛔ Not worth it.

**⭐ What the measurement DID find — the one real duplication, and it is a single verb.** Exactly
eight span methods on `MusicEngine` have a body of ≥7 lines, and five of them are `create«K»`:

```
19 createSlur   17 createTrill   16 createOttava   16 createPedal   16 createHairpin
```

Normalised for the noun, **`createOttava` / `createPedal` / `createHairpin` are 82–94% identical** —
resolve the note ids, drop rests, keep one staff, sort, take first and last, call the model, save the
undo entry. `createSlur` and `createTrill` are genuinely different (32–57%). So the honest
opportunity is **one verb × three kinds ≈ 48 code lines**, worth perhaps **−25** after the rows.

**Verdict: Phase 5 is not a phase.** It is one optional half-hour on `createX`, and it is not worth
opening the span-mark thread again for. ⭐ The plan's estimate was not merely too high — it counted
METHOD NAMES and assumed each name was a copy. **A name is not a body.** That is the correction this
plan most needs recorded, and it is why the four earlier estimates were all wrong the same way.

### Where the thread stands

- **DONE:** Phase 0 (subtraction), Phase 1 (the drag driver), Phase 3 (two tables + pedal),
  Phase 4 (ottava + trill).
- **⛔ CLOSED, measured:** Phase 5 (above). Phase 2 removes nothing by its own admission.
  Phase 4-hairpin — D1 answers **no** on the evidence: the wedge did not fit the simplest driver
  (`aperture`, a `null`-means-reset case), and slur fits less.
- **⏭️ OPEN, cheap:** Phase 6 — write the missing clause down (30 min). It now has two clauses to
  write, not one: *count the HUBS, not just the modules*, and ⭐ *a name is not a body — collapse a
  copy only when the copy has a body.*
