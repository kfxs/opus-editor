/**
 * Subject: `./meter` — the time signature's ink and its one placement rule (P5b).
 *
 * ⭐ The rule under test is the CLEF's rule again — *the anchor line's y IS the glyph's baseline* —
 * and the interesting half is the PREMISE underneath it: that a SMuFL time-signature numeral is cut
 * **centred on its origin**, so putting the baseline on a staff line centres the digit there. That is
 * a claim about the FONT, so it is asserted against the font's own table rather than restated in
 * prose, and a font whose digits are not centred fails here instead of quietly making the module's
 * header wrong.
 *
 * ⚠️ What this spec must also pin is the two things around the ink: the `timesignature` GROUP and its
 * id (`e2e/barlineTypes.e2e.ts` measures `.vf-timesignature text`, `ElementRegistry` resolves the hit
 * box by that id), and the ROW ORDER, because `e2e/staffSize.e2e.ts` reads a meter's x as
 * `h.placed(…)[0].x` and means the UPPER row by it.
 */
import { describe, it, expect } from 'vitest'
import { drawMeter, meterRowBaseline, stampMeter, type MeterRow } from './meter'
import { glyphBox, type GlyphName } from '@/engine/fonts/fontMetrics'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import type { Scene, SceneGroup, ScenePrimitive } from '@/engine/scene/Scene'

/**
 * SMuFL `timeSig3` (U+E083) and `timeSig4` (U+E084) — what VexFlow hands a 3/4 stave.
 * ⭐ Built the way `TimeSignature.getTimeSigCode` builds them (`0xe080 + the digit`) rather than
 * pasted, so the codepoint is readable rather than an invisible character in a string literal.
 */
const THREE = String.fromCodePoint(0xe083)
const FOUR = String.fromCodePoint(0xe084)
/** SMuFL `timeSigCommon` (U+E08A) — the whole of a `C` meter. */
const COMMON = String.fromCodePoint(0xe08a)
const FONT = { family: 'Bravura,Academico', size: 38, weight: 'normal', style: 'normal' }

/** A 3/4 on a treble stave whose top line is y = 40: rows on lines 1 and 3, i.e. y = 50 and 70. */
const ROWS: MeterRow[] = [
  { glyph: THREE, x: 30, lineY: 50, font: FONT },
  { glyph: FOUR, x: 30, lineY: 70, font: FONT },
]

function texts(scene: Scene | SceneGroup): Extract<ScenePrimitive, { kind: 'text' }>[] {
  const out: Extract<ScenePrimitive, { kind: 'text' }>[] = []
  for (const child of scene.children) {
    if (child.kind === 'group') out.push(...texts(child))
    else if (child.kind === 'text') out.push(child)
  }
  return out
}

describe('meterRowBaseline — a numeral is CENTRED on the line it names', () => {
  it('⭐ the anchor line’s y IS the baseline — ⛔ not a top, ⛔ not a centre', () => {
    expect(meterRowBaseline(50)).toBe(50)
  })

  it('⚠️ the anchor is what the CALLER resolved — this adds no nudge of its own', () => {
    // 🚨 The whole guard of this spec. The GAP between the two rows is ⛔ UNKNOWN in every treatise
    // (`docs/header-spacing-research.md` row H) and the engines split 2.0 sp against 0.0 — so a
    // number added here would be an engraving rule chosen inside a migration, which is the one thing
    // the migration's safety argument forbids.
    for (const lineY of [-40, 0, 0.5, 137.25, 1e4]) expect(meterRowBaseline(lineY)).toBe(lineY)
  })

  it('⭐⭐ THE PREMISE, checked against the FONT: a timeSig digit is cut CENTRED on its origin', () => {
    // ⭐ This is what makes "the line's y is the BASELINE" the same sentence as "the numeral is
    // CENTRED on the line". Bravura's digits reach ~1 staff space either side of their own origin,
    // i.e. two spaces tall and symmetric — so baselines on the 2nd and 4th staff lines put the pair
    // across lines 1–3 and 3–5, filling the staff exactly (Gould p. 152).
    const digits: GlyphName[] = [
      'timeSig0', 'timeSig1', 'timeSig2', 'timeSig3', 'timeSig4',
      'timeSig5', 'timeSig6', 'timeSig7', 'timeSig8', 'timeSig9',
    ]
    for (const digit of digits) {
      const box = glyphBox(digit)
      expect(box.up, `${digit} reaches ~1 staff space ABOVE its origin`).toBeCloseTo(1, 1)
      expect(box.down, `${digit} reaches ~1 staff space BELOW its origin`).toBeCloseTo(1, 1)
      // ⭐ Centred, not merely tall: the two reaches agree to well inside a tenth of a space.
      expect(Math.abs(box.up - box.down), `${digit} is symmetric about its origin`).toBeLessThan(0.05)
    }
  })
})

