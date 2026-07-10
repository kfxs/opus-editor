/**
 * {@link InstrumentPlayer} backed by the WebAudioFont player + General-MIDI sample data.
 *
 * Sample data is NOT bundled: the player's loader injects a `<script>` tag pointing at
 * WebAudioFont's CDN preset file, which assigns the decoded wavetable to a `window` global.
 * First use of an instrument needs a network round-trip (~100 KB, then browser-cached);
 * truly-offline playback is a non-goal. See `docs/soundfont-plan.md` §2.
 *
 * ── Why the source is eval'd instead of imported ──────────────────────────────────
 * The `webaudiofont` npm package ships a plain browser script (`'use strict'; var
 * WebAudioFontPlayer = …`) with **no** `module.exports` and **no** ES export — importing
 * it the normal way yields an empty object (`new WebAudioFontPlayer()` would throw). So we
 * pull the source in as a string via Vite's `?raw` and evaluate it in a fresh function
 * scope, returning the class from that same scope. This adapter is confined to this file;
 * the rest of the app sees only the {@link InstrumentPlayer} seam.
 */
import playerSource from 'webaudiofont/npm/dist/WebAudioFontPlayer.js?raw'
import type { InstrumentPlayer } from './InstrumentPlayer'

/** The slice of the WebAudioFont API we actually call (the lib ships no TS types). */
interface WafLoader {
  startLoad(ctx: BaseAudioContext, url: string, variableName: string): void
  waitLoad(onFinish: () => void): void
}
interface WafPlayer {
  loader: WafLoader
  queueWaveTable(
    ctx: BaseAudioContext,
    target: AudioNode,
    preset: unknown,
    when: number,
    pitch: number,
    durationSec: number,
    volume: number,
  ): unknown
  cancelQueue(ctx: BaseAudioContext): void
}

// Evaluate the player script ONCE at module load and capture its top-level class.
// `new Function` gives the appended `return` the same scope as the script's `var`s.
const WebAudioFontPlayer = new Function(
  `${playerSource}\n;return WebAudioFontPlayer;`,
)() as new () => WafPlayer

// GM program 0 — Acoustic Grand Piano. The preset script assigns a global named after the
// file; `queueWaveTable` reads that decoded object. (Other GM presets swap in behind the
// seam in Phase 2.)
const PIANO_PRESET_URL =
  'https://surikov.github.io/webaudiofontdata/sound/0000_JCLive_sf2_file.js'
const PIANO_PRESET_VAR = '_tone_0000_JCLive_sf2_file'

export class WebAudioFontInstrument implements InstrumentPlayer {
  private readonly player: WafPlayer
  private readonly master: GainNode
  private preset: unknown = null
  private loading: Promise<void> | null = null

  constructor(private readonly ctx: AudioContext, volume = 1) {
    this.player = new WebAudioFontPlayer()
    // All voices route through a master gain we own — so setVolume() is persistent and
    // allOff() has one node to reason about.
    this.master = ctx.createGain()
    this.master.gain.value = volume
    this.master.connect(ctx.destination)
  }

  load(): Promise<void> {
    if (this.loading) return this.loading // memoized; the browser caches the fetch anyway
    this.loading = new Promise<void>(resolve => {
      // startLoad injects a <script src=URL> tag; waitLoad fires once every zone is decoded.
      this.player.loader.startLoad(this.ctx, PIANO_PRESET_URL, PIANO_PRESET_VAR)
      this.player.loader.waitLoad(() => {
        this.preset = (window as unknown as Record<string, unknown>)[PIANO_PRESET_VAR]
        resolve()
      })
    })
    return this.loading
  }

  noteOn(midi: number, when: number, durationSec: number, velocity: number): void {
    if (!this.preset) return // load() not finished yet — drop rather than throw
    this.player.queueWaveTable(this.ctx, this.master, this.preset, when, midi, durationSec, velocity)
  }

  allOff(): void {
    this.player.cancelQueue(this.ctx) // cancels everything still scheduled — clean immediate stop
  }

  setVolume(volume: number): void {
    this.master.gain.value = volume // persistent, even while stopped
  }
}
