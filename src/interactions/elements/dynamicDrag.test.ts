/**
 * ⭐⭐ {@link dynamicDragTargetAt} — which NOTE a dragged dynamic is over.
 *
 * The registry is the fixture: the drawn note boxes are what the render measured, so "which note is
 * the cursor nearest" is arithmetic and belongs in a unit test (no glyph is measured here — see
 * `reference_jsdom_cannot_measure_glyphs`).
 *
 * ⭐⭐ **The claim that matters is which x's are candidates at all, and it is the OPPOSITE of the
 * hairpin's.** A wedge's tip is drawn at a note's LEFT EDGE, so `hairpinDragTargetAt` snaps to
 * boundaries; a dynamic is drawn CENTRED on the notehead (`rendering/dynamicMarkAnchor.ts`), so this
 * one snaps to centres. Two neighbouring gestures on one line with two different answers — get them
 * the same way round and the mark jumps half a notehead early.
 */
import { describe, it, expect } from 'vitest'
import { dynamicDragTargetAt } from './dynamicDrag'
import { ElementRegistry, type ElementInfo } from '../../engine/ElementRegistry'

function dragEngine(notes: Array<{
  id: string; left: number; y: number; measure: number; beat: number
  voice?: number; staff?: number; rest?: boolean
}>, dynamic: {
  voice?: 0 | 1 | 2 | 3; staffId?: string; placement?: 'above' | 'below'
  /** Where the last render DREW the mark, and the address it is stored at. Both absent = a mark the
   *  render never registered, which is the untranslated case the older cases below run in. */
  drawnAt?: { x: number; y: number }
  at?: { measure: number; beat: number }
} | null = {}) {
  const registry = new ElementRegistry()
  for (const n of notes) {
    registry.add({
      type: n.rest ? 'rest' : 'note', id: n.id, staff: n.staff ?? 0,
      bbox: { x: n.left, y: n.y - 5, width: 12, height: 10 },
    } as ElementInfo)
  }
  if (dynamic?.drawnAt) {
    registry.add({
      type: 'dynamic', id: 'D1', staff: 0,
      bbox: { x: dynamic.drawnAt.x - 6, y: dynamic.drawnAt.y - 6, width: 12, height: 12 },
    } as ElementInfo)
  }
  const beat = { num: dynamic?.at?.beat ?? 0, den: 1 }
  return {
    getDynamicById: () => (dynamic && { id: 'D1', beat, text: 'p', ...dynamic }),
    getScore: () => ({
      staves: [{ id: 's0' }, { id: 's1' }],
      measures: dynamic?.at
        ? [{ number: dynamic.at.measure, dynamics: [{ id: 'D1', beat }] }]
        : [],
    }),
    getElementRegistry: () => registry,
    getNote: (id: string) => {
      const n = notes.find(x => x.id === id)
      return n ? { id, measure: n.measure, beat: { num: n.beat, den: 1 }, voice: n.voice, staff: n.staff } : null
    },
  } as unknown as Parameters<typeof dynamicDragTargetAt>[0]
}

/** Three quarters whose heads are 12px wide at x = 100 / 200 / 300 — centres at 106 / 206 / 306. */
const THREE = [
  { id: 'n1', left: 100, y: 50, measure: 1, beat: 0 },
  { id: 'n2', left: 200, y: 50, measure: 1, beat: 1 },
  { id: 'n3', left: 300, y: 50, measure: 1, beat: 2 },
]

