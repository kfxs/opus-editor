import type { LineToolKind } from '@/bus/lineSelection'
import type { EditorState } from './EditorState'
import type { PaletteController } from './PaletteController'

/**
 * What a LINES row DOES, and whether it is lit — the one translation from the bus's vocabulary
 * (`bus/lineSelection`) to the palette methods that already exist.
 *
 * ⭐⭐ **The routing is `PaletteController`'s and is not repeated here.** Every one of these methods
 * reads the same way: with notes selected it MAKES the mark, with nothing selected it ARMS a stamp
 * (a click then places it), and pressing the armed one again turns it off. This file only says WHICH
 * method a row means, so the Lines window can press a name it understands without ever seeing a
 * controller.
 *
 * ⛔ Not a `switch` inside `keypadSync` and not a slice on a toolbar: this is the twelfth-case rule
 * (CLAUDE.md). The eighth line adds a kind in the bus, a case here, and a picture — and no existing
 * caller changes.
 *
 * ⚠️ The dev shell's *Lines:* palette used to be a second door onto this table and is gone: the
 * window replaced it, and two doors meant two things to change whenever the family grew. The other
 * door that remains is the KEYBOARD — `s`, `h`, `Shift+H` reach the same three methods through
 * `ShortcutConfig` actions, which is why those three rows show a hint and the other four do not.
 */

/**
 * Run the row. `PaletteController` decides what the press MEANS (apply / arm / disarm).
 *
 * The comment on each case is what the dev palette's tooltip used to say out loud. It is kept for a
 * READER — the behaviour is not obvious from a method name, and the dialog deliberately shows none
 * of it (his call: a picture list that has to explain itself in hover text is a picture list that
 * has not been drawn well enough).
 */
export function pressLineTool(palette: PaletteController, kind: LineToolKind): void {
  switch (kind) {
    // Phrasing slur (key `s`). Selection → slurs them; nothing selected → arms the stamp, and a
    // click on a note slurs it to the next slot. Create-only: to remove one, click the arc and press
    // Delete; `x` flips its side.
    case 'slur':
      return palette.createSlur()
    // Crescendo hairpin (key `h`). Selection → a wedge over it; nothing selected → arms the stamp,
    // and a click places one running through the next slot. Ctrl+←/→ resizes a selected wedge,
    // Delete removes it.
    case 'cresc':
      return palette.createCrescendo()
    // Diminuendo hairpin (key `Shift+H`) — the crescendo's mirror in every respect.
    case 'dim':
      return palette.createDiminuendo()
    // Trill — `tr` with its wavy extension. ⭐ ONE note is a COMPLETE trill: the line still draws, to
    // the end of that note, and over tied notes it runs to the last of them. `x` flips it above or
    // below. No key: his call, and Sibelius has none either.
    case 'trill':
      return palette.createTrill()
    // Octave line up — the notes SOUND an octave higher and the noteheads do not move. ⭐ The bracket
    // stops at the last NOTEHEAD, not at the end of its duration. Delete drops the passage back.
    case '8va':
      return palette.createOttava(1)
    // Octave line down. ⭐ The side of the staff is DERIVED from the direction: drawn below, hook up.
    case '8vb':
      return palette.createOttava(-1)
    // Sustain pedal — `Ped.` down, `✻` up, and the notes RING to the lift. ⭐ Pressing again over a
    // pedal already down LIFTS it there (the pianist's re-take). Ctrl+←/→ moves the lift. No key:
    // Sibelius spells it `P`, and ours is taken (`p` is PLAY).
    case 'pedal':
      return palette.createPedal()
  }
}

/**
 * Which line tool is ARMED, or null — the row a re-opened dialog should land on, pushed to
 * `bus.line`'s highlight channel by `keypadSync`.
 *
 * ⚠️ Two of the model's tools answer with two DIFFERENT kinds each, and that asymmetry is the whole
 * reason this is a function rather than an `armedTool(state, kind)` call at each call site: an armed
 * ottava is `8va` or `8vb` by the SIGN of its shift, and an armed hairpin is `cresc` or `dim` by its
 * type. Asking "is the ottava armed" would light both octave rows at once.
 */
export function armedLineTool(state: EditorState): LineToolKind | null {
  const tool = state.selectedMarkingTool
  if (!tool) return null
  switch (tool.kind) {
    case 'slur':
      return 'slur'
    case 'trill':
      return 'trill'
    case 'pedal':
      return 'pedal'
    case 'hairpin':
      return tool.type === 'cresc' ? 'cresc' : 'dim'
    case 'ottava':
      return tool.shift > 0 ? '8va' : '8vb'
    default:
      // Every OTHER marking tool — a clef, a dynamic, the rest stamp. Not a line, so no row is lit.
      return null
  }
}
