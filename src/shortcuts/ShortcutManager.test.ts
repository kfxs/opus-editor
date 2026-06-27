// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ShortcutManager } from './ShortcutManager'

/**
 * The decline mechanism (docs/slur-endpoint-offset-plan.md P2): `handleKeyDown` runs the
 * handler FIRST, then `preventDefault`s UNLESS the handler returned `false`. This lets a
 * binding claim a key only conditionally (the slur endpoint nudge owns Ctrl+←/→ only while
 * an endpoint is armed) without globally stealing it. These guard that contract — plus the
 * backward-compatible default (void = preventDefault) every legacy handler relies on.
 */
function press(key: string, opts: { ctrl?: boolean } = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key, ctrlKey: opts.ctrl ?? false, cancelable: true, bubbles: true,
  })
  document.dispatchEvent(event)
  return event
}

describe('ShortcutManager decline mechanism', () => {
  let manager: ShortcutManager
  beforeEach(() => { manager = new ShortcutManager(); manager.enable() })
  afterEach(() => manager.disable())

  it('a handler returning void → preventDefault (handled; backward-compatible)', () => {
    let ran = false
    manager.registerAction('setEntryMode', () => { ran = true }) // SHORTCUTS['n']
    const e = press('n')
    expect(ran).toBe(true)
    expect(e.defaultPrevented).toBe(true)
  })

  it('a handler returning false → does NOT preventDefault (declines, key falls through)', () => {
    let ran = false
    manager.registerAction('nudgeSlurEndpointCoarseLeft', () => { ran = true; return false })
    const e = press('ArrowLeft', { ctrl: true }) // SHORTCUTS['Ctrl+ArrowLeft']
    expect(ran).toBe(true)                 // the handler still ran
    expect(e.defaultPrevented).toBe(false) // but the key was left free
  })

  it('a handler returning true → still preventDefault (only an explicit false declines)', () => {
    manager.registerAction('nudgeSlurEndpointCoarseRight', () => true)
    const e = press('ArrowRight', { ctrl: true })
    expect(e.defaultPrevented).toBe(true)
  })

  it('a configured key with NO registered handler → falls through (not prevented)', () => {
    const e = press('ArrowLeft', { ctrl: true }) // configured, but no handler registered
    expect(e.defaultPrevented).toBe(false)
  })
})
