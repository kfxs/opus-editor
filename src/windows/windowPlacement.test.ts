/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readPlacement, writePlacement, forgetWrittenPlacements } from './windowPlacement'

describe('windowPlacement', () => {
  beforeEach(() => {
    localStorage.clear()
    forgetWrittenPlacements()
  })

  it('gives back what was written — the corner and whether the panel was up', () => {
    writePlacement('keypad', { open: true, x: 120, y: 300 })
    expect(readPlacement('keypad')).toEqual({ open: true, x: 120, y: 300 })
  })

  it('keeps the corner of a panel that was left CLOSED, so reopening puts it back', () => {
    writePlacement('keypad', { open: false, x: 120, y: 300 })
    expect(readPlacement('keypad')).toEqual({ open: false, x: 120, y: 300 })
  })

  it('files each panel under its own name', () => {
    writePlacement('keypad', { open: true, x: 1, y: 2 })
    writePlacement('properties', { open: false, x: 3, y: 4 })
    expect(readPlacement('keypad')?.x).toBe(1)
    expect(readPlacement('properties')?.x).toBe(3)
  })

  it('is ABSENT for a panel that has never been placed, so the caller keeps its own defaults', () => {
    expect(readPlacement('keypad')).toBeNull()
  })

  // A preference is not score data: a damaged one is ignored, not reported (see the module head).
  it('is absent rather than wrong when the stored value is damaged', () => {
    localStorage.setItem('opus-editor.window.keypad', '{not json')
    expect(readPlacement('keypad')).toBeNull()

    localStorage.setItem('opus-editor.window.keypad', '{"x":10,"y":20}')
    expect(readPlacement('keypad')).toBeNull() // no `open`: it is not a placement at all
  })

  it('drops a half-corner rather than handing back half a position', () => {
    localStorage.setItem('opus-editor.window.keypad', '{"open":true,"x":10}')
    expect(readPlacement('keypad')).toEqual({ open: true })
  })

  // The callers save on every window event and every pointer release; that is only affordable
  // because an unchanged placement never reaches the disk.
  it('does not write a placement that has not changed', () => {
    writePlacement('keypad', { open: true, x: 120, y: 300 })
    localStorage.setItem('opus-editor.window.keypad', 'TOUCHED')
    writePlacement('keypad', { open: true, x: 120, y: 300 })
    expect(localStorage.getItem('opus-editor.window.keypad')).toBe('TOUCHED')

    writePlacement('keypad', { open: true, x: 121, y: 300 })
    expect(readPlacement('keypad')?.x).toBe(121)
  })
})
