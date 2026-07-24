# ARCHITECTURE

A map of the codebase for humans. For *what to build next*, see the `docs/*-plan.md`
files (historical/working plans). For *how the pieces fit together*, read this.

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
│        its purpose. (renderCensus lives here too.)             │
├═════════════════════════════════════════════════════════════┤  ← BOUNDARY
│  interactions/  (framework-agnostic)                          │  Controllers
│      EditorState ............ all editor UI state + THE       │
│                               reactivity (emitting Proxy)      │
│      ViewportHost ........... DOM ⇄ ViewportModel scroll/zoom  │
│      shortcutWiring ......... keybindings → controller actions │
│      MouseController ........ pointer gestures, ghost preview  │
│      KeyboardController ..... letter/rest/chord note entry     │
│      SelectionController .... the selection set + nav          │
│      PaletteController ...... armed tool / duration / accid.   │
│      HighlightController .... recolor SVG groups on select     │
│      ClipboardController .... copy / paste (+ clipboard.ts)    │
│      TextEditController ..... in-canvas DOM text overlay       │
│      RenderController ....... "re-render now" indirection      │
├─────────────────────────────────────────────────────────────┤
│  engine/  (framework-agnostic)                               │  Engine
│      MusicEngine ........... FACADE: the single API the UI    │  (facade +
│                              talks to; coordinates everything  │   services)
│      NoteEntryCoordinator .. placement / overflow / tie-split  │
│      models/ScoreModel ..... THE data model (see glossary)     │
│      models/{clef,tuplet,rebar}Ops . delegated mutation        │
│                              sub-APIs (free funcs over `score`) │
│      models/CollisionDetector                                  │
│      rendering/VexFlowRenderer ... notation → SVG (VexFlow 5)  │
│      rendering/CoordinateMapper .. pixel ↔ musical position    │
│      ElementRegistry ....... rendered-element geometry + hit   │
│                              testing (authoritative)           │
│      ViewportModel ......... scroll/zoom box over the content  │
│      UndoRedoManager ....... snapshot stack                    │
│      audio/PlaybackEngine .. WebAudioFont sampled voices       │
├─────────────────────────────────────────────────────────────┤
│  utils/  pure functions: fraction, meter, rebar, restFill,    │  Pure
│          beaming, beatMap, clefUtils, durations, dynamics,     │  helpers
│          musicUtils, pitchSpelling, slurs, articulations       │
│  types/music.ts  the shared interfaces                         │
│  shortcuts/  declarative keybinding table + manager            │
└─────────────────────────────────────────────────────────────┘
```

**Dependency direction:** each layer may import from the layers below it, never
above. `utils/` import nothing but `types/` and each other. `engine/` and
`interactions/` may use `utils/`. `dev/` reads state and calls controllers.
`App.ts` builds the DOM and wires everything together.

---

## The framework-agnostic boundary

`src/engine/**`, `src/interactions/**`, `src/windows/**`, `src/menus/**` and
`src/dev/**` import **no UI framework**. Neither does `App.ts` — Vue was removed
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
```

It is wired into `build:check`. (The full `npm run lint` exists for information
but is **not** a build gate yet — there is a pre-existing backlog of unrelated
lint findings; cleaning those is a separate, optional task.)

**Rule of thumb:** new *logic* goes in `interactions/` or `engine/`. `App.ts`
should only build DOM, construct controllers, and connect them — if a line in it
holds a *rule*, it is in the wrong file.

---

## Where does X live?

| If you're changing… | Go to |
|---|---|
| The note/measure/score data, tie/slur preservation | `engine/models/ScoreModel.ts` |
| Re-barring / paste — the region-rewrite pipeline (capture → relay → materialize → restore) | `engine/models/rebarOps.ts` (free funcs over `score` + a `RebarDeps` callback bundle; ScoreModel delegates) |
| Clef / tuplet mutations (sibling delegated sub-APIs) | `engine/models/clefOps.ts` / `tupletOps.ts` |
| Placing a note (grid snap, overflow, cross-barline split) | `engine/NoteEntryCoordinator.ts` |
| What a click/drag/pan *does* | `interactions/MouseController.ts` |
| Letter-key note entry, chord/rest entry | `interactions/KeyboardController.ts` |
| The selection set, multi-select, keyboard nav | `interactions/SelectionController.ts` |
| Which tool/duration/accidental is armed | `interactions/PaletteController.ts` |
| Adding a 9th marking tool (clef/dynamic/stamp/…) | `EditorState.MarkingTool` + build: the compiler names every site — see `docs/marking-tools.md` |
| How notation is drawn to SVG | `engine/rendering/VexFlowRenderer.ts` |
| Marking something as selected on screen | `interactions/HighlightController.ts` — ⭐ **PAINT a mark (`addNode`), don't recolour engraved ink.** A recolour inherits every renderer detail: how many elements a mark is made of, which group owns them, and whether their coordinates are still true (a REUSED measure carries a `translate`, so its rects' own x is stale). See `docs/barline-selection.md` §3 for the four bugs that came of it |
| Hit-testing / "what element is at (x,y)" | `engine/ElementRegistry.ts` |
| Pixel ↔ beat/pitch conversion | `engine/rendering/CoordinateMapper.ts` (+ `ElementRegistry`) |
| Scroll / zoom / viewport | `engine/ViewportModel.ts` (pure), `interactions/ViewportHost.ts` (DOM) |
| Playback / audio | `engine/audio/PlaybackEngine.ts` (clock + scheduling) |
| The sound source (swappable) | `engine/audio/InstrumentPlayer.ts` seam → `WebAudioFontInstrument.ts` |
| The public API the UI calls | `engine/MusicEngine.ts` (facade) |
| All editor UI state | `interactions/EditorState.ts` |
| A keybinding | `shortcuts/ShortcutConfig.ts` |
| What a NUMPAD key does | `windows/keypad/keypadLayouts.ts` — **not** ShortcutConfig, which binds all 16 pad keys to one `keypadKey` action. The pad is the Keypad panel: a key presses the cell under it *on the page that is showing*. See `docs/keypad.md` |
| A pure music calculation (durations, meter, fractions) | `utils/` |
| Which notes are beamed together | `utils/beaming.ts` (pure — slots + `MeterInfo` → index groups). The per-note override lives on the NOTE (`Chord.beam`), not in `engravingOverrides`. See `docs/beaming.md` |
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

---

## Adding a new engraved element

You are adding a hairpin, a trill, an 8va bracket, an invisible bar — anything the renderer draws.
The renderer will **not** draw it just because you put it in the model. It redraws a bar only when it
thinks the bar changed, and it decides that from two cache keys. Answer three questions.

**1. Does it take horizontal space?**
Yes → it belongs in the **width key** (`laneFingerprint`, in `MeasureWidthCache.ts`). An accidental
does. A hairpin does not.

> ⚠️ "Belongs in the width key" is not the same as "will widen the bar", and measuring the second will
> mislead you about the first. **A bar's width is `events × MIN_NOTE_SPACING` (18px an event).** That
> floor is the real spacing rule: VexFlow's `preCalculateMinTotalWidth` suggests ~9–15px an event, too
> tight to read, so it practically never wins the `Math.max` in `MeasureLayout.noteSpaceForLane`. The
> consequence is worth knowing before you go bug-hunting: **glyphs do not move the width** — four
> quarters with four accidentals measure exactly the same as four plain ones (measured). Put it in the
> key anyway. The key's job is "did this bar change?", and over-including is merely slow while a stale
> picture is not recoverable.
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
| **armed (tool/paste)** | A palette selection (clef, dynamic, time signature) or a pending paste is "armed": the next canvas click places it. Distinct from a *selected* on-score element (chosen for edit/delete). |
| **measure rest** | A whole-bar rest whose duration is the nominal `'w'` meaning "fill the bar", not a literal whole note — must not be inherited as a real `'w'` duration in non-4/4 bars. |
| **cautionary** | A courtesy clef/time-signature drawn at a line break to warn of an upcoming change. Handled in `VexFlowRenderer` (`chooseVoiceMode` / cautionary logic) — legitimately complex; leave it. |
```
