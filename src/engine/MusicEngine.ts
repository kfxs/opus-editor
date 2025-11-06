import { ScoreModel } from './models/ScoreModel'
import { VexFlowRenderer } from './rendering/VexFlowRenderer'
import { CoordinateMapper, type CoordinateMapperConfig } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import { PlaybackEngine, type PlaybackCallbacks } from './audio/PlaybackEngine'
import type { Score, Note, NoteParams, PixelCoordinates } from '@/types/music'

/**
 * Configuration for the MusicEngine
 */
export interface MusicEngineConfig {
  /** Container element for rendering */
  container: HTMLElement
  /** Initial canvas width */
  width?: number
  /** Initial canvas height */
  height?: number
  /** Coordinate mapper configuration */
  coordinateConfig?: Partial<CoordinateMapperConfig>
}

/**
 * MusicEngine is the main API that Developer B will use
 * It coordinates all music engine components (models, rendering, audio, collision)
 */
export class MusicEngine {
  private scoreModel: ScoreModel
  private renderer: VexFlowRenderer
  private coordinateMapper: CoordinateMapper
  private collisionDetector: CollisionDetector
  private playbackEngine: PlaybackEngine

  constructor(config: MusicEngineConfig) {
    this.scoreModel = new ScoreModel()
    this.renderer = new VexFlowRenderer(config.container)

    // Calculate coordinate mapper config based on container size
    const width = config.width || 1000
    const height = config.height || 400
    const numMeasures = 2 // Initial number of measures
    const measuresPerLine = Math.max(1, Math.floor(numMeasures / 2))
    const margin = 20
    const availableWidth = width - (margin * 2)
    const staveWidth = Math.floor(availableWidth / measuresPerLine) - 20

    this.coordinateMapper = new CoordinateMapper({
      measureWidth: staveWidth + 20,
      staffHeight: 120 + 30, // staveHeight + verticalSpacing
      startX: margin,
      startY: margin,
      measuresPerLine: measuresPerLine,
      lineSpacing: 10,
      measureLeftMargin: 100,
      ...config.coordinateConfig
    })

    this.collisionDetector = new CollisionDetector()
    this.playbackEngine = new PlaybackEngine()

    // Initialize renderer
    this.renderer.initialize(width, height)

    // Set score in playback engine
    this.playbackEngine.setScore(this.scoreModel.getScore())
  }

  // ==================== Score Operations ====================

  /**
   * Get the current score
   */
  getScore(): Score {
    return this.scoreModel.getScore()
  }

  /**
   * Set score title
   */
  setTitle(title: string): void {
    this.scoreModel.setTitle(title)
  }

  /**
   * Set tempo
   */
  setTempo(tempo: number): void {
    this.scoreModel.setTempo(tempo)
    this.playbackEngine.setScore(this.scoreModel.getScore())
  }

  /**
   * Add a measure
   */
  addMeasure(): void {
    this.scoreModel.addMeasure()
  }

  // ==================== Note Operations ====================

  /**
   * Add a note at a specific position
   */
  addNote(params: NoteParams): Note {
    const note = this.scoreModel.addNote(params)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return note
  }

  /**
   * Add a note at pixel coordinates
   */
  addNoteAtPosition(coords: PixelCoordinates, duration: NoteParams['duration']): Note | null {
    const score = this.scoreModel.getScore()
    const measure = this.scoreModel.getMeasure(1)
    if (!measure) return null

    const beatsInMeasure = measure.timeSignature.numerator

    const position = this.coordinateMapper.pixelToPosition(coords, beatsInMeasure)

    // Validate measure exists
    if (!this.scoreModel.getMeasure(position.measure)) {
      return null
    }

    const noteParams: NoteParams = {
      pitch: position.pitch,
      duration,
      measure: position.measure,
      beat: position.beat,
    }

    // Check for collisions
    const collision = this.collisionDetector.checkNoteCollision(
      noteParams,
      this.scoreModel.getAllNotes()
    )

    if (collision.hasCollision) {
      console.warn('Note collision detected:', collision.reason)
      return null
    }

    return this.addNote(noteParams)
  }

  /**
   * Add a rest
   */
  addRest(duration: NoteParams['duration'], measure: number, beat: number): Note {
    const rest = this.scoreModel.addRest(duration, measure, beat)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return rest
  }

  /**
   * Update a note
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    const note = this.scoreModel.updateNote(noteId, updates)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return note
  }

  /**
   * Delete a note
   */
  deleteNote(noteId: string): boolean {
    const result = this.scoreModel.deleteNote(noteId)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return result
  }

