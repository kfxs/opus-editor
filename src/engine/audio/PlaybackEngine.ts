import * as Tone from 'tone'
import type { Score, Note } from '@/types/music'
import { durationToBeats, getMeasureDuration } from '@/utils/musicUtils'

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
 */
export class PlaybackEngine {
  private synth: Tone.PolySynth | null = null
  private score: Score | null = null
  private state: PlaybackState = 'stopped'
  private callbacks: PlaybackCallbacks = {}
  private scheduledNotes: number[] = []
  private currentMeasure: number = 1
  private currentBeat: number = 0
  private animationFrameId: number | null = null
  private startTime: number = 0
  private totalDuration: number = 0

  constructor() {
    // Synth will be lazy-initialized on first play to avoid AudioContext warnings
  }

  /**
   * Initialize the synthesizer (lazy initialization)
   */
  private initializeSynth(): void {
    if (this.synth) return

    // Create a polyphonic synthesizer
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 0.5,
      },
    }).toDestination()
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
   * Convert note duration to Tone.js duration string
   */
  private noteDurationToToneTime(duration: string): string {
    const map: Record<string, string> = {
      w: '1n',
      h: '2n',
      q: '4n',
      '8': '8n',
      '16': '16n',
      '32': '32n',
    }
    return map[duration] || '4n'
  }

  /**
   * Schedule all notes for playback
   */
  private async scheduleNotes(): Promise<void> {
    if (!this.score) return

    // Initialize synth if needed
    this.initializeSynth()
    if (!this.synth) return

    // Ensure Tone is started before scheduling
    await Tone.start()

    // Clear previously scheduled notes
    this.clearScheduledNotes()

    // Set the tempo
    Tone.Transport.bpm.value = this.score.tempo

    let currentTime = 0 // in beats

    for (const measure of this.score.measures) {
      const measureStartTime = currentTime

      for (const note of measure.notes) {
        if (note.isRest) {
          // Skip rests (silence)
          continue
        }

        // Calculate absolute time for this note
        const noteTime = measureStartTime + note.beat

        // Convert MIDI to frequency
        const frequency = Tone.Frequency(note.pitch, 'midi').toFrequency()

        // Schedule the note
        const eventId = Tone.Transport.schedule(time => {
          this.synth!.triggerAttackRelease(
            frequency,
            this.noteDurationToToneTime(note.duration),
            time
          )

          // Trigger callback
          if (this.callbacks.onNotePlay) {
            this.callbacks.onNotePlay(note)
          }
        }, `${noteTime}`)

        this.scheduledNotes.push(eventId as any)
      }

      currentTime += getMeasureDuration(measure.timeSignature)
    }

    // Schedule playback complete callback
    Tone.Transport.schedule(() => {
      this.stop()
      if (this.callbacks.onPlaybackComplete) {
        this.callbacks.onPlaybackComplete()
      }
    }, `${currentTime}`)
  }

  /**
   * Clear all scheduled notes
   */
  private clearScheduledNotes(): void {
    this.scheduledNotes.forEach(id => {
      Tone.Transport.clear(id)
    })
    this.scheduledNotes = []
  }

  /**
   * Update playback position
   */
  private updatePosition(): void {
    if (!this.score || this.state !== 'playing') return

    const elapsedSeconds = Tone.Transport.seconds - this.startTime
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

    // Ensure Tone.js audio context is started
    await Tone.start()

    if (this.state === 'stopped') {
      // Start from beginning
      await this.scheduleNotes()
      Tone.Transport.position = 0
      this.startTime = 0
    }

    Tone.Transport.start()
    this.state = 'playing'
    this.startTime = Tone.Transport.seconds

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }

    this.updatePosition()
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== 'playing') return

    Tone.Transport.pause()
    this.state = 'paused'

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    Tone.Transport.stop()
    Tone.Transport.position = 0
    this.state = 'stopped'
    this.currentMeasure = 1
    this.currentBeat = 0

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.clearScheduledNotes()

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }
  }

  /**
   * Seek to a specific measure
   */
  seekToMeasure(measureNumber: number): void {
    if (!this.score) return

    let targetBeats = 0
    for (const measure of this.score.measures) {
      if (measure.number >= measureNumber) break
      targetBeats += getMeasureDuration(measure.timeSignature)
    }

    const targetSeconds = this.beatsToSeconds(targetBeats)
    Tone.Transport.seconds = targetSeconds

    this.currentMeasure = measureNumber
    this.currentBeat = 0
  }

  /**
   * Get current playback position
   */
  getPosition(): PlaybackPosition {
    const elapsedSeconds = Tone.Transport.seconds
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
   */
  setVolume(volume: number): void {
    this.initializeSynth()
    if (this.synth) {
      this.synth.volume.value = Tone.gainToDb(volume)
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop()
    if (this.synth) {
      this.synth.dispose()
    }
  }
}
