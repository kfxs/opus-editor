# Soundfont Playback (General MIDI sound via WebAudioFont) — Plan

Status: **PLANNED — not started.** Replace the raw `Tone.Synth` beep with real
sampled General-MIDI instruments. The sample data stays on **WebAudioFont's own
CDN** (loaded at play time, then browser-cached); only the tiny player library
lives in `node_modules`. Nothing audio-related enters git. Keep the sound library
behind a thin swappable seam so "switch players / build our own sampler later"
stays a drop-in replacement.

---

## 1. Goal

The current playback sound is a bare subtractive synth — a triangle-wave beep —
built at `PlaybackEngine.ts:158`:

```ts
const synth = new Tone.PolySynth(Tone.Synth).toDestination()
```

For a **score editor** we want proper *instrument* sound, and ultimately the full
**General MIDI** palette (piano, strings, brass, timpani…), so a staff can later
say "I'm a trumpet" and sound like one. That means **sampled sound**, i.e. a
soundfont.

Non-goals for the first cut: per-staff instrument selection UI, reverb/effects,
velocity-layer realism, a custom sampler. First cut = **everything plays as one GM
instrument (acoustic grand piano)**, proving the pipeline end-to-end.

## 2. Where the sound data lives (decision: use the CDN)

**Sampled sound is data**, and that data has to physically live in one of three
places: (1) committed in git, (2) fetched at install/build time into a gitignored
folder, or (3) fetched from a CDN at play time. We rejected (1) — no audio in the
repo. We chose **(3): the CDN.** Rationale:

- **Nothing extra in the project folder.** No download scripts, no gitignored
  asset folder, no committed samples. The repo stays clean by construction.
- **We host nothing.** The samples are served from WebAudioFont's existing data
  host (`surikov.github.io/webaudiofontdata/…`); we never pay for or run hosting.
- **Sound now.** Point the player at a preset URL and go.

Trade-off we accept: playback needs a network connection the **first** time a
given instrument is used (a ~100 KB preset download, then browser-cached). Truly
offline playback is **not** a requirement. If that ever changes, the same preset
file can instead be fetched at `npm install` into a gitignored folder and bundled
— a localized change behind the same seam, not a rewrite.

> **Correction to an earlier assumption.** The `webaudiofont` npm package ships
> the **player only** — there is *no* sample data inside it. Preset/wavetable
> files (`_tone_<key>.js`, global-assigning scripts) live in the separate
> `surikov/webaudiofontdata` repo and are served from its CDN. `npm install
> webaudiofont` does **not** put any sound in `node_modules`. The player's loader
> (`WebAudioFontLoader.startLoad`) injects a `<script>` tag at the preset URL and
> reads the resulting `_tone_<key>` global — that CDN fetch is exactly the
> mechanism we're adopting.

### Why WebAudioFont (vs. smplr / soundfont-player)

With the offline constraint dropped, the field is wider — all three players load
samples from a CDN at play time. We keep **WebAudioFont** for the first cut
because it's already license-cleared for us and covers the full GM set. The
`InstrumentPlayer` seam (§3) makes any of these a later swap.

| Package | Sample source | GM set? | License | Note |
|---|---|---|---|---|
| **webaudiofont** ← chosen | its CDN (`surikov.github.io`) | ✅ | GPL-3.0-or-later | AGPL-compatible; already researched |
| smplr | its CDN | ✅ | MIT | cleaner/modern API — revisit if we swap |
| soundfont-player | its CDN | ✅ | MIT | older sibling of smplr |
| Tone.Sampler | you supply/host samples | ✗ build it | MIT | only if we self-host later |

### License — CLEARED

- `webaudiofont@3.0.4` is **`GPL-3.0-or-later`** (verified against the npm
  registry; `LICENSE.md` in the repo is GPLv3).
- Our project is **`AGPL-3.0-or-later`**. **AGPLv3 and GPLv3 are explicitly
  cross-compatible** (§13 of both licenses) — GPL code combines cleanly into an
  AGPL project with no new obligation we haven't already accepted. So there is
  **no license blocker**; we do *not* need the author's "contact me for a
  different license" path (that's only for proprietary/permissive consumers).
