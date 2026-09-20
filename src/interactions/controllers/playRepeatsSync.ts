import { dbg } from '@/utils/debug'
import { bus } from '@/bus'
import type { MusicEngine } from '@/engine/MusicEngine'

/**
 * The PLAY REPEATS seam — `bus.playRepeats` ⇄ the engine, in one place.
 *
 * Two surfaces offer the choice (the dev toolbar's 🔁 checkbox and the bar's Play ▸ Play Repeats),
 * and NEITHER of them talks to the engine. Both press the same store; this wires that store's press
 * to the engine and mirrors what playback then reports back to HIGHLIGHT, which is what the box shows
 * and what the menu ticks. Add a third surface tomorrow and it needs no engine either.
 *
 * The same shape as {@link wireSoundSync} / `wireKeypadSync`: a wiring module App.ts calls once and
 * disposes, never a method on anything.
 *
 * ⭐ **Simpler than the sound's by exactly one subscription, and the reason is worth keeping.** A
 * sound is score data, so an undo or an import can change it with nobody pressing anything — hence
 * `soundSync`'s lazily-attached, retried model subscription. Whether playback takes the repeats is a
 * statement about this HEARING: it is not in the score, not in the JSON, and nothing but a press
 * moves it. So mirroring after the press is not a shortcut here, it is the whole truth.
 *
 * ⚠️ Mirrored from what the ENGINE reports and not from the value pressed — the engine is free to
 * refuse or clamp, and a highlight that showed the request would be showing a wish.
 */
export function wirePlayRepeatsSync(getEngine: () => MusicEngine | null): () => void {
  /** What playback is actually doing. ⭐ Defaults to ON before the engine exists, because that IS the
   *  answer: a score plays its repeats unless someone says otherwise (his call, 2026-08-26). */
  const mirror = (): void => {
    bus.playRepeats.setHighlight(getEngine()?.getRepeatsEnabled() ?? true)
  }
  mirror()

  const stopPress = bus.playRepeats.onPress((on) => {
    getEngine()?.setRepeatsEnabled(on)
    // Mirrored only after the engine has been told — HIGHLIGHT means "in force", not "asked for".
    mirror()
    dbg(`[repeats] playback ${on ? 'takes' : 'ignores'} repeats`)
  })

  return stopPress
}
