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
  /** ⭐ The DRAWN slash's weight (a stem with no flag — a flag's slash is the glyph), in the GRACE's own
   *  staff spaces: the glyph's, so the two match (his call, 2026-09-22). Was 0.09 SYSTEM sp (Gould). */
  thickness: { value: 0.238, source: 'Bravura E564 graceNoteSlashStemUp, measured off its outline — the glyph every other slash stamps' },
} as const

/**
 * ⭐ **…and on a stem-DOWN flag** (P6's flip) — the VERTICAL MIRROR: it falls left to right. The font
 * says so (SMuFL's `graceNoteSlashNW`/`SE` on the down flags; its own glyph U+E565 is E564 mirrored), and
 * so do Gould (drawn twice, pp. 125–126) and MuseScore. ⚠️ G&L p. 72 and Ross p. 190 say it ALWAYS
 * rises — a preset if he wants it, not built. Bravura's `flag8thDown` anchors are the rows where a face
 * or a flag has none.
 */
export const GRACE_SLASH_DOWN = {
  /** Upper-left end — where the glyph E565's origin goes. Staff spaces from the flag origin, y UP. */
  northWest: { value: [-0.596, 2.168] as const, source: 'Bravura flag8thDown graceNoteSlashNW' },
  /** Lower-right end. */
  southEast: { value: [1.328, 0.628] as const, source: 'Bravura flag8thDown graceNoteSlashSE' },
} as const

/** Where a stem-DOWN flag's slash glyph (E565) stands — its upper-left corner, the grace's own px. */
export function graceSlashDownOrigin(origin: { x: number; y: number }, flag: GlyphName | null, spacePx: number): { x: number; y: number } {
  const nw = (flag && anchor(flag, 'graceNoteSlashNW')) || GRACE_SLASH_DOWN.northWest.value
  return { x: origin.x + nw[0] * spacePx, y: origin.y - nw[1] * spacePx }
}

/** A stroke reflected about the horizontal line `y = axisY` — a stem-UP slash turned into its stem-DOWN
 *  mirror (P6). */
export function mirrorSegment(s: Segment, axisY: number): Segment {
  return { x1: s.x1, y1: 2 * axisY - s.y1, x2: s.x2, y2: 2 * axisY - s.y2 }
}

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

/**
 * ⭐ **The slash on a BEAMED group** (P2c) — ONE, on the FIRST stem. The books split (Gould p. 126
 * *may*, Stone *must*, G&L *never*) and so do the engines, so it is a TABLE OF PRESETS, armed from the
 * console (`dev/graceConsole` — `__grace.beamSlash(…)`), ⭐ his call (2026-09-22): *"lets try musescore
 * numbers, and if not we can always go back … presets so the user can change it"*. Sources read in the
 * engines themselves (`~/dev/engine-sources`, 2026-09-22):
 *
 * | preset | what it draws |
 * |---|---|
 * | `bravura` ✅ ARMED | ⭐ HIS: the FONT's own slash GLYPH, stamped — U+E564 `graceNoteSlashStemUp` (*"why we are not using a glyph for the slash … an hand engraver had a tool for this"*; 37.5°, 2.49 × 0.24 grace spaces, measured off its outline). Placed by its BOX: its left edge {@link BeamSlashAdjust}`.glyphLeft` left of the stem, its bottom `.glyphDown` below the tip. ⚠️ A punch: it does NOT lean with the beam. After his look at `musescore`: *"a little bit long … not thick enough"*, then *"too low"*. |
 * | `musescore` | `TLayout::layoutStemSlash`, beam branch: from half a notehead left of the stem's right edge, `stemSlashPosition` 2.0 sp × 0.66 × the grace size below the tip; at `stemSlashAngle` 40° PLUS half the beam's own angle; 2 sp long (the STAFF's spatium — ⛔ not scaled by the grace), × 1.1 when the beam rises; `stemSlashThickness` 0.125 sp × the grace size. On the beam's first chord only (`chordlayout.cpp:1259`). |
 * | `lilypond` | `beam::slashed-stencil` (`scm/output-lib.scm`, `\slashedGrace`) at its defaults: x from −0.5 to +1 sp of the first stem; starting `slash-slope` 2 × 0.5 = 1 sp plus `slash-stem-fraction` 0.3 of the stem below the beam; ending `over-beam-height` 0.75 sp above it; `slash-thickness` 0.1 sp. ⚠️ LilyPond's own `\acciaccatura` draws NONE — a documented Known Issue. |
 * | `none` | Verovio (`view_element.cpp`: a slash only when the stem is NOT in a beam), and LilyPond's default. |
 *
 * Every length is in the page's staff spaces; the caller's `k` turns them into the grace's own px.
 */
