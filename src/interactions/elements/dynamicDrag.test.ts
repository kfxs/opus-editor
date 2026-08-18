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
}>, dynamic: { voice?: 0 | 1 | 2 | 3; staffId?: string } | null = {}) {
  const registry = new ElementRegistry()
  for (const n of notes) {
    registry.add({
      type: n.rest ? 'rest' : 'note', id: n.id, staff: n.staff ?? 0,
      bbox: { x: n.left, y: n.y - 5, width: 12, height: 10 },
    } as ElementInfo)
  }
  return {
    getDynamicById: () => (dynamic && { id: 'D1', beat: { num: 0, den: 1 }, text: 'p', ...dynamic }),
    getScore: () => ({ staves: [{ id: 's0' }, { id: 's1' }] }),
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

  it('⛔ answers NOTHING when the cursor is nowhere near the music, so the drag simply stops', () => {
    expect(dynamicDragTargetAt(dragEngine(THREE), 'D1', 900, 900)).toBeNull()
  })

  it('⛔ …and nothing for a dynamic no longer in the score', () => {
    expect(dynamicDragTargetAt(dragEngine(THREE, null), 'D1', 204, 120)).toBeNull()
  })
})