- Hygiene: keep WebAudioFont's copyright + GPL notice in the dependency (don't
  strip headers); AGPL already makes our source available.
- Sample data originates from **GeneralUser GS** (Christian Collins) and
  **FluidR3** (MuseScore) — both freely redistributable. Add a one-line credit
  when we ship. No blocker.

## 3. The architectural seam (the whole point)

The real asset is already framework/library-agnostic: `collectScheduledNotes(score)`
in `playbackSchedule.ts` produces pure events —
`{ midi, startBeats, durationBeats, velocity }` (carrying ties/legato/dynamics).
Tone is merely the current **output device** consuming that list.

So we introduce a thin **`InstrumentPlayer`** interface in `engine/audio/`, and the
sound library sits *behind* it. This is the same discipline `lint:boundary` already
enforces elsewhere.

```
Score ─▶ collectScheduledNotes()  ─▶  PlaybackEngine (owns transport/clock/
        (pure events, unchanged)        beats→seconds, playback-follow)
                                                │ hands events to
                                                ▼
                                        InstrumentPlayer  (interface)
                                                ▲
                                   ┌────────────┴────────────┐
                        WebAudioFontPlayer            (future) smplr / OurSampler
                        (this plan)                   drop-in, same interface
```

`InstrumentPlayer` (conceptual — one small file):

- `load(programs?): Promise<void>` — trigger the player's CDN preload of the
  wavetable(s) we'll need (piano for the first cut).
- `noteOn(midi, when, durationSec, velocity)` — schedule one sounding note.
  📄 ⏭️ **This signature is the INTERPRET step in disguise** (`docs/playback-semantics-plan.md`,
  2026-08-19, recorded not scheduled): it is the one place that legitimately wants MIDI and a synth
  velocity, and the plan is for the schedule ABOVE it to speak in pitch and a musical dynamic value
  instead — so the conversion happens here rather than three modules earlier.
- `stop()` — cancel/silence everything (used by `stop()`).
- `setVolume(0..1)`.
- owns / accepts the shared `AudioContext` and a master `GainNode`.

`PlaybackEngine` keeps everything it already does — the beats→seconds math, the
`updatePosition` position-follow loop, ties/dynamics — and only swaps *who* it
hands each note to. Nothing in `playbackSchedule.ts` changes.

### Implementation notes discovered in code (fold into Phase 0/1)

- **MIDI goes straight in.** WebAudioFont's
  `queueWaveTable(ctx, target, preset, when, pitch, duration, volume)` takes
  `pitch` as a **MIDI number** — so today's `Tone.Frequency(ev.midi,'midi').toNote()`
  step (`PlaybackEngine.ts:166`) disappears; our event's `midi` field feeds in
  directly.
- **`stop()` won't map to `synth.dispose()`.** `queueWaveTable` returns an
  envelope with `.cancel()`. Cleanest design: route all player output through a
  master `GainNode` we own; `stop()` disconnects/recreates it. Bonus — that also
  makes `setVolume()` **persistent**, fixing today's limit where volume only
  applies mid-playback (`PlaybackEngine.ts:282`).

### One integration decision: the clock (A vs B)

WebAudioFont schedules against an `AudioContext`'s `currentTime`, not Tone's
transport. Note there is **no `Tone.Transport`** in the current code — playback is
already *direct scheduling* (`Tone.now()` + `setTimeout` + `requestAnimationFrame`),
and Tone only provides `now()`, `start()`, `Frequency`, and `gainToDb`. So:

- **A — keep Tone as the clock, WebAudioFont as the voice (recommended first).**
  Construct `WebAudioFontPlayer` with **Tone's raw context**
  (`Tone.getContext().rawContext`) so both share one `AudioContext` timeline;
  `Tone.now()` stays the clock and the position-follow loop is untouched.
  WebAudioFont just plays the notes on that shared context. Least churn.
- **B — drop Tone from playback entirely.** `Tone.now()`→`ctx.currentTime`,
  `Tone.start()`→`ctx.resume()`. Because there's no real transport to rewrite,
  B is nearly as cheap as A — a reasonable Phase 3 cleanup, one fewer dependency.

