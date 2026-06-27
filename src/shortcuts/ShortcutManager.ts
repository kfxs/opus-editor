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
 */
export type ActionHandler = () => boolean | void

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
      // For shortcuts with modifiers, only use event.key (not code)
      // This ensures Ctrl+ArrowUp only works with regular arrows, not numpad
      shortcut = SHORTCUTS[modifierPrefix + key]
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
    const declined = handler() === false
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
