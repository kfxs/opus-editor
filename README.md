# Score Editor

A modern music score editor built with Vue 3, VexFlow, and Tone.js.

## Project Status

**Phase 2 Complete** - Developer A: Note Operations & Playback

### Completed Features

**Phase 1:**
- ✅ TypeScript interfaces for musical elements (Note, Measure, Score)
- ✅ ScoreModel class with full CRUD operations
- ✅ Music utility functions (duration calculations, MIDI conversions, beat calculations)
- ✅ VexFlow rendering wrapper service
- ✅ Basic score visualization
- ✅ JSON serialization/deserialization

**Phase 2:**
- ✅ Coordinate mapping system (pixel ↔ musical position)
- ✅ Click-to-add notes on canvas
- ✅ Note collision detection
- ✅ Measure overflow handling
- ✅ Tone.js audio playback engine
- ✅ Real-time playback cursor tracking
- ✅ Play/Pause/Stop controls
- ✅ Rest support
- ✅ MusicEngine unified API
- ✅ Comprehensive test suite (116 tests passing)

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

### MusicEngine (Unified API)

Main interface for all music operations:

```typescript
import { MusicEngine } from './engine/MusicEngine'

// Initialize
const engine = new MusicEngine({
  container: document.getElementById('score'),
  width: 1000,
  height: 400
})

// Add notes
engine.addNote({ pitch: 60, duration: 'q', measure: 1, beat: 0 })

// Add notes by clicking (pixel to position conversion)
engine.addNoteAtPosition({ x: 200, y: 100 }, 'q')

// Playback controls
await engine.play()
engine.pause()
engine.stop()

// Playback callbacks
engine.setPlaybackCallbacks({
  onPositionChange: (pos) => console.log(pos),
  onStateChange: (state) => console.log(state),
  onNotePlay: (note) => console.log('Playing:', note)
})

// Collision detection
const collision = engine.checkCollision(noteParams)
if (collision.hasCollision) {
  console.log('Note would collide!')
}

// Coordinate mapping
const position = engine.pixelToPosition({ x, y }, beatsInMeasure)
const coords = engine.noteToPixel(note, beatsInMeasure)

// Rendering
engine.renderScore()

// Export/Import
const json = engine.exportJSON()
engine.loadJSON(json)
```

### Individual Components

#### ScoreModel
```typescript
const score = new ScoreModel('My Score', 120)
score.addNote({ pitch: 60, duration: 'q', measure: 1, beat: 0 })
score.addRest('q', 1, 2)
```

#### CoordinateMapper
```typescript
const mapper = new CoordinateMapper(config)
const position = mapper.pixelToPosition({ x: 200, y: 100 }, 4)
```

#### CollisionDetector
```typescript
const detector = new CollisionDetector()
const collision = detector.checkNoteCollision(newNote, existingNotes)
const overflow = detector.checkMeasureOverflow(note, measure, notes)
```

#### PlaybackEngine
```typescript
const playback = new PlaybackEngine()
playback.setScore(score)
await playback.play()
```

## Testing

All core music engine functionality is tested:

```bash
npm test
```

- 33 tests for music utilities
- 27 tests for ScoreModel
- 31 tests for CoordinateMapper
- 25 tests for CollisionDetector
- All 116 tests passing

## Next Steps (Phase 3)

Developer A can implement:
- Accidentals (sharps, flats, naturals)
- Key signature support
- Time signature changes
- Dotted notes and tuplets
- Dynamic markings
- Tempo changes
- Auto-beaming logic
- MIDI export

Developer B will implement:
- Vue components for UI
- Enhanced mouse and keyboard interaction
- Tool panels (duration selector, property inspector)
- Measure navigator
- Undo/redo system
- Copy/paste functionality
- Drag-and-drop note movement

## License

ISC
