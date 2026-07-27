# DESIGN PRINCIPLES

Forward-looking design constraints that keep the project flexible as it grows.

Where `ARCHITECTURE.md` describes how the code fits together **today**, this file
states what must stay **true** so future directions stay open. Treat these like
`lint:boundary`: check new code against them before it lands.

They are deliberately phrased as *what not to assume*. Each is cheap to honor
while the code is small and expensive to retrofit once features depend on it.

> **Not in this file: framework-agnosticism.** That was never a principle here — it
> was a *mechanism*, `npm run lint:boundary`, and it has been discharged: Vue was
> removed (`docs/remove-vue-plan.md`) and the project has no UI framework. The lint
> ratchet stays so one cannot creep back, but it is a build check, not a design
> constraint. Everything below is about the **model's** assumptions, which is why
> none of it needed revising when the framework went.

---

## 1. A score is a value, not a singleton

The score is an instantiable, serializable, cloneable object — never global,
ambient, or assumed-unique.

- `ScoreModel` can be `new`-ed freely and round-trips through `toJSON` / `fromJSON`.
- Nothing reaches for "the" score through module-level / global state, and nothing
  assumes there is exactly one model / renderer / viewport.
- The code stays able to hold and operate on more than one score at once
  (multiple documents, embedding, side-by-side comparison, fixtures, tests).

**Exception — audio is a single global resource.** `PlaybackEngine` owns one
`AudioContext`, so playback is realistically singular. Keep "what plays" a *parameter* pointed at a
score (`PlaybackEngine.setScore`), never an identity baked into the engine. Data
may be plural; sound output is one.

**Forbidden:** module-level mutable score/engine state; helpers that resolve "the
current score" implicitly; APIs that only work if exactly one document exists.

## 2. Musical material has a position-independent representation, and it is first-class

Music must be expressible **detached from bars, barlines, and absolute position** —
as an ordered stream of events with relative offsets and durations.

- This already exists: the `RebarEvent[]` stream (`flattenRegion` →
  `relayEvents` / `pasteEvents`). Treat it as the canonical currency for *portable
  musical material*, not a private detail of re-barring.
- Its container is `Clip` (`utils/clip.ts`) — lanes of that stream plus everything that
  travels with them. It sits in the CORE, so building and pasting a run of music needs no
  editor; the clipboard is one producer of a clip, not its owner.
- Any operation on "a run of music" — copy/paste, transposition, augmentation,
  reuse, transformation, merging two passages — should be expressible as a
  map/concat over this stream, then re-laid into bars.

**Forbidden:** features that can only operate on bar-anchored data when they
conceptually operate on "a passage of music"; reimplementing flatten/relay instead
of routing through it.

## 3. Content and presentation are separate; the model holds neither pixels nor layout

The data model describes *what the music is*. Pixels, layout, system/page breaks,
spacing, scroll, and zoom describe *how it is shown* and live in the
render/viewport layer.

- The same content is renderable in multiple contexts and sizes without changing
  the model.
- Layout results (positions, breaks, spacing) are derived/cached **views** over
  content — never stored back into `ScoreModel` or its JSON.

This is the existing `ScoreModel` ↔ `VexFlowRenderer` / `ViewportModel` /
`CoordinateMapper` split; the constraint is to **hold the line** as engraving grows.

**Forbidden:** pixel coordinates, viewport, or page-layout state in the data model
or its JSON; render logic mutating musical content.

## 4. Instruments and staves are composable (1..N), not a fixed global ensemble

A score *contains* an ordered set of instruments/staves. A single-staff fragment
and a full multi-instrument score are the **same type** — they differ only in how
many staves they hold and how much music is in them.

- "Place this material into *(instrument, measure, beat)*" must be expressible — and
  now is, as one value: `pasteEvents(clip, target)` where `target` is
  `{ measure, beat, voice, staff }` (`utils/clip.ts`, refactor plan 2026-07-27 Phase 4).
  The clip itself stores staves RELATIVE to its own topmost one, so a staves-1+2 clip
  lands on 3+4 and nothing in it names an absolute ensemble.
- "The full ensemble" never becomes a global assumption baked into entry,
  rendering, or playback such that a small or single-staff score is a special case.

