/**
 * ⭐⭐ **WHICH X'S EACH BEAM LINE RUNS BETWEEN** — S7d of `docs/history/vexflow-removal-map.md`
 * (`Beam.getBeamLines` + `Beam.lookupBeamDirection`, MIT, transcribed).
 *
 * ## ⭐ What the rule IS
 *
 * > **A beam line joins every run of neighbours short enough to carry it.** A note that carries the
 * > line alone gets a FRACTIONAL beam instead — pointing into the group at either end, and, in the
 * > middle, whichever way it was told (`./fractionalBeam`) or else toward the neighbour that is
 * > nearest to carrying it. A secondary break ends every line past the primary at that note.
 *
 * One call answers one LEVEL. ⚠️ A level is named by the note value its notes must be SHORTER than
 * ({@link BeamLevelInput.levelDenominator}): `4` is the PRIMARY beam (every quaver and shorter), `8`
 * the first secondary (semiquavers and shorter), and so on.
 *
 * ## ⛔ What is NOT here
 *
 * - **Which way an interior fractional beam points by the METRE** — `./fractionalBeam`; it arrives
 *   as {@link BeamLevelInput.forcedSides}.
 * - **Where the breaks are** — `utils/beaming.secondaryBreakIndices`; they arrive as indices.
 * - **The y's** — the slope, `./beamSlopeFit`.
 *
 * ⚠️ Transcribed with VexFlow's quirks intact, because tidying any of them moves a stub:
 * - a stub is measured from the line's START x, so a LEFT stub ends `length` left of its stem;
 * - a line that runs to its last note and was broken there by a secondary break is NOT given a
 *   stub (its end was just set, so the `end === undefined` test never passes);
 * - the recursion for an interior stub asks each coarser level in turn and gives up LEFT at the primary.
 *
 * ⏸️ **TODO / REVIEW after the VexFlow removal** (`docs/history/vexflow-removal-map.md` §9.4 #1): the two
 * secondary-BREAK branches never read {@link BeamLevelInput.forcedSides}, so the beat rule
 * (`./fractionalBeam`) does not reach a note next to a break — and a group's FIRST note with a break
 * right after it points LEFT, out of the group. Kept as VexFlow drew it: fixing it moves stubs.
 */

/**
 * ⭐ **A fractional beam's length, in px — 1 staff space.** Taken from `Beam.renderOptions`'
 * `partialBeamLength` = 10 (`beam.js:323`). ⏳ **Open (decision A of `docs/research/beam-hook-research.md` §8)**:
 * every source says *one notehead* — Gould's plate 0.97 of one, Bravura's black head 1.18 sp,
 * MuseScore and LilyPond 1.1 — and this is the default until that is decided.
 */
export const FRACTIONAL_BEAM_LENGTH_PX = 10

/** VexFlow's tick unit: a whole note (`Tables.RESOLUTION`). The note values below are counted in it. */
export const TICKS_PER_WHOLE = 16384

/**
 * The side a fractional beam points — VexFlow's `PartialBeamDirection` letters. ⚠️ `'B'` (both) is a
 * legal answer and a legal thing to be told, and it draws LEFT.
 */
export type BeamSide = 'L' | 'R' | 'B'

/** What one note brings to the walk. */
export interface BeamLevelNote {
  /** Where its beam lines start: the stem's x less half its stroke (`./beamLines.beamLineStartX`). */
  lineX: number
  /** The note's SOUNDING ticks (a tuplet's are scaled) — only the {@link BeamLevelInput.secondaryBreakTicks} tally reads them. */
  ticks: number
  /** The note's WRITTEN ticks — what decides whether it carries a level. */
  intrinsicTicks: number
}

