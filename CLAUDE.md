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

```
src/
  App.vue                 # Main Vue component (UI + interaction)
  main.ts                 # App entry point
  style.css               # Global styles

  engine/                 # Music engine layer
    MusicEngine.ts        # Main API - coordinates all components
    models/
      ScoreModel.ts       # Score/measure/note data management
      CollisionDetector.ts # Note collision detection
    rendering/
      VexFlowRenderer.ts  # VexFlow wrapper for notation rendering
      CoordinateMapper.ts # Pixel <-> musical position conversion
    audio/
      PlaybackEngine.ts   # Tone.js playback

  types/
    music.ts              # TypeScript interfaces (Note, Measure, Score, etc.)

  utils/
    musicUtils.ts         # Pitch conversion, duration utilities
```

## Core Types (src/types/music.ts)

```typescript
Note: { id, pitch (MIDI), duration, measure, beat, accidental?, isRest?, stemDirection? }
Measure: { id, number, notes[], timeSignature }
Score: { id, title, measures[], tempo, keySignature, defaultTimeSignature, clef? }
```

**Duration values**: `'w'` (whole), `'h'` (half), `'q'` (quarter), `'8'`, `'16'`, `'32'`

**Clef types**: `'treble'`, `'bass'`, `'alto'`, `'tenor'`

## MusicEngine API

The `MusicEngine` class is the main interface between UI and engine:

```typescript
// Note operations
addNote(params: NoteParams): Note
updateNote(noteId: string, updates: Partial<NoteParams>): Note
deleteNote(noteId: string): boolean
getNoteAtPosition(coords: PixelCoordinates, tolerance?: number): Note | null

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