**Start with A** (prove sound with minimal churn); B is an easy later cleanup.

> **Reassessment (2026-07-10, verified against code).** A grep confirms every
> *functional* Tone call lives in `PlaybackEngine.ts` (the rest are comments; no
> test touches Tone). Once WebAudioFont is the voice, Tone is doing **only** two
> things — `Tone.now()` (→ `ctx.currentTime`) and `Tone.start()` (→ `ctx.resume()`)
> — both one-line native swaps, because there is **no `Tone.Transport`** to
> reimplement and the beats→seconds math + rAF follow-loop are already our own
> code. So B is ~5 line changes, deletes more than it adds, and drops a ~1 MB
> dependency. Doing A and B **in the same pass** is now reasonable; keeping Tone
> buys almost nothing here. Concrete end-state sketch in the **Appendix** below.

## 4. Phases

> **Phase 0 + 1 status — DONE (2026-07-10).** `webaudiofont@3.0.04` installed;
> `engine/audio/InstrumentPlayer.ts` (seam) + `engine/audio/WebAudioFontInstrument.ts`
> (piano-preset impl, master gain) added and **now wired into `PlaybackEngine`**.
> **Did A+B in one pass — Tone is fully removed** (`npm uninstall tone`, no `tone` refs in
> code, no dynamic import). `PlaybackEngine` owns a lazy `AudioContext` (`ensureAudio()`,
> created in the play gesture, persists across play/stop); `Tone.now()`→`ctx.currentTime`,
> `Tone.start()`→`ctx.resume()`, `PolySynth`→`instrument.noteOn` (MIDI straight in),
> `synth.dispose()`→`instrument.allOff()` (instrument persists), `setVolume` persistent via
> master gain. Typecheck + boundary-lint + 966 tests green, build passes (the ~340 kB Tone
> chunk is gone; the 124 kB WAF source is inlined instead → net smaller). Stale `Tone.js`
> mentions remain only in a few doc-comments (`dynamics/fraction/durations/playbackSchedule`);
> harmless. **Not committed.** Next: Phase 2 (per-staff GM instrument switching).
>
> **⚠️ Two corrections the sketches below got wrong (verified against the installed pkg):**
> 1. **The package has no usable export.** Its dist is a plain browser script
>    (`'use strict'; var WebAudioFontPlayer = …`) with no `module.exports`/ESM export —
>    `import WebAudioFontPlayer from 'webaudiofont'` yields `{}` and `new` throws. B.2/B.3
>    are wrong on this line. The working adapter: pull the source as a string via Vite's
>    `?raw` and eval it in a fresh scope —
>    `new Function(src + ';return WebAudioFontPlayer;')()`. Confined to
>    `WebAudioFontInstrument.ts`. (Needed a `declare module '*?raw'` in
>    `src/types/raw-modules.d.ts`.)
> 2. **All four API names are CORRECT** as sketched: `loader.startLoad(ctx,url,varName)`,
>    `loader.waitLoad(onFinish)`, `queueWaveTable(ctx,target,preset,when,MIDI,durSec,vol)`,
>    `cancelQueue(ctx)`. Loader assigns the decoded preset to `window[varName]` (read it
>    there after `waitLoad`). Piano preset confirmed: URL `.../sound/0000_JCLive_sf2_file.js`,
>    global `_tone_0000_JCLive_sf2_file`.
>
> **Gotcha hit:** `npm install webaudiofont` pruned `jsdom` (undeclared devDep — the known
> recurring issue); `npm i jsdom --no-save` restored the DOM tests. Watch for this again.

- **Phase 0 — dependency + seam.** `npm install webaudiofont`. Add the
  `InstrumentPlayer` interface + a `WebAudioFontPlayer` implementing it (backed by
  `WebAudioFontPlayer` + its `loader` + `queueWaveTable`). Point the loader at the
  acoustic-grand-piano preset URL on the WebAudioFont CDN. Own a master `GainNode`.
