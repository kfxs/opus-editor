import type { Score, Note } from '@/types/music'
import { measureCapacityQuarters } from '@/utils/musicUtils'
import { collectScheduledNotes, scoreTotalBeats } from './playbackSchedule'
import { WebAudioFontInstrument } from './WebAudioFontInstrument'
import type { InstrumentPlayer } from './InstrumentPlayer'

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
 * PlaybackEngine handles audio playback of musical scores.
 *
 * It owns the clock and the beats→seconds math and drives the position-follow loop, then
 * hands each sounding note to an {@link InstrumentPlayer} (the swappable sound source — see
 * `docs/soundfont-plan.md`). Scheduling is direct against the shared {@link AudioContext}'s
 * `currentTime` (no Web-Audio transport), which is why pause/seek behave as documented below.
 */
export class PlaybackEngine {
  // The AudioContext + instrument are created lazily on first play() (inside the user gesture)
  // and then PERSIST across play/stop — the instrument keeps its loaded samples cached.
  private ctx: AudioContext | null = null
  private instrument: InstrumentPlayer | null = null
  private volume: number = 1 // remembered so setVolume() applies before the instrument exists
  private score: Score | null = null
  private state: PlaybackState = 'stopped'
  private callbacks: PlaybackCallbacks = {}
  private currentMeasure: number = 1
  private currentBeat: number = 0
  private animationFrameId: number | null = null
  private playbackStartTime: number = 0
  private totalDuration: number = 0
  private playbackTimeoutId: ReturnType<typeof setTimeout> | null = null

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
   * Lazily create the one AudioContext + instrument. Both persist across play/stop so the
   * loaded samples stay cached and setVolume() has something to hold. Called from play(),
   * i.e. from inside the play-button click gesture — required so ctx.resume() can unlock audio.
   */
  private ensureAudio(): { ctx: AudioContext; instrument: InstrumentPlayer } {
    if (!this.ctx) this.ctx = new AudioContext()
    if (!this.instrument) this.instrument = new WebAudioFontInstrument(this.ctx, this.volume)
    return { ctx: this.ctx, instrument: this.instrument }
  }

  /**
   * Update playback position
   */
  private updatePosition(): void {
    if (!this.score || this.state !== 'playing' || !this.ctx) return

    const elapsedSeconds = this.ctx.currentTime - this.playbackStartTime
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

    const { ctx, instrument } = this.ensureAudio()
    // ctx.resume() unlocks audio — MUST be reached from the play-button click (it is:
    // button → MusicEngine.play() → here). First play() also blocks on the ~100 KB CDN
    // preset fetch; later plays are instant (browser cache + memoized load()).
    await ctx.resume()
    await instrument.load()

    // Read the clock AFTER the awaits so onsets aren't scheduled in the past.
    const now = ctx.currentTime
    const beatsPerSecond = this.score.tempo / 60

    // Flatten the score into sounding notes (shared per-measure clock across ALL staves —
    // see collectScheduledNotes). This pure pass carries ties/legato/dynamics/articulation;
    // here we only convert beats→seconds and hand each note (MIDI straight in) to the player.
    for (const ev of collectScheduledNotes(this.score)) {
      instrument.noteOn(
        ev.midi,
        now + ev.startBeats / beatsPerSecond,
        ev.durationBeats / beatsPerSecond,
        ev.velocity,
      )
    }

    this.state = 'playing'
    this.playbackStartTime = now

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

    // Silence + cancel everything still scheduled. We KEEP the instrument (and its loaded
    // samples) so the next play() is instant — only the sound is stopped, not torn down.
    this.instrument?.allOff()

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
    if (this.state === 'playing' && this.ctx) {
      elapsedSeconds = this.ctx.currentTime - this.playbackStartTime
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
   * Set playback volume (0-1). Persistent — applies whether or not we're currently playing,
   * and is remembered for an instrument that hasn't been created yet.
   */
  setVolume(volume: number): void {
    this.volume = volume
    this.instrument?.setVolume(volume)
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop()
    this.instrument = null
    this.ctx?.close()
    this.ctx = null
  }
}
