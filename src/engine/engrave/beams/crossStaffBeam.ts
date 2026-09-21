/**
 * ⭐⭐ **A BEAM BETWEEN TWO STAVES** — docs/plans/cross-staff-plan.md Phase 4. A beam group whose
 * chords are written on two staves: which way each stem points, and where the ONE line stands.
 *
 * The rule is Gould's (*Behind Bars* pp. 314–315, read from the scan):
 *
 * > *"Stems for groups of beamed notes that span both staves point towards the centre of the system
 * > and are joined by a common beam. … Position a beam so that the shortest stems in both directions
 * > are of equal length. For clarity, keep beams clear of the staves where possible. Horizontal beams,
 * > in particular, are hard to read against stave lines and should be placed in the space between the
 * > staves, even if this results in unequal stem lengths."*
 * >
 * > *"To use a double-stemmed beam, the staves must be far enough apart to give adequate length (at
 * > least 2½ stave-spaces) to all stems."*
 *
 * ⭐ **Everything here is in STAFF LINES of the group's own frame** (`keyLines.geoLine`: 1 = the
 * home staff's bottom line, a step is ½, a crossed head carries its staff's lift). No y is asked, so
 * the answer exists BEFORE the formatter runs — the stem directions it decides are inputs to the
 * formatter, not a second pass after it.
 *
 * ⛔ NOT here: the SLOPE (always horizontal for now — Gould: *"If in doubt use a horizontal beam"*;
 * her rules a–d are a follow-up), pushing the staves apart (the gap is an INPUT — he widens it), and
 * a chord SPLIT across the staves inside such a group (the caller declines those).
 */

/** Every number here is one house style's default — a changeable row, per CLAUDE.md. */
export const CROSS_STAFF_BEAM = {
  /** Gould p. 315: the shortest stem a double-stemmed beam may leave, in staff spaces. */
  minStemSpaces: 2.5,
  /** How far the beam's near edge keeps from a staff's outer line, in staff spaces, where the gap
   *  allows it. ⚠️ Unsourced beyond *"keep beams clear of the staves"* — half a space is the
   *  smallest distance that reads as a gap at all. */
  staffClearanceSpaces: 0.5,
}

/** One chord of the group, in the group's own lines. */
export interface CrossStaffBeamChord {
  /** Its highest and lowest head, as {@link geoLine}s. */
  topLine: number
  bottomLine: number
  /** The lift of the staff it is WRITTEN on — 0 at home. ⚠️ The same for every head: a split chord
   *  is the caller's to refuse. */
  lift: number
}

export interface CrossStaffBeamPlan {
  /** Per chord, in order: `1` up, `-1` down. */
  stemDirections: number[]
  /** Where the beam's line stands, as a {@link geoLine}. */
  beamLine: number
}

/**
 * The plan for one group, or `null` when it is not a cross-staff beam at all: every chord on one
 * staff, or stems that would come out shorter than the floor — then the group is an ordinary beam
 * with one direction (Gould p. 315: *"Place stems in one direction when… the staves cannot be moved
 * further apart"*).
 *
 * @param stackSpaces How thick the whole stack of beam lines is, in staff spaces — the clearance is
 *   kept from the stack's far edge, not from its first line.
 */
export function crossStaffBeamPlan(
  chords: readonly CrossStaffBeamChord[],
  stackSpaces: number = 0.5,
): CrossStaffBeamPlan | null {
  const lifts = [...new Set(chords.map(c => c.lift))]
  if (lifts.length !== 2) return null
  const upperLift = Math.max(...lifts)
  const lowerLift = Math.min(...lifts)
  const upper = chords.filter(c => c.lift === upperLift)
  const lower = chords.filter(c => c.lift === lowerLift)

  // The heads nearest the gap: the upper staff's LOWEST, the lower staff's HIGHEST.
  const upperNear = Math.min(...upper.map(c => c.bottomLine))
  const lowerNear = Math.max(...lower.map(c => c.topLine))
  // ⭐ "The shortest stems in both directions are of equal length."
  let beamLine = (upperNear + lowerNear) / 2

  // ⭐ "…placed in the space between the staves, even if this results in unequal stem lengths."
  //   The gap runs from the lower staff's top line (5) to the upper staff's bottom line (1).
  const clear = CROSS_STAFF_BEAM.staffClearanceSpaces + stackSpaces
  const floor = 5 + lowerLift + clear
  const ceiling = 1 + upperLift - clear
  if (floor <= ceiling) beamLine = Math.min(Math.max(beamLine, floor), ceiling)

  // ⛔ Below the floor it is not this notation at all.
  const shortest = Math.min(upperNear - beamLine, beamLine - lowerNear)
  if (shortest < CROSS_STAFF_BEAM.minStemSpaces) return null

  return { stemDirections: chords.map(c => (c.lift === upperLift ? -1 : 1)), beamLine }
}
