# ARCHITECTURE

A map of the codebase for humans. For *what to build next*, see the `docs/*-plan.md`
files (historical/working plans). For *how the pieces fit together*, read this.

> **The one rule:** dependencies point **inward and downward**. The framework
> (Vue) lives at the very top; the music engine at the bottom never knows the
> framework exists. This is enforced mechanically — see [The framework-agnostic
> boundary](#the-framework-agnostic-boundary).

---

## Layer map

```
┌─────────────────────────────────────────────────────────────┐
│  App.vue                      UI: template (palette, canvas), │  Vue
│                               wires composables together      │  (framework)
├─────────────────────────────────────────────────────────────┤
│  composables/  useMouseInteraction, useKeyboardEntry,         │  Vue glue
│                useSelection, useRenderer, usePalette,         │  (thin)
│                useViewport, useHighlight, useTextEditing,      │
│                useShortcuts                                    │
│      ↓ thin reactive wrappers — they OWN no logic, they bind  │
│        Vue reactivity to the controllers below                │
├═════════════════════════════════════════════════════════════┤  ← BOUNDARY
│  interactions/  (framework-agnostic)                          │  Controllers
│      EditorState ............ all editor UI state (plain obj)  │
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
│      models/CollisionDetector                                  │
│      rendering/VexFlowRenderer ... notation → SVG (VexFlow 5)  │
│      rendering/CoordinateMapper .. pixel ↔ musical position    │
│      ElementRegistry ....... rendered-element geometry + hit   │
│                              testing (authoritative)           │
│      ViewportModel ......... scroll/zoom box over the content  │
│      UndoRedoManager ....... snapshot stack                    │
│      audio/PlaybackEngine .. Tone.js scheduling/playback       │
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
`interactions/` may use `utils/`. `composables/` wrap `interactions/` + `engine/`.
`App.vue` wires `composables/`.

---

## The framework-agnostic boundary

`src/engine/**` and `src/interactions/**` contain **zero** Vue (or Pinia, or
composable, or `App.vue`) imports. A port to React/Angular/Svelte would rewrite
only `composables/` + `App.vue`; everything below the boundary moves unchanged.
`EditorState` is a plain object precisely so any reactivity system can wrap it
(`reactive()` in Vue, `useReducer`/MobX in React, a service in Angular).

This is **enforced by lint**, not discipline:

```bash
npm run lint:boundary   # fails the build if engine/ or interactions/ import Vue/Pinia/composables/App.vue
```

It is wired into `build:check`. (The full `npm run lint` exists for information
but is **not** a build gate yet — there is a pre-existing backlog of unrelated
lint findings; cleaning those is a separate, optional task.)

**Rule of thumb:** new *logic* goes in `interactions/` or `engine/`. A composable
should only translate Vue reactivity/events to controller calls and back.

---

## Where does X live?

| If you're changing… | Go to |
|---|---|
| The note/measure/score data, rebar, tie/slur preservation | `engine/models/ScoreModel.ts` |
| Placing a note (grid snap, overflow, cross-barline split) | `engine/NoteEntryCoordinator.ts` |
| What a click/drag/pan *does* | `interactions/MouseController.ts` |
| Letter-key note entry, chord/rest entry | `interactions/KeyboardController.ts` |
| The selection set, multi-select, keyboard nav | `interactions/SelectionController.ts` |
| Which tool/duration/accidental is armed | `interactions/PaletteController.ts` |
| How notation is drawn to SVG | `engine/rendering/VexFlowRenderer.ts` |
| Hit-testing / "what element is at (x,y)" | `engine/ElementRegistry.ts` |
| Pixel ↔ beat/pitch conversion | `engine/rendering/CoordinateMapper.ts` (+ `ElementRegistry`) |
| Scroll / zoom / viewport | `engine/ViewportModel.ts`, `composables/useViewport.ts` |
| Playback / audio | `engine/audio/PlaybackEngine.ts` |
| The public API the UI calls | `engine/MusicEngine.ts` (facade) |
| All editor UI state | `interactions/EditorState.ts` |
| A keybinding | `shortcuts/ShortcutConfig.ts` |
| A pure music calculation (durations, meter, fractions) | `utils/` |

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

## Glossary

Vocabulary that is otherwise tribal knowledge.

| Term | Meaning |
|---|---|
| **slot** | A time position within a measure that holds one musical event. A slot's `type` is `note`, `rest`, or `chord`. `Measure.slots[]` is the internal storage; the public API flattens these to `Note`s. |
| **`Chord` / `NotePitch` / `Rest` / `ChordRest`** | The **internal** rich data model in `ScoreModel`. A `ChordRest` is a slot; a `Chord` holds multiple `NotePitch`es at one beat; a `Rest` is silence. The model is **voice-ready** — multi-voice data shape is already built. |
| **flat `Note`** | The **public projection** of the internal model (`toFlatNote` / `restToFlatNote`). The UI and JSON see flat `Note`s (`{ id, step, alter, octave, duration, measure, beat, … }`), never the internal `Chord`/`NotePitch`. Deliberate two-model design — don't collapse it. |
| **voice-ready** | The data model already supports multiple voices per measure; only the multi-voice *render loop* is deferred. This is why features land "voice-ready". |
| **written vs. sounding** | Written pitch is what's notated; sounding pitch is what plays (they differ for transposing contexts). Kept distinct in pitch handling. |
| **rebar** | Re-flowing notes across barlines when a measure's capacity changes (e.g. a time-signature edit). Bounded rebar **pushes the next TS change forward** rather than cramming overflow. See `utils/rebar.ts`. |
| **erosion** | Clearing (eroding) the space a spanning note will occupy in the *next* measure before placing the tied continuation — part of the cross-barline tie-split. |
| **tie-split / spanning note** | A note longer than the remaining bar is split at the barline into a chain of tied notes (current measure remainder + next measure(s)). Today done by twin methods in `NoteEntryCoordinator`; consolidation into one `placeSpanningNote` primitive is the headline Tier 2 refactor. |
| **pending-tie** | A tie armed from a note but not yet completed to a partner; re-anchored when its endpoint is deleted. The "first press always flips" / "read the side the renderer last drew" fallbacks support this — they look like hacks but are correct; leave them. |
| **tie vs. slur** | A **tie** joins two *same-pitch* notes into one held sound (`Note.tiedTo`). A **slur** is a phrase mark spanning *different* pitches, a first-class object on `Score.slurs[]`. Different concepts, different code. |
| **beat map** | A linearization of the whole score into an ordered list of beats across measures (`utils/beatMap.ts`), used for cursor navigation and tie-chain expansion. |
| **armed (tool/paste)** | A palette selection (clef, dynamic, time signature) or a pending paste is "armed": the next canvas click places it. Distinct from a *selected* on-score element (chosen for edit/delete). |
| **measure rest** | A whole-bar rest whose duration is the nominal `'w'` meaning "fill the bar", not a literal whole note — must not be inherited as a real `'w'` duration in non-4/4 bars. |
| **cautionary** | A courtesy clef/time-signature drawn at a line break to warn of an upcoming change. Handled in `VexFlowRenderer` (`chooseVoiceMode` / cautionary logic) — legitimately complex; leave it. |
```