  /**
   * Get note at pixel position
   */
  getNoteAtPosition(coords: PixelCoordinates, tolerance: number = 10): Note | null {
    const allNotes = this.scoreModel.getAllNotes()
    const measure = this.scoreModel.getMeasure(1)
    if (!measure) return null

    const beatsInMeasure = measure.timeSignature.numerator

    for (const note of allNotes) {
      const noteCoords = this.coordinateMapper.noteToPixel(note, beatsInMeasure)

      const distance = Math.sqrt(
        Math.pow(noteCoords.x - coords.x, 2) + Math.pow(noteCoords.y - coords.y, 2)
      )

      if (distance <= tolerance) {
        return note
      }
    }

    return null
  }

  /**
   * Clear all notes
   */
  clearAllNotes(): void {
    this.scoreModel.clearAllNotes()
    this.playbackEngine.setScore(this.scoreModel.getScore())
  }

  // ==================== Rendering Operations ====================

  /**
   * Render the score
   */
  renderScore(): void {
    this.renderer.renderScore(this.scoreModel.getScore())
  }

  /**
   * Clear the canvas
   */
  clearCanvas(): void {
    this.renderer.clear()
  }

  /**
   * Re-initialize renderer with new dimensions
   */
  resizeCanvas(width: number, height: number): void {
    this.renderer.initialize(width, height)
    this.renderScore()
  }

  // ==================== Coordinate Mapping ====================

  /**
   * Convert pixel coordinates to musical position
   */
  pixelToPosition(coords: PixelCoordinates, beatsInMeasure: number) {
    return this.coordinateMapper.pixelToPosition(coords, beatsInMeasure)
  }

  /**
   * Convert note to pixel coordinates
   */
  noteToPixel(note: Note, beatsInMeasure: number): PixelCoordinates {
    return this.coordinateMapper.noteToPixel(note, beatsInMeasure)
  }

  /**
   * Update coordinate mapper configuration
   */
  updateCoordinateConfig(config: Partial<CoordinateMapperConfig>): void {
    this.coordinateMapper.updateConfig(config)
  }

  // ==================== Collision Detection ====================

  /**
   * Check if a note would collide
   */
  checkCollision(noteParams: NoteParams) {
    return this.collisionDetector.checkNoteCollision(noteParams, this.scoreModel.getAllNotes())
  }

  /**
   * Check if adding a note would overflow the measure
   */
  checkOverflow(noteParams: NoteParams) {
    const measure = this.scoreModel.getMeasure(noteParams.measure)
    if (!measure) return null

    return this.collisionDetector.checkMeasureOverflow(
      noteParams,
      measure,
      this.scoreModel.getNotesInMeasure(noteParams.measure)
    )
  }

  /**
   * Find next available position for a note
   */
  findNextAvailablePosition(duration: string, measureNumber: number) {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return null

    return this.collisionDetector.findNextAvailablePosition(
      duration,
      measure,
      this.scoreModel.getNotesInMeasure(measureNumber)
    )
  }

  // ==================== Playback Operations ====================

  /**
   * Play the score
   */
  async play(): Promise<void> {
    await this.playbackEngine.play()
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.playbackEngine.pause()
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.playbackEngine.stop()
  }

  /**
   * Seek to a specific measure
   */
  seekToMeasure(measureNumber: number): void {
    this.playbackEngine.seekToMeasure(measureNumber)
  }

  /**
   * Get playback state
   */
  getPlaybackState() {
    return this.playbackEngine.getState()
  }

  /**
   * Get playback position
   */
  getPlaybackPosition() {
    return this.playbackEngine.getPosition()
  }

  /**
   * Set playback volume (0-1)
   */
  setVolume(volume: number): void {
    this.playbackEngine.setVolume(volume)
  }

  /**
   * Register playback callbacks
   */
  setPlaybackCallbacks(callbacks: PlaybackCallbacks): void {
    this.playbackEngine.setCallbacks(callbacks)
  }

  // ==================== Serialization ====================

  /**
   * Export score as JSON
   */
  exportJSON(): string {
    return this.scoreModel.toJSON()
  }

  /**
   * Load score from JSON
   */
  loadJSON(json: string): void {
    const loaded = ScoreModel.fromJSON(json)
    this.scoreModel = loaded
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.renderScore()
  }

  // ==================== Cleanup ====================

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.playbackEngine.dispose()
    this.renderer.clear()
  }
}
