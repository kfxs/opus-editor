/**
 * Subject: `./barRestOps` — a STAMPED full-bar rest through the paths that REBUILD a bar
 * (docs/plans/voice-measure-rest-plan.md P1): a re-bar and a paste rebuild every lane of their region,
 * and `captureStampedSilence` / `restoreStampedSilence` are what carry the statement across.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { ChordRest, Rest } from '@/types/music'
import { stampBarRest } from './barRestOps'
import { buildClipboardFromSelection } from '@/interactions/clipboard/clipboard'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

const v = (s: ChordRest) => s.voice ?? 0
const isStamped = (s: ChordRest) => s.type === 'rest' && !!s.stamped

describe('a stamped full-bar rest through a rebuild', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel('RB')
    for (let i = 0; i < 4; i++) model.addMeasure()
  })
  const lane = (n: number, voice: number) => model.getMeasure(n)?.slots.filter(s => v(s) === voice) ?? []
  const stampedIn = (n: number, voice: number) => lane(n, voice).filter(isStamped)

  describe('re-bar', () => {
    it('a meter change: a bar wholly inside the silence is stamped again, at its NEW length', () => {
      // v2 notes in bar 1, bar 2 stamped (offsets 4..8). 4/4 → 2/4: new bars 3 and 4 are 4..6 and 6..8.
      model.addNote({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
      model.addNote({ step: 'A', octave: 3, duration: 'w', measure: 1, beat: frac(0, 1), voice: 1 })
      stampBarRest(model.getScore(), 2, 0, 1)

      model.setTimeSignature(1, { numerator: 2, denominator: 4 })
      expect(stampedIn(1, 1)).toHaveLength(0) // bar 1 holds the tied whole note's first half
      expect(stampedIn(3, 1)).toHaveLength(1)
      expect(stampedIn(4, 1)).toHaveLength(1)
      expect(fracToNumber((stampedIn(3, 1)[0] as Rest).actualDuration!)).toBe(2)
    })

    it('a bar only PART of which the silence covers keeps the ordinary fill', () => {
      // 4/4 → 3/4: bar 2's silence (4..8) covers the new bar 2 (3..6) only in part.
      model.addNote({ step: 'A', octave: 3, duration: 'w', measure: 1, beat: frac(0, 1), voice: 1 })
      stampBarRest(model.getScore(), 2, 0, 1)
      model.addNote({ step: 'B', octave: 3, duration: 'w', measure: 3, beat: frac(0, 1), voice: 1 })

      model.setTimeSignature(1, { numerator: 3, denominator: 4 })
      for (let n = 1; n <= 6; n++) expect(stampedIn(n, 1)).toHaveLength(0)
    })

    it('an all-rest region keeps its voice when every bar is stamped', () => {
      model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      for (let n = 1; n <= 4; n++) stampBarRest(model.getScore(), n, 0, 1)
      model.setTimeSignature(1, { numerator: 2, denominator: 2 })
      for (let n = 1; n <= 4; n++) expect(stampedIn(n, 1)).toHaveLength(1)
    })

    it('a bar INSERTED before it: it moves with its bar, still stamped', () => {
      stampBarRest(model.getScore(), 2, 0, 1)
      model.insertMeasureAfter(1)
      expect(stampedIn(2, 1)).toHaveLength(0)
      expect(stampedIn(3, 1)).toHaveLength(1)
    })
  })

  describe('paste', () => {
    it('over ANOTHER voice of the bar: it stays', () => {
      const n = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      stampBarRest(model.getScore(), 2, 0, 1)
      const clip = buildClipboardFromSelection(model.getScore(), [n.id])!
      model.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })
      expect(lane(2, 0).some(s => s.type === 'chord')).toBe(true)
      expect(stampedIn(2, 1)).toHaveLength(1)
    })

    it('into ANOTHER bar of the region: it stays', () => {
      const n = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
      stampBarRest(model.getScore(), 3, 0, 1)
      const clip = buildClipboardFromSelection(model.getScore(), [n.id])!
      model.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 1 })
      expect(stampedIn(3, 1)).toHaveLength(1)
    })

    it('INTO its lane: replaced — the paste is the newer statement', () => {
      const n = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      stampBarRest(model.getScore(), 2, 0, 1)
      const clip = buildClipboardFromSelection(model.getScore(), [n.id])!
      model.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 1 })
      expect(stampedIn(2, 1)).toHaveLength(0)
      expect(lane(2, 1).some(s => s.type === 'chord')).toBe(true)
    })

    it('INTO its lane with only RESTS: still replaced — the window decides, not what landed', () => {
      model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      const quarterRest = lane(1, 0).find(s => s.type === 'rest')!
      stampBarRest(model.getScore(), 2, 0, 1)
      model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
      const clip = buildClipboardFromSelection(model.getScore(), [quarterRest.id])!
      model.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 1 })
      expect(stampedIn(2, 1)).toHaveLength(0)
    })

    it('⭐ COPY a stamped rest, paste it into another bar: it arrives STAMPED (his report)', () => {
      model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
      const rest = stampBarRest(model.getScore(), 1, 0, 1)!
      const clip = buildClipboardFromSelection(model.getScore(), [rest.id])!
      model.pasteEvents(clip, { measure: 3, beat: frac(0, 1), voice: 1 })
      expect(stampedIn(3, 1)).toHaveLength(1)
    })

    it('COPY the whole bar (a voice-1 note + a stamped voice 2): both land, voice 2 stamped', () => {
      const n = model.addNote({ step: 'E', octave: 5, duration: 'w', measure: 1, beat: frac(0, 1) })
      const rest = stampBarRest(model.getScore(), 1, 0, 1)!
      const clip = buildClipboardFromSelection(model.getScore(), [n.id, rest.id])!
      model.pasteEvents(clip, { measure: 3, beat: frac(0, 1), voice: 0 })
      expect(lane(3, 0).some(s => s.type === 'chord')).toBe(true)
      expect(stampedIn(3, 1)).toHaveLength(1)
    })

    it('an ORDINARY full-bar rest copied stays ordinary', () => {
      model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 2, beat: frac(0, 1) })
      const auto = lane(1, 0)[0]
      const clip = buildClipboardFromSelection(model.getScore(), [auto.id])!
      model.pasteEvents(clip, { measure: 3, beat: frac(0, 1), voice: 0 })
      expect(stampedIn(3, 0)).toHaveLength(0)
    })
  })
})
