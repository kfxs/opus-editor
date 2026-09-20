/**
 * ⭐⭐ **HOW FAR A BEAMED STEM RUNS — to the beam** — S7b of `docs/history/vexflow-removal-map.md`
 * (`Beam.applyStemExtensions`, MIT, transcribed).
 *
 * ## ⭐ What the rule IS
 *
 * > **Every stem in the group meets the beam line.** A stem that already reaches past it is shortened
 * > to it; a short one is lengthened. A stem pointing AGAINST the beam (a stem down under a beam over
 * > the staff) crosses the whole stack of beam lines and ends past the outermost one.
 *
 * The answer is the stem's new EXTENSION — what it adds to its default reach
 * (`engrave/notes/stemLength`) — because that is the one number the stem keeps.
 *
 * ## ⛔ What is NOT here
 *
 * - **Where the line is** — `./beamSlopeFit` (its slope and lift) and the beam's first y
 *   (`Beam.getBeamYToDraw`, S7c) arrive as a {@link BeamLine}.
 * - **The stroke stopping half its thickness short** (`Stem.adjustHeightForBeam`) — the STEM's
 *   state, still set by the adapter.
 * - **Stemlets** — the stub a beamed rest hangs from. VexFlow draws one only under
 *   `renderOptions.showStemlets`, which nothing in this editor sets.
 */
import { BEAM_LEVEL_STRIDE } from './beamLines'
import { beamLineYAt } from './beamSlopeFit'

/** The line every stem of the beam must reach, as `./beamSlopeFit` solved it. */
export interface BeamLine {
  /** The first stem's x — where the line's y is {@link firstY}. */
  firstStemX: number
  /** The line's y at the first stem, before the {@link lift}. */
  firstY: number
  /** Rise over run. */
  slope: number
  /** How far the whole line was moved to clear an inner stem. */
  lift: number
  /** The BEAM's stem direction: `1` up, `-1` down. */
  stemDirection: number
  /** One beam line's thickness, in px — unsigned. */
  beamWidth: number
}

/** What one beamed stem brings. */
export interface BeamedStem {
  stemX: number
  /** The stem's free end, as it stands now. @see `engrave/notes/stemLength` */
  tipY: number
  /** What the stem already adds to its default reach. */
  extension: number
  /** THIS note's stem direction — it may differ from the beam's. */
  stemDirection: number
  /** How many beam lines THIS note's own duration carries (1 = a quaver). */
  beamLevels: number
}

/** ⭐ The stem's new extension, so that its tip lands on the beam — see the module header. */
export function beamedStemExtension(stem: BeamedStem, line: BeamLine): number {
  const lineY = beamLineYAt(line.firstStemX, line.firstY, line.slope, stem.stemX) + line.lift
  const toLine = stem.stemDirection === 1 ? stem.tipY - lineY : lineY - stem.tipY
  const across = stem.stemDirection !== line.stemDirection
    ? (1 + (stem.beamLevels - 1) * BEAM_LEVEL_STRIDE) * line.beamWidth
    : 0
  return stem.extension + toLine + across
}