**Forbidden:** a hardcoded/global instrument list; rendering or playback that
assumes a fixed number of staves; entry paths that only work for the "main" staff.

## 5. The score is independent of the editor; the editor is one tool that operates on it

The editor is not the score's container. A score is a thing in its own right, and
**everything you can do to musical material must be doable with no editor, no
renderer, and no DOM** — the editor is handed a score, it does not own the only one.

**The test to apply is a question, not a product:** *could something that is not
this editor do this?* Plenty of such things are imaginable — a batch transformer, a
fragment library, an importer, a diff between two versions, a board where scores are
merged and varied and editors opened onto them — and **none of them is a plan**. The
principle does not rest on which, if any, gets built; it says the score layer must
not presume. Several editors may be open on different scores at once, or none at all.

- The score layer (`engine/models/**`, `utils/**`, `types/**`) is complete and
  self-sufficient: `ScoreModel` holds the full mutation and query API and
  `toJSON`/`fromJSON`, and imports no renderer, viewport, audio or DOM. **Hold that
  line** — it is what makes a score usable outside this application at all.
- Operations on *musical material* — merge, variation, transposition, augmentation,
  fragment extraction — belong to the score layer, expressed over the
  position-independent stream of principle 2. They must never be reachable only
  through the editor's facade.
- `MusicEngine` is the **editor's** facade, not the score's: it is where the
  renderer, viewport, coordinate mapping, playback, undo and note-entry
  coordination live. That is the right home for them — they are editing
  affordances, not properties of the music.
- The dependency arrow points one way: **editor → score, never score → editor.**

**Forbidden:** implementing a score operation on `MusicEngine` (or any editor
controller) because that is where the UI calls it from; score-layer code importing
a renderer, viewport, audio or DOM API; an editor that can only exist if it created
the score itself.

**The failure mode to watch for** is mundane, which is why it needs writing down:
someone adds "merge two passages" to `MusicEngine` because that is where the menu
action lands. It works, ships, and is invisible — until something that is not the
editor needs it, and the operation is welded to a renderer.

## 6. A notational statement that can change mid-score is positional, never global

If a statement about the music can differ at two points in the score, it is stored **at a position**
and resolved by looking backward from the point that asks — never as a field on `Score`.

- Applied three times, each by deletion: **tempo** → `Measure.tempos`, **meter** →
  `timeSignatureChange`, **clef** → per-staff `Measure.clefs`. All three were once `Score` fields;
  all three are gone (`score.clef` removed in `a07e834`).
- Applied pre-emptively to a feature that does not exist yet: `types/music.ts` records why there is
  no `keySignature` and no `defaultTimeSignature`, and the shape a key signature will take when it
  is built (`Measure.keys?: KeyChange[]` carrying a `staffId`).
- The resolution always bottoms out in a **constant**, not in stored state — `DEFAULT_TEMPO`, "no
  accidentals". "Absent" is answered by a rule, not by a global.

**Why a global is worse than merely wrong:** it does not read as a bug. A `score.tempo` silently
means *"the tempo at bar 1 beat 0"*, which is indistinguishable from correct until the second value
appears — and by then everything reads it. That exact conflation is what made `score.clef` bleed
across staves, and it is the reason this is a principle rather than a style note.

**The test, and its other branch:** *can it vary at a point in the score?* Then it is positional, and
it belongs to the thing it varies at. *Is it true of the whole document?* Then it is not notation but
**engraving** — page size, margins, staff size, ragged-last — and boundary case 1 below is where that
half is still open. The two branches are not a spectrum; a statement is one or the other, and naming
which is the decision.

**Forbidden:** a `Score` field for any statement that can change mid-score; a "current X" helper that
resolves such a value from anywhere but a position; storing a default *value* where a default *rule*
belongs.

---

## Known boundary cases

Places where today's code touches one of these principles and the decision should
be made *consciously* before more code piles onto it.

