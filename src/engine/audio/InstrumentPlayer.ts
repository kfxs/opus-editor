/**
 * A sound source that schedules notes on a shared AudioContext timeline.
 *
 * The seam that lets the sound library sit *behind* {@link PlaybackEngine}.
 * PlaybackEngine owns the clock + beats→seconds math (see {@link collectScheduledNotes})
 * and hands finished `(midi, when, durationSec, velocity)` events to whatever implements
 * this. Swapping WebAudioFont → smplr → a future custom sampler is a drop-in change here,
 * touching no scheduling/tie/dynamics logic. See `docs/soundfont-plan.md` §3.
 */
export interface InstrumentPlayer {
  /**
   * Trigger the CDN preload of the wavetable for a GM program and resolve once it's
   * decoded and playable, making it the current sound. Idempotent per program — safe to
   * await on every `play()`; the browser caches the fetch and each program is memoized.
   * Defaults to program 0 (Acoustic Grand Piano).
   */
  load(program?: number): Promise<void>

  /**
   * Schedule one sounding note at absolute AudioContext time `when` (seconds).
   * `midi` is a raw MIDI number (0–127) — no name conversion needed.
   */
  noteOn(midi: number, when: number, durationSec: number, velocity: number): void

  /** Immediately silence + cancel everything scheduled (used by `stop()`/`pause()`). */
  allOff(): void

  /** Persistent master volume 0..1 — applies whether or not we're currently playing. */
  setVolume(volume: number): void
}
