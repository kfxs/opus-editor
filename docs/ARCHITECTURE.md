# ARCHITECTURE

A map of the codebase for humans. For *what to build next*, see the `docs/*-plan.md`
files (historical/working plans). For *how the pieces fit together*, read this.

> ⭐⭐ **THE STANDING PRIORITY: the spacing model, half built.** Horizontal space used to be decided
> by VexFlow's tick-proportional formatter plus one floor per event, so every feature that draws its
> own ink re-derived "how much room does this need" by hand — and each did it differently. The real
> model (Gould: an event's own extent + the space its duration earns) is planned in
> **`docs/spacing-model-plan.md`**, on the evidence in **`docs/spacing-model-research.md`** (Gould's
> table, the four engines' formulas, and what our own code measures). ⭐ The rule that ships is
> **LilyPond's** — `(2 + log₂(t / ♪)) × 1.2` staff spaces, so each doubling **adds** 1.2 where every
> other engine multiplies — plus each event's own ink, combined with a `max`.
>
> **Built — P0 through P4, and the rule is what gets DRAWN.** `engine/layout/spacing.ts` is the rule
> and the spring solve; `spacingPadding.ts` is the ink (glyph extents measured off our own drawing,
> plus a padding table keyed by the PAIR of things); `measureColumns.ts` turns a measure into columns
> carrying both; `MeasureLayout` asks them for a bar's width; and `rendering/spacingPass.ts` writes
> the x's onto the tick contexts between `format()` and `draw()`, so VexFlow's tick-proportional
> softmax no longer decides anything horizontal. Measured on the page, to the hundredth: a 32nd
> **1.50**, a 16th **1.80**, an eighth **2.40**, a quarter **3.60**.
>
> ⭐⭐ **And a column is a position in the SYSTEM, so every staff of a measure is handed the same
> columns** — `MeasurePlacement.system`, resolved once per measure. ⚠️ `drawMeasureContent`'s local
> `measure` is that staff's LANE (`placement.view`), and resolving the columns or the lead-in from it
> spaces each staff as though it were alone: measured at 1.0 → 2.4 staff spaces of drift across one bar
> on a grand staff. `kerning.ts` then decides which of a column's inks actually clash, so a left-hand
> accidental no longer buys room in the right hand's gaps.
>
> ⚠️ **Which house?** Gould's √2 power law is still in the code as `GOULD_SPACING`, one field away,
> and is the closer fit to her table (mean error 4.1% against LilyPond's 7.0%). LilyPond's log law
> ships because a log law's **dynamic range is narrower** — longest ÷ shortest falls from 5.6 to 4.0
> — so dense music keeps a far larger share of a line. That was his call, made by eye on his own
> scores, and it is the kind of call the model exists to make cheap: one field, two published tables,
> both tested.
>
> 📄 **Who decides what, and which of it to take next: `docs/vexflow-boundary.md`** — the full
> inventory of what we own outright, what VexFlow still decides, where that constrains us, and the
> test for whether a decision is worth taking (⭐ *is there a rule we want to state and can't?* —
> never *do we control this?*).
>
> 📄 **…and whether the DRAWING should move too: `docs/own-engraving-engine.md`** — the 2026-08-16
> audit. The measurements (all 38 `vexflow` imports live in ONE directory; `Stave` is a coordinate
> system and `StaveNote` a ruler), the five separable pieces, and ⭐⭐ **the target architecture:
> three stages with a typed SCENE between engraving and painting**, so geometry becomes a unit test
> and the ghost and the PDF stop being second and third drawing paths.
>
> ⭐ **P5 closed the fan**: `fanRoom.ts`, `FAN_MAX_SPAN_STRETCH`, `FAN_MIN_HEAD_GAP_RATIO`,
> `trailingGap`, `fanColumns` and **`MIN_NOTE_SPACING` itself** are all deleted — a fan's members are
> ordinary columns, and each gap is the rule applied to that member's own duration.
>
> ⭐ **And the HEADER** (`engine/layout/headerInk.ts`): what a clef and a meter cost is measured, the
> layout reserves it and the drawing places the first note from the same number — so a line-opening
> bar's music is no longer stretched more than its neighbours', and a two-digit meter gets the room
> it actually takes.
>
> ⏭️ Still owed: **vertical clearance** (an accidental that does not overlap its neighbour vertically
> should not pay the padding); flags and beams as ink; and the preview **ghost**, which formats its
> own stave and does not run the pass.
> ⛔ Resist adding another per-feature constant: that is the pattern the model exists to end.
> **A new element that draws ink adds a ROW to the pair table**, never a constant of its own.

> **The one rule:** dependencies point **inward and downward**. The app shell
> lives at the very top; the music engine at the bottom never knows it exists.
> This is enforced mechanically — see [The framework-agnostic
> boundary](#the-framework-agnostic-boundary).
>
> **There is no UI framework.** Vue was removed (docs/remove-vue-plan.md); the
> whole editor is TypeScript and the DOM. Reactivity is `EditorState`'s own
> emitting Proxy — `subscribe(fn)`, one call per top-level write — and nothing
> else. Do not reintroduce a framework without a deliberate decision; the lint
> ratchet below will refuse it.

---

## Layer map

```
┌─────────────────────────────────────────────────────────────┐
│  App.ts        builds the score DOM, constructs the           │  App shell
│                controllers, owns the lifecycle                 │  (plain TS)
├─────────────────────────────────────────────────────────────┤
│  dev/  devToolbar, scoreJsonPanel   ← SCAFFOLDING, kept       │  Dev shell
│      ↓ the strip around the viewport. Reads EditorState and    │
│        calls the palette; nothing inside the viewport knows    │
│        it exists, so it deletes cleanly when it has served     │
│        its purpose. (renderCensus lives here too — the engine   │
│        sees only engine/RenderProbe, and App.ts injects it.)    │
├═════════════════════════════════════════════════════════════┤  ← BOUNDARY
│  interactions/  (framework-agnostic)                          │  Controllers
│      EditorState ............ all editor UI state + THE       │
│                               reactivity (emitting Proxy)      │
│      ViewportHost ........... DOM ⇄ ViewportModel scroll/zoom  │
│      shortcutWiring ......... keybindings → controller actions │
│      MouseController ........ pointer GESTURES + the pre-steps │
│      elements/ .............. one module per selectable kind:   │
│                               its hit-test + how it paints      │
│      KeyboardController ..... letter/rest/chord note entry     │
│      SelectionController .... the selection set + nav          │
│      PaletteController ...... armed tool / duration / accid.   │
│      HighlightController .... recolor SVG groups on select     │
│      ClipboardController .... copy / paste (+ clipboard.ts)    │
│      TextEditController ..... in-canvas DOM text overlay       │
│      RenderController ....... "re-render now" indirection      │
├─────────────────────────────────────────────────────────────┤
│  bus/  the UI NOTICEBOARD — one `EditorBus`, 21 seams         │  UI bus
│      Publish/subscribe stores both `interactions/` and         │  (a leaf)
│      `windows/` pin to, so neither has to import the other.    │
│      Per-store modules keep their doc comments; the EXPORTS    │
│      collapsed to one `bus`, so a second editor on a page is    │
│      one threaded parameter and not a 26-file sweep.            │
├─────────────────────────────────────────────────────────────┤
│  engine/  (framework-agnostic)                               │  Engine
│      MusicEngine ........... FACADE: the single API the UI    │  (facade +
│                              talks to; coordinates everything  │   services)
│      NoteEntryCoordinator .. placement / overflow / tie-split  │
│      models/ScoreModel ..... THE data model (see glossary)     │
│      models/{clef,tuplet,rebar,slur,override,mark,voice}Ops     │
│                              delegated mutation sub-APIs —      │
│                              free funcs over `score`            │
│      models/CollisionDetector                                  │
│      rendering/VexFlowRenderer ... notation → SVG (VexFlow 5)  │
│      rendering/{FanPass,GhostRenderer,PagePass,Tie…,Slur…}     │
│                              draw passes: free funcs over the   │
│                              RenderPass / the SVG               │
│      rendering/CoordinateMapper .. pixel ↔ musical position    │
│      rendering/spacingPass ... WHERE each column goes — the     │
│                              model's x's, written post-format   │
│      layout/surface ........ WHAT the music is drawn ON —      │
│                              canvas or page, an authored value  │
│      layout/pageCastOff .... the VERTICAL casting-off: which    │
│                              page each system lands on          │
│      layout/{barWidthRoom,measuredRoom} . derived-view          │
│                              arithmetic off the LAST RENDER     │
│      layout/{spacing,spacingPadding,kerning,measureColumns} THE │
│                              SPACING MODEL — how much room an   │
│                              event earns, and what its ink needs│
│      ElementRegistry ....... rendered-element geometry + hit   │
│                              testing (authoritative)           │
│      ViewportModel ......... scroll/zoom box over the content  │
│      UndoRedoManager ....... snapshot stack                    │
│      audio/PlaybackEngine .. WebAudioFont sampled voices       │
├─────────────────────────────────────────────────────────────┤
│  utils/  pure functions: fraction, meter, rebar, restFill,    │  Pure
│          beaming, fannedBeam, beatMap, clefUtils, durations,   │  helpers
│          dynamics, lanes, musicUtils, pitchSpelling, slurs,    │
│          artics                                                │
│  types/music.ts  the shared interfaces                         │
│  shortcuts/  declarative keybinding table + manager            │
└─────────────────────────────────────────────────────────────┘
```

**Dependency direction:** each layer may import from the layers below it, never
above. `utils/` import nothing but `types/` and each other. `engine/` and
`interactions/` may use `utils/`. `dev/` reads state and calls controllers.
`App.ts` builds the DOM and wires everything together.

Three arrows used to point the wrong way, and were turned in 2026-07-27's Phase 3
(`docs/refactor-plan-2026-07-27.md`):

- **`engine/` imported `dev/renderCensus`** at three sites, so "dev/ deletes cleanly"
  was not true — the renderer would not compile without it. The engine now declares
  `engine/RenderProbe.ts` (an interface defaulting to a no-op) and `App.ts` injects the
  census into it, in dev builds only.
- **`interactions/` ↔ `windows/` pointed at each other**, because six window modules
  imported ~20 `*Selection` stores from `interactions/`. Those stores were never
  interaction logic; they are `src/bus/`, a leaf both sides depend downward on. What is
  left of that edge is two `import type` lines for `InspectedElement`, erased at build.
- **`utils/` + `types/` + `engine/models/` were not fenced against `interactions/`** —
  only against VexFlow, rendering, audio and `MusicEngine`. They are now, along with
  `bus/`, which is the arrow `DESIGN-PRINCIPLES.md` §5 cares about most.

A fourth was found in 2026-07-28's modularity review, before it could be crossed:

- **`src/engine/**` as a whole was not fenced against `interactions/`** — only its
  `models/` subtree was, through the score-layer rule above. So `engine/rendering/` and
  `MusicEngine` could import the editor's `EditorState` and pass every gate. The ghost
  pipeline (Phase 2) was about to do exactly that: `drawToolGhost(tool: MarkingTool, …)`
  reads as harmless and would have inverted the arrow silently. The engine now declares
  the vocabulary it wants — `engine/rendering/ghostTypes.ts` — and the editor translates
  into it (`interactions/toolGhost.ts`), which is the same shape as the `RenderProbe` fix
  above.

`lint:boundary` enforces all four: `engine/`, `interactions/` and `bus/` may not import
`**/dev/*`; **`engine/` may not import `interactions/` or `bus/`**; and the score layer
may not import a renderer, audio, the facade, an interaction controller or the bus.
⚠️ The engine rule excludes `**/*.test.ts` — a test may drive the editor over the engine,
and one does (`ScoreModel.tremoloPair.test.ts` builds a clip through
`interactions/clipboard`).

### ⭐⭐ …and a fifth: THE INK HALF DOES NOT MEASURE AT RUNTIME

`engine/layout/**` and `engine/fonts/**` may not touch `document`, `window`, `navigator`,
`getComputedStyle`, `OffscreenCanvas` or `ResizeObserver` — the same `no-restricted-globals`
ratchet the score layer has, for a different reason (docs/font-metrics-plan.md F4).

How much room a glyph needs is answered from **Bravura's own metrics** (`engine/fonts/`),
synchronously, in jsdom, with no font loaded. That is what makes every width unit-testable
without a browser, and what keeps the layout out from behind the font race that
`rendering/musicFontReady.ts` exists to survive — ⚠️ a race that is real and still costs the
*drawing* a deferred first render, because **VexFlow has no metrics table and measures every
glyph off a canvas** (`reference_vexflow_measures_glyphs_at_render_time`). One `measureText`
in a spacing module would quietly put our half back behind it.

Two import arrows come with it:

- **`engine/fonts/` may not import `vexflow` or `engine/rendering/*`.** The font is data and must
  not know who draws with it — it is the one module a future engine keeps unchanged when the
  drawing moves (docs/own-engraving-engine.md P2/P3).
- **`engine/layout/` may not import `vexflow`.** ⚠️ It *may* still import
  `engine/rendering/layoutConfig` and `MeasureLayout` (`barWidthRoom`, `staffStride` do), which is
  an older arrow this rule deliberately does not touch.

---

## The framework-agnostic boundary

`src/engine/**`, `src/interactions/**`, `src/bus/**`, `src/windows/**`, `src/menus/**`
and `src/dev/**` import **no UI framework**. Neither does `App.ts` — Vue was removed
(docs/remove-vue-plan.md), so the boundary now separates *the app shell* from
*everything it wires*, rather than a framework from the rest.

`EditorState` remains a plain object carrying its own emitting Proxy, which is
what made losing the framework a non-event: the Keypad, the Properties window
and the dev toolbar all subscribed to *it*, not to Vue, so none of them changed.
If a framework is ever wanted, it wraps the same object (`reactive(state)` in
Vue, `useSyncExternalStore` in React).

This is **enforced by lint**, not discipline:

```bash
npm run lint:boundary   # fails the build if any of those dirs import a UI framework
                        # — and now, if the layer arrows are pointed the wrong way
```

It is wired into `build:check`, and so is the full `npm run lint` (since 2026-07-27):
the backlog this paragraph used to describe was ten trivial findings, and they are
fixed, so the gate is closed behind them. `build:check` now runs four checks before
`tsc`:

```bash
npm run lint:boundary     # no framework anywhere below App.ts; dev/ out of the engine;
                          # engine/ AND the score layer fenced against interactions/ and bus/
npm run lint:testnames    # a spec is named after its sibling subject
npm run lint:singletons   # the singleton count in DESIGN-PRINCIPLES.md is still true
npm run lint              # the full ESLint pass
```

The last two are there for the same reason, stated as a rule in
`docs/refactor-plan-2026-07-27.md` Phase 0c: **a comment asserting a fact about the
repository gets a script or a test behind it.** A comment asserting a *design* fact
("N:M is two ints, never a Fraction") cannot rot, because the code enforces it. A
comment asserting a *repo* fact — "this check runs", "there are thirteen of these",
"that suite is the source of truth" — can, and every instance of one in these docs
had. This paragraph was itself one of them.

⚠️ **One trap that closing the `lint` gate exposes: ESLint cannot see `{@link}`, and TypeScript can.**
`tsc`'s `noUnusedLocals` counts a `{@link Foo}` reference as a use of `Foo`; ESLint's
`no-unused-vars` has no idea JSDoc exists. In a codebase as `{@link}`-heavy as this one that
divergence has real consequences, so both current instances carry an `eslint-disable-next-line` with
the reason (`keypadLayouts.ts`'s `rework`, `tupletWindow.ts`'s `TupletBracketEnd`). **Do not "clean
up" either one.** Renaming to the `_` prefix that `varsIgnorePattern` allows *breaks the very links
that make it used*, at which point tsc reports it for real; and deleting it throws away the
documentation the link was carrying — in `rework`'s case, the only producer of a live branch in
`KeypadWidget`. If a third case appears, it gets the same treatment, not a rule change.

**Rule of thumb:** new *logic* goes in `interactions/` or `engine/`. `App.ts`
should only build DOM, construct controllers, and connect them — if a line in it
holds a *rule*, it is in the wrong file.

---

## ⭐ A new feature adds a MODULE

> **A new feature adds a module. It does not add methods to `MusicEngine`,
> `ScoreModel` or `VexFlowRenderer` — nor a per-kind slice to `PaletteController`,
> `MouseController`, `HighlightController`, `RenderController`, `keypadSync` or
> `devToolbar`.**
>
> The facade may gain a one-line delegation. The logic lives in a feature module, in the style
> of `clefOps` / `markOps` / `voiceOps` / `rebarOps` / `TieRenderer` / `SlurRenderer` /
> `FanPass` / `GhostRenderer` / `layout/barWidthRoom` / `interactions/elements/*`.
>
> **A slice too thin to be logic is still a slice.** If what you are adding is the twelfth
> `case` in a family, add the twelfth *module* and a **row in its table**.
>
> **And a SCORE operation goes in the core, not on `MusicEngine`** — `engine/models/**`,
> `utils/**`, `types/**`. `MusicEngine` is the *editor's* facade
> (`docs/DESIGN-PRINCIPLES.md` §5).

This is the standing convention that `docs/refactor-plan-2026-07-27.md` exists to establish,
and it is written down because **extraction without a rule is a rounding error**. The measurement
that says so: the previous pass (2026-07-18) cut `ScoreModel` from 3,714 lines to 2,817 — and in
the 211 commits over the next nine days it grew back by 846, while `VexFlowRenderer` grew by
**2,167** and `MusicEngine` by 1,272. Nothing was done wrong in any one of those commits. Each
feature simply landed where the menu action already was.

Phase 6 then cut `VexFlowRenderer` 5,491 → 3,744 (the fan pass and the ghosts moved out whole)
and `MusicEngine` 3,696 → 3,256 (the bar-width and measured-room arithmetic). Those numbers are
what the rule protects; without it they come back.

**Why the clause now names eight files and not three** (`docs/modularity-plan-2026-07-28.md` §3,
Phase 5). Measured across the window containing that whole pass: the three files the rule NAMED
were cut, and one of them, `ScoreModel`, **grew anyway** — 3,009 → 3,637 — while
`PaletteController`, which the rule did not name, put on 525 and `MouseController` 136. The rule
was not being broken. It forbids putting *logic* in those files, and what lands there is not
logic: it is one more `case`, one more accessor, one more press handler. **The tax is paid in
slices too thin for the first clause to catch**, and a feature pays it into ten files at once — the
fanned beam put 357 lines into two new modules and ~430 lines of wiring into ten shared ones.

What changed in 2026-07-28's Phases 1–3 is that **there is now a table to put the row in.** The
rule stops asking for restraint and starts describing the path of least resistance:

| family | the module you add | the row(s) you add |
|---|---|---|
| a selectable on-score element | `interactions/elements/<kind>.ts` | `ELEMENT_SPECS` (total over the union) + a position in `ELEMENT_HIT_ORDER` (⭐ the order IS the answer to "who wins a press two glyphs both cover") |
| a cursor ghost | a `draw*Ghost` — its OWN module once it is more than a glyph call (`FanGhost`, `TrillGhost`, `OttavaGhost`, `PedalGhost`) | a `ToolGhost` member + a `GHOST_DRAWERS` row + a `toolGhost` case + its class in `GHOST_GROUP_SELECTOR` **and** in `e2e/harness.ts`'s own copy |
| a marking tool | — | `EditorState.MarkingTool` + `MARKING_TOOL_USES_ARMED_LENGTH` |
| a score mutation family | `engine/models/<topic>Ops.ts` | a one-line delegator on `ScoreModel` |

And the counts after it: `ScoreModel` 3,637 → **2,699**, `MouseController` 2,566 → **2,198**,
`RenderController` 360 → **222**, with 31 forwarding methods removed from the ghost pipeline.
⚠️ `PaletteController` is **2,201 and untouched** — the one named file this pass did not reach,
and therefore the honest test of whether the clause is read.

**Why the second clause is not a style preference.** §5 of `DESIGN-PRINCIPLES.md` already forbids
it and names the failure mode exactly: *"someone adds 'merge two passages' to `MusicEngine`
because that is where the menu action lands. It works, ships, and is invisible."* What the
packaging goal (`docs/refactor-plan-2026-07-27.md` §Context) changes is the **consequence**:
today a score operation on the facade is a style violation; once the core is published it means
*the feature is not in the package*, and nobody finds out until an ecosystem consumer needs it.

⚠️ **Lint cannot check this one.** `lint:boundary` makes the import *direction* mechanical, but
putting the logic in the wrong layer imports nothing — a score operation written inside
`MusicEngine` reaches for exactly the same modules it would reach for from the core. The same is
true of the slice clause, for the same reason: a twelfth `case` written into `MouseController`
imports exactly what the twelfth module would have imported. Both are enforced in review, or not
at all. What the tables buy is that the review has something to point at — "there is a row for
this" is checkable by eye in a way that "this feels like a slice" is not.

**What is NOT a violation:** a one-line delegation on the facade (that is the facade's job); a
method whose subject genuinely is the class (`ScoreModel.getScore`, `VexFlowRenderer.clearGhosts`);
and a helper private to one existing method. The test is *"could someone want this without the
editor?"* — if yes, it is a core module.

---

## Where does X live?

| If you're changing… | Go to |
|---|---|
| The note/measure/score data, tie/slur preservation | `engine/models/ScoreModel.ts` |
| Re-barring / paste — the region-rewrite pipeline (capture → relay → materialize → restore) | `engine/models/rebarOps.ts` (free funcs over `score` + a `RebarDeps` callback bundle; ScoreModel delegates) |
| Clef / tuplet mutations (sibling delegated sub-APIs) | `engine/models/clefOps.ts` / `tupletOps.ts` |
| Slurs / engraving-override WRITES / marks on a slot / voice moves | `engine/models/slurOps.ts` / `overrideOps.ts` / `markOps.ts` / `voiceOps.ts` — free functions over `score`, `ScoreModel` delegates. ⚠️ Override READS stay in `engravingOverrides.ts`, so the renderer (which holds a `Score`) cannot write one |
| Placing a note (grid snap, overflow, cross-barline split) | `engine/NoteEntryCoordinator.ts` |
| What a click/drag/pan *does* | `interactions/MouseController.ts` — the GESTURES (pan, box-select, the drags) and the pre-steps. ⭐ Which ELEMENT a press picks is not here: it is `interactions/elements/` and the chain it loops over |
| Letter-key note entry, chord/rest entry | `interactions/KeyboardController.ts` |
| The selection set, multi-select, keyboard nav | `interactions/SelectionController.ts` |
| Which tool/duration/accidental is armed | `interactions/PaletteController.ts` |
| Adding a 9th marking tool (clef/dynamic/stamp/…) | `EditorState.MarkingTool` + build: the compiler names every site — see `docs/marking-tools.md` |
| Adding a selectable on-score element (a new thing a click can pick) | ⭐ ONE new module: `interactions/elements/<kind>.ts` (its hit-test AND how it paints), a row in `ELEMENT_SPECS` and — if a press can land on it — a position in `ELEMENT_HIT_ORDER` (`elements/chain.ts`; the ORDER is the content, and `chain.test.ts` pins it). Then `EditorState.SelectedElement` + build: `assertNeverElement` still names the two sites that stay switches, Delete (`shortcutWiring`) and the Properties report (`selectionSnapshot`) |
| How notation is drawn to SVG | `engine/rendering/VexFlowRenderer.ts` — the pass ORDER and the per-bar work. One family per module beside it, each a free function over `RenderPass`: `TieRenderer`, `SlurRenderer`, `DynamicsLayout`, `TempoLayout`, `FanPass`, `GhostRenderer`. ⭐ A new drawn family joins that list; it does not join the renderer |
| A cursor GHOST (the translucent preview an armed tool shows) | `engine/rendering/GhostRenderer.ts` — a `draw*Ghost`, a `ToolGhost` member (`ghostTypes.ts`), a `GHOST_DRAWERS` row, and a case in `interactions/toolGhost.ts`. ⭐ A ghost with any drawing of its own gets its OWN module beside it (`FanGhost`, `TrillGhost`, `OttavaGhost`, `PedalGhost`) and reuses ITS PASS's own draw function, so a preview cannot become a different glyph from the engraved mark. ⚠️ The payload is ENGINE-owned, never the editor's `MarkingTool`: `lint:boundary` fences `src/engine/**` off from `@/interactions`. `VexFlowRenderer.ghostOverlay` frames every one: take the last ghost down, refuse if there is no page. ⚠️ A ghost's class must be in `GHOST_GROUP_SELECTOR` or it is never removed and smears a trail — and in `e2e/harness.ts`'s own copy of that list, or the browser test reads an empty page |
| A GUIDE from a selected element to what it is attached to (the dashed "anchor line") | `HighlightController.applyAnchorGuideLine` draws it; the RENDER measures it. ⭐ Kind-agnostic since 2026-08-17 — **adding a kind is two edits, neither in the guide**: the pass that draws the element captures `anchor` (the point on the NOTE) and `guideFrom` (the point on the ELEMENT) into its `ElementInfo`, and the kind's row in `ELEMENT_SPECS` calls it from `highlight`. 🚨 `guideFrom` is a point ON the element, so `ElementRegistry.shiftById` moves it with the element — `anchor` stays put, which is the whole point of the guide. ⚠️ Ink, not box: see `rendering/dynamicMarkInk.ts` for why a bbox corner reads as blank space over a `p` (`docs/dynamic-offset-plan.md`, which also carries MuseScore's dispatch table for the kinds still to come) |
| WHERE a cursor ghost sits, and whether a tool ALSO takes the blue caret | `engine/rendering/ghostCursor.ts` — ⭐⭐ ONE position for every sign-shaped ghost, taken from the accidental's (left of the pointer, centred on its line — his reference, 2026-08-17). ⛔ **Never derive a ghost's offset from where its mark is engraved**: a ghost is a sign FOR THE USER, and two bugs in one day came from forgetting it (`Ped.` dropped below the pointer, where the arrow covered it; `8va` above and `8vb` below, so the eye re-found it on every switch — `docs/pedal-plan.md` §7). And a tool that draws a ghost must NOT be in `scoreCursorClass`'s `cursor-place` list: that list is exactly `toolGhost`'s `null` cases |
| How much room an event earns, and how a bar's surplus is shared | `engine/layout/spacing.ts` — the duration curve (LilyPond's log law by default, Gould's √2 power law beside it), the ink as a `max` under it, and Gourlay's spring solve. PURE: `Fraction` in, staff spaces out, no VexFlow and no DOM, so it is testable against *Behind Bars* in node. Its input comes from `engine/layout/measureColumns.ts`, which merges a measure into COLUMNS — one x per rhythmic position across every voice AND staff, with a fan's members ordinary columns and the barline the last one |
| WHERE each column is drawn inside a bar | `engine/rendering/spacingPass.ts` — the model's x's written onto the tick contexts after `format()`. ⭐ Nothing between `format()` and `draw()` reads `TickContext.x`, so the last `setX` wins and beams, ties, tuplets and the `ElementRegistry` all follow for free. ⭐ Staves align because every one is handed the SAME merged column list — **`MeasurePlacement.system`**, resolved once per measure — and not because they share a `Formatter`. 🚨 That last sentence was written in three places and true in none until 2026-07-30: the renderer was resolving each staff's LANE, and a grand staff's two hands drifted 1.0 → 2.4 staff spaces apart across one bar. A claim that one number is shared needs a test that two readers get the SAME number (`e2e/systems.e2e.ts`). ⛔ Skipped on a bar holding a fan until P5 |
| What a CLEF and a METER cost at the front of a bar | `engine/layout/headerInk.ts` — measured per clef, and **1.2 staff spaces per meter DIGIT plus 1.2**, with 1.0 between adjacent parts. ⭐ The layout reserves it and `applyLeadIn` places the first note from the same number, so the two cannot disagree. ⚠️ `LAYOUT_CONFIG.CLEF_HIT_WIDTH` and friends are hit-boxes — a FINGER, not this |
| How much room an event's own GLYPHS need | `engine/layout/spacingPadding.ts` — the extents (notehead, accidental stacks, dots, ledger overhang, **flags**) with their HEIGHTS, and the least space between two adjacent things, **keyed by the pair**. ⭐ Every extent was MEASURED off our own drawing in Chrome and is re-measured by `e2e/spacing.e2e.ts` (widths) and `e2e/kerning.e2e.ts` (heights, via canvas `actualBoundingBox*` — an SVG `<text>`'s box is the FONT's line box and is not a height). ⭐ A new element that takes horizontal room adds a ROW here; ⛔ never a constant of its own. `MIN_COLUMN_GAP` (1.43 spaces) is the model's own floor and the number every drag gesture stops at. ⚠️ A FLAG is counted only where one is DRAWN (`beamRoleAt` = `'single'`): counting it on beamed notes too is what once made an eighth measure wider than a quarter. A BEAM needs no width at all — its ink, and a hook's, lies BETWEEN columns at the stem-tip end |
| Whether two inks CLASH at all | `engine/layout/kerning.ts` — the ink is a list of **located boxes** (reach either side, plus the vertical band), and a gap's floor is a max over box PAIRS that cannot get out of each other's way. ⭐ So a left-hand accidental buys no room in the right hand's gaps, and a low sign tucks under a high notehead — while ⛔ two noteheads never kern (overlapping heads read as SIMULTANEOUS, across staves as within one) and nothing tucks through a barline. ⚠️ A beamed note's stem is treated as reaching the far side of the staff: its real length is not a width-time fact, so the kern is declined rather than risking ink through ink |
| How far a column / a bar may still be squeezed | `engine/layout/measuredRoom.ts` — MEASURED off the last render through `ElementRegistry`, never predicted. ⚠️ The caller owns the staleness rule (`modelDirty` ⇒ decline): a fresh number against an old picture slides the floor one step per press |
| What a bar-width gesture may do (slopes, floors, the ceiling) | `engine/layout/barWidthRoom.ts` — a PURE function of the casting-off + the stored stretch + the view mode + the surface + one measured slack, so `docs/bar-width-plan.md` §4–§5 can be stated in a unit test |
| Which PAGE a system lands on, and where on it | `engine/layout/pageCastOff.ts` — the whole vertical algorithm, and short because system heights are already known. It asks the surface ONE question (`contentHeightPx`; `null` ⇒ never break, which is the canvas), and never how the sheets are ARRANGED — that is a drawing decision and lives in `engine/rendering/PagePass.ts`, which draws them and owns the axis (`PAGE_FLOW`: side by side today, `'vertical'` a real option) in `pageOriginPx`/`surfaceSizePx` and nowhere else. ⚠️ A system taller than a page takes one and overflows it; the `used > 0` guard is what stops that being an infinite loop |
| The SURFACE the music is drawn on (page size, margins, the width it wraps at) | `engine/layout/surface.ts` — a `Surface` is authored *input*, not derived, and it is the one thing in `engine/layout/` that isn't read off the last render. ⭐ A **canvas** has no physical size (that invariant is what stops a sketching width becoming a page); a **page** is mm. One union in, one flat `SurfaceMetrics` out, so no call site branches on the kind. `MusicEngine` HOLDS the one in use as it holds `viewMode` — ⛔ never `score.layout`, never "the layout *of* the score". `docs/layout-plan.md` |
| Marking something as selected on screen | `interactions/HighlightController.ts` — ⭐ **PAINT a mark (`addNode`), don't recolour engraved ink.** A recolour inherits every renderer detail: how many elements a mark is made of, which group owns them, and whether their coordinates are still true (a REUSED measure carries a `translate`, so its rects' own x is stale). See `docs/barline-selection.md` §3 for the four bugs that came of it |
| Hit-testing / "what element is at (x,y)" | `engine/ElementRegistry.ts` |
| Pixel ↔ beat/pitch conversion | `engine/rendering/CoordinateMapper.ts` (+ `ElementRegistry`) |
| Scroll / zoom / viewport | `engine/ViewportModel.ts` (pure), `interactions/ViewportHost.ts` (DOM) |
| Playback / audio | `engine/audio/PlaybackEngine.ts` (clock + scheduling) |
| The sound source (swappable) | `engine/audio/InstrumentPlayer.ts` seam → `WebAudioFontInstrument.ts` |
| The public API the UI calls | `engine/MusicEngine.ts` (facade) |
| All editor UI state | `interactions/EditorState.ts` |
| A keybinding | `shortcuts/ShortcutConfig.ts` |
| Starting PLAYBACK | `p` (`togglePlayback`) — Sibelius's own key for it, and like Sibelius it plays **from the selection**: `interactions/playbackStart.ts` answers which bar, ⭐ with a selected BARLINE meaning the bar that starts AFTER it (the line *ends* bar N) and a group meaning its EARLIEST member by position, not by click order. Starting **clears the selection** — during playback the thing you are attending to is the music, and a stray key must not edit the note you left picked. ⭐ `Escape` stops too, ahead of everything else it means. MuseScore spends `p` on its piano-keyboard panel; ⚠️ Space is not available to us, it is note entry's typewriter key. The shortcut calls the SAME `App.togglePlayback` the dev shell's ▶ button runs — a second way to press it, never a second implementation |
| **Playing from somewhere other than the top** | `PlaybackEngine.seekToMeasure` sets the bar; `play()` turns it into an **origin shift** via `playableFrom` (`audio/playbackSchedule.ts`): drop every note attacked before it, move the rest earlier by the seconds that bar sits at, and set `playbackStartTime = now − startSeconds` so the position loop — which measures from the top of the score — needs no notion of a seek at all. The auto-stop timer subtracts the same offset. ⚠️ For months `seekToMeasure` set a field **nothing read**: it moved the position READOUT and not one scheduled note, so every play began at bar 1. It cannot be caught by a unit test (`play()` needs an AudioContext), which is why the decision lives in a pure function that has one |
| What a NUMPAD key does | `windows/keypad/keypadLayouts.ts` — **not** ShortcutConfig, which binds all 16 pad keys to one `keypadKey` action. The pad is the Keypad panel: a key presses the cell under it *on the page that is showing*. See `docs/keypad.md` |
| A pure music calculation (durations, meter, fractions) | `utils/` |
| "which lane is this in?" / "how long is this?" | Four accessors, never a hand-written `?? 0`: `utils/lanes.ts` `voiceOf` / `staffOf` (absent = the first voice/staff) and `utils/durations.ts` `writtenLength` / `slotLength` (`slotLength` prefers `actualDuration`, so a tuplet member and a measure rest time correctly). They resolve an absent FIELD, not an absent OBJECT — `maybeNote?.voice ?? 0` is a different question and stays written out |
| Which notes are beamed together | `utils/beaming.ts` (pure — a run of bars, each with its own `MeterInfo`, → index groups; one bar is a run of one). The per-note override lives on the NOTE (`Chord.beam`), not in `engravingOverrides`. See `docs/beaming.md` |
| A beam that crosses a BARLINE | `rendering/CrossBarBeams.ts` decides which barlines are open (bounded by the system break and by any unpainted bar); the bar gives its joined notes a **placeholder** beam, and the one real `Beam` is drawn in a post-measure pass **outside both measure groups**, like a tie. It rides both bars' `measureShapeKey` and pins them as span anchors. See `docs/cross-barline-beaming-plan.md` |
| How many beam LINES join them (6 sixteenths subdivided 3+3) | `Chord.secondaryBreak` — a SEPARATE field from `Chord.beam`, not a sixth `BeamMode`: which notes are beamed and how they are subdivided are independent statements. Drawn with VexFlow's `Beam.breakSecondaryAt`; the index translation is `secondaryBreakIndices` in `utils/beaming.ts`. See `docs/beaming.md` |
| A FANNED (feathered) beam — one note played and drawn as many | `Chord.fan` is the ASSERTION ("play this note as six, accelerating"); the RHYTHM is a projection from `utils/fannedBeam.ts` (`fanMembers`), read by BOTH the drawing (`rendering/FannedBeam.ts`) and the playback so they cannot disagree. The slot keeps its own duration — one event, indivisible, so no re-tile can break the group. Only the PITCHES are stored (`FanMark.members`, member 0 IS the slot's own chord), because a pitch cannot be derived; `normalizeFan` is the one function allowed to keep them in step with `count`. ⭐ Its WIDTH is no longer its own question: each member is an ordinary COLUMN at its own exact beat (`fanMemberBeats`), so the bar asks for the sum of what those durations earn and each gap is the spacing rule applied to that member. That deleted `fanColumns`, `fanRoom.ts` and three more constants — see `docs/spacing-model-plan.md` §P5. Also `docs/fanned-beams-plan.md` + `docs/fanned-beam-pitches-plan.md` |
| Which accidental SIGN a note displays | One forward walk — `displayedAccidentals` (`utils/accidentalState.ts`), read by `NoteBuilder` for the `StaveNote`s AND by the fan renderer for its hand-drawn member heads, so the drawing can never invent a second rule. Its query twin `prevailingAlterations` answers "what is in force at this beat?" for the palette and the selection. ⚠️ Scope is the CALLER's: pass one lane's slots, and use `measureAccidentalNotes` (not `getMeasureNotes`) where fanned members must count — they alter the bar like any other note |
| **Choosing a colour** | Three semantic modules in `utils/`, never a stray hex: **`voiceColors.ts`** = per-voice note/rest/tuplet selection (V1 blue / V2 green / V3 orange / V4 purple); **`selectionColors.ts`** = the non-voice `INDICATOR_INK` blue, shared by the gutter, the Keypad mode arrow, and every NON-note element selection (clef/time-sig/barline/dynamic/tempo text) — orange is reserved for voice 3, so elements must **not** select in orange; **`chromeColors.ts`** = window/menu/keypad neutrals. Slur-edit handles keep their own orange(open-join)/blue(true-end) language on purpose. |

---

## Key invariants

### Beat is a `Fraction`, except at the pixel boundary

`beat` is an **exact `Fraction`** everywhere in the model and engine — this is why
tuplets and dotted rhythms don't drift. The **only** place beats become floats is
the pixel boundary: when a screen click is quantized to a grid position
(`quantizeBeat()` returns a float), and `beatToFrac()` re-enters exact land.

- New comparisons on beats use `fracCompare` / `fracEq`, **not** `> x + 0.001`.
  (Existing epsilon comparisons are legacy — convert opportunistically when you're
  already editing that function; no mass migration.)
- A function that takes/returns a *float* beat is, by that fact, near the pixel
  boundary. If it's in the model, it should be a `Fraction`.

### The renderer is the source of truth for geometry

`ElementRegistry` records the bbox/SVG group of every drawn element during render;
all hit-testing flows through it. `CoordinateMapper` provides pixel↔position
fallbacks. Don't reinvent "where is this note on screen" — ask the registry.

### A score edit must resync playback

Every mutation in `MusicEngine` must push the new score into `PlaybackEngine`
*and* snapshot for undo. Forgetting the resync silently desyncs audio from the
score — this is exactly the class of bug the `commit()` helper exists to prevent.

### ⚠️ A setter nobody reads is not a feature

`PlaybackEngine.seekToMeasure` stored `currentMeasure` and `play()` never looked at it. The method
existed, was called, returned cleanly, and moved the position *readout* — while every play began at
bar 1. It stayed that way until someone said *"I select bar 3 and it starts from the beginning"*.

Two things make this class of bug survive, and both are worth checking for by name:

- **The write side looks finished.** A field is set, a comment says "sets the starting point for the
  next play()", and nothing anywhere is red. Whenever a method's whole body is an assignment,
  **follow the field to its reader** before believing it.
- **The reader was untestable.** `play()` needs an `AudioContext`, so no unit test could have caught
  it. That is an argument for moving the decision OUT: `playableFrom` is now a pure function over
  (notes, tempo map, start beat), and it has the test the method could never have.

The same shape bit the caller: `playbackStart.ts` read `selectedItems`' KEYS (`"note:abc-123"`,
built by `itemKey`) instead of its values, so every engine lookup missed and every note selection
fell through to bar 1 — **and the spec passed**, because it built the Map by hand with bare ids. ⭐ A
fixture that invents its own data shape tests the fixture. Build test data through the same function
the app builds it with.

### ⚠️ A unit test cannot measure a glyph

jsdom implements the DOM tree, not layout or rendering: `HTMLCanvasElement.getContext()` is absent
(hence the `Not implemented:` lines scrolling past every render test) and SVG has no `getBBox()`. So
under Vitest, **everything horizontal or glyph-shaped is fiction and everything from stave arithmetic
is real**:

```
getGlyphWidth()                        0     (every note, every duration)
getNoteHeadBounds()                    yTop === yBottom
preCalculateMinTotalWidth(two 8ths)    8px   (far larger in a browser)
stem extents, stave line Y             REAL — arithmetic, no text involved
```

Two consequences, and the first is the dangerous one:

- **An assertion about glyph geometry passes vacuously** — it measures zeros and agrees with itself.
  This is why the render tests assert **node identity and counts** (`getMeasureSVGGroup`, counting
  `g.vf-beam`) and stave-derived numbers, never a drawn position. That convention is load-bearing.
- ⭐ **Bar width is no longer one of them.** It used to be `max(minNoteWidth × 1.15, slots ×
  MIN_NOTE_SPACING)`, and with `minNoteWidth ≈ 0` headless only the flat floor was ever exercised.
  The spacing model made the whole width path **pure arithmetic over durations and a measured ink
  table**, so it computes identically in node and in Chrome and is fully unit-testable. What still
  needs a browser is whether the TABLE still describes the drawing — `e2e/spacing.e2e.ts` re-measures
  it, which is the pairing every predicted number here needs.

⛔ **Do not "fix" this by stubbing `getContext`.** Fake metrics turn every geometry assertion green on
fiction; a loud "I can't do this" beats a quiet invented number. Installing the `canvas` package alone
has the same effect for a subtler reason: jsdom auto-detects it, so the message disappears and the
numbers become non-zero — measured with whatever fallback face Cairo picks, because Bravura is not a
system font.

If we ever do want real metrics in unit tests, it is feasible and the font registration is
**mandatory**, not optional: the fonts here are `.otf` (`public/fonts/Bravura.otf`), which node-canvas
can `registerFont`, and VexFlow exposes `Element.setTextMeasurementCanvas(canvas)` as the injection
point. Even then Cairo/FreeType's `actualBoundingBoxAscent/Descent` will not match Skia exactly, so
assertions need tolerances and a real browser stays the source of truth.

### The browser suite — `npm run test:e2e`

That suite now exists (`e2e/`, `playwright.config.ts` — strung by
`docs/refactor-plan-2026-07-27.md` Phase 5, as the prerequisite for restructuring the renderer in
Phase 6). It is where **every assertion about a drawn position belongs**, because it is the only
place one can be made honestly.

- `e2e/harness.html` + `e2e/harness.ts` boot the **engine alone** — no `App`, no controllers, no dev
  shell — into a real page, and expose `window.__h`: the engine, plus readers that pull the geometry
  out of the drawing (`noteheads`, `stems`, `quads`, `staves`, `barlines`, `crossBarBeams`,
  `ghosts`, `placed`, `paths`, `texts`, `pages`, `svgSize`).
  A failure there is about the renderer, never about wiring; `App.smoke.test.ts` covers wiring in
  jsdom. One engine per page, deliberately: VexFlow reaches back for what it drew with document-wide
  `getElementById`, so a second score makes those ids ambiguous.
- The readers parse the drawing's **own numbers** — a `<text>`'s `x`/`y`, a `<path>`'s `d` — and not
  `getBBox()`. A music glyph is a `<text>`; its box is the text layout box (160px tall for a
  notehead), not its ink. ⚠️ **But a raw `x`/`d` is the position the element was DRAWN at, which is
  not always where it IS** — two families move after the draw, and a reader blind to that reports
  the previous render:
  - a cursor GHOST is drawn wherever its throwaway stave put it and then moved to the pointer by a
    `transform` on its group — hence `placed()`, which composes the element's CTM;
  - a **reused measure** takes the `MOVED` path (P5.4b): a bar whose shape is unchanged but whose
    place is not is *translated* rather than re-engraved, so its stave lines keep their old `d`.
    `staves()` composes the CTM for the same reason. It did not until pages arrived, and the cost
    was a page spec that failed on a correct render — the one case the net most needs to see.

  Composing a CTM is exact and still not a bbox; where nothing moved, the composed and raw readers
  agree.
- The specs are `*.e2e.ts`, not `*.spec.ts`, so vitest's default glob cannot pick them up and try to
  run them in jsdom.
- They are **not** in `tsconfig.json` and so are not typechecked by `build:check` — the same
  treatment `vite.config.ts`, `scripts/` and `perf/` get, and for the same reason: they are Node
  code, and pulling `@types/node` into the app's program to typecheck six files would re-type
  `setTimeout` and friends across `src/`. `npm run lint` does cover them, and every reader is
  exercised by a passing assertion, so a renamed one goes red.

What it covers today is a **small net, not a golden picture**: noteheads/stems/beams, a fanned group
(head crowding + ramp lines converging), both tremolos, the bar-width gesture landing where it was
asked while the line still justifies, casting-off with a ragged last system, a beam drawn on both
sides of a system break, the **ghosts** (each in its own overlay group, at the pointer, and replaced
rather than piled up), and a real PDF coming out of the export. Enough to catch code motion; add
to it when a geometry feature is worth pinning.

⭐ The ghost specs were added *by* Phase 6a rather than before it, and that is the pattern to copy:
they cover the ~900 lines that phase moved into `GhostRenderer`, and a ghost is the one family jsdom
cannot check even in principle — most of them decide whether to draw at all by asking `getBBox()` for
their own size, which answers `undefined` there, so the unit-test version silently removes the ghost
and returns false. **Move code the net does not cover, and string that part of the net first.**

⚠️ It is deliberately **not** in `build:check` — that gate must stay browser-free and fast. Run it
before and after any renderer restructuring.

---

## Adding a new engraved element

You are adding a hairpin, a trill, an 8va bracket, an invisible bar — anything the renderer draws.
The renderer will **not** draw it just because you put it in the model. It redraws a bar only when it
thinks the bar changed, and it decides that from two cache keys. Answer three questions.

**1. Does it take horizontal space?**
Yes → it belongs in the **width key** (`laneFingerprint`, in `MeasureWidthCache.ts`). An accidental
does. A hairpin does not.

> ⚠️ "Belongs in the width key" is not the same as "will widen the bar", and measuring the second will
> mislead you about the first. 🚨 **This paragraph used to say a bar's width is `events ×
> MIN_NOTE_SPACING` and that glyphs do not move it. Both are dead.** The spacing model
> (`docs/spacing-model-plan.md`) made a bar's width the DURATION rule summed over its columns, with
> each event's own ink as a `max` under it — so a duration moves the width always, and a glyph moves
> it wherever its ink beats the rule (an accidental in a run of 16ths does; the same accidental on a
> quarter does not, because 3.6 staff spaces already has room for it). `MIN_NOTE_SPACING` itself no
> longer exists.
>
> Put it in the key anyway. The key's job is "did this bar change?", and over-including is merely slow
> while a stale picture is not recoverable.
>
> An **event** is any slot — a rest counts exactly as a note does. It did not until `87e321e`, and a
> bar of eight rests drew crammed into the width of an empty one.

**2. Does it change how the bar LOOKS?**
Yes → it belongs in the **shape key** (`measureShapeKey`, in `MeasureRedrawKey.ts`). Everything drawn
does, including the weightless things. The shape key *embeds* the width key, so anything with width
is covered automatically; the reverse is not true.

**3. Does it SPAN bars?**
Yes → it must be a **span anchor** (`VexFlowRenderer.spanAnchors`). Otherwise culling removes the bar
holding its endpoint and your element draws detached, or vanishes when the user scrolls. Slurs and
ties already do this.

### Every wrong answer here is silent

Nothing throws. No test goes red. Miss the **shape key** and your element simply *never redraws* —
you edit it, the screen doesn't change, and you go hunting in the renderer for a bug that isn't
there. Miss the **width key** and bars sit at a stale width. So:

> **When unsure, include it.** Putting something in a key where it doesn't belong is merely *slow* —
> the governing clef sat in the width key for months, cost **47% of all layout time**, and never
> mis-drew a single note. Correct-and-slow is recoverable. A stale picture is not.

### The compiler will make you answer

`MEASURE_RENDER_ROLE` (`measureRenderRoles.ts`) classifies every field of `Measure`, typed as
`Record<keyof Measure, …>`. **Add a field to `Measure` and that file stops compiling** until you say
which key it belongs to — and `measureRenderRoles.test.ts` then perturbs your field and checks the
keys actually respond the way you claimed, so a *wrong* answer fails too, not just a missing one.

Fields *inside* a slot (a new `NotePitch.foo`) need no entry: the width key serializes the whole
slot, so they're picked up by construction. That is why it's a content fingerprint and not a list of
fields — see the long comment in `MeasureWidthCache.ts` for what it cost to learn that, and for why
the governing clef and the raw note ids are each deliberately in exactly one of the two keys.

---

## Glossary

Vocabulary that is otherwise tribal knowledge.

| Term | Meaning |
|---|---|
| **slot** | A time position within a measure that holds one musical event. A slot's `type` is `note`, `rest`, or `chord`. `Measure.slots[]` is the internal storage; the public API flattens these to `Note`s. |
| **`Chord` / `NotePitch` / `Rest` / `ChordRest`** | The **internal** rich data model in `ScoreModel`. A `ChordRest` is a slot; a `Chord` holds multiple `NotePitch`es at one beat; a `Rest` is silence. The model is **voice-ready** — multi-voice data shape is already built. |
| **flat `Note`** | The **public projection** of the internal model (`toFlatNote` / `restToFlatNote`). The UI and JSON see flat `Note`s (`{ id, step, alter, octave, duration, measure, beat, … }`), never the internal `Chord`/`NotePitch`. Deliberate two-model design — don't collapse it. |
| **voice-ready** | The data model already supports multiple voices per measure; only the multi-voice *render loop* is deferred. This is why features land "voice-ready". |
| **written vs. sounding** | Written pitch is what's notated; sounding pitch is what plays (they differ for transposing contexts). Kept distinct in pitch handling. |
| **rebar** | Re-flowing notes across barlines when a measure's capacity changes (e.g. a time-signature edit). Bounded rebar **pushes the next TS change forward** rather than cramming overflow. The pure relay algorithm is `utils/rebar.ts`; the region-rewrite *orchestration* (capture ties/slurs/anchors/rest-shifts → relay → materialize → restore) is `engine/models/rebarOps.ts`. |
| **erosion** | Clearing (eroding) the space a spanning note will occupy in the *next* measure before placing the tied continuation — part of the cross-barline tie-split. |
| **tie-split / spanning note** | A note longer than the remaining bar is split at the barline into a chain of tied notes (current measure remainder + next measure(s)). Today done by twin methods in `NoteEntryCoordinator`; consolidation into one `placeSpanningNote` primitive is the headline Tier 2 refactor. |
| **pending-tie** | A tie armed from a note but not yet completed to a partner; re-anchored when its endpoint is deleted. The "first press always flips" / "read the side the renderer last drew" fallbacks support this — they look like hacks but are correct; leave them. |
| **tie vs. slur** | A **tie** joins two *same-pitch* notes into one held sound (`Note.tiedTo`). A **slur** is a phrase mark spanning *different* pitches, a first-class object on `Score.slurs[]`. Different concepts, different code. |
| **beat map** | A linearization of the whole score into an ordered list of beats across measures (`utils/beatMap.ts`), used for cursor navigation and tie-chain expansion. |
| **armed (tool/paste)** | A palette selection (clef, dynamic, time signature) or a pending paste is "armed": the next canvas click places it. Distinct from a *selected* on-score element (chosen for edit/delete) — the armed tool is `EditorState.selectedMarkingTool`, the selected element is `EditorState.selectedElement`, and the two are separate unions because a thing waiting to be placed and a thing already on the page are different states. |
| **measure rest** | A whole-bar rest whose duration is the nominal `'w'` meaning "fill the bar", not a literal whole note — must not be inherited as a real `'w'` duration in non-4/4 bars. |
| **cautionary** | A courtesy clef/time-signature drawn at a line break to warn of an upcoming change. Handled in `VexFlowRenderer` (`chooseVoiceMode` / cautionary logic) — legitimately complex; leave it. |
```
