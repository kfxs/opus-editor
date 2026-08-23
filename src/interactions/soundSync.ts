import { dbg } from '@/utils/debug'
import { bus } from '@/bus'
import type { MusicEngine } from '@/engine/MusicEngine'

/**
 * The playback SOUND seam — `bus.sound` ⇄ the engine, in one place.
 *
 * Two surfaces offer the choice (the dev toolbar's picker and the bar's Play ▸ Score Sound), and
 * NEITHER of them talks to the engine. Both press the same store; this wires that store's press to
 * the engine and mirrors what the SCORE then says back to HIGHLIGHT, which is what the picker shows
 * and what the menu ticks. Add a third surface tomorrow and it needs no engine either.
 *
 * ⭐⭐ **THE HIGHLIGHT IS READ BACK FROM THE SCORE, never from the press.** Since 2026-08-23 the
 * sound is score data (`engine/models/soundOps`), so it can change without anyone pressing anything:
 * an UNDO, a redo, or loading a file all move it, and a highlight mirrored from the press alone
 * would keep showing the timbre you chose rather than the one that is in force. Hence the model
 * subscription — the shape `wireKeypadSync` uses for the same reason.
 *
 * The same shape as `wireKeypadSync` / `wireSelectionInspection`: a wiring module App.ts calls once
 * and disposes, never a method on anything.
 *
 * ⚠️ Still ONE sound for the whole score — see `bus/soundSelection.ts`. Per-staff and per-voice are
 * docs/instruments-plan.md P2.
 */
export function wireSoundSync(getEngine: () => MusicEngine | null): () => void {
  /** Mirror what the SCORE says, not what was asked for. `null` while there is no engine yet. */
  const mirror = (): void => {
    const sound = getEngine()?.getScoreSound()
    if (!sound || sound.kind !== 'gm') return
    bus.sound.setHighlight(sound.program)
  }
  mirror()

  const stopPress = bus.sound.onPress((program) => {
    getEngine()?.setScoreSound({ kind: 'gm', program })
    // Mirrored only after the engine has been told — HIGHLIGHT means "in force", not "asked for".
    mirror()
    dbg(`[sound] score sound → GM ${program}`)
  })

  // The score can change the answer with nobody pressing: undo, redo, a loaded file. LAZILY attached,
  // because App.ts creates the engine after this is wired.
  let stopModel: (() => void) | null = null
  const attach = (): void => {
    if (stopModel) return
    stopModel = getEngine()?.onModelChange(mirror) ?? null
    mirror()
  }
  attach()

  return () => {
    stopPress()
    stopModel?.()
  }
}
