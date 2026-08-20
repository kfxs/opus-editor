import type { Score, Note } from '@/types/music'
import { measureCapacityQuarters, measureStartQuarters } from '@/utils/measureCapacity'
import {
  buildTempoMap,
  beatsToSeconds,
  secondsToBeats,
  totalSeconds,
  DEFAULT_TEMPO,
  type TempoSegment,
} from '@/utils/tempoMap'
import { collectScheduledNotes, playableFrom, scoreTotalBeats } from './playbackSchedule'
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
  // ⚠️ TEMPORARY (dev-only sound picker): which GM program the whole score plays as.
  // Lives ONLY here — never in the score/JSON/undo. Default 0 = piano. Remove when a real
  // per-staff instrument model lands. See WebAudioFontInstrument.DEV_SOUNDS.
  private program: number = 0
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
   * The score's speed as a step function over the beat axis — the ONLY thing that knows
   * how a beat becomes a second. Rebuilt from the score (never stored in it) whenever the
   * score is set and again at play(). A score with no tempo marks yields a single
   * DEFAULT_TEMPO segment, which is why there is no `tempo` field anywhere.
   *
   * v1 builds ONE map (`scope = undefined` = the whole system). Polytempo would build one
   * per scope and mix them at absolute seconds — see docs/tempo-marks-plan.md §0 rule 2.
   */
  private tempoMap: TempoSegment[] = [{ startBeats: 0, qpm: DEFAULT_TEMPO, startSeconds: 0 }]

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
   * Rebuild the tempo map and, from it, the score's total length in seconds.
   *
   * The map must be rebuilt here, not just at play(): placing/deleting a tempo mark
   * changes the score's duration, and the auto-stop timeout + progress bar read it.
   */
  private calculateTotalDuration(): void {
    if (!this.score) {
      this.tempoMap = [{ startBeats: 0, qpm: DEFAULT_TEMPO, startSeconds: 0 }]
      this.totalDuration = 0
      return
    }

    // Shared spine: total length is the sum of per-measure capacity (staff-agnostic).
    const totalBeats = scoreTotalBeats(this.score)

    // Beats→seconds is piecewise (a tempo mark anywhere splits it), so it goes through
    // the map — never through one scalar.
    this.tempoMap = buildTempoMap(this.score)
    this.totalDuration = totalSeconds(this.tempoMap, totalBeats)
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
    // The INVERSE of the map that scheduled the notes. A scalar here would let the
    // playhead drift away from the sound the moment the score has one tempo change.
    const elapsedBeats = secondsToBeats(this.tempoMap, elapsedSeconds)

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

    // Rebuild the map (and totalDuration) from the score as it stands NOW: a tempo mark
    // may have been placed since the last setScore, and every onset below is scheduled
    // up-front against this map — there is no live re-tempo once playback starts.
    this.calculateTotalDuration()

    const { ctx, instrument } = this.ensureAudio()
    // ctx.resume() unlocks audio — MUST be reached from the play-button click (it is:
    // button → MusicEngine.play() → here). First play() also blocks on the ~100 KB CDN
    // preset fetch; later plays are instant (browser cache + memoized load()).
    await ctx.resume()
    await instrument.load(this.program)

    // Read the clock AFTER the awaits so onsets aren't scheduled in the past.
    const now = ctx.currentTime

    // ⭐ WHERE THIS PLAY STARTS. `seekToMeasure` set `currentMeasure`; until 2026-07-31 nothing read
    // it, so every play began at bar 1 however the caller had seeked — the seek moved the position
    // READOUT and not a single scheduled note. Reported as "I select bar 3 and it starts from the
    // beginning", which was the literal truth.
    //
    // The whole of it is one origin shift. Notes are scheduled against absolute score beats, so
    // playing from bar N means dropping everything before N and moving the rest earlier by exactly
    // the time N sits at. Bar 1 gives `startSeconds` 0 and the arithmetic disappears.
    const startBeats = measureStartQuarters(this.score.measures, this.currentMeasure)
    const startSeconds = beatsToSeconds(this.tempoMap, startBeats)

    // Flatten the score into sounding notes (shared per-measure clock across ALL staves —
    // see collectScheduledNotes). This pure pass carries ties/legato/dynamics/articulation;
    // here we only convert beats→seconds and hand each note (a PITCH, not MIDI — the player's
    // implementation is the interpret step that mints the integer) to the player.
    // The map goes IN: an unmeasured tremolo's period is physical (seconds), so the collector needs
    // the same clock this loop converts with — see UNMEASURED_PERIOD_SECONDS.
    // Which notes sound, and when — including where this play begins (`playableFrom`). Kept there
    // rather than inline because this method cannot be tested without an AudioContext, and the seek
    // it applies is exactly the thing that was silently not happening.
    for (const note of playableFrom(collectScheduledNotes(this.score, this.tempoMap), this.tempoMap, startBeats)) {
      instrument.noteOn(note.pitch, now + note.atSeconds, note.durationSeconds, note.velocity)
    }

    this.state = 'playing'
    // ⭐ The origin goes BACK by where we started, so `updatePosition` — which measures elapsed time
    // from the top of the score and walks the bars to find the playhead — needs no notion of a seek
    // at all. The cursor lands on the right bar and `progress` stays a fraction of the whole piece,
    // both for free.
    this.playbackStartTime = now - startSeconds

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state)
    }

    // Kick off the position-tracking rAF loop. updatePosition self-schedules while playing
    // and drives onPositionChange (progress + playback-follow). Without this first call the
    // loop never starts and onPositionChange never fires.
    this.updatePosition()

    // Schedule auto-stop at the end of the SCORE (totalDuration is kept current by setScore) — so
    // what is left to play is that, less the part we started past. Timing it from the full length
    // would leave a play from bar 40 sitting in silence for the thirty-nine bars it skipped.
    this.playbackTimeoutId = setTimeout(() => {
      this.stop()
    }, Math.max(0, this.totalDuration - startSeconds) * 1000)
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
   * ⚠️ TEMPORARY — dev-only sound picker. Set the GM program the score plays as. Takes
   * effect on the NEXT play() (current playback keeps running with the old sound). Stored
   * only in the engine, never in the score/JSON/undo. Remove with the picker when a real
   * instrument model lands.
   */
  setInstrumentProgram(program: number): void {
    this.program = program
    // Preload if the instrument already exists (post-first-play) so the next play is instant;
    // otherwise it loads on next play(). Fire-and-forget — the sound only swaps on next play.
    void this.instrument?.load(program)
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
