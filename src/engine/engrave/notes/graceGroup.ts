/**
 * ⭐ **GRACE NOTES — the geometry of the ink**, pure (`docs/plans/grace-notes-plan.md` §5): where the
 * SLASH of an acciaccatura runs. Where the heads stand is `layout/graceRoom` (the same function
 * reserves their room); the drawing is `rendering/GracePass`.
 *
 * ⛔ No SLUR: a grace draws none of its own — a slur on a grace is the user's, a real one (his call,
 * 2026-09-22, reversing D3).
 *
 * ⛔ Every number is one house style's DEFAULT, a changeable row (`CLAUDE.md`); sources are
 * `docs/research/grace-notes-research.md` §0.4.
 */

import { anchor, type GlyphName } from '@/engine/fonts/fontMetrics'

/**
 * ⭐ **The slash — where the FONT says it goes** (his call, 2026-09-22, after seeing the drawn-line version
 * next to MuseScore's, Verovio's and LilyPond's: *"very ugly"*). SMuFL puts two anchors on the 8th flag,
 * `graceNoteSlashSW` / `graceNoteSlashNE` — the font designer's own slash, lower left to upper right,
 * in the flag glyph's coordinates. Only Bravura has them, and only on the 8th flags, so where the face
 * or the flag has none, the slash takes BRAVURA's 8th anchors as its rows: the same shape on every
 * note, measured from the flag's origin (the stem's left edge at its tip).
 *
 * ⛔ Not SMuFL's precomposed grace glyphs (U+E560–E563) — *"Scoring applications should draw grace
 * notes in the same way as they draw regular notes"* (SMuFL; research §0.5).
 * ⚠️ Replaced the first version's rows, measured off Gould's plate (2.15 sp long, 1.15 sp past the
 * stem): they reached far beyond the flag of a note at 2/3 size.
 */
export const GRACE_SLASH = {
  /** Lower-left end, staff spaces from the flag origin, y UP (the font's axis). */
  southWest: { value: [-0.644, -2.456] as const, source: 'Bravura flag8thUp graceNoteSlashSW' },
  /** Upper-right end. */
  northEast: { value: [1.284, -0.796] as const, source: 'Bravura flag8thUp graceNoteSlashNE' },
  /** Its weight, in SYSTEM staff spaces (the group's scale is undone by the caller). */
  thickness: { value: 0.09, source: 'Gould, measured ≈0.09 sp; MuseScore stemSlashThickness 0.125 × grace 0.7 = 0.0875' },
} as const

/**
 * The slash for a stem-UP grace, in the grace's OWN px (inside its `scaling(k)` group, where the flag
 * glyph is drawn at full size): from the flag's anchors when the face has them, else {@link GRACE_SLASH}'s
 * rows. `origin` is where the flag glyph is stamped (`flagPlacement`) — or, for a stem with no flag,
 * the same point: the stem's left edge at its tip.
 */
export function graceSlash(origin: { x: number; y: number }, flag: GlyphName | null, spacePx: number): Segment {
  const sw = (flag && anchor(flag, 'graceNoteSlashSW')) || GRACE_SLASH.southWest.value
  const ne = (flag && anchor(flag, 'graceNoteSlashNE')) || GRACE_SLASH.northEast.value
  return {
    x1: origin.x + sw[0] * spacePx, y1: origin.y - sw[1] * spacePx,
    x2: origin.x + ne[0] * spacePx, y2: origin.y - ne[1] * spacePx,
  }
}

/**
 * ⭐ **The slash on a stem with NO FLAG** — today a quarter or a half; whatever `NOTE_DURATION_ROWS`
 * says has a stem and no flag (his call, 2026-09-22: *"different positions for the slash on durations
 * with flags and duration with no flags"*). No book draws one (all three define the acciaccatura as a
 * slashed 8th — research §0.8).
 *
 * ⭐ The 8th's ANGLE and DEPTH below the tip ({@link GRACE_SLASH}'s anchors), its own LENGTH (his eye —
 * see the row), and its own POSITION: centred on the stem, since there is no flag to lean into.
 * Tunable live from the console (`dev/graceConsole` — `__grace.slash({…})`).
 * ⛔ No stem (today a whole note), no slash: the caller draws none. ⚠️ He keeps more durations coming —
 * key on what the note HAS, ⛔ never on a list of today's values.
 */