export const GRACE_BEAM_SLASH_RULES = ['bravura', 'musescore', 'lilypond', 'none'] as const
export type GraceBeamSlashRule = typeof GRACE_BEAM_SLASH_RULES[number]

/** MuseScore's numbers (`styledef.cpp` + `layoutStemSlash`). */
export const MUSESCORE_BEAM_SLASH = {
  position: { value: 2.0, source: 'Sid::stemSlashPosition 2.0 sp' },
  heightReduction: { value: 0.66, source: 'layoutStemSlash heightReduction (no hook)' },
  angle: { value: 40, source: 'Sid::stemSlashAngle 40°' },
  length: { value: 2, source: 'layoutStemSlash: 2 × spatium (the staff’s)' },
  lengthIncrease: { value: 1.1, source: 'layoutStemSlash lengthIncrease — an obtuse (rising) beam' },
  thickness: { value: 0.125, source: 'Sid::stemSlashThickness 0.125 sp × mag' },
} as const

/** LilyPond's `beam::slashed-stencil` defaults. */
export const LILYPOND_BEAM_SLASH = {
  xLeft: { value: -0.5, source: 'details.slash-X-positions (-0.5 . 1)' },
  xRight: { value: 1, source: 'details.slash-X-positions (-0.5 . 1)' },
  slope: { value: 2, source: 'details.slash-slope 2' },
  stemFraction: { value: 0.3, source: 'details.slash-stem-fraction 0.3' },
  overBeam: { value: 0.75, source: 'details.over-beam-height 0.75' },
  thickness: { value: 0.1, source: 'details.slash-thickness 0.1 (the manual’s default)' },
} as const

let armedBeamSlash: GraceBeamSlashRule = 'bravura'

/**
 * ⭐ **HIS EYE on the `musescore` preset** — where it STARTS, moved, and how long it runs, scaled; the
 * GRACE's own staff spaces. His first look (2026-09-22): *"musescore slash looks too big but maybe is
 * the position (it should go a little more to the left and probably to compensate that a little
 * down)"* — so the first guess moves it, and keeps MuseScore's length. Tunable from the console
 * (`__grace.beamSlash({ left, down, length })`); ⛔ a guess, his to set.
 */
export interface BeamSlashAdjust {
  /** `musescore`: how far LEFT of MuseScore's start (half a head left of the stem's right edge). */
  left: number
  /** `musescore`: how far BELOW MuseScore's start (1.32 sp × the grace size below the tip). */
  down: number
  /** `musescore`: × MuseScore's length (2 staff spaces). */
  length: number
  /** `bravura`: how far LEFT of the stem's centre the GLYPH's box starts. */
  glyphLeft: number
  /** `bravura`: how far BELOW the stem's tip the GLYPH's box bottom stands — its lower-left end. */
  glyphDown: number
}
/** ⭐ The glyph's place is HIS EYE: first where his accepted `musescore` look started (0.9 left of the
 *  stem, 1.2 below the tip — after *"too low"*), then *"almost nothing to the right and almost nothing
 *  … up"* (2026-09-22): 0.8 · 1.1 — crossing the stem ≈0.46 below the tip, clearing the beam by ≈0.5. */
export const BEAM_SLASH_ADJUST_DEFAULT: Readonly<BeamSlashAdjust> = { left: 0.4, down: 0.3, length: 1, glyphLeft: 0.8, glyphDown: 1.1 }
let beamSlashAdjust: BeamSlashAdjust = { ...BEAM_SLASH_ADJUST_DEFAULT }

/** The adjustment as armed. */
export function beamSlashAdjustment(): BeamSlashAdjust {
  return { ...beamSlashAdjust }
}

/** Arm any of the three. ⛔ Refused out of range (left/down −3…3, length 0.3…2); re-engraves. */
export function setBeamSlashAdjustment(change: Partial<BeamSlashAdjust>): boolean {
  const next = { ...beamSlashAdjust, ...change }
  const ok = Math.abs(next.left) <= 3 && Math.abs(next.down) <= 3 && next.length >= 0.3 && next.length <= 2
    && Math.abs(next.glyphLeft) <= 3 && Math.abs(next.glyphDown) <= 4
  if (!ok) return false
  beamSlashAdjust = next
  slashState.generation++
  return true
}

export function resetBeamSlashAdjustment(): void {
  beamSlashAdjust = { ...BEAM_SLASH_ADJUST_DEFAULT }
  slashState.generation++
}

