/**
 * ⭐⭐ **THE KEY SIGNATURE STAMP** — which BAR a click writes to, and on how many STAVES.
 *
 * P5 of docs/plans/key-signature-plan.md, and the module CLAUDE.md's rule asks for: the score edit is in
 * the core (`engine/models/keyOps`), the *gesture* is here, and `PaletteController` /
 * `MouseController` each keep one line.
 *
 * ## ⭐⭐ A CLICK PLACES THE KEY AT THE HEAD OF THE BAR IT LANDS IN
 *
 * ⛔ Not at the nearest boundary, which is the barline stamp's rule and belongs to it alone: a
 * barline sign is a statement about a LINE, so a press had to name one. A key signature is a
 * statement about a BAR — *"this bar is in E♭"* — which is the shape `keyOps` already refuses to
 * blur (it takes no `beat`: the write API places at the head of a bar, full stop). So the ordinary
 * `pixelToMeasure` answer is the right one, exactly as the clef's and the meter's clicks take it.
 *
 * ## ⭐⭐ PLAIN DROP = ALL STAVES · `Ctrl` = THE STAFF YOU CLICKED
 *
 * ⚠️ **Note the polarity: the modifier NARROWS.** That is MuseScore's (`dom/keysig.cpp:82-104`) and
 * all four surveyed applications agree on the default — Dorico narrows with `Alt+Return`, MuseScore
 * and Sibelius and Finale each have their own one-staff control (plan §5.1). A key signature is
 * normally one statement for the whole system; the per-staff case is Bartók's four sharps against
 * four flats, which the model stores (`Measure.keys`, `staffId`) and this modifier reaches.
 *
 * ⭐ **One write per staff, all inside ONE undo batch**, so a plain drop on a grand staff is a single
 * Ctrl+Z. ⛔ Never a loop of separate edits: that is a rule about the GESTURE — you placed one
 * signature — and it would take two undos to take back what took one click.
 *
 * ## ⛔ Nothing here decides what is DRAWN
 *
 * `keyOps.setKeyAt` normalizes (asking for the key already in force stores nothing rather than a
 * redundant change), and `headerKeyAt` decides which bars print a signature. This module says what
 * was ASKED FOR, on which bar, on which staves.
 */
import { dbg } from '@/utils/debug'
import type { KeySignature } from '@/types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './state/EditorState'
import { selectedOf } from './state/EditorState'
import { fifthsOf } from '@/utils/keySignature'

/**
 * What the log calls a signature — the traditional COUNT, or "custom" for one the circle of fifths
 * cannot name (a Bartók signature mixing sharps and flats, which is why `fifthsOf` answers null
 * rather than guessing). ⛔ Deliberately not a key NAME: naming needs the mode as well, and a
 * debug line is not a place to mint a second naming table.
 */
function keyLabel(key: KeySignature): string {
  // ⚠️ The open key FIRST, because `fifthsOf` answers `null` for it (an atonal key has no position on
  // the circle) and the `null` branch below would call it a custom signature. It was unreachable
  // while nothing could author one; the Key Signature window's *Atonal* row can (2026-08-28).
  if (key.mode === 'open') return 'open/atonal'
  const fifths = fifthsOf(key)
  if (fifths === null) return 'custom signature'
  if (fifths === 0) return 'no sharps or flats'
  const n = Math.abs(fifths)
  return `${n} ${fifths > 0 ? 'sharp' : 'flat'}${n > 1 ? 's' : ''}`
}

/** Where a key signature is being written: a bar, and either one staff or every staff of it. */
export interface KeySignatureTarget {
  measure: number
  /** The one staff this write is scoped to, or `null` for every staff of the score — see the
   *  header's polarity note. */
  staff: number | null
}

/**
 * The bar a palette press should write to given what is selected, or **null when nothing names
 * one** — the palette's signal to ARM instead (the "if nothing selected, stamp" bargain every
 * palette in this editor shares).
 *
 * Selection mode only, like every other apply-to-the-selection path: in entry mode a selected note
 * is the keyboard CARET, not a selection, and a press there means "arm the stamp".
 *
 * ⭐ A selected KEY SIGNATURE names its own bar AND its own staff — you are pointing at one row of
 * signs, so the press changes that row rather than every staff's. A measure BOX names bars, so it
 * takes the system-wide default; its first bar is the one that changes, which is the bar whose head
 * the box begins at.
 *
 * ⚠️ A NOTE selection deliberately does NOT name a bar. It would be easy to read the note's measure,
 * but that is a rule nobody stated — and the stamp bargain is the one already learned everywhere
 * else: a press with notes selected arms, drops the selection, and previews what the next click
 * makes (`barlineTargetFromSelection` says the same in its own words).
 */
