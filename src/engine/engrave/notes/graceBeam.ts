/**
 * ⭐⭐ **A GRACE GROUP'S BEAM** — `docs/plans/grace-notes-plan.md` P2b. Pure: which graces beam, where
 * the line runs, how far each stem reaches it, and the quads — ⭐ every answer the PAGE's own beam rule
 * (`engrave/beams/`), fed plain numbers; ⛔ not `EngravedBeam`, which is built on `EngravedNote`s a
 * grace does not have. Chained exactly as `EngravedBeam` chains them: the slope BUDGET (`beamSlope`, the
 * rule HE arms — the caller hands it in) → the slope (`beamSlopeFit`) → each stem to the line
 * (`beamedStems`) → the x's each level runs between (`beamLineSpans`) → the quads (`beamLines`).
 *
 * ⭐ **In the GRACE's own px** — the coordinates inside its `scaling(k)` group, where a grace is drawn
 * as a full-size note — so the slope rule sees an ordinary beam, and the transform makes it *"thinner
 * by the size factor"* (Gould p. 125) with no row of its own. Its staff space is the page's.
 *
 * ⛔ **Never joined to the principal** (all three engines, research §0.4): a run is graces only.
 */
import type { NoteDuration } from '@/types/music'
import { NOTE_DURATION_ROWS } from '../inheritedDefaults'
import { beamRiseCap, type BeamSlopeRuleName } from '../beams/beamSlope'
import { beamLineYAt, fitBeamSlope } from '../beams/beamSlopeFit'
import { beamedStemExtension } from '../beams/beamedStems'
import { beamLineSpans, FRACTIONAL_BEAM_LENGTH_PX, TICKS_PER_WHOLE } from '../beams/beamLineSpans'
import { beamLevelY, beamLineStartX, type BeamLineInk } from '../beams/beamLines'

/** A grace as its beam sees it. */
export interface GraceBeamNote {
  duration: NoteDuration
  dots?: number
  /** The stem's x — grace px. */
  stemX: number
  /** The stem's free end before the beam (`graceRoom.graceStemSpaces` past the highest head) — grace px. */
  tipY: number
  /** The staff line (VexFlow's: 1 = a space) of the head NEAREST the beam — the highest, stems up. */
  beamSideLine: number
}

export interface GraceBeamInput {
  notes: readonly GraceBeamNote[]
  /** The page's staff space, px — the grace's own space inside its group. */
  space: number
  /** The slope rule the page runs (`beamSlopeExperiment.armedBeamSlopeRule`, his knob). */
  rule: BeamSlopeRuleName
  /** One beam line's thickness, px (`beamInk.crossSystemBeamWidth`). */
  beamWidth: number
  /** A stem's stroke, grace px — where a beam line starts (`beamLines.beamLineStartX`). */
  stemWidth: number
  /** The page beam's closing overshoot past its last stem (`EngravedBeam`'s), px. */
  endOvershoot?: number
}

export interface GraceBeam {
  /** Each stem's new tip — ON the beam line — grace px, in note order. */
  tipYs: number[]
  /** Every line of the beam. */
  lines: BeamLineInk[]
  /** One line's thickness, SIGNED as the page's is (stems up ⇒ the lines stack toward the heads). */
  thickness: number
}

/** Stems UP (the group's `stemDirection`, P1: always up until P6's `X`). */
const STEM_UP = 1

/**
 * ⭐ **Which graces of a group share a beam** — runs of consecutive FLAGGED graces (an 8th or shorter,
 * `NOTE_DURATION_ROWS[d].flag`); a quarter, half or whole breaks the run, and a run of one keeps its
 * flag. @returns each run's indexes into the group, two or more long.
 */
export function graceBeamRuns(notes: readonly { duration: NoteDuration }[]): number[][] {
  const runs: number[][] = []
  let run: number[] = []
  notes.forEach((note, i) => {
    if (NOTE_DURATION_ROWS[note.duration].flag) run.push(i)
    else {
      if (run.length > 1) runs.push(run)
      run = []
    }
  })
  if (run.length > 1) runs.push(run)
  return runs
}

/** Is the grace at `index` beamed — so it draws no flag, and its dot has no flag to clear? */
export function isBeamedGrace(notes: readonly { duration: NoteDuration }[], index: number): boolean {
  return graceBeamRuns(notes).some(run => run.includes(index))
}

/** A grace's written ticks — what decides whether it carries a level (`beamLineSpans`). */
function writtenTicks(duration: NoteDuration, dots = 0): number {
  const base = duration === 'w' ? TICKS_PER_WHOLE : duration === 'h' ? TICKS_PER_WHOLE / 2
    : duration === 'q' ? TICKS_PER_WHOLE / 4 : TICKS_PER_WHOLE / Number(duration)
  return base * (2 - 1 / 2 ** dots)
}

/** ⭐ One run's beam — see the module header. The run must be two or more graces, in order. */
export function graceBeam(input: GraceBeamInput): GraceBeam {
  const { notes, space, beamWidth } = input
  const first = notes[0]
  const last = notes[notes.length - 1]
  const levels = notes.map(n => NOTE_DURATION_ROWS[n.duration].beamCount ?? 0)
  const widthSpaces = Math.abs(last.stemX - first.stemX) / space

  // The slope: the page's rule gives the BUDGET, the fit picks the cheapest slope inside it.
  const range = widthSpaces > 0
    ? beamRiseCap({
      intervalSteps: Math.abs(last.beamSideLine - first.beamSideLine) * 2,
      widthSpaces,
      noteCount: notes.length,
      naturalRiseSpaces: Math.abs(last.tipY - first.tipY) / space,
      beamCount: Math.max(...levels),
    }, input.rule) / widthSpaces
    : 0
  const { slope, lift } = fitBeamSlope({
    stemDirection: STEM_UP,
    notes: notes.map(n => ({ stemX: n.stemX, tipY: n.tipY, counts: true })),
    range,
  })

  // Every stem to the line — its new tip is the line's y at its x.
  const line = { firstStemX: first.stemX, firstY: first.tipY, slope, lift, stemDirection: STEM_UP, beamWidth }
  const tipYs = notes.map((n, i) =>
    n.tipY - beamedStemExtension({ stemX: n.stemX, tipY: n.tipY, extension: 0, stemDirection: STEM_UP, beamLevels: levels[i] }, line))

  // The lines, level by level — the page's spans, so an 8th + 16th draws a fractional beam by its rule.
  const thickness = beamWidth * STEM_UP
  const firstLevelY = tipYs[0]
  const lines: BeamLineInk[] = []
  const spanNotes = notes.map(n => {
    const ticks = writtenTicks(n.duration, n.dots)
    return { lineX: beamLineStartX(n.stemX, input.stemWidth), ticks, intrinsicTicks: ticks }
  })
  for (let level = 0; level < Math.max(...levels); level++) {
    const y = beamLevelY(firstLevelY, level, thickness)
    for (const span of beamLineSpans({
      notes: spanNotes,
      levelDenominator: 4 * 2 ** level,
      breakIndexes: [],
      forcedSides: new Map(),
      fractionalLength: FRACTIONAL_BEAM_LENGTH_PX,
    })) {
      lines.push({
        startX: span.start,
        startY: beamLineYAt(first.stemX, y, slope, span.start),
        endX: span.end + (input.endOvershoot ?? 0),
        endY: beamLineYAt(first.stemX, y, slope, span.end),
      })
    }
  }
  return { tipYs, lines, thickness }
}

