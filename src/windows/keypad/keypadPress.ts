import { modeSelection } from '../../interactions/modeSelection'
import { durationSelection } from '../../interactions/durationSelection'
import { accidentalSelection } from '../../interactions/accidentalSelection'
import { articulationSelection } from '../../interactions/articulationSelection'
import { dotSelection } from '../../interactions/dotSelection'
import { tieSelection } from '../../interactions/tieSelection'
import { restSelection } from '../../interactions/restSelection'
import { keypadPageSelection } from '../../interactions/keypadPageSelection'
import { keypadProbe } from './keypadProbe'
import type { KeypadCell } from './keypadLayouts'

/**
 * What pressing a Keypad key DOES — the one answer, for both ways of pressing it: clicking the cell in
 * the panel, and hitting the numpad key it mirrors. It takes a CELL, so the caller never maps a key to
 * a meaning; the layout already carries it ({@link KeypadCell.duration} and friends).
 *
 * No DOM here, and no lights: every press goes out through a seam store, the editor acts, and the
 * lights come back in through {@link wireKeypadSync}. That is why the numpad works with the panel shut
 * — nothing in this path needs a button to exist.
 *
 * What it means to the lights depends only on the cell's `select` — see the doc on `Select`. Nothing
 * else in the panel needs to know that ♯ and ♭ are related.
 */
export function pressKeypadCell(cell: KeypadCell): void {
  switch (cell.select) {
    case 'duration':
      // The armed duration lives in the editor's store, not the panel's lit set — PRESS the value
      // and the store lights it back (App.ts runs the full setDuration path). The store decides the
      // radio; the panel maps nothing. `duration` is always present on a duration cell (keypadLayouts).
      if (cell.duration) durationSelection.press(cell.duration)
      break
    case 'accidental':
      // Same, and the press channel is what lets ♯-then-♯ toggle OFF: setAccidental sees the armed
      // value pressed again and clears it. A state-mirror would swallow the repeat as "no change".
      if (cell.accidental) accidentalSelection.press(cell.accidental)
      break
    case 'articulation':
      // Independent toggles on a set-valued store. PRESS the value; App.ts routes it to the
      // palette's toggleX, which flips the score AND re-pushes the lit set — the store lights it
      // back, so the panel maps nothing. `articulation` is always present here (keypadLayouts).
      if (cell.articulation) articulationSelection.press(cell.articulation)
      break
    case 'dot':
      // On/off, like the accidental: PRESS always fires so re-pressing toggles the dot OFF. App.ts
      // routes it through palette.toggleDot and mirrors selectedDots back in as the highlight.
      dotSelection.press('dot')
      break
    case 'tie':
      // On/off like the dot, but engine-backed: PRESS routes to palette.toggleTie, which flips the
      // note's tie AND re-pushes the highlight (tiedTo isn't reactive, so it can't be mirrored).
      tieSelection.press('tie')
      break
    case 'rest':
      // Silences the selection (routes to palette.convertSelectionToRest via keypadSync). Its light
      // still follows the SCORE, not this click — the click changes the score, and the score lights
      // the key. Pressing it with a rest already selected is a no-op, so the light never toggles off.
      restSelection.press('rest')
      break
    case 'momentary':
      // A blank, unassigned key — the whole of page 2 is still this. It does nothing to the score,
      // which is the RIGHT nothing: the numpad key over an unwired cell must not fall through to some
      // other page's meaning. 🚧 It does light up though, so you can SEE the key land on the page that
      // is showing — temporary, goes when page 2 is wired ({@link keypadProbe}).
      keypadProbe.press(cell.key)
      break
    case 'mode':
      // The arrow ACTIVATES selection mode. Its light follows the editor, not this click, so there
      // is no local state to flip — the press routes to enterSelectionMode (via keypadSync), the
      // editor's mode changes, and keypadSync's sync() repaints us. (No-op if already there.)
      modeSelection.press('selection')
      break
    case 'page':
      // The `+` key: turn to the next page. It changes the SEAM, not the panel — the panel is a
      // subscriber like anyone else, and re-lays its grid when the page changes under it.
      keypadPageSelection.next()
      break
  }
}
