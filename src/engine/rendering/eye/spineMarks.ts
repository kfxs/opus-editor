/**
 * ⭐⭐ **DYNAMICS, EXPRESSION WORDS AND TEMPO MARKS ON A SPINE** — port map #16 of
 * `docs/plans/bent-staff-plan.md`: marks that stand on a LANE, an offset from the path.
 *
 * ## How
 *
 * ⛔ Nothing is re-decided. Each answer is the page's, asked with the spine's numbers:
 *
 * - **WHICH line a dynamic sits on** — `marks/dynamics/dynamicsLinePlan.planDynamicsLines`, the page's
 *   whole plan (the local rule over the ink under the mark, the chains levelled), handed each bar's
 *   COLUMNS as the spine spaced them (`./spineSpacing`) — one system, line 0.
 * - **WHICH row a tempo mark sits on** — the page's `clearanceBaseline` with `TEMPO_LINE`, over the
 *   music from its beat to the bar's end (`tempoLinePass.tempoScope`), merged with what the dynamics plan
 *   claimed above the staff (`bandOver` — the LADDER, as on the page).
 * - **WHERE along the path** — a dynamic hangs off the slot `anchorSlotIndex` names (the page's
 *   fall-forward, any voice, a sounding slot before a rest), at its head's centre: a pure LEVEL is centred
 *   on it by its INK, prose is anchored there and runs right (`dynamicMarkAnchor`), marks sharing a beat
 *   are laid out as one ROW (`DynamicsLayout.layoutCoLocatedDynamics`). A tempo mark aligns its left
 *   with the meter's left edge on a downbeat that prints one, else with the first element at-or-after its
 *   beat, else — an empty bar, a whole-bar rest — where the bar's music starts (Gould p. 183,
 *   `TempoLayout.anchorX`).
 * - **The hand's nudges** — `dynamicOffset` (+ down) and `tempoOffset` (+ UP), staff spaces, added last.
 *
 * ⭐ A dynamic's GLYPHS (`p`, `mf`) are rigid pieces; its WORDS (`dolce`, `cresc.`) FOLLOW the spine, each
 * letter a piece turned where it stands (his ask, 2026-09-26: *"the text should not be rect but follow the
 * spine"*). Pieces are laid out along the LANE's own arc, so a word keeps its letter spacing at any depth.
 * A TEMPO mark the same (his word, the same hour: *"probably for tempo too"*) — its ♩ a rigid piece.
 *
 * ## What is NOT here — yet
 *
 * - Hairpins (port map #15) — the plan already levels them; the spine does not draw them.
 * - A mark INSIDE a loop stands on a shorter arc than `s` says; a long word there is not re-spaced.
 * - Registration, selection, the guide line: the panel cannot be clicked into (B3).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { compose, translation } from '@/engine/paint/Affine'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { innerLengthRatio, placementAt } from '@/engine/engrave/staff/staffSpine'
import { clearanceBaseline, columnsBetween, mergeInkBands, staffInkBand } from '@/engine/layout/inkBand'
import { bandOver, measureStartOffsets, type OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import { dynamicOffsetOverrideOf, tempoOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { firstStaffId } from '@/engine/models/staffContent'
import type { ChordRest, Dynamic, Measure, Score, TempoMark } from '@/types/music'
import { composeDynamicGlyphs, dynamicLabel, splitDynamicRuns } from '@/utils/dynamics'
import { fracAdd, fracCompare } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { INK } from '@/engine/layout/spacingPadding'
import { drawGlyph, drawTextRun, measureGlyphMetrics, measureTextRun, type TextRunFont } from '../painter/glyphPainter'
import { anchorSlotIndex } from '../marks/dynamics/DynamicsLayout'
import { dynamicMarkAnchorShift } from '../marks/dynamics/dynamicMarkAnchor'
import { planDynamicsLines } from '../marks/dynamics/dynamicsLinePlan'
import { markInk } from '../marks/dynamics/dynamicsLinePass'
import { dynamicGlyphSizePt, dynamicTextSizePt, expressionTextFamily } from '../marks/dynamics/dynamicStyle'
import { tempoTextRuns } from '../marks/tempo/TempoLayout'
import { TEMPO_LINE, tempoMarkInk } from '../marks/tempo/tempoStyle'
import { drawGroupOf } from '../painter/svgDrawGroup'
import type { SpineBar } from './spineSpacing'

/** The class of a mark's block — what a scene reader (and the spec) finds them by. */
export const SPINE_MARK_CLASS = 'spine-mark'

