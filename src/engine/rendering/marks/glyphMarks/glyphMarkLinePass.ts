/**
 * ⭐ **THE USER'S SYMBOLS JOIN THE LADDER** — the post-measure pass that moves every symbol from the
 * origin `./glyphMarkLayout` drew it at onto its row, stacking a note's several symbols outward
 * (docs/plans/symbol-plan.md P1, §4 (e) and (i)). `rendering/marks/tempo/tempoLinePass`'s twin, and a
 * TRANSLATE for that pass's reason: a symbol's row is a fact about its SYSTEM, so it runs over every
 * measure, drawn or reused, and the write is idempotent (the transform is SET, and the box moves by the change).
 *
 * ## Its rung — the order of the calls in `ScoreRenderer` IS the ladder
 *
 * Wired in AFTER the trills and the octave lines and BEFORE the tempo marks: LilyPond's `TextScript`
 * (priority 450 — the grob a free `\markup` on a note is) stands outside the trill (50), the dynamics
 * (250) and the ottava (400), inside the tempo (1300). So this pass READS what those three filed in
 * `pass.occupiedBands` and FILES its own claim, which the tempo pass then clears. ⛔ No priority table.
 *
 * ## What it reads for one stack
 *
 * The music's ink in the stack's own column (`layout/inkBand.columnsUnder` — a symbol belongs to its
 * note), merged with what the inner families took there (`layout/outsideStaffBand.bandOver`).
 * ⚠️ **A first cut, written down:** a symbol is placed against ITS column only, so a wide glyph (a
 * glockenspiel pictogram is 4.8 spaces) can reach over a neighbouring note's high ink, or a
 * neighbouring stack, without seeing it. The tempo pass has the same limitation for the same reason
 * (a width is a font measurement and a beat range needs the solved x's) — the first thing to fix if
 * his eye finds a case.
 *
 * Pure no-op without a DOM, like every pass that repositions rendered SVG.
 */
import type { EngravedStave } from '../../engraved/EngravedStave'
import type { Fraction, GlyphMark, Measure } from '@/types/music'
import type { Column } from '@/engine/layout/spacing'
import { columnsUnder, mergeInkBands, staffInkBand, type MarkInk, type StaffSide } from '@/engine/layout/inkBand'
import { bandOver, markBand, measureStartOffsets } from '@/engine/layout/outsideStaffBand'
import { glyphMarkStackBaselines } from '@/engine/layout/glyphMarkStack'
import { staffGlyphMarks } from '@/engine/models/staffContent'
import { glyphMarkOffsetOf } from '@/engine/models/glyphMarkOps'
import { fracAdd, fracCompare } from '@/utils/fraction'
import type { RenderPass } from '../../RenderPass'
import { staveFrame } from '../../staff/staveFrame'
import { staffSpacesToPixels } from '../../staff/staffSpace'
import { GLYPH_MARK_LINE, GLYPH_MARK_STACK_GAP, glyphMarkInk } from './glyphMarkStyle'
import { glyphMarkOriginLine } from './glyphMarkLayout'

/**
 * The move the pass last wrote on a symbol — `"dx,dy"` in local px, its row's lift plus its hand offset —
 * kept ON the element so a reused bar (whose group and registry box both still carry the old move) is
 * moved by the CHANGE, never twice (the tempo mark's `data-tempo-line`, and for its reason).
 */
const MOVE_ATTR = 'data-glyph-mark-move'

/** What the pass needs of a `MeasurePlacement` — declared structurally, as the tempo pass does. */
interface GlyphMarkLinePlacement {
  view: Measure
  measureNumber: number
  staffIndex: number
  /** Which system it is on: the scope of one row. */
  line: number
  system: { columns: Column[] }
  stave: EngravedStave
  /** This staff's drawn scale — the registry box is moved in the staff's own space. */
  scale: number
}

