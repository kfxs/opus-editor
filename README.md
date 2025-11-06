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
- ✅ Professional score visualization
- ✅ JSON serialization/deserialization

**Phase 2:**
- ✅ Coordinate mapping system (pixel ↔ musical position)
- ✅ Interactive click-to-add notes on canvas
- ✅ Note collision detection
- ✅ Measure overflow prevention
- ✅ Tone.js audio playback engine
- ✅ Real-time playback cursor tracking
- ✅ Play/Pause/Stop controls
- ✅ Rest support
- ✅ MusicEngine unified API
- ✅ Continuous measure rendering (no gaps like Sibelius/MuseScore)
- ✅ Comprehensive test suite (116 tests passing)

### Demo Features

The current demo provides:
- **8 empty measures** (4/4 time signature) to start composing
- **Click anywhere** on the staff to add quarter notes
- **Visual feedback** - notes appear instantly
- **Audio playback** - hear your composition with Play/Pause/Stop controls
- **Real-time tracking** - see current measure, beat, and progress
- **Smart validation** - prevents overlapping notes and measure overflow
- **Professional layout** - continuous measures like industry-standard notation software

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **Notation Rendering**: VexFlow 5.0
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **TypeScript**: Full type safety
- **Audio**: Tone.js 15.0
- **Build Tool**: Vite 5.0
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 20.14.0 or higher
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
├── engine/                      # Music Engine (Developer A)
│   ├── models/                  # Data models
│   │   ├── ScoreModel.ts        # Core score management
│   │   └── CollisionDetector.ts # Collision & overflow detection
│   ├── rendering/               # VexFlow rendering
│   │   ├── VexFlowRenderer.ts   # Score rendering
│   │   └── CoordinateMapper.ts  # Pixel/musical position mapping
│   ├── audio/                   # Audio playback
│   │   └── PlaybackEngine.ts    # Tone.js integration
│   └── MusicEngine.ts           # Unified API
├── types/                       # TypeScript interfaces
│   └── music.ts                 # Core music types
├── utils/                       # Utility functions
│   └── musicUtils.ts            # Music calculations
├── stores/                      # Pinia stores (upcoming)
├── components/                  # Vue components (Developer B)
├── composables/                 # Vue composables (Developer B)
└── ui/                         # UI components (Developer B)
```

## Core API (Developer A)

### MusicEngine (Unified API)

Main interface for all music operations:

```typescript
import { MusicEngine } from './engine/MusicEngine'

// Initialize with container element
const engine = new MusicEngine({
  container: document.getElementById('score'),
  width: 1000,
  height: 400
})

// Add notes programmatically
engine.addNote({ pitch: 60, duration: 'q', measure: 1, beat: 0 })

// Add notes by clicking (pixel to position conversion)
engine.addNoteAtPosition({ x: 200, y: 100 }, 'q')

// Playback controls
await engine.play()
engine.pause()
engine.stop()

// Playback callbacks for UI updates
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

// Overflow detection
const overflow = engine.checkOverflow(noteParams)
if (overflow.willOverflow) {
  console.log('Note would exceed measure capacity!')
}

// Coordinate mapping
const position = engine.pixelToPosition({ x, y }, beatsInMeasure)
const coords = engine.noteToPixel(note, beatsInMeasure)

// Rendering
engine.renderScore()

// Export/Import
const json = engine.exportJSON()
engine.loadJSON(json)

// Cleanup
engine.dispose()
```

### Individual Components

#### ScoreModel
Core data management for musical scores:

```typescript
const score = new ScoreModel('My Score', 120)
score.addNote({ pitch: 60, duration: 'q', measure: 1, beat: 0 })
score.addRest('q', 1, 2)
score.updateNote(noteId, { pitch: 64 })
score.deleteNote(noteId)
```

#### CoordinateMapper
Bidirectional pixel/musical position conversion:

```typescript
const mapper = new CoordinateMapper(config)
const position = mapper.pixelToPosition({ x: 200, y: 100 }, 4)
const coords = mapper.noteToPixel(note, 4)
```

#### CollisionDetector
Smart validation for note placement:

```typescript
const detector = new CollisionDetector()
const collision = detector.checkNoteCollision(newNote, existingNotes)
const overflow = detector.checkMeasureOverflow(note, measure, notes)
```

#### PlaybackEngine
Audio playback with Tone.js:

```typescript
const playback = new PlaybackEngine()
playback.setScore(score)
await playback.play()
playback.pause()
playback.stop()
```

## Testing

All core music engine functionality is tested:

```bash
npm test
```

Test Coverage:
- 33 tests for music utilities
- 27 tests for ScoreModel
- 31 tests for CoordinateMapper
- 25 tests for CollisionDetector
- **All 116 tests passing**

## Key Features Explained

### Note Placement
- Click anywhere on the staff to add quarter notes
- Notes snap to valid positions (quantized to quarter beats)
- Collision detection prevents overlapping notes at the same pitch
- Overflow prevention ensures measures don't exceed time signature capacity

### Professional Rendering
- Measures are continuous without gaps (like Sibelius/MuseScore)
- Clef appears at the start of each line
- Time signature only shown once at the beginning
- Proper staff line spacing and alignment

### Audio Playback
- Real-time audio synthesis with Tone.js
- Accurate tempo-based playback
- Live position tracking (measure, beat, progress)
- Play/Pause/Stop controls

## Next Steps (Phase 3)

### Developer A can implement:
- Accidentals (sharps, flats, naturals)
- Key signature support
- Time signature changes mid-score
- Dotted notes and tuplets
- Dynamic markings (forte, piano, etc.)
- Tempo changes
- Auto-beaming logic
- MIDI export

### Developer B can implement:
- Vue components for UI
- Enhanced mouse and keyboard interaction
- Tool panels (duration selector, property inspector)
- Measure navigator
- Undo/redo system
- Copy/paste functionality
- Drag-and-drop note movement
- Note selection and editing

## License

ISC