- **Phase 1 — route playback through the seam (approach A).** In `PlaybackEngine`,
  replace the `PolySynth` path: keep the transport/clock, share Tone's raw
  `AudioContext`, and hand each `collectScheduledNotes` event to
  `WebAudioFontPlayer.noteOn(...)` (MIDI in directly) instead of
  `synth.triggerAttackRelease`. Wire `stop()` (master-gain kill) and `setVolume()`
  to the seam. Whole score plays as piano.
  **Milestone: real sound, nothing in git, samples served from the CDN.**
- **Phase 2 — GM instrument switching (later).** ⚠️ **SUPERSEDED by
  `docs/instruments-plan.md` — do NOT build the per-staff field sketched below.**
  `staff.program` is `score.clef` one level down: it is really "the instrument at bar 1",
  and it cannot express a piano (one instrument, two staves), a condensed score (several
  instruments on one staff, one per voice), or an instrument change at bar 40. The dropdown
  may look the same, but it must **write a positional (staff, voice, position) → instrument
  assignment**, with the GM program bound to the *instrument*. See instruments-plan §7.
  ~~Preload a handful of GM presets from the CDN; add a `program`/instrument field per staff
  (or a global picker first); map GM program number → WebAudioFont preset; `load()` on
  demand.~~ Still true: preloading presets, the GM→preset mapping, and on-demand `load()` —
  but the seam goes **multi-timbral** (load a *set* of programs; `noteOn` names its program),
  and `collectScheduledNotes` must carry each note's lane (staff, voice).
- **Phase 3 — polish (deferred).** Reverb/effects, velocity realism, preload
  strategy, and possibly clock-approach **B** (drop Tone). Optional: if truly
  offline playback ever becomes a requirement, fetch the specific presets we use
  at `npm install` into a gitignored folder and bundle them — localized change
  behind the same seam.

## 5. Risks / watch-items

- **CDN availability / first-play latency.** Playback needs a network connection
  the first time an instrument is used; the preset is browser-cached afterward. We
  depend on `surikov.github.io` staying reachable. Accepted trade-off (see §2); the
  seam keeps a swap-to-offline or swap-to-another-player cheap.
- **Preset data is a global-assigning script, not an ES module.** The loader fetches
  `_tone_<key>.js`, which does `var _tone_<key> = {…}` on `window`, then decodes it.
  Use the player's own `loader.startLoad(...)` / `decodeAfterLoading(...)` flow —
  don't try to `import` the preset as a module. This lives *only* inside
  `WebAudioFontPlayer`.
- **Shared AudioContext (approach A).** Tone and WebAudioFont must share one
  `AudioContext` or scheduling times won't align — construct the player with
  `Tone.getContext().rawContext`.
- **`AudioContext` resume/gesture.** Playback still needs a user gesture to start
  audio (already handled via `Tone.start()`); keep that unlock step.

## 6. Definition of done (first cut)

Press play → score sounds like a real acoustic piano (samples fetched from the CDN,
then cached) → `git status` shows only code changed (dependency + small player
file), no audio assets → license notice retained. The `InstrumentPlayer` seam is in
place so switching players (or a future custom sampler) is a drop-in swap.

---

## Appendix — Approach B: fully de-Toned `PlaybackEngine` (sketch)

Concrete end-state if we drop Tone entirely (see §3 reassessment). Three small
pieces: the seam interface, the WebAudioFont implementation behind it, and the
de-Toned engine. Spots marked ⚠️ are the only unverifiable bits — the
`webaudiofont` library ships no TS types, so confirm the loader/export names the
moment it's installed. Everything else is checked against current code.

### B.1 The seam — `engine/audio/InstrumentPlayer.ts`

```ts
/**
 * A sound source that schedules notes on a shared AudioContext timeline.
 * PlaybackEngine owns the clock + beats→seconds math and hands finished
 * (midi, when, durationSec, velocity) events to whatever implements this.
 * Swapping WebAudioFont → smplr → a custom sampler is a drop-in here.
 */
export interface InstrumentPlayer {
  /** Trigger the CDN preload of the wavetable(s) we'll need. Idempotent. */
  load(): Promise<void>
  /** Schedule one note at absolute ctx time `when` (seconds). */
  noteOn(midi: number, when: number, durationSec: number, velocity: number): void
  /** Immediately silence + cancel everything scheduled (used by stop()). */
  allOff(): void
  /** Persistent master volume 0..1 — applies whether or not we're playing. */
  setVolume(volume: number): void
}
```

