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
import type { PitchSpelling } from '@/types/music'
import { pitchToMidi } from '@/utils/pitchSpelling'
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

const PRESET_BASE = 'https://surikov.github.io/webaudiofontdata/sound/'

/**
 * GM program → WebAudioFont preset key. The preset script (`<key>.js`) assigns a global
 * `_tone_<key>`; `queueWaveTable` reads that decoded object. Keys are taken from the
 * player's own `instrumentKeys()` list. Program 0 keeps the JCLive piano (the Phase-1
 * default sound); the rest are the consistent FluidR3 GM set.
 *
 * ⚠️ TEMPORARY / dev-only. This map exists purely so {@link DEV_SOUNDS} can drive the
 * dev sound-picker (audition different timbres while building). It is NOT the editor's
 * instrument model — when a real per-staff instrument feature is designed this goes away.
 */
const GM_PRESETS: Record<number, string> = {
  0: '0000_JCLive_sf2_file', // Acoustic Grand Piano (Phase-1 default — unchanged)
  4: '0040_FluidR3_GM_sf2_file', // Electric Piano
  11: '0110_FluidR3_GM_sf2_file', // Vibraphone
  19: '0190_FluidR3_GM_sf2_file', // Church Organ
  24: '0240_FluidR3_GM_sf2_file', // Nylon Guitar
  26: '0260_FluidR3_GM_sf2_file', // Jazz Guitar
  33: '0330_FluidR3_GM_sf2_file', // Finger Bass
  40: '0400_FluidR3_GM_sf2_file', // Violin
  42: '0420_FluidR3_GM_sf2_file', // Cello
  48: '0480_FluidR3_GM_sf2_file', // String Ensemble
  52: '0520_FluidR3_GM_sf2_file', // Choir Aahs
  56: '0560_FluidR3_GM_sf2_file', // Trumpet
  65: '0650_FluidR3_GM_sf2_file', // Alto Sax
  71: '0710_FluidR3_GM_sf2_file', // Clarinet
  73: '0730_FluidR3_GM_sf2_file', // Flute
}

/**
 * Curated (program, label) shortlist for the **dev-only** sound picker, in menu order.
 * ⚠️ TEMPORARY — see {@link GM_PRESETS}. Delete alongside the picker when a real
 * instrument model lands.
 */
export const DEV_SOUNDS: ReadonlyArray<{ program: number; label: string }> = [
  { program: 0, label: 'Piano' },
  { program: 4, label: 'E. Piano' },
  { program: 11, label: 'Vibraphone' },
  { program: 19, label: 'Church Organ' },
  { program: 24, label: 'Nylon Guitar' },
  { program: 26, label: 'Jazz Guitar' },
  { program: 33, label: 'Finger Bass' },
  { program: 40, label: 'Violin' },
  { program: 42, label: 'Cello' },
  { program: 48, label: 'Strings' },
  { program: 52, label: 'Choir' },
  { program: 56, label: 'Trumpet' },
  { program: 65, label: 'Alto Sax' },
  { program: 71, label: 'Clarinet' },
  { program: 73, label: 'Flute' },
]

export class WebAudioFontInstrument implements InstrumentPlayer {
  private readonly player: WafPlayer
  private readonly master: GainNode
  // Decoded presets + in-flight loads, memoized per GM program (each is a separate CDN fetch).
  private readonly presets = new Map<number, unknown>()
  private readonly loading = new Map<number, Promise<void>>()
  private currentProgram = 0

  constructor(private readonly ctx: AudioContext, volume = 1) {
    this.player = new WebAudioFontPlayer()
    // All voices route through a master gain we own — so setVolume() is persistent and
    // allOff() has one node to reason about.
    this.master = ctx.createGain()
    this.master.gain.value = volume
    this.master.connect(ctx.destination)
  }

  load(program = 0): Promise<void> {
    this.currentProgram = program // subsequent noteOn() uses this program once it's decoded
    const inFlight = this.loading.get(program)
    if (inFlight) return inFlight // memoized; the browser caches the fetch anyway

    const key = GM_PRESETS[program] ?? GM_PRESETS[0]
    const url = PRESET_BASE + key + '.js'
    const varName = '_tone_' + key
    const p = new Promise<void>(resolve => {
      // startLoad injects a <script src=URL> tag; waitLoad fires once every zone is decoded.
      this.player.loader.startLoad(this.ctx, url, varName)
      this.player.loader.waitLoad(() => {
        this.presets.set(program, (window as unknown as Record<string, unknown>)[varName])
        resolve()
      })
    })
    this.loading.set(program, p)
    return p
  }

  /**
   * ⭐⭐ **THE ONE PLACE THE SOUND PATH MINTS MIDI** (docs/playback-semantics-plan.md, 2026-08-20).
   *
   * WebAudioFont indexes its wavetables by MIDI note number, so 12-EDO is *this backend's*
   * requirement — and stating it here, in the class named after the backend, is the whole of the
   * three-stage split. ⛔ Do not push `pitchToMidi` back up the chain to save a call: the schedule
   * that carried the integer could not have told G♯4 from A♭4, and a tuning-aware sibling of this
   * class needs exactly that (docs/tuning-systems-and-alteration.md).
   *
   * ⚠️ Fractional/microtonal pitch is NOT supported here and must not be faked by rounding — the
   * honest home for it is a different `InstrumentPlayer`, which is why this seam exists.
   */
  noteOn(pitch: PitchSpelling, when: number, durationSec: number, velocity: number): void {
    const preset = this.presets.get(this.currentProgram)
    if (!preset) return // current program not decoded yet — drop rather than throw
    this.player.queueWaveTable(
      this.ctx, this.master, preset, when, pitchToMidi(pitch), durationSec, velocity)
  }

  allOff(): void {
    this.player.cancelQueue(this.ctx) // cancels everything still scheduled — clean immediate stop
  }

  setVolume(volume: number): void {
    this.master.gain.value = volume // persistent, even while stopped
  }
}
