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

  // Note durations (for future use)
  // '1': { action: 'setDurationWhole', description: 'Whole note' },
  // '2': { action: 'setDurationHalf', description: 'Half note' },
  // '4': { action: 'setDurationQuarter', description: 'Quarter note' },
  // '8': { action: 'setDurationEighth', description: 'Eighth note' },

  // Editing
  'Delete': {
    action: 'deleteSelected',
    description: 'Delete selected note',
  },
  'Backspace': {
    action: 'deleteSelected',
    description: 'Delete selected note',
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
