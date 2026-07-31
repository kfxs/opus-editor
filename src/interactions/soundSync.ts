import { dbg } from '@/utils/debug'
import { bus } from '@/bus'
import { DEV_SOUNDS } from '@/engine/audio/WebAudioFontInstrument'
import type { MusicEngine } from '@/engine/MusicEngine'

/**
 * The playback SOUND seam — `bus.sound` ⇄ the engine, in one place.
 *
 * Two surfaces offer the choice (the dev toolbar's picker and the bar's Play ▸ Score Sound), and
 * NEITHER of them talks to the engine. Both press the same store; this wires that store's press to
 * `setInstrumentProgram` and mirrors the accepted value back to HIGHLIGHT, which is what the picker
 * shows and what the menu ticks. Add a third surface tomorrow and it needs no engine either.
 *
 * The same shape as `wireKeypadSync` / `wireSelectionInspection`: a wiring module App.ts calls once
 * and disposes, never a method on anything.
 *
 * ⚠️ TEMPORARY along with `DEV_SOUNDS` — one sound for the whole score is not an instrument model.
 * See `bus/soundSelection.ts`.
 */
export function wireSoundSync(getEngine: () => MusicEngine | null): () => void {
  // The opening value is the engine's own default (GM program 0, the piano it loads anyway), stated
  // so both surfaces open showing what you would actually hear rather than nothing.
  bus.sound.setHighlight(DEV_SOUNDS[0].program)

  return bus.sound.onPress((program) => {
    getEngine()?.setInstrumentProgram(program)
    // Mirrored only after the engine has been told — HIGHLIGHT means "in force", not "asked for".
    bus.sound.setHighlight(program)
    dbg(`[sound] score sound → GM ${program}`)
  })
}
