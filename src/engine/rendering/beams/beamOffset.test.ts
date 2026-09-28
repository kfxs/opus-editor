/** Subject: `./beamOffset` — each beam is told its hand offset, from its first NOTE's slot. */
import { describe, expect, it } from 'vitest'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { ChordRest, Score } from '@/types/music'
import type { EngravedBeam } from '../engraved/EngravedBeam'
import type { EngravedNote } from '../engraved/EngravedNote'
import { applyBeamOffsets } from './beamOffset'

describe('applyBeamOffsets', () => {
  it('⭐ reads the override filed under the first CHORD\'s slot (a beamed rest before it passed over), px away from the heads', () => {
    const notes = [{}, {}, {}] as unknown as EngravedNote[]
    const slots = [{ type: 'rest', id: 'r' }, { type: 'chord', id: 'c1' }, { type: 'chord', id: 'c2' }] as unknown as ChordRest[]
    const score = { measures: [], engravingOverrides: { c1: [{ kind: 'beamOffset', start: 1.5, end: -0.5 }] } } as unknown as Score
    const beam = { notes, handAway: { startPx: 0, endPx: 0 } } as unknown as EngravedBeam
    const other = { notes: [notes[2]], handAway: { startPx: 7, endPx: 7 } } as unknown as EngravedBeam
    applyBeamOffsets(score, [beam, other], slots, notes)
    expect(beam.handAway).toEqual({ startPx: 1.5 * STAFF_SPACE_PX, endPx: -0.5 * STAFF_SPACE_PX })
    expect(other.handAway, 'a beam with no offset is reset to 0').toEqual({ startPx: 0, endPx: 0 })
  })
})
