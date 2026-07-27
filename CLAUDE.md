# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Important Rules

- **Never commit or push without explicit permission.** Wait for the user to say "commit" or "push" before running git commit or git push commands.

## Project Overview

A music score editor built with Vue 3, VexFlow, and WebAudioFont. Users can add/edit notes on a staff, play back the score, and export/import JSON.

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
npm run test:e2e   # Run E2E tests (playwright)
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
  shortcuts/        # Keyboard shortcut definitions
  engine/           # Framework-agnostic music engine
    MusicEngine.ts        # Facade — coordinates the components below
    NoteEntryCoordinator.ts # Note placement, overflow, cross-barline tie-splits
    ElementRegistry.ts    # Authoritative hit-testing + pixel↔position
    ViewportModel.ts      # Scroll/zoom viewport state
    models/               # ScoreModel (data model), CollisionDetector
    rendering/            # VexFlowRenderer, CoordinateMapper
    audio/                # PlaybackEngine + InstrumentPlayer seam (WebAudioFont)
  types/music.ts    # TypeScript interfaces (Note, Measure, Score, etc.)
  utils/            # Pure helpers — fraction, meter, rebar, restFill,
                    #   beaming, clefUtils, pitchSpelling, dynamics, durations,
                    #   lanes (voiceOf/staffOf — absent means the first one)
```

**The framework-agnostic boundary is enforced by `npm run lint:boundary`** across
`engine/`, `interactions/`, `windows/`, `menus/` and `dev/` — it is a ratchet kept
in place after Vue's removal so a framework cannot creep back in.

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
- **The selection is TWO things, deliberately**: `selectedItems`/`selectedNoteId` is the multi-select of NOTES (an anchor and a pivot), and `selectedElement` is the ONE on-score element picked for edit/delete — a discriminated union (`SelectedElement`) covering clef, meter, barline, dynamic, tempo, tuplet, slur, tie, articulation, accidental, dot, stem, tremolo and measure-range. Selecting IS clearing, so there is no clear-list to keep in sync, and every new element kind MUST join the union (`assertNeverElement` names every site that must handle it). Always *reassign* the field, never mutate it in place.
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
