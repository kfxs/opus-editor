# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Important Rules

- **Never commit or push without explicit permission.** Wait for the user to say "commit" or "push" before running git commit or git push commands.
- **⭐ A new feature adds a MODULE. It does not add methods to `MusicEngine`, `ScoreModel` or
  `VexFlowRenderer` — nor a per-kind slice to `PaletteController`, `MouseController`,
  `HighlightController`, `RenderController`, `keypadSync` or `devToolbar`.** The facade may gain a
  one-line delegation; the logic lives in a feature module, in the style of `clefOps` / `markOps` /
  `voiceOps` / `rebarOps` / `TieRenderer` / `FanPass` / `GhostRenderer` / `layout/barWidthRoom` /
  `interactions/elements/*`. **A SLICE TOO THIN TO BE LOGIC IS STILL A SLICE**: if what you are
  adding is the twelfth `case` in a family, add the twelfth *module* and a **row in its table** —
  `ELEMENT_SPECS` + `ELEMENT_HIT_ORDER` (`interactions/elements/chain.ts`), `GHOST_DRAWERS` +
  `ToolGhost` (`engine/rendering/`), `MARKING_TOOL_USES_ARMED_LENGTH`. **And a SCORE operation goes
  in the core (`engine/models/**`, `utils/**`, `types/**`), not on `MusicEngine`** — that is the
  *editor's* facade (`docs/DESIGN-PRINCIPLES.md` §5). Lint cannot check any of this: putting the
  logic in the wrong layer imports nothing, and a slice in the wrong file imports exactly what it
  would have imported from the right one. See `docs/ARCHITECTURE.md` §"A new feature adds a MODULE"
  for the measurements that made it a rule — extraction without it was undone in nine days, and the
  first version of the rule protected only the three files it named while the growth moved to the
  five it did not.

## Project Overview

A music score editor built with VexFlow and WebAudioFont, in plain TypeScript (no UI framework —
Vue was removed, see docs/remove-vue-plan.md). Users can add/edit notes on a staff, play back the
score, and export/import JSON.

## Tech Stack

- **Framework**: **none.** Vue was removed (docs/remove-vue-plan.md) — the editor is plain
  TypeScript and the DOM. ⚠️ Do not add a UI framework, and do not write UI as if one were
  coming; `lint:boundary` refuses framework imports. New UI follows `windows/` and `menus/`:
  a module that builds its own elements and subscribes to state.
- **Notation Rendering**: VexFlow 5
- **Audio Playback**: WebAudioFont (sampled General MIDI; samples fetched from CDN at play time)
- **State Management**: `EditorState` — one plain object behind an emitting Proxy
  (`interactions/EditorState.ts`). `subscribe(fn)` fires once per top-level write, and that IS the
  app's reactivity: the toolbar, Keypad, Properties window, score cursor and gutter are all just
  subscribers. ⚠️ Only TOP-LEVEL writes emit — mutating a nested value (`state.selectedItems.set(…)`,
  or a field of the armed tool) is invisible, so always REASSIGN the field.
- **Styling**: Tailwind CSS
- **Build Tool**: Vite (as a bundler/dev server — no framework plugin)
- **Testing**: Vitest (unit) + Playwright (E2E)

## Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run build:check # Type check + build
npm run test       # Run unit tests (vitest)
npm run test:e2e   # Run the browser GEOMETRY suite (playwright; starts its own vite on :5199)
npm run audit:tests # Report source modules with no spec naming them
```

## Project Structure

See `docs/ARCHITECTURE.md` for the full layer map, the framework-agnostic
boundary, the "where does X live?" table, and the domain glossary. The
dependency direction is `App.ts → interactions → engine`.

```
src/
  App.ts            # The app: builds the score DOM, constructs the controllers,
                    #   owns the lifecycle. No framework.
  dev/              # SCAFFOLDING, deliberately kept: devToolbar + scoreJsonPanel
                    #   (the strip around the viewport) + renderCensus. Reads state,
                    #   calls the palette; the viewport never knows it exists.
  interactions/     # Framework-agnostic controllers (Mouse/Keyboard/Selection/
                    #   Highlight/Palette/Clipboard…) + EditorState + ViewportHost
                    #   (DOM⇄viewport) + shortcutWiring.
  bus/              # The UI NOTICEBOARD: one `EditorBus` object of ~21 publish/subscribe
                    #   seams that `interactions/` and `windows/` both pin to, so neither
                    #   imports the other. Import `{ bus }` from '@/bus' — never a store
                    #   by name. Per-store modules keep their doc comments.
  shortcuts/        # Keyboard shortcut definitions
  engine/           # Framework-agnostic music engine
    MusicEngine.ts        # Facade — coordinates the components below
    NoteEntryCoordinator.ts # Note placement, overflow, cross-barline tie-splits
    ElementRegistry.ts    # Authoritative hit-testing + pixel↔position
    ViewportModel.ts      # Scroll/zoom viewport state
    models/               # ScoreModel (data model), CollisionDetector
    layout/               # WHAT the music is drawn on, and derived-view arithmetic off
                          #   the LAST RENDER: surface (canvas vs page — authored input,
                          #   the one member here that isn't derived) + pageCastOff
                          #   (the VERTICAL casting-off) + barWidthRoom (the gesture's
                          #   closed form) + measuredRoom (what the ElementRegistry says
                          #   a column/bar can still give up)
    rendering/            # VexFlowRenderer, CoordinateMapper, FanPass, GhostRenderer,
                          #   PagePass (the sheets, drawn behind the music)
    audio/                # PlaybackEngine + InstrumentPlayer seam (WebAudioFont)
  types/music.ts    # TypeScript interfaces (Note, Measure, Score, etc.)
  utils/            # Pure helpers — fraction, meter, rebar, restFill,
                    #   beaming, clefUtils, pitchSpelling, dynamics, durations,
                    #   lanes (voiceOf/staffOf — absent means the first one),
                    #   measureCapacity (how much fits in a bar)