/** The page's gap between two marks sharing a beat (`DynamicsLayout.layoutCoLocatedDynamics`), px. ⚠️ A copy of
 *  a private literal; the page's is the source. */
const CO_LOCATED_GAP_PX = 6

/** One bar as the spine drew it — what the marks are placed from. */
export interface SpineMarkBar {
  /** The first staff's LANE of the bar (`staffMeasureView`): its slots and dynamics are that staff's. */
  view: Measure
  /** The bar's own tempo marks — a tempo mark governs the clock, so it is not a lane's. */
  tempos: readonly TempoMark[]
  bar: SpineBar
  /** Where the header's meter begins, when this bar prints one. */
  meterAt?: number
}

/** A run of a mark's text, measured: how it is drawn at a point, and how far its ink reaches. */
interface MeasuredRun {
  advance: number
  /** Ink left of the run's origin (positive = overhangs to the left), and right of it. */
  left: number
  right: number
  /**
   * What is placed as one rigid piece: a GLYPH run is one (a `p`, a precomposed `fff`); a WORD run is one
   * piece per LETTER, each at its offset from the run's origin — ⭐ his ask (2026-09-26): expression text
   * FOLLOWS the spine rather than standing straight on it.
   */
  pieces: readonly RunPiece[]
}

interface RunPiece {
  /** From the run's origin to the piece's, px along the lane. */
  offset: number
  advance: number
  draw(ctx: DrawContext, x: number, y: number): void
}

const GLYPH_TAG = 'SpineMarks.dynamicGlyph'
const TEXT_TAG = 'SpineMarks.dynamicText'

/** The words' face — the expression italic at the text size (`dynamicStyle`). */
function wordsFont(): TextRunFont {
  return { family: expressionTextFamily(), sizePt: dynamicTextSizePt(), style: 'italic' }
}

/**
 * A dynamic's text as the page draws it (`DynamicsLayout.enlargeDynamicGlyphRuns`): each glyph run in the
 * music font at the GLYPH size, precomposed (`fff` is one glyph), each word run in the italic at the text
 * size — all on ONE baseline.
 */
function measureDynamicRuns(dyn: Dynamic): MeasuredRun[] {
  return splitDynamicRuns(dynamicLabel(dyn)).map(run => {
    if (run.glyph) {
      const glyph = composeDynamicGlyphs(run.text)
      const m = measureGlyphMetrics(GLYPH_TAG, glyph, dynamicGlyphSizePt())
      return {
        advance: m.width, left: m.left, right: m.right,
        pieces: [{ offset: 0, advance: m.width, draw: (ctx, x, y) => { drawGlyph(ctx, GLYPH_TAG, glyph, x, y, dynamicGlyphSizePt()) } }],
      }
    }
    // SVG collapses whitespace at a run's edges; a non-breaking space survives (as on the page).
    const text = run.text.replace(/ /g, ' ')
    const m = measureTextRun(TEXT_TAG, text, wordsFont())
    return { advance: m.width, left: m.left, right: m.right, pieces: letterPieces(TEXT_TAG, text, wordsFont()) }
  })
}

/**
 * ⭐ A run of WORDS as one piece per letter. Each letter stands where the WHOLE run's layout puts it — the
 * width of the text before it — so the font's kerning between letters survives the split.
 */
function letterPieces(tag: string, text: string, font: TextRunFont): RunPiece[] {
  const letters = [...text]
  const before = (n: number) => measureTextRun(tag, letters.slice(0, n).join(''), font).width
  return letters.flatMap((letter, n) => {
    const offset = before(n)
    const advance = before(n + 1) - offset
    if (letter.trim() === '') return [] // a space is room, not ink
    return [{ offset, advance, draw: (ctx: DrawContext, x: number, y: number) => { drawTextRun(ctx, tag, letter, x, y, font) } }]
  })
}

