# Refactor Plan — Structure & Scale Pass (2026-07-27)

Branch: `refactor/review-2026-07`.

Outcome of a second full code review (all 159 source modules read; gates run). Baseline:
`tsc --noEmit` clean, **2517 tests green** (114 files), `lint:boundary` + `lint:testnames`
clean, `npm run lint` 10 trivial errors, **0 E2E tests**.

The first pass (`docs/refactor-plan.md`, 2026-07-18) fixed *content* — bugs, dead code,
duplicated rules, one split. All five phases shipped. This pass is about *shape*: the
places where feature `n+1` costs more than feature `n`.

---

## The argument

The previous plan's Phase 5 split `rebarOps` out of `ScoreModel` — 3,714 → 2,817 lines.
Nine days and 211 commits later:

| file | after 2026-07-18 refactor | now | Δ |
|---|---|---|---|
| `rendering/VexFlowRenderer.ts` | 3,324 | 5,491 | **+2,167** |
| `MusicEngine.ts` | 2,424 | 3,696 | **+1,272** |
| `models/ScoreModel.ts` | 2,817 | 3,663 | **+846** |
| `interactions/PaletteController.ts` | 1,423 | 2,211 | +788 |
| `interactions/MouseController.ts` | 1,960 | 2,558 | +598 |

ScoreModel grew back everything the split removed, in nine days. **Extraction without a
rule is a rounding error.** So this plan ends with a standing convention (Phase 6), and
every phase before it is chosen to make that convention cheap to follow.

The features were good and the growth was earned — fanned beams, tremolos, bar width, note
spacing all landed in that window. Nothing here says slow down. It says: the next ten
features should land in ten modules, not in three files.

---

## Context — this will one day be a package (2026-07-27)

Stated goal: **publish as a node module so it can be part of a wider ecosystem, while still
working standalone.** Far future, no date. It does not add a phase to this plan, but it
sharpens three of them (0d, 3b, 3d, 6c below) and it decides one thing that would otherwise
be arbitrary.

**The good news: the boundary already exists and is already enforced.**
`docs/DESIGN-PRINCIPLES.md` §5 is, nearly word for word, a library spec —

> *"everything you can do to musical material must be doable with no editor, no renderer,
> and no DOM"* … *"The score layer (`engine/models/**`, `utils/**`, `types/**`) is complete
> and self-sufficient … it is what makes a score usable outside this application at all."*

— and `lint:boundary` fences exactly those three directories against DOM, VexFlow,
rendering, audio and `MusicEngine`. **Verified 2026-07-27: the fence holds. The only thing
production core code imports from outside itself is `uuid`.** So the core is already a
package; it simply has no `package.json`. That is a much stronger starting position than a
project usually has at this point, and the job of this plan is to *not spend it*.

*(One test — `ScoreModel.tremoloPair.test.ts:5` — imports `interactions/clipboard`. By this
project's own test-layout rule that is a feature test and belongs in a `__tests__/`. Not a
production leak; worth moving when convenient.)*

**The one thing that is not ready: singletons.** §1 says *"nothing assumes there is exactly
one model / renderer / viewport"* and names **embedding** and side-by-side comparison
explicitly. The score layer honours it. The UI bus does not — there are **24 module-level
singletons** (20 `*Selection` stores + `windows` + `menus` + `renderCensus`). Two editors on
one page would share one `durationSelection`.

**Decision taken: "probably yes, but not deciding now."** So the goal is *not* to
de-singleton — it is to make that decision **cheap to take later**. See Phase 3b: the work is
collapsing 20 named singleton exports into ONE bus object, which turns the eventual switch
from a 26-file sweep into threading a single parameter. That collapse is worth doing on its
own merits and has to happen once either way.

**Explicitly NOT in this pass:** no monorepo, no `exports`/`main`/`files` map, no
`build.lib`, no repo split. Those are cheap when actually done and a tax if carried early.
See *When we package* at the end for the real publish-time work, parked.

---

## Phase 0 — Close the ratchets *(≈15 min)*

Two mechanical fixes and one convention, so nothing new leaks in during the phases below.

**0a. Make `lint` a build gate.** `ARCHITECTURE.md` claims a "pre-existing backlog of
unrelated lint findings". There are 10: six `no-extra-semi`, one irregular whitespace
(`export/outlineText.ts:212`), two unused vars (`windows/keypad/keypadLayouts.ts:264`
`'rework'`; `windows/tupletWindow.ts:3` `TupletBracketEnd`). Seven are `--fix`-able.

- `npx eslint . --ext .ts --fix`, delete the two unused, add `lint` to `build:check`.
- Update the stale sentence in `ARCHITECTURE.md`.

**0b. Fix the second stale claim.** `ARCHITECTURE.md`'s jsdom section says *"Playwright
(`npm run test:e2e`) stays the source of truth"* for glyph geometry. There is no
`playwright.config.*` and no spec file. Either state that plainly, or land Phase 5 — but
the doc must not point at a net that isn't strung.

