import type * as ToneType from 'tone'
import type { Score, Note } from '@/types/music'
import { measureCapacityQuarters } from '@/utils/musicUtils'
import { collectScheduledNotes, scoreTotalBeats } from './playbackSchedule'

// Tone.js module - loaded dynamically to avoid AudioContext issues
let Tone: typeof ToneType | null = null

/**
 * Playback state
 */
export type PlaybackState = 'stopped' | 'playing' | 'paused'

/**
 * Playback position information
 */
export interface PlaybackPosition {
  /** Current measure (1-indexed) */
  measure: number
  /** Current beat within measure */
  beat: number
  /** Overall progress (0-1) */
  progress: number
  /** Current time in seconds */
  time: number
}

/**
 * Event callbacks for playback
 */
export interface PlaybackCallbacks {
  onPositionChange?: (position: PlaybackPosition) => void
  onStateChange?: (state: PlaybackState) => void
  onNotePlay?: (note: Note) => void
  onPlaybackComplete?: () => void
}

/**
 * PlaybackEngine handles audio playback of musical scores using Tone.js
 * Uses direct scheduling (like Tone.now()) instead of Transport for reliability
 */
export class PlaybackEngine {
  private synth: ToneType.Synth | ToneType.PolySynth | null = null
  private score: Score | null = null
  private state: PlaybackState = 'stopped'
  private callbacks: PlaybackCallbacks = {}
  private currentMeasure: number = 1
  private currentBeat: number = 0
  private animationFrameId: number | null = null
  private playbackStartTime: number = 0
  private totalDuration: number = 0
  private playbackTimeoutId: ReturnType<typeof setTimeout> | null = null

  constructor() {
    // Synth is created fresh on each play() to avoid AudioContext state issues
  }

  /**
   * Set the score to play
   */
  setScore(score: Score): void {
    this.score = score
    this.calculateTotalDuration()
  }

  /**
   * Register callbacks for playback events
   */
  setCallbacks(callbacks: PlaybackCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return this.state
  }

  /**
   * Calculate total duration of the score in seconds
   */
  private calculateTotalDuration(): void {
    if (!this.score) {
      this.totalDuration = 0
      return
    }

    // Shared spine: total length is the sum of per-measure capacity (staff-agnostic).
    const totalBeats = scoreTotalBeats(this.score)

    // Convert beats to seconds based on tempo
    const beatsPerSecond = this.score.tempo / 60
    this.totalDuration = totalBeats / beatsPerSecond
  }

  /**
   * Update playback position
   */
  private updatePosition(): void {
    if (!this.score || this.state !== 'playing' || !Tone) return

    const elapsedSeconds = Tone.now() - this.playbackStartTime
    const elapsedBeats = (elapsedSeconds * this.score.tempo) / 60

    let accumulatedBeats = 0
    let currentMeasure = 1
    let beatInMeasure = 0

    for (const measure of this.score.measures) {
      const measureDuration = measureCapacityQuarters(measure)

      if (accumulatedBeats + measureDuration > elapsedBeats) {
        currentMeasure = measure.number
        beatInMeasure = elapsedBeats - accumulatedBeats
        break
      }

      accumulatedBeats += measureDuration
    }

    this.currentMeasure = currentMeasure
    this.currentBeat = beatInMeasure

    const progress = this.totalDuration > 0 ? elapsedSeconds / this.totalDuration : 0

    if (this.callbacks.onPositionChange) {
      this.callbacks.onPositionChange({
        measure: currentMeasure,
        beat: beatInMeasure,
        progress: Math.min(progress, 1),
        time: elapsedSeconds,
      })
    }

    // Continue updating
    this.animationFrameId = requestAnimationFrame(() => this.updatePosition())
  }

  /**
   * Start playback from the beginning or current position
   */
  async play(): Promise<void> {
    if (!this.score) {
      throw new Error('No score loaded')
    }

    if (this.state === 'playing') return

    // Do EXACTLY what testAudio does - inline, no class methods.
    // Assign the MODULE-LEVEL `Tone` (don't shadow with a local const): updatePosition and the
    // other methods read this same variable, and its `!Tone` guard would otherwise stay true
    // forever — which is why the position loop (onPositionChange / playback-follow) never ran.
    Tone = await import('tone')
    await Tone.start()

    // Create fresh PolySynth for chord support (multiple simultaneous notes)
    const synth = new Tone.PolySynth(Tone.Synth).toDestination()
    const now = Tone.now()
    const beatsPerSecond = this.score.tempo / 60

    // Flatten the score into sounding notes (shared per-measure clock across ALL staves —
    // see collectScheduledNotes). This pure pass carries ties/legato/dynamics/articulation;
    // here we only convert beats→seconds and hand each note to Tone.
    for (const ev of collectScheduledNotes(this.score)) {
      const noteName = Tone.Frequency(ev.midi, 'midi').toNote()
      synth.triggerAttackRelease(
        noteName,
        ev.durationBeats / beatsPerSecond,
        now + ev.startBeats / beatsPerSecond,
        ev.velocity,
      )
    }

    this.state = 'playing'
    this.playbackStartTime = now

    // Store synth reference for stop
    this.synth = synth

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }

    // Kick off the position-tracking rAF loop. updatePosition self-schedules while playing
    // and drives onPositionChange (progress + playback-follow). Without this first call the
    // loop never starts and onPositionChange never fires.
    this.updatePosition()

    // Schedule auto-stop at the end of the score (totalDuration is kept current by setScore).
    this.playbackTimeoutId = setTimeout(() => {
      this.stop()
    }, this.totalDuration * 1000)
  }

  /**
   * Pause playback
   * Note: With direct scheduling, pause acts like stop (cannot resume mid-note)
   */
  pause(): void {
    if (this.state !== 'playing') return

    // With direct scheduling, we can't easily pause mid-playback
    // So pause behaves like stop
    this.stop()
    this.state = 'paused'

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.state = 'stopped'
    this.currentMeasure = 1
    this.currentBeat = 0

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Clear the playback complete timeout
    if (this.playbackTimeoutId) {
      clearTimeout(this.playbackTimeoutId)
      this.playbackTimeoutId = null
    }

    // Dispose the synth to stop all sound immediately
    if (this.synth) {
      try {
        this.synth.dispose()
      } catch {
        // Ignore dispose errors - synth may already be disposed
      }
      this.synth = null
    }

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }
  }

  /**
   * Seek to a specific measure
   * Note: With direct scheduling, seek only works when stopped
   */
  seekToMeasure(measureNumber: number): void {
    if (!this.score) return

    // With direct scheduling, we can only seek when stopped
    // This sets the starting point for the next play()
    this.currentMeasure = measureNumber
    this.currentBeat = 0
  }

  /**
   * Get current playback position
   */
  getPosition(): PlaybackPosition {
    let elapsedSeconds = 0
    if (this.state === 'playing' && Tone) {
      elapsedSeconds = Tone.now() - this.playbackStartTime
    }
    const progress = this.totalDuration > 0 ? elapsedSeconds / this.totalDuration : 0

    return {
      measure: this.currentMeasure,
      beat: this.currentBeat,
      progress: Math.min(progress, 1),
      time: elapsedSeconds,
    }
  }

  /**
   * Set playback volume (0-1)
   * Note: Volume only applies when synth exists (during playback)
   */
  setVolume(volume: number): void {
    if (this.synth && Tone) {
      this.synth.volume.value = Tone.gainToDb(volume)
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop()
    if (this.synth) {
      try {
        this.synth.dispose()
      } catch {
        // Ignore dispose errors
      }
      this.synth = null
    }
  }
}
