# Score Editor

A modern music score editor built with Vue 3, VexFlow, and Tone.js.

## Project Status

**Phase 1 Complete** - Developer A: Music Engine & Data Layer

### Completed Features

- ✅ TypeScript interfaces for musical elements (Note, Measure, Score)
- ✅ ScoreModel class with full CRUD operations
- ✅ Music utility functions (duration calculations, MIDI conversions, beat calculations)
- ✅ VexFlow rendering wrapper service
- ✅ Basic score visualization with static example
- ✅ JSON serialization/deserialization
- ✅ Comprehensive unit tests (60 tests passing)

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **Notation Rendering**: VexFlow
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **TypeScript**: Full type safety
- **Audio**: Tone.js (integration pending)
- **Build Tool**: Vite
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── engine/                 # Music Engine (Developer A)
│   ├── models/            # Data models
│   │   └── ScoreModel.ts  # Core score management
│   ├── rendering/         # VexFlow rendering
│   │   └── VexFlowRenderer.ts
│   └── audio/             # Tone.js integration (upcoming)
├── types/                 # TypeScript interfaces
│   └── music.ts          # Core music types
├── utils/                 # Utility functions
│   └── musicUtils.ts     # Music calculations
├── stores/                # Pinia stores (upcoming)
├── components/            # Vue components (Developer B)
├── composables/           # Vue composables (Developer B)
└── ui/                   # UI components (Developer B)
```

## Core API (Developer A)

### ScoreModel

Main class for managing musical scores:

```typescript
const score = new ScoreModel('My Score', 120)

// Add measures
score.addMeasure()

// Add notes
const note = score.addNote({
  pitch: 60,        // Middle C (MIDI)
  duration: 'q',    // Quarter note
  measure: 1,
  beat: 0
})

// Update notes
score.updateNote(note.id, { pitch: 64 })

// Delete notes
score.deleteNote(note.id)

// Serialize
const json = score.toJSON()
const loaded = ScoreModel.fromJSON(json)
```

### VexFlowRenderer

Wrapper for VexFlow notation rendering:

```typescript
const renderer = new VexFlowRenderer(containerElement)
renderer.initialize(1000, 400)
renderer.renderScore(score.getScore())
```

### Music Utilities

Helper functions for music calculations:

```typescript
import {
  durationToBeats,
  midiToNoteName,
  noteNameToMidi,
  getMeasureDuration,
  noteCanFitInMeasure
} from '@/utils/musicUtils'

// Convert durations
durationToBeats('q') // 1 beat
durationToBeats('h') // 2 beats

// MIDI conversions
midiToNoteName(60)    // 'C4'
noteNameToMidi('A4')  // 69
```

## Testing

All core music engine functionality is tested:

```bash
npm test
```

- 33 tests for music utilities
- 27 tests for ScoreModel
- All 60 tests passing

## Next Steps (Phase 2)

Developer A will implement:
- Note-to-pixel coordinate mapping
- Pixel-to-note position resolver
- Note collision detection
- Tone.js playback engine
- MIDI export

Developer B will implement:
- Vue components for UI
- Mouse and keyboard interaction
- Tool panels and controls
- Undo/redo system

## License

ISC
