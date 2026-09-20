import { bus } from '@/bus'
import { DEV_SOUNDS } from '@/engine/audio/WebAudioFontInstrument'
import type { MenuBarTitle } from './menuBar'
import type { MenuToggle } from './menuCommands'

/**
 * The **Play** menu — the transport, and what the score sounds like.
 *
 * ONE row for play and stop, not two. It is one command (`togglePlayback`) behind one key (`p`), and
 * a menu that offered both would have to grey one of them out to stay honest — so the row says what
 * pressing it will DO: *Play* when the score is silent, *Stop* while it is running. That is the whole
 * reason `MenuItem` labels may be functions.
 *
 * ⭐ **Score Sound** — the word *Score* is doing real work, and since 2026-08-23 it is literally true
 * as well: the choice is stored IN the score (`Score.playback`) and saved with it. The editor still
 * has one sound for everything, and there is no instrument model yet
 * (docs/plans/instruments-plan.md: a positional lane→instrument map is the shape it will take). A row called "Instrument" would promise a per-staff choice that does not
 * exist, so the label admits the scope instead. The submenu is `DEV_SOUNDS` — the same curated GM
 * shortlist the dev toolbar's picker offers, from the same array, so the two lists cannot drift.
 *
 * The two pickers stay IN STEP because neither owns the value: both press `bus.sound`, and both read
 * its highlight (`interactions/controllers/soundSync.ts` is what turns a press into an engine call). Choose a
 * sound in the dev dropdown and the tick moves here; choose it here and the dropdown follows.
 *
 * ⭐ **Play Repeats** (2026-08-26) is the same arrangement one store over — `bus.playRepeats`, the dev
 * toolbar's 🔁 checkbox, and `interactions/controllers/playRepeatsSync`. ⚠️ It differs from the sound in what it
 * IS: a sound is stored in the score and undoes with it, while taking the repeats is a statement
 * about this hearing and is in no file. The play order it switches is `engine/audio/repeatPlan`.
 */

/** The Play menu's commands from the app. The sound needs none — it goes through the bus. */
export interface PlayMenuActions {
  /** `isOn` = the score is playing. `toggle` = the `togglePlayback` action, the same one `p` runs. */
  playback?: MenuToggle
}

/**
 * Build the Play menu.
 *
 * ⚠️ `P` is a display echo of `ShortcutConfig`'s 'p' (Sibelius's own play key); keep them in step.
 */
export function buildPlayMenu(actions: PlayMenuActions): MenuBarTitle {
  return {
    label: 'Play',
    items: [
      {
        label: () => (actions.playback?.isOn() === true ? 'Stop' : 'Play'),
        shortcut: 'P',
        onSelect: () => actions.playback?.toggle(),
      },
      { separator: true },
      {
        /**
         * ⭐ **PLAY REPEATS** — his ask, 2026-08-26: *"we need to add the checkmark also in the Play
         * menu, saying something like Allow repetition or whatever it spells correct in English."*
         *
         * ⚠️ **"Play Repeats" is the phrase**, and it is not a paraphrase: it is what MuseScore's
         * toolbar toggle and Sibelius's playback option are both called, so a musician arriving from
         * either reads it without translating. (Dorico and Finale bury the same switch under
         * *Playback Options ▸ Repeats*.)
         *
         * ⛔ It presses `bus.playRepeats` and never touches the engine — the dev toolbar's 🔁 checkbox
         * offers the same choice, and the two stay in step for `Score Sound`'s reason: neither owns
         * the value. `interactions/controllers/playRepeatsSync` is the one place a press becomes an engine call.
         *
         * ⭐ A press of the OPPOSITE value, not a toggle of the store's own: the store's press channel
         * always fires and the handler decides, so what is sent is what the user is asking for.
         */
        label: 'Play Repeats',
        checked: () => bus.playRepeats.get() !== false,
        onSelect: () => bus.playRepeats.press(bus.playRepeats.get() === false),
      },
      { separator: true },
      {
        label: 'Score Sound',
        items: DEV_SOUNDS.map((s) => ({
          label: s.label,
          checked: () => bus.sound.get() === s.program,
          // A press, never a write: the store's press channel always fires, and `soundSync` decides
          // what it means. Re-choosing the sound already in force is a legitimate "load it again".
          onSelect: () => bus.sound.press(s.program),
        })),
      },
    ],
  }
}
