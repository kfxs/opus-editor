/**
 * A sound source that schedules notes on a shared AudioContext timeline.
 *
 * The seam that lets the sound library sit *behind* {@link PlaybackEngine}.
 * PlaybackEngine owns the clock + beats→seconds math (see {@link collectScheduledNotes})
 * and hands finished `(pitch, when, durationSec, velocity)` events to whatever implements
 * this. Swapping WebAudioFont → smplr → a future custom sampler is a drop-in change here,
 * touching no scheduling/tie/dynamics logic. See `docs/soundfont-plan.md` §3.
 *
 * ⭐⭐ **THIS IS THE *INTERPRET* STEP — the third stage of score → schedule → interpret**
 * (docs/playback-semantics-plan.md, built 2026-08-20). Everything above it speaks MUSIC; an
 * implementation of this interface is the first place allowed to speak its synth's vocabulary, and
 * therefore the first place allowed to assume 12-EDO. ⛔ A MIDI number must not appear on either
 * side of this boundary in any caller.
 */
import type { PitchSpelling } from '@/types/music'

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
   *
   * ⭐⭐ **`pitch` is a SPELLING, not a MIDI number** — `step`/`alter`/`octave`, with any octave line
   * already folded in (`utils/soundingShift.applySoundingShift`). It is an implementation's own job
   * to turn that into whatever it plays: our sampled one calls `pitchToMidi` and hands the integer
   * to WebAudioFont; a future tuning-aware synth would read `alter` as a SYMBOL and ask a tuning
   * system for its ratio, which a number arriving here could never have supported.
   *
   * ⚠️ That is the whole point of the seam: `spellingToMidi` collapses G♯4 and A♭4 onto 61, and in
   * meantone those are different pitches (docs/tuning-systems-and-alteration.md). Whoever mints the
   * integer decides that question, so only the thing that knows what is playing may mint it.
   */
  noteOn(pitch: PitchSpelling, when: number, durationSec: number, velocity: number): void

  /** Immediately silence + cancel everything scheduled (used by `stop()`/`pause()`). */
  allOff(): void

  /** Persistent master volume 0..1 — applies whether or not we're currently playing. */
  setVolume(volume: number): void
}
