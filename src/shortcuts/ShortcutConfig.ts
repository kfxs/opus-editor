/**
 * Keyboard shortcut configuration
 *
 * Maps keyboard keys to action names.
 * Keys should match KeyboardEvent.key values.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
 */

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
 * 2. Register the action handler in App.vue (or wherever shortcuts are used)
 */
export const SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Tool modes
  'n': {
    action: 'setEntryMode',
    description: 'Switch to note entry mode',
  },
  'Escape': {
    action: 'setSelectionMode',
    description: 'Switch to selection mode / clear selection',
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

  // Durations (numpad keys - Sibelius style)
  'Numpad1': {
    action: 'setDurationThirtySecond',
    description: 'Thirty-second note (fusa)',
  },
  'Numpad2': {
    action: 'setDurationSixteenth',
    description: 'Sixteenth note (semicorchea)',
  },
  'Numpad3': {
    action: 'setDurationEighth',
    description: 'Eighth note (corchea)',
  },
  'Numpad4': {
    action: 'setDurationQuarter',
    description: 'Quarter note (negra)',
  },
  'Numpad5': {
    action: 'setDurationHalf',
    description: 'Half note (blanca)',
  },
  'Numpad6': {
    action: 'setDurationWhole',
    description: 'Whole note (redonda)',
  },

  // Accidentals (numpad keys)
  'Numpad7': {
    action: 'setAccidentalNatural',
    description: 'Natural accidental',
  },
  'Numpad8': {
    action: 'setAccidentalSharp',
    description: 'Sharp accidental',
  },
  'Numpad9': {
    action: 'setAccidentalFlat',
    description: 'Flat accidental',
  },

  // Tie (numpad Enter - Sibelius style)
  'NumpadEnter': {
    action: 'toggleTie',
    description: 'Toggle tie to next note of same pitch',
  },

  // Rest (numpad 0 - Sibelius style). The NUMPAD zero only: this is the Keypad's `0` key under
  // another name, and the main-row 0 is not part of that instrument. Bound by `code`, which is what
  // tells the two apart — both report `key: '0'`.
  'Numpad0': {
    action: 'convertToRest',
    description: 'Convert the selected note(s) to a rest of the same duration',
  },

  // Slur (phrasing) — Sibelius-style 's' over the selection. Create-only;
  // removal is select-the-arc + Delete (not a toggle).
  's': {
    action: 'createSlur',
    description: 'Add a phrasing slur over the selection',
  },

  // Articulations (numpad - Sibelius style)
  'NumpadDivide': {
    action: 'toggleAccent',
    description: 'Toggle accent articulation',
  },
  'NumpadMultiply': {
    action: 'toggleStaccato',
    description: 'Toggle staccato articulation',
  },
  'NumpadSubtract': {
    action: 'toggleTenuto',
    description: 'Toggle tenuto articulation',
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

  // Slur endpoint COARSE horizontal nudge. The plain/Ctrl VERTICAL + plain horizontal
  // arrows are handled modally inside the pitch/nav/octave handlers above; only this
  // horizontal-coarse pair is otherwise unbound. Its handlers DECLINE (return false) when
  // no slur endpoint is armed, so Ctrl+←/→ stay free for the rest of the app until then.
  'Ctrl+ArrowLeft': {
    action: 'nudgeSlurEndpointCoarseLeft',
    description: 'Nudge the selected slur endpoint left (coarse)',
  },
  'Ctrl+ArrowRight': {
    action: 'nudgeSlurEndpointCoarseRight',
    description: 'Nudge the selected slur endpoint right (coarse)',
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

  // Voice selection (Sibelius-style Alt+number). Notes are entered into the active voice.
  'Alt+1': {
    action: 'setActiveVoice1',
    description: 'Enter notes into voice 1',
  },
  'Alt+2': {
    action: 'setActiveVoice2',
    description: 'Enter notes into voice 2',
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

  // Zoom (Ctrl+=/Ctrl+- snap the ladder toward the viewport center; Ctrl+0 resets to 100%).
  // Routed through ShortcutManager so its preventDefault suppresses the browser's own page-zoom.
  // '=' and numpad '+' map to Ctrl++ ; Shift+'=' arrives as Ctrl+Shift++ (the common Ctrl++ zoom).
  'Ctrl+=': { action: 'zoomIn', description: 'Zoom in' },
  'Ctrl++': { action: 'zoomIn', description: 'Zoom in (numpad +)' },
  'Ctrl+Shift++': { action: 'zoomIn', description: 'Zoom in (Ctrl++)' },
  'Ctrl+-': { action: 'zoomOut', description: 'Zoom out' },
  'Ctrl+0': { action: 'zoomReset', description: 'Reset zoom to 100%' },

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

  // Dot toggle
  Period: {
    action: 'toggleDot',
    description: 'Toggle dotted note',
  },
  NumpadDecimal: {
    action: 'toggleDot',
    description: 'Toggle dotted note (numpad)',
  },

  // Tuplet toggle
  't': {
    action: 'toggleTuplet',
    description: 'Toggle triplet mode',
  },
  'Ctrl+3': {
    action: 'toggleTuplet',
    description: 'Toggle triplet mode (Ctrl+3)',
  },

  // Stem direction
  'x': { action: 'flipStemDirection', description: 'Flip: selected slur/tie/tuplet side, articulation side, else note stem direction' },

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
