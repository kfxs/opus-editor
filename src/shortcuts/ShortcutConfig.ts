/**
 * Keyboard shortcut configuration
 *
 * Maps keyboard keys to action names.
 * Keys should match KeyboardEvent.key values.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
 */

import { TUPLET_PRESETS, tupletPresetAction } from '../utils/tupletPresets'
import { NUMPAD_CODE_TO_KEY } from '../windows/keypad/keypadLayouts'

export interface ShortcutDefinition {
  /** The action to execute */
  action: string
  /** Optional description for help/documentation */
  description?: string
  /** Whether this shortcut should work when an input is focused (default: false) */
  allowInInput?: boolean
}

/**
 * Shortcut mappings: key -> definition
 *
 * To add a new shortcut:
 * 1. Add the key and action here
 * 2. Register the action handler in App.ts (or wherever shortcuts are used)
 */
export const SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Tool modes
  'n': {
    action: 'setEntryMode',
    description: 'Switch to note entry mode',
  },
  'Escape': {
    action: 'setSelectionMode',
    description: 'Stop playback / switch to selection mode / clear selection',
  },
  // The space bar has TWO meanings, decided by where you are — one key, because both are the same
  // gesture: get on with entering. In SELECTION mode it starts keyboard entry at the selected note.
  // In keyboard entry it TYPES a rest of the current duration at the caret and moves on, like a
  // typewriter's space bar — armed or not, so fast note+rest entry needs no tool switch (see
  // KeyboardController.enterRestAtCursor). The two can never both apply — they need opposite modes —
  // so the handler tries the rest first and falls through.
  ' ': {
    action: 'pressSpace',
    description: 'Type a rest of the current duration at the caret (keyboard entry), or start keyboard entry at the selection',
  },

  // ⭐ PLAYBACK — `p`, which is Sibelius's own key for it (there it plays FROM the selected note;
  // Space is its play/stop). ⚠️ Space is not available to us: it is note entry's typewriter key
  // above, and that is a per-keystroke gesture where playback is a per-session one. MuseScore
  // spends `p` on its piano-keyboard panel instead — the two apps disagree, so there is no key
  // here that is right by convention alone, and `p` for "play" at least says what it does.
  // ⭐ Plays FROM THE SELECTION (Sibelius again — that is the whole reason `p` is the key here):
  // the bar the selected element is in, the earliest bar of a selected group, the bar AFTER a
  // selected barline, or the top when nothing is selected. Starting clears the selection.
  // `Escape` also stops — see `setSelectionMode`, which takes the key while music is playing.
  'p': {
    action: 'togglePlayback',
    description: 'Play from the selection, or stop if it is playing',
  },

  // Note durations (for future use)
  // '1': { action: 'setDurationWhole', description: 'Whole note' },
  // '2': { action: 'setDurationHalf', description: 'Half note' },
  // '4': { action: 'setDurationQuarter', description: 'Quarter note' },
  // '8': { action: 'setDurationEighth', description: 'Eighth note' },

  // Editing
  'Delete': {
    action: 'deleteSelected',
    description: 'Delete selected note or articulation',
  },
  'Backspace': {
    action: 'deleteSelected',
    description: 'Delete selected note or articulation',
  },

  // ── The numeric keypad — Sibelius style ─────────────────────────────────────────────────────────
  //
  // Every one of these keys runs the SAME action, and it is deliberately the only thing this table
  // says about them: which cell a numpad key presses is a question about the KEYPAD PANEL, whose
  // layout changes with the page it is showing, so it is answered there (keypadLayouts'
  // `keypadCellForCode`) and not here.
  //
  // They used to be spelled out one by one — `Numpad4 → setDurationQuarter` — which was a second copy
  // of the note-entry page's layout, pinned to that page forever. Press `4` on the Beams/Tremolos page
  // and the key still set a quarter note while the cell under it showed a tremolo: the panel and the
  // pad had drifted apart, and a third page would have drifted further.
  //
  // Bound by `code`, which is what tells the pad from the main row — both report `key: '4'`. And
  // GENERATED from the pad's own key table rather than typed out: a hand-written list is a list you
  // can leave a key off (`.` was, first time round — 16 keys in the pad, 15 bound, and the dot key
  // simply stopped working on every page). `+` is in there too, as the page turn: it is a Keypad key
  // like the rest, and it used to be the panel's own document listener — which meant the pad could
  // only turn the page while the panel was open, though its other keys worked either way.
  ...Object.fromEntries(
    Object.entries(NUMPAD_CODE_TO_KEY).map(([code, key]) => [
      code,
      { action: 'keypadKey', description: `Keypad key ${key} — its meaning is the Keypad page's` },
    ]),
  ),

  // Slur (phrasing) — Sibelius-style 's' over the selection. Create-only;
  // removal is select-the-arc + Delete (not a toggle).
  's': {
    action: 'createSlur',
    description: 'Add a phrasing slur over the selection',
  },

  // Hairpins — Sibelius's keys (`H` = cresc., `Shift+H` = dim.), and both were free: `Ctrl+Shift+h`
  // (rest hide/show) is the ONLY other `h` binding in this file, and `h` sits just outside the
  // a–g note-entry block. ⚠️ Lowercase in the key on purpose — the manager lowercases single keys,
  // which is why the rest-hide entry is spelled `Ctrl+Shift+h` too. Create-only, like the slur:
  // removal is select-the-wedge + Delete.
  'h': {
    action: 'createCrescendo',
    description: 'Add a crescendo over the selection (or arm the crescendo stamp)',
  },
  'Shift+h': {
    action: 'createDiminuendo',
    description: 'Add a diminuendo over the selection (or arm the diminuendo stamp)',
  },

  // Selection navigation
  'ArrowRight': {
    action: 'selectNextNote',
    description: 'Select next note/rest',
  },
  'ArrowLeft': {
    action: 'selectPreviousNote',
    description: 'Select previous note/rest',
  },

  // Pitch editing
  'ArrowUp': {
    action: 'pitchUp',
    description: 'Raise selected note pitch',
  },
  'ArrowDown': {
    action: 'pitchDown',
    description: 'Lower selected note pitch',
  },

  // Octave jumps (Ctrl + arrow keys)
  'Ctrl+ArrowUp': {
    action: 'octaveUp',
    description: 'Raise selected note by one octave',
  },
  'Ctrl+ArrowDown': {
    action: 'octaveDown',
    description: 'Lower selected note by one octave',
  },

  // Slur endpoint / dynamic COARSE horizontal nudge. The plain/Ctrl VERTICAL + plain horizontal
  // arrows are handled modally inside the pitch/nav/octave handlers above; only this
  // horizontal-coarse pair is otherwise unbound. Its handlers DECLINE (return false) when no slur
  // endpoint is armed AND no dynamic is selected, so Ctrl+←/→ stay free for the rest of the app
  // until then. (A selected dynamic also nudges on the plain arrows — see nudgeSelectedDynamic.)
  // Ctrl+←/→ = MOVE (docs/note-offset-plan.md §C): the space before a selected note's column, or a
  // selected barline's bar width — "move a lot" on the easy key. Joins the slur-endpoint / dynamic
  // coarse chain that already owned Ctrl+←/→ (all selections disjoint, so it just adds branches).
  'Ctrl+ArrowLeft': {
    action: 'ctrlArrowLeft',
    description: 'Nudge the selected slur endpoint / dynamic left, or tighten the note-spacing / barline',
  },
  'Ctrl+ArrowRight': {
    action: 'ctrlArrowRight',
    description: 'Nudge the selected slur endpoint / dynamic right, or widen the note-spacing / barline',
  },
  'Ctrl+Backspace': {
    action: 'resetMove',
    description: 'Reset the space before the selected note / the selected bar’s width',
  },

  // Note horizontal offset (client #12 — docs/note-offset-plan.md). A free nudge of a single
  // selected note/rest off its natural column, on top of automatic spacing. It rides the deliberate
  // chords, NOT the easy key ("should not offset that much"): WIDE (1 space) on Ctrl+Shift+←/→, FINE
  // (¼ space) on Shift+Alt+←/→. Both Ctrl+Shift+Backspace and Shift+Alt+Backspace reset it to the
  // natural column (one value, a matching backspace per arrow-chord).
  //
  // ⭐ An armed SLUR ENDPOINT re-anchors on this chord instead — one note earlier/later — because
  // Ctrl+←/→ already nudges that same point by pixels, so Shift keeps the axis and means "stop
  // nudging, move the anchor" (the keyboard twin of dragging the blue square; his ask, 2026-08-17).
  // Disjoint from the offset branch and so not a conflict: arming an endpoint clears the note
  // multi-select the offset requires. `interactions/slurReanchor.ts` owns the walk.
  'Ctrl+Shift+ArrowLeft': {
    action: 'ctrlShiftArrowLeft',
    description: 'Re-anchor the armed slur endpoint one note left, or nudge the selected note left (offset, wide)',
  },
  'Ctrl+Shift+ArrowRight': {
    action: 'ctrlShiftArrowRight',
    description: 'Re-anchor the armed slur endpoint one note right, or nudge the selected note right (offset, wide)',
  },
  'Ctrl+Shift+Backspace': {
    action: 'resetNoteOffset',
    description: 'Reset the selected note to its natural horizontal position',
  },

  // Chord navigation (Alt + arrow keys)
  'Alt+ArrowUp': {
    action: 'chordNoteUp',
    description: 'Select next higher note in chord',
  },
  'Alt+ArrowDown': {
    action: 'chordNoteDown',
    description: 'Select next lower note in chord',
  },

  // Staff spacing fine nudge (Sibelius "space above staff") — only fires when a single
  // measure box is selected; the coarse step rides Alt+↑/↓ (chordNoteUp/Down overloaded by
  // selection kind). Shift+↑/↓ (not Ctrl+Alt, which Linux WMs grab for workspace switching).
  // See docs/staff-spacing-plan.md.
  'Shift+ArrowUp': {
    action: 'staffSpacingFineUp',
    description: 'Tighten space above the selected staff (fine)',
  },
  'Shift+ArrowDown': {
    action: 'staffSpacingFineDown',
    description: 'Widen space above the selected staff (fine)',
  },

  // The BARLINE GAP — how far a bar's last element stands off the line that ends it, authored on
  // top of the engraver's own `space-to-barline`. On a selected barline, ¼ space a press.
  //
  // ⭐ Shift+←/→ **because** Shift+↑/↓ is already the fine staff-spacing nudge: Shift+arrows are
  // this editor's "fine spacing" chord, vertical between staves and horizontal at the barline. The
  // easy key (Ctrl+←/→) is the bar's WIDTH, which is the other, coarser thing you do to a barline —
  // it re-spaces the bar's whole music, where this moves nothing but the line.
  'Shift+ArrowLeft': {
    action: 'barlineGapTighten',
    description: 'Tighten the gap before the selected barline (fine)',
  },
  'Shift+ArrowRight': {
    action: 'barlineGapWiden',
    description: 'Widen the gap before the selected barline (fine)',
  },
  'Shift+Backspace': {
    action: 'resetBarlineGap',
    description: 'Reset the gap before the selected barline',
  },

  // Add one measure after the selected measure box (Sibelius Ctrl+Shift+B single-bar insert;
  // "before" is palette-only). Ctrl+Shift+click a bar first — see PaletteController.addMeasureAfter.
  'Ctrl+Shift+b': {
    action: 'addMeasureAfter',
    description: 'Add a measure after the selected measure box',
  },

  // Voice navigation (Sibelius-style Alt+Shift+arrow). Jumps directly to the nearest
  // note in the voice geometrically above/below by pitch — handles voice-crossing
  // since the target is decided by pitch, not voice index. (Modifier order is
  // Ctrl+Shift+Alt, so the lookup key is 'Shift+Alt+…'.)
  'Shift+Alt+ArrowUp': {
    action: 'voiceNavUp',
    description: 'Select nearest note in the voice above',
  },
  'Shift+Alt+ArrowDown': {
    action: 'voiceNavDown',
    description: 'Select nearest note in the voice below',
  },

  // Note OFFSET, FINE step (¼ space) — Shift+Alt+←/→ (docs/note-offset-plan.md §C). The horizontal
  // twin of the voice nav above (which owns Shift+Alt+↑/↓), on the axis the nav leaves free. The
  // note MOVE (spacing / bar width) used to live here; the §C swap sent it to the easy Ctrl+←/→ and
  // gave these deliberate chords to the offset instead ("should not offset that much"). The WIDE
  // step is Ctrl+Shift+←/→ above.
  'Shift+Alt+ArrowLeft': {
    action: 'nudgeNoteOffsetFineLeft',
    description: 'Nudge the selected note left (offset, fine)',
  },
  'Shift+Alt+ArrowRight': {
    action: 'nudgeNoteOffsetFineRight',
    description: 'Nudge the selected note right (offset, fine)',
  },
  // Reset the offset. Both this and Ctrl+Shift+Backspace clear it (one value, a matching backspace
  // per arrow-chord). NOT a digit: this manager matches on `event.key`, and Shift+Alt+0 arrives as
  // ')' on a US layout and something else elsewhere.
  'Shift+Alt+Backspace': {
    action: 'resetNoteOffset',
    description: 'Reset the selected note to its natural horizontal position',
  },

  // Voice selection (Sibelius-style Alt+number). Notes are entered into the active voice.
  'Alt+1': {
    action: 'setActiveVoice1',
    description: 'Enter notes into voice 1',
  },
  'Alt+2': {
    action: 'setActiveVoice2',
    description: 'Enter notes into voice 2',
  },
  'Alt+3': {
    action: 'setActiveVoice3',
    description: 'Enter notes into voice 3',
  },
  'Alt+4': {
    action: 'setActiveVoice4',
    description: 'Enter notes into voice 4',
  },

  // Clipboard
  'Ctrl+c': {
    action: 'copySelection',
    description: 'Copy the selected notes',
  },
  'Ctrl+v': {
    action: 'pasteClipboard',
    description: 'Paste (overwrite-forward from the selection; or click to place when nothing is selected)',
  },

  // Enter on a selected dynamic opens its inline editor — the keyboard twin of double-clicking it.
  // Declines (stays a free key) when no dynamic is selected.
  'Enter': {
    action: 'editSelectedDynamic',
    description: 'Edit the selected dynamic inline',
  },

  // Clef: opens the clef entry window — the same action as Insert ▸ Clef.
  'q': {
    action: 'openClefWindow',
    description: 'Open the clef entry window',
  },

  // Feathered beam: open the Feathered Beam window — the same action as Insert ▸ Feathered Beam.
  // Reaches the window layer directly, like Q and T.
  //
  // ⭐ CTRL+F IS SIBELIUS'S *FIND*, and taken here anyway — his call: this editor has no Find in
  // edit mode, and if one ever arrives it belongs to a mode of its own. What it is NOT free of is
  // Chrome's find bar, so the key only works because a handled shortcut is `preventDefault`ed and
  // Ctrl+F is not in Chrome's RESERVED set (unlike Ctrl+T / Ctrl+W / Ctrl+Shift+T, which never reach
  // the page at all — see the note on Shift+Alt+T above).
  //
  // ⚠️ It ALSO types a *forte* inside an expression's inline editor (`DYNAMIC_INSERT_KEYS`,
  // Sibelius's binding, which we copied). The two do not fight: the editor is a contentEditable
  // overlay, and `isInInput` keeps every binding here away from it. Same key, two meanings, chosen
  // by where the caret is — which is exactly how Sibelius's own Ctrl+letter text shortcuts work.
  'Ctrl+f': {
    action: 'openFeatherWindow',
    description: 'Open the feathered beam window',
  },

  // Expression: attach a custom-text dynamic to the selected note/rest and edit it inline.
  'Ctrl+e': {
    action: 'editDynamicOnSelection',
    description: 'Insert a dynamic on the selected note/rest and type it inline',
  },
  // Tempo: the twin of Ctrl+E — insert a tempo mark and type it inline. Keeps the T of Sibelius's
  // text-family (its own tempo shortcut, Ctrl+Alt+T, is grabbed by the Linux terminal) while
  // leaving plain Ctrl+T free for a future Technique text (Sibelius's Ctrl+T).
  //
  // Two bindings this deliberately is NOT:
  //   • Ctrl+M — inside a dynamic's inline editor Ctrl+M types the `m` of the dynamics font
  //     (mp/mf), and a key must not mean two different things. Sibelius does overload it (its
  //     expression-cursor Ctrl+letter shortcuts are modal); we keep bindings unambiguous instead.
  //   • Ctrl+Shift+T — RESERVED by Chrome for "reopen closed tab". Reserved shortcuts are never
  //     delivered to the page, so preventDefault cannot save us: the handler would simply never
  //     run. Alt-based combos are not in that reserved set.
  //
  // Lookup key order is the manager's build order (Ctrl→Shift→Alt), hence 'Shift+Alt+', not
  // 'Alt+Shift+' — same as the voice-navigation bindings above.
  'Shift+Alt+t': {
    action: 'insertTempoOnSelection',
    description: 'Insert a tempo mark on the selected note/rest (or click to place) and type it inline',
  },

  // Zoom (Ctrl+=/Ctrl+- snap the ladder toward the viewport center; Ctrl+0 resets to 100%).
  // Routed through ShortcutManager so its preventDefault suppresses the browser's own page-zoom.
  // '=' and numpad '+' map to Ctrl++ ; Shift+'=' arrives as Ctrl+Shift++ (the common Ctrl++ zoom).
  'Ctrl+=': { action: 'zoomIn', description: 'Zoom in' },
  'Ctrl++': { action: 'zoomIn', description: 'Zoom in (numpad +)' },
  'Ctrl+Shift++': { action: 'zoomIn', description: 'Zoom in (Ctrl++)' },
  'Ctrl+-': { action: 'zoomOut', description: 'Zoom out' },
  'Ctrl+0': { action: 'zoomReset', description: 'Reset zoom to 100%' },

  // Turn the Keypad straight to the NOTE ENTRY page — Sibelius's F7-style jump to a named layout,
  // without walking the `+` ring. It names the PAGE, never an index (see `KEYPAD_PAGES`): a page
  // inserted later must not silently re-point this key.
  //
  // 🚨 **The NUMPAD's `1`, not the top row** (his call). The top-row `Ctrl+1` is the browser's own
  // tab-switch and a page cannot preventDefault it — the same wall `tempoMenu` and
  // `TextEditController` hit, which is why they route through the numeric keypad too.
  //
  // Named by `code`, so it is the pad and nothing else, and so it survives NUMLOCK: with the lock off
  // that key reports `key: 'End'`. `ShortcutManager` falls back to `code` for a modified shortcut for
  // exactly this — a `key` binding could not tell the two `1`s apart.
  'Ctrl+Numpad1': { action: 'keypadNoteEntryPage', description: 'Keypad: turn to the note-entry page (numpad 1)' },

  // View mode (docs/linear-view-plan.md). Sibelius binds Panorama to Ctrl+Shift+P, but Firefox
  // owns that (private window), so: Ctrl+Shift+L for "linear".
  'Ctrl+Shift+l': {
    action: 'toggleViewMode',
    description: 'Toggle linear view (one endless system) / wrapped view',
  },

  // Undo/Redo
  'Ctrl+z': {
    action: 'undo',
    description: 'Undo last action',
  },
  'Ctrl+Shift+z': {
    action: 'redo',
    description: 'Redo last undone action',
  },

  // Dot toggle. The MAIN-ROW `.` only — the numpad's `.` is a Keypad key and goes through
  // `keypadKey` above, which lands on the dot cell while the note-entry page is showing.
  Period: {
    action: 'toggleDot',
    description: 'Toggle dotted note',
  },

  // Time signature: opens the Time Signature window — the same action as Insert ▸ Time Signature.
  // Sibelius's own key for that dialog, and the sibling of Q for Clef.
  //
  // It USED to toggle triplet mode. That binding is not lost, it is narrowed to `Ctrl+3` below,
  // which is what Sibelius binds a triplet to anyway — so both keys end up where a Sibelius user
  // reaches for them, and neither action is left without one.
  't': {
    action: 'openTimeSignatureWindow',
    description: 'Open the time signature window',
  },

  // Tuplet: the third of the bare-letter Insert dialogs, beside Q and T.
  //
  // ⭐ AVID'S OWN SUGGESTION, and for this very command. Sibelius has no shortcut for its tuplet
  // DIALOG at all, so there was nothing to copy — but its manual, on customizing shortcuts, says:
  // *"if you use lots of triplets and find Control+3 a pain to type, you could assign a single key,
  // preferably an unused one, such as U"* (Reference §1.31). Of the bare letters, Sibelius leaves
  // exactly O, U and V unbound; U is the one it points at.
  //
  // ⛔ NOT Ctrl+T (Sibelius's Technique text) — Chrome RESERVES it for a new tab and never delivers
  // it to the page, so it cannot be bound here at all. Plain Alt+T is parked for Technique instead.
  // ⛔ NOT Ctrl+U either: that is Sibelius's Full Screen.
  'u': {
    action: 'openTupletWindow',
    description: 'Open the tuplet window',
  },

  // Tuplets: `Ctrl+`N arms the preset whose N that is — Sibelius's own keys, and the reason the
  // triplet lives on Ctrl+3 rather than on plain T (see the note above).
  //
  // GENERATED from the preset table, not typed out: the row of palette buttons and this keymap are
  // the same eight facts, and two hand-written copies disagree the first time one is edited.
  ...Object.fromEntries(
    TUPLET_PRESETS.map(preset => [
      `Ctrl+${preset.n}`,
      {
        action: tupletPresetAction(preset),
        description: `Tuplet: ${preset.n} in the time of ${preset.m}`,
      },
    ]),
  ),

  // Symbols: the SMuFL chart. Sibelius's own key for it, and a REFERENCE window — unlike Q and T
  // above, opening it arms nothing and changes nothing on the score (docs/symbols-window-plan.md).
  'z': {
    action: 'openSymbolsWindow',
    description: 'Open the Symbols window — the SMuFL glyph chart',
  },

  // Stem direction
  'x': { action: 'flipStemDirection', description: 'Flip: hairpin cresc./dim., octave line 8va/8vb, selected slur/trill/tie/tuplet side, articulation side, else note stem direction' },

  // Rest entry in keyboard mode
  // Hide/show selected rest(s) — Sibelius-style. Single keys are lowercased by the manager,
  // so Ctrl+Shift+H arrives as 'Ctrl+Shift+h'.
  'Ctrl+Shift+h': { action: 'toggleRestHidden', description: 'Hide or show the selected rest(s)' },

  // Note letter entry (replaces selected note/rest with the given pitch)
  'a': { action: 'enterNoteA', description: 'Enter note A at selected position' },
  'b': { action: 'enterNoteB', description: 'Enter note B at selected position' },
  'c': { action: 'enterNoteC', description: 'Enter note C at selected position' },
  'd': { action: 'enterNoteD', description: 'Enter note D at selected position' },
  'e': { action: 'enterNoteE', description: 'Enter note E at selected position' },
  'f': { action: 'enterNoteF', description: 'Enter note F at selected position' },
  'g': { action: 'enterNoteG', description: 'Enter note G at selected position' },

  // Chord note entry (adds to selected note; rest falls back to single note entry)
  'Shift+a': { action: 'addChordA', description: 'Add chord note A above selected' },
  'Shift+b': { action: 'addChordB', description: 'Add chord note B above selected' },
  'Shift+c': { action: 'addChordC', description: 'Add chord note C above selected' },
  'Shift+d': { action: 'addChordD', description: 'Add chord note D above selected' },
  'Shift+e': { action: 'addChordE', description: 'Add chord note E above selected' },
  'Shift+f': { action: 'addChordF', description: 'Add chord note F above selected' },
  'Shift+g': { action: 'addChordG', description: 'Add chord note G above selected' },
}

/**
 * All shortcuts as a flat array. Reserved for the keyboard-help window (a table over
 * `SHORTCUTS`); no caller yet, kept because that window is the obvious next reader.
 */
export function getShortcutList(): Array<{ key: string; action: string; description?: string }> {
  return Object.entries(SHORTCUTS).map(([key, def]) => ({
    key,
    action: def.action,
    description: def.description,
  }))
}