### B.2 The implementation — `engine/audio/WebAudioFontInstrument.ts`

```ts
import WebAudioFontPlayer from 'webaudiofont'   // ⚠️ confirm default-vs-named export on install
import type { InstrumentPlayer } from './InstrumentPlayer'

// GM program 0 — Acoustic Grand Piano. Preset script + the global it assigns.
const PRESET_URL = 'https://surikov.github.io/webaudiofontdata/sound/0000_JCLive_sf2_file.js'
const PRESET_VAR = '_tone_0000_JCLive_sf2_file'

export class WebAudioFontInstrument implements InstrumentPlayer {
  private player: any                 // WebAudioFontPlayer (lib has no TS types)
  private master: GainNode
  private preset: unknown = null
  private loading: Promise<void> | null = null

  constructor(private ctx: AudioContext, volume = 1) {
    this.player = new WebAudioFontPlayer()
    this.master = ctx.createGain()
    this.master.gain.value = volume
    this.master.connect(ctx.destination)
  }

  load(): Promise<void> {
    if (this.loading) return this.loading            // once — browser caches the fetch anyway
    this.loading = new Promise((resolve) => {
      // ⚠️ loader API names to confirm: startLoad / waitLoad are the documented flow
      this.player.loader.startLoad(this.ctx, PRESET_URL, PRESET_VAR)
      this.player.loader.waitLoad(() => {
        this.preset = (window as Record<string, any>)[PRESET_VAR]  // script assigns a global
        resolve()
      })
    })
    return this.loading
  }

  noteOn(midi: number, when: number, durationSec: number, velocity: number): void {
    if (!this.preset) return
    // queueWaveTable(ctx, target, preset, when, pitch=MIDI, durationSec, volume)
    this.player.queueWaveTable(this.ctx, this.master, this.preset, when, midi, durationSec, velocity)
  }

  allOff(): void {
    this.player.cancelQueue(this.ctx)   // cancels everything still scheduled — clean immediate stop
  }

  setVolume(volume: number): void {
    this.master.gain.value = volume     // persistent, even while stopped (fixes today's bug)
  }
}
```

### B.3 The de-Toned `PlaybackEngine.ts`

Only the non-trivial changes are shown; untouched methods (`updatePosition` body,
`getPosition`, `pause`, `seekToMeasure`, `calculateTotalDuration`,
`setScore`/`setCallbacks`/`getState`) are identical **except** the `Tone.now()` →
`this.ctx.currentTime` swap. No more `import type * as ToneType from 'tone'`, no
`synth` field.

