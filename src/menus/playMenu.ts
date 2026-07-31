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
 * ⭐ **Score Sound** — the word *Score* is doing real work. The editor has one sound for everything;
 * there is no instrument model yet (docs/instruments-plan.md: a positional lane→instrument map is
 * the shape it will take). A row called "Instrument" would promise a per-staff choice that does not
 * exist, so the label admits the scope instead. The submenu is `DEV_SOUNDS` — the same curated GM
 * shortlist the dev toolbar's picker offers, from the same array, so the two lists cannot drift.
 *
 * The two pickers stay IN STEP because neither owns the value: both press `bus.sound`, and both read
 * its highlight (`interactions/soundSync.ts` is what turns a press into an engine call). Choose a
 * sound in the dev dropdown and the tick moves here; choose it here and the dropdown follows.
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
