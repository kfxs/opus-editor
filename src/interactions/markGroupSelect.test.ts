import { describe, it, expect, vi } from 'vitest'
import { markAtPress } from './markGroupSelect'
import type { MouseDownCtx } from './elements/chain'

/**
 * WHICH MARK a Ctrl-press landed on.
 *
 * Subject: {@link markGroupSelect}, sitting beside this file. The REGISTRY is fabricated — jsdom
 * draws nothing, so the boxes and the wedge's points are handed in (`reference_jsdom_cannot_measure
 * _glyphs`), which is exactly what the hit-tests read. The point of each case is WHICH kind answers,
 * and that nothing else happens on the way: no selection, no drag, no editor.
 */
type Entry = {
  type: string
  id?: string
  bbox: { x: number; y: number; width: number; height: number }
  points?: { x: number; y: number }[]
}

/** A press at (x, y) over a fabricated registry. */
function pressAt(x: number, y: number, entries: Entry[], opts: { openEditor?: () => void } = {}): MouseDownCtx {
  const registry = {
    getByType: (t: string) => entries.filter(e => e.type === t),
    getAll: () => entries,
    hitsNoteOrRestBody: () => false,
    getNotesByTupletId: () => [],
  }
  return {
    event: { preventDefault: vi.fn() } as unknown as MouseEvent,
    engine: { getDynamicById: () => ({ id: 'd1' }), ...opts } as unknown as MouseDownCtx['engine'],
    registry: registry as unknown as MouseDownCtx['registry'],
    x, y,
    closestElement: null,
    tupletAtClick: null,
  }
}

const dynamicEntry: Entry = { type: 'dynamic', id: 'dyn-1', bbox: { x: 100, y: 200, width: 12, height: 10 } }
const hairpinEntry: Entry = {
  type: 'hairpin', id: 'hp-1', bbox: { x: 300, y: 200, width: 100, height: 8 },
  points: [{ x: 300, y: 204 }, { x: 400, y: 200 }, { x: 300, y: 204 }, { x: 400, y: 208 }],
}

describe('markAtPress', () => {
  it('answers the DYNAMIC under the press', () => {
    expect(markAtPress(pressAt(104, 204, [dynamicEntry]))).toEqual({ kind: 'dynamic', id: 'dyn-1' })
  })

  it('answers the HAIRPIN whose outline the press is on', () => {
    expect(markAtPress(pressAt(350, 202, [dynamicEntry, hairpinEntry]))).toEqual({ kind: 'hairpin', id: 'hp-1' })
  })

  it('answers null where no mark is — the caller falls through to the note toggle', () => {
    expect(markAtPress(pressAt(600, 50, [dynamicEntry, hairpinEntry]))).toBeNull()
  })

  it('⛔ never opens the text editor, however many times the same mark is pressed', () => {
    // A double Ctrl-press is "in, then out" — the editor door belongs to the plain double-click.
    const openEditor = vi.fn()
    const ctx = pressAt(104, 204, [dynamicEntry], { openEditor })
    expect(markAtPress(ctx)).toEqual({ kind: 'dynamic', id: 'dyn-1' })
    expect(markAtPress(ctx)).toEqual({ kind: 'dynamic', id: 'dyn-1' })
    expect(openEditor).not.toHaveBeenCalled()
  })

  it('⛔ declines the kinds the set cannot hold — a barline press is not a group member', () => {
    const barline: Entry = { type: 'barline', id: 'bar-1', bbox: { x: 500, y: 190, width: 4, height: 40 } }
    expect(markAtPress(pressAt(502, 200, [barline]))).toBeNull()
  })
})
