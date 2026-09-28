// @vitest-environment jsdom
/** Subject: `./noteFlag` — where a press finds a flag, and how a selected flag lights (his ask, 2026-09-28). */
import { describe, it, expect } from 'vitest'
import { HighlightController } from '../controllers/HighlightController'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ViewMode } from '@/engine/layout/layoutConfig'
import { noteFlagAt, paintSelectedNoteFlag } from './noteFlag'

const NS = 'http://www.w3.org/2000/svg'

describe('noteFlagAt', () => {
  it('finds the flag whose ink holds the point (a little padded), the nearest where two meet', () => {
    const registry = new ElementRegistry()
    registry.add({ type: 'noteFlag', noteId: 'a', measure: 1, staff: 0, bbox: { x: 100, y: 50, width: 10, height: 20 } })
    registry.add({ type: 'noteFlag', noteId: 'b', measure: 1, staff: 0, bbox: { x: 111, y: 50, width: 10, height: 20 } })
    expect(noteFlagAt(registry, 104, 60)).toBe('a')
    expect(noteFlagAt(registry, 118, 60)).toBe('b')
    expect(noteFlagAt(registry, 101, 71)).toBe('a') // inside the pad
    expect(noteFlagAt(registry, 104, 90)).toBeNull()
  })
})

describe('paintSelectedNoteFlag', () => {
  function harness() {
    const canvas = document.createElement('div')
    const svg = document.createElementNS(NS, 'svg')
    canvas.appendChild(svg)
    const group = document.createElementNS(NS, 'g')
    group.setAttribute('class', 'stavenote')
    const head = document.createElementNS(NS, 'text')
    group.appendChild(head)
    const flagIn = (parent: Element) => {
      const flag = document.createElementNS(NS, 'g')
      flag.setAttribute('class', 'flag')
      const glyph = document.createElementNS(NS, 'text')
      flag.appendChild(glyph)
      parent.appendChild(flag)
      return glyph
    }
    const flag = flagIn(group)
    const grace = document.createElementNS(NS, 'g')
    grace.setAttribute('class', 'stavenote')
    group.appendChild(grace)
    const graceFlag = flagIn(grace)
    svg.appendChild(group)
    const engine = {
      getElementRegistry: () => new ElementRegistry(),
      getViewMode: () => 'wrapped' as ViewMode,
      getNote: () => ({ voice: 0 }),
      getStaveNoteSVGGroup: () => ({ group, noteIndex: 0, stem: null }),
    } as unknown as MusicEngine
    const state = createEditorState()
    state.selectedElement = { kind: 'noteFlag', noteId: 'N1' }
    return { hc: new HighlightController(() => engine, () => canvas, state), flag, graceFlag, head }
  }

  it('fills ONLY the flag — not the head, not a grace note\'s flag inside it — and clears back exactly', () => {
    const { hc, flag, graceFlag, head } = harness()
    paintSelectedNoteFlag(hc.context()!)
    expect(flag.getAttribute('fill')).toBe('#3B82F6')
    expect(flag.getAttribute('stroke')).toBeNull()
    expect(head.getAttribute('fill')).toBeNull()
    expect(graceFlag.getAttribute('fill')).toBeNull()
    hc.clearHighlights()
    expect(flag.getAttribute('fill')).toBeNull()
  })
})