const [SW_X, SW_Y] = GRACE_SLASH.southWest.value
const [NE_X, NE_Y] = GRACE_SLASH.northEast.value
export const GRACE_SLASH_UNFLAGGED = {
  /**
   * Its length, in the GRACE's own staff spaces (× the grace size on the page). ⚠️ HIS EYE, twice:
   * one notehead (MuseScore's no-hook rule, ≈1.2) was *"to little i almost dont see it"*, the 8th's own
   * 2.54 *"too big"* — so the middle, pending his `__grace.slash(…)`.
   */
  length: { value: 1.8, source: 'his eye, between MuseScore’s one notehead (≈1.2) and the 8th’s slash (2.54) — 2026-09-22' },
  /** Its rise, degrees above the horizontal — the 8th's. */
  angle: { value: (Math.atan2(NE_Y - SW_Y, NE_X - SW_X) * 180) / Math.PI, source: 'Bravura flag8thUp graceNoteSlashSW→NE (≈40.7°); Gould ≈40.5°' },
  /** Where it crosses the stem, below the tip, grace staff spaces — where the 8th's crosses its stem. */
  crossBelowTip: { value: -(SW_Y + ((0 - SW_X) / (NE_X - SW_X)) * (NE_Y - SW_Y)), source: 'the 8th slash’s crossing at the stem, from the same anchors' },
} as const

/** The three numbers of the no-flag slash, as armed — {@link GRACE_SLASH_UNFLAGGED} until he tunes them. */
export interface UnflaggedSlash {
  length: number
  angle: number
  crossBelowTip: number
}

const defaults = (): UnflaggedSlash => ({
  length: GRACE_SLASH_UNFLAGGED.length.value,
  angle: GRACE_SLASH_UNFLAGGED.angle.value,
  crossBelowTip: GRACE_SLASH_UNFLAGGED.crossBelowTip.value,
})
const slashState: { armed: UnflaggedSlash; generation: number } = { armed: defaults(), generation: 0 }

/** The no-flag slash as armed. */
export function unflaggedSlashSettings(): UnflaggedSlash {
  return { ...slashState.armed }
}

/** 🚨 Re-engraves every bar holding a grace when re-armed — in `layout/widthRowGenerations`. */
export function graceSlashGeneration(): number {
  return slashState.generation
}

/**
 * Arm any of the three (the dev console's `__grace.slash({…})`). ⛔ A value out of range is REFUSED —
 * length 0.3–5 · angle 5–85° · depth 0–5 — and nothing changes.
 */
export function setUnflaggedSlash(change: Partial<UnflaggedSlash>): boolean {
  const next = { ...slashState.armed, ...change }
  const ok = next.length >= 0.3 && next.length <= 5 && next.angle >= 5 && next.angle <= 85
    && next.crossBelowTip >= 0 && next.crossBelowTip <= 5
  if (!ok) return false
  slashState.armed = next
  slashState.generation++
  return true
}

export function resetUnflaggedSlash(): void {
  slashState.armed = defaults()
  slashState.generation++
}

/**
 * The slash for a stem-UP grace with NO flag, in the grace's OWN px: centred on the stem at `stemX`
 * (its centre line), crossing it the armed depth below the tip at `tipY`.
 */
export function graceSlashUnflagged(stemX: number, tipY: number, spacePx: number): Segment {
  const { length, angle, crossBelowTip } = slashState.armed
  const half = (length * spacePx) / 2
  const a = (angle * Math.PI) / 180
  const cy = tipY + crossBelowTip * spacePx
  return { x1: stemX - half * Math.cos(a), y1: cy + half * Math.sin(a), x2: stemX + half * Math.cos(a), y2: cy - half * Math.sin(a) }
}

/** A straight stroke. */
export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}
