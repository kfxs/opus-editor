import type { EditorState } from '../interactions/EditorState'
import { armedTool } from '../interactions/EditorState'
import type { PaletteController } from '../interactions/PaletteController'

/**
 * The **Lines** palette of the dev shell — the family of marks that run ALONG the music rather than
 * standing at one point: the slur, the hairpins, the trill and the octave lines today, and (when
 * they exist) the glissando and the pedal line.
 *
 * ⚠️ It said "drawn BETWEEN notes rather than on one" until the trill arrived and disproved it: a
 * trill's sign sits ON one note and its wavy line is an optional extension. The family is still the
 * right home for it — Dorico and Sibelius both file the trill under Lines — but the sentence had to
 * widen rather than be left describing a palette that no longer matches its own rows.
 *
 * It is a TABLE, not a row of buttons written out: adding the next line adds a ROW here, not a
 * slice of `devToolbar` (CLAUDE.md — "a slice too thin to be logic is still a slice"). Every row
 * runs a `PaletteController` method that ALREADY EXISTS and is already reachable another way — the
 * slur's is the `s` key — so this palette reimplements nothing and deleting it deletes labels.
 *
 * `isEnabled` is the row's own answer to "can it be pressed right now", asked again on every state
 * change by the toolbar's syncers. It must agree with what the palette method would do: a button
 * that looks pressable and silently does nothing is worse than one that says so (the same lesson
 * the `Small` button learned).
 */
export interface LineTool {
  /** Button face. */
  label: string
  /** Tooltip — say what the line is AND what has to be selected first. */
  title: string
  isEnabled(state: EditorState): boolean
  /** Lit when the row's STAMP is armed — the button is then the tool's on-screen switch, and a
   *  re-press turns it off (the press method's own rule). */
  isArmed(state: EditorState): boolean
  press(palette: PaletteController): void
}

export const LINE_TOOLS: readonly LineTool[] = [
  {
    label: 'Slur',
    title: 'Phrasing slur (key `s`). With notes selected it slurs them; with nothing selected it '
      + 'ARMS the slur stamp — the blue pointer — and a click on a note slurs it to the next slot. '
      + 'Press again to disarm. Create-only: to remove one, click the arc and press Delete; `x` '
      + 'flips its side.',
    // ALWAYS pressable, because the press always means something: apply, or arm. (The Lines palette
    // predates the stamp by one commit — it used to grey out with no selection, which was right
    // while "with nothing selected" meant nothing at all.)
    isEnabled: () => true,
    isArmed: (state) => armedTool(state, 'slur') !== null,
    press: (palette) => palette.createSlur(),
  },
  {
    label: 'Cresc.',
    title: 'Crescendo hairpin (key `H`). With notes selected it opens a wedge over them; with '
      + 'nothing selected it ARMS the crescendo stamp — the blue pointer — and a click on a note '
      + 'places one running through the next slot. Press again to disarm. Select a wedge and '
      + 'Ctrl+←/→ to shorten/lengthen it, Delete to remove it.',
    isEnabled: () => true,
    isArmed: (state) => state.selectedMarkingTool?.kind === 'hairpin'
      && state.selectedMarkingTool.type === 'cresc',
    press: (palette) => palette.createCrescendo(),
  },
  {
    label: 'Dim.',
    title: 'Diminuendo hairpin (key `Shift+H`). The crescendo row\'s mirror in every respect — '
      + 'selection creates, nothing selected arms the stamp, Ctrl+←/→ resizes, Delete removes.',
    isEnabled: () => true,
    // ⚠️ Two rows, two independent lights — which is why the tool carries its TYPE. A single
    // `armedTool(state, 'hairpin')` here would light both buttons whichever one was armed.
    isArmed: (state) => state.selectedMarkingTool?.kind === 'hairpin'
      && state.selectedMarkingTool.type === 'dim',
    press: (palette) => palette.createDiminuendo(),
  },
  {
    label: 'Trill',
    title: 'Trill — `tr` with its wavy extension line. With notes selected it trills them; with nothing '
      + 'selected it ARMS the trill stamp — the blue pointer — and a click on a note trills that '
      + 'note. Press again to disarm. ⭐ One note is a COMPLETE trill — the line still draws, to the '
      + 'end of that note; over tied notes it runs to the last of them. Delete removes it, `x` '
      + 'flips it above/below.',
    // ⚠️ NO keyboard shortcut, unlike every other row here — his call. This button is the trill's
    // only door, which is why it must always be pressable: the press always means something
    // (trill the selection, or arm the tool).
    isEnabled: () => true,
    isArmed: (state) => armedTool(state, 'trill') !== null,
    press: (palette) => palette.createTrill(),
  },
  {
    label: '8va',
    title: 'Octave line up — the notes SOUND an octave higher, and the noteheads do not move. With '
      + 'notes selected it puts a line over them; with nothing selected it ARMS the 8va stamp — the '
      + 'blue pointer — and a click on a note raises that note. Press again to disarm. ⭐ The bracket '
      + 'stops at the last NOTEHEAD, not at the end of its duration. Delete removes it — which drops '
      + 'the passage back an octave.',
    // ⚠️ NO keyboard shortcut, like the Trill row above and for his stated reason: Sibelius has none
    // either, so there is no muscle memory to honour. These two buttons are the octave line's only
    // door, which is why they must always be pressable — the press always means something (line the
    // selection, or arm the tool).
    isEnabled: () => true,
    isArmed: (state) => (armedTool(state, 'ottava')?.shift ?? 0) > 0,
    press: (palette) => palette.createOttava(1),
  },
  {
    label: '8vb',
    title: 'Octave line down — the notes SOUND an octave lower, and the noteheads do not move. With '
      + 'notes selected it puts a line under them; with nothing selected it ARMS the 8vb stamp. '
      + 'Press again to disarm. ⭐ The side of the staff is DERIVED from the direction — an 8vb is '
      + 'drawn below, with its hook turning up.',
    isEnabled: () => true,
    // ⭐ The two rows light independently, the cresc./dim. pair's rule: pressing one while the other
    // is armed SWAPS the tool rather than disarming it.
    isArmed: (state) => (armedTool(state, 'ottava')?.shift ?? 0) < 0,
    press: (palette) => palette.createOttava(-1),
  },
]