```ts
import type { Score, Note } from '@/types/music'
import { measureCapacityQuarters } from '@/utils/musicUtils'
import { collectScheduledNotes, scoreTotalBeats } from './playbackSchedule'
import { WebAudioFontInstrument } from './WebAudioFontInstrument'
import type { InstrumentPlayer } from './InstrumentPlayer'

// ... PlaybackState / PlaybackPosition / PlaybackCallbacks interfaces unchanged ...

export class PlaybackEngine {
  private ctx: AudioContext | null = null
  private instrument: InstrumentPlayer | null = null
  private volume = 1                           // remembered so setVolume() works before first play
  private score: Score | null = null
  private state: PlaybackState = 'stopped'
  private callbacks: PlaybackCallbacks = {}
  private currentMeasure = 1
  private currentBeat = 0
  private animationFrameId: number | null = null
  private playbackStartTime = 0
  private totalDuration = 0
  private playbackTimeoutId: ReturnType<typeof setTimeout> | null = null

  // setScore / setCallbacks / getState / calculateTotalDuration — UNCHANGED

  /** Lazily create the one AudioContext + instrument. Both persist across play/stop. */
  private ensureAudio(): { ctx: AudioContext; instrument: InstrumentPlayer } {
    if (!this.ctx) this.ctx = new AudioContext()
    if (!this.instrument) this.instrument = new WebAudioFontInstrument(this.ctx, this.volume)
    return { ctx: this.ctx, instrument: this.instrument }
  }

  private updatePosition(): void {
    if (!this.score || this.state !== 'playing' || !this.ctx) return
    const elapsedSeconds = this.ctx.currentTime - this.playbackStartTime   // was Tone.now()
    // ... rest of the body byte-for-byte identical ...
    this.animationFrameId = requestAnimationFrame(() => this.updatePosition())
  }

  async play(): Promise<void> {
    if (!this.score) throw new Error('No score loaded')
    if (this.state === 'playing') return

    const { ctx, instrument } = this.ensureAudio()
    await ctx.resume()          // was Tone.start() — MUST run in the click handler chain (it does)
    await instrument.load()     // first play blocks on the ~100 KB CDN preset fetch, then cached

    const now = ctx.currentTime // read AFTER the await, so onsets aren't scheduled in the past
    const beatsPerSecond = this.score.tempo / 60

    for (const ev of collectScheduledNotes(this.score)) {
      instrument.noteOn(                              // was synth.triggerAttackRelease(...)
        ev.midi,                                      // MIDI straight in — no Frequency().toNote()
        now + ev.startBeats / beatsPerSecond,
        ev.durationBeats / beatsPerSecond,
        ev.velocity,
      )
    }

    this.state = 'playing'
    this.playbackStartTime = now
    this.callbacks.onStateChange?.(this.state)
    this.updatePosition()
    this.playbackTimeoutId = setTimeout(() => this.stop(), this.totalDuration * 1000)
  }

  // pause() — UNCHANGED (still delegates to stop())

  stop(): void {
    this.state = 'stopped'
    this.currentMeasure = 1
    this.currentBeat = 0
    if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null }
    if (this.playbackTimeoutId) { clearTimeout(this.playbackTimeoutId); this.playbackTimeoutId = null }
    this.instrument?.allOff()          // was synth.dispose() — but we KEEP the instrument loaded
    this.callbacks.onStateChange?.(this.state)
  }

  // seekToMeasure — UNCHANGED

  getPosition(): PlaybackPosition {
    let elapsedSeconds = 0
    if (this.state === 'playing' && this.ctx) {
      elapsedSeconds = this.ctx.currentTime - this.playbackStartTime   // was Tone.now()
    }
    // ... rest identical ...
  }

  setVolume(volume: number): void {
    this.volume = volume                 // remember for a not-yet-created instrument
    this.instrument?.setVolume(volume)   // persistent now — no gainToDb, works while stopped
  }

  dispose(): void {
    this.stop()
    this.instrument = null
    this.ctx?.close()
    this.ctx = null
  }
}
```

### B.4 What changed vs. today

| Concern | Today (Tone) | De-Toned (B) |
|---|---|---|
| Clock | `Tone.now()` | `ctx.currentTime` |
| Unlock | `Tone.start()` | `ctx.resume()` |
| MIDI→pitch | `Tone.Frequency().toNote()` | *deleted* — MIDI goes straight in |
| Voice | `PolySynth.triggerAttackRelease` | `instrument.noteOn` |
| Stop | `synth.dispose()` (thrown away each play) | `instrument.allOff()` (instrument **persists**) |
| Volume | `gainToDb`, only mid-play | `master.gain`, persistent |
| Dependency | `tone` (~1 MB) | *none* — native Web Audio + tiny WebAudioFont player |

### B.5 Behavioral watch-items (B-specific, beyond §5)

- **First `play()` is slower** — it blocks on `await instrument.load()` (~100 KB
  CDN fetch). Later plays are instant (browser cache + memoized `loading`).
  Optional: fire `ensureAudio().instrument.load()` at app boot so the fetch
  overlaps the user reading the score.
- **The gesture rule is now ours.** `ctx.resume()` must be reached from the play
  button's click (it already is: button → `MusicEngine.play()` → here). It
  silently keeps audio suspended if that call chain is ever deferred behind an
  unrelated `await`.
- **`new AudioContext()`** — unprefixed is fine on all modern browsers; add
  `(window.AudioContext || window.webkitAudioContext)` only if ancient Safari
  matters (almost certainly not worth it).
