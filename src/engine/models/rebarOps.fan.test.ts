/**
 * {@link rebarOps.pasteEvents} — **what a paste hands back as "the notes that landed"**, when one of
 * them is a fan.
 *
 * That list is not a report: `ClipboardController.placeAt` feeds it straight to `selectNotes`, so it
 * IS the selection you are left holding. A fanned slot draws N heads and every one of them is a note
 * you can click — so pasting a fan and getting only its owner selected is the list being wrong, not
 * the selection.
 *
 * A `ScoreModel` is the FIXTURE; the free functions in `./rebarOps` are the subject (test-layout
 * plan decision 4).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { buildClipboardFromSelection } from '@/interactions/clipboard'
import { fracCreate as frac } from '@/utils/fraction'
import { DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from '@/utils/fannedBeam'
import type { Chord, FanMark } from '@/types/music'

const FAN: FanMark = { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }

describe('pasteEvents returns every note it landed, fanned members included', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    model.addMeasure()
  })

  const chordIn = (measure: number): Chord => {
    const slot = model.getMeasure(measure)!.slots.find(s => s.type === 'chord')
    if (slot?.type !== 'chord') throw new Error(`no chord in measure ${measure}`)
    return slot
  }

  /** A fanned half note filling the first half of bar 1, copied as a clip. */
  function fannedClip() {
    const note = model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setFan(note.id, FAN)
    const clip = buildClipboardFromSelection(model.getScore(), [note.id])
    if (!clip) throw new Error('fixture: the fan produced no clip')
    return { note, clip }
  }

  it('⭐ the pasted fan’s MEMBERS are in the returned ids, not just its owner', () => {
    const { clip } = fannedClip()

    const pasted = model.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })

    const landed = chordIn(2)
    expect(landed.fan, 'fixture: the fan travelled with the clip').toBeDefined()
    const memberIds = (landed.fan!.members ?? []).flatMap(m => m.pitches.map(p => p.id))
    expect(memberIds.length, 'fixture: the pasted fan has members of its own')
      .toBe(DEFAULT_FAN_COUNT - 1)

    expect(pasted, 'the owner').toContain(landed.notes[0].id)
    for (const id of memberIds) {
      expect(pasted, `member ${id} was left out of the selection`).toContain(id)
    }
  })

  it('the ids are the PASTED copies, never the ones copied from', () => {
    // `cloneFanFresh` mints new pitch ids on the way in. Returning the source's would select notes
    // in the bar you copied FROM — and `getElementById` is document-wide, so the two would fight
    // over every lookup.
    const { note } = fannedClip()
    const sourceIds = [note.id, ...(chordIn(1).fan!.members ?? []).flatMap(m => m.pitches.map(p => p.id))]
    const clip = buildClipboardFromSelection(model.getScore(), [note.id])!

    const pasted = model.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })

    for (const id of sourceIds) expect(pasted).not.toContain(id)
  })

  it('an ordinary chord still reports exactly its own pitches', () => {
    // The guard on the other side: nothing gained a member it does not have.
    const a = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const clip = buildClipboardFromSelection(model.getScore(), [a.id, b.id])!

    const pasted = model.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(pasted, 'two plain notes in, two ids out').toHaveLength(2)
  })
})