```

**The framework-agnostic boundary is enforced by `npm run lint:boundary`** across
`engine/`, `interactions/`, `bus/`, `windows/`, `menus/` and `dev/` — it is a ratchet
kept in place after Vue's removal so a framework cannot creep back in. The same check
now also holds the layer arrows: `engine/`/`interactions/`/`bus/` may not import
`dev/` (which is why `dev/` really does delete cleanly — the engine talks to
`engine/RenderProbe.ts`, and `App.ts` injects the census), and **`engine/` as a whole**
— not just the score layer (`utils/`, `types/`, `engine/models/`) — may not import
`interactions/` or `bus/`. ⚠️ That last arrow was documented in three places and checked
in none until 2026-07-28: a `tool: MarkingTool` parameter in `VexFlowRenderer` passed all
four gates. When the engine needs to be told what the editor has armed, the ENGINE
declares the vocabulary and the editor translates into it — `engine/rendering/ghostTypes.ts`
+ `interactions/toolGhost.ts`, the same shape as `engine/RenderProbe.ts`.

## Core Types (src/types/music.ts)

Pitch is stored as **spelling** (`step` + `alter` + `octave`, MusicXML/music21
convention), **not** as a raw MIDI integer — use `spellingToMidi()` from
`utils/pitchSpelling.ts` to derive MIDI. Rests leave the pitch fields undefined.
`beat` is an exact `Fraction` (see the Fraction/float invariant in ARCHITECTURE.md).

```typescript
// Public flat Note — what addNoteAtBeat / getNote / updateNote return:
Note: { id, step?, alter?, octave?, duration, dots?, measure, beat (Fraction),
        isRest?, stemDirection?, tiedTo?, tiedFrom?, voice?, staff?, ... }
// Container shapes — getScore() / exportJSON() serialize these directly:
Measure: { id, number, slots: ChordRest[], timeSignature, clefs?, dynamics?,
           tempos?, tuplets, ... }
Score: { id, title, composer?, measures[], staves?, staffGroups?, slurs?,
         engravingOverrides? }
```

> Note: `Score` deliberately has **no** `tempo` / `keySignature` /
> `defaultTimeSignature` / `clef` field — every one of those is resolved
> **positionally** (tempo/meter from `Measure.tempos`/`timeSignatureChange`,
> clef per-staff from `Measure.clefs`), never stored globally. `types/music.ts`
> records why on each (a global would silently mean "the value at bar 1 beat 0" —
> the conflation that made the old `score.clef` bleed across staves).
>
> `ScoreModel` works internally on a richer `Chord / NotePitch / Rest / ChordRest`
> model (the "voice-ready" shape stored in `Measure.slots`) and projects the flat
> `Note` above for the public note API. See `src/types/music.ts` for the full,
> authoritative definitions.

**Duration values**: `'w'` (whole), `'h'` (half), `'q'` (quarter), `'8'`, `'16'`, `'32'`

**Clef types**: `'treble'`, `'bass'`, `'alto'`, `'tenor'`

## MusicEngine API

The `MusicEngine` class is the main interface between UI and engine. Curated
summary — see the class for the full surface (clefs, meter, dynamics, tempo,
slurs, tuplets, staff spacing, engraving overrides each have their own methods):

```typescript
// Note / rest entry — returns the flat Note; null when placement is rejected
addNoteAtBeat(params: NoteParams): Note | null
addNoteAtPosition(coords, duration, accidental?, dots?, ...): Note | null
addChordNote(params: NoteParams): Note
updateNote(noteId: string, updates: Partial<NoteParams>): Note
deleteNote(noteId: string): boolean
convertToRest(noteId: string): Note | null
pasteEvents(...)                 // clipboard paste — reuses the rebar pipeline