describe('drawMeter — the ink', () => {
  it('⭐ one glyph per row, in the face it was handed, inside a group that keeps its id', () => {
    const recorder = new SceneRecorder()
    drawMeter(recorder, ROWS, 'vf-auto-9001')

    const group = recorder.scene.children[0]
    expect(group.kind === 'group' && group.cls, 'VexFlow drew a `vf-timesignature` group, so we do')
      .toBe('timesignature')
    // 🚨 The id is not decoration — see the module header.
    expect(group.kind === 'group' && group.id).toBe('vf-auto-9001')
    expect(texts(recorder.scene)).toEqual([
      { kind: 'text', text: THREE, x: 30, y: 50, font: FONT, style: {} },
      { kind: 'text', text: FOUR, x: 30, y: 70, font: FONT, style: {} },
    ])
  })

  it('⚠️ the UPPER row is drawn FIRST — `e2e/staffSize` reads a meter’s x as `[0].x`', () => {
    const recorder = new SceneRecorder()
    drawMeter(recorder, ROWS)
    const [first, second] = texts(recorder.scene)
    expect(first.text, 'the numerator').toBe(THREE)
    expect(second.y - first.y, 'and it is the HIGHER of the two on the page').toBeGreaterThan(0)
  })

  it('⭐ a one-row meter (C, C|) is a one-row meter and nothing more special', () => {
    const recorder = new SceneRecorder()
    // SMuFL `timeSigCommon` on the middle line of the same stave.
    drawMeter(recorder, [{ glyph: COMMON, x: 30, lineY: 60, font: FONT }])
    expect(texts(recorder.scene)).toEqual([
      { kind: 'text', text: COMMON, x: 30, y: 60, font: FONT, style: {} },
    ])
  })

  it('⚠️ an empty row stamps nothing — ⛔ but the GROUP is still opened, as VexFlow opens it', () => {
    const recorder = new SceneRecorder()
    drawMeter(recorder, [{ glyph: '', x: 30, lineY: 50, font: FONT }], 'vf-auto-9002')
    const group = recorder.scene.children[0]
    expect(group.kind === 'group' && group.id).toBe('vf-auto-9002')
    expect(texts(recorder.scene), 'no empty `<text>` node').toEqual([])
  })

  it('⚠️ the group closes after each meter — an unbalanced pair swallows the render', () => {
    const recorder = new SceneRecorder()
    drawMeter(recorder, ROWS)
    drawMeter(recorder, ROWS)
    // Two SIBLINGS, ⛔ not one nested inside the other.
    expect(recorder.scene.children).toHaveLength(2)
    expect(recorder.scene.children.every(c => c.kind === 'group')).toBe(true)
  })
})

describe('stampMeter — the ungrouped entry point', () => {
  it('⛔ opens NO group: a `TimeSigNote` draws inside the note’s own', () => {
    const recorder = new SceneRecorder()
    stampMeter(recorder, ROWS)
    expect(recorder.scene.children.every(c => c.kind === 'text'), 'bare text, no wrapper').toBe(true)
    expect(texts(recorder.scene)).toHaveLength(2)
  })
})