**0c. The convention behind both.** A comment asserting a *design* fact ("N:M is two ints,
never a Fraction") cannot rot — the code enforces it. A comment asserting a *repo* fact
("this check runs", "this file is the source of truth") can, and both instances above did.

> **Rule:** a comment that asserts a fact about the repository gets a script or test behind
> it. `scripts/check-test-names.mjs` is the model.

**0d. Get `import.meta.env` out of the core.** `ScoreModel.ts:108` reads it for
`STRICT_INVARIANTS`. It is `try/catch`-guarded so it degrades — but it is the **only
bundler-specific coupling inside the core fence**, and a published package must not reach
for a Vite global. Take it as a module-level toggle or read a neutral `process.env.NODE_ENV`
via a tiny `utils/env.ts`. Two lines.

*(`export/exportFonts.ts:51` and `windows/symbols/smufl.ts:69` read `import.meta.env.BASE_URL`
for asset paths, and `audio/WebAudioFontInstrument.ts:45` hardcodes the sample CDN. Real
packaging work, but all in the **editor** layer — parked to* When we package.*)*

**0e. Re-true `DESIGN-PRINCIPLES.md`.** Checked against the code 2026-07-27: **the five
principles have not rotted at all — the status reports under them have.** Two numbers in
*Known boundary cases* are now false:

- *"**Thirteen** module-level singletons"* → there are **25**. This matters beyond tidiness:
  that entry's whole cost argument is *"a contained sweep **because the list is known and
  short**"*, and the list has nearly doubled since it was written. It is the doc's own
  warning firing, and the best evidence for doing 3b now rather than later.
- *"one of the **four** assumptions above"* (How to use this) → there are **five**;
  principle 5 was added later and this line was not.

Per 0c, the first is greppable in one line, so it gets a check rather than a promise —
`scripts/check-singletons.mjs`, failing if the count drifts from what the doc claims.

**…and promote the positional rule to principle 6.** *"A notational statement which can
change mid-score is never a `Score` field"* currently sits buried inside boundary case 1 as
*"the discriminator to sort it by"*. It has been applied to tempo, meter and clef (all three
deleted as globals), pre-emptively to key signatures (`types/music.ts:1302`), and it is the
stated test for the still-open engraving-settings question. That is more load-bearing than
some of the numbered five, and it reads as a principle: *positional, not global.*

⛔ **Do NOT add Phase 6c's rule to this doc.** "A feature adds a module, not a method to the
big three" is about the *editor's composition*; `DESIGN-PRINCIPLES.md` is deliberately about
the **model's assumptions** (see its own opening callout). 6c belongs in `ARCHITECTURE.md`
and `CLAUDE.md`, which is where 6c puts it. Keeping that line clean is what stopped this doc
needing revision when Vue left.

*Verify:* `npm run build:check` green with `lint` now inside it.

---

## Phase 1 — One selection, not twenty scalars

`EditorState` carries ~20 independent selection scalars (`selectedClefMeasure`,
`selectedTimeSignatureMeasure`, `selectedBarlineMeasure`, `selectedDynamicId`,
`selectedTempoId`, `selectedTupletId`, `selectedSlurId`, `selectedStemNoteId`,
`selectedTremoloNoteId`, `selectedDotNoteId`, `selectedAccidentalNoteId`, …). **Four
places clear overlapping-but-different subsets:**

| site | clears |
|---|---|
| `SelectionController.clearScalarSubSelections:57` | 17 fields — **not** dynamic/tempo/tuplet |
| `SelectionController.deselectAll:171` | those 17 + the 3 |
| `MouseController.handleMouseDown:567` | 12 fields — **not** accidental/articulation/dot/stem/tremolo |
| `PaletteController.armMarkingTool:113` | 6 fields |

…plus per-site clears in `shortcutWiring.ts:404,429,435`.

This is exactly the shape `MarkingTool` was built to delete, one axis over and at 20 fields
instead of 8 — *"eight arm-sites each remembering to clear the other seven… a missed one is
SILENT"* (`EditorState.ts:36`). It has already diverged: `selectNotes` →
`clearScalarSubSelections` leaves `selectedDynamicId` set, so replacing the selection with
notes while a dynamic is selected does not clear the dynamic.

**Do:** `selectedElement: SelectedElement | null` — a discriminated union mirroring
`MarkingTool`, with an `assertNeverElement` exhaustiveness check. Four clear-lists collapse
to one assignment. `RenderController.applyHighlights` (§3 below) becomes a `switch` the
compiler polices.

**Keep separate, deliberately:** `selectedItems` / `selectedNoteId` / `selectionPivotId` /
`selectionBase`. Notes are a genuine multi-selection with an anchor and a pivot; the other
kinds are single-select. Folding them together would destroy that distinction, not clarify
it.

*Verify:* test-first for the `selectNotes` inconsistency (red → green). Full suite. Hand-test:
select a dynamic → click a note; select a clef → Ctrl+click notes; arm a stamp with each
element kind selected.

### ✅ Done (2026-07-27)

**Fourteen kinds, not twenty-odd scalars**: clef · timeSignature · barline · dynamic · tempo ·
tuplet · slur · tie · articulation · accidental · dot · stem · tremolo · measureRange. The 23
fields collapsed into one `selectedElement`, with `selectedOf(state, kind)` (the twin of
`armedTool`) for the one-kind-or-nothing reads and `assertNeverElement` for the dispatches.
`selectedItems` / `selectedNoteId` / `selectionPivotId` / `selectionBase` stayed separate, as
planned.

**Six tests, written red first**, cover the live inconsistency from every path that replaces the
selection with notes (`selectNote`, `selectNotes`, `selectMeasureContents`, `extendSelectionTo`);
2518 → 2524 tests, `build:check` green.

**Three `if`-chains became compiler-policed switches** — that is what the union bought beyond the
bug fix, and each was a place a fifteenth kind could have been silently forgotten:

- `RenderController.applyHighlights` — was thirteen unconditional `apply*Highlight()` calls, each
  self-guarding on its own field. Now the four passes that read the multi-select SET run first,
  then ONE switch paints the element. (Order among the thirteen no longer means anything: only one
  can run.)
- `shortcutWiring.deleteSelected` — the `else if` chain's ORDER was load-bearing only because
  several fields could be set at once. `barline` and `stem` are now explicit "nothing to delete"
  cases rather than fall-through.
- `selectionSnapshot.selectedElements` — fourteen independent `if`s describing a state that can no
  longer exist.

**Two names worth knowing.** `selectionSnapshot`'s `SelectedElement` (the read-only REPORT) was
renamed **`InspectedElement`**, because `SelectedElement` is now the state. And
`clearScalarSubSelections` → `clearElementSelection`, one line instead of seventeen.

**Behaviour deliberately changed** (all in the same family as the reported bug): arming a marking
tool now clears a selected tie/slur/tuplet/dot/stem/tremolo too, not just the six it named; a
mousedown clears the accidental/articulation/dot/stem/tremolo up front rather than relying on each
handler's `selectNote(null)`; `resetToDefaults` and `setEntryMode` clear the whole element
selection rather than three of it.

---

## Phase 2 — Three accessors for the model's most-repeated rules

The highest-frequency copy-pastes in the codebase are all in the correctness-critical path:

| idiom | sites |
|---|---|
| `x.voice ?? 0` | **150** |
| `x.staff ?? 0` | **67** |
| `durationToFraction(x.duration, x.dots ?? 0)` | 26 |
| `slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0)` | 21 |

Absent-means-zero is a good, deliberate, documented model choice (`types/music.ts`). But it
is re-derived at every read, and forgetting it means a note silently belongs to the wrong
voice or staff — the exact bug family the multi-staff plan calls *"next-note search unscoped
by (voice, staff)"*, and the one Phase 1a of the previous plan already fixed once.

**Do:** in `utils/` (natural home beside `musicUtils`):

- `voiceOf(x): 0|1|2|3`
- `staffOf(x): number`
- `slotLength(slot): Fraction` — the `actualDuration ?? derive` rule, one home
- `writtenLength(x): Fraction` — the plain `duration + dots` twin

Sweep every site. 264 remembered rules become 4 defined ones, and the invariant becomes
greppable.

*Verify:* pure mechanical substitution — the suite is the safety net, plus
`git diff` review that no site changed meaning (watch for the handful that deliberately
read a raw `undefined`).

### ✅ Done (2026-07-27)

**Two homes, not one.** `voiceOf` / `staffOf` went into a new dependency-free
**`utils/lanes.ts`** (it imports nothing at all, so it can be called from anywhere in the core
without adding a graph edge). `writtenLength` / `slotLength` went into **`utils/durations.ts`**,
which already declares itself the single source of truth for everything keyed by a
`NoteDuration` — they are the object-taking twins of `durationToFraction`.

**⭐ The distinction the sweep turned on: an absent FIELD is not an absent OBJECT.** All four
accessors take a value, deliberately not `T | undefined`. `maybeNote?.voice ?? 0` is answering a
different question — *there is nothing there* — and 20 sites (mostly `engine.getNote(id)?.voice ??
0` in `HighlightController`) still spell it out, correctly. Conflating the two would have hidden a
missing note behind "voice 0". Four more leftovers are a bare `voice ?? 0` on an optional
PARAMETER, which is the same non-question.

**Counts, measured rather than trusted** — the table above says `x.staff ?? 0` 67 times; it was
**69** in production code (plus 52 more in tests, left alone: a test that reads through the
accessor it is checking can't catch the accessor regressing). 150 `voice` + 69 `staff` + 21
`slotLength` + 12 `writtenLength` = **252 sites swept across 31 files**, with the 24 above left
standing.

**One duplicate died with it:** `utils/dynamics.ts`'s `dynamicVoice(d)` was `voiceOf` for exactly
one type. Removed, its 2 callers now read `voiceOf`.

`build:check` green (tsc + all four lint gates + build), 2524 → **2535 tests** (11 new, covering
both modules). No behaviour change is intended anywhere in this phase.

---

## Phase 3 — Make the layer map true again

`ARCHITECTURE.md`: *"dependencies point **inward and downward**."* Two places where they
don't. Both are pure moves.

**3a. `engine/` imports `dev/`.**

```
engine/rendering/VexFlowRenderer.ts:45   import { renderCensus } from '@/dev/renderCensus'
engine/rendering/MeasureLayout.ts:11     import { renderCensus } from '@/dev/renderCensus'
interactions/RenderController.ts:9       import { renderCensus } from '../dev/renderCensus'
```

`CLAUDE.md` and `ARCHITECTURE.md` both promise dev/ "deletes cleanly". It doesn't — the
engine won't compile without it. `lint:boundary` only forbids *framework* imports, so
nothing catches the direction.

**Do:** declare a `RenderProbe` interface in `engine/`, default it to a no-op, inject the
real census from `App.ts`. ~30 lines, and the promise becomes true. Extend
`lint:boundary` with a `no-restricted-imports` rule banning `**/dev/*` from
`engine/`+`interactions/`, so it can't come back.

**3b. `interactions/` ↔ `windows/` are mutually dependent.** `shortcutWiring.ts` imports 6
things from `windows/`; six window modules import ~20 `*Selection` stores from
`interactions/`. No *file* cycle (the stores are leaves) — but the two directories point at
each other, so the layer map is not true of them.

The `*Selection` stores are not interaction logic. They are a **UI bus** both layers publish
to, and `PaletteSelection`/`PaletteToggleSet` are a good abstraction filed in the wrong place.

**Do:** move `interactions/*Selection.ts` + `paletteSelection.ts` + `paletteToggleSet.ts`
→ `src/bus/`. Both sides then depend downward on a shared leaf. Add `src/bus/**` to
`lint:boundary`'s coverage.

**…and collapse 20 named singletons into ONE bus object, while moving them.** This is the
packaging half (see *Context* above), and it is the difference between the "two editors on
one page" decision costing an hour later or a full sweep later.

Today 26 call sites import the stores by name — `keypadPress.ts` imports 14 of them,
`KeypadWidget.ts` 15. Whatever else changes, *those direct imports are the coupling*. So:

```ts
// src/bus/durationSelection.ts — keeps its own doc comment, exports a FACTORY
export const createDurationSelection = () => new PaletteSelection<NoteDuration>()

// src/bus/index.ts
export interface EditorBus { duration: …; accidental: …; tremolo: …; /* … */ }
export function createEditorBus(): EditorBus { … }

/** The app's single bus. If two editors ever share a page, this export goes and
 *  `createEditorBus()` is threaded through `createEditorApp` instead — ONE seam. */
export const bus = createEditorBus()
```

Call sites become `import { bus } from '@/bus'` → `bus.duration.onPress(…)`.

- **Today:** nothing behaves differently; one editor, one bus.
- **If/when two editors:** delete the default export, pass `createEditorBus()` through
  `createEditorApp`. ~5 files, not 26.

⚠️ **Keep the per-store modules.** Each carries a real doc comment explaining its semantics
(`restSelection`'s "quarter + rest = a quarter rest", `tremoloPairSelection`'s "a SECOND
AXIS, never one of the count's values"). They are the reason this bus is comprehensible.
Collapse the *exports*, not the files.

`windows` (`WindowLayer`) and `menus` (`MenuLayer`) are the same shape and get the same
treatment — they are already half-parameterised, since `App.ts` calls
`windows.mount(scoreViewport)` explicitly. `renderCensus` needs nothing: 3a already removes
it from `engine/`+`interactions/`, and it is dev-only.

> This is no longer a pure file move — it renames one symbol at every call site. Mechanical,
> and it is the sweep that has to happen once regardless. Budget accordingly (see the order
> table).

**Which resolution this is, in the doc's own terms.** `DESIGN-PRINCIPLES.md` boundary case 5
offers two: name the singletons *a conscious exception* (as principle 1 does for audio), or
*make them instance-scoped inside `createEditorApp` and thread them down*. **We are taking
the second, in two steps** — this phase does the collapse, and the threading happens if and
when a second editor is real. Record that in the boundary case so the question stops reading
as open.

⚠️ **Fix the one breach of the convention that keeps this cheap.** The same entry warns:
*"a definition module that imports the singleton instead of receiving it turns a sweep into
archaeology."* All four window definitions honour it (`openClefWindow(windows: WindowLayer)`,
`openTupletWindow`, `openTimeSignatureWindow`, `openBeamGroupsWindow`) — but
**`menus/insertMenu.ts:1` imports the `windows` singleton directly.** One file, trivial now,
and exactly the case the doc predicted. Fix it while the sweep is open.

**3c. Fence the core against `interactions/` too.** `lint:boundary` bans `vexflow`,
`**/rendering/*`, `**/audio/*` and `MusicEngine` from `utils/**`+`types/**`+`engine/models/**`
— but **not `@/interactions/*`**, which is the arrow DESIGN-PRINCIPLES §5 cares about most
(*"editor → score, never score → editor"*). Add it to the restricted-imports group. One
line, and it is what keeps the core publishable by accident rather than by vigilance.

**3d. The one real import cycle.** `musicUtils → tempoText → tempoMap → musicUtils`, via
`measureCapacityQuarters`. Works under ESM hoisting; fails as `undefined is not a function`
at module init if bundling order ever shifts. Move `measureCapacityQuarters` and its
immediate neighbours to a small `utils/measureCapacity.ts`.

*(The other two cycles — `VexFlowRenderer↔RenderPass`, `PaletteController↔keypadSync` — are
`import type` on the back edge. Harmless, leave them.)*

*Verify:* `build:check`. Pure code motion; `git diff --stat` should show imports only.

### ✅ Done (2026-07-27)

All four parts landed. `build:check` green, **2535 tests** — the same number as the Phase 2 baseline,
which is the point: not one line of behaviour changed.

**3a — the probe.** `engine/RenderProbe.ts` declares the interface, defaults it to `NO_RENDER_PROBE`,
and `App.ts` calls `setRenderProbe(renderCensus)` inside `installPerfInstruments()` (dev builds only,
after the first render — the census is opt-in from the console, so nothing is missed). 26 call sites
across `VexFlowRenderer` / `MeasureLayout` / `RenderController` now read `renderProbe()`, and
`RenderCensus implements RenderProbe` so a drift in either signature fails to BUILD. **`dev/` now
really does delete cleanly.**

**3c — the fence.** ⚠️ **ESLint replaces a rule wholesale per override**, so the two `overrides`
blocks each restate the framework group; had they not, the anti-Vue ratchet would have silently
stopped applying to `engine/` and `interactions/`. And the score-layer override covers
`engine/models/**`, which is *inside* `engine/**` — so it has to restate the `dev/` ban too, or the
later override would win and drop it. Both were verified by writing three throwaway files that
import what is now banned and watching all three fail. A fence nobody has seen bite is not a fence.

**3d — the cycle.** `utils/measureCapacity.ts` (4 functions, 16 files repointed, its own spec built
from tests that were living in `musicUtils.test.ts` *and* `durations.test.ts` — the latter under a
header reading *"lives in musicUtils, validated here alongside the duration table"*, which had
already rotted). ⭐ The cheaper cut existed — moving `MET_NOTE_GLYPH` out of `tempoText` breaks the
same cycle across 3 files instead of 16 — but capacity is a *subject*, and "how long is this bar" is
what every timing decision starts from; a grab-bag is the wrong home for the thing everything else is
measured against.

**3b — the bus.** 21 stores → `src/bus/`, one `EditorBus`, 17 call-site files. Four findings:

1. **⛔ `keypadPageSelection` is NOT on the bus, and could not be.** Its value is a `KeypadPageId` and
   that vocabulary is owned by `windows/keypad/keypadLayouts` (`nextKeypadPageId` is expressly *the
   ONE place page ORDER is used*). Putting it on the bus would make the **bus** import `windows/` —
   upward, and the one thing the directory exists to prevent. It moved to `windows/keypad/` instead,
   beside the layouts it names. **A leaf that isn't a leaf is worth nothing.**
2. **The plan's count was wrong again (4th time): 21 `*Selection` stores, not 20** — plus
   `selectionInspection`, which the plan's glob missed entirely and which is the same kind of store.
   It is on the bus as `bus.inspection`.
3. **🚨 The singleton check would have missed the biggest singleton in the codebase.**
   `scripts/check-singletons.mjs` matched `= new X` and `= {…}`; `export const bus = createEditorBus()`
   is neither. The count would have read **26 → 5** and looked like a clean win. The rule now also
   matches a factory call (verified: 6 found, no false positives). This is Phase 0c's own lesson
   firing on Phase 0c's own script.
4. **One test file was passing the name check by coincidence.** `interactions/tremoloSelection.test.ts`
   is about `MouseController`'s hit-testing; it satisfied the sibling rule only because a *store* of
   that name happened to sit beside it. The store moved and the coincidence went. Renamed
   `MouseController.tremoloSelection.test.ts`, beside the existing `MouseController.stemSelection.test.ts`.

**What is left of the two-way edge, and deliberately:** `windows/properties/PropertiesWidget` still
imports `InspectedElement` from `interactions/selectionSnapshot`, and `bus/selectionInspection`
imports the same type — both `import type`, erased at build, the same judgement this phase already
makes about the two remaining cycles. The type is defined next to the function that BUILDS it, where
the 30 lines explaining why it is not `SelectedElement` belong.

**⚠️ NOT closed by this phase:** `interactions/ → windows|menus` still has 12 value edges across 6
files (`shortcutWiring` → 5 window modules; `DomTextEdit`/`TempoTextSource`/`DynamicTextSource`/
`TextEditController` → `menus/MenuItem` and two menu definitions). The plan's line *"both sides then
depend downward on a shared leaf"* is true of the **stores**; it is not yet true of the directories.
That is a separate decision (shortcut wiring is arguably app-level glue sitting in `interactions/`),
not a silent leftover.

---

## Phase 4 — A clip is a shape, not 14 slots

`MusicEngine.pasteEvents:893` → `ScoreModel.pasteEvents:1398` → `rebarOps`, threaded
verbatim through all three:

```ts
pasteEvents(measure, beat, lanes, spanBeats, targetVoice,
  clipRestShifts = [], clipRestHidden = [], targetStaff = 0,
  clipDynamics = [], clipSlurs = [], clipSpaces = [],
  clipNoteOffsets = [], clipTremoloPairs = [])
```

Every clipboard-travelling attribute appended one more — rest shifts, hidden rests,
dynamics, slurs, spaces, note offsets, tremolo pairs. Fan members are the obvious next one
→ 15. Several adjacent parameters are `[]` defaults of structurally similar type, so a
transposed argument type-checks in some pairings.

**Do:** one object.

```ts
interface Clip {
  lanes: ClipLane[]
  spanBeats: Fraction
  target: { measure: number; beat: Fraction; voice: number; staff: number }
  travelling: {
    restShifts?, restHidden?, dynamics?, slurs?,
    spaces?, noteOffsets?, tremoloPairs?
  }
}
```

Three signatures collapse to one, and the next travelling attribute is a field, not a slot.

**⭐ And `Clip` belongs in the CORE, not in `interactions/`.** Principle 2 calls the
position-independent stream *"the canonical currency for **portable musical material**, not a
private detail of re-barring"*, and principle 5 puts operations on musical material in the
score layer. Today that is half-true: `RebarEvent` lives in `utils/rebar.ts` (core), but
`ClipboardPayload` / `ClipboardLane` live in `interactions/clipboard.ts` (editor) — **the
container sits one layer above its own contents.**

So the new type lands beside `RebarEvent` in the core, and `interactions/clipboard.ts` keeps
only what is genuinely editorial: reading the *selection* to build one, and the DOM/system
clipboard plumbing. Two payoffs beyond tidiness:

- principle 2's "any operation on a run of music — transposition, augmentation, merging —
  should be expressible as a map/concat over this stream" becomes reachable without the
  editor, which is what makes it true rather than aspirational;
- for packaging, a core consumer can build and paste a clip with no editor present.

*Verify:* `clipboard.test.ts` + the paste/rebar suites unchanged. Hand-test: copy/paste a
passage carrying each travelling attribute (a shifted rest, a hidden rest, a dynamic, a
slur, an authored space, a note offset, a two-note tremolo).

### ✅ Done (2026-07-27)

`build:check` green, **2535 tests — the same number again**: no behaviour changed, and the
suite that proves it is the one that already existed. **−222 lines net.**

**The shape, with one deviation from the sketch above: `target` is NOT a field of `Clip`.**
A clip carries no position — that is the whole reason it can be pasted anywhere, any number
of times — so putting the destination inside it would have contradicted the doc-comment the
payload has always carried. Two arguments:

```ts
pasteEvents(clip: Clip, target: ClipTarget): string[]     // MusicEngine, ScoreModel, rebarOps
```

**And `travelling` is not a sub-object either — because it turned out not to be a new
container at all.** `ClipboardLane` ALREADY held `restShifts` / `restHidden` / `noteOffsets`
/ `tremoloPairs`; `ClipboardController` was re-projecting each of the four back out into a
`{staff, voice, …}[]` array purely to feed a positional parameter, and `pasteEvents` was
zipping them back onto the lanes by staff+voice. ⭐ **Four of the fourteen parameters were a
round-trip of data the clip already had** — the object didn't move them, it deleted the trip.
The three genuinely clip-wide things (`dynamics`, `slurs`, `spaces`) stay top-level and flat.

**The types moved to the core, `utils/clip.ts`** (a subject of its own beside `utils/rebar.ts`,
the Phase 3d precedent): `Clip`, `ClipLane`, `ClipDynamic`, `ClipSlur`, `ClipSlurPitch`,
`ClipTarget`. Two consequences worth naming:

- **`ClipboardPayload extends Clip`** — it now declares only the envelope (`format`, `version`,
  `origin`, `spanStaves`). The music is inherited, so the payload cannot drift from what paste
  accepts, and `ClipboardController` hands its payload straight to the engine.
- **The engine's duplicate types are gone.** `ClipDynamicInput` / `ClipSlurInput` existed in
  `rebarOps` *"so the engine never imports inward"* — with the definition in the core, the
  duplicate is unnecessary and so is `ScoreModel`'s re-export of it. The comment was right; the
  copy was the workaround for the type being in the wrong layer.

**Method:** a parsing sweep of the 40 test call sites (balance the parens, split top-level
commas, map positionally) with an assertion that **every dropped argument was a projection of
that same clip** — anything else aborted the script. Then `tsc` named the five now-dead helper
functions in the tests (`clipRestShiftsOf`, `clipOf`, `clipDynsPass`, `pairChannel`,
`clipNoteOffsets` ×2), which is the refactor's own receipt. Full `git diff` reviewed by hand.

⚠️ **Two tests changed meaning slightly and were re-worded, not deleted:** "an old clip with no
`noteOffsets`/`spaces` pastes exactly as before" used to mean *called at the pre-feature arity*.
Arity is no longer a thing; they now pin the OPTIONAL FIELD path (`lane.noteOffsets ?? []`,
`clip.spaces ?? []`) — which is what an old JSON payload off the OS clipboard actually
produces, so the case is still real.

**Docs re-trued** (the Phase 0c rule — a repo fact rots): DESIGN-PRINCIPLES §2 gains the clip as
the stream's container, §4's *"the multi-staff generalization of today's single-staff
`pasteEvents(measure, beat, …)`"* is now simply true and says so; note-offset-plan,
rest-hide-plan and copy-paste-staff-plan each named a parameter that no longer exists.

*Still to hand-test:* copy/paste a passage carrying each travelling attribute.

---

## Phase 5 — The geometry net *(prerequisite for Phase 6)*

`ARCHITECTURE.md` is right that **unit tests structurally cannot verify this renderer**:

> *"an assertion about glyph geometry passes vacuously — it measures zeros and agrees with
> itself."*

It names Playwright as the answer. Playwright is installed and configured nowhere. Every
geometry feature of the last month — fan ramps and spread, tremolo stroke placement, bar
width, note spacing, PDF outline export — has been verified by eye only.

That is tolerable while the renderer is only being *added to*. It is not tolerable while it
is being *restructured*, which is Phase 6. So the net goes in first.

**Do:** `playwright.config.ts` + a small golden-geometry suite. Not exhaustive — enough to
catch a code-motion regression:

- a fixture score rendered; assert notehead x-positions, stem extents, beam slopes
- one fanned group: member head spacing, ramp line count at each end
- one two-note tremolo: stroke count and span
- a bar-width nudge: the barline actually moves, and by roughly the asked pixels
- a system break: cross-barline beam draws on both sides
- PDF export produces a non-empty document *(also the first automated check that path has
  ever had — it is still not hand-tested either)*

*Verify:* the suite passes on `main` before Phase 6 starts. That is the whole point — it
must be green on the code as it is, so a failure afterwards means the refactor.

---

## Phase 6 — Break up the big three, and adopt the rule

Three files absorb every feature:

| file | lines | members |
|---|---|---|
| `rendering/VexFlowRenderer.ts` | 5,491 | 104 |
| `MusicEngine.ts` | 3,696 | **203** |
| `models/ScoreModel.ts` | 3,663 | 139 |

A 203-member facade is not a facade; it is the application. The model side already proved
the fix — `clefOps` / `tupletOps` / `rebarOps` are free functions over `score` with
`ScoreModel` delegating in one line each. That pattern was never applied to the facade or
the renderer.

**6a. Renderer.** The fan cluster is already a coherent unit (~500 lines:
`drawFannedBeams`, `drawCrossBarFanBeams`, `drawFanGroups`, `fanSlotDrawing`,
`reconcileFanJoinLines`, `registerFanInk`, `drawFanLedgerLines`, `drawFanPrefixStems`) →
`rendering/FanPass.ts`, beside the existing `TieRenderer` / `SlurRenderer` /
`DynamicsLayout`.

Then the ghost family (~900 lines). The previous plan parked this as *"worthwhile only if
VexFlowRenderer keeps growing"* — it grew **+2,167 lines in nine days**, so the condition is
met. → `rendering/GhostRenderer.ts`.

**6b. Facade.** `MusicEngine.barWidthRoom:1584` is **217 lines** with a 160-line branch — a
self-contained algorithm over `(measureLayoutInfo, registry measurements, viewMode)` that
becomes testable as a pure function. With its siblings `measuredShrinkRoom:1348`,
`fanMemberShrinkRoom:1399`, `measuredBarShrinkPx:1839` → `engine/layout/measuredRoom.ts`
and `engine/layout/barWidthRoom.ts`.

**6c. The rule** — the actual deliverable of this plan:

> **A new feature adds a module. It does not add methods to `MusicEngine`,
> `ScoreModel` or `VexFlowRenderer`.**
>
> The facade may gain a one-line delegation. The logic lives in a feature module, in the
> style of `clefOps` / `tupletOps` / `rebarOps` / `TieRenderer` / `SlurRenderer`.
>
> **And a SCORE operation goes in the core, not on `MusicEngine`** — `engine/models/**`,
> `utils/**`, `types/**`. `MusicEngine` is the *editor's* facade (DESIGN-PRINCIPLES §5).

The second clause is not new — §5 already forbids it and names the failure mode exactly:
*"someone adds 'merge two passages' to `MusicEngine` because that is where the menu action
lands. It works, ships, and is invisible."* What the packaging goal changes is the
**consequence**: today that is a style violation, but once the core is published it means
*the feature is not in the package*, and nobody finds out until an ecosystem consumer needs
it. 3c makes the import direction mechanical; this clause is the part lint cannot check
(putting the logic in the wrong layer imports nothing).

Add it to `CLAUDE.md` and `ARCHITECTURE.md`. Consider a `scripts/check-file-size.mjs` in
`build:check` that fails when any of the three grows past its post-refactor size — the
mechanical version of the rule, in the spirit of `lint:testnames`. (Worth discussing; a
hard cap can be the wrong pressure. A *warning* may be the right strength.)

*Verify:* Phase 5's E2E suite green, full unit suite green, `git diff --stat` shows code
motion only. Hand-test the fan and ghost paths.

---

## Phase 7 — The model's own performance pass *(optional; do when it bites)*

The render side got `layoutCache`, `widthCache`, tier-1/tier-2 and virtualization. The model
side never got the same pass.

- `ScoreModel.findSlot:1516` walks every measure × slot × pitch, and is the primary id→slot
  lookup (33 call sites). `getMeasure:358` is `measures.find(…)`.
- `MusicEngine.toggleTie:1038` builds `getAllNotes().sort(compareByPosition)` — a full flat
  projection *and sort* of the score, per keypress. `tieSelection:1086` does it again;
  `deleteNote:2657` does a third full scan for tie sources.
- `repairDanglingTies` / `repairDanglingSlurs` build a full id `Set` per call, from
  `removeMeasure` and every rebar.
- `checkMeasuresWellFormed:3546` is O(score) on **every committed change**, in the browser.

At 64 bars this is invisible. `render-performance-plan.md` benches 200 bars and 500×25.

**Do (when measured, not before):** an id→`{measure, slot, pitch}` index on `ScoreModel`
invalidated on mutation (the move `widthCache` already made); a number→`Measure` map
maintained by the renumber loops that already exist; scope `checkMeasuresWellFormed` to the
measures an edit touched.

⚠️ **Both indexes go BEHIND the existing accessors** (`findSlot`, `getMeasure`) — no new
public lookup. `DESIGN-PRINCIPLES.md` boundary case 3 warns that *"`measures` lives directly
on `Score`, and 'measure N' is a global key"* must generalise to staff-relative addressing
when the composable instrument layer lands. A cache behind `getMeasure()` does not deepen
that assumption and dies with the same refactor; a new exported `measureByNumber` map would
hand it more callers to outlive.

**Keep the integrity check** — it is genuinely valuable and has earned its keep. Only its
*scope* is the question.

---

## Checked against DESIGN-PRINCIPLES (2026-07-27)

Every phase read against all five principles. **No contradictions.** Three phases turn out to
be the doc's own parked boundary cases rather than new work:

| phase | principle / boundary case |
|---|---|
| 0d `import.meta.env` out of the core | boundary case 5's ⚠️ footnote, nearly verbatim |
| 3b the bus | boundary case 5 in full, incl. both candidate resolutions |
| 3c + 6c fence + "score ops in the core" | principle 5's *Forbidden* list and its named failure mode |
| 4 `Clip` in the core | principle 2 (portable material is the canonical currency) + 5 |
| 2 `staffOf()` | principle 4 (staves are 1..N, single-staff is N=1) |
| 6b `engine/layout/**` | principle 3 — layout is a derived view, so it goes **outside** the core fence, not in `engine/models/` |
| 7 indexes behind accessors | boundary case 3 ("measure N is a global key") — see the ⚠️ there |

Two phases deliberately do **not** touch a principle: Phase 1 (`selectedElement`) and Phase 6a
(`FanPass`/`GhostRenderer`) are entirely editor-internal, which is itself the check passing —
principles 1–5 are about the model's assumptions, and neither phase makes one.

**The principles themselves need no revision.** They are phrased as *what not to assume about
the music*, not about the code's shape, which is exactly why losing Vue did not touch them —
the doc's own opening callout already records that framework-agnosticism was a mechanism
(`lint:boundary`), never a principle. What has drifted is the *status reports* under them; 0e
re-trues those.

---

## When we package — parked, not forgotten

Real work, none of it a reason to change today's structure. Recorded so it is not
rediscovered from scratch. **All of it is in the EDITOR layer** — the core has none of these
problems, which is the whole point of the fence.

| # | Thing | Where | Note |
|---|---|---|---|
| 1 | Entry surface | `package.json` | no `main`/`module`/`exports`/`types`/`files`/`sideEffects`/`peerDependencies` — it is an app manifest today |
| 2 | Library build | `vite.config.ts` | `vite build` emits an app; a package needs `build.lib` + `vexflow`/`jspdf`/`opentype.js`/`svg2pdf.js`/`webaudiofont` as **peer** deps |
| 3 | `@/` alias | tsconfig + vite | must be resolved at publish time, or consumers cannot resolve imports |
| 4 | CSS from inside a module | `VexFlowRenderer.ts:11` `import './notation.css'` | a bundler feature, not ESM. Ship a side-car stylesheet, or keep it and document the requirement |
| 5 | **Tailwind** | `App.ts` (`div('min-h-screen bg-gray-900 …')`) | the biggest one. Consumers would need Tailwind configured with content paths into `node_modules`, or we ship compiled CSS. Decide before the editor is published, not after |
| 6 | Music font | `public/fonts/Bravura.otf` | ship it, or document it as a host responsibility |
| 7 | Asset base | `exportFonts.ts:51`, `smufl.ts:69` | `import.meta.env.BASE_URL` → needs an injectable asset base |
| 8 | Sample CDN | `WebAudioFontInstrument.ts:45` | `https://surikov.github.io/…` hardcoded; a runtime network dependency on someone else's host. Make it injectable |
| 9 | Standalone entry | `main.ts` + `index.html` | must keep working as the demo/standalone app after the split — the "works standalone" half of the goal |

None of these blocks any phase. Revisit as one piece when publishing is actually on the table.

---

## Already adjudicated — do not re-open

From `docs/refactor-plan.md` (2026-07-18), settled and still settled:

- **Rejected dedups:** `splitBeatsIntoDurations` vs `splitBeatsIntoLengths` (two different
  questions); `PaletteController`'s per-tool press routing (every branch encodes a real
  per-tool decision); full ghost-method unification (only the tint + collect-children blocks
  are safely extractable — Phase 6a moves the family wholesale, it does not unify the methods).
- **Reserved keepers, already annotated:** `setVolume`, `seekToMeasure`,
  `getPlaybackPosition`, `getUndoDescription`/`getRedoDescription`, `getShortcutList`,
  `Label`/`TextInput`, `spanContainedInFrac`. This review re-flagged them; they are a
  deliberate KEEP and the "reserved for" comments are working as intended.

One item genuinely worth revisiting: `MusicEngine.setInstrumentProgram:3495` is marked
*"⚠️ TEMPORARY — dev-only"* but sits on the public facade with no fence. Since
`instruments-plan.md` is P0-only it will be load-bearing longer than intended; moving it
behind the dev shell costs less now than later. Small; fold into Phase 3.

Also parked by the previous plan and still parked: the float→Fraction migration of
`NoteEntryCoordinator.updateNote` internals. Works, epsilon-guarded; a candidate only when
touched for another reason.

---

## Order & hygiene

| phase | what | risk | effort | why here |
|---|---|---|---|---|
| 0 | lint gate, stale docs, `import.meta.env` out of core | none | ~30 min | stops leaks during the rest |
| 1 | `selectedElement` union | low | ~1 day | fixes a live inconsistency; biggest `interactions/` win |
| 2 | lane/length accessors | very low | ~½ day | mechanical; 264 sites in the critical path |
| 3 | layering: probe, **bus collapse**, core fence, cycle | low | **~1½ days** | makes the map true; keeps the packaging option open |
| 4 | `Clip` object | low | ~½ day | before it reaches 15 params |
| 5 | E2E geometry net | none | ~1 day | **the net under Phase 6** |
| 6 | big-three split **+ the rule** | medium | ~2 days | the actual deliverable |
| 7 | model perf index | medium | — | only when measured |

Phase 3 is the one that grew when the packaging goal landed: it was a pure file move, and
the bus collapse makes it a mechanical rename at ~26 call sites. Still low risk (the type
checker catches every miss), but budget a day and a half rather than an afternoon.

Phases 0–4 are each a day or less — except 3 — and independently shippable. Phase 5 is the
gate. Phase 6 is what the plan is for; without its rule (6c) the whole pass is a rounding
error again in nine days.

Every phase: `npm run test` + `npm run build:check` green before it is offered for commit.
One commit per phase, with a pause for hand-testing between. No commits or pushes without
explicit say-so, per project rules.