/** A tempo mark's runs (`TempoLayout.tempoTextRuns` — the page's faces, sizes and ♩ raise), as pieces. */
function tempoPieceRuns(text: string): Pick<MeasuredRun, 'advance' | 'pieces'>[] {
  return tempoTextRuns(text).map(run => run.glyph !== undefined
    ? { advance: run.advance, pieces: [{ offset: 0, advance: run.advance, draw: (ctx: DrawContext, x: number, y: number) => { drawGlyph(ctx, run.tag, run.glyph, x, y - run.raise, run.sizePt) } }] }
    : { advance: run.advance, pieces: letterPieces(run.tag, run.text, run.font) })
}

/**
 * Draw `runs` end to end from lane x `x`, on baseline `y`, every piece placed on the spine where it stands —
 * so the mark FOLLOWS the path. ⭐ Laid out along the LANE, not along `s`: at depth `y` the lane's arc is
 * `ratio` of the spine's (`innerLengthRatio` — shorter inside a loop, longer outside), so a lane distance is
 * `1 / ratio` of `s`. Placed along `s` unmapped, `p dolce` inside the loop slid together (seen 2026-09-26).
 */
function drawRunsAlongLane(
  ctx: DrawContext, spine: Spine, s0: number, x: number, y: number, runs: readonly Pick<MeasuredRun, 'advance' | 'pieces'>[],
): void {
  const ratio = innerLengthRatio(spine, y)
  let at = x
  for (const run of runs) {
    for (const piece of run.pieces) {
      const px = at + piece.offset
      placePiece(ctx, spine, s0, ratio, px, piece.advance, () => piece.draw(ctx, px, y))
    }
    at += run.advance
  }
}

/** Where a mark's runs reach, laid end to end from origin 0: its ink's left and right, and its advance. */
function inkOf(runs: readonly MeasuredRun[]): { left: number; right: number; advance: number } {
  let x = 0
  let left = Infinity
  let right = -Infinity
  for (const run of runs) {
    left = Math.min(left, x - run.left)
    right = Math.max(right, x + run.right)
    x += run.advance
  }
  return Number.isFinite(left) ? { left, right, advance: x } : { left: 0, right: 0, advance: x }
}

/** The class of one rigidly placed PIECE of a mark — a glyph run, or one letter of a word. */
export const SPINE_MARK_PIECE_CLASS = 'spine-mark-piece'

/**
 * Draw one piece upright at lane x `[x, x + advance]` and place it on the spine by its MIDDLE, at the `s`
 * that lane distance maps to (`s0 + x / ratio`): a letter of a word turns with the path where it stands,
 * so the word FOLLOWS the curve.
 */
function placePiece(
  ctx: DrawContext, spine: Spine, s0: number, ratio: number, x: number, advance: number, paint: () => void,
): void {
  const group = drawGroupOf(ctx.openGroup(SPINE_MARK_PIECE_CLASS))
  try {
    paint()
  } finally {
    ctx.closeGroup()
  }
  const middle = x + advance / 2
  group?.setPlacement(compose(translation(-middle, 0), placementAt(spine, s0 + middle / ratio)))
}

/** `s` of a lane's slot — a whole-bar rest stands in the MIDDLE of its bar, as on the page. */
function slotS(bar: SpineBar, slot: ChordRest): number {
  return slot.type === 'rest' && slot.isMeasureRest ? (bar.start + bar.end) / 2 : bar.columnAt(slot.beat)
}

/**
 * ⭐ Draw every dynamic and expression word of the first staff, and every tempo mark, of the bars the spine
 * drew. Call AFTER the notes: the line reads the columns, not the drawn ink, but the order is the page's.
 */