- **Where do document-wide ENGRAVING settings live? (re: principle 3) — OPEN, and deliberately
  parked.** Raised when "justify the last system" (LilyPond's `ragged-last`) was built. It is
  session-only view state today: renderer-owned, mirrored on `EditorState` for the toolbar, in
  `layoutStateKey` so flipping it re-casts the score — the same path `viewMode` takes.

  Two homes were ruled out, and why matters more than the ruling:
  - **Not `engravingOverrides`.** That compartment is **id-keyed — element id → adjustment** — and
    every client is an authored tweak *anchored to a musical element*, anchor-relative and in
    staff-spaces. "The last system" has no anchor, and *which* bars are on it is itself a layout
    result that changes on every edit and resize: exactly the dependency the compartment exists to
    avoid.
  - **Not the `Score`/JSON.** Principle 3 forbids page-layout state in the data model outright.

  ⚠️ **The tension is real, and this entry exists to hold it open.** LilyPond and MuseScore both
  *save* ragged-last with the document, and an author would reasonably expect their choice to
  persist. Session-only is a stopgap, not an answer. The likely resolution is a document-level
  **engraving object** — "what the score should LOOK like" — held beside the content rather than
  inside it, so principle 3 keeps its meaning (the *content* model stays free of layout) without
  pretending presentation is unauthorable.

  ⭐ **The discriminator to sort it by, when it is built, is principle 6** — positional or not. That
  rule was promoted out of this entry (2026-07-27) precisely because it turned out to be doing work
  well beyond engraving; what remains here is how its two branches land on *this* question:
  - **Can it vary at a point in the score?** Then it is positional and belongs to the thing it
    varies at — a **line break** is a property of the measure it happens before, exactly as a clef
    change is.
  - **Is it true of the whole document?** Then it is engraving-object state — **page size**,
    margins, staff size, ragged-last.

  Do not add a second document-wide look setting without settling this; two of them arriving by
  different routes is how the compartment stops meaning anything.

- **~~`Slur.cps` stores geometry in the model (re: principle 3).~~ RESOLVED (Phase 1,
  engraving-overrides plan).** The hand-edited slur shape no longer lives on `Slur`.
  Authored geometry now goes in a dedicated **engraving-overrides compartment**
  (`score.engravingOverrides`, an id-keyed sub-tree of `Score`), stored in
  **staff-spaces** and anchor-relative — not pixels — so the content model and its JSON
  are pixel-free (principle 3 held) and a tweak is resolution-independent. The slur
  `curveShape` override is client #1; old scores carrying inline `Slur.cps` are
  forward-migrated on load (`migrateLegacySlurCps`). The "decide before adding more
  drag-shaped objects" question this entry raised is answered by
  `docs/engraving-overrides-plan.md`: a separate compartment keyed by element id, with
  a per-element recipe for any future adjustable element. Semantic side/direction flips
  (`placement`, `stemDirection`, `tieDirection`) deliberately stay on the content model
  — they are notational meaning, not geometry.

- **`measures` lives directly on `Score`, and "measure N" is a global key (re:
  principle 4).** `getMeasure(n)`, `measure.number`, and renumber-on-insert all
  assume one linear measure list — i.e. one staff. The multi-staff/instrument layer
  must generalize this addressing (a measure number becomes staff-relative) and the
  linear `score.measures` playback walk (it becomes N parallel streams mixed).
  Design the composable instrument/staff layer **before** much more code hardcodes
  `getMeasure(n)`, and keep single-staff as the N=1 case, not a special default.

  **Multi-staff Phase 0 (2026-07-03) took the first, deliberate step.** The staff axis
  is now modeled as a **flat `staffId` discriminator** on `Chord`/`Rest`/`ClefChange`/
  `Dynamic`/`Tuplet` (absent = staff 0, exactly parallel to `voice`), with `Score.staves`
  the ordered staff list. `Score.measures` **stays the shared horizontal spine** (barlines,
  meter aligned across staves) — correct for the grand-staff/piano case, and a
  **deliberately *removable* assumption**, never fused into content. Two invariants keep
  the harder contemporary future (per-staff meters, polymeter, staves of *different*
  measure counts / non-aligned barlines) reachable *additively*, never a teardown:
    1. **Each staff's music stays independently extractable as a position-independent
       stream** (principle 2 — `flattenRegion`/`relayEvents` thread staff alongside voice),
       so "re-bar each staff on its own grid" is always expressible.
    2. **The shared-spine assumption must never be baked into content** — breaking it later
       (per-`StaffContent` meter/barlines; the outer `Measure` as a re-sync unit) is the
       documented path to different measure counts per staff. See docs/multi-staff-plan.md
       §11. The addressing seam is one helper, `engine/models/staffContent.ts`.

- **`createEditorApp` creates its own score rather than being handed one (re: principle 5).**
  `src/App.ts` constructs its `MusicEngine` and calls `initializeEmptyScore()`, so today an editor
  *owns* the only score it will ever show. Everything underneath already supports better —
  `ScoreModel` is instantiable and `MusicEngine` wraps one — so the gap is the entry point's
  signature, not the architecture: `createEditorApp(host, { score })`, with "no score given" meaning
  "make an empty one". Small now; it grows every time something else assumes the editor's score is
  the score. **Decide when a second thing holds a score** — a test harness loading fixtures, a second
  editor, whatever it turns out to be — not before; but do not add code that deepens the assumption
  meanwhile.

- **6 module-level singletons make "exactly one editor" an assumption (re: principles 1 and 5).**
  Not score state — palette and chrome state — so they slip past principle 1's letter while making
  the *editor* singular in the way principle 1 forbids for the *score*:

  ```
  bus/           bus                ← the whole Keypad/window noticeboard, ONE object
  windows/       windows            menus/  menus, menuActions    dev/  renderCensus
  windows/keypad/keypadPageSelection
  ```

  ⚠️ **This count is checked, not promised** — `npm run lint:singletons` fails if the code and the
  number above disagree (`scripts/check-singletons.mjs`, in `build:check`). It was written as
  *thirteen*; it became **26**, and the list nearly doubling **was this entry's own argument firing**,
  since the argument below is that the sweep is contained *because the list is short*. A new
  singleton is a decision, not a detail.

  They are deliberate: the Keypad talks to the editor through the bus without either side knowing the
  other, and `windows`/`menus` exist so "add a window" never means "edit `App.ts`". For one editor
  per page they are correct. For two on a page, both share one duration store and one Keypad.

  ✅ **The resolution is taken, in two steps (2026-07-27).** The choice used to be open between naming
  them a **conscious exception** the way principle 1 does for audio, and making them instance-scoped
  inside `createEditorApp`. **We take the second.** Step one is done: the twenty-one Keypad/window
  seams that used to be twenty-one named exports across `interactions/` are now one `EditorBus`
  object in `src/bus/`, built by `createEditorBus()` and published as the single `bus`. Twenty-six
  call sites that named a store each — `keypadPress.ts` named fourteen, `KeypadWidget.ts` fifteen —
  now import `bus` and nothing else. Step two happens if and when a second editor is real: delete
  that one export and thread `createEditorBus()` through `createEditorApp`. That is roughly five
  files, not twenty-six, which is what the whole entry is about.

  **Keeping the parameter convention is what keeps the cost flat**: a definition module that imports
  the singleton instead of receiving it turns a sweep into archaeology. Window and menu definitions
  already take the layer as a **parameter** (`openClefWindow(windows)`); the one module that broke
  the rule, `menus/insertMenu.ts`, was fixed in the same pass and now receives it too.

  ✅ Related, smaller — **fixed 2026-07-27.** `engine/models/ScoreModel.ts` used to read
  `import.meta.env` to detect Vitest (`STRICT_INVARIANTS`): guarded, but a *bundler* assumption
  inside the score layer, which would have been baked or absent had that layer ever been published
  on its own. The detection now lives in `utils/env.ts` (`isTestRun()`) and reads the neutral
  `process.env`, so the core no longer names Vite anywhere. It has a test rather than a comment
  behind it (`utils/env.test.ts`) because the flag it feeds is private, and a silent `false` would
  have disarmed the measure-integrity check across the entire suite with every test still green.

## How to use this

When adding a feature, ask: *does this make one of the six assumptions above?* If
it does, find the version that doesn't. See `ARCHITECTURE.md` → "Key invariants"
for the lower-level rules (Fraction beats, renderer-as-geometry-source,
commit-resyncs-playback) that these sit above.
