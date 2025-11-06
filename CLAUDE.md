# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a music score editor built with Vue 3, VexFlow, and Tone.js. The project is designed for two developers working in parallel:
- **Developer A**: Music Engine & Data Layer (core music logic, VexFlow integration, audio)
- **Developer B**: UI/UX & Interaction Layer (Vue components, user interaction, tools)

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **Notation Rendering**: VexFlow
- **State Management**: Pinia stores
- **Styling**: Tailwind CSS + custom CSS
- **Types**: TypeScript
- **Audio Playback**: Tone.js
- **Build Tool**: Vite
- **Testing**: Vitest (unit) + Playwright (E2E)

## Project Structure

The planned architecture follows this structure:

```
src/
  components/       # Vue components (Dev B)
  composables/      # Vue composables (Dev B)
  stores/          # Pinia state stores (Shared)
  engine/          # Music logic layer (Dev A)
    models/        # Data models (Note, Measure, Score)
    rendering/     # VexFlow wrapper and rendering
    audio/         # Tone.js playback engine
  ui/              # UI-specific components (Dev B)
    tools/         # Tool panels
    panels/        # Inspector, navigator panels
  types/           # Shared TypeScript interfaces
  utils/           # Shared utility functions
```

## Core Data Models

Key TypeScript interfaces (defined in roadmap):

- **Note**: `{ id, pitch (MIDI), duration, measure, beat, accidental? }`
- **Measure**: `{ id, number, notes[], timeSignature }`
- **Score**: `{ title, measures[], tempo, key }`

## API Contract Between Layers

### Engine Interface (Dev A exposes to UI)
```typescript
// Note operations
addNote(note: NoteParams): Note
updateNote(id: string, updates: Partial<Note>): void
deleteNote(id: string): void

// Playback
play(), pause(), stop()

// Rendering
renderScore(), renderMeasure(measureId: string)
```

### UI Interface (Dev B exposes to Engine)
```typescript
// Visual updates
refreshCanvas(), highlightNote(id: string), showError(message: string)

// Playback UI
updatePlaybackCursor(position: number)
setPlaybackState(playing: boolean)
```

### Shared Pinia Store Structure
```typescript
interface ScoreState {
  score: Score
  selectedNotes: string[]
  cursorPosition: Position
  currentTool: Tool
  isPlaying: boolean
  playbackPosition: number
}
```

### Event System
- Engine emits: `note-added`, `note-removed`, `note-updated`, `playback-started`, `playback-stopped`, `playback-position`, `measure-added`, `measure-removed`
- UI emits: `tool-changed`, `selection-changed`, `cursor-moved`, `zoom-changed`, `mode-changed`

## Development Phases

1. **Phase 0**: Project setup (Vite, TypeScript, dependencies, ESLint, Prettier)
2. **Phase 1**: Foundation (data models, VexFlow rendering, basic UI layout)
3. **Phase 2**: Core interaction (note CRUD, playback, mouse/keyboard input, undo/redo)
4. **Phase 3**: Enhanced features (accidentals, key/time signatures, dynamics, UI polish)
5. **Phase 4**: Integration, testing, optimization

## Key Development Principles

1. **Separation of concerns**: Music logic (engine/) is independent of UI (components/, ui/)
2. **Single-purpose functions**: Keep functions small and focused
3. **Comprehensive JSDoc comments**: Document intent for all public APIs
4. **Modular, testable code**: Each module should be independently testable
5. **Shared types**: All interfaces in `/types` folder
6. **API changes must be documented**: Update `/docs/api.md` for breaking changes

## Critical Integration Points

- VexFlow coordinate mapping: Converting between pixel positions and musical positions (measure/beat)
- Note collision detection: Preventing overlapping notes
- Measure overflow handling: Managing when notes exceed measure capacity
- Playback cursor synchronization: Visual cursor must match audio playback position

## Potential Technical Challenges

- **VexFlow limitations**: May need custom SVG rendering for advanced features
- **Performance with many notes**: Consider virtual scrolling or Canvas if SVG is slow
- **Complex musical interactions**: Start simple (basic note input) before adding advanced features

## Testing Strategy

- **Unit tests**: All engine methods, music logic utilities
- **Component tests**: Individual Vue components
- **E2E tests**: Complete workflows (add notes, playback, save/load)
- **Performance benchmarks**: Target smooth rendering with 200+ notes