export function keyTargetFromSelection(state: EditorState): KeySignatureTarget | null {
  if (state.selectedTool !== 'selection') return null

  const signature = selectedOf(state, 'keySignature')
  if (signature) return { measure: signature.measure, staff: signature.staff }

  const range = selectedOf(state, 'measureRange')
  if (range) return { measure: Math.min(range.anchor, range.focus), staff: null }

  // ⭐⭐ **A SELECTED BARLINE NAMES THE BAR IT OPENS** — his report, 2026-08-28: *"i selected barline
  // before measure 3 and clicked D: nothing happened, expected is that we make a D major key change
  // in measure 3."* Dead right, and it is the natural reading of both objects: a barline selection is
  // a LINE (`elements/barline`: "the line that ENDS this measure"), and a key change is the statement
  // standing at the head of the bar on the far side of it. That is where the signs are drawn, so
  // pointing at the line and asking for D major can only mean the bar after it.
  //
  // ⭐ System-wide (`staff: null`), like the measure box and unlike a selected signature: a barline is
  // a system-wide statement (it has no staff of its own — `SelectedElement`'s `barline`), so nothing
  // in that selection narrows the drop to one hand.
  //
  // ⚠️ A line that ends the LAST bar names a bar that does not exist, and that is left to the write:
  // `keyOps.setKeyAt` answers false for a missing measure, which `applyKeySignature` logs as
  // unchanged. ⛔ Not guarded here — this function knows the selection and not the score's length,
  // and inventing a bar count for it would be a second source of that truth.
  const line = selectedOf(state, 'barline')
  if (line) return { measure: line.measure + 1, staff: null }

  // …and the `|:` is the same sentence from the other side: it OPENS its bar, so it names that bar
  // directly (`SelectedElement`'s `repeatStart`). The score's opening edge names bar 1.
  const openRepeat = selectedOf(state, 'repeatStart')
  if (openRepeat) return { measure: openRepeat.measure, staff: null }

  return null
}


/**
 * Write `key` at `target` and say so. The ONE write, shared by the armed click and by a palette
 * press on a selection, so the two gestures cannot drift apart.
 *
 * @returns whether the score changed — false when the key asked for is the one already in force
 *          there, which `keyOps` normalizes to "store nothing" rather than to a redundant change.
 */
export function applyKeySignature(
  engine: MusicEngine, key: KeySignature, target: KeySignatureTarget,
): boolean {
  const staves = target.staff === null
    ? engine.getScore().staves?.map((_, i) => i) ?? [0]
    : [target.staff]
  const where = target.staff === null ? 'all staves' : `staff ${target.staff}`

  // ⭐ ONE batch for the whole gesture: a plain drop on a grand staff is one click and must be one
  // undo. `runBatch` is also what saves the single undo entry — the per-staff `setKeyAt` calls each
  // save their own outside one, which is the "N clicks to take back one" bug this prevents.
  let changed = false
  engine.runBatch(`Key signature (${keyLabel(key)}) at measure ${target.measure}`, () => {
    for (const staff of staves) changed = engine.setKeyAt(target.measure, key, staff) || changed
  })

  dbg(changed
    ? `✓ Key signature placed | ${keyLabel(key)} at measure ${target.measure} | ${where}`
    : `· Key signature unchanged | ${keyLabel(key)} at measure ${target.measure} | ${where}`
      + ' — already in force here')
  return changed
}

/**
 * ⭐⭐ **THE ARMED TOOL'S CLICK** — the key goes at the head of the bar the press landed in.
 *
 * `MouseController` keeps one row in its dispatch chain, like every stamp beside it.
 *
 * ⭐ **`Ctrl` narrows to the staff under the pointer**, and only then is the y read at all: a plain
 * drop is a statement about the system, so which staff it landed on is not a question it asks.
 *
 * The tool stays armed — you place these in runs (a key change at the head of each section).
 */
export function stampKeySignatureAtClick(
  state: EditorState,
  engine: MusicEngine,
  y: number,
  measureNum: number,
  event: MouseEvent,
  render: () => void,
): boolean {
  const tool = state.selectedMarkingTool
  if (tool?.kind !== 'keySignature') return false

  // ⚠️ `metaKey` alongside `ctrlKey`, the repo's own convention for a narrowing modifier: MuseScore
  // spells this gesture `Ctrl`/`Cmd`, and a Mac user pressing Cmd means what a PC user means by Ctrl.
  const narrow = event.ctrlKey || event.metaKey
  const staff = narrow ? engine.getElementRegistry().staffIndexAtY(measureNum, y) : null

  applyKeySignature(engine, tool.key, { measure: measureNum, staff })
  // Repaint even when nothing changed: the click consumed a placement, and the tool has nothing else
  // to show for it.
  render()
  return true
}
