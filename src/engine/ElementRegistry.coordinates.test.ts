/**
 * ⭐⭐ **EVERY COORDINATE ON A REGISTRY ENTRY, THROUGH THE TWO FUNCTIONS THAT MOVE IT.**
 *
 * Subject: {@link offsetElement} and {@link scaleElement} in `./ElementRegistry`. Pure functions —
 * no DOM, no VexFlow, no render — so what they do is stateable exactly, which is the whole reason
 * this file can exist at all.
 *
 * ## Why it was written: a field that neither of them knew about
 *
 * 🚨 `segmentEndpoints` — a CROSS-SYSTEM slur segment's own arc ends, which its round drag handles
 * are placed from — was in NEITHER function until 2026-08-17, while its sibling `slurEndpoints` was
 * in both. A translated bar left those handles behind, and a reduced staff put them at full-size
 * coordinates. Found by auditing the type against the code (his ask), NOT by a test.
 *
 * ⚠️⚠️ **And there WAS a guard — it just never saw the field.**
 * `VexFlowRenderer.incrementalRedraw.test.ts` compares a translated bar against a freshly drawn one
 * *element for element*, which would have caught it — except that its fixture renders in **linear**
 * view, where there is one system and therefore no cross-system slur, so no entry in it has ever
 * carried a `segmentEndpoints`. A whole-object comparison is only as total as the FIXTURE that feeds
 * it (`a test can pass by luck of the fixture` — the same lesson as luck of geometry). Hence this
 * file: the fixture below is written to carry **every** coordinate-bearing field at once.
 *
 * ⭐ **SO: adding a coordinate field to `ElementInfo` means adding it to {@link EVERY_COORDINATE}
 * and to both expectations below.** That is the checklist, and it is executable
 * (`docs/dynamic-offset-plan.md` carries the same table in prose, plus `shiftById`, which is
 * exercised in `HighlightController.anchorLine.test.ts` and the browser suite).
 */
import { describe, it, expect } from 'vitest'
import { offsetElement, scaleElement, type ElementInfo } from './ElementRegistry'

/** One entry carrying EVERY coordinate-bearing field. ⭐ A new field belongs here first. */
const EVERY_COORDINATE: ElementInfo = {
  type: 'slur',
  id: 'S1',
  bbox: { x: 100, y: 200, width: 30, height: 40 },
  headX: 110,
  points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
  controlPoints: [{ x: 5, y: 6 }, { x: 7, y: 8 }],
  slurEndpoints: { p0: { x: 9, y: 10 }, p1: { x: 11, y: 12 }, direction: -1 },
  segmentEndpoints: { p0: { x: 13, y: 14 }, p1: { x: 15, y: 16 }, direction: 1 },
  guides: [{ from: { x: 17, y: 18 }, to: { x: 19, y: 20 } }],
  tupletGeometry: {
    x: 21, y: 22, width: 23, notationCenterX: 24,
    bracketLegLength: 25, bracketThickness: 26, bracketPadding: 27,
    textYOffset: 28, yOffset: 29,
  } as ElementInfo['tupletGeometry'],
}

describe('offsetElement — a bar that MOVED takes every coordinate with it', () => {
  const moved = offsetElement(EVERY_COORDINATE, 10, 20)

  it('shifts the box, the notehead x and the outline points', () => {
    expect(moved.bbox).toEqual({ x: 110, y: 220, width: 30, height: 40 })
    expect(moved.headX).toBe(120)
    expect(moved.points).toEqual([{ x: 11, y: 22 }, { x: 13, y: 24 }])
  })

  it('shifts a slur’s control points and BOTH kinds of endpoint', () => {
    expect(moved.controlPoints).toEqual([{ x: 15, y: 26 }, { x: 17, y: 28 }])
    expect(moved.slurEndpoints).toEqual({ p0: { x: 19, y: 30 }, p1: { x: 21, y: 32 }, direction: -1 })
    // 🚨 The one that was missing. A cross-system segment's handles are placed from THIS, not from
    // `slurEndpoints` — so a bar that moved used to leave them behind.
    expect(moved.segmentEndpoints).toEqual({ p0: { x: 23, y: 34 }, p1: { x: 25, y: 36 }, direction: 1 })
  })

  it('shifts BOTH ends of an attachment guide — the bar took the element and its anchor alike', () => {
    expect(moved.guides).toEqual([{ from: { x: 27, y: 38 }, to: { x: 29, y: 40 } }])
  })

  it('shifts the tuplet bracket’s absolute fields and leaves its LENGTHS alone', () => {
    expect(moved.tupletGeometry).toEqual({
      x: 31, y: 42, notationCenterX: 34,
      width: 23, bracketLegLength: 25, bracketThickness: 26, bracketPadding: 27,
      textYOffset: 28, yOffset: 29,
    })
  })

  it('never mutates the entry it was handed — the snapshot behind an incremental render', () => {
    expect(EVERY_COORDINATE.bbox.x, 'the original is untouched').toBe(100)
  })
})

describe('scaleElement — a REDUCED staff registers in its own space', () => {
  const k = 0.5
  const scaled = scaleElement(EVERY_COORDINATE, k)

  it('scales the box, the notehead x and the outline points — sizes as well as positions', () => {
    expect(scaled.bbox).toEqual({ x: 50, y: 100, width: 15, height: 20 })
    expect(scaled.headX).toBe(55)
    expect(scaled.points).toEqual([{ x: 0.5, y: 1 }, { x: 1.5, y: 2 }])
  })

  it('scales a slur’s control points and BOTH kinds of endpoint, keeping DIRECTION a sign', () => {
    expect(scaled.controlPoints).toEqual([{ x: 2.5, y: 3 }, { x: 3.5, y: 4 }])
    expect(scaled.slurEndpoints).toEqual({ p0: { x: 4.5, y: 5 }, p1: { x: 5.5, y: 6 }, direction: -1 })
    // 🚨 The other half of the same omission — the staff-size-only symptom: round handles at
    // full-size coordinates on a small staff, off the arc they belong to by exactly 1/k.
    expect(scaled.segmentEndpoints).toEqual({ p0: { x: 6.5, y: 7 }, p1: { x: 7.5, y: 8 }, direction: 1 })
    // ⚠️ `direction` is ±1, a SIDE and not a length. Scaling it would silently flip a slur at k < 1
    // to a fraction and read as "no direction" downstream.
    expect(scaled.segmentEndpoints!.direction).toBe(1)
  })

  it('scales both ends of an attachment guide', () => {
    expect(scaled.guides).toEqual([{ from: { x: 8.5, y: 9 }, to: { x: 9.5, y: 10 } }])
  })

  it('scales every length of the tuplet bracket — all of them are ink', () => {
    expect(scaled.tupletGeometry).toEqual({
      x: 10.5, y: 11, width: 11.5, notationCenterX: 12,
      bracketLegLength: 12.5, bracketThickness: 13, bracketPadding: 13.5,
      textYOffset: 14, yOffset: 14.5,
    })
  })

  it('k = 1 is the identity, and the fast path returns the entry itself', () => {
    expect(scaleElement(EVERY_COORDINATE, 1)).toEqual(EVERY_COORDINATE)
  })
})
