import { dbg } from '@/utils/debug'
import { bus } from '@/bus'
import { DEFAULT_SOUND } from '@/engine/models/soundOps'
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
 * docs/plans/instruments-plan.md P2.
 */
export function wireSoundSync(
  getEngine: () => MusicEngine | null,
  onStateChange: (fn: () => void) => () => void,
): () => void {
  /**
   * Mirror what the SCORE says — never what was asked for.
   *
   * ⭐ Before the engine exists it says `DEFAULT_SOUND`, which is not a placeholder but the true
   * answer: a score with no assignment sounds like the default, and that is what will play. It also
   * means both surfaces open with a row TICKED (Play ▸ Score Sound) and a value SHOWN (the dev
   * picker) instead of with nothing selected — the state the highlight was left in when it was
   * `null`, and the second half of the bug the retry below fixes.
   */
  const mirror = (): void => {
    const sound = getEngine()?.getScoreSound() ?? DEFAULT_SOUND
    // A sound this build cannot name has no row to light; leave the last true answer standing.
    if (sound.kind !== 'gm') return
    bus.sound.setHighlight(sound.program)
  }
  mirror()

  const stopPress = bus.sound.onPress((program) => {
    getEngine()?.setScoreSound({ kind: 'gm', program })
    // Mirrored only after the engine has been told — HIGHLIGHT means "in force", not "asked for".
    mirror()
    dbg(`[sound] score sound → GM ${program}`)
  })

  /**
   * The score can change the answer with NOBODY PRESSING — an import, an undo, a redo. That is the
   * model's own notification, and it has to be subscribed to.
   *
   * ⚠️⚠️ **Attached LAZILY, AND RETRIED — the retry is the whole point.** App.ts wires this before it
   * builds the engine, so the first attempt always finds `null`; a single attempt would leave this
   * with no model subscription for the life of the session, and importing a score would leave the
   * picker showing the sound of the score you just replaced. (Reported 2026-08-23, one commit after
   * the sound became score data — the mirror was written and then never subscribed.) The retry rides
   * the state's change-notification, which is `wireKeypadSync`'s device for the same problem.
   */
  let stopModel: (() => void) | null = null
  const attach = (): void => {
    if (stopModel) return
    stopModel = getEngine()?.onModelChange(mirror) ?? null
    if (stopModel) mirror()
  }
  attach()
  const stopState = onStateChange(attach)

  return () => {
    stopPress()
    stopState()
    stopModel?.()
  }
}