/** One note's symbols on one side — nearest the staff first, which is the order they were added. */
interface Stack {
  beat: Fraction
  side: StaffSide
  marks: { mark: GlyphMark; ink: MarkInk }[]
}

/** Group a lane's symbols into stacks, keeping the stored order inside each. Unknown glyphs are
 *  dropped here as they are at the draw — they have no ink to stand on anything. */
export function glyphMarkStacks(marks: readonly GlyphMark[]): Stack[] {
  const stacks: Stack[] = []
  for (const mark of marks) {
    const ink = glyphMarkInk(mark.glyph)
    if (!ink) continue
    const side: StaffSide = mark.placement === 'below' ? 'below' : 'above'
    let stack = stacks.find(s => s.side === side && fracCompare(s.beat, mark.beat) === 0)
    if (!stack) stacks.push(stack = { beat: mark.beat, side, marks: [] })
    stack.marks.push({ mark, ink })
  }
  return stacks
}

/** Put every symbol of every system onto its row, and file what each one takes. */
export function placeGlyphMarksOnLine(
  pass: RenderPass,
  placements: readonly GlyphMarkLinePlacement[],
  staffIds: readonly (string | undefined)[],
): void {
  const svg = pass.painter?.svg as SVGSVGElement | undefined
  if (!svg) return

  const starts = measureStartOffsets(pass.score)
  // ⭐ From the SCORE, ⛔ not `placement.view` — a preview's placements are older than the score
  //   (the tempo pass's 🚨 note, verbatim in its reason).
  const byNumber = new Map(pass.score.measures.map(m => [m.number, m]))
  const firstId = staffIds[0]

  for (const placement of placements) {
    const measure = byNumber.get(placement.measureNumber)
    if (!measure?.glyphMarks?.length) continue
    const staffId = staffIds[placement.staffIndex]
    const measureStart = starts.get(placement.measureNumber)
    if (measureStart === undefined) continue
    const frame = staveFrame(placement.stave)

    for (const stack of glyphMarkStacks(staffGlyphMarks(measure, staffId, pass.score))) {
      const at = fracAdd(measureStart, stack.beat)
      const music = staffInkBand(columnsUnder(placement.system.columns, stack.beat), staffId, firstId)
      const taken = bandOver(pass.occupiedBands, placement.line, staffId, stack.side, at, at, firstId)
      const inks = stack.marks.map(m => m.ink)
      const baselines = glyphMarkStackBaselines(
        mergeInkBands(music, taken), stack.side, inks, GLYPH_MARK_LINE, GLYPH_MARK_STACK_GAP)

      stack.marks.forEach(({ mark, ink }, i) => {
        // ⭐ The hand offset (P4) rides ON the row, in staff spaces: the stack is laid out from the rows
        //   alone, so nudging one symbol never moves its neighbours.
        const offset = glyphMarkOffsetOf(pass.score, mark.id)
        const ox = offset?.x ?? 0
        const oy = offset?.y ?? 0
        // Scoped to THIS render's root — ids repeat across a torn-down SVG.
        const el = svg.querySelector(`[id="${mark.id}"]`)
        if (el) {
          const dx = staffSpacesToPixels(ox, frame)
          const dy = staffSpacesToPixels(baselines[i] + oy - glyphMarkOriginLine(mark), frame)
          const [wasX, wasY] = (el.getAttribute(MOVE_ATTR) ?? '0,0').split(',').map(n => Number(n) || 0)
          el.setAttribute(MOVE_ATTR, `${dx},${dy}`)
          el.setAttribute('transform', `translate(${dx}, ${dy})`)
          pass.elementRegistry.withScale(placement.scale, () => pass.elementRegistry.shiftById(mark.id, dx - wasX, dy - wasY))
        }
        // What it TAKES is where it ends up — its row plus its vertical nudge.
        pass.occupiedBands.push({
          line: placement.line, staffId, side: stack.side, from: at, to: at, band: markBand(baselines[i] + oy, ink),
        })
      })
    }
  }
}
