# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Important Rules

- **Never commit or push without explicit permission.** Wait for the user to say "commit" or "push" before running git commit or git push commands.

## Project Overview

A music score editor built with Vue 3, VexFlow, and Tone.js. Users can add/edit notes on a staff, play back the score, and export/import JSON.

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **Notation Rendering**: VexFlow 5
- **Audio Playback**: Tone.js
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Testing**: Vitest (unit) + Playwright (E2E)

## Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run build:check # Type check + build
npm run test       # Run unit tests (vitest)
npm run test:e2e   # Run E2E tests (playwright)
```

## Project Structure

See `docs/ARCHITECTURE.md` for the full layer map, the framework-agnostic
boundary, the "where does X live?" table, and the domain glossary. The
dependency direction is `App.vue → composables → interactions → engine`.

```
src/
  App.vue           # Main Vue component (UI shell + palette)
  composables/      # Thin Vue glue — bind reactivity, wrap the controllers
  interactions/     # Framework-agnostic controllers (Mouse/Keyboard/Selection/
                    #   Highlight/Palette/Clipboard…) + EditorState. NO Vue imports.
  shortcuts/        # Keyboard shortcut definitions
  engine/           # Framework-agnostic music engine
    MusicEngine.ts        # Facade — coordinates the components below
    NoteEntryCoordinator.ts # Note placement, overflow, cross-barline tie-splits
    ElementRegistry.ts    # Authoritative hit-testing + pixel↔position
    ViewportModel.ts      # Scroll/zoom viewport state
    models/               # ScoreModel (data model), CollisionDetector
    rendering/            # VexFlowRenderer, CoordinateMapper
    audio/                # PlaybackEngine (Tone.js)
  types/music.ts    # TypeScript interfaces (Note, Measure, Score, etc.)
  utils/            # Pure helpers — fraction, meter, rebar, restFill,
                    #   beaming, clefUtils, pitchSpelling, dynamics, durations
```

**The `interactions/` + `engine/` framework-agnostic boundary is enforced by
`npm run lint:boundary`** (no `vue`/composable imports may leak inward).

## Core Types (src/types/music.ts)

Pitch is stored as **spelling** (`step` + `alter` + `octave`, MusicXML/music21
convention), **not** as a raw MIDI integer — use `spellingToMidi()` from
`utils/pitchSpelling.ts` to derive MIDI. Rests leave the pitch fields undefined.
`beat` is an exact `Fraction` (see the Fraction/float invariant in ARCHITECTURE.md).

```typescript
// Public flat projection (this is what addNote/JSON use):
Note: { id, step?, alter?, octave?, duration, dots?, measure, beat (Fraction),
        isRest?, stemDirection?, tiedTo?, tiedFrom?, ... }
Measure: { id, number, notes[], timeSignature }
Score: { id, title, composer?, measures[], tempo, keySignature,
         defaultTimeSignature, clef?, slurs? }
```

> Note: `ScoreModel` works internally on a richer `Chord / NotePitch / Rest /
> ChordRest` model and projects the flat `Note` above for the public API and JSON
> (this is the "voice-ready" data shape). See `src/types/music.ts` for the full,
> authoritative definitions.

**Duration values**: `'w'` (whole), `'h'` (half), `'q'` (quarter), `'8'`, `'16'`, `'32'`

**Clef types**: `'treble'`, `'bass'`, `'alto'`, `'tenor'`

## MusicEngine API

The `MusicEngine` class is the main interface between UI and engine:

```typescript
// Note operations
addNote(params: NoteParams): Note
updateNote(noteId: string, updates: Partial<NoteParams>): Note
deleteNote(noteId: string): boolean

// Rendering
renderScore(): void
clearCanvas(): void
resizeCanvas(width: number, height: number): void

// Coordinate mapping
pixelToPosition(coords: PixelCoordinates, beatsInMeasure: number): { measure, beat, pitch }
noteToPixel(note: Note, beatsInMeasure: number): PixelCoordinates

// Playback
play(): Promise<void>
pause(): void
stop(): void
seekToMeasure(measureNumber: number): void
setVolume(volume: number): void

// Import/Export
exportJSON(): string
loadJSON(json: string): void
```

## Key Implementation Details

- **Stem direction**: Calculated based on pitch relative to middle line (B4 for treble clef). Must use `staveNote.setStemDirection()` after creation - VexFlow ignores constructor option.
- **Coordinate mapping**: VexFlowRenderer stores measure bounds; CoordinateMapper converts between pixels and musical positions.
- **Collision detection**: CollisionDetector checks for overlapping notes at same beat/pitch.
- **Rest handling**: Empty beats are filled with rests automatically.

## Testing

Unit tests are co-located with source files (`*.test.ts`). Run with `npm run test`.
