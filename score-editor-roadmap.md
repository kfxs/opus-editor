# Score Editor - Building Roadmap

## Tech Stack Overview
- **Framework**: Vue 3 with Composition API
- **Notation**: VexFlow for rendering
- **State**: Pinia stores
- **Styling**: Tailwind CSS + custom CSS for notation
- **Types**: TypeScript
- **Audio**: Tone.js
- **Build**: Vite
- **Testing**: Vitest + Playwright

---

## Team Structure

### Developer A: Music Engine & Data Layer
Focus: Core music logic, data models, VexFlow integration, and audio playback

### Developer B: UI/UX & Interaction Layer  
Focus: Vue components, user interaction, visual feedback, and tool panels

---

## Phase 0: Project Setup (Both Developers - Day 1)

### Together:
- [ ] Initialize Vue 3 project with Vite and TypeScript
- [ ] Setup Git repository with clear branch strategy
- [ ] Configure ESLint, Prettier
- [ ] Install core dependencies (VexFlow, Tone.js, Pinia, Tailwind)
- [ ] Define API contract between Music Engine and UI Layer
- [ ] Create basic project structure:

```
src/
  components/       (Dev B)
  composables/      (Dev B)
  stores/          (Shared)
  engine/          (Dev A)
    models/
    rendering/
    audio/
  ui/              (Dev B)
    tools/
    panels/
  types/           (Shared)
  utils/           (Shared)
```

---

## Phase 1: Foundation (Week 1)

### Developer A: Music Engine Core

#### Data Models & Types
```typescript
// types/music.ts
interface Note {
  id: string
  pitch: number      // MIDI number
  duration: string   // "q", "h", "w", "8", "16"
  measure: number
  beat: number
  accidental?: string
}

interface Measure {
  id: string
  number: number
  notes: Note[]
  timeSignature: string
}

interface Score {
  title: string
  measures: Measure[]
  tempo: number
  key: string
}
```

#### Tasks:
- [ ] Create TypeScript interfaces for musical elements
- [ ] Build Score class with CRUD operations for notes
- [ ] Implement measure/beat calculation utilities
- [ ] Create VexFlow wrapper service
- [ ] Setup basic VexFlow renderer with static example
- [ ] Build note duration/position converter utilities
- [ ] Create simple score serialization (JSON)

#### Deliverables:
- Working VexFlow demo rendering a static score
- Score manipulation API (addNote, removeNote, updateNote)
- Unit tests for music logic

---

### Developer B: UI Foundation

#### Tasks:
- [ ] Create main application layout (toolbar, score area, status bar)
- [ ] Build ScoreCanvas component (SVG container for VexFlow)
- [ ] Implement tool palette (note duration selector)
- [ ] Create cursor/ghost note hover system
- [ ] Setup mouse event handlers for note placement
- [ ] Build visual grid/guide system for note snapping
- [ ] Implement basic keyboard shortcuts system

#### Components to Build:
```vue
<ScoreEditor>       // Main container
  <Toolbar>         // Duration selector, play button
  <ScoreCanvas>     // SVG rendering area
  <StatusBar>       // Current position, mode
  <GhostNote>       // Preview on hover
```

#### Deliverables:
- Responsive layout with tool selection
- Mouse position tracking with visual feedback
- Keyboard shortcut infrastructure

---

## Phase 2: Core Interaction (Week 2)

### Developer A: Note Operations & Playback

#### Tasks:
- [ ] Implement note-to-pixel coordinate mapping
- [ ] Create pixel-to-note position resolver
- [ ] Build note collision detection
- [ ] Implement measure overflow handling
- [ ] Setup Tone.js integration
- [ ] Create playback engine with cursor tracking
- [ ] Build MIDI pitch to note name converter
- [ ] Implement tied notes and rests logic

#### API Methods to Expose:
```typescript
engine.addNoteAtPosition(x: number, y: number, duration: string): Note
engine.getNoteAtPosition(x: number, y: number): Note | null
engine.playFromMeasure(measureNumber: number): void
engine.stopPlayback(): void
engine.exportMusicXML(): string
```

#### Deliverables:
- Complete CRUD operations with visual updates
- Basic playback with visual cursor
- Coordinate mapping system

---

### Developer B: Interaction System

#### Tasks:
- [ ] Implement note input mode vs selection mode
- [ ] Create note selection system (click, drag-select)
- [ ] Build context menu for note operations
- [ ] Implement keyboard navigation (arrow keys)
- [ ] Create keyboard note input (A-G keys)
- [ ] Build undo/redo system with Pinia
- [ ] Implement visual feedback for selected notes
- [ ] Create measure navigation

#### Interaction Flows:
1. **Mouse Input**: Click empty space → Add note
2. **Keyboard Input**: Select position → Press A-G → Add note
3. **Selection**: Click note → Show handles → Allow edit
4. **Navigation**: Arrow keys move cursor, Tab moves to next measure

#### Deliverables:
- Complete mouse and keyboard input system
- Visual selection and editing
- Undo/redo functionality

---

## Phase 3: Enhanced Features (Week 3)

### Developer A: Advanced Music Features

#### Tasks:
- [ ] Implement accidentals (sharps, flats, naturals)
- [ ] Add key signature support
- [ ] Create time signature handling
- [ ] Build dotted notes and tuplets
- [ ] Implement dynamic markings
- [ ] Add tempo changes
- [ ] Create measure insertion/deletion
- [ ] Build auto-beaming logic

