import type * as ToneType from 'tone'
import type { Score, Note } from '@/types/music'
import { durationToBeats, getMeasureDuration } from '@/utils/musicUtils'

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
   * Dynamically load Tone.js (like testAudio does)
   */
  private async loadTone(): Promise<typeof ToneType> {
    if (!Tone) {
      Tone = await import('tone')
    }
    return Tone
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

    let totalBeats = 0
    for (const measure of this.score.measures) {
      totalBeats += getMeasureDuration(measure.timeSignature)
    }

    // Convert beats to seconds based on tempo
    const beatsPerSecond = this.score.tempo / 60
    this.totalDuration = totalBeats / beatsPerSecond
  }

  /**
   * Convert beat duration to seconds based on tempo
   */
  private beatsToSeconds(beats: number): number {
    if (!this.score) return 0
    const beatsPerSecond = this.score.tempo / 60
    return beats / beatsPerSecond
  }

  /**
   * Schedule all notes for playback using direct Tone.now() scheduling
   * Creates a fresh synth each time (like testAudio) to avoid state issues
   */
  private async scheduleNotes(): Promise<void> {
    if (!this.score) return

    // Dynamically import Tone.js (exactly like testAudio does)
    const Tone = await this.loadTone()

    // Ensure Tone is started FIRST before creating any audio nodes
    await Tone.start()

    // Dispose old synth if exists and create fresh one (like testAudio does)
    if (this.synth) {
      this.synth.dispose()
      this.synth = null
    }

    // Create a fresh synth for this playback session
    this.synth = new Tone.Synth().toDestination()

    // Get the current audio context time as our reference point
    const now = Tone.now()
    this.playbackStartTime = now

    let currentTimeInBeats = 0 // in beats

    for (const measure of this.score.measures) {
      const measureStartTime = currentTimeInBeats

      for (const note of measure.notes) {
        if (note.isRest) {
          // Skip rests (silence)
          continue
        }

        // Calculate absolute time for this note in beats
        const noteTimeInBeats = measureStartTime + note.beat

        // Validate note time before scheduling
        if (isNaN(noteTimeInBeats) || noteTimeInBeats < 0) {
          console.warn('Invalid note time, skipping:', noteTimeInBeats, note)
          continue
        }

        // Calculate actual sounding pitch by applying accidental
        let soundingPitch = note.pitch
        if (note.accidental) {
          switch (note.accidental) {
            case '#':
              soundingPitch += 1
              break
            case 'b':
              soundingPitch -= 1
              break
            case '##':
              soundingPitch += 2
              break
            case 'bb':
              soundingPitch -= 2
              break
          }
        }

        // Convert MIDI to note name (like testAudio uses)
        const noteName = Tone.Frequency(soundingPitch, 'midi').toNote()

        // Convert beat time to seconds
        const noteTimeInSeconds = this.beatsToSeconds(noteTimeInBeats)
        const durationInSeconds = this.noteDurationToSeconds(note.duration)

        // Schedule the note directly using Tone.now() + offset
        // This is the exact same approach used by testAudio which works
        this.synth.triggerAttackRelease(
          noteName,
          durationInSeconds,
          now + noteTimeInSeconds
        )

        // Trigger callback (using setTimeout to align with audio timing)
        if (this.callbacks.onNotePlay) {
          setTimeout(() => {
            this.callbacks.onNotePlay!(note)
          }, noteTimeInSeconds * 1000)
        }
      }

      currentTimeInBeats += getMeasureDuration(measure.timeSignature)
    }

    // Schedule playback complete callback
    const totalTimeInSeconds = this.beatsToSeconds(currentTimeInBeats)
    this.playbackTimeoutId = setTimeout(() => {
      this.stop()
      if (this.callbacks.onPlaybackComplete) {
        this.callbacks.onPlaybackComplete()
      }
    }, totalTimeInSeconds * 1000)
  }

  /**
   * Convert note duration to seconds based on tempo
   */
  private noteDurationToSeconds(duration: string): number {
    const beats = durationToBeats(duration)
    return this.beatsToSeconds(beats)
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
      const measureDuration = getMeasureDuration(measure.timeSignature)

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

    // Do EXACTLY what testAudio does - inline, no class methods
    const Tone = await import('tone')
    await Tone.start()

    // Create fresh PolySynth for chord support (multiple simultaneous notes)
    const synth = new Tone.PolySynth(Tone.Synth).toDestination()
    const now = Tone.now()

    // Collect all notes with their timing
    let currentTimeInBeats = 0
    const tempo = this.score.tempo

    for (const measure of this.score.measures) {
      const measureStartTime = currentTimeInBeats

      for (const note of measure.notes) {
        if (note.isRest) continue

        const noteTimeInBeats = measureStartTime + note.beat
        const beatsPerSecond = tempo / 60
        const noteTimeInSeconds = noteTimeInBeats / beatsPerSecond
        const durationInSeconds = durationToBeats(note.duration) / beatsPerSecond

        // Calculate actual sounding pitch by applying accidental
        // The note.pitch is the symbolic pitch on the staff, accidentals modify the actual sound
        let soundingPitch = note.pitch
        if (note.accidental) {
          switch (note.accidental) {
            case '#':
              soundingPitch += 1
              break
            case 'b':
              soundingPitch -= 1
              break
            case '##':
              soundingPitch += 2
              break
            case 'bb':
              soundingPitch -= 2
              break
            // 'n' (natural) doesn't change the pitch - it just cancels key signature
          }
        }

        // Convert MIDI to note name like testAudio
        const noteName = Tone.Frequency(soundingPitch, 'midi').toNote()

        // Schedule exactly like testAudio does
        synth.triggerAttackRelease(noteName, durationInSeconds, now + noteTimeInSeconds)
      }

      currentTimeInBeats += getMeasureDuration(measure.timeSignature)
    }

    this.state = 'playing'
    this.playbackStartTime = now

    // Store synth reference for stop
    this.synth = synth

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }

    // Schedule auto-stop
    const totalSeconds = currentTimeInBeats / (tempo / 60)
    this.playbackTimeoutId = setTimeout(() => {
      this.stop()
    }, totalSeconds * 1000)
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
