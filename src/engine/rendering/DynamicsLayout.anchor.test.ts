/**
 * ⭐⭐ **WHICH SLOT A DYNAMIC HANGS OFF** — {@link anchorSlotIndex}, a chapter of
 * {@link DynamicsLayout} beside it.
 *
 * ⭐ It takes NO scope: where a mark is drawn is a question about COLUMNS, and every column of the
 * staff is one (`utils/dynamicScope.onSameStaff` — his call, 2026-08-19). What the mark governs
 * decides who gets louder, and nothing here.
 *
 * ⚠️ The array it is given is **VOICE-MAJOR**, not beat-ordered: `drawMeasureContent` builds it as
 * `groups.flatMap(g => g.slots)`, one group per voice. Every case here is about that — a plain
 * "first match" scan answers with the lowest VOICE's slot, which was invisible while a mark could
 * only ever govern one voice (docs/dynamic-voice-scope-plan.md P3).
 *
 * ⛔ No geometry: this is an INDEX, and where the ink lands is the browser suite's.
 */
import { describe, it, expect } from 'vitest'
import { anchorSlotIndex } from './DynamicsLayout'
import { fracCreate as frac } from '@/utils/fraction'
import type { ChordRest } from '@/types/music'

/** A one-pitch chord in a voice at a beat. `id` is `v<voice>@<beat>` so a failure reads. */
function slot(voice: 0 | 1 | 2 | 3, beatNum: number, den = 1): ChordRest {
  return {
    id: `v${voice}@${beatNum}/${den}`,
    type: 'chord',
    beat: frac(beatNum, den),
    duration: 'q',
    measure: 0,
    voice,
    notes: [{ id: `v${voice}@${beatNum}-p`, step: 'C', alter: 0, octave: 4 }],
  } as ChordRest
}

/** Voice-major, exactly as the renderer hands it over: all of voice 0, then all of voice 1. */
const VOICE_MAJOR = [slot(0, 0), slot(0, 3), slot(1, 1), slot(1, 2)]

describe('anchorSlotIndex — the fall-forward rule', () => {
  it('lands on the exact beat when the staff has one', () => {
    expect(anchorSlotIndex(VOICE_MAJOR, frac(3, 1))).toBe(1)
    expect(anchorSlotIndex(VOICE_MAJOR, frac(2, 1))).toBe(3)
  })

  it('falls FORWARD to the next slot', () => {
    expect(anchorSlotIndex(VOICE_MAJOR, frac(5, 2))).toBe(1) // 2.5 → v0@3
  })

  it('answers −1 for an empty bar — the caller then uses the last note', () => {
    expect(anchorSlotIndex([], frac(0, 1))).toBe(-1)
  })
})

describe('anchorSlotIndex — every voice of the staff, whatever the mark governs', () => {
  // 🚨 The trap: a scan of a voice-major array answers v0@3 (index 1), which is a whole beat later
  // than v1@2 and drawn under the wrong column.
  it('takes the NEAREST beat, not the lowest voice’s', () => {
    expect(anchorSlotIndex(VOICE_MAJOR, frac(2, 1))).toBe(3) // v1@2, not v0@3
  })

  it('…and the same for a fall-forward that lands between the voices', () => {
    expect(anchorSlotIndex(VOICE_MAJOR, frac(3, 2))).toBe(3) // 1.5 → v1@2, not v0@3
  })

  it('breaks a tie by VOICE, so the anchor cannot move when a voice is added', () => {
    const tied = [slot(1, 2), slot(0, 2)] // deliberately voice 1 FIRST in the array
    expect(anchorSlotIndex(tied, frac(2, 1))).toBe(1) // the voice-0 slot
  })

  it('the LAST resort is the latest slot of any voice, not of the last group', () => {
    expect(anchorSlotIndex(VOICE_MAJOR, frac(9, 1))).toBe(1) // v0@3 is the latest beat
  })

  it('an exact hit still wins over anything later', () => {
    expect(anchorSlotIndex(VOICE_MAJOR, frac(1, 1))).toBe(2) // v1@1
  })
})