#### Deliverables:
- Full notation feature set
- Advanced playback with dynamics
- Measure management

---

### Developer B: UI Polish & Tools

#### Tasks:
- [ ] Create property inspector panel
- [ ] Build measure overview/navigator
- [ ] Implement zoom controls
- [ ] Add print preview/export
- [ ] Create settings panel
- [ ] Build help tooltips system
- [ ] Implement copy/paste functionality
- [ ] Add drag-and-drop note movement

#### Deliverables:
- Complete tool panels
- Polished user experience
- Export functionality

---

## Phase 4: Integration & Testing (Week 4)

### Both Developers:

#### Integration Tasks:
- [ ] Merge and resolve any API inconsistencies
- [ ] Optimize rendering performance
- [ ] Implement error handling
- [ ] Add loading/saving functionality
- [ ] Create demo songs/templates
- [ ] Build onboarding tutorial
- [ ] Write E2E tests with Playwright
- [ ] Performance profiling and optimization

#### Testing Checklist:
- [ ] Unit tests for all engine methods
- [ ] Component tests for UI elements
- [ ] E2E tests for common workflows
- [ ] Cross-browser testing
- [ ] Performance benchmarks (100+ notes)
- [ ] Accessibility audit

---

## Integration Points & API Contract

### Shared Pinia Store Structure:
```typescript
// stores/score.ts
interface ScoreState {
  score: Score
  selectedNotes: string[]
  cursorPosition: Position
  currentTool: Tool
  isPlaying: boolean
  playbackPosition: number
}
```

### Event Bus:
```typescript
// Developer A emits:
'note-added', 'note-removed', 'note-updated'
'playback-started', 'playback-stopped', 'playback-position'
'measure-added', 'measure-removed'

// Developer B emits:
'tool-changed', 'selection-changed'
'cursor-moved', 'zoom-changed'
'mode-changed'
```

### Key Interface Methods:

#### From UI to Engine:
```typescript
interface EngineInterface {
  // Note operations
  addNote(note: NoteParams): Note
  updateNote(id: string, updates: Partial<Note>): void
  deleteNote(id: string): void
  
  // Playback
  play(): void
  pause(): void
  stop(): void
  
  // Rendering
  renderScore(): void
  renderMeasure(measureId: string): void
}
```

#### From Engine to UI:
```typescript
interface UIInterface {
  // Visual updates
  refreshCanvas(): void
  highlightNote(id: string): void
  showError(message: string): void
  
  // Playback UI
  updatePlaybackCursor(position: number): void
  setPlaybackState(playing: boolean): void
}
```

---

## Development Guidelines

### For AI-Enhanced Development:

1. **Keep functions small and single-purpose** - Easier for AI to understand and modify
2. **Write comprehensive JSDoc comments** - Helps AI understand intent
3. **Use descriptive variable names** - Reduces ambiguity
4. **Create modular, testable code** - AI can generate tests more easily
5. **Maintain clear separation of concerns** - Allows independent AI assistance

### Code Review Checkpoints:

- **Daily**: Quick sync on API changes
- **End of Phase**: Full integration test
- **Before Phase 4**: Complete code review

### Communication Protocol:

1. **Shared Types**: All interfaces in `/types` folder
2. **API Changes**: Must be documented in `/docs/api.md`
3. **Breaking Changes**: Require both developers' approval
4. **Mock Data**: Shared JSON files for testing

---

## Success Metrics

### Phase 1 Complete When:
- [ ] Can display a staff with clef
- [ ] Can add/remove notes with mouse
- [ ] Can select different note durations

### Phase 2 Complete When:
- [ ] Can input notes via keyboard
- [ ] Can play back the score
- [ ] Can select and edit existing notes

### Phase 3 Complete When:
- [ ] Can use accidentals and dynamics
- [ ] Can manage measures
- [ ] Has polished UI with all panels

### Phase 4 Complete When:
- [ ] Can save/load scores
- [ ] Passes all E2E tests
- [ ] Performance is smooth with 200+ notes

---

## Risk Mitigation

### Potential Bottlenecks:
1. **VexFlow limitations**: Have fallback to custom rendering for specific features
2. **Performance issues**: Implement virtual scrolling early if needed
3. **Complex interactions**: Start with simple modes, add complexity gradually
4. **Integration conflicts**: Daily syncs and clear API contracts

### Backup Plans:
- If VexFlow is too limiting → Switch to ABC.js or custom SVG
- If Tone.js is problematic → Use simpler Web Audio API wrapper
- If performance lags → Consider Canvas instead of SVG

---

## Resources & References

### Documentation:
- [VexFlow Tutorial](https://github.com/0xfe/vexflow/wiki/Tutorial)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Tone.js Docs](https://tonejs.github.io/)
- [Music Theory Basics](https://www.musictheory.net/)

### Example Projects:
- [VexFlow Examples](https://www.vexflow.com/examples/)
- [Flat.io](https://flat.io/) - UI/UX reference
- [MuseScore Web](https://musescore.com/) - Feature reference

### AI Prompting Tips:
- Provide context about VexFlow when asking for notation code
- Include TypeScript types when asking for implementations
- Reference specific musical terminology correctly
- Test generated VexFlow code in isolation first
