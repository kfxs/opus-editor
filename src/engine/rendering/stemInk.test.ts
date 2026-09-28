/**
 * Subject: `./stemInk` — a note's stem and flag registered as their own ink rects (moved out of `ScoreRenderer`,
 * the flag added 2026-09-28). ⚠️ jsdom measures a glyph 0 wide, so the flag's box here is handed in; that it
 * sits ON the drawn flag is `e2e/noteFlagHitBox.e2e.ts`'s.
 */
import { describe, expect, it, vi } from 'vitest'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { EngravedNote } from './engraved/EngravedNote'
import { registerStemInk } from './stemInk'

const ruler = { hasStem: true, stemX: 105, stemTipY: 75, stemBaseY: 110 }
vi.mock('./engraved/noteRuler', () => ({ noteRuler: () => ruler }))

function note(flag: { drawn: boolean; box: { x: number; y: number; w: number; h: number } }): EngravedNote {
  return { shouldDrawFlag: () => flag.drawn, flag: { getBoundingBox: () => flag.box } } as unknown as EngravedNote
}
const FLAG_BOX = { x: 104, y: 75, w: 10, h: 24 }

describe('registerStemInk', () => {
  it('files the stem — the drawn line, tip to base — against the anchor note', () => {
    const registry = new ElementRegistry()
    registerStemInk(registry, note({ drawn: false, box: FLAG_BOX }), 'n1', 2, 0, 1)
    const [stem] = registry.getByType('stem')
    expect(stem).toMatchObject({ noteId: 'n1', measure: 2, staff: 0, beat: 1 })
    expect(stem.bbox.y).toBe(75)
    expect(stem.bbox.height).toBe(35)
  })

  it('⭐ files a DRAWN flag as `noteFlag`, its own box, against the same anchor', () => {
    const registry = new ElementRegistry()
    registerStemInk(registry, note({ drawn: true, box: FLAG_BOX }), 'n1', 2, 0, 1)
    const [flag] = registry.getByType('noteFlag')
    expect(flag).toMatchObject({ noteId: 'n1', measure: 2, staff: 0, beat: 1 })
    expect(flag.bbox).toEqual({ x: 104, y: 75, width: 10, height: 24 })
  })

  it('no flag drawn (beamed, or a quarter), or a box of nothing (jsdom\'s glyph) — nothing filed', () => {
    const registry = new ElementRegistry()
    registerStemInk(registry, note({ drawn: false, box: FLAG_BOX }), 'a', 1, 0, 0)
    registerStemInk(registry, note({ drawn: true, box: { x: 104, y: 75, w: 0, h: 24 } }), 'b', 1, 0, 0)
    expect(registry.getByType('noteFlag')).toEqual([])
  })

  it('a stemless note files neither', () => {
    const registry = new ElementRegistry()
    ruler.hasStem = false
    try {
      registerStemInk(registry, note({ drawn: true, box: FLAG_BOX }), 'n1', 1, 0, 0)
    } finally {
      ruler.hasStem = true
    }
    expect(registry.getByType('stem')).toEqual([])
    expect(registry.getByType('noteFlag')).toEqual([])
  })
})
