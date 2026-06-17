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
  ' ': {
    action: 'enterEntryFromSelection',
    description: 'Enter entry mode keeping the selected note as cursor anchor',
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

  // Chord navigation (Alt + arrow keys)
  'Alt+ArrowUp': {
    action: 'chordNoteUp',
    description: 'Select next higher note in chord',
  },
  'Alt+ArrowDown': {
    action: 'chordNoteDown',
    description: 'Select next lower note in chord',
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
  'x': { action: 'flipStemDirection', description: 'Flip: selected slur side (above ↔ below), else note stem direction' },

  // Rest entry in keyboard mode
  'r': { action: 'enterRest', description: 'Enter rest at cursor position (keyboard mode)' },

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
 * Get all shortcuts as an array (useful for help display)
 */
export function getShortcutList(): Array<{ key: string; action: string; description?: string }> {
  return Object.entries(SHORTCUTS).map(([key, def]) => ({
    key,
    action: def.action,
    description: def.description,
  }))
}