// Undo / batching — every mutator saves an undo entry; runBatch makes N edits atomic
runBatch(description: string, fn: () => void): boolean
undo(): boolean; redo(): boolean; canUndo()/canRedo(): boolean

// Rendering
renderScore(): void
renderScoreWithPreview(coords, duration, ...): boolean   // + one ...Ghost() per tool
clearCanvas(): void
getViewMode()/setViewMode(mode: ViewMode)                // paged vs linear view

// Coordinate mapping
pixelToMeasure(coords: PixelCoordinates): number
pixelToPosition(coords, barQuarters): { measure, beat, spelling, staff }

// Playback
play(): Promise<void>; pause(): void; stop(): void
seekToMeasure(measureNumber: number): void; setVolume(volume: number): void

// Import/Export
exportJSON(): string
loadJSON(json: string): void
```

## Key Implementation Details

- **Stem direction**: Calculated based on pitch relative to middle line (B4 for treble clef). Must use `staveNote.setStemDirection()` after creation - VexFlow ignores constructor option.
- **Coordinate mapping**: VexFlowRenderer stores measure bounds; CoordinateMapper converts between pixels and musical positions.
- **Collision detection**: CollisionDetector checks for overlapping notes at same beat/pitch.
- **Rest handling**: Empty beats are filled with rests automatically.
- **The selection is TWO things, deliberately**: `selectedItems`/`selectedNoteId` is the multi-select of NOTES (an anchor and a pivot), and `selectedElement` is the ONE on-score element picked for edit/delete — a discriminated union (`SelectedElement`) covering clef, meter, barline, dynamic, tempo, tuplet, slur, tie, articulation, accidental, dot, stem, tremolo and measure-range. Selecting IS clearing, so there is no clear-list to keep in sync, and every new element kind MUST join the union. Each kind is then ONE module in `interactions/elements/` — its hit-test and how it paints — plus a row in `ELEMENT_SPECS` (total over the union) and, if a press can land on it, a position in `ELEMENT_HIT_ORDER` (⭐ that array's ORDER is the answer to "who wins a press two glyphs both cover"). `assertNeverElement` still names the two sites that stay switches: Delete (`shortcutWiring`) and the Properties report (`selectionSnapshot`). Always *reassign* the field, never mutate it in place.
- **Marking tools**: the armed stamp/entry tools (clef, time signature, dynamic, tempo, articulation, accidental, tie, dot, rest) are ONE `selectedMarkingTool` union on `EditorState` (`interactions/EditorState.ts`) — arming a tool clears the others, and every new tool MUST join the union. Always *reassign* the field, never mutate it in place: the observable Proxy only traps the SET.

## Testing

Unit tests are co-located with source files (`*.test.ts`). Run with `npm run test`.

**A spec is named after its subject, sitting beside it: `Subject.topic.test.ts`.**
A source file splits by *structure*, a spec splits by *topic*, so `ScoreModel.ts`'s
spec has grown chapters — `ScoreModel.fan.test.ts`, `ScoreModel.barWidth.test.ts` —
each still importing `./ScoreModel`. Name a new chapter after the module its
`expect(...)` identifiers are on, **not** its dominant import: the four
`MeasureLayout.*.test.ts` files all construct a `ScoreModel`, but it is the fixture,
not the subject. A test that drives several modules and names none is a *feature
test* and belongs in a per-directory `__tests__/`. `npm run lint:testnames`
(in `build:check`) enforces the sibling rule; `npm run audit:tests` reports the
other direction — modules with no spec naming them, i.e. splits never finished.
See `docs/test-layout-plan.md`.

**⭐ A SPEC MOVES WITH ITS MODULE — extract the tests in the same commit as the code.**
A split that leaves its assertions in the parent has not finished: the parent spec still
knows everything the parent used to do, so it never shrinks and keeps pulling the parent
back, while the extracted module has no contract of its own. That is a structural reason
splits grow back, independent of the "a new feature adds a MODULE" rule above
(`docs/modularity-plan-2026-07-28.md` §5 + Phase 0). `npm run audit:tests` lists who is
still owed one; the parent's own API keeps its own tests — move what the *extracted*
module answers for.

**⚠️ A drawn POSITION is not a unit test.** Unit tests run in jsdom, which has no
layout and no fonts: every music glyph measures 0×0, so an assertion about where the
ink landed measures zeros and agrees with itself. Those tests assert node identity,
counts and stave arithmetic — never a glyph's coordinates. Geometry belongs in the
browser suite: `e2e/*.e2e.ts`, run with `npm run test:e2e`, driving the engine alone
through `e2e/harness.ts`'s `window.__h` (readers for noteheads, stems, beam quads,
staves, barlines). It is NOT part of `build:check` — that gate stays browser-free —
so run it either side of any renderer change. See `docs/ARCHITECTURE.md` §"The
browser suite".