export interface BeamLevelInput {
  notes: readonly BeamLevelNote[]
  /** The level, as the note value its notes must be shorter than: 4, 8, 16, 32, 64. */
  levelDenominator: number
  /** Notes a secondary beam breaks AT (`Beam.breakSecondaryAt`). ⚠️ Only levels past the primary read it. */
  breakIndexes: readonly number[]
  /** An interior fractional beam's side, by note index (`Beam.setPartialBeamSideAt`). */
  forcedSides: ReadonlyMap<number, BeamSide>
  /** Break every secondary line after this many sounding ticks. ⚠️ Nothing in this editor sets it. */
  secondaryBreakTicks?: number
  /** @see FRACTIONAL_BEAM_LENGTH_PX */
  fractionalLength: number
}

export interface BeamLineSpan {
  start: number
  end: number
}

const ticksOf = (denominator: number): number => TICKS_PER_WHOLE / denominator

/**
 * ⭐ Which way an INTERIOR note's fractional beam points at this level — `Beam.lookupBeamDirection`.
 */
function fractionalSide(
  denominator: number, prevTick: number, tick: number, nextTick: number, index: number,
  forcedSides: ReadonlyMap<number, BeamSide>,
): BeamSide {
  if (denominator === 4) return 'L'
  const forced = forcedSides.get(index)
  if (forced) return forced
  const coarser = denominator / 2
  const prevGets = prevTick < ticksOf(coarser)
  const nextGets = nextTick < ticksOf(coarser)
  const gets = tick < ticksOf(coarser)
  if (prevGets && nextGets && gets) return 'B'
  if (prevGets && !nextGets && gets) return 'L'
  if (!prevGets && nextGets && gets) return 'R'
  return fractionalSide(coarser, prevTick, tick, nextTick, index, forcedSides)
}

/** ⭐ Every line of one level — see the module header. */
export function beamLineSpans(input: BeamLevelInput): BeamLineSpan[] {
  const { notes, levelDenominator, breakIndexes, forcedSides, secondaryBreakTicks, fractionalLength } = input
  const levelTicks = ticksOf(levelDenominator)
  let started = false
  const lines: { start: number; end: number | undefined }[] = []
  let previousBreak = false
  let tally = 0

  for (let i = 0; i < notes.length; ++i) {
    const note = notes[i]
    tally += note.ticks
    let breaks = false
    if (levelDenominator >= 8) {
      breaks = breakIndexes.indexOf(i) !== -1
      if (secondaryBreakTicks && tally >= secondaryBreakTicks) {
        tally = 0
        breaks = true
      }
    }
    const gets = note.intrinsicTicks < levelTicks
    const x = note.lineX
    const prev = notes[i - 1]
    const next = notes[i + 1]
    const nextGets = next && next.intrinsicTicks < levelTicks
    const prevGets = prev && prev.intrinsicTicks < levelTicks
    const alone = prev && next && gets && !prevGets && !nextGets

    if (gets) {
      if (started) {
        const line = lines[lines.length - 1]
        line.end = x
        if (breaks) {
          started = false
          if (next && !nextGets && line.end === undefined) line.end = line.start - fractionalLength
        }
      } else {
        const line: { start: number; end: number | undefined } = { start: x, end: undefined }
        started = true
        if (alone && prev && next) {
          const side = fractionalSide(
            levelDenominator, prev.intrinsicTicks, note.intrinsicTicks, next.intrinsicTicks, i, forcedSides,
          )
          line.end = side === 'R' ? line.start + fractionalLength : line.start - fractionalLength
        } else if (!nextGets) {
          line.end = (previousBreak || i === 0) && next
            ? line.start + fractionalLength
            : line.start - fractionalLength
        } else if (breaks) {
          line.end = line.start - fractionalLength
          started = false
        }
        lines.push(line)
      }
    } else {
      started = false
    }
    previousBreak = breaks
  }

  const last = lines[lines.length - 1]
  if (last && last.end === undefined) last.end = last.start - fractionalLength
  // ⚠️ Every line has an end by now: an open one is always the LAST (a later note either extends it
  // or closes it), and the line above closes that one.
  return lines as BeamLineSpan[]
}