describe('dynamicDragTargetAt', () => {
  it('⭐ answers with the note the cursor is nearest, from below the staff', () => {
    // y = 120 is well below the noteheads — where the dynamics line actually is.
    expect(dynamicDragTargetAt(dragEngine(THREE), 'D1', 204, 120))
      .toEqual({ measure: 1, beat: { num: 1, den: 1 } })
  })

  it('⭐⭐ snaps to notehead CENTRES — the midpoint between two notes is where it flips', () => {
    const engine = dragEngine(THREE)
    // Centres are 106 and 206, so the boundary is 156. ⛔ Were it snapping to LEFT EDGES (the
    // hairpin's rule) the flip would sit at 150 and 155 would already answer with the second note.
    expect(dynamicDragTargetAt(engine, 'D1', 155, 60)).toMatchObject({ beat: { num: 0, den: 1 } })
    expect(dynamicDragTargetAt(engine, 'D1', 157, 60)).toMatchObject({ beat: { num: 1, den: 1 } })
  })

  it('⚠️ uses BOTH axes, so a similar x on another SYSTEM cannot win', () => {
    // 🚨 Cross-system x's are not one ruler: the note directly above the cursor must beat the one at
    // a nearly identical x several systems up.
    const engine = dragEngine([
      { id: 'up', left: 205, y: 50, measure: 1, beat: 0 },
      { id: 'here', left: 220, y: 400, measure: 5, beat: 3 },
    ])
    expect(dynamicDragTargetAt(engine, 'D1', 210, 430)).toMatchObject({ measure: 5 })
  })

  it('stays in the mark\'s own LANE — another voice is not a note it can reach', () => {
    const engine = dragEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ])
    // The cursor sits ON the voice-1 head, and must still answer with the voice-0 one.
    expect(dynamicDragTargetAt(engine, 'D1', 180, 50))
      .toEqual({ measure: 1, beat: { num: 0, den: 1 } })
  })

  it('…and its own STAFF', () => {
    const engine = dragEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, staff: 1 },
      { id: 'other', left: 174, y: 50, measure: 1, beat: 2, staff: 0 },
    ], { staffId: 's1' })
    expect(dynamicDragTargetAt(engine, 'D1', 180, 50))
      .toEqual({ measure: 1, beat: { num: 0, den: 1 } })
  })

  it('⭐ a REST is a candidate — a mark at the top of a bar that begins with one is ordinary', () => {
    const engine = dragEngine([
      { id: 'r1', left: 100, y: 50, measure: 1, beat: 0, rest: true },
      { id: 'n2', left: 200, y: 50, measure: 1, beat: 1 },
    ])
    expect(dynamicDragTargetAt(engine, 'D1', 104, 120)).toMatchObject({ beat: { num: 0, den: 1 } })
  })

  it('a CHORD is ONE candidate — the mark is centred on the column, not on a head of it', () => {
    const engine = dragEngine([
      { id: 'low', left: 200, y: 50, measure: 1, beat: 1 },
      { id: 'high', left: 200, y: 30, measure: 1, beat: 1 },
    ])
    expect(dynamicDragTargetAt(engine, 'D1', 206, 120)).toEqual({ measure: 1, beat: { num: 1, den: 1 } })
  })

  /**
   * 🚨🚨 His report, 2026-08-18: *"while dragging the dynamic to the left, if my cursor goes a little
   * low it jumps to the other system"*.
   *
   * ⚠️ **The fixture has to be LOPSIDED or it passes with the translation deleted**: the mark's line
   * is put NEARER the other system's noteheads than its own, which is the real geometry — a dynamics
   * line sits below its staff, i.e. in the gap between the two systems.
   */
  const TWO_SYSTEMS = [
    { id: 'mine', left: 100, y: 50, measure: 1, beat: 0 },
    { id: 'mine2', left: 260, y: 50, measure: 1, beat: 1 },
    { id: 'below', left: 100, y: 300, measure: 5, beat: 0 },
    { id: 'below2', left: 260, y: 300, measure: 5, beat: 1 },
  ]

  it('🚨🚨 reads the mark\'s OWN system, though the other one\'s notes are nearer the cursor', () => {
    // The mark is drawn at y = 200: 150px below its own noteheads, only 100px above the next
    // system's. A raw cursor y — or any hypotenuse over both axes — answers with measure 5.
    const engine = dragEngine(TWO_SYSTEMS, { drawnAt: { x: 106, y: 200 }, at: { measure: 1, beat: 0 } })
    expect(dynamicDragTargetAt(engine, 'D1', 266, 200)).toEqual({ measure: 1, beat: { num: 1, den: 1 } })
  })

  it('🚨 …and still does when the hand drifts BELOW the mark\'s own line', () => {
    // "a little low" — 30px under the glyph, which without the translation is 70px from the other
    // system's heads and 180 from its own.
    const engine = dragEngine(TWO_SYSTEMS, { drawnAt: { x: 106, y: 200 }, at: { measure: 1, beat: 0 } })
    expect(dynamicDragTargetAt(engine, 'D1', 266, 230)).toMatchObject({ measure: 1 })
  })

  it('⭐ the gap is MEASURED, so a mark on the system below reads THAT system', () => {
    // Same score, same cursor band — only the mark moved. Nothing here is a constant.
    const engine = dragEngine(TWO_SYSTEMS, { drawnAt: { x: 106, y: 450 }, at: { measure: 5, beat: 0 } })
    expect(dynamicDragTargetAt(engine, 'D1', 266, 450)).toEqual({ measure: 5, beat: { num: 1, den: 1 } })
  })

  it('⚠️ falls back to the nearest head on the side PLACEMENT says, when the anchor is not drawn', () => {
    // The mark is on screen but its own onset is not registered (culled). A `below` mark's music is
    // ABOVE it — looking the wrong way would find the next system and report a gap of nothing.
    const engine = dragEngine(TWO_SYSTEMS, { drawnAt: { x: 106, y: 200 }, placement: 'below' })
    expect(dynamicDragTargetAt(engine, 'D1', 266, 200)).toMatchObject({ measure: 1 })
  })

  it('⛔ answers NOTHING when the cursor is nowhere near the music, so the drag simply stops', () => {
    expect(dynamicDragTargetAt(dragEngine(THREE), 'D1', 900, 900)).toBeNull()
  })

  it('⛔ …and nothing for a dynamic no longer in the score', () => {
    expect(dynamicDragTargetAt(dragEngine(THREE, null), 'D1', 204, 120)).toBeNull()
  })
})