export function drawSpineMarks(ctx: DrawContext, spine: Spine, score: Score, bars: readonly SpineMarkBar[]): void {
  const staffIds = [firstStaffId(score)]
  const occupied: OccupiedSpan[] = []

  // ── DYNAMICS — the page's plan, the spine being ONE system ──
  const plan = planDynamicsLines(
    score,
    bars.map(b => ({ view: b.view, measureNumber: b.view.number, staffIndex: 0, line: 0, system: { columns: [...b.bar.columns] } })),
    staffIds, markInk(), occupied,
  )
  for (const { view, bar } of bars) {
    const dynamics = view.dynamics ?? []
    if (dynamics.length === 0 || view.slots.length === 0) continue
    // Marks sharing a beat are laid out as a ROW, and that row owns their x.
    const rows = new Map<string, Dynamic[]>()
    for (const dyn of dynamics) {
      const key = `${dyn.beat.num}/${dyn.beat.den}`
      rows.set(key, [...(rows.get(key) ?? []), dyn])
    }
    for (const row of rows.values()) {
      // Every mark of a row shares its beat, so its slot and its `s`.
      const index = anchorSlotIndex(view.slots, row[0].beat)
      const slot = view.slots[index >= 0 ? index : view.slots.length - 1]
      if (!slot) continue
      const measured = row.map(dyn => { const runs = measureDynamicRuns(dyn); return { dyn, runs, ink: inkOf(runs) } })
      // The page centres a row on its FIRST mark's centre, drawn left-justified at the head.
      const centre = (measured[0].ink.left + measured[0].ink.right) / 2
      const total = measured.reduce((sum, m) => sum + (m.ink.right - m.ink.left), 0) + CO_LOCATED_GAP_PX * (measured.length - 1)
      let cursor = 0
      const placed = measured.flatMap(({ dyn, runs, ink }) => {
        const baseline = plan.get(dyn.id)
        let x = measured.length > 1
          ? centre - total / 2 + cursor - ink.left
          : dynamicMarkAnchorShift(dyn, { left: ink.left, width: ink.right - ink.left }, false)
        cursor += ink.right - ink.left + CO_LOCATED_GAP_PX
        if (baseline === undefined) return []
        let y = baseline * STAFF_SPACE_PX
        const off = dynamicOffsetOverrideOf(score, dyn.id)
        if (off) { x += off.x * STAFF_SPACE_PX; y += off.y * STAFF_SPACE_PX }
        return [{ runs, ink, x, y }]
      })
      if (placed.length === 0) continue
      ctx.openGroup(SPINE_MARK_CLASS, `dynamic-${row.map(dyn => dyn.id).join('+')}`)
      try {
        for (const { runs, x, y } of placed) drawRunsAlongLane(ctx, spine, slotS(bar, slot), x, y, runs)
      } finally {
        ctx.closeGroup()
      }
    }
  }

  // ── TEMPO — the row above, clearing the music and what the dynamics claimed there ──
  const starts = measureStartOffsets(score)
  for (const { view, tempos, bar, meterAt } of bars) {
    const measureStart = starts.get(view.number)
    if (measureStart === undefined) continue
    for (const mark of tempos) {
      if (!mark.text) continue // a mark that only sounds prints nothing
      const to = measureCapacityFrac(view)
      const music = staffInkBand(columnsBetween(bar.columns, mark.beat, to), staffIds[0], staffIds[0])
      const taken = bandOver(occupied, 0, staffIds[0], 'above', fracAdd(measureStart, mark.beat), fracAdd(measureStart, to), staffIds[0])
      const baseline = clearanceBaseline(mergeInkBands(music, taken), 'above', tempoMarkInk(), TEMPO_LINE)
      const s = tempoAnchorS(view.slots, bar, mark, meterAt)
      const off = tempoOffsetOverrideOf(score, mark.id)
      const x = (off?.x ?? 0) * STAFF_SPACE_PX
      const y = baseline * STAFF_SPACE_PX - (off?.y ?? 0) * STAFF_SPACE_PX // + UP
      ctx.openGroup(SPINE_MARK_CLASS, `tempo-${mark.id}`)
      try {
        drawRunsAlongLane(ctx, spine, s, x, y, tempoPieceRuns(mark.text))
      } finally {
        ctx.closeGroup()
      }
    }
  }
}

/**
 * ⭐ Gould p. 183 on the spine (`TempoLayout.anchorX`): the meter's left edge on a downbeat that prints one;
 * else the first element at-or-after the beat (its head's LEFT); else — an empty bar, a whole-bar rest —
 * where the bar's music starts, ⛔ never the barline.
 */
function tempoAnchorS(slots: readonly ChordRest[], bar: SpineBar, mark: TempoMark, meterAt: number | undefined): number {
  if (meterAt !== undefined && mark.beat.num === 0) return meterAt
  const next = [...slots]
    .filter(slot => fracCompare(slot.beat, mark.beat) >= 0)
    .sort((a, b) => fracCompare(a.beat, b.beat))[0]
  if (!next || (next.type === 'rest' && next.isMeasureRest)) return bar.musicStart
  return bar.columnAt(next.beat) - (INK.notehead / 2) * STAFF_SPACE_PX
}
