// @vitest-environment jsdom
/** Subject: `./beamGroup` — where a press finds a beam, and how a selected beam lights (his ask, 2026-09-28). */
import { describe, it, expect } from 'vitest'
import { HighlightController } from '../controllers/HighlightController'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry, type ElementInfo } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ViewMode } from '@/engine/layout/layoutConfig'
import { beamLineBand } from '@/engine/rendering/beams/beamHitInk'
import { BEAM_GROUP_ELEMENT, beamGroupAt, beamHandleAt, beamHandles, onBeamLine, paintSelectedBeamGroup } from './beamGroup'

const NS = 'http://www.w3.org/2000/svg'
/** A beam line rising left to right, 5 px thick (stem up: the band hangs below its top edge). */
const LINE: ElementInfo = {
  type: 'beamGroup', noteId: 'n1', measure: 1, staff: 0,
  points: beamLineBand({ startX: 100, startY: 60, endX: 160, endY: 48 }, 5),
  bbox: { x: 100, y: 48, width: 60, height: 17 },
}

describe('onBeamLine — the slanted BAND, never the box', () => {
  it('a point inside the band at its x is on the line; one inside the box but off the slant is not', () => {
    expect(onBeamLine(LINE, 130, 56)).toBe(true)  // edge at x=130 is y=54, band 54–59
    expect(onBeamLine(LINE, 105, 50)).toBe(false) // inside the box, well above the band at x=105 (59–64)
    expect(onBeamLine(LINE, 155, 62)).toBe(false) // inside the box, well below the band at x=155 (49–54)
  })

  it('a little pad each side — a half-space-thick beam is still a target — and nothing past the run', () => {
    expect(onBeamLine(LINE, 130, 52.5)).toBe(true)
    expect(onBeamLine(LINE, 130, 50)).toBe(false)
    expect(onBeamLine(LINE, 170, 47)).toBe(false)
  })
})

describe('beamGroupAt', () => {
  it('answers the ANCHOR of the beam whose line holds the point', () => {
    const registry = new ElementRegistry()
    registry.add(LINE)
    expect(beamGroupAt(registry, 130, 56)).toBe('n1')
    expect(beamGroupAt(registry, 130, 80)).toBeNull()
  })
})

describe('paintSelectedBeamGroup', () => {
  it('⭐ finds the beam THROUGH its anchor\'s stem, fills its LINES only — not the stems — and clears back exactly', () => {
    const canvas = document.createElement('div')
    const svg = document.createElementNS(NS, 'svg')
    canvas.appendChild(svg)
    const group = document.createElementNS(NS, 'g')
    group.setAttribute('class', 'beam')
    group.setAttribute('id', 'beam1')
    const stemGroup = document.createElementNS(NS, 'g')
    stemGroup.setAttribute('class', 'stem')
    const stem = document.createElementNS(NS, 'path')
    stemGroup.appendChild(stem)
    const line = document.createElementNS(NS, 'path')
    group.append(stemGroup, line)
    svg.appendChild(group)
    const engine = {
      getElementRegistry: () => new ElementRegistry(),
      getViewMode: () => 'wrapped' as ViewMode,
      getNote: () => ({ voice: 0 }),
      // A beamed note's stem is drawn inside its beam's group — resolved by identity, as the stem's own highlight.
      getStaveNoteSVGGroup: (id: string) => (id === 'n1' ? { group: svg, noteIndex: 0, stem: stemGroup } : null),
    } as unknown as MusicEngine
    const state = createEditorState()
    state.selectedElement = { kind: 'beamGroup', noteId: 'n1' }
    const hc = new HighlightController(() => engine, () => canvas, state)

    paintSelectedBeamGroup(hc.context()!)
    expect(line.getAttribute('fill')).toBe('#3B82F6')
    expect(stem.getAttribute('fill')).toBeNull()
    hc.clearHighlights()
    expect(line.getAttribute('fill')).toBeNull()
  })
})

describe('the two SQUARES of a selected beam (his ask, 2026-09-28: control the angle)', () => {
  it('⭐ stand at the two ends of the PRIMARY line, 10 px off its OUTER edge (his ask: on the line they covered it)', () => {
    // Stems up: the outer edge is the TOP one (y 60 at the start, 48 at the end).
    expect(beamHandles([LINE], true)).toEqual([
      { endpoint: 'start', x: 100, y: 50 },
      { endpoint: 'end', x: 160, y: 38 },
    ])
    // Stems down: the BOTTOM edge (65 and 53).
    expect(beamHandles([LINE], false)).toEqual([
      { endpoint: 'start', x: 100, y: 75 },
      { endpoint: 'end', x: 160, y: 63 },
    ])
    expect(beamHandles([])).toEqual([])
  })

  it('⭐ a press on a square keeps the beam selected and ARMS the drag — before anything else is asked', () => {
    const registry = new ElementRegistry()
    registry.add({ type: 'beam-group-handle', noteId: 'n1', endpoint: 'end', measure: 1, staff: 0, bbox: { x: 150, y: 40, width: 18, height: 18 } })
    const picked: unknown[] = []
    let armed = false
    const deps = {
      pick: (element: unknown, arm?: () => void) => { picked.push(element); arm?.(); return true as const },
      arm: () => { armed = true },
    }
    const ctx = { event: {} as MouseEvent, registry, x: 159, y: 49, closestElement: null } as never
    expect(BEAM_GROUP_ELEMENT.hit!(ctx, deps as never)).toBe(true)
    // ⭐ It PICKS the end — the arrows then move that end only.
    expect(picked).toEqual([{ kind: 'beamGroup', noteId: 'n1', endpoint: 'end' }])
    expect(armed).toBe(true)
    expect(beamHandleAt(registry, 159, 49)?.endpoint).toBe('end')
    expect(beamHandleAt(registry, 100, 100)).toBeNull()
  })
})
