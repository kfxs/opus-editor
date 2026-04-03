import type * as ToneType from 'tone'
import type { Score, Note } from '@/types/music'
import { durationToBeats, getMeasureDuration } from '@/utils/musicUtils'
import { fracToNumber } from '@/utils/fraction'
import { spellingToMidi } from '@/utils/pitchSpelling'

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

    let totalBeats = 0
    for (const measure of this.score.measures) {
      totalBeats += getMeasureDuration(measure.timeSignature)
    }

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

    // Build a lookup: notePitch ID -> { chord, measureStartBeats }
    // so we can follow tiedTo chains to accumulate total duration.
    const pitchInfo = new Map<string, { chord: (typeof this.score.measures)[0]['slots'][0] & { type: 'chord' }, measureStartBeats: number }>()
    let scanTime = 0
    for (const measure of this.score.measures) {
      for (const slot of measure.slots) {
        if (slot.type === 'chord') {
          for (const np of slot.notes) {
            pitchInfo.set(np.id, { chord: slot, measureStartBeats: scanTime })
          }
        }
      }
      scanTime += getMeasureDuration(measure.timeSignature)
    }

    for (const measure of this.score.measures) {
      const measureStartTime = currentTimeInBeats

      for (const slot of measure.slots) {
        if (slot.type === 'rest') continue

        // slot is a Chord
        const chord = slot
        const noteTimeInBeats = measureStartTime + fracToNumber(chord.beat)
        const beatsPerSecond = tempo / 60
        const noteTimeInSeconds = noteTimeInBeats / beatsPerSecond
        const baseDurationBeats = chord.actualDuration ? fracToNumber(chord.actualDuration) : durationToBeats(chord.duration, chord.dots || 0)

        for (const notePitch of chord.notes) {
          // Skip tied-continuation notes — they're an extension of a prior attack.
          if (notePitch.tiedFrom) continue

          // Follow the tiedTo chain to get the full sounding duration.
          let durationBeats = baseDurationBeats
          let cursor = notePitch
          while (cursor.tiedTo) {
            const next = pitchInfo.get(cursor.tiedTo)
            if (!next) break
            const nextNp = next.chord.notes.find(n => n.id === cursor.tiedTo)
            if (!nextNp) break
            const nextDur = next.chord.actualDuration
              ? fracToNumber(next.chord.actualDuration)
              : durationToBeats(next.chord.duration, next.chord.dots || 0)
            durationBeats += nextDur
            cursor = nextNp
          }

          const durationInSeconds = durationBeats / beatsPerSecond

          // Derive sounding MIDI directly from the stored spelling —
          // alter already encodes the chromatic offset, so no manual adjustment needed.
          const soundingMidi = spellingToMidi(notePitch.step, notePitch.alter, notePitch.octave)

          // Convert MIDI to note name like testAudio
          const noteName = Tone.Frequency(soundingMidi, 'midi').toNote()

          // Schedule exactly like testAudio does
          synth.triggerAttackRelease(noteName, durationInSeconds, now + noteTimeInSeconds)
        }
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
