# Score Editor

A modern music score editor built with Vue 3, VexFlow, and Tone.js.

## Features

- **Interactive note entry** - Click on the staff to add notes
- **Audio playback** - Hear your composition with Play/Pause/Stop controls
- **Real-time tracking** - See current measure, beat, and progress
- **Smart validation** - Prevents overlapping notes and measure overflow
- **Professional layout** - Continuous measures like Sibelius/MuseScore
- **Import/Export** - Save and load scores as JSON
- **Automatic stem direction** - Stems point up/down based on pitch
- **Rest support** - Empty beats are automatically filled with rests

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **Notation Rendering**: VexFlow 5
- **Audio Playback**: Tone.js
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Testing**: Vitest + Playwright

## Getting Started

### Prerequisites

- Node.js 20.14.0 or higher

### Installation

```bash
npm install
```

### Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run test       # Run unit tests
npm run test:e2e   # Run E2E tests
```

## Project Structure

```
src/
  App.vue                 # Main Vue component (UI + interaction)
  main.ts                 # App entry point

  engine/                 # Music engine layer
    MusicEngine.ts        # Main API - coordinates all components
    models/
      ScoreModel.ts       # Score/measure/note data management
      CollisionDetector.ts
    rendering/
      VexFlowRenderer.ts  # VexFlow wrapper for notation
      CoordinateMapper.ts # Pixel <-> musical position conversion
    audio/
      PlaybackEngine.ts   # Tone.js playback

  types/
    music.ts              # TypeScript interfaces

  utils/
    musicUtils.ts         # Pitch/duration utilities
```

## Usage

### MusicEngine API

```typescript
import { MusicEngine } from './engine/MusicEngine'

const engine = new MusicEngine({
  container: document.getElementById('score'),
  width: 1000,
  height: 400
})

// Add notes
engine.addNote({ pitch: 60, duration: 'q', measure: 1, beat: 0 })

// Playback
await engine.play()
engine.pause()
engine.stop()

// Export/Import
const json = engine.exportJSON()
engine.loadJSON(json)

// Cleanup
engine.dispose()
```

### Core Types

```typescript
// Note durations
type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | '32'

// Note structure
interface Note {
  id: string
  pitch: number      // MIDI pitch (60 = middle C)
  duration: NoteDuration
  measure: number    // 1-indexed
  beat: number       // 0-indexed
  accidental?: '#' | 'b' | 'n'
  isRest?: boolean
}
```

## License

ISC
