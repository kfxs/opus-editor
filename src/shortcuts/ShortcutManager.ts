/**
 * ShortcutManager - Handles keyboard shortcuts
 *
 * Usage:
 * 1. Create an instance: const manager = new ShortcutManager()
 * 2. Register action handlers: manager.registerAction('setEntryMode', () => { ... })
 * 3. Enable listening: manager.enable()
 * 4. Disable when done: manager.disable()
 */

import { SHORTCUTS, type ShortcutDefinition } from './ShortcutConfig'

/**
 * A shortcut handler. Returning `false` **declines** the key — the manager then skips
 * `preventDefault`, so the keypress falls through to the browser / a future binding, exactly
 * as if no handler had run. Returning `void`/`undefined` (every existing handler) = handled
 * → `preventDefault`. This lets a binding claim a key only conditionally (e.g. the slur
 * endpoint nudge owns `Ctrl+←/→` ONLY while an endpoint is armed) without globally stealing it.
 *
 * The event is passed for the handler that serves MORE THAN ONE key — the Keypad's, where every numpad
 * code runs the same action and the `code` is what says which cell was pressed. Handlers that own a
 * single key ignore it, as they always have.
 *
 * ⚠️ OPTIONAL, because a key is no longer the only way in: {@link ShortcutManager.run} invokes an
 * action from a MENU ROW, where there is no keypress to pass. A handler that actually reads the event
 * must therefore say what it does without one — the Keypad's declines, which is the truthful answer
 * ("no code, no cell").
 */
export type ActionHandler = (event?: KeyboardEvent) => boolean | void

export class ShortcutManager {
  private handlers: Map<string, ActionHandler> = new Map()
  private enabled: boolean = false
  private boundKeyHandler: (event: KeyboardEvent) => void

  constructor() {
    this.boundKeyHandler = this.handleKeyDown.bind(this)
  }

  /**
   * Register an action handler
   * @param action - The action name (must match action in ShortcutConfig)
   * @param handler - The function to call when the shortcut is triggered
   */
  registerAction(action: string, handler: ActionHandler): void {
    this.handlers.set(action, handler)
  }

  /**
   * Register multiple action handlers at once
   * @param actions - Object mapping action names to handlers
   */
  registerActions(actions: Record<string, ActionHandler>): void {
    for (const [action, handler] of Object.entries(actions)) {
      this.registerAction(action, handler)
    }
  }

  /**
   * Run a bound action WITHOUT a keypress — how a MENU ROW invokes a command.
   *
   * ⭐ This is the whole point: Edit ▸ Delete must not be a second implementation of what `Delete`
   * does, it must be the SAME one. The alternative — the menu calling the controllers itself —
   * duplicates handlers that are anything but trivial (`deleteSelected` is a switch over every
   * selectable element kind), and a duplicate drifts silently the day one of them is fixed.
   *
   * No `preventDefault` and no decline: there is no key to give back. A handler returning `false`
   * simply means it chose not to act, which from a menu is nothing more than a command that did
   * nothing — the same as pressing the key with nothing selected.
   */
  run(action: string): void {
    const handler = this.handlers.get(action)
    if (!handler) {
      console.warn(`Shortcut action "${action}" has no registered handler`)
      return
    }
    handler()
  }

  /**
   * Unregister an action handler
   * @param action - The action name to unregister
   */
  unregisterAction(action: string): void {
    this.handlers.delete(action)
  }

  /**
   * Enable keyboard shortcut listening
   */
  enable(): void {
    if (!this.enabled) {
      document.addEventListener('keydown', this.boundKeyHandler)
      this.enabled = true
    }
  }

  /**
   * Disable keyboard shortcut listening
   */
  disable(): void {
    if (this.enabled) {
      document.removeEventListener('keydown', this.boundKeyHandler)
      this.enabled = false
    }
  }

  /**
   * Check if manager is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Check if we're in an input field
    const target = event.target as HTMLElement
    const isInInput = target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable

    // Build modifier prefix for shortcut lookup
    const modifiers: string[] = []
    if (event.ctrlKey || event.metaKey) modifiers.push('Ctrl')
    if (event.shiftKey) modifiers.push('Shift')
    if (event.altKey) modifiers.push('Alt')
    const modifierPrefix = modifiers.length > 0 ? modifiers.join('+') + '+' : ''

    let shortcut: ShortcutDefinition | undefined

    // Normalize letter keys to lowercase for consistent matching
    // This handles caps lock state - e.g., Ctrl+Z works regardless of caps lock
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

    if (modifierPrefix) {
      // For shortcuts with modifiers, use event.key — so Ctrl+ArrowUp works with the regular arrows
      // and not the numpad, which reports the same `key`.
      //
      // …falling back to `code`, which is the only way to name a NUMPAD key on its own (`Ctrl+Numpad1`).
      // A fallback, not a first choice: it matches nothing that was not declared that way, so the
      // arrow rule above is untouched. It is also what makes such a binding survive NUMLOCK — with the
      // lock off the pad reports `key: 'End'`, while the `code` is `Numpad1` either way.
      shortcut = SHORTCUTS[modifierPrefix + key] ?? SHORTCUTS[modifierPrefix + event.code]
    } else {
      // For shortcuts without modifiers, check code first (for numpad), then key
      shortcut = SHORTCUTS[event.code] || SHORTCUTS[event.key]
    }

    if (!shortcut) return

    // Skip if in input and shortcut doesn't allow it
    if (isInInput && !shortcut.allowInInput) return

    // Get the handler
    const handler = this.handlers.get(shortcut.action)
    if (!handler) {
      console.warn(`Shortcut action "${shortcut.action}" has no registered handler`)
      return
    }

    // Run the handler FIRST, then preventDefault unless it DECLINED (returned false). A
    // declining handler keeps the key free (browser default / future binding) — used so a
    // conditional binding only claims its key when it actually acts. void/undefined =
    // handled → preventDefault (backward-compatible: every legacy handler returns void).
    const declined = handler(event) === false
    if (!declined) event.preventDefault()
  }

  /**
   * Get the shortcut definition for a given key
   */
  getShortcut(key: string): ShortcutDefinition | undefined {
    return SHORTCUTS[key]
  }

  /**
   * Check if a handler is registered for an action
   */
  hasHandler(action: string): boolean {
    return this.handlers.has(action)
  }
}