/** The beamed-slash preset as armed. */
export function graceBeamSlashRule(): GraceBeamSlashRule {
  return armedBeamSlash
}

/** Arm a preset (`__grace.beamSlash(…)`). ⛔ An unknown name is refused. Re-engraves every bar with a
 *  grace ({@link graceSlashGeneration}). */
export function setGraceBeamSlashRule(rule: GraceBeamSlashRule): boolean {
  if (!GRACE_BEAM_SLASH_RULES.includes(rule)) return false
  armedBeamSlash = rule
  slashState.generation++
  return true
}

/** What a beamed group's slash is measured from — the grace's own px. */
export interface BeamSlashAt {
  /** The first stem's centre line and its stroke. */
  stemX: number
  stemWeight: number
  /** The beam's edge at that stem — the stem's tip. */
  tipY: number
  /** The stem's other end — the head it grows from. */
  headY: number
  /** The beam's rise over run (y down). */
  slope: number
  /** A notehead's full-size width. */
  headWidth: number
  /** The page's staff space, px, and the grace size — a page length L is L × space / k here. */
  space: number
  k: number
  /** The group's stems: `1` up (the default), `-1` down — the slash is then the MIRROR (P6). */
  stemDirection?: number
}

/** What a beamed group's slash is — a drawn STROKE, or the font's GLYPH stamped at a baseline point. */
export type BeamSlash =
  | { kind: 'stroke'; segment: Segment; thickness: number }
  | { kind: 'glyph'; glyph: GlyphName; x: number; y: number }

/** ⭐ The ARMED preset's slash, grace px — or null for `none`. */
export function graceSlashOnBeam(at: BeamSlashAt, rule: GraceBeamSlashRule = armedBeamSlash): BeamSlash | null {
  if (at.stemDirection === -1) {
    // ⭐ Stems DOWN: the stem-up slash, mirrored about the tip (the beam's edge) — the glyph is E565,
    //    E564's own mirror, its origin its box's upper-left corner.
    if (rule === 'bravura') {
      return {
        kind: 'glyph', glyph: 'graceNoteSlashStemDown',
        x: at.stemX - beamSlashAdjust.glyphLeft * at.space,
        y: at.tipY - beamSlashAdjust.glyphDown * at.space,
      }
    }
    const up = graceSlashOnBeam({ ...at, stemDirection: 1, slope: -at.slope, headY: 2 * at.tipY - at.headY }, rule)
    return up?.kind === 'stroke' ? { ...up, segment: mirrorSegment(up.segment, at.tipY) } : up
  }
  const page = (sp: number) => (sp * at.space) / at.k // a page length, in the grace's own px
  if (rule === 'bravura') {
    // The glyph's origin is its box's lower-left corner (E564: 0 → 2.02 right, 0 → 1.604 up).
    return {
      kind: 'glyph', glyph: 'graceNoteSlashStemUp',
      x: at.stemX - beamSlashAdjust.glyphLeft * at.space,
      y: at.tipY + beamSlashAdjust.glyphDown * at.space,
    }
  }
  if (rule === 'musescore') {
    const m = MUSESCORE_BEAM_SLASH
    const beamAngle = Math.atan(at.slope)
    // Stems up: MuseScore's `up` is −1, so `angle += up × beamAngle / 2` SUBTRACTS it (y down).
    const angle = (m.angle.value * Math.PI) / 180 - beamAngle / 2
    const adjust = beamSlashAdjust
    const length = page(m.length.value) * (beamAngle < 0 ? m.lengthIncrease.value : 1) * adjust.length
    const x1 = at.stemX + at.stemWeight / 2 - at.headWidth / 2 - adjust.left * at.space
    const y1 = at.tipY + (m.position.value * m.heightReduction.value + adjust.down) * at.space // × mag: the grace's own
    return {
      kind: 'stroke',
      segment: { x1, y1, x2: x1 + length * Math.cos(angle), y2: y1 - length * Math.sin(angle) },
      thickness: m.thickness.value * at.space,
    }
  }
  if (rule === 'lilypond') {
    const l = LILYPOND_BEAM_SLASH
    const x1 = at.stemX + page(l.xLeft.value)
    const x2 = at.stemX + page(l.xRight.value)
    return {
      kind: 'stroke',
      segment: {
        x1, y1: at.tipY + page(-l.xLeft.value * l.slope.value) + l.stemFraction.value * (at.headY - at.tipY),
        x2, y2: at.tipY + (x2 - at.stemX) * at.slope - page(l.overBeam.value),
      },
      thickness: page(l.thickness.value),
    }
  }
  return null
}

/** A straight stroke. */
export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}
