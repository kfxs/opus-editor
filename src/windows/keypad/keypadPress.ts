import { bus } from '@/bus'
import { keypadPageSelection } from './keypadPageSelection'
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
      if (cell.duration) bus.duration.press(cell.duration)
      break
    case 'accidental':
      // Same, and the press channel is what lets ♯-then-♯ toggle OFF: setAccidental sees the armed
      // value pressed again and clears it. A state-mirror would swallow the repeat as "no change".
      if (cell.accidental) bus.accidental.press(cell.accidental)
      break
    case 'articulation':
      // Independent toggles on a set-valued store. PRESS the value; App.ts routes it to the
      // palette's toggleX, which flips the score AND re-pushes the lit set — the store lights it
      // back, so the panel maps nothing. `articulation` is always present here (keypadLayouts).
      if (cell.articulation) bus.articulation.press(cell.articulation)
      break
    case 'dot':
      // On/off, like the accidental: PRESS always fires so re-pressing toggles the dot OFF. App.ts
      // routes it through palette.toggleDot and mirrors selectedDots back in as the highlight.
      bus.dot.press('dot')
      break
    case 'tie':
      // On/off like the dot, but engine-backed: PRESS routes to palette.toggleTie, which flips the
      // note's tie AND re-pushes the highlight (tiedTo isn't reactive, so it can't be mirrored).
      bus.tie.press('tie')
      break
    case 'rest':
      // Silences the selection (routes to palette.convertSelectionToRest via keypadSync). Its light
      // still follows the SCORE, not this click — the click changes the score, and the score lights
      // the key. Pressing it with a rest already selected is a no-op, so the light never toggles off.
      bus.rest.press('rest')
      break
    case 'beam':
      // One of the four beam MODES (single/begin/continue/end). PRESS the value; App.ts routes it to
      // palette.setBeam — the same method the toolbar's Beam row calls — which arms it and applies it
      // across the selection, then re-pushes the lit set. `beam` is always present on a beam cell.
      if (cell.beam) bus.beam.press(cell.beam)
      break
    case 'tremolo':
      // One of the six single-note marks (1–5 strokes, or the Penderecki sign). PRESS the value; it
      // routes to palette.pressTremolo — the SAME four-way router the dev toolbar's row calls, so a
      // press from the pad, the numpad or the toolbar all do the same thing (edit the selected mark,
      // apply across a selection, arm for note entry, or arm the stamp). The press channel is what
      // lets a re-press REMOVE the mark: a state mirror would swallow it as "no change".
      if (cell.tremolo) bus.tremolo.press(cell.tremolo)
      break
    case 'fan':
      // A FEATHERED BEAM, `accel.` or `rit.` (Sibelius's `0` and `.`). PRESS the direction; it routes
      // to palette.pressFan — the same method the dev toolbar's two buttons call — which puts a fan on
      // the selection, turns an existing one round, or takes it off when the lit key is pressed again.
      // The press channel is what makes that last one possible: a mirror would swallow it as "no
      // change" (docs/fanned-beams-plan.md §3).
      if (cell.fan) bus.fan.press(cell.fan)
      break
    case 'tremoloPair':
      // The two-note tremolo (Sibelius's Enter). A SECOND AXIS beside the count, so it presses its own
      // store and lights beside the lit count key rather than replacing it.
      bus.tremoloPair.press('tremoloPair')
      break
    case 'subdivide':
      // The secondary beam break, on/off: PRESS always fires so re-pressing toggles it off. Routes to
      // palette.toggleSecondaryBreak, which flips the score AND re-pushes the highlight (secondaryBreak
      // isn't reactive, so it can't be mirrored).
      bus.subdivide.press('subdivide')
      break
    case 'beamOver':
      // Beam over the selected rest, on/off like the subdivide: PRESS routes to palette.toggleBeamOver.
      bus.beamOver.press('beamOver')
      break
    case 'momentary':
      // A blank, unassigned key. It does
      // NOTHING, which is the right nothing: a numpad key over an unwired cell must not fall through to
      // some other page's meaning, and an unwired key shows no light (the beam cluster above is wired).
      break
    case 'mode':
      // The arrow ACTIVATES selection mode. Its light follows the editor, not this click, so there
      // is no local state to flip — the press routes to enterSelectionMode (via keypadSync), the
      // editor's mode changes, and keypadSync's sync() repaints us. (No-op if already there.)
      bus.mode.press('selection')
      break
    case 'page':
      // The `+` key: turn to the next page. It changes the SEAM, not the panel — the panel is a
      // subscriber like anyone else, and re-lays its grid when the page changes under it.
      keypadPageSelection.next()
      break
  }
}
