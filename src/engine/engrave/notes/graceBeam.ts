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
import type { BeamMode, NoteDuration } from '@/types/music'
import { NOTE_DURATION_ROWS } from '../inheritedDefaults'
import { durationToFraction } from '@/utils/durations'
import { fracToNumber } from '@/utils/fraction'
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
  /** The staff line (VexFlow's: 1 = a space) of the head NEAREST the beam — the highest stems up, the
   *  lowest stems down. */
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
  /** The group's stems: `1` up (the default), `-1` down — P6's flip. */
  stemDirection?: number
}

export interface GraceBeam {
  /** Each stem's new tip — ON the beam line — grace px, in note order. */
  tipYs: number[]
  /** Every line of the beam. */
  lines: BeamLineInk[]
  /** One line's thickness, SIGNED as the page's is — the lines stack toward the heads either way. */
  thickness: number
  /** Rise over run — what the slash on it is tilted by (P2c). */
  slope: number
}

/**
 * ⭐ **Which graces of a group share a beam** — runs of consecutive FLAGGED graces (an 8th or shorter,
 * `NOTE_DURATION_ROWS[d].flag`); a quarter, half or whole breaks the run, and a run of one keeps its
 * flag. @returns each run's indexes into the group, two or more long.
 *
 * ⭐ **The AUTHORED beam is honoured** (`GraceNote.beam`: single / begin / continue / end — the beam keys').
 *
 * ⭐ **A grace carrying a BRACKETED grace starts a new run** (`docs/plans/bracketed-grace-plan.md` B4, his
 * call: *"the bracket break the group so now there are two groups … it makes sense that we have diferent
 * beaming"*). The split is DRAWN, not stored: the group stays one, so removing the bracket joins the
 * beam again with nothing owed.
 */
export function graceBeamRuns(
  notes: readonly { duration: NoteDuration; bracketedBefore?: readonly unknown[]; beam?: BeamMode }[],
): number[][] {
  const runs: number[][] = []
  let run: number[] = []
  notes.forEach((note, i) => {
    // ⭐ The AUTHORED beam, as a note's (his report, 2026-09-23): `begin` / `single` break in front of this
    //    grace, an `end` / `single` on the one before breaks behind it — and `continue` overrides the
    //    bracketed grace's split, joining the grace before it anyway.
    const prev = i > 0 ? notes[i - 1].beam : undefined
    const split = !!note.bracketedBefore?.length && note.beam !== 'continue'
    const breakHere = split || note.beam === 'begin' || note.beam === 'single' || prev === 'end' || prev === 'single'
    if (breakHere && run.length) {
      if (run.length > 1) runs.push(run)
      run = []
    }
    if (note.beam === 'single') {
      if (run.length > 1) runs.push(run)
      run = []
      return
    }
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
  // The table's exact quarters, a quarter being a quarter of a whole's ticks — ⛔ not a parse of the
  // duration's NAME, which a breve (`'breve'`) does not have a number in.
  return fracToNumber(durationToFraction(duration, dots)) * (TICKS_PER_WHOLE / 4)
}

/** ⭐ One run's beam — see the module header. The run must be two or more graces, in order. */
export function graceBeam(input: GraceBeamInput): GraceBeam {
  const { notes, space, beamWidth } = input
  const dir = input.stemDirection ?? 1
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
    stemDirection: dir,
    notes: notes.map(n => ({ stemX: n.stemX, tipY: n.tipY, counts: true })),
    range,
  })

  // Every stem to the line — its new tip is the line's y at its x.
  const line = { firstStemX: first.stemX, firstY: first.tipY, slope, lift, stemDirection: dir, beamWidth }
  // An extension lengthens the stem AWAY from its head: up for stems up, down for stems down.
  const tipYs = notes.map((n, i) =>
    n.tipY - dir * beamedStemExtension({ stemX: n.stemX, tipY: n.tipY, extension: 0, stemDirection: dir, beamLevels: levels[i] }, line))

  // The lines, level by level — the page's spans, so an 8th + 16th draws a fractional beam by its rule.
  const thickness = beamWidth * dir
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
  return { tipYs, lines, thickness, slope }
}

