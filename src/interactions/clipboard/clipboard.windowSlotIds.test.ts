import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from '../../engine/models/ScoreModel'
import { buildClipboardFromSelection, windowSlotIds } from './clipboard'
import { getMeasureNotes } from '../../utils/musicUtils'
import { fracCreate as frac } from '../../utils/fraction'

/**
 * Subject: `./clipboard` `windowSlotIds` — what a paste SELECTS: everything it wrote, every note and
 * rest of the window on every lane the clip landed in (his report, 2026-09-26: *"everything that was
 * paste after the paste should be selected"*).
 */
describe('windowSlotIds', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel('W')
    for (let i = 0; i < 4; i++) model.addMeasure()
  })
  const ids = (m: number) => getMeasureNotes(model.getMeasure(m)!, model.getScore()).map(n => n.id).sort()

  it('a bar of a note AND rests: all of it — the rests too, not only the note', () => {
    const n = model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const clip = buildClipboardFromSelection(model.getScore(), getMeasureNotes(model.getMeasure(1)!, model.getScore()).map(x => x.id))!
    const target = { measure: 3, beat: frac(0, 1), voice: 0 }
    model.pasteEvents(clip, target)
    expect(windowSlotIds(model.getScore(), target, clip).sort()).toEqual(ids(3))
    expect(ids(3)).toHaveLength(3) // q note + q rest + h rest
    expect(n).toBeTruthy()
  })

  it('TWO voices: both lanes selected', () => {
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'A', octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })
    const all = getMeasureNotes(model.getMeasure(1)!, model.getScore()).map(x => x.id)
    const clip = buildClipboardFromSelection(model.getScore(), all)!
    const target = { measure: 3, beat: frac(0, 1), voice: 0 }
    model.pasteEvents(clip, target)
    const got = windowSlotIds(model.getScore(), target, clip).sort()
    expect(got).toEqual(ids(3))
    expect(new Set(getMeasureNotes(model.getMeasure(3)!, model.getScore()).map(n => n.voice ?? 0))).toEqual(new Set([0, 1]))
  })

  it('a SINGLE-voice clip lands in the target voice — that lane is the one selected', () => {
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 5, duration: 'w', measure: 3, beat: frac(0, 1) })
    const v1 = getMeasureNotes(model.getMeasure(1)!, model.getScore()).map(x => x.id)
    const clip = buildClipboardFromSelection(model.getScore(), v1)!
    const target = { measure: 3, beat: frac(0, 1), voice: 1 }
    model.pasteEvents(clip, target)
    const got = windowSlotIds(model.getScore(), target, clip)
    const notes = getMeasureNotes(model.getMeasure(3)!, model.getScore())
    expect(got.length).toBeGreaterThan(0)
    expect(got.every(id => (notes.find(n => n.id === id)?.voice ?? 0) === 1)).toBe(true)
  })

  it('across a barline: every bar the window reaches', () => {
    model.addNote({ step: 'C', octave: 5, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', octave: 5, duration: 'w', measure: 2, beat: frac(0, 1) })
    const both = [1, 2].flatMap(m => getMeasureNotes(model.getMeasure(m)!, model.getScore()).map(x => x.id))
    const clip = buildClipboardFromSelection(model.getScore(), both)!
    const target = { measure: 3, beat: frac(0, 1), voice: 0 }
    model.pasteEvents(clip, target)
    expect(windowSlotIds(model.getScore(), target, clip).sort()).toEqual([...ids(3), ...ids(4)].sort())
  })
})
